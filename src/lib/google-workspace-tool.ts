// MANO chat tools: Google Workspace command center (Gmail + Calendar).
//
// Exported in registry shape (name, description, schema, timeoutMs,
// maxOutputBytes, rateLimitPerMin, execute) so the coordinator can register
// them in src/lib/agent-tools.ts. NOT registered here on purpose.
//
// Safety rules (also encoded in the system prompt):
// - gmail.send and guest-visible calendar writes need the user's explicit
//   confirmation of the exact text/time BEFORE the tool is called.
// - Never invent message/event ids: chain them from a tool read.
import { z } from "zod";
import type { ToolDef } from "./sandbox";
import {
  NOT_LINKED_MESSAGE,
  buildEventBody,
  gwAgenda,
  gwCreateEvent,
  gwDeleteEvent,
  gwReadMessage,
  gwSend,
  gwTriage,
} from "./integrations/google-workspace.server";
// Reads are free; sends ride on the chat-turn credit already charged.
function notLinked() {
  return { ok: false, error: "not_linked", message: NOT_LINKED_MESSAGE };
}

const gmailTriageTool: ToolDef<{ query: string; max?: number }> = {
  name: "gmail.triage",
  description:
    "Search the user's Gmail (Gmail query syntax: from:, subject:, after:, is:unread, has:attachment). Returns sender, subject, date and snippet for each match — never full bodies. Use to find candidate emails before reading or acting on them.",
  schema: z.object({ query: z.string().trim().min(1).max(300), max: z.number().int().min(1).max(25).optional() }),
  timeoutMs: 30_000,
  maxOutputBytes: 12_000,
  rateLimitPerMin: 20,
  execute: async ({ query, max }, { userId }) => {
    try {
      const messages = await gwTriage(userId, query, max ?? 10);
      return { ok: true, count: messages.length, messages };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      if (msg.includes("isn't linked")) return notLinked();
      return { ok: false, error: "gmail_error", message: msg.slice(0, 300) };
    }
  },
};

const gmailReadTool: ToolDef<{ messageId: string }> = {
  name: "gmail.read",
  description:
    "Read one Gmail message by id (get the id from gmail.triage first). Returns sender, subject, date and the full body text.",
  schema: z.object({ messageId: z.string().trim().min(1).max(100) }),
  timeoutMs: 30_000,
  maxOutputBytes: 24_000,
  rateLimitPerMin: 20,
  execute: async ({ messageId }, { userId }) => {
    try {
      const message = await gwReadMessage(userId, messageId);
      return { ok: true, message };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      if (msg.includes("isn't linked")) return notLinked();
      return { ok: false, error: "gmail_error", message: msg.slice(0, 300) };
    }
  },
};

const gmailSendTool: ToolDef<{ to: string; subject: string; body: string }> = {
  name: "gmail.send",
  description:
    "Send a new Gmail message. ONLY call after the user has seen and explicitly approved the exact recipient, subject and body — never send on your own reading. Take recipients/subject/body from the user, never invent them.",
  schema: z.object({
    to: z.string().trim().email().max(200),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20_000),
  }),
  timeoutMs: 30_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 10,
  execute: async ({ to, subject, body }, { userId }) => {
    try {
      const sent = await gwSend(userId, { to, subject, body });
      return { ok: true, id: sent.id, to, subject };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      if (msg.includes("isn't linked")) return notLinked();
      return { ok: false, error: "gmail_error", message: msg.slice(0, 300) };
    }
  },
};

const calendarAgendaTool: ToolDef<{ days?: number }> = {
  name: "calendar.agenda",
  description:
    "Show what's on the user's Google Calendar for the next N days (default 1, max 14). Use for 'what's my day', 'am I free Thursday', scheduling questions.",
  schema: z.object({ days: z.number().int().min(1).max(14).optional() }),
  timeoutMs: 30_000,
  maxOutputBytes: 12_000,
  rateLimitPerMin: 20,
  execute: async ({ days }, { userId }) => {
    try {
      const now = new Date();
      const end = new Date(now.getTime() + (days ?? 1) * 24 * 3600 * 1000);
      const events = await gwAgenda(userId, now.toISOString(), end.toISOString());
      return { ok: true, count: events.length, events };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      if (msg.includes("isn't linked")) return notLinked();
      return { ok: false, error: "calendar_error", message: msg.slice(0, 300) };
    }
  },
};

const calendarCreateTool: ToolDef<{
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}> = {
  name: "calendar.create",
  description:
    "Create a Google Calendar event. Times are RFC3339 with offset (e.g. 2026-10-02T14:00:00+05:30) or YYYY-MM-DD for all-day. Confirm with the user first when the event has guests or is otherwise guest-visible.",
  schema: z.object({
    summary: z.string().trim().min(1).max(200),
    start: z.string().trim().min(1).max(50),
    end: z.string().trim().min(1).max(50),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(200).optional(),
    attendees: z.array(z.string().email()).max(20).optional(),
  }),
  timeoutMs: 30_000,
  maxOutputBytes: 4_000,
  rateLimitPerMin: 10,
  execute: async (input, { userId }) => {
    try {
      // Validate the event body shape before the network call.
      buildEventBody(input);
      const event = await gwCreateEvent(userId, input);
      return { ok: true, event };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      if (msg.includes("isn't linked")) return notLinked();
      return { ok: false, error: "calendar_error", message: msg.slice(0, 300) };
    }
  },
};

const calendarCancelTool: ToolDef<{ eventId: string }> = {
  name: "calendar.cancel",
  description:
    "Delete a Google Calendar event by id (get the id from calendar.agenda first). Guests get a cancellation notice. Confirm with the user before cancelling anything with guests.",
  schema: z.object({ eventId: z.string().trim().min(1).max(200) }),
  timeoutMs: 30_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 10,
  execute: async ({ eventId }, { userId }) => {
    try {
      await gwDeleteEvent(userId, eventId);
      return { ok: true, eventId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      if (msg.includes("isn't linked")) return notLinked();
      return { ok: false, error: "calendar_error", message: msg.slice(0, 300) };
    }
  },
};

export const googleWorkspaceTools = [
  gmailTriageTool,
  gmailReadTool,
  gmailSendTool,
  calendarAgendaTool,
  calendarCreateTool,
  calendarCancelTool,
];

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Send, Trash2, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import logo from "@/assets/nova-x-logo.webp";
import {
  listThreads,
  createThread,
  deleteThread,
  getThreadMessages,
  parseMessages,
} from "@/lib/chat.functions";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "MANOVIK AI — Console" }] }),
});

type Thread = { id: string; title: string; updated_at: string };

function ChatPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [threadKey, setThreadKey] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refreshThreads = useCallback(async () => {
    try {
      const { threads } = await listThreads();
      setThreads(threads as Thread[]);
      return threads as Thread[];
    } catch {
      setThreads([]);
      return [];
    }
  }, []);

  // Bootstrap: load thread list, ensure one exists, select most recent
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await refreshThreads();
        if (cancelled) return;
        let pick = list[0];
        if (!pick) {
          const { thread } = await createThread();
          pick = thread as Thread;
          await refreshThreads();
        }
        if (pick) setActiveId(pick.id);
      } catch (e) {
        console.error("Chat bootstrap failed:", e);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshThreads]);

  // Load messages whenever active thread changes
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      try {
        const { messagesJson } = await getThreadMessages({ data: { threadId: activeId } });
        if (cancelled) return;
        setInitialMessages(parseMessages(messagesJson));
        setThreadKey((k) => k + 1);
      } catch {
        if (!cancelled) setInitialMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const handleNew = async () => {
    const { thread } = await createThread();
    await refreshThreads();
    setActiveId((thread as Thread).id);
  };

  const handleDelete = async (id: string) => {
    await deleteThread({ data: { id } });
    const list = await refreshThreads();
    if (activeId === id) {
      const next = list[0];
      if (next) setActiveId(next.id);
      else {
        const { thread } = await createThread();
        await refreshThreads();
        setActiveId((thread as Thread).id);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !user || bootstrapping || !activeId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border/40 bg-sidebar p-3 md:flex">
        <Link to="/" className="mb-4 flex items-center gap-2 px-2 py-2">
          <img src={logo} alt="MANOVIK AI" width={28} height={28} className="h-7 w-7" />
          <span className="text-base font-bold tracking-wider text-gradient">MANOVIK AI</span>
        </Link>
        <Button onClick={handleNew} className="mb-3 w-full bg-aurora text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New chat
        </Button>
        <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                t.id === activeId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground ring-glow"
                  : "hover:bg-sidebar-accent/50"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveId(t.id)}
                className="flex-1 truncate text-left"
              >
                {t.title || "New conversation"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="opacity-0 transition group-hover:opacity-60 hover:opacity-100"
                aria-label="Delete thread"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-sidebar-border/60 pt-3">
          <div className="px-2 text-xs text-muted-foreground">{user.email}</div>
          <Button asChild variant="ghost" size="sm" className="mt-1 w-full justify-start">
            <Link to="/audit">
              <ShieldCheck className="h-4 w-4" /> Audit log
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="mt-1 w-full justify-start">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Chat panel */}
      <ChatPanel key={threadKey} threadId={activeId} initialMessages={initialMessages} />
    </div>
  );
}

function ChatPanel({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return {
            headers,
            body: { ...body, messages, threadId },
          };
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Something went wrong"),
  });

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    await sendMessage({ text: trimmed });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <img src={logo} alt="" width={72} height={72} className="h-16 w-16 animate-float" />
              <h2 className="mt-4 text-2xl font-bold text-gradient">How can I help today?</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask MANOVIK AI to write code, design a feature, debug a bug, draft an API, or anything else.
              </p>
              <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  "Build a Next.js todo app with auth",
                  "Explain Rust ownership with examples",
                  "Design a REST API for a SaaS",
                  "Refactor this Python function",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="surface-card rounded-lg px-3 py-2.5 text-left text-sm hover:ring-glow transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse-glow rounded-full bg-primary" />
              MANOVIK AI is thinking…
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border/40 bg-background/40 px-4 py-4 backdrop-blur">
        <div className="surface-card mx-auto flex max-w-3xl items-end gap-2 rounded-2xl p-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Message MANOVIK AI…"
            rows={1}
            className="min-h-[44px] max-h-48 resize-none border-0 bg-transparent text-base focus-visible:ring-0"
            disabled={isBusy}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isBusy || !input.trim()}
            className="h-11 w-11 shrink-0 bg-aurora text-primary-foreground glow hover:opacity-90"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          MANOVIK AI may make mistakes. Verify important information.
        </p>
      </form>
    </main>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = message.parts
    .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join("");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground shadow">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <img src={logo} alt="" width={28} height={28} className="mt-1 h-7 w-7 shrink-0" />
      <div className="prose prose-invert min-w-0 max-w-none flex-1 text-foreground prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-secondary prose-pre:p-3 prose-pre:text-xs prose-code:rounded prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-[''] prose-code:after:content-['']">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

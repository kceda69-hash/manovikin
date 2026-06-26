import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PreBlock } from "@/components/CodeBlock";
import {
  Plus,
  Send,
  Trash2,
  LogOut,
  Loader2,
  ShieldCheck,
  CreditCard,
  Menu,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  head: () => ({
    meta: [
      { title: "MANOVIK AI Chat Console" },
      { name: "description", content: "Chat console for MANOVIK AI — stream code, plans, and answers from your autonomous AI agent in real time." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "MANOVIK AI Chat Console" },
      { property: "og:description", content: "Stream code, plans, and answers from your autonomous AI agent." },
      { property: "og:url", content: "https://manovik.in/chat" },
    ],
  }),
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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);


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
    setHistoryLoading(true);
    (async () => {
      try {
        const { messagesJson } = await getThreadMessages({ data: { threadId: activeId } });
        if (cancelled) return;
        setInitialMessages(parseMessages(messagesJson));
        setThreadKey((k) => k + 1);
      } catch {
        if (!cancelled) setInitialMessages([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
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
    return <FullPageChatSkeleton />;
  }




  const handleSelect = (id: string) => {
    setActiveId(id);
    setMobileOpen(false);
  };

  const handleNewMobile = async () => {
    await handleNew();
    setMobileOpen(false);
  };

  const sidebar = (
    <SidebarBody
      threads={threads}
      activeId={activeId}
      userEmail={user.email ?? ""}
      onSelect={handleSelect}
      onNew={handleNewMobile}
      onDelete={handleDelete}
      onSignOut={handleSignOut}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-border/40 bg-sidebar md:flex">
        {sidebar}
      </aside>

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-2 border-b border-border/40 bg-background/80 px-3 py-2 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open chats">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0 bg-sidebar">
              <SheetHeader className="sr-only">
                <SheetTitle>Chats</SheetTitle>
              </SheetHeader>
              {sidebar}
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2">
            <img src={logo} alt="MANOVIK AI" width={24} height={24} className="h-6 w-6 shrink-0" />
            <span className="truncate text-sm font-bold tracking-wider text-gradient">
              MANOVIK AI
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New chat"
            onClick={handleNew}
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </header>

        <ChatPanel key={threadKey} threadId={activeId} initialMessages={initialMessages} />
      </div>
    </div>
  );
}

function SidebarBody({
  threads,
  activeId,
  userEmail,
  onSelect,
  onNew,
  onDelete,
  onSignOut,
}: {
  threads: Thread[];
  activeId: string | null;
  userEmail: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col p-3">
      <Link to="/" className="mb-4 hidden items-center gap-2 px-2 py-2 md:flex">
        <img src={logo} alt="MANOVIK AI" width={28} height={28} className="h-7 w-7" />
        <span className="text-base font-bold tracking-wider text-gradient">MANOVIK AI</span>
      </Link>
      <Button onClick={onNew} className="mb-3 w-full bg-aurora text-primary-foreground hover:opacity-90">
        <Plus className="h-4 w-4" /> New chat
      </Button>
      <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
        {threads.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No chats yet — start one above.
          </p>
        ) : (
          threads.map((t) => (
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
                onClick={() => onSelect(t.id)}
                className="min-w-0 flex-1 truncate text-left"
              >
                {t.title || "New conversation"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(t.id)}
                className="shrink-0 p-1 text-muted-foreground transition hover:text-destructive md:opacity-0 md:group-hover:opacity-60 md:hover:opacity-100"
                aria-label="Delete thread"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 border-t border-sidebar-border/60 pt-3">
        <div className="truncate px-2 text-xs text-muted-foreground">{userEmail}</div>
        <Button asChild variant="ghost" size="sm" className="mt-1 w-full justify-start">
          <Link to="/billing">
            <CreditCard className="h-4 w-4" /> Billing
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="mt-1 w-full justify-start">
          <Link to="/audit">
            <ShieldCheck className="h-4 w-4" /> Audit log
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onSignOut} className="mt-1 w-full justify-start">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
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

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [input]);

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

  const suggestions = [
    { icon: "✨", text: "Build a Next.js todo app with auth" },
    { icon: "🦀", text: "Explain Rust ownership with examples" },
    { icon: "🧩", text: "Design a REST API for a SaaS" },
    { icon: "🛠️", text: "Refactor this Python function" },
  ];

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">MANOVIK AI Chat Console</h1>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-10 text-center sm:pt-20">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-aurora opacity-30 blur-2xl" />
                <img
                  src={logo}
                  alt=""
                  width={72}
                  height={72}
                  className="relative h-16 w-16 animate-float sm:h-20 sm:w-20"
                />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-gradient sm:text-3xl">
                How can I help today?
              </h2>
              <p className="mt-2 max-w-md px-2 text-sm text-muted-foreground">
                Ask MANOVIK AI to write code, design a feature, debug a bug, draft an API, or anything else.
              </p>
              <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => {
                      setInput(s.text);
                      textareaRef.current?.focus();
                    }}
                    className="surface-card group flex items-start gap-2 rounded-xl px-3 py-3 text-left text-sm transition hover:ring-glow"
                  >
                    <span className="text-base leading-none" aria-hidden>{s.icon}</span>
                    <span className="min-w-0 flex-1">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 pl-1 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-primary" />
              <span>MANOVIK AI is thinking…</span>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border/40 bg-background/60 px-3 py-3 backdrop-blur sm:px-4 sm:py-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="surface-card mx-auto flex max-w-3xl items-end gap-2 rounded-2xl p-2 shadow-lg">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Message MANOVIK AI…"
            aria-label="Message MANOVIK AI"
            rows={1}
            className="min-h-[44px] max-h-48 resize-none border-0 bg-transparent text-base focus-visible:ring-0"
            disabled={isBusy}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={isBusy || !input.trim()}
            className="h-11 w-11 shrink-0 bg-aurora text-primary-foreground glow hover:opacity-90"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 hidden text-center text-[11px] text-muted-foreground sm:block">
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
        <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground shadow sm:max-w-[80%]">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 sm:gap-3">
      <img src={logo} alt="" width={28} height={28} className="mt-1 h-7 w-7 shrink-0" />
      <div className="prose prose-invert min-w-0 max-w-none flex-1 text-foreground prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-secondary prose-pre:p-3 prose-pre:text-xs prose-code:rounded prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-[''] prose-code:after:content-['']">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: PreBlock }}>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

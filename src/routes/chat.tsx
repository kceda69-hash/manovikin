import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  LayoutDashboard,
  PanelRightClose,
  PanelRightOpen,
  Wallet,
  BarChart3,
  Crown,
  ArrowUpRight,
  ImageIcon,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Cpu,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOutEverywhere } from "@/lib/auth-signout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import logo from "@/assets/nova-x-logo.webp";
import { Progress } from "@/components/ui/progress";
import { getManovikDashboard, getUiPrefs, setUiPref } from "@/lib/manovik-balance.functions";
import { streamImage } from "@/lib/streamImage";
import { useI18n } from "@/lib/i18n";

import {
  listThreads,
  createThread,
  deleteThread,
  getThreadMessages,
  parseMessages,
} from "@/lib/chat.functions";

/** Minimal Web Speech API typings for the voice-input feature (not in TS's DOM lib). */
interface SpeechRecognitionAlternative {
  readonly transcript: string;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface WindowWithSpeechRecognition {
  readonly SpeechRecognition?: SpeechRecognitionConstructor;
  readonly webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "MANOVIK AI Chat Console" },
      {
        name: "description",
        content:
          "Chat console for MANOVIK AI — stream code, plans, and answers from your autonomous AI agent in real time.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "MANOVIK AI Chat Console" },
      {
        property: "og:description",
        content: "Stream code, plans, and answers from your autonomous AI agent.",
      },
      { property: "og:url", content: "https://manovik.in/chat" },
    ],
  }),
});

type Thread = { id: string; title: string; updated_at: string };

function ChatPage() {
  const { user, loading } = useAuth();
  const rootQueryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [threadKey, setThreadKey] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [desktopDashboardOpen, setDesktopDashboardOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("manovik:dashboard-open") !== "0";
  });
  const fetchUiPrefs = useServerFn(getUiPrefs);
  const persistUiPref = useServerFn(setUiPref);
  const prefsHydrated = useRef(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchUiPrefs()
      .then((res) => {
        if (cancelled) return;
        prefsHydrated.current = true;
        setDesktopDashboardOpen(res.dashboardOpen);
      })
      .catch(() => {
        prefsHydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [user, fetchUiPrefs]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("manovik:dashboard-open", desktopDashboardOpen ? "1" : "0");
    }
    if (!prefsHydrated.current || !user) return;
    persistUiPref({ data: { key: "dashboardOpen", value: desktopDashboardOpen } }).catch(() => {});
  }, [desktopDashboardOpen, user, persistUiPref]);

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
    await signOutEverywhere(rootQueryClient);
    navigate({ to: "/", replace: true });
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

      <div className="flex min-w-0 flex-1">
        {/* Chat column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center gap-2 border-b border-border/40 bg-background/80 px-3 py-2 backdrop-blur md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open chats">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open chats</span>
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
              <img
                src={logo}
                alt="MANOVIK AI"
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
              />
              <span className="truncate text-sm font-bold tracking-wider text-gradient">
                MANOVIK AI
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("aria.showDashboard")}
              onClick={() => setDashboardOpen(true)}
            >
              <LayoutDashboard className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t("aria.newChat")} onClick={handleNew}>
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
            <Sheet open={dashboardOpen} onOpenChange={setDashboardOpen}>
              <SheetContent side="right" className="w-[88vw] max-w-sm p-0 bg-background">
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("aria.workspaceDashboard")}</SheetTitle>
                </SheetHeader>
                <DashboardPanel mobile />
              </SheetContent>
            </Sheet>
          </header>

          <ChatPanel
            key={threadKey}
            threadId={activeId}
            initialMessages={initialMessages}
            historyLoading={historyLoading}
          />
        </div>
        <div
          aria-hidden={!desktopDashboardOpen}
          className={`relative hidden md:block shrink-0 overflow-hidden transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            desktopDashboardOpen
              ? "w-72 opacity-100 translate-x-0"
              : "w-0 opacity-0 translate-x-4 pointer-events-none"
          }`}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("aria.hideDashboard")}
            onClick={() => setDesktopDashboardOpen(false)}
            className="absolute right-2 top-2 z-10 h-8 w-8"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
          <DashboardPanel />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("aria.showDashboard")}
          onClick={() => setDesktopDashboardOpen(true)}
          className={`fixed right-4 top-4 z-20 hidden h-9 w-9 shadow-md md:inline-flex transition-all duration-300 ease-out motion-reduce:transition-none ${
            desktopDashboardOpen
              ? "pointer-events-none scale-90 opacity-0"
              : "scale-100 opacity-100"
          }`}
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type DashboardData = Awaited<ReturnType<typeof getManovikDashboard>>;

function DashboardPanel({ mobile = false }: { mobile?: boolean }) {
  const fetchDashboard = useServerFn(getManovikDashboard);
  const { t } = useI18n();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["manovik-dashboard"],
    queryFn: () => fetchDashboard() as Promise<DashboardData>,
    refetchInterval: 20_000,
  });

  const credits = data?.balance.credits ?? 0;
  const used = data?.balance.monthUsed ?? 0;
  const capacity = Math.max(credits + used, 1);
  const remainingPct = data?.user.isAdmin
    ? 100
    : Math.max(0, Math.min(100, (credits / capacity) * 100));

  return (
    <aside
      className={
        mobile
          ? "h-full overflow-y-auto p-4"
          : "h-full w-72 shrink-0 overflow-y-auto border-l border-border/40 bg-background/80 p-4 backdrop-blur"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <LayoutDashboard className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t("dashboard.title")}</h2>
            <p className="text-[11px] text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
        >
          {t("cta.refresh")}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-3">
          <section className="surface-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("dashboard.remaining")}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gradient">
                    {data.user.isAdmin ? "∞" : credits}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("dashboard.creditsUnit")}
                  </span>
                </div>
              </div>
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <Progress value={remainingPct} className="mt-4 h-2" />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>
                {data.user.isAdmin
                  ? t("dashboard.adminBypass")
                  : t("dashboard.usedMonth", { n: used })}
              </span>
              <span>{Math.round(remainingPct)}%</span>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={BarChart3}
              label={t("dashboard.metric.messages")}
              value={data.usage.messages.toLocaleString()}
            />
            <MetricCard
              icon={MessageSquarePlus}
              label={t("dashboard.metric.threads")}
              value={data.usage.threads.toLocaleString()}
            />
          </div>

          <section className="surface-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  {data.plan} {t("dashboard.plan.suffix")}
                </span>
              </div>
              <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                <Link to="/billing">
                  {t("cta.manage")} <ArrowUpRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.plan === "Free"
                ? t("dashboard.plan.upgradeCopy")
                : t("dashboard.plan.paidCopy")}
            </p>
          </section>

          <section className="surface-card rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("dashboard.creditActivity")}</h3>
              <div className="flex items-center gap-3">
                <Link
                  to="/dashboard"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link to="/account" className="text-xs text-muted-foreground hover:text-foreground">
                  Account
                </Link>
                <Link to="/balance" className="text-xs text-primary hover:underline">
                  {t("cta.open")}
                </Link>
              </div>
            </div>
            <div className="space-y-2">
              {data.recentLedger.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.noCredits")}</p>
              ) : (
                data.recentLedger
                  .slice(0, 4)
                  .map((row: { delta: number; reason: string; created_at: string }, i: number) => (
                    <div
                      key={`${row.created_at}-${i}`}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-muted-foreground">{row.reason}</span>
                      <span className={row.delta < 0 ? "text-destructive" : "text-primary"}>
                        {row.delta > 0 ? `+${row.delta}` : row.delta}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section className="surface-card rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("dashboard.security")}</h3>
              <Link to="/audit" className="text-xs text-primary hover:underline">
                {t("dashboard.auditLog")}
              </Link>
            </div>
            <div className="space-y-2">
              {data.recentAudit.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.noSecurity")}</p>
              ) : (
                data.recentAudit
                  .slice(0, 3)
                  .map(
                    (
                      row: { event_type: string; summary: string | null; created_at: string },
                      i: number,
                    ) => (
                      <div
                        key={`${row.created_at}-${i}`}
                        className="rounded-lg border border-border/40 bg-background/40 p-2"
                      >
                        <div className="text-[11px] font-medium">{row.event_type}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {row.summary ?? t("dashboard.recorded")}
                        </div>
                      </div>
                    ),
                  )
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {t("dashboard.failed")}
        </div>
      )}
    </aside>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <section className="surface-card rounded-xl p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </section>
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
      <Button
        onClick={onNew}
        className="mb-3 w-full bg-aurora text-primary-foreground hover:opacity-90"
      >
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
                aria-label={`Open conversation: ${t.title || "New conversation"}`}
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
  historyLoading,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  historyLoading: boolean;
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
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastUserSendRef = useRef(0);
  const pendingPromptLoadedRef = useRef(false);

  // --- Image studio ---
  const [imageMode, setImageMode] = useState(false);
  const [imageQuality, setImageQuality] = useState<"4k" | "8k">("8k");
  const [images, setImages] = useState<
    Array<{ id: string; prompt: string; url: string; final: boolean }>
  >([]);
  const [imageBusy, setImageBusy] = useState(false);

  // --- JARVIS voice ---
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const spokenRef = useRef<string | null>(null);

  const generateImage = useCallback(
    async (prompt: string) => {
      const id = crypto.randomUUID();
      setImages((prev) => [...prev, { id, prompt, url: "", final: false }]);
      setImageBusy(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        await streamImage(
          "/api/generate-image",
          { prompt, quality: imageQuality, aspect: "1:1" },
          (dataUrl, isFinal) => {
            setImages((prev) =>
              prev.map((im) => (im.id === id ? { ...im, url: dataUrl, final: isFinal } : im)),
            );
          },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
      } catch (err) {
        setImages((prev) => prev.filter((im) => im.id !== id));
        toast.error((err as Error).message || "Image generation failed");
      } finally {
        setImageBusy(false);
        void queryClient.invalidateQueries({ queryKey: ["manovik-dashboard"] });
      }
    },
    [imageQuality, queryClient],
  );

  const toggleListening = useCallback(() => {
    const speechWindow = window as unknown as WindowWithSpeechRecognition;
    const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setInput(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  // Speak the latest completed assistant reply when JARVIS voice output is on.
  useEffect(() => {
    if (!speakOn || status === "streaming" || status === "submitted") return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const text = last.parts
      .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
      .join("")
      .replace(/```[\s\S]*?```/g, " code block ")
      .slice(0, 1200);
    if (!text || spokenRef.current === last.id) return;
    spokenRef.current = last.id;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = navigator.language || "en-US";
    utter.rate = 1.03;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [messages, speakOn, status]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (
      pendingPromptLoadedRef.current ||
      messages.length > 0 ||
      status === "submitted" ||
      status === "streaming"
    )
      return;
    pendingPromptLoadedRef.current = true;
    try {
      const raw = sessionStorage.getItem("manovik:pending-prompt");
      if (!raw) return;
      sessionStorage.removeItem("manovik:pending-prompt");
      const saved = JSON.parse(raw) as { prompt?: string; target?: string; model?: string };
      const prompt = saved.prompt?.trim();
      if (!prompt) return;
      const context = [
        saved.target && `Target: ${saved.target}`,
        saved.model && `Model: ${saved.model}`,
      ]
        .filter(Boolean)
        .join(" · ");
      void sendMessage({ text: context ? `${prompt}\n\n${context}` : prompt });
      lastUserSendRef.current = Date.now();
    } catch {
      // Ignore corrupted handoff state.
    }
  }, [messages.length, sendMessage, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  // Smooth scroll-to-bottom: instant jump right after the user sends (so their
  // message snaps into view on mobile), smooth while the assistant streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const justSent = Date.now() - lastUserSendRef.current < 400;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: justSent ? "auto" : "smooth",
    });
  }, [messages, status]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [input]);

  const isBusy = status === "submitted" || status === "streaming" || imageBusy;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    lastUserSendRef.current = Date.now();
    if (imageMode) {
      await generateImage(trimmed);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
      return;
    }
    await sendMessage({ text: trimmed });
    void queryClient.invalidateQueries({ queryKey: ["manovik-dashboard"] });
    // Belt-and-braces: force scroll-into-view for mobile keyboards.
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
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
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-3 py-4 sm:px-6 sm:py-8 [-webkit-overflow-scrolling:touch]"
      >
        <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
          {historyLoading && messages.length === 0 ? (
            <ChatHistorySkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-10 text-center sm:pt-20">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-aurora opacity-30 blur-2xl" />
                <img
                  src={logo}
                  alt="MANOVIK AI logo"
                  width={72}
                  height={72}
                  className="relative h-16 w-16 animate-float sm:h-20 sm:w-20"
                />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-gradient sm:text-3xl">
                How can I help today?
              </h2>
              <p className="mt-2 max-w-md px-2 text-sm text-muted-foreground">
                Ask MANOVIK AI to write code, design a feature, debug a bug, draft an API, or
                anything else.
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
                    <span className="text-base leading-none" aria-hidden>
                      {s.icon}
                    </span>
                    <span className="min-w-0 flex-1">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {images.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {images.map((im) => (
                <figure key={im.id} className="surface-card overflow-hidden rounded-xl">
                  {im.url ? (
                    <img
                      src={im.url}
                      alt={im.prompt}
                      className={`w-full transition-[filter] duration-500 ${im.final ? "blur-0" : "blur-2xl"}`}
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering…
                    </div>
                  )}
                  <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                    <span className="line-clamp-1">{im.prompt}</span>
                    {im.final && (
                      <a href={im.url} download={`manovik-${im.id}.png`} className="underline">
                        Download
                      </a>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {status === "submitted" && (
            <div className="flex items-center gap-2 pl-1 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-primary" />
              <span>MANOVIK AI is thinking…</span>
            </div>
          )}
          <div ref={bottomRef} aria-hidden className="h-px w-full" />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border/40 bg-background/60 px-3 py-3 backdrop-blur sm:px-4 sm:py-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={imageMode ? "default" : "outline"}
            aria-pressed={imageMode}
            onClick={() => setImageMode((v) => !v)}
            className="h-8 rounded-full"
          >
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Image studio
          </Button>
          {imageMode && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full"
              onClick={() => setImageQuality((q) => (q === "8k" ? "4k" : "8k"))}
            >
              {imageQuality.toUpperCase()} ultra-HD
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={listening ? "default" : "outline"}
            aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            onClick={toggleListening}
            className="h-8 rounded-full"
          >
            {listening ? (
              <Square className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Mic className="mr-1.5 h-3.5 w-3.5" />
            )}
            {listening ? "Listening…" : "Speak"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={speakOn ? "default" : "outline"}
            aria-pressed={speakOn}
            aria-label={speakOn ? "Turn off spoken replies" : "Turn on spoken replies"}
            onClick={() => {
              setSpeakOn((v) => {
                if (v && typeof window !== "undefined") window.speechSynthesis.cancel();
                return !v;
              });
            }}
            className="h-8 rounded-full"
          >
            {speakOn ? (
              <Volume2 className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <VolumeX className="mr-1.5 h-3.5 w-3.5" />
            )}
            JARVIS voice
          </Button>
          <Button asChild type="button" size="sm" variant="outline" className="h-8 rounded-full">
            <Link to="/devices">
              <Cpu className="mr-1.5 h-3.5 w-3.5" /> Devices
            </Link>
          </Button>
        </div>
        <div className="premium-composer surface-card mx-auto flex max-w-3xl items-end gap-2 rounded-2xl p-2 shadow-lg">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              imageMode
                ? `Describe the ${imageQuality.toUpperCase()} image to render…`
                : "Message MANOVIK AI…"
            }
            aria-label={imageMode ? "Describe the image to generate" : "Message MANOVIK AI"}
            rows={1}
            className="min-h-[44px] max-h-48 resize-none border-0 bg-transparent text-base focus-visible:ring-0"
            disabled={isBusy}
          />
          <Button
            type="submit"
            size="icon"
            aria-label={imageMode ? "Generate image" : "Send message"}
            disabled={isBusy || !input.trim()}
            className="premium-send h-11 w-11 shrink-0 bg-aurora text-primary-foreground glow hover:opacity-90"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : imageMode ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">{imageMode ? "Generate image" : "Send message"}</span>
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
      <img src={logo} alt="MANOVIK AI" width={28} height={28} className="mt-1 h-7 w-7 shrink-0" />
      <div className="prose prose-invert min-w-0 max-w-none flex-1 text-foreground prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-secondary prose-pre:p-3 prose-pre:text-xs prose-code:rounded prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-[''] prose-code:after:content-['']">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: PreBlock }}>
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function ChatHistorySkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Loading conversation">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          {/* user-side bubble */}
          <div className="flex justify-end">
            <div className="h-10 w-2/3 max-w-[80%] animate-pulse rounded-2xl rounded-tr-sm bg-muted/60 sm:w-1/2" />
          </div>
          {/* assistant lines */}
          <div className="flex gap-2 sm:gap-3">
            <div className="mt-1 h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-11/12 animate-pulse rounded bg-muted/60" />
              <div className="h-3 w-9/12 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-7/12 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FullPageChatSkeleton() {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <aside className="hidden w-72 shrink-0 flex-col gap-2 border-r border-border/40 bg-sidebar p-3 md:flex">
        <div className="mb-3 h-10 w-full animate-pulse rounded-lg bg-muted/60" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-muted/40" />
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border/40 bg-background/80 px-3 py-2 backdrop-blur md:hidden">
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted/60" />
          <div className="h-5 flex-1 animate-pulse rounded bg-muted/40" />
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading your conversations…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Copy, Terminal, Server, Cpu, Database, Rocket, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Setup Wizard — MANOVIK AI Sovereign Install" },
      {
        name: "description",
        content:
          "Step-by-step wizard to self-host MANOVIK AI with Docker, your own AI provider, and your own database.",
      },
      { property: "og:title", content: "Self-host MANOVIK AI — Sovereign setup wizard" },
      {
        property: "og:description",
        content:
          "Run MANOVIK on your own infrastructure with Docker, your AI provider, and your database. Step-by-step guide.",
      },
      { property: "og:url", content: "https://manovik.in/setup" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/setup" }],
  }),
  component: SetupWizard,
});

type Provider = "groq" | "ollama" | "openai" | "openrouter";

const STEPS = [
  { id: 1, label: "Prerequisites", icon: ShieldCheck },
  { id: 2, label: "AI Provider", icon: Cpu },
  { id: 3, label: "Database", icon: Database },
  { id: 4, label: "Generate .env", icon: Terminal },
  { id: 5, label: "Launch", icon: Rocket },
  { id: 6, label: "Verify", icon: Server },
];

function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };
  return (
    <div className="relative group">
      <pre className="bg-muted text-foreground rounded-md p-4 text-sm overflow-x-auto border border-border">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="secondary"
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
      </Button>
    </div>
  );
}

function SetupWizard() {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<Provider>("groq");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("llama-3.3-70b-versatile");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnon, setSupabaseAnon] = useState("");
  const [supabaseService, setSupabaseService] = useState("");
  const [pgPassword, setPgPassword] = useState("changeme-now");

  const providerDefaults: Record<
    Provider,
    { baseUrl: string; model: string; keyHint: string; signup: string }
  > = {
    groq: {
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      keyHint: "gsk_...",
      signup: "https://console.groq.com/keys",
    },
    ollama: {
      baseUrl: "http://ollama:11434/v1",
      model: "llama3.1:8b",
      keyHint: "ollama",
      signup: "https://ollama.com",
    },
    openai: {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      keyHint: "sk-...",
      signup: "https://platform.openai.com/api-keys",
    },
    openrouter: {
      baseUrl: "https://openrouter.ai/api/v1",
      model: "meta-llama/llama-3.1-8b-instruct:free",
      keyHint: "sk-or-...",
      signup: "https://openrouter.ai/keys",
    },
  };

  const selectProvider = (p: Provider) => {
    setProvider(p);
    setAiModel(providerDefaults[p].model);
    if (p === "ollama") setAiKey("ollama");
  };

  const envFile = useMemo(() => {
    const d = providerDefaults[provider];
    return `# --- Sovereign AI provider ---
MANOVIK_AI_BASE_URL=${d.baseUrl}
MANOVIK_AI_API_KEY=${aiKey || d.keyHint}
MANOVIK_AI_MODEL=${aiModel}

# --- Postgres (used by the bundled docker-compose) ---
POSTGRES_PASSWORD=${pgPassword}

# --- Supabase (self-hosted or free hosted tier) ---
SUPABASE_URL=${supabaseUrl || "https://your-project.supabase.co"}
SUPABASE_PUBLISHABLE_KEY=${supabaseAnon || "eyJ...your-anon-key..."}
SUPABASE_SERVICE_ROLE_KEY=${supabaseService || "eyJ...your-service-role-key..."}
VITE_SUPABASE_URL=${supabaseUrl || "https://your-project.supabase.co"}
VITE_SUPABASE_PUBLISHABLE_KEY=${supabaseAnon || "eyJ...your-anon-key..."}
`;
  }, [provider, aiKey, aiModel, pgPassword, supabaseUrl, supabaseAnon, supabaseService]);

  const progress = (step / STEPS.length) * 100;

  return (
    <main className="min-h-screen bg-background text-foreground py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">MANOVIK Setup Wizard</h1>
          <p className="text-muted-foreground mt-2">
            Step-by-step guide to run MANOVIK on your own machine — free, sovereign, no Lovable AI
            balance required.
          </p>
        </header>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
            <span>
              Step {step} of {STEPS.length} — {STEPS[step - 1].label}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
          <div className="grid grid-cols-6 gap-2 mt-4">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const done = s.id < step;
              const active = s.id === step;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  aria-label={`Step ${s.id}: ${s.label}${active ? " (current)" : done ? " (completed)" : ""}`}
                  aria-current={active ? "step" : undefined}
                  className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : done
                        ? "border-border bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sr-only sm:hidden">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <h2 className="font-semibold leading-none tracking-tight">1. Prerequisites</h2>
                <CardDescription>
                  Install these once on the machine that will run MANOVIK.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>
                    <b>Docker Desktop</b> (Mac/Windows) or <b>Docker Engine + Compose</b> (Linux).
                    Get it at{" "}
                    <a
                      className="text-primary underline"
                      href="https://docs.docker.com/get-docker/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      docker.com/get-docker
                    </a>
                    .
                  </li>
                  <li>
                    <b>Git</b> to clone the repo:{" "}
                    <a
                      className="text-primary underline"
                      href="https://git-scm.com/downloads"
                      target="_blank"
                      rel="noreferrer"
                    >
                      git-scm.com
                    </a>
                    .
                  </li>
                  <li>
                    At least <b>8 GB RAM</b> free if you plan to run a local LLM via Ollama (Path
                    B). Cloud providers (Path A) work on any machine.
                  </li>
                </ul>
                <p className="text-sm font-medium mt-4">Verify Docker is installed:</p>
                <CodeBlock code={`docker --version\ndocker compose version`} />
                <p className="text-sm font-medium mt-4">Clone the MANOVIK repo:</p>
                <CodeBlock code={`git clone <your-repo-url> manovik\ncd manovik`} />
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <h2 className="font-semibold leading-none tracking-tight">
                  2. Pick an AI provider
                </h2>
                <CardDescription>
                  Choose where MANOVIK's brain runs. All are free or have free tiers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={provider} onValueChange={(v) => selectProvider(v as Provider)}>
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="groq">Groq (free)</TabsTrigger>
                    <TabsTrigger value="ollama">Ollama (local)</TabsTrigger>
                    <TabsTrigger value="openrouter">OpenRouter</TabsTrigger>
                    <TabsTrigger value="openai">OpenAI</TabsTrigger>
                  </TabsList>
                  <TabsContent value="groq" className="space-y-3 pt-4">
                    <p className="text-sm">
                      Fastest free cloud option. Sign up at{" "}
                      <a
                        className="text-primary underline"
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                      >
                        console.groq.com/keys
                      </a>
                      , create an API key, paste it below.
                    </p>
                  </TabsContent>
                  <TabsContent value="ollama" className="space-y-3 pt-4">
                    <p className="text-sm">
                      Runs the model on your own machine. Zero cost, fully offline. The bundled
                      docker-compose already starts the Ollama service. After launch run:
                    </p>
                    <CodeBlock code={`docker compose exec ollama ollama pull llama3.1:8b`} />
                  </TabsContent>
                  <TabsContent value="openrouter" className="space-y-3 pt-4">
                    <p className="text-sm">
                      Aggregator with several free models. Get a key at{" "}
                      <a
                        className="text-primary underline"
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                      >
                        openrouter.ai/keys
                      </a>
                      .
                    </p>
                  </TabsContent>
                  <TabsContent value="openai" className="space-y-3 pt-4">
                    <p className="text-sm">
                      Paid but highest quality. Get a key at{" "}
                      <a
                        className="text-primary underline"
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                      >
                        platform.openai.com/api-keys
                      </a>
                      .
                    </p>
                  </TabsContent>
                </Tabs>

                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="aiKey">API key</Label>
                    <Input
                      id="aiKey"
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                      placeholder={providerDefaults[provider].keyHint}
                      type="password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="aiModel">Model</Label>
                    <Input
                      id="aiModel"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <h2 className="font-semibold leading-none tracking-tight">
                  3. Database (Supabase)
                </h2>
                <CardDescription>
                  Easiest path: create a free Supabase project, paste its keys here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="list-decimal pl-5 text-sm space-y-2">
                  <li>
                    Go to{" "}
                    <a
                      className="text-primary underline"
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                    >
                      supabase.com/dashboard
                    </a>{" "}
                    and create a free project (no card required).
                  </li>
                  <li>
                    Open <b>Project Settings → API</b> and copy the <b>Project URL</b>, <b>anon</b>{" "}
                    key, and <b>service_role</b> key.
                  </li>
                  <li>
                    Open <b>SQL Editor</b> and run every file inside{" "}
                    <code>supabase/migrations/</code> from the repo.
                  </li>
                </ol>
                <div className="grid gap-3 pt-2">
                  <div>
                    <Label htmlFor="supabaseUrl">Project URL</Label>
                    <Input
                      id="supabaseUrl"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xxxx.supabase.co"
                    />
                  </div>
                  <div>
                    <Label htmlFor="supabaseAnon">Anon (publishable) key</Label>
                    <Input
                      id="supabaseAnon"
                      value={supabaseAnon}
                      onChange={(e) => setSupabaseAnon(e.target.value)}
                      placeholder="eyJ..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="supabaseService">Service role key (server-only)</Label>
                    <Input
                      id="supabaseService"
                      value={supabaseService}
                      onChange={(e) => setSupabaseService(e.target.value)}
                      placeholder="eyJ..."
                      type="password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pgPassword">
                      Postgres password (for bundled Docker Postgres)
                    </Label>
                    <Input
                      id="pgPassword"
                      value={pgPassword}
                      onChange={(e) => setPgPassword(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <h2 className="font-semibold leading-none tracking-tight">
                  4. Generate your .env file
                </h2>
                <CardDescription>
                  Copy this into a file named <code>.env</code> at the project root.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock code={envFile} />
                <Textarea
                  aria-label="Generated .env file contents"
                  value={envFile}
                  readOnly
                  rows={10}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={() => {
                    const blob = new Blob([envFile], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = ".env";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download .env
                </Button>
              </CardContent>
            </>
          )}

          {step === 5 && (
            <>
              <CardHeader>
                <h2 className="font-semibold leading-none tracking-tight">5. Launch MANOVIK</h2>
                <CardDescription>
                  One command builds the image and starts every service.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock code={`docker compose up -d --build`} />
                <p className="text-sm">First build takes 3–5 minutes. When done, open:</p>
                <CodeBlock code={`http://localhost:3000`} />
                {provider === "ollama" && (
                  <>
                    <p className="text-sm font-medium">
                      Ollama users — pull your model after launch:
                    </p>
                    <CodeBlock code={`docker compose exec ollama ollama pull ${aiModel}`} />
                  </>
                )}
                <p className="text-sm font-medium">Tail logs while it starts:</p>
                <CodeBlock code={`docker compose logs -f manovik`} />
              </CardContent>
            </>
          )}

          {step === 6 && (
            <>
              <CardHeader>
                <h2 className="font-semibold leading-none tracking-tight">
                  6. Verify sovereign mode
                </h2>
                <CardDescription>
                  Confirm MANOVIK is talking to your provider, not Lovable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  This should print <b>nothing</b> (no Lovable gateway calls):
                </p>
                <CodeBlock code={`docker compose logs manovik | grep -i "ai.gateway.lovable"`} />
                <p className="text-sm">Quick health check on the AI endpoint:</p>
                <CodeBlock
                  code={
                    provider === "ollama"
                      ? `curl http://localhost:11434/api/tags`
                      : `curl -H "Authorization: Bearer ${aiKey || "YOUR_KEY"}" ${providerDefaults[provider].baseUrl}/models`
                  }
                />
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-semibold mb-1 flex items-center gap-2">
                    <Check className="h-4 w-4" /> You're sovereign.
                  </p>
                  <p className="text-muted-foreground">
                    MANOVIK is now running on infrastructure you control. No Lovable AI balance is
                    consumed by your self-hosted instance.
                  </p>
                </div>
                <p className="text-sm font-medium">Stop / restart commands:</p>
                <CodeBlock
                  code={`docker compose stop\ndocker compose up -d\ndocker compose down -v   # wipes data`}
                />
              </CardContent>
            </>
          )}
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
            Back
          </Button>
          <Button disabled={step === STEPS.length} onClick={() => setStep(step + 1)}>
            {step === STEPS.length ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </main>
  );
}

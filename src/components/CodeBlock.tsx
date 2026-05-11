import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? "").replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className || "")?.[1];

  if (inline || !text.includes("\n")) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg bg-secondary">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-1 transition hover:bg-background/40 hover:text-foreground",
          )}
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

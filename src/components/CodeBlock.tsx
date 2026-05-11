import { useState, isValidElement, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

export function PreBlock({ children, ...props }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  let lang: string | undefined;
  if (isValidElement(children)) {
    const codeProps = children.props as { className?: string };
    lang = /language-(\w+)/.exec(codeProps.className || "")?.[1];
  }

  const text = extractText(children).replace(/\n$/, "");

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
    <div className="group relative my-2 overflow-hidden rounded-lg bg-secondary not-prose">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-1 transition hover:bg-background/40 hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs" {...props}>
        {children}
      </pre>
    </div>
  );
}

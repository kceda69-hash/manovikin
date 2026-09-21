import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://manovik.in";
const PITCH = "MANOVIK AI builds full websites, apps and APIs from one prompt. Free to start:";

/**
 * Lightweight word-of-mouth loop: prefilled share links + copy-link.
 * `source` is appended as a UTM so referred visits are attributable.
 */
export function ShareManovik({
  source = "site",
  className = "",
}: {
  source?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${SITE}/?utm_source=share&utm_medium=referral&utm_campaign=${encodeURIComponent(source)}`;
  const text = `${PITCH} ${link}`;

  const targets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(PITCH)}&url=${encodeURIComponent(link)}`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    },
    {
      label: "Reddit",
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(link)}&title=${encodeURIComponent("MANOVIK AI — build apps and APIs from one prompt")}`,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Share link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <div className={`rounded-xl border border-border/60 bg-card/40 p-5 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Share2 className="h-4 w-4 text-primary" aria-hidden /> Share MANOVIK
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Know someone who keeps postponing an app or a website? Send them MANOVIK.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((t) => (
          <a
            key={t.label}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
          >
            {t.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          aria-label="Copy MANOVIK share link"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

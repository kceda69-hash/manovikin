// Redacts likely-secret patterns from text before storage/logging.
// Conservative patterns; favors false positives over leaks.
const PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /sk-[A-Za-z0-9_-]{20,}/g, label: "OPENAI_KEY" },
  { re: /sk_live_[A-Za-z0-9]{16,}/g, label: "STRIPE_LIVE_KEY" },
  { re: /sk_test_[A-Za-z0-9]{16,}/g, label: "STRIPE_TEST_KEY" },
  { re: /AKIA[0-9A-Z]{16}/g, label: "AWS_KEY_ID" },
  { re: /ghp_[A-Za-z0-9]{30,}/g, label: "GITHUB_PAT" },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/g, label: "SLACK_TOKEN" },
  { re: /AIza[0-9A-Za-z_-]{30,}/g, label: "GOOGLE_API_KEY" },
  { re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, label: "JWT" },
  { re: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"']+/gi, label: "DB_URL" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, label: "PRIVATE_KEY" },
  { re: /\b\d{13,19}\b/g, label: "CARD_NUMBER" },
];

export function redactString(input: string): { text: string; hits: string[] } {
  let text = input;
  const hits: string[] = [];
  for (const { re, label } of PATTERNS) {
    text = text.replace(re, () => {
      hits.push(label);
      return `[REDACTED:${label}]`;
    });
  }
  return { text, hits };
}

export function redactMessage<T extends { parts?: Array<{ type: string; text?: string }> }>(
  msg: T,
): { msg: T; hits: string[] } {
  if (!msg?.parts) return { msg, hits: [] };
  const allHits: string[] = [];
  const parts = msg.parts.map((p) => {
    if (p.type === "text" && typeof p.text === "string") {
      const { text, hits } = redactString(p.text);
      allHits.push(...hits);
      return { ...p, text };
    }
    return p;
  });
  return { msg: { ...msg, parts }, hits: allHits };
}

/**
 * Ethical Hacking Lab — defensive web security scanner (server-only).
 *
 * Strictly READ-ONLY and defensive: inspects response headers and HTTP
 * status codes only. No exploit payloads, no brute-forcing, no credential
 * guessing, no downloading of sensitive file bodies (probes use HEAD and
 * only the status code is examined).
 *
 * Every URL is SSRF-guarded with the dossier module's assertUrlSafe /
 * isBlockedUrl before fetching — private/internal hosts are refused and
 * DNS failures fail closed. Redirect targets are re-checked.
 *
 * Intended for scanning websites the user owns or is authorized to test.
 * The tool description and the /security page both state this boundary.
 */
import { assertUrlSafe, isBlockedUrl } from "@/lib/dossier/dossier.server";

export type FindingSeverity = "high" | "medium" | "low" | "info";

export interface SecFinding {
  severity: FindingSeverity;
  check: string;
  detail: string;
  remediation: string;
}

export interface WebScanReport {
  url: string;
  finalUrl: string;
  score: number;
  findings: SecFinding[];
  scannedAt: string;
}

const SCAN_TIMEOUT_MS = 15_000;
const PROBE_TIMEOUT_MS = 6_000;
const USER_AGENT = "MANOVIK-SecLab/1.0 (defensive security scan)";

const SCORE_DEDUCT: Record<FindingSeverity, number> = {
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

/** 0-100 from findings. Pure — unit tested. */
export function computeScore(findings: SecFinding[]): number {
  const total = findings.reduce((sum, f) => sum + SCORE_DEDUCT[f.severity], 0);
  return Math.max(0, 100 - total);
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

function getSetCookies(headers: Headers): string[] {
  const gsc = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof gsc === "function") return gsc.call(headers);
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

/** Security-header checks. Pure — unit tested. */
export function checkSecurityHeaders(
  headers: Record<string, string>,
  isHttps: boolean,
): SecFinding[] {
  const findings: SecFinding[] = [];
  const h = (n: string) => headers[n.toLowerCase()] ?? null;

  if (!h("content-security-policy")) {
    findings.push({
      severity: "high",
      check: "Content-Security-Policy",
      detail: "No Content-Security-Policy header. The page has no XSS / injection allowlist.",
      remediation:
        "Add a Content-Security-Policy header, e.g. \"default-src 'self'\". Start in report-only mode.",
    });
  }
  if (isHttps && !h("strict-transport-security")) {
    findings.push({
      severity: "medium",
      check: "Strict-Transport-Security",
      detail: "No HSTS header over HTTPS. Browsers may still accept downgraded http connections.",
      remediation: "Add \"Strict-Transport-Security: max-age=31536000; includeSubDomains\".",
    });
  }
  const hasFrameAncestors = (h("content-security-policy") ?? "").includes("frame-ancestors");
  if (!h("x-frame-options") && !hasFrameAncestors) {
    findings.push({
      severity: "medium",
      check: "X-Frame-Options",
      detail: "No X-Frame-Options header and no frame-ancestors CSP directive. The site can be framed (clickjacking).",
      remediation: "Add \"X-Frame-Options: DENY\" (or SAMEORIGIN), or a frame-ancestors CSP directive.",
    });
  }
  if (!h("x-content-type-options")) {
    findings.push({
      severity: "low",
      check: "X-Content-Type-Options",
      detail: "Missing X-Content-Type-Options. Browsers may MIME-sniff responses.",
      remediation: "Add \"X-Content-Type-Options: nosniff\".",
    });
  }
  if (!h("referrer-policy")) {
    findings.push({
      severity: "low",
      check: "Referrer-Policy",
      detail: "No Referrer-Policy header. Full URLs may leak to third parties via the Referer header.",
      remediation: "Add \"Referrer-Policy: strict-origin-when-cross-origin\" (or stricter).",
    });
  }
  if (!h("permissions-policy")) {
    findings.push({
      severity: "low",
      check: "Permissions-Policy",
      detail: "No Permissions-Policy header. Browser features (camera, mic, geolocation) are not restricted.",
      remediation:
        "Add a Permissions-Policy header disabling unneeded features, e.g. \"camera=(), microphone=()\".",
    });
  }
  return findings;
}

/** Cookie flag checks. Pure — unit tested. */
export function checkCookieFlags(setCookies: string[]): SecFinding[] {
  const findings: SecFinding[] = [];
  if (setCookies.length === 0) {
    findings.push({
      severity: "info",
      check: "Cookies",
      detail: "The homepage sets no cookies.",
      remediation: "No action needed.",
    });
    return findings;
  }
  for (const c of setCookies) {
    const name = c.split("=")[0]?.trim() || "(unnamed)";
    const lower = c.toLowerCase();
    if (!lower.includes("secure")) {
      findings.push({
        severity: "medium",
        check: "Cookie Secure flag",
        detail: `Cookie "${name}" lacks the Secure flag and can be sent over plain http.`,
        remediation: "Set the Secure flag on all cookies.",
      });
    }
    if (!lower.includes("httponly")) {
      findings.push({
        severity: "low",
        check: "Cookie HttpOnly flag",
        detail: `Cookie "${name}" lacks HttpOnly and is readable from JavaScript (XSS session theft).`,
        remediation: "Set HttpOnly on session/auth cookies unless JS access is required.",
      });
    }
    if (!lower.includes("samesite")) {
      findings.push({
        severity: "low",
        check: "Cookie SameSite",
        detail: `Cookie "${name}" has no SameSite attribute (CSRF exposure).`,
        remediation: "Set SameSite=Lax (default-safe) or Strict for sensitive cookies.",
      });
    }
  }
  return findings;
}

/** Server/stack version disclosure. Pure — unit tested. */
export function checkServerDisclosure(headers: Record<string, string>): SecFinding[] {
  const findings: SecFinding[] = [];
  const h = (n: string) => headers[n.toLowerCase()] ?? null;
  const server = h("server");
  if (server && /\d+\.\d+/.test(server)) {
    findings.push({
      severity: "low",
      check: "Server version disclosure",
      detail: `Server header reveals a version: "${server}". Helps attackers fingerprint the stack.`,
      remediation: "Strip or genericize the Server header (e.g. server_tokens off).",
    });
  }
  const powered = h("x-powered-by");
  if (powered) {
    findings.push({
      severity: "low",
      check: "X-Powered-By disclosure",
      detail: `X-Powered-By header reveals the stack: "${powered}".`,
      remediation: "Remove the X-Powered-By header.",
    });
  }
  return findings;
}

/** CORS misconfiguration. Pure — unit tested. */
export function checkCors(headers: Record<string, string>): SecFinding[] {
  const findings: SecFinding[] = [];
  const h = (n: string) => headers[n.toLowerCase()] ?? null;
  const acao = h("access-control-allow-origin");
  const acac = (h("access-control-allow-credentials") ?? "").toLowerCase();
  if (acao === "*") {
    if (acac === "true") {
      findings.push({
        severity: "high",
        check: "CORS misconfiguration",
        detail: "Access-Control-Allow-Origin: * combined with Allow-Credentials: true — any site can make credentialed requests.",
        remediation: "Echo back a validated Origin instead of *, or drop Allow-Credentials.",
      });
    } else {
      findings.push({
        severity: "medium",
        check: "CORS wildcard",
        detail: "Access-Control-Allow-Origin: * allows any origin to read responses.",
        remediation: "Restrict to the exact origins the app needs.",
      });
    }
  }
  return findings;
}

const SENSITIVE_PROBES: Array<{
  path: string;
  label: string;
  severity: FindingSeverity;
  remediation: string;
}> = [
  {
    path: "/.git/HEAD",
    label: "Exposed .git directory",
    severity: "high",
    remediation: "Block /.git at the web server / CDN (return 403/404). Never deploy .git to production.",
  },
  {
    path: "/.env",
    label: "Exposed .env file",
    severity: "high",
    remediation: "Block dotfiles at the web server. Keep secrets out of the document root.",
  },
  {
    path: "/server-status",
    label: "Exposed server-status",
    severity: "high",
    remediation: "Restrict /server-status to localhost / admin IPs only.",
  },
];

async function fetchWithTimeout(
  url: string,
  parentSignal: AbortSignal,
  ms: number,
  init: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("Probe timeout")), ms);
  const onAbort = () => ctrl.abort();
  parentSignal.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener("abort", onAbort);
  }
}

/**
 * Run the full defensive scan. Throws on blocked hosts, DNS failure, or
 * timeouts (fail closed). Probes never download bodies — HEAD only, and only
 * the status code is examined.
 */
export async function webscanUrl(rawUrl: string, signal?: AbortSignal): Promise<WebScanReport> {
  let url = rawUrl.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `https://${url}`;
  await assertUrlSafe(url);
  const isHttpsTarget = new URL(url).protocol === "https:";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("Scan timeout (15s)")), SCAN_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  const findings: SecFinding[] = [];
  let finalUrl = url;

  try {
    if (!isHttpsTarget) {
      findings.push({
        severity: "high",
        check: "TLS",
        detail: "Site is served over plain http. Traffic (including logins) is unencrypted.",
        remediation: "Serve everything over https and redirect http → https.",
      });
    }

    // Homepage: headers, cookies, CORS, disclosure.
    const res = await fetchWithTimeout(url, ctrl.signal, PROBE_TIMEOUT_MS, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (res.url) {
      await assertUrlSafe(res.url);
      finalUrl = res.url;
    }
    // Free the body — we only need headers.
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    const headers = headersToRecord(res.headers);
    const finalIsHttps = new URL(finalUrl).protocol === "https:";

    findings.push(...checkSecurityHeaders(headers, finalIsHttps));
    findings.push(...checkCookieFlags(getSetCookies(res.headers)));
    findings.push(...checkServerDisclosure(headers));
    findings.push(...checkCors(headers));

    // Sensitive-path probes: HEAD, status code only, no redirect following.
    const origin = new URL(finalUrl).origin;
    for (const probe of SENSITIVE_PROBES) {
      const probeUrl = origin + probe.path;
      if (isBlockedUrl(probeUrl)) continue;
      let pr: Response | null = null;
      try {
        pr = await fetchWithTimeout(probeUrl, ctrl.signal, PROBE_TIMEOUT_MS, {
          method: "HEAD",
          headers: { "User-Agent": USER_AGENT },
          redirect: "manual",
        });
        if (pr.status === 200) {
          findings.push({
            severity: probe.severity,
            check: probe.label,
            detail: `${probe.path} returned HTTP 200 — it appears publicly accessible. (Catch-all routing can cause false positives.)`,
            remediation: probe.remediation,
          });
        }
      } catch {
        // Unreachable probe = not exposed. Move on.
      } finally {
        try {
          await pr?.body?.cancel();
        } catch {
          /* ignore */
        }
      }
    }

    // security.txt: presence is GOOD hygiene.
    const stUrl = origin + "/.well-known/security.txt";
    if (!isBlockedUrl(stUrl)) {
      let st: Response | null = null;
      try {
        st = await fetchWithTimeout(stUrl, ctrl.signal, PROBE_TIMEOUT_MS, {
          method: "HEAD",
          headers: { "User-Agent": USER_AGENT },
          redirect: "manual",
        });
        if (st.status === 200) {
          findings.push({
            severity: "info",
            check: "security.txt",
            detail: "/.well-known/security.txt exists — good vulnerability-disclosure practice.",
            remediation: "No action needed.",
          });
        }
      } catch {
        /* ignore */
      } finally {
        try {
          await st?.body?.cancel();
        } catch {
          /* ignore */
        }
      }
    }

    return {
      url,
      finalUrl,
      score: computeScore(findings),
      findings,
      scannedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

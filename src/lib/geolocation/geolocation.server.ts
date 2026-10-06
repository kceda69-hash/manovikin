/**
 * Server-only IP geolocation for the Location Tracker.
 *
 * Uses the ip-api.com free tier (no key required): 45 req/min per source IP.
 * Results are cached in-memory for 1 hour to stay well under the limit.
 * Never throws — callers get null on any failure.
 *
 * Privacy: only geolocate IPs the user explicitly provides (geo.ip tool) or
 * their own infrastructure. Never bulk-geolocate third parties.
 */

export interface GeoResult {
  ip: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
}

/** Strict IPv4 / IPv6 validation (no CIDR, no hostnames). */
const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

export function isValidIp(ip: string): boolean {
  const v = ip.trim();
  return IPV4_RE.test(v) || IPV6_RE.test(v);
}

/** Refuse to geolocate private/loopback ranges — meaningless and a leak risk. */
export function isPublicIp(ip: string): boolean {
  const v = ip.trim();
  if (!isValidIp(v)) return false;
  if (IPV4_RE.test(v)) {
    const [a, b] = v.split(".").map(Number);
    if (a === 10) return false;
    if (a === 172 && b! >= 16 && b! <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 0) return false;
    return true;
  }
  const low = v.toLowerCase();
  if (low === "::1") return false;
  if (low.startsWith("fc") || low.startsWith("fd")) return false;
  if (/^fe[89ab]/i.test(low)) return false;
  return true;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; result: GeoResult | null }>();

const GEO_TIMEOUT_MS = 8000;

interface IpApiResponse {
  status?: string;
  message?: string;
  country?: string;
  city?: string;
  lat?: number;
  lon?: number;
  isp?: string;
  query?: string;
}

/**
 * Geolocate a public IP. Returns null for invalid/private IPs and on any
 * fetch/parse failure. fetchFn is injectable for tests.
 */
export async function geolocateIp(
  ip: string,
  fetchFn: typeof fetch = fetch,
): Promise<GeoResult | null> {
  const clean = ip.trim();
  if (!isValidIp(clean) || !isPublicIp(clean)) return null;

  const cached = cache.get(clean);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS);
  try {
    const res = await fetchFn(
      `http://ip-api.com/json/${encodeURIComponent(clean)}?fields=status,message,country,city,lat,lon,isp,query`,
      { signal: ctrl.signal, headers: { "User-Agent": "MANOVIK-Geo/1.0" } },
    );
    if (!res.ok) {
      cache.set(clean, { at: Date.now(), result: null });
      return null;
    }
    const j = (await res.json()) as IpApiResponse;
    if (j.status !== "success" || typeof j.lat !== "number" || typeof j.lon !== "number") {
      cache.set(clean, { at: Date.now(), result: null });
      return null;
    }
    const result: GeoResult = {
      ip: j.query ?? clean,
      country: j.country ?? "Unknown",
      city: j.city ?? "Unknown",
      lat: j.lat,
      lon: j.lon,
      isp: j.isp ?? "Unknown",
    };
    cache.set(clean, { at: Date.now(), result });
    return result;
  } catch {
    cache.set(clean, { at: Date.now(), result: null });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Test hook: clear the in-memory cache. */
export function clearGeoCache(): void {
  cache.clear();
}

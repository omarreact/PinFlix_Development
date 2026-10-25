import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
export class ProviderError extends Error {
  constructor(
    public code: string,
    public status = 502,
  ) {
    super(code);
  }
}
export function allowedUrl(value: string, media = false): URL {
  const u = new URL(value);
  const host = u.hostname.toLowerCase();
  const allowed =
    (host === "cineplexbd.net" && !u.port) ||
    (media && host === "vod.cineplexbd.net" && u.port === "8081") ||
    (media &&
      host === "103.136.200.124" &&
      (u.port === "8086" || u.port === "8081")) ||
    (media &&
      (host === "commondatastorage.googleapis.com" ||
        host === "test-streams.mux.dev" ||
        host.endsWith(".cloudflarestream.com") ||
        host === "cloudflarestream.com" ||
        host.endsWith(".hakunaymatata.com") ||
        host === "hakunaymatata.com" ||
        host.endsWith(".aoneroom.com") ||
        host === "aoneroom.com" ||
        host === "movibox.net" ||
        host.endsWith(".movibox.net")));
  if (
    !allowed ||
    u.username ||
    u.password ||
    u.hash ||
    !["http:", "https:"].includes(u.protocol)
  )
    throw new ProviderError("invalid_destination", 400);
  return u;
}
export function publicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // IPv6 mapped addresses must also be checked as IPv4.
  if (ip.startsWith("::ffff:")) return publicAddress(ip.slice(7));
  return isIP(ip) === 6 && !/^(::|f[cd]|fe[89ab])/i.test(ip);
}
export function requestTimeoutMs(media = false): number {
  const configured = Number(process.env.CINEPLEX_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1000 && configured <= 30000
    ? Math.floor(configured)
    : media ? 8000 : 4500;
}
export async function safeFetch(
  value: string,
  options: RequestInit = {},
  media = false,
): Promise<Response> {
  let u = allowedUrl(value, media);
  for (let i = 0; i < 4; i++) {
    const records = await lookup(u.hostname, { all: true });
    if (!records.length || records.some((r) => !publicAddress(r.address)))
      throw new ProviderError("restricted_destination", 403);
    const res = await fetch(u, {
      ...options,
      redirect: "manual",
      signal: options.signal || AbortSignal.timeout(requestTimeoutMs(media)),
      cache: "no-store",
      headers: {
        Accept: "text/html,application/json,application/vnd.apple.mpegurl,*/*",
        ...options.headers,
      },
    });
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      const location = res.headers.get("location");
      if (!location) throw new ProviderError("invalid_redirect");
      u = allowedUrl(new URL(location, u).href, media);
      continue;
    }
    return res;
  }
  throw new ProviderError("redirect_limit");
}
export async function boundedText(
  res: Response,
  max = 1_500_000,
): Promise<string> {
  if (!res.ok) {
    await res.body?.cancel();
    throw new ProviderError(
      res.status === 403 || res.status === 401
        ? "restricted"
        : "upstream_error",
      res.status,
    );
  }
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "",
    length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) throw new ProviderError("response_too_large");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}
const cache = new Map<string, { value: unknown; at: number }>();
const pending = new Map<string, Promise<unknown>>();
export async function cached<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
): Promise<T> {
  const item = cache.get(key);
  if (item && Date.now() - item.at < ttl) return item.value as T;
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const job = load()
    .then((value) => {
      if (cache.size >= 160) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
export const html = (path: string) =>
  cached("html:" + path, 180_000, async () =>
    boundedText(await safeFetch("http://cineplexbd.net" + path)),
  );

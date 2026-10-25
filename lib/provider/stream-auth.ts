import { createHmac, timingSafeEqual } from "node:crypto";
import { allowedUrl } from "./http";

const URL_LIFETIME_MS = 6 * 60 * 60 * 1000;

export function providerPlaybackEnabled(): boolean {
  return process.env.CINEPLEX_PLAYBACK_AUTHORIZED === "true";
}

export function mediaProxyEnabled(): boolean {
  return providerPlaybackEnabled() &&
    process.env.PINFLIX_MEDIA_PROXY_ENABLED === "true" &&
    (process.env.MEDIA_PROXY_SECRET?.length || 0) >= 32;
}

function signature(
  secret: string,
  id: string,
  season: number,
  episode: number,
  url: string,
  expires: number,
): string {
  return createHmac("sha256", secret)
    .update([id, season, episode, expires, url].join("\n"))
    .digest("hex");
}

export function signedStreamUrl(
  target: string,
  id: string,
  season = 1,
  episode = 1,
  expires = Date.now() + URL_LIFETIME_MS,
): string {
  if (!mediaProxyEnabled()) throw new Error("media_proxy_disabled");
  const url = allowedUrl(target, true).href;
  const sig = signature(process.env.MEDIA_PROXY_SECRET!, id, season,
    episode, url, expires);
  return "/api/stream/?" + new URLSearchParams({
    id,
    season: String(season),
    episode: String(episode),
    url,
    exp: String(expires),
    sig,
  });
}

export function verifyStreamSignature(
  target: string,
  id: string,
  season: number,
  episode: number,
  expiresValue: string | null,
  sig: string | null,
): boolean {
  if (
    !mediaProxyEnabled() ||
    !/^(?:movie|series)-\d+$/.test(id) ||
    !expiresValue ||
    !/^\d{13}$/.test(expiresValue) ||
    !sig ||
    !/^[a-f0-9]{64}$/.test(sig)
  ) return false;
  const expires = Number(expiresValue);
  if (expires <= Date.now() ||
    expires > Date.now() + URL_LIFETIME_MS + 60_000) return false;
  let url: string;
  try {
    url = allowedUrl(target, true).href;
  } catch {
    return false;
  }
  const expected = signature(process.env.MEDIA_PROXY_SECRET!, id,
    season, episode, url, expires);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}

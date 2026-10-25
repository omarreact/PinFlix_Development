import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allowedUrl } from "./http";

const URL_LIFETIME_MS = 6 * 60 * 60 * 1000;

/**
 * Public CineplexBD catalog sources work without any mandatory configuration.
 * A separate opt-out exists for operators who want to disable playback.
 */
export function providerPlaybackEnabled(): boolean {
  return process.env.PINFLIX_PLAYBACK_DISABLED !== "true";
}

export function mediaProxyEnabled(): boolean {
  return providerPlaybackEnabled() &&
    process.env.PINFLIX_MEDIA_PROXY_DISABLED !== "true";
}

/**
 * Automatically generate a server-only key for same-origin media links.
 * The on-disk key keeps requests valid across Next.js dev worker reloads,
 * and lives under gitignored .next/cache, not in the repository.
 *
 * Multi-instance/serverless production deployments should supply a shared
 * MEDIA_PROXY_SECRET; individual ephemeral workers cannot share local files.
 */
let localMediaKey: string | undefined;
function mediaKey(): string {
  const configured = process.env.MEDIA_PROXY_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (localMediaKey) return localMediaKey;
  const dir = join(process.cwd(), ".next", "cache");
  const filename = join(dir, "pinflix-local-media-key");
  try {
    mkdirSync(dir, { recursive: true });
    try {
      writeFileSync(filename, randomBytes(32).toString("hex"), {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const existing = readFileSync(filename, "utf8").trim();
    if (!/^[a-f0-9]{64}$/.test(existing))
      throw new Error("invalid_local_media_key");
    localMediaKey = existing;
  } catch {
    // Read-only hosting can still serve requests within a single instance.
    // Multi-instance hosting must configure a shared key explicitly.
    localMediaKey = randomBytes(32).toString("hex");
  }
  return localMediaKey;
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
  const sig = signature(mediaKey(), id, season,
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
  const expected = signature(mediaKey(), id,
    season, episode, url, expires);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}

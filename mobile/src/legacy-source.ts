/**
 * Legacy PinFlix Sources v1.1 playback resolution.
 * Android-only fallback when the HTTPS PinFlix backend cannot find a source.
 * Never uses third-party catalogues or arbitrary external stream URLs.
 */
import type { Playback } from "./types";

const SITE = "http://cineplexbd.net";
const REFERER = SITE + "/";
const UA = "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36";
const STREAM_HOSTS = new Map<string, ReadonlySet<number>>([
  ["cineplexbd.net", new Set([80])],
  ["vod.cineplexbd.net", new Set([8081])],
  ["103.136.200.124", new Set([8081, 8086])],
]);

export type LegacySource = Playback & {
  transport: "direct";
  headers: Record<string, string>;
};

function port(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === "http:" ? 80 : 443;
}
function isProviderPage(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" && u.hostname.toLowerCase() === "cineplexbd.net"
      && port(u) === 80 && !u.username && !u.password;
  } catch { return false; }
}
export function allowedDirectSource(value: string): boolean {
  try {
    const u = new URL(value);
    const ports = STREAM_HOSTS.get(u.hostname.toLowerCase());
    return u.protocol === "http:" && !!ports?.has(port(u)) &&
      !u.username && !u.password && !u.hash;
  } catch { return false; }
}
function decodeSource(value: string): string {
  return value.trim()
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, '"');
}

export function directStreamFromValue(value: string): {url:string;format:"mp4"|"hls"} | null {
  let text = decodeSource(value);
  if (!text) return null;
  const dataPath = /^\/?Data\//i.test(text);
  const base = dataPath ? "http://103.136.200.124:8086/" : SITE + "/";
  if (dataPath) text = text.replace(/^\//, "");
  try {
    const url = new URL(text, base);
    if (!allowedDirectSource(url.href)) return null;
    const name = url.pathname.toLowerCase();
    const format = name.endsWith(".m3u8") ? "hls" : name.endsWith(".mp4") ? "mp4" : null;
    return format ? {url:url.href,format} : null;
  } catch { return null; }
}

export function extractLegacySource(html: string): {url:string;format:"mp4"|"hls"} | null {
  // Same priority as the successfully playing native v1.1 release:
  // <video><source src>, <video src>, then JavaScript videoSrc.
  const patterns = [
    /<video\b[^>]*>[\s\S]*?<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i,
    /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i,
    /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i,
    /\bvideoSrc\s*=\s*["']([^"'\r\n]+)["']/i,
  ];
  for (const regex of patterns) {
    const raw = html.match(regex)?.[1];
    if (!raw) continue;
    const candidate = directStreamFromValue(raw);
    if (candidate) return candidate;
  }
  return null;
}

type HttpGet = (url: string, init: RequestInit) => Promise<Pick<Response,"ok"|"status"|"text">>;
function assertNumeric(titleId:string, season:number, episode:number) {
  if (!/^(movie|series)-\d{1,12}$/.test(titleId)) throw new Error("Invalid title ID");
  if (!Number.isInteger(season)||season<1||season>999||!Number.isInteger(episode)||episode<1||episode>10000)
    throw new Error("Invalid episode number");
}
async function readPage(path:string, get:HttpGet):Promise<string> {
  const endpoint = new URL(path, SITE).href;
  if (!isProviderPage(endpoint)) throw new Error("Source endpoint was rejected");
  const abort = new AbortController();
  const timer = setTimeout(()=>abort.abort(),13500);
  try {
    const res = await get(endpoint,{
      signal:abort.signal,
      credentials:"include",
      headers:{"User-Agent":UA,"Referer":REFERER,"Accept":"text/html, application/json, */*"},
    });
    if (!res.ok) throw new Error("Source unavailable (HTTP "+res.status+")");
    const text = await res.text();
    if (text.length>1_800_000) throw new Error("Source response too large");
    return text;
  } finally { clearTimeout(timer); }
}
function stream(candidate:{url:string;format:"hls"|"mp4"}):LegacySource {
  // The headers replicate the old Java ExoPlayer request headers.
  return {status:"ready",message:"",url:candidate.url,format:candidate.format,
    transport:"direct",headers:{"Referer":REFERER,"User-Agent":UA}};
}

export async function resolveLegacyDirect(
  titleId:string, season=1, episode=1, get:HttpGet=fetch,
):Promise<LegacySource> {
  assertNumeric(titleId,season,episode);
  const [kind,id] = titleId.split("-");
  const page = kind==="series"
    ? "/watch.php?id="+id+"&season="+season+"&ep="+episode
    : "/player.php?id="+id;
  const html = await readPage(page,get);
  let source=extractLegacySource(html);
  if (!source && kind==="series") {
    // The legacy v1.1 resolver used meta=1 when the episode player lacked a
    // directly embedded HLS source. Do not trust arbitrary remote URLs.
    const raw=await readPage("/watch.php?id="+id+"&season="+season+"&meta=1",get);
    let json: {episodes?:Record<string,{path?:string}>};
    try { json=JSON.parse(raw); } catch { throw new Error("Invalid episode metadata"); }
    const path=json?.episodes?.[String(episode)]?.path;
    if (path) source=directStreamFromValue(path);
  }
  if (!source) throw new Error("No supported stream returned for this title.");
  return stream(source);
}

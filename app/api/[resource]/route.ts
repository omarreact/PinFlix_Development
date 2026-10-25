import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  catalogue,
  detail,
  resolvePlayback,
  suggestions,
  getCineplexCookies,
  type Query,
} from "@/lib/provider";
import { ProviderError, safeFetch, boundedText, allowedUrl } from "@/lib/provider/http";
import { mediaProxyEnabled, providerPlaybackEnabled, signedStreamUrl, verifyStreamSignature } from "@/lib/provider/stream-auth";
import { BASE } from "@/lib/model";
export const dynamic = "force-dynamic";
const Params = z.object({
  kind: z.enum(["movie", "series"]).optional(),
  category: z.string().max(160).optional(),
  q: z.string().max(120).optional(),
  actor: z.string().max(100).optional(),
  year: z.coerce.number().int().min(1888).max(2100).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
  language: z.string().max(30).optional(),
  quality: z.string().max(20).optional(),
  sort: z
    .enum(["recent", "title", "title-desc", "year", "year-asc"])
    .optional(),
  yearFrom: z.coerce.number().int().min(1888).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1888).max(2100).optional(),
  genre: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  letter: z
    .string()
    .regex(/^[A-Z#]$/)
    .optional(),
  status: z.enum(["ongoing", "completed"]).optional(),
  universe: z.enum(["marvel", "dc"]).optional(),
  directory: z
    .enum(["true"])
    .transform(() => true)
    .optional(),
  id: z
    .string()
    .regex(/^(movie|series)-\d+$/)
    .optional(),
  season: z.coerce.number().int().min(1).max(999).default(1),
  episode: z.coerce.number().int().min(1).max(10000).default(1),
  url: z.string().optional(),
});
const limits = new Map<string, { count: number; until: number }>();
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const client = (req.headers.get("x-forwarded-for") || "shared")
    .split(",")[0]
    .trim()
    .slice(0, 80);
  const now = Date.now();
  const limit = limits.get(client);
  if (limit && limit.until > now && limit.count >= 100)
    return NextResponse.json(
      { error: "Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  if (limits.size > 1000) limits.clear();
  limits.set(client, {
    count: limit && limit.until > now ? limit.count + 1 : 1,
    until: limit && limit.until > now ? limit.until : now + 60000,
  });
  const p = Params.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { resource } = await params;
  try {
    let result;
    const { id, season, episode, ...query } = p.data;
    if (resource === "catalogue") result = await catalogue(query as Query);
    else if (resource === "suggest")
      result = { items: await suggestions(query.q || "") };
    else if (resource === "detail" && id) result = await detail(id, season);
    else if (resource === "playback" && id)
      result = await resolvePlayback(id, season, episode);
    else if (resource === "download" && id) {
      if (
        process.env.PINFLIX_DOWNLOADS_AUTHORIZED !== "true" ||
        !providerPlaybackEnabled() || !mediaProxyEnabled()
      )
        return NextResponse.json(
          { error: "Downloads are unavailable for this title." },
          { status: 403 },
        );
      const pb = await resolvePlayback(id, season, episode).catch(() => null);
      if (
        !pb ||
        pb.status !== "ready" ||
        !pb.url ||
        !pb.download ||
        pb.format !== "mp4"
      ) {
        const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Download Unavailable · PinFlix</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0d14; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #131722; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 36px 28px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .icon { width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 50%; background: rgba(234, 88, 12, 0.15); display: flex; align-items: center; justify-content: center; color: #f97316; font-size: 24px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 10px; color: #fff; }
    p { color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
    .btn { display: inline-block; background: #ea580c; color: #fff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background 0.2s; }
    .btn:hover { background: #f97316; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">!</div>
    <h1>Download Unavailable</h1>
    <p>A direct download stream is not available for this title right now. Please return to the title page or try again later.</p>
    <a href="javascript:history.back()" class="btn">Go Back</a>
  </div>
</body>
</html>`;
        return new NextResponse(errorHtml, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const d = await detail(id, season).catch(() => null);
      const titleName = d?.title?.title || "PinFlix_Media";
      const filename = id.startsWith("series-")
        ? `${titleName}_S${season}E${episode}`
        : `${titleName}`;
      const ext = pb.url.includes(".mkv") ? "mkv" : "mp4";
      const safeFilename = encodeURIComponent(
        `${filename}.${ext}`.replace(/[/\\?%*:|"<> ]/g, "_"),
      );

      let mediaTarget = pb.url;
      if (mediaTarget.includes("url=")) {
        try {
          const parsedTarget = new URL(
            mediaTarget,
            "http://localhost:3005",
          ).searchParams.get("url");
          if (parsedTarget) mediaTarget = parsedTarget;
        } catch {
          /* Keep original */
        }
      }

      if (pb.format === "mp4") {
        try {
          const cookies = await getCineplexCookies(id, season, episode);
          const reqHeaders: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            Referer: "http://cineplexbd.net/",
          };
          if (cookies) reqHeaders["Cookie"] = cookies;
          const range = req.headers.get("range") || "bytes=0-";
          reqHeaders["Range"] = range;

          const upstream = await safeFetch(
            mediaTarget,
            { headers: reqHeaders },
            true,
          );
          const headers = new Headers();
          headers.set(
            "Content-Disposition",
            `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
          );
          let dlType = upstream.headers.get("content-type") || "";
          if (
            mediaTarget.includes(".mkv") &&
            (!dlType || dlType.includes("octet-stream"))
          ) {
            dlType = "video/x-matroska";
          } else if (
            mediaTarget.includes(".mp4") &&
            (!dlType || dlType.includes("octet-stream"))
          ) {
            dlType = "video/mp4";
          }
          if (dlType) headers.set("Content-Type", dlType);
          if (upstream.headers.has("content-length"))
            headers.set(
              "Content-Length",
              upstream.headers.get("content-length")!,
            );
          if (upstream.headers.has("accept-ranges"))
            headers.set(
              "Accept-Ranges",
              upstream.headers.get("accept-ranges")!,
            );
          if (upstream.headers.has("content-range"))
            headers.set(
              "Content-Range",
              upstream.headers.get("content-range")!,
            );
          return new NextResponse(upstream.body, {
            status: upstream.status,
            headers,
          });
        } catch {
          return NextResponse.redirect(pb.url);
        }
      }
      return NextResponse.redirect(pb.url);
    } else if (resource === "stream") {
      if (!mediaProxyEnabled())
        return NextResponse.json(
          { error: "Playback proxy is disabled." },
          { status: 403 },
        );
      const targetUrl = p.data.url;
      if (!id || !targetUrl ||
        !verifyStreamSignature(
          targetUrl, id, season, episode,
          req.nextUrl.searchParams.get("exp"),
          req.nextUrl.searchParams.get("sig"),
        ))
        return NextResponse.json(
          { error: "Invalid or expired playback request." },
          { status: 403 },
        );
      allowedUrl(targetUrl, true);
      const cookies = await getCineplexCookies(id, season, episode);
      const reqHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Referer: "http://cineplexbd.net/",
      };
      if (cookies) reqHeaders["Cookie"] = cookies;
      const range = req.headers.get("range");
      if (range) reqHeaders["Range"] = range;

      const upstream = await safeFetch(
        targetUrl,
        { headers: reqHeaders },
        true,
      );
      const contentType = upstream.headers.get("content-type") || "";
      const isM3u8 =
        targetUrl.includes(".m3u8") ||
        contentType.includes("mpegurl") ||
        contentType.includes("application/x-mpegURL");

      if (isM3u8) {
        if (!upstream.ok)
          return NextResponse.json(
            { error: "Media source unavailable." },
            { status: 502 },
          );
        const playlist = await boundedText(upstream, 1_000_000);
        const signedChild = (value: string) =>
          signedStreamUrl(new URL(value, targetUrl).href, id, season, episode);
        const rewritten = playlist
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith("#"))
              return line.replace(/URI="([^"]+)"/g, (_, uri: string) =>
                `URI="${signedChild(uri)}"`,
              );
            return signedChild(trimmed);
          })
          .join("\n");
        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache",
          },
        });
      }

      if (!upstream.ok)
        return NextResponse.json({ error: "Media source unavailable." }, { status: 502 });
      const resHeaders = new Headers();
      let streamType = upstream.headers.get("content-type") || "";
      if (
        targetUrl.includes(".mkv") &&
        (!streamType || streamType.includes("octet-stream"))
      ) {
        streamType = "video/x-matroska";
      } else if (
        targetUrl.includes(".mp4") &&
        (!streamType || streamType.includes("octet-stream"))
      ) {
        streamType = "video/mp4";
      }
      if (streamType) resHeaders.set("Content-Type", streamType);
      if (upstream.headers.has("content-length"))
        resHeaders.set(
          "Content-Length",
          upstream.headers.get("content-length")!,
        );
      if (upstream.headers.has("accept-ranges"))
        resHeaders.set("Accept-Ranges", upstream.headers.get("accept-ranges")!);
      if (upstream.headers.has("content-range"))
        resHeaders.set("Content-Range", upstream.headers.get("content-range")!);

      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
      });
    } else return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control":
          resource === "playback" ? "no-store" : "private, max-age=15",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ProviderError && e.code === "mature_disabled"
            ? "This title is restricted."
            : "This collection is temporarily unavailable.",
      },
      { status: e instanceof ProviderError && e.status < 500 ? e.status : 503 },
    );
  }
}

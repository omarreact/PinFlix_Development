import * as cheerio from "cheerio";
import { z } from "zod";
import {
  BASE,
  type Title,
  type Catalogue,
  type Detail,
  type Playback,
} from "../model";
import { TitleSchema } from "../model";
import {
  categoriesFromHtml,
  titlesFromHtml,
  yearsFromHtml,
  searchFromJson,
  detailFromHtml,
  sourceFromHtml,
  seriesMoreFromJson,
  imageUrl,
  dedupe,
  isMature,
  ORIGIN,
} from "./normalize";
import {
  html,
  cached,
  safeFetch,
  boundedText,
  allowedUrl,
  ProviderError,
} from "./http";
import snapshot from "../../data/catalogue.json";
import { titleMatch } from "../search";
import { filterTitles, titleLetter } from "../directory";
import { mediaProxyEnabled, providerPlaybackEnabled, signedStreamUrl } from "./stream-auth";
const detailSeeds = new Map(
  snapshot.details.map((d) => [d.title.id, TitleSchema.parse(d.title)]),
);
const seed = TitleSchema.array()
  .parse(snapshot.items)
  .map((t) => detailSeeds.get(t.id) || t);
const seedCategories = z
  .array(
    z.object({
      name: z.string(),
      kind: z.enum(["movie", "series"]),
      mature: z.boolean(),
    }),
  )
  .parse(snapshot.categories);
const index = new Map(seed.map((t) => [t.id, t]));
const permitted = (t: Title) =>
  !t.mature || process.env.PINFLIX_MATURE_ENABLED === "true";
export type Query = {
  kind?: "movie" | "series";
  category?: string;
  q?: string;
  year?: number;
  language?: string;
  quality?: string;
  sort?: string;
  page?: number;
  actor?: string;
  yearFrom?: number;
  yearTo?: number;
  genre?: string;
  country?: string;
  letter?: string;
  status?: string;
  universe?: string;
  directory?: boolean;
};
export function applyFilters(items: Title[], q: Query): Title[] {
  const out = items.filter(
    (t) =>
      permitted(t) &&
      (!q.q?.trim() || matches(t, q.q.trim())) &&
      (!q.kind || t.kind === q.kind) &&
      (!q.category || t.category === q.category) &&
      (!q.year || t.year === q.year) &&
      (!q.language || t.language === q.language) &&
      (!q.quality || t.quality?.toLowerCase() === q.quality.toLowerCase()),
  );
  return filterTitles(out, { ...q, q: undefined });
}
function matches(t: Title, q: string): boolean {
  return (
    titleMatch(t.title, q) ||
    t.aliases.some((a) => titleMatch(a, q)) ||
    [t.year, t.category, t.language, ...t.cast]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase())
  );
}
export async function catalogue(q: Query = {}): Promise<Catalogue> {
  q = {
    ...q,
    q: q.q?.trim() || undefined,
    actor: q.actor?.trim() || undefined,
  };
  const page = Math.max(1, Math.min(q.page || 1, 10000));
  const meta = await cached("categories", 900_000, async () => {
    try {
      if (process.env.PINFLIX_OFFLINE_CATALOGUE === "true")
        throw new Error("offline");
      const h = await html("/");
      return { categories: categoriesFromHtml(h), years: yearsFromHtml(h) };
    } catch {
      return { categories: seedCategories, years: snapshot.years };
    }
  });
  let items: Title[] = [];
  let stale = false;
  let hasNext = false;
  const params = new URLSearchParams({ page: String(page) });
  if (q.year) params.set("year[]", String(q.year));
  if (q.category) params.set("category", q.category);
  if (
    q.category &&
    !meta.categories.some(
      (c) => c.name === q.category && (!q.kind || c.kind === q.kind),
    )
  )
    throw new ProviderError("unknown_category", 400);
  if (
    q.category &&
    isMature(q.category) &&
    process.env.PINFLIX_MATURE_ENABLED !== "true"
  )
    return {
      items: [],
      ...meta,
      hasNext: false,
      page,
      stale: false,
      retrievedAt: new Date().toISOString(),
    };
  try {
    if (process.env.PINFLIX_OFFLINE_CATALOGUE === "true")
      throw new Error("offline");
    if (q.q || q.actor) {
      params.set(q.actor ? "actors" : "q", q.actor || q.q!);
      const h = await html("/search.php?" + params);
      items = titlesFromHtml(h);
      hasNext = nextPage(h, page);
      if (!items.length && q.q && !q.actor) {
        const json = await boundedText(
          await safeFetch(
            ORIGIN +
              "/search_ajax.php?" +
              new URLSearchParams({ q: q.q, limit: "40" }),
          ),
        );
        items = searchFromJson(JSON.parse(json));
      }
    } else if (q.category) {
      const h = await html(
        `/${q.kind === "series" ? "tcategory" : "category"}.php?` + params,
      );
      items = titlesFromHtml(h, q.kind);
      hasNext = nextPage(h, page);
    } else if (q.kind === "series") {
      if (page === 1) {
        const h = await html("/tvs.php");
        items = titlesFromHtml(h, "series");
        hasNext = items.length >= 24;
      } else {
        const response = await cached("series-more:" + page, 180_000, () =>
          boundedTextSafe(
            "/tvs_more.php?" +
              new URLSearchParams({
                offset: String((page - 1) * 24),
                limit: "24",
              }),
          ),
        );
        items = seriesMoreFromJson(JSON.parse(response));
        hasNext = items.length === 24;
      }
    } else {
      const h = await html(
        page === 1 && !q.year ? "/" : "/category.php?" + params,
      );
      items = titlesFromHtml(h, q.kind);
      hasNext = page === 1 && !q.year ? true : nextPage(h, page);
    }
    if (q.q && !items.length)
      items = [...index.values()].filter((t) => matches(t, q.q!));
    items.forEach((t) => {
      index.set(t.id, t);
    });
    if (index.size > 2500) {
      for (const key of [...index.keys()].slice(0, index.size - 2500))
        index.delete(key);
    }
  } catch {
    stale = true;
    items = [...index.values()].filter(
      (t) =>
        !q.actor ||
        t.cast.some((name) =>
          name.toLowerCase().includes(q.actor!.toLowerCase()),
        ),
    );
  }
  const base = q.directory || stale ? [...index.values()] : items;
  const filtered = applyFilters(dedupe(base), q);
  const paginated = q.directory || stale;
  const pageSize = 36;
  const facetsBase = [...index.values()].filter(
    (t) => permitted(t) && (!q.kind || t.kind === q.kind),
  );
  const unique = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort();
  return {
    items: paginated
      ? filtered.slice((page - 1) * pageSize, page * pageSize)
      : filtered,
    ...meta,
    hasNext: paginated ? page * pageSize < filtered.length : hasNext,
    total: paginated ? filtered.length : undefined,
    letters: [
      ...new Set(
        applyFilters(dedupe(base), { ...q, letter: undefined }).map((t) =>
          titleLetter(t.title),
        ),
      ),
    ],
    facets: {
      genres: unique(facetsBase.flatMap((t) => t.genres)),
      languages: unique(facetsBase.map((t) => t.language)),
      qualities: unique(facetsBase.map((t) => t.quality)),
      countries: unique(facetsBase.map((t) => t.country)),
    },
    page,
    stale,
    retrievedAt: stale ? snapshot.retrievedAt : new Date().toISOString(),
  };
}
function nextPage(h: string, page: number): boolean {
  const $ = cheerio.load(h);
  return $("a[href]")
    .toArray()
    .some((el) => {
      try {
        return (
          Number(
            new URL($(el).attr("href")!, ORIGIN).searchParams.get("page"),
          ) ===
          page + 1
        );
      } catch {
        return false;
      }
    });
}
export async function suggestions(q: string): Promise<Title[]> {
  if (q.length < 2) return [];
  try {
    if (process.env.PINFLIX_OFFLINE_CATALOGUE === "true")
      throw new Error("offline");
    const text = await cached("suggest:" + q, 60_000, () =>
      boundedTextSafe(
        "/search_ajax.php?" + new URLSearchParams({ q, limit: "12" }),
      ),
    );
    const items = searchFromJson(JSON.parse(text));
    items.forEach((t) => index.set(t.id, t));
    return (
      items.length
        ? items
        : [...index.values()].filter((t) => matches(t, q)).slice(0, 12)
    ).filter(permitted);
  } catch {
    return [...index.values()]
      .filter((t) => permitted(t) && matches(t, q))
      .slice(0, 12);
  }
}
async function boundedTextSafe(path: string) {
  return boundedText(await safeFetch(ORIGIN + path));
}
const MetaSchema = z.object({
  rating: z.string().optional(),
  synopsis: z.string().optional(),
  cast: z.array(z.object({ name: z.string() })).optional(),
  episodes: z
    .record(
      z.string(),
      z.object({
        episode_number: z.number(),
        title: z.string(),
        still: z.string().nullable().optional(),
        path: z.string().optional(),
      }),
    )
    .optional(),
});
export async function detail(id: string, season = 1): Promise<Detail> {
  if (!/^(movie|series)-\d+$/.test(id))
    throw new ProviderError("invalid_id", 400);
  return cached(`detail:${id}:${season}`, 180_000, async () => {
    const [kind, pid] = id.split("-");
    const p =
      `/${kind === "series" ? "watch" : "view"}.php?` +
      new URLSearchParams({ id: pid, season: String(season) });
    let d;
    try {
      if (process.env.PINFLIX_OFFLINE_CATALOGUE === "true")
        throw new Error("offline");
      d = detailFromHtml(await html(p), id, season);
    } catch (e) {
      const fallback = snapshot.details.find(
        (x) => x.title.id === id && x.season === season,
      );
      const known = index.get(id);
      if (!fallback && !known) throw e;
      d = fallback
        ? { ...fallback, title: TitleSchema.parse(fallback.title) }
        : { title: known!, episodes: [], season };
    }
    const known = index.get(id);
    if (known)
      d.title = {
        ...d.title,
        category: known.category || d.title.category,
        language: known.language || d.title.language,
        quality: known.quality || d.title.quality,
        rating: known.rating || d.title.rating,
        mature: known.mature || d.title.mature,
      };
    if (kind === "series" && process.env.PINFLIX_OFFLINE_CATALOGUE !== "true")
      try {
        const meta = MetaSchema.parse(
          JSON.parse(await boundedTextSafe(p + "&meta=1")),
        );
        d.title.synopsis = meta.synopsis || d.title.synopsis;
        d.title.rating = meta.rating || d.title.rating;
        d.title.cast = meta.cast?.map((c) => c.name) || d.title.cast;
        if (d.episodes.length > 0) {
          d.episodes = d.episodes.map((e) => ({
            ...e,
            title: meta.episodes?.[String(e.number)]?.title || e.title,
            thumbnail:
              imageUrl(meta.episodes?.[String(e.number)]?.still) || e.thumbnail,
          }));
        } else if (meta.episodes) {
          d.episodes = Object.entries(meta.episodes)
            .map(([k, ep]) => {
              const epNum = Number(ep.episode_number || k);
              const epTitle = ep.title || `Episode ${epNum}`;
              return {
                number: epNum,
                season,
                title: epTitle,
                thumbnail: imageUrl(ep.still) || d.title.poster,
                quality: epTitle.match(/\b(\d{3,4}P|4K)\b/i)?.[0] || null,
              };
            })
            .filter((e) => e.number > 0)
            .sort((a, b) => a.number - b.number);
          if (
            d.title.seasons.length === 0 ||
            !d.title.seasons.includes(season)
          ) {
            d.title.seasons = Array.from(
              new Set([...d.title.seasons, season]),
            ).sort((a, b) => a - b);
          }
        }
      } catch {
        /* HTML metadata is sufficient. */
      }
    if (!permitted(d.title)) throw new ProviderError("mature_disabled", 403);
    index.set(id, d.title);
    return {
      ...d,
      related: [...index.values()]
        .filter((t) => t.id !== id && t.kind === kind && permitted(t))
        .slice(0, 12),
    };
  });
}
export async function resolvePlayback(
  id: string,
  season = 1,
  episode = 1,
): Promise<Playback> {
  const checkedAt = new Date().toISOString();
  if (!providerPlaybackEnabled())
    return {
      status: "authorization_required",
      message: "Playback is not available for this title yet.",
      checkedAt,
    };
  const d = await detail(id, season);
  if (d.title.mature && process.env.PINFLIX_MATURE_ENABLED !== "true")
    return {
      status: "restricted",
      message: "This title is restricted.",
      checkedAt,
    };
  if (
    d.title.kind === "series" &&
    !d.episodes.some((e) => e.number === episode)
  )
    return {
      status: "unavailable",
      message: "This episode is not available.",
      checkedAt,
    };

  if (!mediaProxyEnabled())
    return {
      status: "unavailable",
      message: "Secure media playback is not configured.",
      checkedAt,
    };

  const path =
    d.title.kind === "movie"
      ? "/player.php?" + new URLSearchParams({ id: d.title.providerId })
      : "/watch.php?" +
        new URLSearchParams({
          id: d.title.providerId,
          season: String(season),
          ep: String(episode),
        });
  try {
    let source: {
      url: string;
      format: "mp4" | "hls";
      subtitles: { url: string; label: string; language: string }[];
    } | null = null;

    if (d.title.kind === "series") {
      // 1. Fetch watch.php directly to capture session cookies and extract real HLS master playlist
      const watchRes = await safeFetch(ORIGIN + path, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      }).catch(() => null);

      if (watchRes && watchRes.ok) {
        const setCookies = watchRes.headers.getSetCookie
          ? watchRes.headers.getSetCookie()
          : [watchRes.headers.get("set-cookie")];
        const cookieStr = (setCookies || [])
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.split(";")[0])
          .join("; ");
        if (cookieStr) {
          cookieCache.set(`${id}:${season}:${episode}`, {
            cookies: cookieStr,
            expires: Date.now() + 10 * 60 * 1000,
          });
        }
        const htmlText = await boundedText(watchRes);
        const parsed = sourceFromHtml(htmlText);
        if (parsed) {
          allowedUrl(parsed.url, true);
          source = {
            url: signedStreamUrl(parsed.url, id, season, episode),
            format: parsed.format,
            subtitles: parsed.subtitles || [],
          };
        }
      }

      // 2. Fallback to meta=1 endpoint if HTML source tag was not extracted
      if (!source) {
        try {
          const metaRaw = await boundedTextSafe(path + "&meta=1");
          const meta = MetaSchema.parse(JSON.parse(metaRaw));
          const epData = meta.episodes?.[String(episode)];
          if (epData?.path) {
            const candidate = new URL(epData.path, ORIGIN).href;
            allowedUrl(candidate, true);
            const isHls = /\.m3u8(?:\?|$)/i.test(candidate);
            if (!isHls && !/\.mp4(?:\?|$)/i.test(candidate))
              throw new Error("unsupported_media_format");
            source = {
              url: signedStreamUrl(candidate, id, season, episode),
              format: isHls ? "hls" : "mp4",
              subtitles: [],
            };
          }
        } catch {
          /* Meta fallback failed */
        }
      }
    } else {
      const playerHtml = await boundedTextSafe(path).catch(() => "");
      const parsed = sourceFromHtml(playerHtml);
      if (parsed) {
        try {
          allowedUrl(parsed.url, true);
          const check = await safeFetch(
            parsed.url,
            {
              method: "HEAD",
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                Referer: "http://cineplexbd.net/",
              },
            },
            true,
          ).catch(() => null);
          const ct = check?.headers.get("content-type") || "";
          if (check?.ok && !ct.includes("text/html")) {
            source = {
              ...parsed,
              url: signedStreamUrl(parsed.url, id, season, episode),
            };
          }
        } catch {
          /* Primary stream validation failed */
        }
      }
    }

    if (!source)
      return {
        status: "unavailable",
        message: "No verified playable source was found for this title.",
        checkedAt,
      };

    // Deliver only permitted subtitle tracks through the same signed HTTPS
    // endpoint; HTTP subtitle URLs are blocked by modern HTTPS browsers.
    source.subtitles = (source.subtitles || []).flatMap((t) => {
      try {
        allowedUrl(t.url, true);
        return [{
          ...t,
          url: signedStreamUrl(t.url, id, season, episode),
        }];
      } catch {
        return [];
      }
    });

    return {
      status: "ready",
      message: "",
      ...source,
      checkedAt,
      ...(process.env.PINFLIX_DOWNLOADS_AUTHORIZED === "true" &&
      source.format === "mp4"
        ? {
            download: {
              url: `${BASE}/api/download/?id=${id}&season=${season}&episode=${episode}`,
              quality: d.title.quality || "1080p",
            },
          }
        : {}),
    };
  } catch {
    return {
      status: "unavailable",
      message: "This title is currently unavailable from the provider.",
      checkedAt,
    };
  }
}

const cookieCache = new Map<string, { cookies: string; expires: number }>();
export async function getCineplexCookies(
  id?: string,
  season = 1,
  episode = 1,
): Promise<string> {
  const key = id ? `${id}:${season}:${episode}` : "default";
  const cached = cookieCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.cookies;
  const pid = id ? id.replace(/^(series|movie)-/, "") : "10527";
  const p = `/watch.php?id=${pid}&season=${season}&ep=${episode}`;
  try {
    const res = await safeFetch(ORIGIN + p, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    const setCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")];
    const cookieStr = (setCookies || [])
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.split(";")[0])
      .join("; ");
    cookieCache.set(key, {
      cookies: cookieStr,
      expires: Date.now() + 10 * 60 * 1000,
    });
    return cookieStr;
  } catch {
    return "";
  }
}

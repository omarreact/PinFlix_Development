import * as cheerio from "cheerio";
import { z } from "zod";
import { TitleSchema, type Title, type Category, type Episode } from "../model";
export const ORIGIN = "http://cineplexbd.net";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export const isMature = (s: string) =>
  /(?:adult|xxx|porn|18\+|mature|erotic)/i.test(s);
export function imageUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value, ORIGIN);
    if (u.username || u.password || !["http:", "https:"].includes(u.protocol))
      return null;
    if (
      u.hostname === "cineplexbd.net" &&
      !u.port &&
      /^\/uploads\/[^?#]+\.(?:jpg|jpeg|webp|png)$/i.test(u.pathname)
    )
      return u.href;
    return null;
  } catch {
    return null;
  }
}
export function language(category: string): string | null {
  return (
    [
      "Bangla",
      "Hindi",
      "English",
      "Tamil",
      "Telugu",
      "Malayalam",
      "Kannada",
      "Korean",
      "Japanese",
      "Chinese",
      "Punjabi",
      "Indonesian",
      "Turkey",
      "French",
      "Spanish",
    ].find((l) => category.toLowerCase().includes(l.toLowerCase())) || null
  );
}
export function dedupe(items: Title[]): Title[] {
  return [...new Map(items.map((x) => [x.id, x])).values()];
}
export function categoriesFromHtml(html: string): Category[] {
  const $ = cheerio.load(html);
  const found = new Map<string, Category>();
  $("a[href]").each((_, el) => {
    try {
      const u = new URL($(el).attr("href")!, ORIGIN);
      const name = u.searchParams.get("category");
      if (u.hostname !== "cineplexbd.net" || !name || name.length > 160) return;
      const kind =
        u.pathname === "/category.php"
          ? "movie"
          : u.pathname === "/tcategory.php"
            ? "series"
            : null;
      if (kind) found.set(kind + name, { name, kind, mature: isMature(name) });
    } catch {}
  });
  return [...found.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
  );
}
export function yearsFromHtml(html: string): number[] {
  const $ = cheerio.load(html);
  return [
    ...new Set(
      $('input[name="year[]"]')
        .toArray()
        .map((el) => Number($(el).attr("value")))
        .filter((n) => n >= 1888 && n <= new Date().getFullYear() + 2),
    ),
  ].sort((a, b) => b - a);
}
export function titlesFromHtml(
  html: string,
  only?: "movie" | "series",
): Title[] {
  const $ = cheerio.load(html);
  const items: Title[] = [];
  $("a[href]").each((_, el) => {
    const a = $(el);
    let u: URL;
    try {
      u = new URL(a.attr("href")!, ORIGIN);
    } catch {
      return;
    }
    if (u.hostname !== "cineplexbd.net") return;
    const kind = /^\/(view|player)\.php$/.test(u.pathname)
      ? "movie"
      : /^\/(watch|tview)\.php$/.test(u.pathname)
        ? "series"
        : null;
    const id = u.searchParams.get("id") || u.searchParams.get("series_id");
    if (!kind || (only && only !== kind) || !id || !/^\d+$/.test(id)) return;
    const img = a
      .find("img")
      .filter((_, im) => $(im).attr("alt") !== "IMDb")
      .first();
    if (!img.length) return;
    const name = clean(img.attr("alt") || "");
    if (!name || name === "Poster" || /^E\d+$/.test(name)) return;
    const text = clean(
      a
        .find("*")
        .addBack()
        .contents()
        .filter((_, node) => node.type === "text")
        .map((_, node) => $(node).text())
        .get()
        .join(" "),
    );
    const category =
      clean(a.find(".catLabel,.meta-cat").first().text()) ||
      clean(a.find("p").last().text().split("•")[0] || "");
    const result = TitleSchema.safeParse({
      id: `${kind}-${id}`,
      providerId: id,
      kind,
      title: name,
      poster: imageUrl(img.attr("src")),
      year:
        Number([...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].at(-1)?.[0]) ||
        null,
      category,
      language: language(category),
      quality:
        text.match(/\b(4K|2160[Pp]|1080[Pp]|720[Pp]|480[Pp]|360[Pp])\b/)?.[0] ||
        null,
      rating:
        clean(a.find('img[alt="IMDb"]').parent().find("span").text()) || null,
      mature: isMature(category),
      addedLabel:
        text.match(
          /\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago/,
        )?.[0] || null,
    });
    if (result.success) items.push(result.data);
  });
  return dedupe(items);
}
const SearchSchema = z.object({
  results: z.array(
    z.object({
      id: z.union([z.number().int(), z.string().regex(/^\d+$/)]),
      title: z.string(),
      category: z.string().optional(),
      poster: z.string().nullable().optional(),
      year: z.union([z.string(), z.number()]).nullable().optional(),
      resolution: z.string().nullable().optional(),
      type: z.enum(["movie", "series"]),
      url: z.string().optional(),
    }),
  ),
});
export function searchFromJson(json: unknown): Title[] {
  return dedupe(
    SearchSchema.parse(Array.isArray(json) ? { results: json } : json).results.flatMap((x) => {
      // Bare upstream poster filenames are not necessarily CineplexBD uploads.
      // Keep them unavailable rather than invent a third-party image origin.
      const poster = x.poster && x.poster.includes("/") ? x.poster : null;
      const t = TitleSchema.safeParse({
        id: `${x.type}-${x.id}`,
        providerId: String(x.id),
        kind: x.type,
        title: x.title,
        poster: imageUrl(poster),
        year: Number(x.year) || null,
        category: x.category || "",
        language: language(x.category || ""),
        quality: x.resolution || null,
        mature: isMature(x.category || ""),
      });
      return t.success ? [t.data] : [];
    }),
  );
}
const SeriesMoreSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    title: z.string(),
    year: z.string().nullable().optional(),
    poster: z.string().nullable().optional(),
    imdb_rating: z.string().nullable().optional(),
    category: z.string().optional(),
  }),
);
export function seriesMoreFromJson(json: unknown): Title[] {
  return dedupe(
    SeriesMoreSchema.parse(json).map((x) =>
      TitleSchema.parse({
        id: `series-${x.id}`,
        providerId: String(x.id),
        kind: "series",
        title: x.title,
        poster: imageUrl(x.poster),
        year: Number(x.year) || null,
        category: x.category || "",
        language: language(x.category || ""),
        rating: x.imdb_rating || null,
        mature: isMature(x.category || ""),
      }),
    ),
  );
}
export function detailFromHtml(
  html: string,
  id: string,
  season = 1,
): { title: Title; episodes: Episode[]; season: number } {
  const $ = cheerio.load(html);
  const [kind, providerId] = id.split("-");
  const h = $("h1").first().clone();
  h.find("span").remove();
  const title = clean(h.text());
  if (!title) throw new Error("Provider detail structure unavailable");
  const chips = $(".hero-content .chip")
    .toArray()
    .map((el) => clean($(el).text()));
  const category =
    kind === "series" ? clean($(".meta-cat").first().text()) : "";
  const year =
    Number(
      (kind === "series" ? $("h1 span").first().text() : chips[0] || "").match(
        /\b(19\d{2}|20\d{2})\b/,
      )?.[0],
    ) || null;
  const poster = imageUrl(
    kind === "series"
      ? $("video").attr("poster")
      : $(".poster").first().attr("src"),
  );
  const synopsis =
    kind === "series"
      ? clean($("#synopsis").text())
      : clean(
          $("h3")
            .filter((_, el) => clean($(el).text()) === "Overview")
            .next("p")
            .text(),
        );
  const seasons = [...new Set(
    $("select option")
      .toArray()
      .filter((el) => /season\s*\d+/i.test($(el).text()) ||
        $(el).parent("select").attr("name") === "season")
      .map((el) => Number($(el).attr("value")))
      .filter((n) => n > 0 && n < 1000),
  )];
  const episodeCards = $(".ep-card").length
    ? $(".ep-card").toArray()
    : $('a[href*="watch.php"]').toArray().filter((el) => {
        try {
          const u = new URL($(el).attr("href")!, ORIGIN);
          return u.hostname === "cineplexbd.net" &&
            (u.searchParams.get("id") || u.searchParams.get("series_id")) === providerId &&
            Number(u.searchParams.get("season") || season) === season &&
            /^\d+$/.test(u.searchParams.get("ep") || "");
        } catch {
          return false;
        }
      });
  const episodes: Episode[] = episodeCards
    .map((el) => {
      const a = $(el);
      const number = Number(
        a.attr("data-ep") ||
        new URL(a.attr("href") || "/", ORIGIN).searchParams.get("ep"),
      );
      const name =
        clean(a.find("span.truncate").first().text()) ||
        clean(a.text()).replace(/^E\d+\s*/i, "") ||
        `Episode ${number}`;
      return {
        number,
        season,
        title: name,
        thumbnail: imageUrl(a.find("img").attr("src")),
        quality: name.match(/\b(\d{3,4}P|4K)\b/i)?.[0] || null,
      };
    })
    .filter((e) => e.number > 0);
  return {
    title: TitleSchema.parse({
      id,
      providerId,
      kind,
      title,
      poster,
      backdrop: poster,
      year,
      category,
      language: language(category),
      synopsis,
      seasons,
      genres:
        kind === "series"
          ? $(".meta-genres")
              .toArray()
              .map((el) => clean($(el).text()))
          : chips[1]?.split(",").map(clean) || [],
      runtime: chips.find((x) => /\dh.*\dm|\d+\s*min/.test(x)) || null,
      cast: $('a[href*="cast.php"]')
        .toArray()
        .map(
          (el) =>
            new URL($(el).attr("href")!, ORIGIN).searchParams.get("name") || "",
        )
        .filter(Boolean),
      mature: isMature(category),
    }),
    episodes,
    season,
  };
}
export function sourceFromHtml(html: string): {
  url: string;
  format: "mp4" | "hls";
  subtitles: { url: string; label: string; language: string }[];
} | null {
  const $ = cheerio.load(html);
  const scriptMatch = html.match(
    /(?:const|let|var)?\s*videoSrc\s*=\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1/,
  );
  const raw =
    $("video source").first().attr("src") ||
    $("source").first().attr("src") ||
    $("video").attr("src") ||
    (scriptMatch ? scriptMatch[2] : null);
  if (!raw) return null;
  let value = raw;
  if (value.startsWith('"')) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  let baseOrigin = ORIGIN;
  if (/^\/?Data\//i.test(value)) {
    baseOrigin = "http://103.136.200.124:8086";
  }
  const url = new URL(value, baseOrigin).href;
  const format = /\.m3u8(?:\?|$)/i.test(url)
    ? "hls"
    : /\.mp4(?:\?|$)/i.test(url)
      ? "mp4"
      : null;
  if (!format) return null;
  return {
    url,
    format,
    subtitles: $("video track")
      .toArray()
      .flatMap((el) => {
        const a = $(el);
        try {
          return [
            {
              url: new URL(a.attr("src")!, ORIGIN).href,
              label: a.attr("label") || "Captions",
              language: a.attr("srclang") || "und",
            },
          ];
        } catch {
          return [];
        }
      }),
  };
}

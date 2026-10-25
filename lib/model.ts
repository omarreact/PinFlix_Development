import { z } from "zod";
export const TitleSchema = z.object({
  id: z.string().regex(/^(movie|series)-\d+$/),
  providerId: z.string().regex(/^\d+$/),
  kind: z.enum(["movie", "series"]),
  title: z.string().min(1).max(400),
  poster: z.string().nullable(),
  backdrop: z.string().nullable().default(null),
  year: z.number().int().nullable(),
  category: z.string().default(""),
  language: z.string().nullable().default(null),
  quality: z.string().nullable().default(null),
  rating: z.string().nullable().default(null),
  mature: z.boolean().default(false),
  addedLabel: z.string().nullable().default(null),
  synopsis: z.string().default(""),
  genres: z.array(z.string()).default([]),
  cast: z.array(z.string()).default([]),
  runtime: z.string().nullable().default(null),
  seasons: z.array(z.number().int()).default([]),
  aliases: z.array(z.string()).default([]),
  country: z.string().nullable().default(null),
  seriesStatus: z.enum(["ongoing", "completed"]).nullable().default(null),
  universe: z.enum(["marvel", "dc"]).nullable().default(null),
});
export type Title = z.infer<typeof TitleSchema>;
export type Category = {
  name: string;
  kind: "movie" | "series";
  mature: boolean;
};
export type Episode = {
  number: number;
  season: number;
  title: string;
  thumbnail: string | null;
  quality: string | null;
  synopsis?: string;
  runtime?: string;
  introEnd?: number;
  recapEnd?: number;
};
export type Detail = {
  title: Title;
  episodes: Episode[];
  season: number;
  related: Title[];
};
export type Catalogue = {
  items: Title[];
  categories: Category[];
  years: number[];
  hasNext: boolean;
  /** Progress of the CineplexBD TV index used for A–Z / category filters. */
  sourceIndex?: { count: number; hasMore: boolean; paused: boolean };
  offlineMode?: boolean;
  page: number;
  stale: boolean;
  retrievedAt: string;
  total?: number;
  letters?: string[];
  facets?: {
    genres: string[];
    languages: string[];
    qualities: string[];
    countries: string[];
  };
};
export type Playback = {
  status:
    | "ready"
    | "authorization_required"
    | "restricted"
    | "unavailable"
    | "unsupported";
  message: string;
  url?: string;
  format?: "mp4" | "hls";
  subtitles?: { url: string; label: string; language: string }[];
  checkedAt: string;
  download?: { url: string; quality?: string; fileSize?: number };
};
export const BASE = "";
export const api = (path: string) => {
  const [resource, query] = path.split("?");
  const clean = resource.endsWith("/") ? resource : resource + "/";
  return BASE + "/api" + clean + (query ? "?" + query : "");
};

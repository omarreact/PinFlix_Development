export type ContentType = "movie" | "series";
export type SourceStatus = "live" | "snapshot_fallback";
export type CatalogFilter = "all" | ContentType | "anime" | "wrestling";
export interface VideoSearchResult {
  id: string;
  title: string;
  type: ContentType;
  year?: number;
  category?: string;
  poster?: string;
  detailUrl: string;
  source: "cineplexbd";
  imdb?: string;
  resolution?: string;
  timeAgo?: string;
  hits?: string;
  downloads?: string;
  lang?: string;
}
export interface CineplexCategory {
  title: string;
  href: string;
  categoryParam: string;
  type: ContentType;
  group?: string;
}
export interface PlayableStream {
  url: string;
  label: string;
  format: "mp4" | "hls" | "dash" | "direct";
  quality: string;
  /** A source document exposed the link; this is not proof of browser playback. */
  verified: boolean;
}
export interface CineplexEpisode {
  id: string;
  episodeNumber: number;
  title: string;
  detailUrl?: string;
  downloadUrl?: string;
  streamUrl?: string;
  streams?: PlayableStream[];
  resolution?: string;
  fileSize?: string;
  releaseDate?: string;
  isPlayable: boolean;
}
export interface CineplexSeason {
  seasonNumber: number;
  title: string;
  episodeCount: number;
  episodes: CineplexEpisode[];
}
export interface CineplexMediaDetails {
  id: string;
  title: string;
  type: ContentType;
  category: string;
  year?: number;
  poster?: string;
  backdrop?: string;
  synopsis?: string;
  imdbRating?: string;
  resolution?: string;
  duration?: string;
  language?: string;
  director?: string;
  actors?: string[];
  genre?: string[];
  hits?: string;
  downloads?: string;
  uploadDate?: string;
  detailUrl: string;
  downloadUrls?: { label: string; url: string; size?: string }[];
  playableStreams: PlayableStream[];
  seasons?: CineplexSeason[];
  source: "cineplexbd";
  sourceStatus: SourceStatus;
  notice?: string;
}
export interface AdvancedSearchParams {
  q?: string;
  name?: string;
  generic?: string;
  actors?: string;
  category?: string;
  years?: (string | number)[];
  page?: number;
  type?: CatalogFilter;
  limit?: number;
  sort?: "source" | "title";
}
export interface CineplexSearchResultPage {
  items: VideoSearchResult[];
  page: number;
  totalPages: number;
  totalFound: number;
  totalMovies?: number;
  totalSeries?: number;
  query: string;
  hasMore: boolean;
  sourceStatus: SourceStatus;
  cached?: boolean;
  networkLatencyMs?: number;
  notice?: string;
  /** The upstream search paginates movies and series independently. */
  countScope?: "snapshot" | "source" | "page";
}
export interface CineplexHealthStatus {
  status: "healthy" | "degraded" | "offline";
  endpoint: string;
  directAccessible: boolean;
  httpStatus?: number;
  latencyMs?: number;
  snapshotItems: number;
  reportedCatalogItems: number;
  lastChecked: string;
  notes: string;
}

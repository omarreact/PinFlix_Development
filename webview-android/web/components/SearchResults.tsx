"use client";
import { useState } from "react";
import {
  Film,
  Tv,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  VideoSearchResult,
  CatalogFilter,
  CineplexSearchResultPage,
} from "@/lib/cineplex-types";
import { Poster } from "./Poster";
interface Props {
  data: CineplexSearchResultPage;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSelectResult: (item: VideoSearchResult) => void;
  activeTypeFilter: CatalogFilter;
  onTypeFilterChange: (type: CatalogFilter) => void;
  selectedCategory?: string;
  onClearCategory: () => void;
  sort: "source" | "title";
  onSortChange: (sort: "source" | "title") => void;
}
export function SearchResults({
  data,
  isLoading,
  onPageChange,
  onSelectResult,
  activeTypeFilter,
  onTypeFilterChange,
  selectedCategory,
  onClearCategory,
  sort,
  onSortChange,
}: Props) {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <section
      aria-label="Catalog results"
      aria-busy={isLoading}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
        <div>
          <h2 className="text-xl font-bold">
            {data.query
              ? `Results for “${data.query}”`
              : selectedCategory || "Explore the catalog"}
          </h2>
          <p role="status" className="mt-2 text-xs text-slate-400">
            {isLoading
              ? "Loading titles…"
              : `${data.totalFound.toLocaleString()} ${data.countScope === "page" ? "matches on this source page" : "matching titles"}`}
            {data.totalMovies !== undefined
              ? ` · ${data.totalMovies.toLocaleString()} movies`
              : ""}
            {data.totalSeries !== undefined
              ? ` · ${data.totalSeries.toLocaleString()} series`
              : ""}
          </p>
          {selectedCategory && (
            <button
              onClick={onClearCategory}
              className="mt-2 text-xs text-violet-300 hover:underline"
            >
              Clear category ×
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="catalog-sort">
            Sort titles
          </label>
          <select
            id="catalog-sort"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as "source" | "title")}
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="source">Source order</option>
            <option value="title">
              {data.sourceStatus === "live" ? "A–Z on this page" : "A–Z"}
            </option>
          </select>
          <button
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`rounded-lg p-2 ${view === "grid" ? "bg-white/15" : "bg-slate-950"}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            aria-label="Title list view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`rounded-lg p-2 ${view === "list" ? "bg-white/15" : "bg-slate-950"}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Content types">
        {(["all", "movie", "series", "anime", "wrestling"] as const).map(
          (type, i) => (
            <button
              key={type}
              aria-pressed={activeTypeFilter === type}
              onClick={() => onTypeFilterChange(type)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors ${activeTypeFilter === type ? "border-violet-400 bg-violet-500 text-slate-950" : "border-white/10 bg-slate-900 text-slate-300 hover:border-violet-400/40"}`}
            >
              {
                [
                  "All",
                  "Movies",
                  "TV Series",
                  "Anime & Animation",
                  "Wrestling",
                ][i]
              }
            </button>
          ),
        )}
      </div>
      {data.notice && (
        <p
          role="status"
          className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-200"
        >
          {data.notice}
        </p>
      )}
      {isLoading ? (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          aria-label="Loading titles"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-2xl bg-slate-800/60"
            />
          ))}
        </div>
      ) : data.items.length ? (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              : "divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50"
          }
        >
          {data.items.map((item) => (
            <button
              key={`${item.type}:${item.id}`}
              onClick={() => onSelectResult(item)}
              aria-label={`View ${item.title}`}
              className={
                view === "grid"
                  ? "group overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-left transition hover:-translate-y-1 hover:border-violet-400/40"
                  : "flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-white/5"
              }
            >
              {view === "grid" && (
                <div className="relative">
                  <Poster
                    src={data.sourceStatus === "snapshot_fallback" && item.poster?.includes("cineplexbd.net/") ? undefined : item.poster}
                    title={item.title}
                    className="aspect-[2/3] w-full"
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-slate-950/85 px-2 py-1 text-[10px] font-bold text-violet-200">
                    {item.type === "series" ? "SERIES" : "MOVIE"}
                  </span>
                  {item.imdb && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-amber-300">
                      ★ {item.imdb}
                    </span>
                  )}
                </div>
              )}
              <span
                className={
                  view === "grid"
                    ? "block p-3"
                    : "flex min-w-0 items-center gap-3"
                }
              >
                {view === "list" &&
                  (item.type === "series" ? (
                    <Tv size={18} className="shrink-0 text-purple-400" />
                  ) : (
                    <Film size={18} className="shrink-0 text-violet-400" />
                  ))}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold group-hover:text-violet-300">
                    {item.title}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-slate-400">
                    {item.year || "Year unknown"} · {item.category || item.type}
                  </span>
                </span>
              </span>
              {view === "list" && (
                <span className="shrink-0 text-xs text-slate-400">
                  {item.resolution || "Details"}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
          <Film className="mx-auto mb-3 text-slate-500" />
          <h3 className="font-bold">No matching titles</h3>
          <p className="mt-2 text-sm text-slate-400">
            Try a different title or fewer filters.
          </p>
        </div>
      )}
      <nav
        aria-label="Catalog pagination"
        className="flex items-center justify-center gap-4 pt-4"
      >
        <button
          aria-label="Previous page"
          disabled={isLoading || data.page <= 1}
          onClick={() => onPageChange(data.page - 1)}
          className="rounded-xl border border-white/10 bg-slate-900 p-3 disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs text-slate-400">
          Page {data.page} of {data.totalPages}
        </span>
        <button
          aria-label="Next page"
          disabled={isLoading || !data.hasMore}
          onClick={() => onPageChange(data.page + 1)}
          className="rounded-xl border border-white/10 bg-slate-900 p-3 disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </nav>
    </section>
  );
}

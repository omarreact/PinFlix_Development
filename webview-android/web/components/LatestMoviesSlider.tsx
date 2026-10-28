"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { CineplexSearchResultPage, VideoSearchResult } from "@/lib/cineplex-types";
import { Poster } from "./Poster";

export function LatestMoviesSlider({
  onSelectMovie,
  onBrowseMovies,
}: {
  onSelectMovie: (movie: VideoSearchResult) => void;
  onBrowseMovies: () => void;
}) {
  const [data, setData] = useState<CineplexSearchResultPage>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const track = useRef<HTMLUListElement>(null);
  const items = data?.items.slice(0, 12) || [];

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/api/cineplex/latest", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Movie list unavailable");
        return response.json() as Promise<CineplexSearchResultPage>;
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const list = track.current;
    if (!list) return;
    const update = () => {
      const previous = list.scrollLeft > 2;
      const next = list.scrollLeft + list.clientWidth < list.scrollWidth - 2;
      setEdges((old) => old.previous === previous && old.next === next ? old : { previous, next });
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [items.length]);

  function move(direction: number) {
    const list = track.current;
    if (!list) return;
    list.scrollBy({
      left: direction * list.clientWidth * 0.85,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  return (
    <section aria-labelledby="latest-movies-title" aria-roledescription="carousel" className="relative mx-auto mb-10 max-w-7xl text-left">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">Find your next watch</p>
          <h2 id="latest-movies-title" className="text-2xl font-extrabold tracking-tight">Latest movies</h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <button aria-label="Previous latest movies" aria-controls="latest-movies-track" disabled={!edges.previous} onClick={() => move(-1)} className="rounded-full border border-white/15 bg-slate-900 p-2.5 text-white hover:bg-violet-500/20 disabled:cursor-default disabled:opacity-25">
            <ChevronLeft size={19} />
          </button>
          <button aria-label="Next latest movies" aria-controls="latest-movies-track" disabled={!edges.next} onClick={() => move(1)} className="rounded-full border border-white/15 bg-slate-900 p-2.5 text-white hover:bg-violet-500/20 disabled:cursor-default disabled:opacity-25">
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <p role="status" className={`mb-4 text-xs ${data?.sourceStatus === "snapshot_fallback" ? "text-amber-200" : "text-slate-400"}`}>
        {error ? "The movie list could not be loaded." : !data ? "Loading the latest movie list…" : data.sourceStatus === "snapshot_fallback" ? "Saved movie picks · the latest live list is unavailable." : "Latest additions in CineplexBD source order. Swipe to explore."}
      </p>
      {error ? (
        <button onClick={() => setRetry((value) => value + 1)} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-violet-200">Retry movie list</button>
      ) : data && !items.length ? (
        <p className="rounded-2xl border border-white/10 p-6 text-sm text-slate-400">No movies are currently listed by the source.</p>
      ) : (
        <ul ref={track} id="latest-movies-track" aria-label="Latest movie slides" aria-busy={!data} tabIndex={0} onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }} className="latest-movies-track flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain rounded-2xl pb-3 pt-1 sm:gap-4">
          {!data ? Array.from({ length: 8 }, (_, index) => (
            <li key={index} aria-hidden="true" className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-2xl bg-slate-800 sm:w-44 lg:w-48" />
          )) : items.map((movie, index) => (
            <li key={movie.id} aria-roledescription="slide" aria-label={`${index + 1} of ${items.length}`} className="w-36 shrink-0 snap-start sm:w-44 lg:w-48">
              <button onClick={() => onSelectMovie(movie)} aria-label={`View latest movie ${movie.title}`} className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-left transition hover:border-violet-400/60">
                <div className="relative">
                  <Poster src={data.sourceStatus === "snapshot_fallback" && movie.poster?.includes("cineplexbd.net/") ? undefined : movie.poster} title={movie.title} className="aspect-[2/3] w-full" />
                  <span aria-hidden="true" className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-violet-200">{String(index + 1).padStart(2, "0")}</span>
                  {movie.resolution && <span className="absolute bottom-2 left-2 rounded-md bg-black/80 px-2 py-1 text-[9px] font-bold text-white">{movie.resolution}</span>}
                  <span aria-hidden="true" className="absolute bottom-2 right-2 rounded-full bg-violet-500 p-2 text-white shadow-lg transition group-hover:scale-110"><Play size={14} fill="currentColor" /></span>
                </div>
                <span className="block p-3">
                  <span className="block truncate text-sm font-bold group-hover:text-violet-200">{movie.title}</span>
                  <span className="mt-1 block truncate text-[11px] text-slate-400">{[movie.year, movie.category].filter(Boolean).join(" · ") || "Movie"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span>Swipe or use the arrows</span>
        <button onClick={onBrowseMovies} className="inline-flex items-center gap-2 rounded-lg py-2 font-semibold text-violet-300 hover:text-violet-200">Browse all movies <ArrowRight size={14} /></button>
      </div>
    </section>
  );
}

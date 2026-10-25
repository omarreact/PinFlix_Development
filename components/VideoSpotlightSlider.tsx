"use client";

import Link from "next/link";
import { Check, ChevronRight, CirclePlay, Plus, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Title } from "@/lib/model";
import { saved, toggleSave } from "@/lib/storage";
import { artworkUrl } from "./artwork";
import { usePosterColor } from "./poster-ambient";

/** Connects a spotlight slide to a real PinFlix movie and My List entry. */
export type SpotlightItem = {
  movie: Title;
  /** Optional provider ID / route segment. Defaults to movie.id. */
  slug?: string;
  /** Optional CineplexBD-authorized video only (none is enabled by default). */
  trailerUrl?: string | null;
  posterUrl?: string | null;
  titleLogoUrl?: string | null;
  synopsis?: string | null;
};

const sampleMovie: Title = {
  id: "movie-78828",
  providerId: "78828",
  kind: "movie",
  title: "Cursed Waters",
  poster: null,
  backdrop: null,
  year: 2026,
  category: "Thriller",
  language: "English",
  quality: "HD",
  rating: null,
  mature: false,
  addedLabel: null,
  synopsis: "",
  genres: ["Thriller"],
  cast: [],
  runtime: null,
  seasons: [],
  aliases: [],
  country: null,
  seriesStatus: null,
  universe: null,
};

/** CineplexBD catalogue examples without unrelated trailer playback. */
export const MOCK_SPOTLIGHT_ITEMS: SpotlightItem[] = [
  {
    movie: sampleMovie,
    slug: "movie-78828",
    trailerUrl: null,
    posterUrl: null,
    synopsis:
      "During a plague's reign of terror, a devout figure and an ambiguous stranger set out to trade supplies for an alleged cure in a...",
  },
  {
    movie: { ...sampleMovie, id: "movie-34110", providerId: "34110", title: "The Dark Knight", category: "Action", genres: ["Action"] },
    slug: "movie-34110",
    trailerUrl: null,
    posterUrl: "/artwork/e6bbf364f7017b99.jpg",
    synopsis:
      "A masked hero faces a new threat as the city he swore to protect is pushed to its limits.",
  },
];

export type VideoSpotlightSliderProps = {
  items?: readonly SpotlightItem[];
  className?: string;
};

export function VideoSpotlightSlider({
  items = MOCK_SPOTLIGHT_ITEMS,
  className = "",
}: VideoSpotlightSliderProps) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef<number[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const active = items[activeIndex % Math.max(items.length, 1)];
  const videoUrl = active?.trailerUrl || null;
  const poster = artworkUrl(active?.posterUrl ?? active?.movie.backdrop ?? active?.movie.poster ?? null);
  const spotlightSource = active?.posterUrl ?? active?.movie.backdrop ?? active?.movie.poster ?? null;
  const spotlightRgb = usePosterColor(spotlightSource);
  const movieId = active?.movie.id;
  const canShowVideo = !!videoUrl && !videoFailed && !reducedMotion;

  useEffect(() => {
    const node = mediaRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= 0.35),
      { threshold: [0, 0.35, 0.65, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      setReducedMotion(preference.matches || document.documentElement.dataset.motion === "off");
    sync();
    preference.addEventListener("change", sync);
    window.addEventListener("pinflix-preferences", sync);
    return () => {
      preference.removeEventListener("change", sync);
      window.removeEventListener("pinflix-preferences", sync);
    };
  }, []);

  useEffect(() => {
    const sync = () => setIsSaved(!!movieId && saved().some((movie) => movie.id === movieId));
    sync();
    window.addEventListener("pinflix-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pinflix-storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, [movieId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    const syncPlayback = () => {
      if (inView && !transitioning && !document.hidden && !reducedMotion) {
        void video.play().catch(() => {
          // Autoplay may be refused by the browser; leave the poster visible.
        });
      } else {
        video.pause();
      }
    };
    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [activeIndex, inView, muted, transitioning, reducedMotion, canShowVideo]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const nextSlide = useCallback(() => {
    if (items.length < 2 || transitioning) return;
    const advance = () => {
      setActiveIndex((previous) => (previous + 1) % items.length);
      setVideoFailed(false);
      setLogoFailed(false);
      // Muted autoplay is allowed more consistently across mobile browsers.
      setMuted(true);
    };
    if (reducedMotion) {
      advance();
      return;
    }
    setTransitioning(true);
    timers.current.push(window.setTimeout(() => {
      advance();
      timers.current.push(window.setTimeout(() => setTransitioning(false), 60));
    }, 250));
  }, [items.length, reducedMotion, transitioning]);

  const toggleMute = () => {
    const next = !muted;
    if (videoRef.current) videoRef.current.muted = next;
    setMuted(next);
  };

  if (!active) return null;

  const href = "/movies/" + encodeURIComponent(active.slug || active.movie.id) + "/";
  const synopsis = active.synopsis?.trim() || active.movie.synopsis.trim() ||
    "Explore this featured movie on PinFlix, discover its story, and add it to your list.";
  const showLogo = !!active.titleLogoUrl && !logoFailed;

  return (
    <section
      aria-label="Featured video spotlight"
      aria-roledescription="carousel"
      className={"relative isolate w-full overflow-hidden !bg-black text-white font-[family-name:var(--font-inter-google)] " + className}
    >
      <div
        ref={mediaRef}
        className="relative aspect-video w-full overflow-hidden bg-black"
      >
        {poster && (
          // Dynamic catalogue artwork may be local or served by the existing artwork proxy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            aria-hidden="true"
            className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " +
              (transitioning ? "opacity-0" : "opacity-100")}
          />
        )}
        {canShowVideo && (
          <video
            key={active.movie.id + ":" + videoUrl}
            ref={videoRef}
            src={videoUrl || undefined}
            poster={poster || undefined}
            className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " +
              (transitioning ? "opacity-0" : "opacity-100")}
            loop
            muted={muted}
            playsInline
            preload="metadata"
            aria-label={active.movie.title + " featured video"}
            onError={() => setVideoFailed(true)}
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-[background-color] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            backgroundColor: `rgba(${spotlightRgb}, 0.28)`,
            maskImage: "linear-gradient(to bottom, black 0%, transparent 78%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 78%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black"
        />
        {items.length > 1 && (
          <button
            type="button"
            onClick={nextSlide}
            disabled={transitioning}
            aria-label="Next featured movie"
            className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:right-6"
          >
            <ChevronRight aria-hidden="true" size={26} strokeWidth={1.6} />
          </button>
        )}
      </div>

      <div className="relative z-10 flex min-h-[220px] items-end justify-between bg-black px-6 pb-10 pt-2 md:px-12">
        <div
          className={"max-w-lg transition-opacity duration-300 " + (transitioning ? "opacity-0" : "opacity-100")}
          aria-live="polite"
          aria-atomic="true"
        >
          {showLogo ? (
            // Logos come from the content catalogue rather than a fixed Next image loader.
            <img
              src={active.titleLogoUrl || undefined}
              alt={active.movie.title}
              onError={() => setLogoFailed(true)}
              className="mb-4 h-16 w-auto max-w-full object-contain object-left md:h-24"
            />
          ) : (
            <h2
              className="mb-4 origin-left -rotate-2 font-[family-name:var(--font-permanent-marker)] text-4xl leading-[1.05] font-normal tracking-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.8)] md:text-5xl"
            >
              {active.movie.title}
            </h2>
          )}

          <p className="mb-6 line-clamp-3 text-[14px] leading-relaxed font-normal text-[#9CA3AF] md:text-[15px]">
            {synopsis}
          </p>

          <div className="flex items-center gap-3">
            <Link
              href={href}
              className="inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-[12px] bg-white px-7 py-3.5 text-[15px] font-semibold text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <CirclePlay aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              Play Now
            </Link>
            <button
              type="button"
              onClick={() => toggleSave(active.movie)}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Remove " + active.movie.title + " from My List" : "Save " + active.movie.title + " to My List"}
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[12px] border border-white/25 bg-white/[0.04] text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              title={isSaved ? "Remove from My List" : "Add to My List"}
            >
              {isSaved ? <Check aria-hidden="true" className="h-6 w-6" strokeWidth={1.7} /> : <Plus aria-hidden="true" className="h-6 w-6" strokeWidth={1.7} />}
            </button>
          </div>
        </div>
      </div>

      {canShowVideo && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute spotlight video" : "Mute spotlight video"}
          aria-pressed={!muted}
          className="absolute bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1F23] text-zinc-300 transition-colors hover:bg-[#2E2E34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:right-12"
        >
          {muted ? <VolumeX aria-hidden="true" className="h-4 w-4" /> : <Volume2 aria-hidden="true" className="h-4 w-4" />}
        </button>
      )}
    </section>
  );
}

export default VideoSpotlightSlider;

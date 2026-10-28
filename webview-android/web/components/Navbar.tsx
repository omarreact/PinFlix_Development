"use client";
import { useState } from "react";
import { Menu, X, ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  CINEPLEX_MOVIE_CATEGORIES,
  CINEPLEX_TV_CATEGORIES,
} from "@/lib/cineplex-categories";
import type { ContentType } from "@/lib/cineplex-types";
interface Props {
  onSelectCategory: (category: string, type: ContentType) => void;
  onOpenAdvancedSearch: () => void;
  onQuickSearch: (q: string) => void;
  onBrowseType: (type: ContentType) => void;
  activeCategory?: string;
}
export function Navbar({
  onSelectCategory,
  onOpenAdvancedSearch,
  onQuickSearch,
  onBrowseType,
}: Props) {
  const [mobile, setMobile] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <button
          onClick={() => {
            onQuickSearch("");
            setMobile(false);
          }}
          aria-label="PinFlix home"
          className="flex items-center gap-3"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 text-xl font-black text-white">
            P
          </span>
          <span className="text-left">
            <span className="block text-lg font-black tracking-widest text-white">
              PINFLIX
            </span>
            <span className="block text-[9px] uppercase tracking-[0.22em] text-slate-400">
              CineplexBD search
            </span>
          </span>
        </button>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-3 md:flex"
        >
          <button onClick={() => onQuickSearch("")} className="nav-button">
            All titles
          </button>
          <button onClick={() => onBrowseType("movie")} className="nav-button">
            Movies
          </button>
          <button onClick={() => onBrowseType("series")} className="nav-button">
            TV Series
          </button>
          <details className="group">
            <summary className="nav-button flex cursor-pointer list-none items-center gap-2">
              Categories
              <ChevronDown size={14} />
            </summary>
            <div className="absolute left-1/2 top-full grid max-h-[70dvh] w-[min(960px,95vw)] -translate-x-1/2 grid-cols-2 gap-8 overflow-y-auto rounded-b-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              {(["movie", "series"] as const).map((type) => (
                <section key={type}>
                  <h2 className="mb-3 font-bold text-violet-300">
                    {type === "movie" ? "Movies" : "TV Series"}
                  </h2>
                  <div className="grid grid-cols-2 gap-1">
                    {(type === "movie"
                      ? CINEPLEX_MOVIE_CATEGORIES
                      : CINEPLEX_TV_CATEGORIES
                    ).map((c) => (
                      <button
                        key={c.categoryParam}
                        onClick={(e) => {
                          onSelectCategory(c.categoryParam, type);
                          e.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                        }}
                        className="rounded-lg p-2 text-left text-xs text-slate-300 hover:bg-white/5"
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </details>
          <button
            onClick={onOpenAdvancedSearch}
            className="nav-button flex items-center gap-2"
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </nav>
        <button
          aria-label={mobile ? "Close navigation" : "Open navigation"}
          aria-expanded={mobile}
          onClick={() => setMobile((old) => !old)}
          className="rounded-xl bg-white/5 p-2 md:hidden"
        >
          {mobile ? <X /> : <Menu />}
        </button>
      </div>
      {mobile && (
        <nav
          aria-label="Mobile navigation"
          className="max-h-[70dvh] space-y-2 overflow-y-auto border-t border-white/10 p-4 md:hidden"
        >
          <div className="flex flex-wrap gap-2">
            {(["movie", "series"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  onBrowseType(type);
                  setMobile(false);
                }}
                className="nav-button"
              >
                {type === "movie" ? "Movies" : "TV Series"}
              </button>
            ))}
            <button
              onClick={() => {
                onOpenAdvancedSearch();
                setMobile(false);
              }}
              className="nav-button"
            >
              Advanced search
            </button>
          </div>
          {(["movie", "series"] as const).map((type) => (
            <details key={type}>
              <summary className="cursor-pointer p-3 text-sm font-semibold">
                {type === "movie" ? "Movie categories" : "TV categories"}
              </summary>
              <div className="grid grid-cols-2 gap-1">
                {(type === "movie"
                  ? CINEPLEX_MOVIE_CATEGORIES
                  : CINEPLEX_TV_CATEGORIES
                ).map((c) => (
                  <button
                    key={c.categoryParam}
                    onClick={() => {
                      onSelectCategory(c.categoryParam, type);
                      setMobile(false);
                    }}
                    className="rounded-lg p-2 text-left text-xs text-slate-400 hover:bg-white/5"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </nav>
      )}
    </header>
  );
}

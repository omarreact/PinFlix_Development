"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  Search,
  Loader2,
  X,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import type {
  VideoSearchResult,
  CineplexSearchResultPage,
} from "@/lib/cineplex-types";
import { Poster } from "./Poster";
interface Props {
  initialQuery?: string;
  onSelectResult?: (item: VideoSearchResult) => void;
  onSearchSubmit?: (q: string) => void;
  onOpenAdvanced?: () => void;
  className?: string;
  placeholder?: string;
}
export function UniversalSearch({
  initialQuery = "",
  onSelectResult,
  onSearchSubmit,
  onOpenAdvanced,
  className = "",
  placeholder = "Search movies, series, anime and more…",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<VideoSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const [notice, setNotice] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const skip = useRef(initialQuery);
  useEffect(() => {
    if (query === skip.current) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!query.trim()) return;
      setLoading(true);
      try {
        const response = await fetch(
          `/api/cineplex/search?q=${encodeURIComponent(query.trim())}&limit=8`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search is temporarily unavailable.");
        const data: CineplexSearchResultPage = await response.json();
        if (!controller.signal.aborted && skip.current !== query) {
          setResults(data.items);
          setNotice(
            data.sourceStatus === "snapshot_fallback"
              ? "Searching the saved catalog"
              : "",
          );
          setOpen(true);
          setIndex(-1);
        }
      } catch (error) {
        if (!controller.signal.aborted && skip.current !== query) {
          setResults([]);
          setNotice((error as Error).message);
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const select = (item: VideoSearchResult) => {
    skip.current = query;
    setOpen(false);
    onSelectResult?.(item);
  };
  const submit = () => {
    skip.current = query;
    setLoading(false);
    setOpen(false);
    onSearchSubmit?.(query.trim());
  };
  return (
    <div ref={ref} className={`relative w-full text-left ${className}`}>
      <form
        role="search"
        className="relative flex items-center"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span className="absolute left-4 text-slate-400">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Search size={18} />
          )}
        </span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Search the catalog"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-activedescendant={
            open && index >= 0 ? `${id}-${index}` : undefined
          }
          value={query}
          maxLength={160}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => {
            skip.current = "";
            setQuery(e.target.value);
            setIndex(-1);
            setResults([]);
            setLoading(false);
            if (!e.target.value.trim()) {
              setOpen(false);
              skip.current = "";
            }
          }}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              skip.current = query;
              setOpen(false);
              return;
            }
            if (
              open &&
              results.length &&
              (event.key === "ArrowDown" || event.key === "ArrowUp")
            ) {
              event.preventDefault();
              setIndex(
                (old) =>
                  (old +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    results.length) %
                  results.length,
              );
            }
            if (event.key === "Enter" && open && index >= 0) {
              event.preventDefault();
              select(results[index]);
            }
          }}
          className="w-full rounded-2xl border border-white/15 bg-slate-900 px-12 py-4 pr-32 text-sm text-white shadow-xl placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setResults([]);
                setOpen(false);
                setLoading(false);
                skip.current = "";
                input.current?.focus();
              }}
              className="rounded-lg p-2 text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            aria-label="Submit search"
            className="rounded-lg bg-violet-500 p-2 text-slate-950 hover:bg-violet-400"
          >
            <ArrowRight size={18} />
          </button>
          {onOpenAdvanced && (
            <button
              type="button"
              aria-label="Advanced search"
              onClick={() => {
                setOpen(false);
                onOpenAdvanced();
              }}
              className="rounded-lg p-2 text-violet-300 hover:bg-white/10"
            >
              <SlidersHorizontal size={18} />
            </button>
          )}
        </div>
      </form>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[55dvh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
          {notice && (
            <p role="status" className="px-3 py-2 text-xs text-amber-300">
              {notice}
            </p>
          )}
          <ul
            role="listbox"
            id={`${id}-results`}
            aria-label="Search suggestions"
          >
            {results.map((item, i) => (
              <li
                role="option"
                aria-selected={index === i}
                id={`${id}-${i}`}
                key={`${item.type}:${item.id}`}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerEnter={() => setIndex(i)}
                  onClick={() => select(item)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${index === i ? "bg-violet-500/20" : "hover:bg-white/5"}`}
                >
                  <Poster
                    src={item.poster}
                    title={item.title}
                    className="h-14 w-10 shrink-0 rounded-lg"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                      {item.title}
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.type === "series" ? "Series" : "Movie"} ·{" "}
                      {item.year || "Year unknown"} · {item.category}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!results.length && (
            <p role="status" className="p-5 text-sm text-slate-400">
              No matching titles found.
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            className="mt-2 w-full rounded-xl bg-white/5 p-3 text-xs font-semibold text-violet-300"
          >
            View all results for “{query}”
          </button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Film,
  Search,
  SlidersHorizontal,
  Tv,
  X,
} from "lucide-react";
import { api, type Catalogue } from "@/lib/model";
import { alphabet, titleLetter } from "@/lib/directory";
import {
  QuerySchema,
  queryParams,
  type CatalogueFilters,
} from "@/lib/catalogue-query";
import { SaveButton } from "./hero";
import { titleHref } from "@/lib/curation";
export function DirectoryList({
  initial,
  kind,
  initialFilters,
}: {
  initial: Catalogue;
  kind: "movie" | "series";
  initialFilters: CatalogueFilters;
}) {
  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState(initialFilters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [revision, setRevision] = useState(0);
  const first = useRef(true);
  const version = useRef(0);
  const update = (key: keyof CatalogueFilters, value: string | number) =>
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key !== "page" ? { page: 1 } : {}),
    }));
  useEffect(() => {
    const pop = () =>
      setFilters(
        QuerySchema.parse(
          Object.fromEntries(new URLSearchParams(location.search)),
        ),
      );
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const current = ++version.current;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setBusy(true);
        setError("");
        const p = queryParams(filters, kind);
        p.set("directory", "true");
        const url = new URL(location.href);
        const visible = queryParams(filters);
        url.search = visible.toString();
        window.history.replaceState(window.history.state, "", url);
        try {
          const r = await fetch(api("/catalogue?" + p), {
            signal: controller.signal,
          });
          if (!r.ok) throw new Error();
          const next: Catalogue = await r.json();
          if (current === version.current && !controller.signal.aborted)
            setData(next);
        } catch {
          if (!controller.signal.aborted)
            setError("We couldn’t load this selection. Please try again.");
        } finally {
          if (!controller.signal.aborted) setBusy(false);
        }
      },
      filters.q !== initialFilters.q ? 250 : 80,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, kind, revision, initialFilters.q]);
  // CineplexBD shows 24 series at first, then lazily fetches more through its
  // tvs_more.php endpoint. Keep expanding a small batch while the directory
  // is open so letters, categories and search cover more than the first page.
  useEffect(() => {
    if (kind !== "series" || !data.sourceIndex?.hasMore || busy) return;
    const timeout = window.setTimeout(
      () => setRevision((previous) => previous + 1),
      data.sourceIndex.paused ? 65_000 : 2_500,
    );
    return () => window.clearTimeout(timeout);
  }, [kind, data.sourceIndex?.hasMore, data.sourceIndex?.paused,
      data.sourceIndex?.count, busy]);
  const facet = data.facets || {
    genres: [],
    languages: [],
    qualities: [],
    countries: [],
  };
  const categories = data.categories.filter(
    (c) => c.kind === kind && !c.mature,
  );
  const reset = () => setFilters(QuerySchema.parse({}));
  const active = Object.entries(filters).filter(
    ([k, v]) => v !== "" && k !== "page" && k !== "sort",
  );
  const grouped = filters.sort === "title" || filters.sort === "title-desc";
  const groups = new Map<string, typeof data.items>();
  for (const t of data.items) {
    const letter = grouped ? titleLetter(t.title) : "results";
    groups.set(letter, [...(groups.get(letter) || []), t]);
  }
  function select(
    key: keyof CatalogueFilters,
    label: string,
    values: string[],
    disabled = false,
  ) {
    return (
      <label className="filter-field">
        <span>{label}</span>
        <select
          value={String(filters[key])}
          aria-label={label}
          disabled={disabled}
          onChange={(e) => update(key, e.target.value)}
        >
          <option value="">All {label.toLowerCase()}</option>
          {[
            ...new Set([
              ...values,
              ...(filters[key] ? [String(filters[key])] : []),
            ]),
          ].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="page-content directory-page">
      <div className="page-title">
        <p className="eyebrow">
          {kind === "movie" ? <Film size={14} /> : <Tv size={14} />} THE PINFLIX
          COLLECTION
        </p>
        <h1>
          {kind === "movie" ? "Movies" : "TV Series"}
          <span className="title-period">.</span>
        </h1>
        <p>Less scrolling. More discovering. Every title, A to Z.</p>
      </div>
      <div className="directory-topline">
        <span>
          {kind === "series" && data.sourceIndex
            ? `${data.sourceIndex.count} CineplexBD series indexed`
            : `${data.total ?? data.items.length} indexed movies`}
        </span>
        <span>
          Find your kind of story <ArrowUpRight size={14} />
        </span>
      </div>
      {kind === "series" && data.sourceIndex && (
        <p className="availability-note" role="status" aria-live="polite">
          {data.sourceIndex.hasMore
            ? data.sourceIndex.paused
              ? "CineplexBD is temporarily unavailable. Showing indexed series; another attempt will run automatically."
              : "Adding TV shows from CineplexBD's remaining pages. Categories and A–Z results expand as indexing continues."
            : "All available CineplexBD TV pages have been indexed for this server session."}
        </p>
      )}
      <div className="directory-controls">
        <label className="directory-search">
          <Search size={20} />
          <input
            aria-label={`Search ${kind === "movie" ? "movies" : "series"}`}
            placeholder={`Search ${kind === "movie" ? "movies" : "series"} by title…`}
            value={filters.q}
            maxLength={120}
            onChange={(e) => update("q", e.target.value)}
          />
          {filters.q && (
            <button aria-label="Clear search" onClick={() => update("q", "")}>
              <X size={18} />
            </button>
          )}
        </label>
        <button
          className={`secondary filter-toggle ${advanced ? "selected" : ""}`}
          aria-expanded={advanced}
          aria-controls="advanced-filters"
          onClick={() => setAdvanced((v) => !v)}
        >
          <SlidersHorizontal size={17} /> Filters{" "}
          {active.length > 0 && (
            <span className="count-badge">{active.length}</span>
          )}
        </button>
      </div>
      <div className="directory-filter-row">
        {select(
          "category",
          "Collections",
          categories.map((c) => c.name),
        )}
        {select("year", "Years", data.years.map(String))}
        <label className="filter-field">
          <span>Sort by</span>
          <select
            aria-label="Sort titles"
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value)}
          >
            <option value="title">Title A–Z</option>
            <option value="title-desc">Title Z–A</option>
            <option value="year">Newest first</option>
            <option value="year-asc">Oldest first</option>
            <option value="recent">Recently added</option>
          </select>
        </label>
        <span className="filter-row-spacer" />
        {active.length > 0 && (
          <button className="text-button" onClick={reset}>
            <X size={14} /> Reset filters
          </button>
        )}
      </div>
      {advanced && (
        <div className="advanced-filters" id="advanced-filters">
          {select("genre", "Genres", facet.genres, !facet.genres.length)}
          {select(
            "language",
            "Languages",
            facet.languages,
            !facet.languages.length,
          )}
          {select(
            "quality",
            "Qualities",
            facet.qualities,
            !facet.qualities.length,
          )}
          {select(
            "country",
            "Countries",
            facet.countries,
            !facet.countries.length,
          )}
          <label className="filter-field">
            <span>From year</span>
            <input
              aria-label="From year"
              inputMode="numeric"
              placeholder="1888"
              maxLength={4}
              value={filters.yearFrom}
              onChange={(e) => {
                if (/^\d{0,4}$/.test(e.target.value))
                  update("yearFrom", e.target.value);
              }}
            />
          </label>
          <label className="filter-field">
            <span>To year</span>
            <input
              aria-label="To year"
              inputMode="numeric"
              placeholder={String(new Date().getFullYear())}
              maxLength={4}
              value={filters.yearTo}
              onChange={(e) => {
                if (/^\d{0,4}$/.test(e.target.value))
                  update("yearTo", e.target.value);
              }}
            />
          </label>
          {kind === "series" && (
            <label className="filter-field">
              <span>Series status</span>
              <select
                aria-label="Series status"
                value={filters.status}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="">Any status</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          )}
          <p className="facet-note">
            Filters become available when the collection supplies the matching
            metadata.
          </p>
        </div>
      )}
      <div className="alphabet-nav" aria-label="Filter by first letter">
        <button
          aria-pressed={!filters.letter}
          onClick={() => update("letter", "")}
        >
          ALL
        </button>
        {alphabet.map((letter) => (
          <button
            key={letter}
            aria-pressed={filters.letter === letter}
            onClick={() =>
              update("letter", filters.letter === letter ? "" : letter)
            }
          >
            {letter}
          </button>
        ))}
      </div>
      {active.length > 0 && (
        <div className="active-filters">
          {active.map(([key, value]) => (
            <button
              key={key}
              aria-label={`Remove ${key} filter`}
              onClick={() => update(key as keyof CatalogueFilters, "")}
            >
              {key === "q" ? `“${value}”` : value}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="results-heading" role="status">
        <span>
          {busy
            ? "Finding your stories…"
            : `${data.items.length} ${data.items.length === 1 ? "title" : "titles"} on this page`}
        </span>
        <span>PAGE {data.page}</span>
      </div>
      {error && (
        <div className="notice" role="alert">
          {error}
          <button onClick={() => setRevision((r) => r + 1)}>Try again</button>
        </div>
      )}
      <div
        className={`directory-results ${busy ? "is-loading" : ""}`}
        aria-busy={busy}
      >
        {[...groups.entries()].map(([letter, titles]) => (
          <section key={letter} className="directory-group">
            {grouped && (
              <h2>
                {letter}
                <span>
                  {titles.length} {titles.length === 1 ? "story" : "stories"}
                </span>
              </h2>
            )}
            <div className="directory-list">
              {titles.map((t) => (
                <article key={t.id} className="directory-item">
                  <Link href={titleHref(t)}>
                    <h3>{t.title}</h3>
                    <p>
                      {[t.year, t.category, t.language]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                  {t.quality && <span className="label-tag">{t.quality}</span>}
                  <SaveButton title={t} compact />
                  <Link
                    className="directory-open"
                    href={titleHref(t)}
                    aria-label={`Explore ${t.title}`}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!data.items.length && !busy && (
        <div className="empty">
          <Search size={32} />
          <h2>No stories in this selection.</h2>
          <p>Try another title, letter, or year.</p>
          <button className="secondary" onClick={reset}>
            Clear filters
          </button>
        </div>
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={busy || data.page <= 1}
          onClick={() => update("page", data.page - 1)}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span>
          Page {data.page}
          {data.total ? ` of ${Math.ceil(data.total / 36)}` : ""}
        </span>
        <button
          className="secondary"
          disabled={busy || !data.hasNext}
          onClick={() => update("page", data.page + 1)}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
      {data.stale && (
        <p className="availability-note">
          Showing the saved collection while the catalogue reconnects.
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bookmark, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clapperboard, Film, Grid2X2, List, Menu,
  Play, Search, SlidersHorizontal, Sparkles, Tv, Wifi, WifiOff, X
} from "lucide-react";
import { Artwork } from "./artwork";
import { titleHref } from "@/lib/curation";
import { api, type Catalogue, type Detail, type Title } from "@/lib/model";
import { QuerySchema, queryParams, type CatalogueFilters } from "@/lib/catalogue-query";

type Kind = "" | "movie" | "series";
type Preset = "" | "animation" | "wrestling";

const isAnimation = (t: Title) =>
  /anime|animation|cartoon/i.test([t.category, ...t.genres].join(" "));
const isWrestling = (t: Title) =>
  /wwe|aew|wrestling/i.test([t.category, t.title].join(" "));

function SidebarSection({
  label, kind, categories, activeCategory, activeKind, onPick
}: {
  label: string;
  kind: "movie" | "series";
  categories: Catalogue["categories"];
  activeCategory: string;
  activeKind: Kind;
  onPick: (kind: "movie" | "series", name: string) => void;
}) {
  return (
    <div className="unv-side-group">
      <h3>{label} <span>{categories.length}</span></h3>
      {categories.map((category) => (
        <button
          type="button"
          key={kind + category.name}
          className={"unv-category " +
            (activeCategory === category.name && activeKind === kind ? "is-active" : "")}
          onClick={() => onPick(kind, category.name)}
          aria-pressed={activeCategory === category.name && activeKind === kind}
        >
          <span>{category.name}</span><ChevronRight size={13} />
        </button>
      ))}
    </div>
  );
}

export function UniversalSearch({
  initial, initialFilters, initialKind = ""
}: {
  initial: Catalogue;
  initialFilters: CatalogueFilters;
  initialKind?: Kind;
}) {
  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState(initialFilters);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [preset, setPreset] = useState<Preset>("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Title | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const first = useRef(true);
  const request = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const movieCategories = data.categories.filter((c) => c.kind === "movie" && !c.mature);
  const seriesCategories = data.categories.filter((c) => c.kind === "series" && !c.mature);

  const setFilter = (key: keyof CatalogueFilters, value: string | number) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "page" ? {} : { page: 1 })
    }));
    if (key !== "page") setPreset("");
  };

  const pickKind = (value: Kind) => {
    setKind(value);
    setPreset("");
    setFilters((previous) => ({ ...previous, category: "", page: 1 }));
    setSidebarOpen(false);
  };

  const pickCategory = (value: "movie" | "series", category: string) => {
    setKind(value);
    setPreset("");
    setFilters((previous) => ({
      ...previous,
      q: "",
      category: previous.category === category && kind === value ? "" : category,
      page: 1
    }));
    setSidebarOpen(false);
  };

  const quickCategory = (name: string) => {
    const match = data.categories.find((category) =>
      category.name.toLowerCase() === name.toLowerCase() && !category.mature);
    if (match) {
      pickCategory(match.kind, match.name);
      return;
    }
    setKind("");
    setFilters((previous) => ({ ...previous, q: name, category: "", page: 1 }));
  };

  useEffect(() => {
    const onBack = () => {
      const params = new URLSearchParams(window.location.search);
      setFilters(QuerySchema.parse(Object.fromEntries(params)));
      const nextKind = params.get("kind");
      setKind(nextKind === "movie" || nextKind === "series" ? nextKind : "");
      setPreset("");
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    const version = ++request.current;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      const params = queryParams(filters, kind || undefined);
      const visible = new URL(window.location.href);
      visible.search = params.toString();
      window.history.replaceState(window.history.state, "", visible);
      params.set("directory", "true");
      try {
        const response = await fetch(api("/catalogue?" + params.toString()), {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Catalogue unavailable");
        const result: Catalogue = await response.json();
        if (version === request.current && !controller.signal.aborted) setData(result);
      } catch {
        if (!controller.signal.aborted) setError("Could not reach PinFlix. Retry, or browse the saved titles.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, filters.q ? 350 : 90);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, kind, revision]);

  // Continue PinFlix's native 24-at-a-time series indexing without a bulk
  // background crawl or cross-provider data.
  useEffect(() => {
    if (kind !== "series" || busy || !data.sourceIndex?.hasMore || data.offlineMode) return;
    const timer = window.setTimeout(
      () => setRevision((previous) => previous + 1),
      data.sourceIndex.paused ? 65000 : 3200
    );
    return () => window.clearTimeout(timer);
  }, [kind, busy, data.sourceIndex?.count,
    data.sourceIndex?.hasMore, data.sourceIndex?.paused, data.offlineMode]);

  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void fetch(api("/detail?id=" + encodeURIComponent(selected.id) + "&season=" + selectedSeason), {
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error("Detail unavailable");
        return response.json() as Promise<Detail>;
      })
      .then((details) => { if (!controller.signal.aborted) setSelectedDetail(details); })
      .catch(() => { if (!controller.signal.aborted) setDetailError(true); });
    return () => controller.abort();
  }, [selected, selectedSeason]);

  const filtered = data.items.filter((t) =>
    !preset || (preset === "animation" ? isAnimation(t) : isWrestling(t)));
  const isOffline = Boolean(data.offlineMode);
  const isStale = data.stale || isOffline;
  const sourceMessage = isOffline ? "Offline catalogue enabled"
    : isStale ? "Live source unavailable"
    : "PinFlix catalogue connected";
  const count = data.total ?? data.items.length;
  const movieCount = filtered.filter((t) => t.kind === "movie").length;
  const seriesCount = filtered.filter((t) => t.kind === "series").length;
  const currentlySelected = selectedDetail?.title || selected;
  const episodeList = selectedDetail?.episodes || [];

  return (
    <div className="unv-root">
      {sidebarOpen && (
        <button className="unv-scrim" aria-label="Close categories"
          onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={"unv-sidebar " + (sidebarOpen ? "is-open" : "")}
        aria-label="PinFlix category navigation">
        <div className="unv-brand-row">
          <Link href="/" className="unv-brand" onClick={() => setSidebarOpen(false)}>
            <span className="unv-brand-icon"><Play size={18} fill="currentColor" /></span>
            <span>PIN<span>FLIX</span><small>PinFlix search</small></span>
          </Link>
          <button className="unv-close-side" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            <X size={19} />
          </button>
        </div>
        <div className="unv-side-scroll">
          <div className="unv-side-links">
            <button className={kind === "" ? "is-active" : ""}
              onClick={() => pickKind("")}><Grid2X2 size={17} /> All titles</button>
            <button className={kind === "movie" ? "is-active" : ""}
              onClick={() => pickKind("movie")}><Film size={17} /> Movies</button>
            <button className={kind === "series" ? "is-active" : ""}
              onClick={() => pickKind("series")}><Tv size={17} /> TV Series</button>
          </div>
          <div className="unv-side-label">CATEGORIES</div>
          <SidebarSection label="Movies" kind="movie" categories={movieCategories}
            activeCategory={filters.category} activeKind={kind} onPick={pickCategory} />
          <SidebarSection label="TV Series" kind="series" categories={seriesCategories}
            activeCategory={filters.category} activeKind={kind} onPick={pickCategory} />
        </div>
        <div className="unv-sidebar-foot">
          <button className="unv-connection" onClick={() => setStatusOpen((v) => !v)}>
            {isStale ? <WifiOff size={16} /> : <Wifi size={16} />}
            <span>{isStale ? "Saved catalog" : "Source connected"}</span>
            <CircleHelp size={15} />
          </button>
          <p>Made by PINCODE IT · Availability depends on source</p>
        </div>
      </aside>

      <div className="unv-stage">
        <header className="unv-topbar">
          <button className="unv-hamburger" aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <span className="unv-page-name"><Clapperboard size={17} /> Browse PinFlix</span>
          <div className="unv-top-actions">
            <button onClick={() => searchInput.current?.focus()} aria-label="Jump to search">
              <Search size={17} /> <span>Search</span>
            </button>
            <Link href="/my-list/"><Bookmark size={17} /><span>My List</span></Link>
            <Link href="/profile/" className="unv-user-link" aria-label="Profile">P</Link>
          </div>
        </header>

        <div className="unv-content">
          <section className="unv-hero mb-cinema-hero" aria-labelledby="unv-hero-title">
            {filtered[0]?.poster && <div className="mb-hero-poster" aria-hidden="true">
              <Artwork src={filtered[0].backdrop || filtered[0].poster} alt="" />
            </div>}
            <div className="unv-hero-inner">
              <span className="unv-eyebrow"><Sparkles size={15}/> FEATURED ON PINFLIX</span>
              <h1 id="unv-hero-title">{filtered[0]?.title || <>One search.<br/><em>A world to watch.</em></>}</h1>
              <p>{filtered[0]
                ? [filtered[0].year,filtered[0].category,filtered[0].kind === "series" ? "TV Series" : "Movie"].filter(Boolean).join(" · ")
                : "Discover movies, TV series, anime and more with PinFlix."}</p>
              {filtered[0] && <div className="mb-featured-actions">
                <Link href={titleHref(filtered[0]) + "?resume=1"} className="mb-featured-watch">
                  <Play size={17} fill="currentColor" /> Watch now
                </Link>
                <button type="button" className="mb-featured-more"
                  onClick={() => {setSelected(filtered[0]);setSelectedDetail(null);setSelectedSeason(1);}}>
                  Details <ArrowRight size={16}/>
                </button>
              </div>}
              <form className="unv-hero-search" role="search" onSubmit={(e) => {e.preventDefault();setRevision((r)=>r+1);}}>
                <Search size={20} aria-hidden="true"/>
                <input ref={searchInput} type="search" aria-label="Search the catalog"
                  value={filters.q} maxLength={120}
                  placeholder="Search movies / TV series"
                  onChange={(e) => setFilter("q",e.target.value)}/>
                {filters.q && <button type="button" aria-label="Clear search"
                  className="unv-search-clear" onClick={() => setFilter("q","")}><X size={17}/></button>}
                <button className="unv-search-submit" type="submit"><Search size={18}/><span>Search</span></button>
                <button className="unv-search-advanced" type="button" aria-label="Advanced search"
                  aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v)=>!v)}><SlidersHorizontal size={19}/></button>
              </form>
            </div>
          </section>

          <div className="mb-browse-tabs" role="group" aria-label="Quick content navigation">
            {([["","Trending"],["series","TV/Series"],["movie","Movies"]] as const).map(([value,label])=>
              <button key={label} className={kind===value?"is-active":""} onClick={()=>pickKind(value)}>{label}</button>)}
            <button onClick={()=>{setPreset("animation");setKind("");}}>Anime</button>
            <Link href="/my-list/">My List <Bookmark size={14}/></Link>
          </div>

          <section className="mb-category-section" aria-label="Browse categories">
            <div className="mb-section-title"><h2>Categories</h2><span>Explore by genre</span></div>
            <div className="mb-category-row">
              {[...new Map(data.categories.filter(c=>!c.mature).map(c=>[c.name.toLowerCase(),c])).values()].slice(0,9)
                .map((c,index)=><button key={c.kind+c.name}
                  className={"mb-category-tile mb-category-"+index%5}
                  onClick={()=>pickCategory(c.name,c.kind)}>
                  <span>{c.name}</span><ArrowRight size={17}/>
                </button>)}
            </div>
          </section>

          {(["movie","series"] as const).map((type)=>
            <section key={type} className="mb-poster-section"
              aria-label={type==="movie"?"Popular movies":"Popular series"}>
              <div className="mb-section-title">
                <h2>{type==="movie"?"Popular Movies":"Popular Series"}</h2>
                <button onClick={()=>pickKind(type)}>More <ArrowRight size={15}/></button>
              </div>
              <div className="mb-movie-row">
                {data.items.filter(item=>item.kind===type).slice(0,15).map(item=>
                  <button type="button" className="mb-movie-card" key={item.id}
                    onClick={()=>{setSelected(item);setSelectedDetail(null);setSelectedSeason(1);}}>
                    <div className="mb-movie-cover">
                      <Artwork src={item.poster} alt={item.title}/>
                      {item.rating&&<span className="mb-movie-rating">★ {item.rating}</span>}
                    </div>
                    <strong>{item.title}</strong>
                    <span>{item.year||"Title"} · {item.kind==="movie"?"Movie":"Series"}</span>
                  </button>)}
              </div>
            </section>)}

          {filtersOpen && (
            <div className="unv-advanced" aria-label="Advanced search filters">
              <label>Release year
                <select value={filters.year} onChange={(e) => setFilter("year", e.target.value)}>
                  <option value="">All years</option>
                  {data.years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label>Language
                <select value={filters.language} onChange={(e) => setFilter("language", e.target.value)}>
                  <option value="">All languages</option>
                  {(data.facets?.languages || []).map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label>Quality
                <select value={filters.quality} onChange={(e) => setFilter("quality", e.target.value)}>
                  <option value="">All qualities</option>
                  {(data.facets?.qualities || []).map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label>Category
                <select value={filters.category} onChange={(e) => {
                  const name = e.target.value;
                  const category = data.categories.find((item) => item.name === name && !item.mature);
                  if (category) setKind(category.kind);
                  setFilter("category", name);
                }}>
                  <option value="">All categories</option>
                  {(kind === "series" ? seriesCategories : kind === "movie" ? movieCategories :
                    [...movieCategories, ...seriesCategories]).map((c) =>
                    <option key={c.kind + c.name} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <button className="unv-reset" type="button" onClick={() => {
                setFilters(QuerySchema.parse({ sort: "recent" }));
                setPreset(""); setKind("");
              }}>Reset all filters</button>
            </div>
          )}

          <div className="unv-section-heading">
            <div>
              <span className="unv-section-kicker">THE PINFLIX LIBRARY</span>
              <h2>Explore the catalog</h2>
              <p>{busy ? "Finding stories..." :
                (preset ? filtered.length : count) + " matching titles" +
                  (kind ? " · " + (kind === "movie" ? "Movies" : "TV Series") :
                    " · " + movieCount + " movies · " + seriesCount + " series")}
              </p>
            </div>
            <div className="unv-result-actions">
              <label>Sort titles
                <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
                  <option value="recent">Source order</option>
                  <option value="title">A–Z</option>
                  <option value="title-desc">Z–A</option>
                  <option value="year">Newest year</option>
                  <option value="year-asc">Oldest year</option>
                </select>
              </label>
              <div className="unv-view-toggles" role="group" aria-label="Result layout">
                <button aria-label="Grid view" aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}><Grid2X2 size={17} /></button>
                <button aria-label="Title list view" aria-pressed={view === "list"}
                  onClick={() => setView("list")}><List size={19} /></button>
              </div>
            </div>
          </div>
          <div className="unv-tabs" role="group" aria-label="Browse content types">
            {([
              ["", "All"], ["movie", "Movies"], ["series", "TV Series"]
            ] as const).map(([value, label]) =>
              <button key={label} className={!preset && kind === value ? "is-active" : ""}
                aria-pressed={!preset && kind === value}
                onClick={() => pickKind(value)}>{label}</button>)}
            <button className={preset === "animation" ? "is-active" : ""}
              aria-pressed={preset === "animation"} onClick={() => {
                pickKind(""); setPreset("animation");
              }}>Anime &amp; Animation</button>
            <button className={preset === "wrestling" ? "is-active" : ""}
              aria-pressed={preset === "wrestling"} onClick={() => {
                pickKind(""); setPreset("wrestling");
              }}>Wrestling</button>
          </div>
          <div className={"unv-source-banner " + (isStale ? "is-warning" : "")}>
            {isStale ? <WifiOff size={16} /> : <CheckCircle2 size={16} />}
            <span>{isOffline ? "Offline catalogue mode is enabled. Run npm run repair:local and restart to enable live PinFlix results." :
              data.stale ? "Live source unavailable. Showing saved PinFlix titles; availability may be limited." :
              "Showing titles indexed from PinFlix. Availability and playback depend on the original source."}
            </span>
            <button onClick={() => setStatusOpen((v) => !v)}>Source status <ChevronDown size={14} /></button>
          </div>
          {statusOpen && <div className="unv-source-details" role="status">
            <strong>{sourceMessage}</strong>
            <p>Last catalog response: {new Date(data.retrievedAt).toLocaleString()}.</p>
            <p>{data.sourceIndex
              ? data.sourceIndex.count + " TV series indexed; " +
                (data.sourceIndex.hasMore ? "more PinFlix pages may be available." : "indexing complete for now.")
              : "Movies and TV shows are loaded from the PinFlix catalog API."}</p>
            <p>PinFlix does not replace missing PinFlix videos with sample media.</p>
          </div>}
          {error && <div className="unv-error" role="alert">{error}
            <button onClick={() => setRevision((r) => r + 1)}>Try again</button>
          </div>}

          <section className={"unv-results unv-results-" + view + (busy ? " is-busy" : "")}
            aria-busy={busy} aria-label="Catalog titles">
            {filtered.map((t) => (
              <button key={t.id} type="button" className="unv-poster-card"
                aria-label={"View " + t.title}
                onClick={() => { setSelectedDetail(null); setDetailError(false); setSelected(t); setSelectedSeason(1); }}>
                <div className="unv-poster">
                  <Artwork src={t.poster} alt={t.title} />
                  <span className="unv-poster-shade" />
                  <span className="unv-kind-badge">{t.kind === "series" ? "TV SERIES" : "MOVIE"}</span>
                  {t.rating && <span className="unv-rating">★ {t.rating}</span>}
                  <span className="unv-play-icon"><Play size={20} fill="currentColor" /></span>
                </div>
                <div className="unv-card-text">
                  <h3>{t.title}</h3>
                  <p>{t.year || "Year unknown"} <span>·</span> {t.category || (t.kind === "series" ? "TV Series" : "Movie")}</p>
                  {t.quality && <span className="unv-format">{t.quality}</span>}
                </div>
                <ArrowRight className="unv-list-arrow" size={18} />
              </button>
            ))}
          </section>
          {!filtered.length && !busy && (
            <div className="unv-empty">
              <Search size={35} /><h3>No matching titles</h3>
              <p>Try a different title, content type, or category.</p>
              <button onClick={() => {
                setPreset(""); setKind(""); setFilters(QuerySchema.parse({ sort: "recent" }));
              }}>Clear filters</button>
            </div>
          )}
          <div className="unv-pagination">
            <button disabled={busy || data.page <= 1}
              onClick={() => setFilter("page", data.page - 1)}><ChevronLeft size={17} /> Previous</button>
            <span>Page <strong>{data.page}</strong>
              {data.total ? " of " + Math.max(1, Math.ceil(data.total / 36)) : ""}
            </span>
            <button disabled={busy || !data.hasNext}
              onClick={() => setFilter("page", data.page + 1)}>Next <ChevronRight size={17} /></button>
          </div>
          <footer className="unv-footer">
            <span className="unv-footer-brand">PIN<span>FLIX</span></span>
            <p>Discover movies and series from PinFlix. Availability depends on the source.</p>
            <button onClick={() => setStatusOpen(true)}><Wifi size={15} /> Source connection status</button>
          </footer>
        </div>
      </div>

      {selected && (
        <div className="unv-dialog-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <section className="unv-dialog" role="dialog" aria-modal="true"
            aria-labelledby="unv-dialog-title">
            <button ref={closeRef} className="unv-dialog-close" aria-label="Close title details"
              onClick={() => setSelected(null)}><X size={20} /></button>
            <div className="unv-dialog-hero">
              <div className="unv-dialog-cover"><Artwork src={currentlySelected?.poster || null} alt={currentlySelected?.title || ""} /></div>
              <div className="unv-dialog-intro">
                <span className="unv-eyebrow">{selected.kind === "series" ? "TV SERIES" : "MOVIE"} · PINFLIX</span>
                <h2 id="unv-dialog-title">{currentlySelected?.title}</h2>
                <div className="unv-dialog-meta">
                  <span>{currentlySelected?.year || "Year unknown"}</span>
                  <span>{currentlySelected?.category || selected.kind}</span>
                  {currentlySelected?.quality && <span>{currentlySelected.quality}</span>}
                  {currentlySelected?.rating && <span>★ {currentlySelected.rating}</span>}
                </div>
                <p>{selectedDetail?.title.synopsis ||
                  "Explore this title on PinFlix. Streaming availability depends on PinFlix."}</p>
                <div className="unv-dialog-actions">
                  <Link href={titleHref(selected) + "?resume=1&season=" + selectedSeason +
                    "&episode=" + (episodeList[0]?.number || 1)}
                    className="unv-dialog-watch" onClick={() => setSelected(null)}>
                    <Play size={17} fill="currentColor" /> Watch now
                  </Link>
                  <Link href={titleHref(selected)} className="unv-dialog-secondary"
                    onClick={() => setSelected(null)}>Full details <ArrowRight size={15} /></Link>
                </div>
              </div>
            </div>
            {selected.kind === "series" && (
              <div className="unv-dialog-episodes">
                <div className="unv-dialog-episode-head">
                  <h3>Seasons &amp; episodes</h3>
                  <label>Season
                    <select value={selectedSeason}
                      onChange={(e) => { setSelectedDetail(null); setDetailError(false); setSelectedSeason(Number(e.target.value)); }}>
                      {(selectedDetail?.title.seasons.length ? selectedDetail.title.seasons :
                        [selectedSeason]).map((season) =>
                        <option key={season} value={season}>Season {season}</option>)}
                    </select>
                  </label>
                </div>
                {!selectedDetail && !detailError && <p>Loading PinFlix episodes...</p>}
                {detailError && <p>Episode information is unavailable. Open the full series page to retry.</p>}
                {episodeList.slice(0, 100).map((episode) => (
                  <Link key={episode.number}
                    href={titleHref(selected) + "?season=" + selectedSeason +
                      "&episode=" + episode.number + "&resume=1"}
                    onClick={() => setSelected(null)}>
                    <span>{String(episode.number).padStart(2, "0")}</span>
                    <strong>{episode.title}</strong><Play size={15} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

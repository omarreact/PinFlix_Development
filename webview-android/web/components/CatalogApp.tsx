"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { UniversalSearch } from "./UniversalSearch";
import { SearchResults } from "./SearchResults";
import { LatestMoviesSlider } from "./LatestMoviesSlider";
import type {
  AdvancedSearchParams,
  CatalogFilter,
  CineplexSearchResultPage,
  VideoSearchResult,
} from "@/lib/cineplex-types";
const VideoDetails = dynamic(
  () => import("./VideoDetails").then((m) => m.VideoDetails),
  { loading: () => null },
);
const AdvancedSearchModal = dynamic(
  () => import("./AdvancedSearchModal").then((m) => m.AdvancedSearchModal),
  { loading: () => null },
);
const DiagnosticsModal = dynamic(
  () => import("./DiagnosticsModal").then((m) => m.DiagnosticsModal),
  { loading: () => null },
);
declare global { interface Window { pinflixBack?: () => boolean; } }
const empty: CineplexSearchResultPage = {
  items: [],
  page: 1,
  totalPages: 1,
  totalFound: 0,
  query: "",
  hasMore: false,
  sourceStatus: "live",
};
export function CatalogApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const key = searchParams.toString();
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<VideoSearchResult | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [status, setStatus] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    window.pinflixBack = () => {
      if (selected) { setSelected(null); return true; }
      if (advanced) { setAdvanced(false); return true; }
      if (status) { setStatus(false); return true; }
      return false;
    };
    return () => { delete window.pinflixBack; };
  }, [selected, advanced, status]);
  const params = useMemo<AdvancedSearchParams>(() => {
    const sp = new URLSearchParams(key);
    const raw = sp.get("type") || "all";
    return {
      q: sp.get("q") || undefined,
      name: sp.get("name") || undefined,
      generic: sp.get("generic") || undefined,
      actors: sp.get("actors") || undefined,
      category: sp.get("category") || undefined,
      years: [...sp.getAll("year[]"), ...sp.getAll("year")],
      type: (["all", "movie", "series", "anime", "wrestling"].includes(raw)
        ? raw
        : "all") as CatalogFilter,
      page: Number(sp.get("page")) || 1,
      sort: sp.get("sort") === "title" ? "title" : "source",
    };
  }, [key]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/cineplex/search/advanced?${key}`, {
          signal: controller.signal,
        });
        const body = await response.json() as CineplexSearchResultPage & { error?: string };
        if (!response.ok)
          throw new Error(body.error || "Catalog could not be loaded");
        if (!controller.signal.aborted) setData(body);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [key, retry]);
  function navigate(next: AdvancedSearchParams) {
    const sp = new URLSearchParams();
    for (const [name, value] of Object.entries(next)) {
      if (value === undefined || value === "" || name === "limit") continue;
      if (name === "years") {
        for (const year of value as (string | number)[])
          sp.append("year[]", String(year));
      } else if (!(name === "page" && value === 1)) sp.set(name, String(value));
    }
    router.push(sp.size ? `/?${sp}` : "/", { scroll: false });
  }
  const search = (q: string) =>
    navigate({ q: q || undefined, type: "all", page: 1 });
  return (
    <div className="flex min-h-screen flex-col bg-[#020617] text-slate-100">
      <a
        href="#catalog"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-violet-400 focus:p-3 focus:text-slate-950"
      >
        Skip to catalog
      </a>
      <Navbar
        onQuickSearch={search}
        onBrowseType={(type) => navigate({ type, page: 1 })}
        onSelectCategory={(category, type) =>
          navigate({ category, type, page: 1 })
        }
        onOpenAdvancedSearch={() => setAdvanced(true)}
      />
      <section className="relative border-b border-white/5 bg-gradient-to-b from-slate-950 via-slate-900/70 to-[#020617] px-5 py-6 sm:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-64 max-w-4xl rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 blur-3xl" />
        <LatestMoviesSlider onSelectMovie={setSelected} onBrowseMovies={() => {
          navigate({ type: "movie", page: 1 });
          document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
        }} />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-300">
            <span
              className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-slate-400" : data.sourceStatus === "live" ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            {error
              ? "Catalog unavailable"
              : loading
                ? "Connecting to the catalog"
                : data.sourceStatus === "live"
                  ? "Live CineplexBD catalog"
                  : "Saved CineplexBD catalog"}
          </p>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            One search.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-purple-400 bg-clip-text text-transparent">
              A world to watch.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-400">
            Discover movies, TV series, anime, documentaries and wrestling from
            the CineplexBD catalog.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <UniversalSearch
              key={params.q || params.name || ""}
              initialQuery={params.q || params.name || ""}
              onSearchSubmit={search}
              onSelectResult={setSelected}
              onOpenAdvanced={() => setAdvanced(true)}
            />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["Bangla Dubbed", "Hindi Dubbed", "Anime", "4K Movies"].map(
              (category) => (
                <button
                  key={category}
                  onClick={() => navigate({ category, type: "movie", page: 1 })}
                  className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-300 transition hover:border-violet-400/40"
                >
                  {category}
                </button>
              ),
            )}
          </div>
          <button
            onClick={() => setStatus(true)}
            className="mt-6 inline-flex items-center gap-2 text-[11px] text-slate-500 hover:text-violet-300"
          >
            <Activity size={13} />
            Source connection status
          </button>
        </div>
      </section>
      <main
        id="catalog"
        className="mx-auto w-full max-w-7xl flex-1 scroll-mt-24 px-4 py-10 sm:px-6"
      >
        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-amber-400/20 p-8 text-center"
          >
            <p className="text-sm text-amber-200">{error}</p>
            <button
              onClick={() => setRetry((x) => x + 1)}
              className="mt-4 rounded-xl bg-slate-800 px-5 py-2 text-sm"
            >
              Retry
            </button>
            <button
              onClick={() => search("")}
              className="ml-3 text-xs text-violet-300 underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <SearchResults
            data={data}
            isLoading={loading}
            onPageChange={(page) => {
              navigate({ ...params, page });
              document
                .getElementById("catalog")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            onSelectResult={setSelected}
            activeTypeFilter={params.type || "all"}
            onTypeFilterChange={(type) =>
              navigate({ ...params, type, page: 1, category: undefined })
            }
            selectedCategory={params.category}
            onClearCategory={() =>
              navigate({ ...params, category: undefined, page: 1 })
            }
            sort={params.sort || "source"}
            onSortChange={(sort) => navigate({ ...params, sort, page: 1 })}
          />
        )}
      </main>
      <Footer onCheckHealth={() => setStatus(true)} />
      {selected && (
        <VideoDetails
          key={`${selected.type}:${selected.id}`}
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {advanced && (
        <AdvancedSearchModal
          initial={params}
          onClose={() => setAdvanced(false)}
          onApply={navigate}
        />
      )}
      {status && <DiagnosticsModal onClose={() => setStatus(false)} />}
    </div>
  );
}

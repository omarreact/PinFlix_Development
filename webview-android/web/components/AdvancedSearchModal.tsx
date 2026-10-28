"use client";
import { useState } from "react";
import type { AdvancedSearchParams } from "@/lib/cineplex-types";
import {
  CINEPLEX_MOVIE_CATEGORIES,
  CINEPLEX_TV_CATEGORIES,
} from "@/lib/cineplex-categories";
import { Dialog } from "./Dialog";
export function AdvancedSearchModal({
  onClose,
  onApply,
  initial = {},
}: {
  onClose: () => void;
  onApply: (params: AdvancedSearchParams) => void;
  initial?: AdvancedSearchParams;
}) {
  const [name, setName] = useState(initial.name || initial.q || "");
  const [generic, setGeneric] = useState(initial.generic || "");
  const [actors, setActors] = useState(initial.actors || "");
  const [type, setType] = useState(initial.type || "all");
  const [category, setCategory] = useState(initial.category || "");
  const [years, setYears] = useState((initial.years || []).map(String));
  const categories = [
    ...new Set(
      (type === "movie"
        ? CINEPLEX_MOVIE_CATEGORIES
        : type === "series"
          ? CINEPLEX_TV_CATEGORIES
          : [...CINEPLEX_MOVIE_CATEGORIES, ...CINEPLEX_TV_CATEGORIES]
      ).map((c) => c.categoryParam),
    ),
  ];
  return (
    <Dialog title="Advanced search" onClose={onClose}>
      <form
        className="space-y-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          onApply({
            name: name.trim() || undefined,
            generic: generic.trim() || undefined,
            actors: actors.trim() || undefined,
            type,
            category: category || undefined,
            years,
            page: 1,
          });
          onClose();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              id: "title",
              label: "Title or keyword",
              value: name,
              set: setName,
            },
            { id: "genre", label: "Genre", value: generic, set: setGeneric },
            { id: "actors", label: "Actor", value: actors, set: setActors },
          ].map((field) => (
            <label key={field.id} className="space-y-2 text-xs text-slate-300">
              <span>{field.label}</span>
              <input
                aria-label={field.label}
                value={field.value}
                maxLength={160}
                onChange={(e) => field.set(e.target.value)}
                className="block w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
              />
            </label>
          ))}
          <label className="space-y-2 text-xs text-slate-300">
            <span>Content type</span>
            <select
              aria-label="Content type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as typeof type);
                setCategory("");
              }}
              className="block w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
            >
              <option value="all">All content</option>
              <option value="movie">Movies</option>
              <option value="series">TV Series</option>
              <option value="anime">Anime & Animation</option>
              <option value="wrestling">Wrestling</option>
            </select>
          </label>
        </div>
        <label className="block space-y-2 text-xs text-slate-300">
          <span>Category</span>
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="block w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-3 text-xs text-slate-300">
            Release years (select up to 30)
          </legend>
          <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-3 sm:grid-cols-5">
            {Array.from({ length: new Date().getFullYear() - 1887 }, (_, i) =>
              String(new Date().getFullYear() - i),
            ).map((year) => (
              <label
                key={year}
                className="flex items-center gap-2 p-1 text-xs text-slate-300"
              >
                <input
                  type="checkbox"
                  value={year}
                  checked={years.includes(year)}
                  disabled={!years.includes(year) && years.length >= 30}
                  onChange={() =>
                    setYears((old) =>
                      old.includes(year)
                        ? old.filter((y) => y !== year)
                        : [...old, year],
                    )
                  }
                  className="accent-violet-400"
                />
                {year}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs leading-relaxed text-slate-400">
          All catalogue filters use CineplexBD directly from this Android device.
          A reachable source connection is required.
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => {
              setName("");
              setGeneric("");
              setActors("");
              setType("all");
              setCategory("");
              setYears([]);
            }}
            className="rounded-xl bg-white/5 px-4 py-3 text-xs"
          >
            Reset
          </button>
          <button
            type="submit"
            className="rounded-xl bg-violet-500 px-6 py-3 text-xs font-bold text-slate-950 hover:bg-violet-400"
          >
            Apply filters
          </button>
        </div>
      </form>
    </Dialog>
  );
}

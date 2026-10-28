"use client";
import { useState } from "react";
import type { CineplexSeason, CineplexEpisode } from "@/lib/cineplex-types";
export function SeasonsEpisodes({
  seasons,
  seriesTitle,
  onPlayEpisode,
  activeEpisodeId,
}: {
  seasons: CineplexSeason[];
  seriesTitle: string;
  onPlayEpisode: (episode: CineplexEpisode) => void;
  activeEpisodeId?: string;
}) {
  const [number, setNumber] = useState(seasons[0]?.seasonNumber || 1);
  const current = seasons.find((s) => s.seasonNumber === number) || seasons[0];
  return (
    <section aria-label={`${seriesTitle} episodes`} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">Seasons & episodes</h3>
        {current && (
          <select
            aria-label="Season"
            value={current.seasonNumber}
            onChange={(e) => setNumber(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-xs"
          >
            {seasons.map((s) => (
              <option key={s.seasonNumber} value={s.seasonNumber}>
                {s.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {current ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {current.episodes.map((ep) => (
            <button
              key={ep.id}
              disabled={!ep.detailUrl && !ep.isPlayable}
              onClick={() => onPlayEpisode(ep)}
              aria-pressed={activeEpisodeId === ep.id}
              className={`rounded-xl border p-4 text-left disabled:opacity-50 ${activeEpisodeId === ep.id ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-slate-950/50 hover:border-violet-400/40"}`}
            >
              <span className="text-xs font-mono text-violet-300">
                S{current.seasonNumber} E{ep.episodeNumber}
              </span>
              <span className="mt-2 block text-sm font-semibold">
                {ep.title}
              </span>
              <span className="mt-2 block text-xs text-slate-500">
                {ep.isPlayable
                  ? "Stream link available"
                  : ep.detailUrl
                    ? "Check episode playback"
                    : "No stream listed"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400">
          The source has not provided an episode list. Reconnect to the live
          source to check availability.
        </p>
      )}
    </section>
  );
}

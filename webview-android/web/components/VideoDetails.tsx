"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import type {
  VideoSearchResult,
  CineplexMediaDetails,
  CineplexEpisode,
  PlayableStream,
} from "@/lib/cineplex-types";
import { PinFlixPlayer } from "./PinFlixPlayer";
import { SeasonsEpisodes } from "./SeasonsEpisodesDirect";
import { Dialog } from "./Dialog";
import { Poster } from "./Poster";
export function VideoDetails({
  item,
  onClose,
}: {
  item: VideoSearchResult;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<CineplexMediaDetails>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<PlayableStream[] | null>(null);
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState("");
  const [episode, setEpisode] = useState<CineplexEpisode>();
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const player = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cineplex/video/${item.id}?type=${item.type}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as CineplexMediaDetails & { error?: string };
        if (!response.ok) throw new Error(data.error || "Details unavailable");
        return data;
      })
      .then((data) => {
        if (!controller.signal.aborted) setDetails(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [item.id, item.type, retry]);
  async function play(ep?: CineplexEpisode) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setEpisode(ep);
    setPlayLoading(true);
    setPlayError("");
    setStreams(null);
    const sp = new URLSearchParams({ id: item.id, type: item.type });
    if (ep) sp.set("episode", ep.id);
    try {
      const response = await fetch(`/api/cineplex/playback?${sp}`, {
        signal: controller.signal,
      });
      const data = await response.json() as { streams: PlayableStream[]; notice?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Playback unavailable");
      if (!controller.signal.aborted) {
        if (!data.streams?.length)
          setPlayError(data.notice || "No stream is available.");
        else setStreams(data.streams);
      }
    } catch (e) {
      if (!controller.signal.aborted) setPlayError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) {
        setPlayLoading(false);
        player.current?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }
  const data = details || item;
  return (
    <Dialog title={item.title} onClose={onClose} wide>
      <div className="space-y-6 p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row">
          <Poster
            src={details?.sourceStatus === "snapshot_fallback" && data.poster?.includes("cineplexbd.net/") ? undefined : data.poster}
            title={data.title}
            className="mx-auto aspect-[2/3] w-40 shrink-0 rounded-2xl sm:mx-0 sm:w-44"
          />
          <div className="flex-1">
            <span className="inline-block rounded-full bg-violet-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              {item.type === "series" ? "TV Series" : "Movie"}
            </span>
            <h3 className="mt-3 text-2xl font-extrabold sm:text-3xl">
              {data.title}
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              {data.year || "Year unknown"} · {data.category}
              {item.resolution ? ` · ${item.resolution}` : ""}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              {loading
                ? "Loading source details…"
                : details?.synopsis ||
                  "No synopsis was provided by the source."}
            </p>
            {details?.notice && (
              <p
                role="status"
                className="mt-4 text-xs leading-relaxed text-amber-200"
              >
                {details.notice}
              </p>
            )}
            {error && (
              <div role="alert" className="mt-4 text-xs text-amber-300">
                {error}
                <button
                  onClick={() => {
                    setError("");
                    setLoading(true);
                    setRetry((x) => x + 1);
                  }}
                  className="ml-3 underline"
                >
                  Retry details
                </button>
              </div>
            )}
            <button
              disabled={loading || playLoading}
              onClick={() => void play()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-xs font-bold text-slate-950 hover:bg-violet-400 disabled:opacity-50"
            >
              {playLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}{" "}
              {item.type === "series" ? "Check series playback" : "Watch movie"}
            </button>
          </div>
        </div>
        <div ref={player} className="scroll-mt-20">
          {playLoading && (
            <p
              role="status"
              className="flex items-center gap-2 p-5 text-sm text-slate-400"
            >
              <Loader2 size={16} className="animate-spin" />
              Checking source streams…
            </p>
          )}
          {playError && (
            <div
              role="alert"
              className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-5"
            >
              <p className="text-sm font-bold text-amber-200">
                Playback unavailable
              </p>
              <p className="mt-2 text-xs text-slate-400">{playError}</p>
              <button
                onClick={() => void play(episode)}
                className="mt-3 text-xs text-violet-300 underline"
              >
                Retry playback
              </button>
            </div>
          )}
          {streams && (
            <PinFlixPlayer
              key={episode?.id || item.id}
              streams={streams}
              title={episode ? `${item.title} · ${episode.title}` : item.title}
              poster={data.poster}
            />
          )}
        </div>
        {item.type === "series" && !loading && (
          <SeasonsEpisodes
            seasons={details?.seasons || []}
            seriesTitle={item.title}
            seriesId={item.id}
            onPlayEpisode={(ep) => void play(ep)}
            activeEpisodeId={episode?.id}
          />
        )}
      </div>
    </Dialog>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  PictureInPicture2,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import type { PlayableStream } from "@/lib/cineplex-types";
interface PlaybackPosition {
  time: number;
  playing: boolean;
  muted: boolean;
  rate: number;
}
function StreamVideo({
  stream,
  title,
  poster,
  onFailure,
  videoRef,
  resumeRef,
}: {
  stream: PlayableStream;
  title: string;
  poster?: string;
  onFailure: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  resumeRef: React.RefObject<PlaybackPosition>;
}) {
  const [buffering, setBuffering] = useState(true);
  useEffect(() => {
    const video = videoRef.current!;
    let disposed = false;
    let cleanup = () => {};
    let failed = false;
    let timer: ReturnType<typeof setTimeout>;
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      clearTimeout(timer);
      onFailure();
    };
    const wait = () => {
      setBuffering(true);
      clearTimeout(timer);
      timer = setTimeout(fail, 20000);
    };
    const ready = () => {
      clearTimeout(timer);
      setBuffering(false);
    };
    video.addEventListener("waiting", wait);
    video.addEventListener("playing", ready);
    video.addEventListener("canplay", ready);
    video.addEventListener("loadedmetadata", ready);
    video.addEventListener("pause", ready);
    video.addEventListener("error", fail);
    wait();
    try {
      const volume = Number(localStorage.getItem("pinflix:volume:v1") ?? 1);
      if (Number.isFinite(volume))
        video.volume = Math.max(0, Math.min(1, volume));
    } catch {}
    async function setup() {
      if (stream.format === "hls") {
        const { default: Hls } = await import("hls.js");
        if (disposed) return;
        // Prefer the MSE engine: some browsers claim native HLS support but
        // cannot demux MPEG-TS segments. Native HLS is the fallback without MSE.
        if (Hls.isSupported()) {
          const hls = new Hls();
          cleanup = () => hls.destroy();
          hls.loadSource(stream.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && !disposed) {
              console.warn("PinFlix HLS:", data.details);
              fail();
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = stream.url;
          video.load();
        } else {
          fail();
        }
      } else if (stream.format === "dash") {
        const dash = await import("dashjs");
        if (disposed) return;
        const player = dash.MediaPlayer().create();
        cleanup = () => player.reset();
        player.initialize(video, stream.url, false);
        player.on(dash.MediaPlayer.events.ERROR, () => {
          if (!disposed) fail();
        });
      } else {
        video.src = stream.url;
        video.load();
      }
    }
    setup().catch((error) => {
      if (!disposed) { console.warn("PinFlix player setup:", error instanceof Error ? error.message : "Unknown error"); fail(); }
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      video.removeEventListener("waiting", wait);
      video.removeEventListener("playing", ready);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("loadedmetadata", ready);
      video.removeEventListener("pause", ready);
      video.removeEventListener("error", fail);
      cleanup();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [stream, videoRef, onFailure]);
  // Native controls remain usable on touch devices, by keyboard and with assistive tech.
  return (
    <div className="relative">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        poster={
          poster
            ? `/api/cineplex/image?url=${encodeURIComponent(poster)}`
            : undefined
        }
        className="aspect-video max-h-[65dvh] w-full bg-black object-contain"
        onTimeUpdate={(event) => {
          resumeRef.current.time = event.currentTarget.currentTime;
        }}
        onLoadedMetadata={(event) => {
          if (
            resumeRef.current.time > 0 &&
            resumeRef.current.time < event.currentTarget.duration
          )
            event.currentTarget.currentTime = resumeRef.current.time;
          event.currentTarget.muted = resumeRef.current.muted;
          event.currentTarget.playbackRate = resumeRef.current.rate;
          if (resumeRef.current.playing)
            void event.currentTarget.play().catch(() => {
              // Browser autoplay policy may require another press of native Play.
            });
        }}
        onVolumeChange={(event) => {
          try {
            localStorage.setItem(
              "pinflix:volume:v1",
              String(event.currentTarget.volume),
            );
          } catch {}
        }}
      />
      {buffering && (
        <p role="status" className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/80 px-3 py-2 text-xs text-white">
          Loading video…
        </p>
      )}
    </div>
  );
}
export function PinFlixPlayer({
  streams,
  title,
  poster,
}: {
  streams: PlayableStream[];
  title: string;
  poster?: string;
}) {
  const [index, setIndex] = useState(() => {
    try {
      const quality = localStorage.getItem("pinflix:quality:v1");
      const found = streams.findIndex((s) => s.quality === quality);
      return Math.max(0, found);
    } catch {
      return 0;
    }
  });
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<PlaybackPosition>({ time: 0, playing: false, muted: false, rate: 1 });
  const rememberPlayback = () => {
    const current = video.current;
    if (!current) return;
    resumeRef.current = {
      time: current.currentTime,
      playing: !current.paused && !current.ended,
      muted: current.muted,
      rate: current.playbackRate,
    };
  };
  const failureRef = useRef<() => void>(() => {});
  useEffect(() => {
    failureRef.current = () => {
      rememberPlayback();
      if (index < streams.length - 1) {
        setIndex(index + 1);
        setNotice("Trying the next source stream…");
      } else setFailed(true);
    };
  }, [index, streams.length]);
  // Stable callback avoids reloading the player on unrelated UI updates.
  const [onFailure] = useState(() => () => failureRef.current());
  const stream = streams[index];
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (box.current?.requestFullscreen) await box.current.requestFullscreen();
      else
        (
          video.current as HTMLVideoElement & {
            webkitEnterFullscreen?: () => void;
          }
        )?.webkitEnterFullscreen?.();
      try {
        await (
          screen.orientation as ScreenOrientation & {
            lock?: (orientation: string) => Promise<void>;
          }
        ).lock?.("landscape");
      } catch {}
    } catch {
      setNotice("Fullscreen is not available in this browser.");
    }
  };
  return (
    <div
      ref={box}
      className="overflow-hidden rounded-2xl border border-white/10 bg-black"
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("button,input,select,video"))
          return;
        if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          void fullscreen();
        }
      }}
    >
      {failed || !stream ? (
        <div
          role="status"
          className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center"
        >
          <AlertCircle className="text-amber-300" />
          <h3 className="font-bold">Playback unavailable</h3>
          <p className="max-w-md text-xs leading-relaxed text-slate-400">
            The source stream could not be loaded. It may be offline, restricted
            on this network, or use a codec this browser cannot play.
          </p>
          <button
            onClick={() => {
              setFailed(false);
              setNotice("");
              setIndex(0);
              setAttempt((n) => n + 1);
            }}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs"
          >
            <RotateCcw size={14} />
            Retry playback
          </button>
        </div>
      ) : (
        <StreamVideo
          key={`${index}:${attempt}`}
          stream={stream}
          title={title}
          poster={poster}
          onFailure={onFailure}
          videoRef={video}
          resumeRef={resumeRef}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-xs text-slate-400">
        <span className="max-w-60 truncate">{title}</span>
        <div className="flex items-center gap-3">
          {streams.length > 1 && (
            <select
              aria-label="Playback quality"
              value={index}
              onChange={(e) => {
                const next = Number(e.target.value);
                rememberPlayback();
                setFailed(false);
                setNotice("");
                setIndex(next);
                try {
                  localStorage.setItem(
                    "pinflix:quality:v1",
                    streams[next].quality,
                  );
                } catch {}
              }}
              className="max-w-44 rounded-lg border border-white/10 bg-slate-900 p-2"
            >
              {streams.map((s, i) => (
                <option key={i} value={i}>
                  {s.label} · {s.format.toUpperCase()}
                </option>
              ))}
            </select>
          )}
          {!failed && (
            <>
              <button
                aria-label="Picture in picture"
                onClick={async () => {
                  try {
                    if (document.pictureInPictureElement)
                      await document.exitPictureInPicture();
                    else await video.current?.requestPictureInPicture();
                  } catch {
                    setNotice(
                      "Picture-in-picture is unavailable until the video starts or is unsupported by this browser.",
                    );
                  }
                }}
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <PictureInPicture2 size={18} />
              </button>
              <button
                aria-label="Fullscreen"
                onClick={() => void fullscreen()}
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <Maximize2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>
      {notice && (
        <p
          role="status"
          className="bg-slate-950 px-4 pb-3 text-xs text-slate-400"
        >
          {notice}
        </p>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { CineplexHealthStatus } from "@/lib/cineplex-types";
import { Dialog } from "./Dialog";
import { Loader2 } from "lucide-react";
export function DiagnosticsModal({ onClose }: { onClose: () => void }) {
  const [health, setHealth] = useState<CineplexHealthStatus>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cineplex/health", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to check the source.");
        return res.json() as Promise<CineplexHealthStatus>;
      })
      .then((data) => {
        if (!controller.signal.aborted) setHealth(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <Dialog title="Source connection status" onClose={onClose}>
      <div className="space-y-5 p-6">
        {!health && !error ? (
          <div
            role="status"
            className="flex items-center gap-3 text-sm text-slate-400"
          >
            <Loader2 className="animate-spin" size={18} />
            Checking the live search endpoint…
          </div>
        ) : null}
        {error && (
          <p role="alert" className="text-amber-300">
            {error}
          </p>
        )}
        {health && (
          <>
            <p
              className={`text-lg font-bold ${health.directAccessible ? "text-emerald-300" : "text-amber-300"}`}
            >
              {health.directAccessible
                ? "Live source connected"
                : "Saved catalog available"}
            </p>
            <p className="text-sm leading-relaxed text-slate-300">
              {health.notes}
            </p>
            <dl className="grid grid-cols-2 gap-4 rounded-xl bg-slate-950 p-4 text-sm">
              <dt className="text-slate-400">Saved titles</dt>
              <dd>{health.snapshotItems}</dd>
              <dt className="text-slate-400">Source-reported total</dt>
              <dd>
                {health.reportedCatalogItems.toLocaleString()} (from uploaded
                page)
              </dd>
              <dt className="text-slate-400">Connection check</dt>
              <dd>{health.latencyMs} ms</dd>
              <dt className="text-slate-400">Checked at</dt>
              <dd>{new Date(health.lastChecked).toLocaleTimeString()}</dd>
            </dl>
            <p className="text-xs leading-relaxed text-slate-500">
              A search connection does not confirm that every video is playable.
              Each title is checked when opened.
            </p>
          </>
        )}
        <button
          onClick={() => {
            setHealth(undefined);
            setError("");
            setAttempt((x) => x + 1);
          }}
          className="rounded-xl bg-violet-500 px-5 py-3 text-xs font-bold text-slate-950"
        >
          Check again
        </button>
      </div>
    </Dialog>
  );
}

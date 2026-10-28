"use client";
export function Footer({ onCheckHealth }: { onCheckHealth: () => void }) {
  return (
    <footer className="mt-12 border-t border-white/10 bg-slate-950 px-5 py-10 text-xs text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
        <div>
          <p className="font-bold tracking-widest text-slate-300">PINFLIX</p>
          <p className="mt-2">
            Discover movies and series from CineplexBD. Availability depends on
            the source.
          </p>
        </div>
        <button
          onClick={onCheckHealth}
          className="self-start text-violet-300 hover:underline"
        >
          Source connection status
        </button>
      </div>
    </footer>
  );
}

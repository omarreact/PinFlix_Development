"use client";
import { useState } from "react";
export function Poster({
  src,
  title,
  className = "",
}: {
  src?: string;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const hue = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 70 + 240;
  return (
    <div className={`relative overflow-hidden bg-slate-800 ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center" style={{background:`linear-gradient(145deg, hsl(${hue} 32% 23%), #0c1021 85%)`}}>
        <span className="text-6xl font-black text-white/15">{title.charAt(0).toUpperCase()}</span>
        <span className="line-clamp-3 text-sm font-semibold text-white/60">{title}</span>
        {failed === src && <span className="text-[9px] uppercase tracking-widest text-white/35">Poster unavailable</span>}
      </div>
      {src && failed !== src && (
        // Use the bounded image adapter for HTTP source posters on HTTPS pages.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/cineplex/image?url=${encodeURIComponent(src)}`}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

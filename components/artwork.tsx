"use client";
import { useState } from "react";
import { Film } from "lucide-react";
import assets from "@/data/artwork.json";
export function artworkUrl(src: string | null) {
  if (!src) return null;
  if (/^\/artwork\/[a-zA-Z0-9._-]+$/.test(src)) return src;
  try {
    const u = new URL(src);
    if (
      u.hostname !== "cineplexbd.net" ||
      u.port ||
      !["http:", "https:"].includes(u.protocol) ||
      !/^\/uploads\/[^?#]+\.(?:png|jpg|jpeg|webp)$/i.test(u.pathname)
    ) return null;
    const local = (assets as Record<string, string>)[src];
    return local || "/api/artwork/?url=" + encodeURIComponent(src);
  } catch {
    return null;
  }
}
export function Artwork({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const url = artworkUrl(src);
  return url && failedSource !== url ? (
    <img
      src={url}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      style={{ opacity: loadedSource === url ? undefined : 0 }}
      onLoad={() => setLoadedSource(url)}
      onError={() => setFailedSource(url)}
    />
  ) : (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt || undefined}
      className={`art-fallback ${className}`}
    >
      <Film size={32} strokeWidth={1} />
      <span>{alt || "PinFlix"}</span>
    </div>
  );
}

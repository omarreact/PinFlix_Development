import type { Title, Category } from "../model";
import { ORIGIN, categoriesFromHtml, dedupe, seriesMoreFromJson, titlesFromHtml } from "./normalize";
import { boundedText, cached, html, safeFetch } from "./http";

/**
 * CineplexBD's /tvs.php renders the first 24 series, then its own browser code
 * requests tvs_more.php?offset=24&limit=24. Crawl those native pages in small
 * on-demand batches, never hardcode a list of shows or external providers.
 */
const PAGE_SIZE = 24;
const BATCH_PAGES = 6;
const MAX_PAGES = 500;
const RETRY_MS = 60_000;
const BATCH_COOLDOWN_MS = 1_500;

const indexed = new Map<string, Title>();
let categories: Category[] = [];
let initialized = false;
let nextOffset = PAGE_SIZE;
let pageCount = 0;
let finished = false;
let retryAt = 0;
let lastBatchAt = 0;
let inFlight: Promise<void> | undefined;

export function seriesBatchOffsets(start: number, count = BATCH_PAGES): number[] {
  return Array.from({ length: count }, (_, i) => start + i * PAGE_SIZE);
}

export function seriesPageIsFinal(count: number): boolean {
  return count < PAGE_SIZE;
}

async function expand(): Promise<void> {
  if (!initialized) {
    try {
      const first = await html("/tvs.php");
      categories = categoriesFromHtml(first).filter((c) => c.kind === "series");
      for (const item of titlesFromHtml(first, "series")) indexed.set(item.id, item);
      initialized = true;
      if (indexed.size < PAGE_SIZE) {
        // A genuinely short source page marks the end of this dataset.
        finished = true;
        return;
      }
    } catch {
      retryAt = Date.now() + RETRY_MS;
      return;
    }
  }
  const offsets = seriesBatchOffsets(nextOffset, BATCH_PAGES);
  const outcomes = await Promise.allSettled(offsets.map(async (offset) => {
    const path = "/tvs_more.php?" +
      new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
    const body = await cached("tvs-more:" + offset, 180_000, async () =>
      boundedText(await safeFetch(ORIGIN + path)),
    );
    return seriesMoreFromJson(JSON.parse(body));
  }));
  for (let i = 0; i < outcomes.length; i++) {
    const response = outcomes[i];
    if (response.status === "rejected") {
      retryAt = Date.now() + RETRY_MS;
      break; // retry this offset; don't skip missing provider pages
    }
    for (const item of response.value) indexed.set(item.id, item);
    nextOffset += PAGE_SIZE;
    pageCount++;
    if (seriesPageIsFinal(response.value.length)) {
      finished = true;
      break;
    }
    if (pageCount >= MAX_PAGES) {
      // Prevent unlimited upstream crawling on malformed/infinite endpoints.
      retryAt = Date.now() + RETRY_MS;
      break;
    }
  }
}

export type SeriesLibrarySnapshot = {
  items: Title[];
  categories: Category[];
  hasMore: boolean;
  paused: boolean;
  count: number;
};

export async function seriesLibrary(): Promise<SeriesLibrarySnapshot> {
  const now = Date.now();
  if (!finished && now >= retryAt && (now - lastBatchAt >= BATCH_COOLDOWN_MS)) {
    if (!inFlight) {
      lastBatchAt = now;
      inFlight = expand().finally(() => { inFlight = undefined; });
    }
    await inFlight;
  } else if (inFlight) {
    await inFlight;
  }
  return {
    items: dedupe([...indexed.values()]),
    categories,
    count: indexed.size,
    hasMore: !finished,
    paused: retryAt > Date.now(),
  };
}

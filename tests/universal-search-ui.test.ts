import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversalSearch } from "../components/universal-search";
import { QuerySchema } from "../lib/catalogue-query";
import { TitleSchema, type Catalogue } from "../lib/model";

const movie = TitleSchema.parse({
  id: "movie-40571", providerId: "40571", kind: "movie",
  title: "Reference Movie", poster: null, year: 2024,
  category: "English", mature: false
});
const series = TitleSchema.parse({
  id: "series-10527", providerId: "10527", kind: "series",
  title: "Reference TV Series", poster: null, year: 2021,
  category: "English Series", mature: false,
  seasons: [1, 2]
});
const example: Catalogue = {
  items: [movie, series],
  categories: [
    { kind: "movie", name: "English", mature: false },
    { kind: "movie", name: "4K Movies", mature: false },
    { kind: "series", name: "English Series", mature: false },
    { kind: "series", name: "WWE Wrestling", mature: false }
  ],
  years: [2024, 2021],
  page: 1,
  hasNext: false,
  stale: false,
  retrievedAt: new Date("2026-10-26T00:00:00Z").toISOString(),
  total: 2
};

test("universal-search layout renders the source UI discovery controls", () => {
  const html = renderToStaticMarkup(createElement(UniversalSearch, {
    initial: example,
    initialFilters: QuerySchema.parse({ sort: "recent" }),
    initialKind: ""
  }));
  for (const required of [
    "One search.", "A world to watch.", "Search the catalog",
    "Explore the catalog", "All titles", "Movies", "TV Series",
    "Anime &amp; Animation", "Wrestling", "Sort titles",
    "Grid view", "Title list view", "Source connection status",
    "Reference Movie", "Reference TV Series",
    "English Series", "4K Movies", "WWE Wrestling"
  ]) {
    assert.ok(html.includes(required), "Missing explorer UI control: " + required);
  }
  assert.match(html, /aria-label="PinFlix category navigation"/);
  assert.match(html, /aria-label="Catalog titles"/);
  assert.doesNotMatch(html, /CineplexBD/);
  assert.match(html,/Made by PINCODE IT/);
  assert.doesNotMatch(html, /(?:href|src)="https?:\/\/(?!cineplexbd\.net)/);
});

test("universal-search layout reports true offline mode instead of live data", () => {
  const html = renderToStaticMarkup(createElement(UniversalSearch, {
    initial: { ...example, offlineMode: true, stale: true },
    initialFilters: QuerySchema.parse({}),
    initialKind: "series"
  }));
  assert.ok(html.includes("Offline catalogue mode is enabled"));
  assert.ok(html.includes("npm run repair:local"));
});

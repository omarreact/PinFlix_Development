import test from "node:test";
import assert from "node:assert/strict";
import { seriesBatchOffsets, seriesPageIsFinal } from "../lib/provider/series-index";
import { categoriesFromHtml, titlesFromHtml, seriesMoreFromJson } from "../lib/provider/normalize";

test("CineplexBD series paging starts after its first 24 HTML cards", () => {
  assert.deepEqual(seriesBatchOffsets(24, 4), [24, 48, 72, 96]);
  assert.deepEqual(seriesBatchOffsets(120, 3), [120, 144, 168]);
  assert.equal(seriesPageIsFinal(24), false);
  assert.equal(seriesPageIsFinal(12), true);
  assert.equal(seriesPageIsFinal(0), true);
});

test("CineplexBD TV category links include shows, anime, documentary and sports", () => {
  const page = [
    '<a href="/tcategory.php?category=English+Series">English Series</a>',
    '<a href="/tcategory.php?category=Web+Series">Web Series</a>',
    '<a href="/tcategory.php?category=Bangla+Drama">Bangla Drama</a>',
    '<a href="/tcategory.php?category=Korean+Series">Korean Series</a>',
    '<a href="/tcategory.php?category=Anime">Anime</a>',
    '<a href="/tcategory.php?category=Documentary">Documentary</a>',
    '<a href="/tcategory.php?category=WWE+Wrestling">WWE Wrestling</a>',
    '<a href="/tcategory.php?category=AEW+Wrestling">AEW Wrestling</a>',
    '<a href="/tcategory.php?category=Web+Series">duplicate Web Series</a>',
    '<a href="https://external.example/tcategory.php?category=Unrelated">Unrelated</a>',
  ].join("");
  const types = categoriesFromHtml(page).filter((t) => t.kind === "series");
  assert.equal(types.length, 8);
  assert.ok(types.some((t) => t.name === "WWE Wrestling"));
  assert.ok(types.some((t) => t.name === "Bangla Drama"));
});

test("the first CineplexBD TV page identifies series_id-based links", () => {
  const doc = '<a href="watch.php?series_id=32614&autoplay=1">' +
    '<img alt="Wedding Agreement_The Series" src="/uploads/sample.jpg">' +
    '<span class="catLabel">Indonesian Series</span><span>2025</span></a>';
  const rows = titlesFromHtml(doc, "series");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "series-32614");
  assert.equal(rows[0].category, "Indonesian Series");
});

test("native lazy-load JSON supports string and numeric IDs without video fixtures", () => {
  const rows = seriesMoreFromJson([
    { id: "32614", title: "Wedding Agreement_The Series", year: "2025", category: "Indonesian Series", poster: "/uploads/sample.jpg" },
    { id: 32613, title: "Santri Pilihan Bunda", year: 2024, category: "Indonesian Series", imdb_rating: 7.2 },
  ]);
  assert.deepEqual(rows.map((t) => t.id), ["series-32614", "series-32613"]);
  assert.equal(rows[0].poster, "http://cineplexbd.net/uploads/sample.jpg");
  assert.equal(rows[1].year, 2024);
  assert.equal(rows[1].rating, "7.2");
});

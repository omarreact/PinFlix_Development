import test from "node:test";
import assert from "node:assert/strict";
import {
  categoriesFromHtml,
  titlesFromHtml,
  searchFromJson,
  sourceFromHtml,
  seriesMoreFromJson,
  imageUrl,
  detailFromHtml,
  dedupe,
} from "../lib/provider/normalize";
import { allowedUrl, publicAddress, cached, requestTimeoutMs } from "../lib/provider/http";
import { providerPlaybackEnabled, mediaProxyEnabled, signedStreamUrl, verifyStreamSignature } from "../lib/provider/stream-auth";
import { applyFilters, resolvePlayback } from "../lib/provider";
import snapshot from "../data/catalogue.json";
import { TitleSchema } from "../lib/model";
test("normalizes native series pagination JSON", () => {
  const [t] = seriesMoreFromJson([
    {
      id: 31392,
      title: "Killer Cakes",
      year: "2024",
      poster: "https://image.tmdb.org/t/p/w500/3SDGvKB0eVfAZaoHGwHDMKwA2as.jpg",
      imdb_rating: "7.0",
      category: "English Shows",
    },
  ]);
  assert.equal(t.id, "series-31392");
  assert.equal(t.year, 2024);
  assert.equal(t.language, "English");
});
test("normalizes actual native search response and preserves editions", () => {
  const items = searchFromJson({
    results: [
      {
        id: 40571,
        title: "Inception",
        category: "Dual Audio",
        poster: "ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg",
        year: "2010",
        resolution: "1080p",
        type: "movie",
      },
      {
        id: 34097,
        title: "Inception",
        category: "4K Movies",
        poster: null,
        year: "2010",
        type: "movie",
      },
    ],
  });
  assert.equal(items[0].id, "movie-40571");
  assert.equal(items[0].year, 2010);
  assert.match(items[0].poster!, /^https:\/\/image.tmdb.org/);
  assert.equal(dedupe([...items, items[0]]).length, 2);
});
test("rejects malformed external JSON", () =>
  assert.throws(() =>
    searchFromJson({
      results: [{ id: "../bad", title: "unsafe", type: "movie" }],
    }),
  ));
test("discovers category paths including nested names, deduplicates menus", () => {
  const h =
    '<a href="/category.php?category=Hindi+Dubbed%2FEnglish+Movies">English Movies</a><a href="/category.php?category=Hindi+Dubbed%2FEnglish+Movies">duplicate</a><a href="/tcategory.php?category=English+Series">Series</a><a href="https://evil.test/category.php?category=Bad">Bad</a>';
  assert.equal(categoriesFromHtml(h).length, 2);
  assert.equal(categoriesFromHtml(h)[0].name, "Hindi Dubbed/English Movies");
});
test("parses actual card structure with year, quality, category and HTML entities", () => {
  const h =
    '<a href="view.php?id=78830"><img src="/uploads/poster.jpg" alt="Echoes &amp; Tomorrow"><span class="catLabel">English</span><span>1080P</span><span>2026</span></a>';
  const [t] = titlesFromHtml(h);
  assert.equal(t.title, "Echoes & Tomorrow");
  assert.equal(t.language, "English");
  assert.equal(t.quality, "1080P");
  assert.equal(t.year, 2026);
});
test("seasons and episodes stay distinct", () => {
  const d = detailFromHtml(
    '<h1>Earth Abides <span>(2024)</span></h1><video poster="https://image.tmdb.org/t/p/w500/a.jpg"></video><span class="meta-cat">English Series</span><select name="season"><option value="1">Season 1</option><option value="2">Season 2</option></select><a class="ep-card" data-ep="2"><img src="https://image.tmdb.org/t/p/w500/e.jpg"><span class="truncate">Earth Abides-S1E2-1080P</span></a>',
    "series-31416",
  );
  assert.deepEqual(d.title.seasons, [1, 2]);
  assert.equal(d.episodes[0].number, 2);
  assert.equal(d.episodes[0].quality, "1080P");
});
test("does not invent playable sources", () => {
  assert.equal(sourceFromHtml("<video></video>"), null);
  assert.equal(
    sourceFromHtml('<video><source src="/movie.mpd"></video>'),
    null,
  );
  assert.equal(
    sourceFromHtml('<video><source src="/hls/sample/master.m3u8"></video>')
      ?.format,
    "hls",
  );
});
test("rejects unsafe destinations, ports, credentials and private addresses", () => {
  for (const url of [
    "http://127.0.0.1/",
    "http://cineplexbd.net.evil.test/",
    "http://cineplexbd.net:8080/",
    "http://u:p@cineplexbd.net/",
    "file:///etc/passwd",
  ])
    assert.throws(() => allowedUrl(url, true));
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fd00::1",
  ])
    assert.equal(publicAddress(ip), false);
  assert.equal(publicAddress("1.1.1.1"), true);
  assert.equal(imageUrl("javascript:alert(1)"), null);
});
test("request cache coalesces simultaneous requests", async () => {
  let count = 0;
  const load = async () => {
    count++;
    return "done";
  };
  const results = await Promise.all([
    cached("test", 1000, load),
    cached("test", 1000, load),
  ]);
  assert.deepEqual(results, ["done", "done"]);
  assert.equal(count, 1);
});
test("year filtering uses real normalized records", () => {
  const titles = TitleSchema.array().parse(snapshot.items);
  const result = applyFilters(titles, { year: 2026, kind: "movie" });
  assert.ok(result.length > 0);
  assert.ok(result.every((t) => t.year === 2026 && t.kind === "movie"));
});
test("playback gate never exposes a source without authorization", async () => {
  const previous = process.env.CINEPLEX_PLAYBACK_AUTHORIZED;
  const previousTest = process.env.PINFLIX_TEST_MEDIA;
  process.env.CINEPLEX_PLAYBACK_AUTHORIZED = "false";
  delete process.env.PINFLIX_TEST_MEDIA;
  try {
    const p = await resolvePlayback("movie-40571");
    assert.equal(p.status, "authorization_required");
    assert.equal(p.url, undefined);
  } finally {
    if (previous === undefined) delete process.env.CINEPLEX_PLAYBACK_AUTHORIZED;
    else process.env.CINEPLEX_PLAYBACK_AUTHORIZED = previous;
    if (previousTest === undefined) delete process.env.PINFLIX_TEST_MEDIA;
    else process.env.PINFLIX_TEST_MEDIA = previousTest;
  }
});
test("test media mode resolves authorized sample video streams", async () => {
  const previous = process.env.PINFLIX_TEST_MEDIA;
  process.env.PINFLIX_TEST_MEDIA = "true";
  try {
    const moviePlayback = await resolvePlayback("movie-77533");
    assert.equal(moviePlayback.status, "ready");
    assert.equal(moviePlayback.format, "mp4");
    assert.match(moviePlayback.url!, /^https:\/\//);

    const seriesPlayback = await resolvePlayback("series-31416", 1, 1);
    assert.equal(seriesPlayback.status, "ready");
    assert.equal(seriesPlayback.format, "hls");
    assert.match(seriesPlayback.url!, /^https:\/\//);
  } finally {
    if (previous === undefined) delete process.env.PINFLIX_TEST_MEDIA;
    else process.env.PINFLIX_TEST_MEDIA = previous;
  }
});

test("search filters exclude unrelated titles while combining year and quality", () => {
  const titles = TitleSchema.array().parse(snapshot.items);
  const title = titles.find((t) => !t.mature && t.year && t.quality)!;
  const unrelated = {
    ...title,
    id: "movie-999999",
    title: "Unrelated film",
    cast: [],
    category: "Other",
    language: "Other",
  };
  const result = applyFilters([title, unrelated], {
    q: "  " + title.title + "  ",
    year: title.year!,
    quality: title.quality?.toLowerCase(),
  });
  assert.deepEqual(
    result.map((t) => t.id),
    [title.id],
  );
});

test("accepts direct-array AJAX search results", () => {
  const [title] = searchFromJson([
    { id: 10527, type: "series", title: "Loki", year: 2021, category: "English Series" },
  ]);
  assert.equal(title.id, "series-10527");
});

test("reads real episode query parameters when ep-card class is absent", () => {
  const d = detailFromHtml(
    '<h1>Loki <span>(2021)</span></h1>' +
    '<select><option value="1">Season 1</option><option value="2">Season 2</option></select>' +
    '<a href="/watch.php?id=10527&season=2&ep=6&autoplay=1#ep-6"><span>Loki [Hindi]-S2E6-1080P</span></a>' +
    '<a href="/watch.php?id=99999&season=2&ep=5"><span>Other title</span></a>',
    "series-10527",
    2,
  );
  assert.deepEqual(d.title.seasons, [1, 2]);
  assert.deepEqual(d.episodes.map((e) => e.number), [6]);
  assert.match(d.episodes[0].title, /S2E6/i);
});

test("provider and relay permissions fail closed when unset", () => {
  const prevPlayback = process.env.CINEPLEX_PLAYBACK_AUTHORIZED;
  const prevProxy = process.env.PINFLIX_MEDIA_PROXY_ENABLED;
  try {
    delete process.env.CINEPLEX_PLAYBACK_AUTHORIZED;
    process.env.PINFLIX_MEDIA_PROXY_ENABLED = "true";
    assert.equal(providerPlaybackEnabled(), false);
    assert.equal(mediaProxyEnabled(), false);
  } finally {
    if (prevPlayback === undefined) delete process.env.CINEPLEX_PLAYBACK_AUTHORIZED;
    else process.env.CINEPLEX_PLAYBACK_AUTHORIZED = prevPlayback;
    if (prevProxy === undefined) delete process.env.PINFLIX_MEDIA_PROXY_ENABLED;
    else process.env.PINFLIX_MEDIA_PROXY_ENABLED = prevProxy;
  }
});

test("proxy signatures bind URL and episode and reject tampering", () => {
  const previous = {
    playback: process.env.CINEPLEX_PLAYBACK_AUTHORIZED,
    proxy: process.env.PINFLIX_MEDIA_PROXY_ENABLED,
    secret: process.env.MEDIA_PROXY_SECRET,
  };
  try {
    process.env.CINEPLEX_PLAYBACK_AUTHORIZED = "true";
    process.env.PINFLIX_MEDIA_PROXY_ENABLED = "true";
    process.env.MEDIA_PROXY_SECRET = "a".repeat(64);
    const url = signedStreamUrl("http://103.136.200.124:8086/video.mp4", "series-10527", 2, 6);
    const q = new URL(url, "https://pinflix.test").searchParams;
    const check = (mediaUrl: string, ep: number, sig = q.get("sig")) =>
      verifyStreamSignature(mediaUrl, "series-10527", 2, ep, q.get("exp"), sig);
    assert.equal(check(q.get("url")!, 6), true);
    assert.equal(check(q.get("url")!, 5), false);
    assert.equal(check("http://103.136.200.124:8086/other.mp4", 6), false);
    assert.equal(check(q.get("url")!, 6, "0".repeat(64)), false);
    assert.equal(verifyStreamSignature(q.get("url")!, "series-10527", 2, 6, String(Date.now() - 10000), q.get("sig")), false);
  } finally {
    if (previous.playback === undefined) delete process.env.CINEPLEX_PLAYBACK_AUTHORIZED;
    else process.env.CINEPLEX_PLAYBACK_AUTHORIZED = previous.playback;
    if (previous.proxy === undefined) delete process.env.PINFLIX_MEDIA_PROXY_ENABLED;
    else process.env.PINFLIX_MEDIA_PROXY_ENABLED = previous.proxy;
    if (previous.secret === undefined) delete process.env.MEDIA_PROXY_SECRET;
    else process.env.MEDIA_PROXY_SECRET = previous.secret;
  }
});

test("bounded timeout uses environment value or safe default", () => {
  const prev = process.env.CINEPLEX_REQUEST_TIMEOUT_MS;
  try {
    process.env.CINEPLEX_REQUEST_TIMEOUT_MS = "8000";
    assert.equal(requestTimeoutMs(), 8000);
    process.env.CINEPLEX_REQUEST_TIMEOUT_MS = "999999";
    assert.equal(requestTimeoutMs(false), 4500);
  } finally {
    if (prev === undefined) delete process.env.CINEPLEX_REQUEST_TIMEOUT_MS;
    else process.env.CINEPLEX_REQUEST_TIMEOUT_MS = prev;
  }
});

package com.pincodeit.pinflix.source;

import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import org.json.JSONArray;
import org.json.JSONObject;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.jsoup.parser.Parser;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpCookie;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ProviderClient {
    static final String BASE = "http://cineplexbd.net";
    private static final String REFERER = "http://cineplexbd.net/";
    private static final Pattern MEDIA_ASSIGNMENT =
        Pattern.compile("\\bvideoSrc\\s*=\\s*['\\\"]([^'\\\"\\r\\n]+)['\\\"]");
    private static final Pattern MEDIA_EXT = Pattern.compile("(?i)\\.(?:m3u8|mp4)$");
    private static final Map<String, List<HttpCookie>> cookies = new HashMap<>();

    private ProviderClient() {}

    public static class Item {
        public final String id;
        public final String kind;
        public final String title;
        public final String image;
        public final String category;
        public final String year;

        public Item(String id, String kind, String title, String image, String category, String year) {
            this.id = id;
            this.kind = kind;
            this.title = title;
            this.image = image;
            this.category = category;
            this.year = year;
        }
    }

    public static class Episode {
        public final int number;
        public final String title;
        public final String image;
        public final String path;

        public Episode(int number, String title, String image, String path) {
            this.number = number;
            this.title = title;
            this.image = image;
            this.path = path;
        }
    }

    public static class Detail {
        public Item item;
        public String description = "";
        public final List<Integer> seasons = new ArrayList<>();
        public final List<Episode> episodes = new ArrayList<>();
        public final List<String> cast = new ArrayList<>();
    }

    public static class Stream {
        public final String url;
        public final boolean hls;
        public final Map<String, String> headers;

        Stream(String url, boolean hls, Map<String, String> headers) {
            this.url = url;
            this.hls = hls;
            this.headers = headers;
        }
    }

    private static String enc(String value) {
        return Uri.encode(value);
    }

    public static String providerId(Item item) {
        return item.id.replaceFirst("^(movie|series)-", "");
    }

    private static boolean allowedApi(Uri url) {
        return url != null &&
            "cineplexbd.net".equalsIgnoreCase(url.getHost()) &&
            ("http".equalsIgnoreCase(url.getScheme()) || "https".equalsIgnoreCase(url.getScheme())) &&
            (url.getPort() == -1 || url.getPort() == 80 || url.getPort() == 443) &&
            url.getUserInfo() == null;
    }

    public static boolean allowedMedia(Uri uri) {
        if (uri == null || uri.getUserInfo() != null) return false;
        if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        int port = uri.getPort();
        if ("cineplexbd.net".equals(host)) return port == -1 || port == 80 || port == 443;
        if ("vod.cineplexbd.net".equals(host)) return port == 8081;
        return "103.136.200.124".equals(host) && (port == 8086 || port == 8081);
    }

    private static boolean allowedImage(Uri uri) {
        if (uri == null || uri.getUserInfo() != null) return false;
        String host = uri.getHost();
        return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) &&
            (uri.getPort() == -1 || uri.getPort() == 80 || uri.getPort() == 443) &&
            ("cineplexbd.net".equalsIgnoreCase(host) || "cds3.cineplexbd.net".equalsIgnoreCase(host));
    }

    private static String resolve(String relative, String base) {
        if (relative == null || relative.isEmpty()) return "";
        try { return URI.create(base).resolve(relative.trim()).toString(); }
        catch (Exception e) { return ""; }
    }

    private static String cookieHeader(String host) {
        synchronized (cookies) {
            List<HttpCookie> list = cookies.get(host);
            if (list == null || list.isEmpty()) return "";
            StringBuilder out = new StringBuilder();
            for (HttpCookie cookie : list) {
                if (cookie.hasExpired()) continue;
                if (out.length() > 0) out.append("; ");
                out.append(cookie.getName()).append("=").append(cookie.getValue());
            }
            return out.toString();
        }
    }

    private static void collectCookies(HttpURLConnection conn, String host) {
        Map<String, List<String>> headers = conn.getHeaderFields();
        for (Map.Entry<String, List<String>> e : headers.entrySet()) {
            if (e.getKey() == null || !"Set-Cookie".equalsIgnoreCase(e.getKey())) continue;
            for (String line : e.getValue()) {
                try {
                    synchronized (cookies) {
                        List<HttpCookie> list = cookies.computeIfAbsent(host, k -> new ArrayList<>());
                        for (HttpCookie cookie : HttpCookie.parse(line)) {
                            list.removeIf(old -> old.getName().equals(cookie.getName()));
                            list.add(cookie);
                        }
                    }
                } catch (IllegalArgumentException ignored) {}
            }
        }
    }

    private static byte[] readBounded(InputStream input, int limit) throws Exception {
        try (InputStream in = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n, total = 0;
            while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > limit) throw new Exception("Provider response exceeded safe size");
                output.write(buffer, 0, n);
            }
            return output.toByteArray();
        }
    }

    private static byte[] get(String url, boolean image, int maxBytes) throws Exception {
        Uri current = Uri.parse(url);
        for (int redirects = 0; redirects < 4; redirects++) {
            if (!(image ? allowedImage(current) : allowedApi(current)))
                throw new Exception("Untrusted catalogue destination");
            HttpURLConnection conn = (HttpURLConnection) new URL(current.toString()).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(16000);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent", "PinFlixSources/1.0 Android");
            conn.setRequestProperty("Accept", image ? "image/*" : "text/html, application/json, */*");
            conn.setRequestProperty("Referer", REFERER);
            String cookie = cookieHeader(current.getHost());
            if (!cookie.isEmpty()) conn.setRequestProperty("Cookie", cookie);
            try {
                int status = conn.getResponseCode();
                collectCookies(conn, current.getHost());
                if (status >= 300 && status < 400) {
                    String location = conn.getHeaderField("Location");
                    if (location == null) throw new Exception("Invalid redirect");
                    current = Uri.parse(resolve(location, current.toString()));
                    continue;
                }
                if (status != 200 && status != 206)
                    throw new Exception("Source returned HTTP " + status);
                return readBounded(conn.getInputStream(), maxBytes);
            } finally {
                conn.disconnect();
            }
        }
        throw new Exception("Too many redirects");
    }

    private static String text(String path) throws Exception {
        return new String(get(BASE + path, false, 1800000), StandardCharsets.UTF_8);
    }

    private static String image(String raw) {
        String url = resolve(raw, BASE + "/");
        if (url.isEmpty()) return "";
        Uri parsed = Uri.parse(url);
        return allowedImage(parsed) ? url : "";
    }

    public static boolean allowedPosterUrl(String url) {
        if(url==null||url.isEmpty())return false;
        try{return allowedImage(Uri.parse(url));}
        catch(Exception ignored){return false;}
    }

    public static Bitmap poster(String url) {
        if (url == null || url.isEmpty()) return null;
        try {
            byte[] b = get(url, true, 3000000);
            // Decode bounds first: do not allocate full-resolution poster bitmaps
            // just to render a small card or hero image.
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(b, 0, b.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
            int sample = 1;
            int longest = Math.max(bounds.outWidth, bounds.outHeight);
            while (longest / sample > 800 && sample < 64) sample *= 2;
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sample;
            options.inPreferredConfig = Bitmap.Config.RGB_565;
            return BitmapFactory.decodeByteArray(b, 0, b.length, options);
        } catch (Exception | OutOfMemoryError ignored) { return null; }
    }

    private static String year(String value) {
        Matcher m = Pattern.compile("\\b(19\\d{2}|20\\d{2})\\b").matcher(value);
        return m.find() ? m.group(1) : "";
    }

    private static boolean mature(String category) {
        return Pattern.compile("(?i)adult|xxx|porn|18\\+|erotic|mature").matcher(category).find();
    }

    private static Item titleFromJson(JSONObject obj, String fallbackKind) {
        String id = obj.optString("id", "").trim();
        String kind = obj.optString("type", fallbackKind).toLowerCase(Locale.ROOT);
        if (!id.matches("[0-9]+") || (!"movie".equals(kind) && !"series".equals(kind))) return null;
        String title = obj.optString("title", "").trim();
        String category = obj.optString("category", "");
        if (title.isEmpty() || mature(category)) return null;
        return new Item(kind + "-" + id, kind, title,
            image(obj.optString("poster", "")), category, year(obj.optString("year", "")));
    }

    private static List<Item> fromHtml(String html) {
        Document doc = Jsoup.parse(html, BASE);
        Map<String, Item> items = new java.util.LinkedHashMap<>();
        for (Element anchor : doc.select("a[href]")) {
            String url = anchor.absUrl("href");
            Uri uri = Uri.parse(url);
            if (!allowedApi(uri)) continue;
            String path = uri.getPath();
            String kind = "/view.php".equals(path) || "/player.php".equals(path) ? "movie" :
                "/watch.php".equals(path) || "/tview.php".equals(path) ? "series" : "";
            if (kind.isEmpty()) continue;
            String id = uri.getQueryParameter("id");
            if (id == null) id = uri.getQueryParameter("series_id");
            if (id == null || !id.matches("[0-9]+")) continue;
            Element poster = anchor.selectFirst("img:not([alt=IMDb])");
            if (poster == null) continue;
            String title = poster.attr("alt").trim();
            if (title.isEmpty() || "Poster".equalsIgnoreCase(title) || title.matches("(?i)E[0-9]+")) continue;
            Element cat = anchor.selectFirst(".catLabel, .meta-cat");
            String category = cat == null ? "" : cat.text().trim();
            if (mature(category)) continue;
            String posterUrl = poster.hasAttr("data-src") ? poster.attr("data-src") : poster.attr("src");
            Item item = new Item(kind + "-" + id, kind, title, image(posterUrl), category, year(anchor.text()));
            items.put(item.id, item);
        }
        return new ArrayList<>(items.values());
    }

    private static List<Item> searchJson(String query) throws Exception {
        JSONObject root = new JSONObject(text("/search_ajax.php?q=" + enc(query) + "&limit=70"));
        JSONArray results = root.optJSONArray("results");
        if (results == null) return new ArrayList<>();
        List<Item> out = new ArrayList<>();
        for (int i = 0; i < results.length(); i++) {
            JSONObject obj = results.optJSONObject(i);
            if (obj == null) continue;
            Item title = titleFromJson(obj, "movie");
            if (title != null) out.add(title);
        }
        return out;
    }

    public static List<Item> catalogue(String kind, int page, String query) throws Exception {
        page = Math.max(1, Math.min(page, 1000));
        if (query != null && !query.trim().isEmpty()) {
            try {
                List<Item> results = searchJson(query.trim());
                if (!results.isEmpty()) return results;
            } catch (Exception ignored) {}
            return fromHtml(text("/search.php?q=" + enc(query.trim()) + "&page=" + page));
        }
        if ("series".equals(kind)) {
            if (page == 1) return fromHtml(text("/tvs.php"));
            JSONArray arr = new JSONArray(text("/tvs_more.php?offset=" + ((page - 1) * 24) + "&limit=24"));
            List<Item> out = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj == null) continue;
                Item item = titleFromJson(obj, "series");
                if (item != null) out.add(item);
            }
            return out;
        }
        return fromHtml(text(page == 1 ? "/" : "/category.php?page=" + page));
    }

    public static List<Item> category(String kind, String name, int page) throws Exception {
        if (name == null || name.trim().isEmpty()) return catalogue(kind, page, "");
        String path = "series".equals(kind) ? "/tcategory.php?category=" : "/category.php?category=";
        return fromHtml(text(path + enc(name) + "&page=" + Math.max(1, page)));
    }

    public static List<String> categories(String kind) throws Exception {
        Document doc = Jsoup.parse(text("series".equals(kind) ? "/tvs.php" : "/"), BASE);
        String path = "series".equals(kind) ? "/tcategory.php" : "/category.php";
        Set<String> items = new java.util.LinkedHashSet<>();
        for (Element link : doc.select("a[href]")) {
            Uri uri = Uri.parse(link.absUrl("href"));
            if (allowedApi(uri) && path.equals(uri.getPath())) {
                String name = uri.getQueryParameter("category");
                if (name != null && !name.trim().isEmpty() && !mature(name)) items.add(name);
            }
        }
        return new ArrayList<>(items);
    }

    public static Detail detail(Item item, int season) throws Exception {
        Detail d = new Detail();
        d.item = item;
        String id = providerId(item);
        if (!id.matches("[0-9]+")) throw new Exception("Invalid provider ID");
        String path = "series".equals(item.kind)
            ? "/watch.php?id=" + id + "&season=" + Math.max(1, season)
            : "/view.php?id=" + id;
        Document doc = Jsoup.parse(text(path), BASE);
        Element overview = doc.selectFirst("#synopsis, .synopsis, .overview");
        if (overview == null) {
            for (Element h : doc.select("h3")) {
                if ("Overview".equalsIgnoreCase(h.text().trim())) {
                    overview = h.nextElementSibling();
                    break;
                }
            }
        }
        d.description = overview == null ? "" : overview.text().trim();
        for (Element actor : doc.select("a[href*=cast.php]")) {
            String name = actor.text().trim();
            if (!name.isEmpty() && name.length() < 90 && !d.cast.contains(name) && d.cast.size() < 12)
                d.cast.add(name);
        }
        Element h1 = doc.selectFirst("h1");
        String realName = h1 == null ? "" : h1.ownText().trim();
        if (!realName.trim().isEmpty()) d.item = new Item(item.id, item.kind, realName, item.image, item.category, item.year);

        if (!"series".equals(item.kind)) return d;
        Set<Integer> seasons = new HashSet<>();
        for (Element option : doc.select("select option")) {
            String value = option.attr("value");
            if (value.matches("[0-9]+") && Integer.parseInt(value) > 0) seasons.add(Integer.parseInt(value));
        }
        for (Element card : doc.select(".ep-card, a[href*=watch.php]")) {
            String number = card.attr("data-ep");
            if (number.trim().isEmpty()) {
                try { number = Uri.parse(card.absUrl("href")).getQueryParameter("ep"); }
                catch (Exception ignored) {}
            }
            if (number == null || !number.matches("[0-9]+")) continue;
            int num = Integer.parseInt(number);
            String label = card.text().trim();
            if (label.trim().isEmpty()) label = "Episode " + num;
            Element img = card.selectFirst("img");
            String poster = img == null ? "" : image(img.attr("src"));
            addEpisode(d, new Episode(num, label, poster, ""));
        }
        try {
            JSONObject meta = new JSONObject(text(path + "&meta=1"));
            String synopsis = meta.optString("synopsis", "");
            if (!synopsis.trim().isEmpty()) d.description = synopsis;
            JSONObject eps = meta.optJSONObject("episodes");
            if (eps != null) {
                java.util.Iterator<String> keys = eps.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    JSONObject ep = eps.optJSONObject(key);
                    if (ep == null) continue;
                    int num = ep.optInt("episode_number", 0);
                    if (num < 1) {
                        try { num = Integer.parseInt(key); }
                        catch (NumberFormatException ignored) {}
                    }
                    if (num < 1) continue;
                    addEpisode(d, new Episode(num, ep.optString("title", "Episode " + num),
                        image(ep.optString("still", "")), ep.optString("path", "")));
                }
            }
        } catch (Exception ignored) {}
        seasons.add(Math.max(1, season));
        d.seasons.addAll(seasons);
        java.util.Collections.sort(d.seasons);
        d.episodes.sort((a, b) -> Integer.compare(a.number, b.number));
        return d;
    }

    private static void addEpisode(Detail detail, Episode episode) {
        for (int i = 0; i < detail.episodes.size(); i++) {
            Episode old = detail.episodes.get(i);
            if (old.number == episode.number) {
                if (!episode.path.trim().isEmpty() || old.title.startsWith("E"))
                    detail.episodes.set(i, episode);
                return;
            }
        }
        detail.episodes.add(episode);
    }

    public static Stream playback(Item item, int season, int episode) throws Exception {
        String id = providerId(item);
        if (!id.matches("[0-9]+")) throw new Exception("Invalid video ID");
        String path = "series".equals(item.kind)
            ? "/watch.php?id=" + id + "&season=" + Math.max(1, season) + "&ep=" + Math.max(1, episode)
            : "/player.php?id=" + id;
        String html = text(path);
        Document doc = Jsoup.parse(html, BASE);
        Element source = doc.selectFirst("video source[src], video[src], source[src]");
        String raw = source == null ? "" : source.attr("src");
        if (raw.trim().isEmpty()) {
            Matcher matcher = MEDIA_ASSIGNMENT.matcher(html);
            if (matcher.find()) raw = matcher.group(1);
        }
        if (raw.trim().isEmpty() && "series".equals(item.kind)) {
            try {
                JSONObject json = new JSONObject(text("/watch.php?id=" + id + "&season=" +
                    Math.max(1, season) + "&meta=1"));
                JSONObject ep = json.optJSONObject("episodes");
                if (ep != null) {
                    JSONObject one = ep.optJSONObject(String.valueOf(episode));
                    if (one != null) raw = one.optString("path", "");
                }
            } catch (Exception ignored) {}
        }
        if (raw.trim().isEmpty()) throw new Exception("No playable media source supplied by the provider");
        // The legacy player writes HTML-escaped signed query strings inside JS.
        // Decode only the extracted URL, preserving the original token bytes.
        raw = Parser.unescapeEntities(raw, false)
            .replace("\\/", "/")
            .replace("\\u002F", "/")
            .replace("\\u002f", "/")
            .replace("\\u0026", "&");
        String mediaBase = raw.matches("(?i)^/?Data/.*")
            ? "http://103.136.200.124:8086/"
            : BASE + "/";
        String absolute = resolve(raw, mediaBase);
        Uri uri = Uri.parse(absolute);
        if (!allowedMedia(uri)) throw new Exception("Media host is not in the approved source list");
        String filename = uri.getPath();
        if (filename == null || !MEDIA_EXT.matcher(filename).find())
            throw new Exception("Unsupported media format");
        boolean isHls = filename.toLowerCase(Locale.ROOT).endsWith(".m3u8");
        Map<String, String> headers = new HashMap<>();
        headers.put("Referer", REFERER);
        headers.put("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36");
        String cookie = cookieHeader("cineplexbd.net");
        if (!cookie.isEmpty()) headers.put("Cookie", cookie);
        return new Stream(absolute, isHls, headers);
    }
}

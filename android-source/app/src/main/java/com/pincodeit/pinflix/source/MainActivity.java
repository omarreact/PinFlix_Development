package com.pincodeit.pinflix.source;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.LruCache;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends Activity {
    private final int background = Color.rgb(10, 15, 30);
    private final int panelColor = Color.rgb(23, 31, 51);
    private final int muted = Color.rgb(167, 181, 205);
    private final int accent = Color.rgb(103, 232, 249);

    private final ExecutorService workers = Executors.newFixedThreadPool(5);
    private final AtomicInteger requestNumber = new AtomicInteger();
    private final LruCache<String, Bitmap> posters = new LruCache<>(20);
    private LinearLayout root;
    private LinearLayout content;
    private ProgressBar progress;
    private EditText search;
    private String activeKind = "movie";
    private String activeCategory = "";
    private String activeQuery = "";
    private int page = 1;
    private final List<ProviderClient.Item> results = new ArrayList<>();
    private List<String> categoryLabels = new ArrayList<>();
    private boolean busy = false;
    private boolean showingDetails = false;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        showCatalogueShell();
        loadPage(true);
    }

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private GradientDrawable bg(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radius));
        return d;
    }
    private TextView text(String message, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(message);
        t.setTextColor(color);
        t.setTextSize(sp);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }
    private LinearLayout vertical() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }
    private LinearLayout horizontal() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }
    private void space(LinearLayout parent, int height) {
        View gap = new View(this);
        parent.addView(gap, new LinearLayout.LayoutParams(1, dp(height)));
    }
    private LinearLayout.LayoutParams margin(int width, int height, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(width, height);
        p.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return p;
    }
    private Button button(String label, boolean active, View.OnClickListener action) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(13);
        b.setTextColor(active ? background : Color.WHITE);
        b.setBackgroundTintList(ColorStateList.valueOf(active ? accent : panelColor));
        b.setOnClickListener(action);
        return b;
    }
    private TextView section(String name) {
        TextView t = text(name, 22, Color.WHITE, true);
        t.setPadding(dp(1), dp(3), 0, dp(10));
        return t;
    }
    private void initializeRoot() {
        root = vertical();
        root.setBackgroundColor(background);
        setContentView(root);
    }
    private void addScrollContent() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        content = vertical();
        content.setPadding(dp(15), dp(10), dp(15), dp(28));
        scroll.addView(content);
    }
    private void header(String subtitle) {
        LinearLayout bar = horizontal();
        bar.setPadding(dp(17), dp(12), dp(17), dp(10));
        bar.setBackgroundColor(background);
        LinearLayout labels = vertical();
        TextView logo = text("PinFlix", 29, Color.WHITE, true);
        labels.addView(logo);
        TextView sub = text(subtitle, 11, accent, true);
        labels.addView(sub);
        bar.addView(labels, new LinearLayout.LayoutParams(0, -2, 1));
        Button home = button("⌂ Home", false, v -> {
            showingDetails = false;
            activeCategory = "";
            activeQuery = "";
            page = 1;
            results.clear();
            showCatalogueShell();
            loadPage(true);
        });
        bar.addView(home, new LinearLayout.LayoutParams(dp(98), dp(45)));
        root.addView(bar, new LinearLayout.LayoutParams(-1, -2));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setIndeterminateTintList(ColorStateList.valueOf(accent));
        progress.setVisibility(View.GONE);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
    }

    private void showCatalogueShell() {
        showingDetails = false;
        initializeRoot();
        header("SOURCE EDITION  •  CINEPLEXBD");
        addScrollContent();

        LinearLayout searchRow = horizontal();
        search = new EditText(this);
        search.setTextColor(Color.WHITE);
        search.setHintTextColor(muted);
        search.setTextSize(15);
        search.setSingleLine(true);
        search.setHint("Search movies & TV shows");
        search.setPadding(dp(15), dp(6), dp(8), dp(6));
        search.setBackground(bg(panelColor, 13));
        search.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        search.setText(activeQuery);
        search.setOnEditorActionListener((v, action, event) -> {
            if (action == EditorInfo.IME_ACTION_SEARCH) { startSearch(); return true; }
            return false;
        });
        searchRow.addView(search, new LinearLayout.LayoutParams(0, dp(51), 1));
        Button go = button("Search", true, v -> startSearch());
        searchRow.addView(go, margin(dp(93), dp(51), 9, 0, 0, 0));
        content.addView(searchRow);
        space(content, 16);

        LinearLayout tabs = horizontal();
        Button movies = button("Movies", "movie".equals(activeKind), v -> switchKind("movie"));
        Button series = button("TV Series", "series".equals(activeKind), v -> switchKind("series"));
        tabs.addView(movies, new LinearLayout.LayoutParams(0, dp(48), 1));
        tabs.addView(series, margin(0, dp(48), 8, 0, 0, 0));
        LinearLayout.LayoutParams seriesParams = (LinearLayout.LayoutParams) series.getLayoutParams();
        seriesParams.width = 0; seriesParams.weight = 1; series.setLayoutParams(seriesParams);
        content.addView(tabs);
        space(content, 15);
    }

    private void startSearch() {
        activeQuery = search.getText().toString().trim();
        activeCategory = "";
        page = 1;
        results.clear();
        InputMethodManager input = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (input != null) input.hideSoftInputFromWindow(search.getWindowToken(), 0);
        loadPage(true);
    }

    private void switchKind(String next) {
        activeKind = next;
        activeCategory = "";
        activeQuery = "";
        categoryLabels.clear();
        page = 1;
        results.clear();
        showCatalogueShell();
        loadPage(true);
    }

    private void loadPage(boolean reset) {
        if (busy && !reset) return;
        int token = requestNumber.incrementAndGet();
        busy = true;
        if (reset) {
            results.clear();
            page = 1;
        }
        progress.setVisibility(View.VISIBLE);
        content.removeViews(3, content.getChildCount() - 3); // retain search row, gap, tabs? see below
        if (content.getChildCount() > 3) content.removeViews(3, content.getChildCount() - 3);
        content.addView(section(activeQuery.isBlank() ?
            ("series".equals(activeKind) ? "Explore TV Series" : "Explore Movies") : "Search results"));
        TextView wait = text("Loading CineplexBD catalogue…", 14, muted, false);
        wait.setPadding(dp(4), dp(12), 0, dp(12));
        content.addView(wait);
        final int requestedPage = page;
        final String requestedKind = activeKind;
        final String requestedCategory = activeCategory;
        final String requestedQuery = activeQuery;
        workers.execute(() -> {
            try {
                List<ProviderClient.Item> newItems;
                if (!requestedCategory.isEmpty() && requestedQuery.isEmpty())
                    newItems = ProviderClient.category(requestedKind, requestedCategory, requestedPage);
                else
                    newItems = ProviderClient.catalogue(requestedKind, requestedPage, requestedQuery);
                List<String> categories = categoryLabels;
                if (reset && requestedQuery.isEmpty()) {
                    try { categories = ProviderClient.categories(requestedKind); }
                    catch (Exception ignored) {}
                }
                final List<String> finalCategories = categories;
                runOnUiThread(() -> {
                    if (token != requestNumber.get() || isFinishing() || showingDetails) return;
                    busy = false;
                    progress.setVisibility(View.GONE);
                    if (reset) categoryLabels = finalCategories;
                    if ("series".equals(requestedKind) && !requestedQuery.isBlank()) {
                        newItems.removeIf(i -> !"series".equals(i.kind));
                    } else if ("movie".equals(requestedKind) && requestedQuery.isBlank()) {
                        newItems.removeIf(i -> !"movie".equals(i.kind));
                    }
                    for (ProviderClient.Item i : newItems) {
                        boolean exists = false;
                        for (ProviderClient.Item old : results) {
                            if (old.id.equals(i.id)) { exists = true; break; }
                        }
                        if (!exists) results.add(i);
                    }
                    renderResults(newItems.size() > 0);
                });
            } catch (Exception err) {
                runOnUiThread(() -> {
                    if (token != requestNumber.get() || isFinishing() || showingDetails) return;
                    busy = false;
                    progress.setVisibility(View.GONE);
                    renderFailure(err.getMessage());
                });
            }
        });
    }

    private void clearBelowSearch() {
        // First four children: search row, space, tabs, space.
        int keep = 4;
        if (content.getChildCount() > keep) content.removeViews(keep, content.getChildCount() - keep);
    }
    private void renderFailure(String message) {
        clearBelowSearch();
        content.addView(section("Source unavailable"));
        TextView body = text("Could not load the CineplexBD catalogue.\n" +
            (message == null ? "Check your connection." : message) +
            "\n\nSome providers are accessible only on certain networks.", 14, muted, false);
        content.addView(body);
        content.addView(button("Try again", true, v -> loadPage(true)), margin(-1, dp(52), 0, 20, 0, 0));
    }

    private void renderCategories() {
        if (categoryLabels.isEmpty() || !activeQuery.isEmpty()) return;
        content.addView(section("Categories"));
        HorizontalScrollView h = new HorizontalScrollView(this);
        h.setHorizontalScrollBarEnabled(false);
        LinearLayout row = horizontal();
        Button all = button("All", activeCategory.isEmpty(), v -> selectCategory(""));
        row.addView(all, margin(-2, dp(40), 0, 0, 7, 0));
        for (String category : categoryLabels) {
            Button chip = button(category, category.equals(activeCategory), v -> selectCategory(category));
            row.addView(chip, margin(-2, dp(40), 0, 0, 7, 0));
        }
        h.addView(row);
        content.addView(h);
        space(content, 18);
    }

    private void selectCategory(String category) {
        activeCategory = category;
        page = 1;
        results.clear();
        loadPage(true);
    }

    private void renderResults(boolean canLoadMore) {
        clearBelowSearch();
        renderCategories();
        content.addView(section(activeQuery.isBlank() ?
            ("series".equals(activeKind) ? "TV Series" : "Movies") : "Search results"));
        if (results.isEmpty()) {
            TextView empty = text("No titles found. Try another search or network.", 15, muted, false);
            empty.setPadding(0, dp(12), 0, dp(20));
            content.addView(empty);
            return;
        }
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(2);
        grid.setAlignmentMode(GridLayout.ALIGN_BOUNDS);
        grid.setUseDefaultMargins(false);
        int usableWidth = getResources().getDisplayMetrics().widthPixels - dp(40);
        int cardWidth = Math.max(dp(130), usableWidth / 2);
        for (int i = 0; i < results.size(); i++) {
            ProviderClient.Item item = results.get(i);
            LinearLayout tile = vertical();
            tile.setPadding(dp(3), dp(3), dp(3), dp(9));
            tile.setOnClickListener(v -> openDetail(item));
            ImageView poster = new ImageView(this);
            poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
            poster.setBackground(bg(panelColor, 13));
            poster.setClipToOutline(true);
            tile.addView(poster, new LinearLayout.LayoutParams(-1, dp(225)));
            setPoster(poster, item.image);
            TextView title = text(item.title, 13, Color.WHITE, true);
            title.setMaxLines(2);
            title.setEllipsize(android.text.TextUtils.TruncateAt.END);
            title.setPadding(dp(5), dp(9), dp(2), 0);
            tile.addView(title, new LinearLayout.LayoutParams(-1, dp(50)));
            String meta = (item.year.isEmpty() ? "" : item.year + "  •  ") + ("series".equals(item.kind) ? "TV SERIES" : "MOVIE");
            TextView sub = text(meta, 11, muted, false);
            sub.setPadding(dp(5), 0, 0, 0);
            tile.addView(sub);
            GridLayout.LayoutParams params = new GridLayout.LayoutParams(GridLayout.spec(i / 2), GridLayout.spec(i % 2));
            params.width = cardWidth;
            params.height = -2;
            grid.addView(tile, params);
        }
        content.addView(grid);
        if (canLoadMore && activeQuery.isEmpty()) {
            content.addView(button("Load more from CineplexBD", false, v -> {
                page++;
                loadPage(false);
            }), margin(-1, dp(52), 0, 20, 0, 0));
        }
        TextView source = text("Catalogue: cineplexbd.net   •   Stream sources are validated before playback", 11, muted, false);
        source.setGravity(Gravity.CENTER);
        content.addView(source, margin(-1, -2, 0, 22, 0, 0));
    }

    private void setPoster(ImageView view, String url) {
        if (url == null || url.isBlank()) return;
        Bitmap cached = posters.get(url);
        if (cached != null) { view.setImageBitmap(cached); return; }
        view.setTag(url);
        workers.execute(() -> {
            Bitmap image = ProviderClient.poster(url);
            runOnUiThread(() -> {
                if (isFinishing() || !url.equals(view.getTag())) return;
                if (image != null) {
                    posters.put(url, image);
                    view.setImageBitmap(image);
                }
            });
        });
    }

    private void openDetail(ProviderClient.Item item) {
        showingDetails = true;
        int token = requestNumber.incrementAndGet();
        initializeRoot();
        header("MOVIE & TV INFORMATION");
        addScrollContent();
        content.addView(button("‹ Back to catalogue", false, v -> {
            showingDetails = false;
            showCatalogueShell();
            renderResults(true);
        }), margin(-1, dp(47), 0, 0, 0, 16));
        content.addView(section(item.title));
        progress.setVisibility(View.VISIBLE);
        loadDetail(item, 1, token);
    }

    private void loadDetail(ProviderClient.Item item, int season, int token) {
        workers.execute(() -> {
            try {
                ProviderClient.Detail detail = ProviderClient.detail(item, season);
                runOnUiThread(() -> {
                    if (isFinishing() || !showingDetails || token != requestNumber.get()) return;
                    progress.setVisibility(View.GONE);
                    showDetail(detail, season, token);
                });
            } catch (Exception ex) {
                runOnUiThread(() -> {
                    if (isFinishing() || !showingDetails || token != requestNumber.get()) return;
                    progress.setVisibility(View.GONE);
                    TextView error = text("Could not load details: " + ex.getMessage(), 14, muted, false);
                    content.addView(error);
                });
            }
        });
    }

    private void showDetail(ProviderClient.Detail detail, int season, int token) {
        // Preserve Back button and heading, remove previous detail components.
        if (content.getChildCount() > 2)
            content.removeViews(2, content.getChildCount() - 2);
        ProviderClient.Item item = detail.item;
        ImageView art = new ImageView(this);
        art.setScaleType(ImageView.ScaleType.CENTER_CROP);
        art.setBackground(bg(panelColor, 16));
        art.setClipToOutline(true);
        content.addView(art, margin(-1, dp(205), 0, 0, 0, 16));
        setPoster(art, item.image);
        String meta = (item.year.isEmpty() ? "" : item.year + "  •  ") +
            ("series".equals(item.kind) ? "TV Series" : "Movie");
        content.addView(text(meta, 14, accent, true));
        space(content, 14);
        if (!detail.description.isBlank()) {
            content.addView(text(detail.description, 15, muted, false));
            space(content, 18);
        }
        if ("movie".equals(item.kind)) {
            content.addView(button("▶ Play Movie", true, v -> launchPlayer(item, 1, 1)),
                margin(-1, dp(55), 0, 0, 0, 10));
            return;
        }

        content.addView(section("Seasons"));
        HorizontalScrollView scroll = new HorizontalScrollView(this);
        LinearLayout row = horizontal();
        for (int s : detail.seasons) {
            Button chip = button("Season " + s, s == season, v -> {
                progress.setVisibility(View.VISIBLE);
                // Refresh this detail using provider's selected season metadata.
                int newToken = requestNumber.incrementAndGet();
                loadDetail(item, s, newToken);
            });
            row.addView(chip, margin(-2, dp(44), 0, 0, 7, 0));
        }
        scroll.addView(row);
        content.addView(scroll);
        space(content, 17);
        content.addView(section("Episodes"));
        if (detail.episodes.isEmpty()) {
            content.addView(text("No episode metadata was returned for this season.", 14, muted, false));
        }
        for (ProviderClient.Episode episode : detail.episodes) {
            LinearLayout episodeRow = horizontal();
            episodeRow.setPadding(dp(14), dp(13), dp(14), dp(13));
            episodeRow.setBackground(bg(panelColor, 12));
            TextView number = text(String.valueOf(episode.number), 18, accent, true);
            episodeRow.addView(number, new LinearLayout.LayoutParams(dp(39), -2));
            TextView label = text(episode.title, 14, Color.WHITE, true);
            label.setMaxLines(2);
            episodeRow.addView(label, new LinearLayout.LayoutParams(0, -2, 1));
            TextView play = text("▶", 22, accent, true);
            episodeRow.addView(play);
            episodeRow.setOnClickListener(v -> launchPlayer(item, season, episode.number));
            content.addView(episodeRow, margin(-1, -2, 0, 0, 0, 9));
        }
    }

    private void launchPlayer(ProviderClient.Item item, int season, int episode) {
        Intent intent = new Intent(this, PlayerActivity.class);
        intent.putExtra("id", item.id);
        intent.putExtra("kind", item.kind);
        intent.putExtra("title", item.title);
        intent.putExtra("season", season);
        intent.putExtra("episode", episode);
        startActivity(intent);
    }

    @Override
    public void onBackPressed() {
        if (showingDetails) {
            showingDetails = false;
            requestNumber.incrementAndGet();
            showCatalogueShell();
            renderResults(true);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        requestNumber.incrementAndGet();
        workers.shutdownNow();
        super.onDestroy();
    }
}

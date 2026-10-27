package com.pincodeit.pinflix.source;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.LruCache;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends Activity {
    private static final int BG = 0xFF130D2D;
    private static final int BG_TOP = 0xFF392779;
    private static final int PANEL = 0xFF30245C;
    private static final int VIOLET = 0xFF6745EF;
    private static final int SOFT = 0xFFAFA3DB;
    private static final int WHITE = 0xFFFBF9FF;
    private static final int ROSE = 0xFFB66DAF;
    private static final int EDGE = 0xFF4D3B85;
    private final ExecutorService network = Executors.newFixedThreadPool(5);
    private final AtomicInteger requestId = new AtomicInteger();
    private final LruCache<String, Bitmap> bitmapCache = new LruCache<>(30);
    private final List<ProviderClient.Item> movies = new ArrayList<>();
    private final List<ProviderClient.Item> series = new ArrayList<>();
    private final List<ProviderClient.Item> discoverItems = new ArrayList<>();
    private final Map<String, ProviderClient.Item> saved = new LinkedHashMap<>();
    private SharedPreferences prefs;
    private LinearLayout root, page;
    private ScrollView scroll;
    private String screen = "home", section = "Trending", query = "", category = "";
    private int featuredIndex = 0, discoverPage = 1;
    private boolean busy = false, moreAvailable = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG_TOP);
        getWindow().setNavigationBarColor(BG);
        getWindow().getDecorView().setSystemUiVisibility(0);
        prefs = getSharedPreferences("pinflix_sources", MODE_PRIVATE);
        restoreSaved();
        screen = prefs.getBoolean("intro_seen", false) ? "home" : "intro";
        render();
        fetchInitial();
    }

    private int dp(float n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private int screenDp() { return Math.round(getResources().getDisplayMetrics().widthPixels / getResources().getDisplayMetrics().density); }

    private GradientDrawable solid(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radius));
        return d;
    }
    private GradientDrawable stroked(int color, int radius) {
        GradientDrawable d = solid(color, radius);
        d.setStroke(dp(1), EDGE);
        return d;
    }
    private GradientDrawable gradient(int start, int end) {
        return new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{start,end});
    }
    private TextView text(String text, float size, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextSize(size);
        v.setTextColor(color);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        v.setIncludeFontPadding(true);
        return v;
    }
    private LinearLayout vertical() {
        LinearLayout v = new LinearLayout(this);
        v.setOrientation(LinearLayout.VERTICAL);
        return v;
    }
    private LinearLayout horizontal() {
        LinearLayout v = new LinearLayout(this);
        v.setOrientation(LinearLayout.HORIZONTAL);
        v.setGravity(Gravity.CENTER_VERTICAL);
        return v;
    }
    private LinearLayout.LayoutParams margins(int w, int h, int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(w, h);
        p.setMargins(dp(left),dp(top),dp(right),dp(bottom));
        return p;
    }
    private void gap(LinearLayout parent, int h) { View v=new View(this);parent.addView(v,new LinearLayout.LayoutParams(1,dp(h))); }
    private TextView action(String title, int fill, Runnable click) {
        TextView v = text(title,13,WHITE,true);
        v.setGravity(Gravity.CENTER);
        v.setPadding(dp(15),dp(8),dp(15),dp(8));
        v.setBackground(solid(fill,24));
        v.setOnClickListener(w -> click.run());
        return v;
    }
    private TextView chip(String label, boolean active, Runnable click) {
        TextView v = text(label,12,active?WHITE:SOFT,active);
        v.setGravity(Gravity.CENTER);
        v.setPadding(dp(17),dp(9),dp(17),dp(9));
        v.setBackground(active?solid(VIOLET,21):stroked(PANEL,21));
        v.setOnClickListener(w->click.run());
        return v;
    }

    private void base(boolean showNav, boolean useScroll) {
        root=vertical();
        root.setBackground(gradient(BG_TOP,BG));
        root.setOnApplyWindowInsetsListener((v,insets) -> {
            root.setPadding(0,insets.getSystemWindowInsetTop(),0,insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(root);
        if (useScroll) {
            scroll=new ScrollView(this);
            scroll.setFillViewport(true);
            scroll.setVerticalScrollBarEnabled(false);
            root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
            page=vertical();
            page.setPadding(dp(17),dp(12),dp(17),dp(27));
            scroll.addView(page);
        } else {
            page=vertical();
            root.addView(page,new LinearLayout.LayoutParams(-1,0,1));
        }
        if(showNav) bottomNavigation();
    }
    private void render() {
        if("intro".equals(screen)) { renderIntro(); return; }
        if("detail".equals(screen)) return;
        if("home".equals(screen)) { renderHome(); return; }
        if("discover".equals(screen)) { renderDiscover(); return; }
        if("saved".equals(screen)) { renderSaved(); return; }
        renderProfile();
    }
    private void navigate(String next) {
        requestId.incrementAndGet();
        screen=next;
        category="";
        if ("discover".equals(next)) { query="";discoverPage=1; discoverItems.clear(); }
        render();
        if("discover".equals(next)) discover(true);
    }
    private void bottomNavigation() {
        LinearLayout nav=horizontal();
        nav.setPadding(dp(7),dp(8),dp(7),dp(6));
        nav.setBackground(gradient(0xFF2B2051,0xFF251A40));
        String[] labels={"⌂\nHome","◈\nDiscover","▢\nSaved","♙\nProfile"};
        String[] routes={"home","discover","saved","profile"};
        for(int i=0;i<4;i++){
            final String dest=routes[i];
            boolean selected=dest.equals(screen);
            TextView item=text(labels[i],12,selected?WHITE:SOFT,selected);
            item.setGravity(Gravity.CENTER);
            item.setLineSpacing(dp(3),1f);
            item.setOnClickListener(v -> { if(!screen.equals(dest))navigate(dest); });
            nav.addView(item,new LinearLayout.LayoutParams(0,dp(58),1f));
        }
        root.addView(nav,new LinearLayout.LayoutParams(-1,-2));
    }

    private void loadPoster(ImageView target,String url) {
        if(url==null || url.isEmpty())return;
        Bitmap cached=bitmapCache.get(url);
        if(cached!=null){target.setImageBitmap(cached);return;}
        target.setTag(url);
        network.execute(()->{
            Bitmap image=ProviderClient.poster(url);
            if(image==null)return;
            runOnUiThread(()->{
                if(isFinishing()||isDestroyed())return;
                if(url.equals(target.getTag())) {
                    bitmapCache.put(url,image);
                    target.setImageBitmap(image);
                }
            });
        });
    }
    private ImageView poster(String url) {
        ImageView view=new ImageView(this);
        view.setScaleType(ImageView.ScaleType.CENTER_CROP);
        view.setBackground(gradient(0xFF6F4FB2,0xFF171029));
        view.setClipToOutline(true);
        loadPoster(view,url);
        return view;
    }

    private void fetchInitial() {
        int token=requestId.get();
        network.execute(()->{
            List<ProviderClient.Item> freshMovies=new ArrayList<>();
            List<ProviderClient.Item> freshSeries=new ArrayList<>();
            try{freshMovies=ProviderClient.catalogue("movie",1,"");}catch(Exception ignored){}
            try{freshSeries=ProviderClient.catalogue("series",1,"");}catch(Exception ignored){}
            final List<ProviderClient.Item> m=freshMovies, s=freshSeries;
            runOnUiThread(()->{
                movies.clear();movies.addAll(m);
                series.clear();series.addAll(s);
                featuredIndex=0;
                if(!"detail".equals(screen) && !"discover".equals(screen) && !"saved".equals(screen)
                    && !"profile".equals(screen))render();
            });
        });
    }

    private void renderIntro() {
        base(false,false);
        FrameLayout canvas=new FrameLayout(this);
        canvas.setBackground(gradient(0xFF100B23,0xFF060716));
        page.addView(canvas,new LinearLayout.LayoutParams(-1,-1));
        GridLayout collage=new GridLayout(this);
        collage.setColumnCount(3);
        collage.setPadding(dp(5),dp(5),dp(5),dp(5));
        collage.setRotation(4f);
        FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(dp(screenDp()+66),-1,Gravity.CENTER);
        canvas.addView(collage,cp);
        int w=dp(Math.max(97,(screenDp()+42)/3));
        int h=dp(176);
        for(int i=0;i<15;i++){
            int j=i;
            ProviderClient.Item item=movies.isEmpty()?null:movies.get(i%movies.size());
            ImageView art=poster(item==null?"":item.image);
            GridLayout.LayoutParams p=new GridLayout.LayoutParams(GridLayout.spec(i/3),GridLayout.spec(i%3));
            p.width=w;p.height=h;p.setMargins(dp(3),dp(3),dp(3),dp(3));
            collage.addView(art,p);
        }
        View shade=new View(this);
        shade.setBackground(gradient(0x00000000,0xFF060512));
        canvas.addView(shade,new FrameLayout.LayoutParams(-1,-1));
        LinearLayout footer=vertical();
        footer.setPadding(dp(25),dp(18),dp(25),dp(26));
        TextView headline=text("Welcome to PinFlix",28,WHITE,true);
        headline.setGravity(Gravity.CENTER);
        footer.addView(headline);
        gap(footer,9);
        TextView subtitle=text("A world of stories, all in your pocket.\nFind your next favorite movie or series.",13,0xFFCFC8E4,false);
        subtitle.setGravity(Gravity.CENTER);
        footer.addView(subtitle);
        gap(footer,25);
        TextView start=action("Get Started",VIOLET,()->{
            prefs.edit().putBoolean("intro_seen",true).apply();
            screen="home";render();
        });
        footer.addView(start,new LinearLayout.LayoutParams(-1,dp(54)));
        canvas.addView(footer,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));
    }

    private void topTabs() {
        HorizontalScrollView scrollTabs=new HorizontalScrollView(this);
        scrollTabs.setHorizontalScrollBarEnabled(false);
        LinearLayout tabs=horizontal();
        String[] names={"Trending","New","Movies","Series","TV Show"};
        for(String name:names){
            boolean selected=section.equals(name);
            TextView tab=text(name,selected?15:13,selected?WHITE:0xFFC7BDEE,selected);
            tab.setPadding(dp(8),dp(14),dp(13),dp(14));
            tab.setOnClickListener(v->{
                section=name;
                featuredIndex=0;
                if ("Series".equals(name)||"TV Show".equals(name)) {
                    if(series.isEmpty()) navigate("discover");
                    else renderHome();
                } else renderHome();
            });
            tabs.addView(tab);
        }
        scrollTabs.addView(tabs);
        page.addView(scrollTabs,new LinearLayout.LayoutParams(-1,dp(53)));
    }
    private List<ProviderClient.Item> activeItems() {
        return ("Series".equals(section)||"TV Show".equals(section))?series:movies;
    }
    private void sectionHeading(String name,Runnable seeAll) {
        LinearLayout row=horizontal();
        TextView title=text(name,16,WHITE,true);
        row.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        TextView see=text("See all",12,SOFT,false);
        see.setOnClickListener(v->seeAll.run());
        row.addView(see);
        page.addView(row,margins(-1,-2,0,10,0,10));
    }
    private void renderHome() {
        base(true,true);
        page.setPadding(0,dp(1),0,dp(16));
        topTabs();
        List<ProviderClient.Item> titles=activeItems();
        if(titles.isEmpty()) {
            LinearLayout box=vertical();
            box.setPadding(dp(22),dp(55),dp(22),dp(30));
            TextView title=text("Stories worth discovering",23,WHITE,true);
            title.setGravity(Gravity.CENTER);
            box.addView(title);
            gap(box,15);
            TextView text=text("Connecting to the CineplexBD catalogue.\nIf it is unavailable on this network, try Discover again.",13,SOFT,false);
            text.setGravity(Gravity.CENTER);
            box.addView(text);
            gap(box,18);
            box.addView(action("Explore catalogue",VIOLET,()->navigate("discover")),new LinearLayout.LayoutParams(-1,dp(48)));
            page.addView(box);
            return;
        }

        int focus=Math.min(featuredIndex,titles.size()-1);
        int card=dp(215);
        HorizontalScrollView carousel=new HorizontalScrollView(this);
        carousel.setHorizontalScrollBarEnabled(false);
        carousel.setFillViewport(false);
        LinearLayout slides=horizontal();
        int side=Math.max(dp(18),(getResources().getDisplayMetrics().widthPixels-card)/2);
        slides.setPadding(side,dp(10),side,dp(5));
        final LinearLayout spotlight=vertical();
        for(int i=0;i<Math.min(10,titles.size());i++){
            final int selected=i;
            ProviderClient.Item item=titles.get(i);
            FrameLayout frame=new FrameLayout(this);
            frame.setBackground(stroked(PANEL,20));
            frame.setClipToOutline(true);
            ImageView art=poster(item.image);
            frame.addView(art,new FrameLayout.LayoutParams(-1,-1));
            View shade=new View(this);
            shade.setBackground(gradient(0x00000000,0x550A0927));
            frame.addView(shade,new FrameLayout.LayoutParams(-1,-1));
            frame.setOnClickListener(v->{
                if(featuredIndex==selected){openDetail(item);return;}
                featuredIndex=selected;
                fillSpotlight(spotlight,item);
                carousel.smoothScrollTo(selected*dp(230),0);
            });
            slides.addView(frame,margins(card,dp(selected==focus?302:282),7,0,7,0));
        }
        carousel.addView(slides);
        page.addView(carousel,new LinearLayout.LayoutParams(-1,dp(327)));
        if(focus>0)carousel.post(()->carousel.scrollTo(focus*dp(229),0));
        spotlight.setPadding(dp(18),dp(3),dp(18),dp(7));
        page.addView(spotlight);
        fillSpotlight(spotlight,titles.get(focus));
        gap(page,16);
        sectionHeading("For You",()->navigate("discover"));
        addPosterRail(titles,0,Math.min(12,titles.size()));
        gap(page,17);
        if(!series.isEmpty()){
            sectionHeading("One more episode",()->{section="Series";renderHome();});
            addPosterRail(series,0,Math.min(10,series.size()));
        } else {
            sectionHeading("More to discover",()->navigate("discover"));
            addPosterRail(titles,Math.min(2,titles.size()-1),Math.min(14,titles.size()));
        }
        gap(page,15);
    }
    private void fillSpotlight(LinearLayout box,ProviderClient.Item item) {
        box.removeAllViews();
        TextView year=text(item.year.isEmpty()?"NOW SHOWING":item.year,12,0xFFDDD3F3,false);
        year.setGravity(Gravity.CENTER);
        box.addView(year);
        TextView title=text(item.title,22,WHITE,true);
        title.setGravity(Gravity.CENTER);
        title.setMaxLines(2);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        box.addView(title,margins(-1,-2,0,4,0,12));
        LinearLayout chips=horizontal();
        chips.setGravity(Gravity.CENTER);
        String category=item.category.isEmpty()?"Explore":item.category;
        if(category.length()>19)category=category.substring(0,19)+"…";
        chips.addView(chip(category,false,()->openDetail(item)),margins(-2,-2,3,0,3,0));
        chips.addView(chip("series".equals(item.kind)?"Series":"Movie",false,()->openDetail(item)),margins(-2,-2,3,0,3,0));
        box.addView(chips);
        TextView dots=text("●  ●  ●  ●  ●",12,VIOLET,false);
        dots.setGravity(Gravity.CENTER);
        box.addView(dots,margins(-1,-2,0,10,0,0));
        TextView open=text("Tap poster to view details",11,SOFT,false);
        open.setGravity(Gravity.CENTER);
        box.addView(open,margins(-1,-2,0,3,0,0));
    }
    private void addPosterRail(List<ProviderClient.Item> items,int from,int until) {
        HorizontalScrollView rail=new HorizontalScrollView(this);
        rail.setHorizontalScrollBarEnabled(false);
        LinearLayout row=horizontal();
        row.setPadding(dp(15),0,dp(10),0);
        for(int i=from;i<until;i++){
            ProviderClient.Item item=items.get(i);
            LinearLayout card=vertical();
            ImageView img=poster(item.image);
            img.setBackground(stroked(PANEL,13));
            img.setClipToOutline(true);
            card.addView(img,new LinearLayout.LayoutParams(dp(117),dp(160)));
            TextView title=text(item.title,12,WHITE,true);
            title.setMaxLines(2);
            title.setEllipsize(android.text.TextUtils.TruncateAt.END);
            card.addView(title,margins(-1,dp(39),0,7,0,0));
            card.setOnClickListener(v->openDetail(item));
            row.addView(card,margins(dp(118),-2,0,0,dp(10),0));
        }
        rail.addView(row);
        page.addView(rail);
    }

    private void renderDiscover() {
        base(true,true);
        TextView heading=text("Discover",26,WHITE,true);
        page.addView(heading,margins(-1,-2,2,10,0,5));
        TextView desc=text("Movies and series from CineplexBD",13,SOFT,false);
        page.addView(desc,margins(-1,-2,2,0,0,17));

        LinearLayout searchRow=horizontal();
        EditText input=new EditText(this);
        input.setSingleLine(true);
        input.setTextSize(14);
        input.setTextColor(WHITE);
        input.setHintTextColor(SOFT);
        input.setHint("Search title, actor or year");
        input.setText(query);
        input.setPadding(dp(16),dp(6),dp(10),dp(6));
        input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        input.setBackground(stroked(PANEL,14));
        searchRow.addView(input,new LinearLayout.LayoutParams(0,dp(49),1));
        TextView go=action("⌕",VIOLET,()->runSearch(input));
        searchRow.addView(go,margins(dp(51),dp(49),8,0,0,0));
        input.setOnEditorActionListener((v,action,event)->{
            if(action==EditorInfo.IME_ACTION_SEARCH){runSearch(input);return true;}return false;
        });
        page.addView(searchRow);
        gap(page,15);
        LinearLayout switches=horizontal();
        switches.addView(chip("Movies",!section.equals("Series"),()->{
            section="Movies";query="";category="";discoverPage=1;discoverItems.clear();discover(true);
        }),margins(-2,-2,0,0,9,0));
        switches.addView(chip("TV Series",section.equals("Series"),()->{
            section="Series";query="";category="";discoverPage=1;discoverItems.clear();discover(true);
        }));
        page.addView(switches);
        gap(page,12);
        if(!busy && discoverItems.isEmpty()){
            page.addView(text("Finding titles…",14,SOFT,false));
        } else drawDiscoverGrid();
    }
    private void runSearch(EditText field) {
        query=field.getText().toString().trim();
        category="";
        discoverPage=1;
        discoverItems.clear();
        InputMethodManager imm=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);
        if(imm!=null)imm.hideSoftInputFromWindow(field.getWindowToken(),0);
        discover(true);
    }
    private void discover(boolean reset) {
        if(busy && !reset)return;
        final int token=requestId.incrementAndGet();
        if(reset){discoverPage=1;discoverItems.clear();}
        busy=true;
        renderDiscover();
        final String kind=section.equals("Series")?"series":"movie";
        final String q=query, cat=category;
        final int targetPage=discoverPage;
        network.execute(()->{
            try {
                List<ProviderClient.Item> out=cat.isEmpty()
                    ?ProviderClient.catalogue(kind,targetPage,q)
                    :ProviderClient.category(kind,cat,targetPage);
                if(q.isEmpty()&&cat.isEmpty())out.removeIf(i->!kind.equals(i.kind));
                runOnUiThread(()->{
                    if(token!=requestId.get() || !"discover".equals(screen))return;
                    busy=false;
                    moreAvailable=!out.isEmpty() && q.isEmpty();
                    for(ProviderClient.Item item:out){
                        boolean exists=false;
                        for(ProviderClient.Item existing:discoverItems){
                            if(existing.id.equals(item.id)){exists=true;break;}
                        }
                        if(!exists)discoverItems.add(item);
                    }
                    renderDiscover();
                });
            } catch(Exception ex) {
                runOnUiThread(()->{
                    if(token!=requestId.get()||!"discover".equals(screen))return;
                    busy=false;moreAvailable=false;
                    renderDiscover();
                    page.addView(text("Source unavailable: "+ex.getMessage(),13,SOFT,false));
                    page.addView(action("Retry",VIOLET,()->discover(true)),margins(-1,dp(48),0,15,0,0));
                });
            }
        });
    }
    private void drawDiscoverGrid() {
        gap(page,12);
        TextView title=text(query.isEmpty()?"Explore collection":"Results for “"+query+"”",18,WHITE,true);
        page.addView(title,margins(-1,-2,0,3,0,13));
        if(discoverItems.isEmpty()){
            page.addView(text("No matches from this provider.",14,SOFT,false));
            return;
        }
        addPosterGrid(discoverItems);
        if(moreAvailable) {
            page.addView(action("Load more ↓",PANEL,()->{discoverPage++;discover(false);}),
                margins(-1,dp(48),0,15,0,0));
        }
    }
    private void addPosterGrid(List<ProviderClient.Item> titles) {
        GridLayout grid=new GridLayout(this);
        grid.setColumnCount(2);
        int cardWidth=(getResources().getDisplayMetrics().widthPixels-dp(44))/2;
        for(int i=0;i<titles.size();i++){
            ProviderClient.Item item=titles.get(i);
            LinearLayout tile=vertical();
            ImageView art=poster(item.image);
            art.setBackground(stroked(PANEL,15));
            tile.addView(art,new LinearLayout.LayoutParams(-1,dp(222)));
            TextView name=text(item.title,14,WHITE,true);
            name.setMaxLines(2);
            name.setEllipsize(android.text.TextUtils.TruncateAt.END);
            tile.addView(name,margins(-1,dp(40),2,8,0,0));
            TextView year=text(item.year.isEmpty()?("series".equals(item.kind)?"TV SERIES":"MOVIE"):item.year,11,SOFT,false);
            tile.addView(year,margins(-1,dp(22),2,0,0,0));
            tile.setOnClickListener(v->openDetail(item));
            GridLayout.LayoutParams p=new GridLayout.LayoutParams(GridLayout.spec(i/2),GridLayout.spec(i%2));
            p.width=cardWidth;p.height=-2;p.setMargins(dp(3),dp(4),dp(3),dp(12));
            grid.addView(tile,p);
        }
        page.addView(grid);
    }

    private void restoreSaved() {
        try {
            JSONObject store=new JSONObject(prefs.getString("saved","{}"));
            java.util.Iterator<String> ids=store.keys();
            while(ids.hasNext()){
                String id=ids.next();
                JSONObject d=store.getJSONObject(id);
                saved.put(id,new ProviderClient.Item(id,d.optString("kind","movie"),
                    d.optString("title","Untitled"),d.optString("image",""),
                    d.optString("category",""),d.optString("year","")));
            }
        }catch(Exception ignored){}
    }
    private void persistSaved() {
        try{
            JSONObject store=new JSONObject();
            for(ProviderClient.Item i:saved.values()){
                JSONObject o=new JSONObject();
                o.put("kind",i.kind);o.put("title",i.title);o.put("image",i.image);
                o.put("category",i.category);o.put("year",i.year);
                store.put(i.id,o);
            }
            prefs.edit().putString("saved",store.toString()).apply();
        }catch(Exception ignored){}
    }
    private void toggleSaved(ProviderClient.Item item) {
        if(saved.containsKey(item.id))saved.remove(item.id);
        else saved.put(item.id,item);
        persistSaved();
    }
    private void renderSaved() {
        base(true,true);
        page.addView(text("Saved for later",26,WHITE,true),margins(-1,-2,0,12,0,8));
        page.addView(text("Your personal watchlist stays on this device.",13,SOFT,false));
        gap(page,22);
        if(saved.isEmpty()){
            page.addView(text("No saved titles yet.\nOpen a movie or series and tap the bookmark.",15,SOFT,false));
            gap(page,20);
            page.addView(action("Explore titles",VIOLET,()->navigate("discover")),new LinearLayout.LayoutParams(-1,dp(50)));
        }else addPosterGrid(new ArrayList<>(saved.values()));
    }
    private void renderProfile() {
        base(true,true);
        page.addView(text("Your PinFlix",27,WHITE,true),margins(-1,-2,0,15,0,8));
        page.addView(text("All the stories you love, in one place.",14,SOFT,false));
        gap(page,30);
        LinearLayout card=vertical();
        card.setPadding(dp(20),dp(22),dp(20),dp(22));
        card.setBackground(stroked(PANEL,22));
        card.addView(text("Guest profile",19,WHITE,true));
        gap(card,9);
        card.addView(text(saved.size()+" saved titles   •   Local watchlist",14,SOFT,false));
        page.addView(card);
        gap(page,23);
        page.addView(action("View saved titles",VIOLET,()->navigate("saved")),
            new LinearLayout.LayoutParams(-1,dp(52)));
        gap(page,13);
        page.addView(action("Show welcome screen",PANEL,()->{
            screen="intro";render();
        }),new LinearLayout.LayoutParams(-1,dp(51)));
        gap(page,25);
        page.addView(text("PinFlix Sources • 1.2 Preview\nNative Android • CineplexBD catalogue\nPlayback subject to source availability.",
            12,SOFT,false));
    }

    private void openDetail(ProviderClient.Item item) {
        screen="detail";
        final int token=requestId.incrementAndGet();
        showDetailSkeleton(item);
        network.execute(()->{
            try {
                ProviderClient.Detail d=ProviderClient.detail(item,1);
                runOnUiThread(()->{
                    if(token==requestId.get()&&"detail".equals(screen))renderDetail(d,1);
                });
            }catch(Exception error){
                runOnUiThread(()->{
                    if(token==requestId.get()&&"detail".equals(screen)){
                        ProviderClient.Detail empty=new ProviderClient.Detail();
                        empty.item=item;
                        renderDetail(empty,1);
                    }
                });
            }
        });
    }
    private void showDetailSkeleton(ProviderClient.Item item) {
        base(false,true);
        page.setPadding(0,0,0,dp(22));
        FrameLayout hero=new FrameLayout(this);
        ImageView image=poster(item.image);
        hero.addView(image,new FrameLayout.LayoutParams(-1,-1));
        View dim=new View(this);
        dim.setBackground(gradient(0x330B0927,0xFF17102F));
        hero.addView(dim,new FrameLayout.LayoutParams(-1,-1));
        TextView back=action("‹",0x99342865,()->{screen="home";render();});
        FrameLayout.LayoutParams backPos=new FrameLayout.LayoutParams(dp(45),dp(45),Gravity.TOP|Gravity.LEFT);
        backPos.setMargins(dp(17),dp(16),0,0);
        hero.addView(back,backPos);
        TextView save=action(saved.containsKey(item.id)?"♥":"♡",0x99342865,()->{
            toggleSaved(item);
            showDetailSkeleton(item);
        });
        FrameLayout.LayoutParams savePos=new FrameLayout.LayoutParams(dp(45),dp(45),Gravity.TOP|Gravity.RIGHT);
        savePos.setMargins(0,dp(16),dp(17),0);
        hero.addView(save,savePos);
        TextView play=action("▶",0xCC6745EF,()->launchPlayer(item,1,1));
        play.setTextSize(25);
        FrameLayout.LayoutParams playPos=new FrameLayout.LayoutParams(dp(65),dp(65),Gravity.CENTER);
        hero.addView(play,playPos);
        page.addView(hero,new LinearLayout.LayoutParams(-1,dp(335)));
        gap(page,15);
        LinearLayout inner=vertical();
        inner.setPadding(dp(17),0,dp(17),0);
        inner.addView(text(item.year.isEmpty()?"MOVIE WORLD":item.year,12,SOFT,false));
        inner.addView(text(item.title,24,WHITE,true),margins(-1,-2,0,7,0,13));
        LinearLayout chips=horizontal();
        chips.addView(chip("series".equals(item.kind)?"TV Series":"Movie",false,()->{}));
        chips.addView(chip(item.category.isEmpty()?"Featured":item.category,false,()->{}),
            margins(-2,-2,8,0,0,0));
        inner.addView(chips);
        gap(inner,20);
        inner.addView(text("Loading movie details…",13,SOFT,false));
        page.addView(inner);
    }
    private void renderDetail(ProviderClient.Detail detail,int season) {
        ProviderClient.Item item=detail.item;
        showDetailSkeleton(item);
        // Rebuild only the information area; keep the cinematic hero.
        while(page.getChildCount()>2)page.removeViewAt(page.getChildCount()-1);
        LinearLayout content=vertical();
        content.setPadding(dp(18),0,dp(18),dp(25));
        TextView date=text(item.year.isEmpty()?"":item.year+"   •   ",12,SOFT,false);
        content.addView(date);
        content.addView(text(item.title,24,WHITE,true),margins(-1,-2,0,6,0,13));
        LinearLayout metadata=horizontal();
        metadata.addView(chip("series".equals(item.kind)?"Series":"Movie",false,()->{}));
        if(!item.category.isEmpty()){
            String cat=item.category.length()>18?item.category.substring(0,18)+"…":item.category;
            metadata.addView(chip(cat,false,()->{}),margins(-2,-2,8,0,0,0));
        }
        content.addView(metadata);
        gap(content,23);
        LinearLayout actions=horizontal();
        TextView primary=action("▶  "+("series".equals(item.kind)?"Play episode":"Watch now"),VIOLET,
            ()->launchPlayer(item,season,detail.episodes.isEmpty()?1:detail.episodes.get(0).number));
        actions.addView(primary,new LinearLayout.LayoutParams(0,dp(51),1));
        TextView favorite=action(saved.containsKey(item.id)?"♥ Saved":"+ Watchlist",PANEL,()->{
            toggleSaved(item);
            renderDetail(detail,season);
        });
        actions.addView(favorite,margins(-2,dp(51),10,0,0,0));
        content.addView(actions);
        gap(content,25);

        if(!detail.cast.isEmpty()){
            content.addView(text("Cast",17,WHITE,true));
            gap(content,12);
            HorizontalScrollView rail=new HorizontalScrollView(this);
            rail.setHorizontalScrollBarEnabled(false);
            LinearLayout people=horizontal();
            for(String actor:detail.cast){
                LinearLayout person=vertical();
                person.setGravity(Gravity.CENTER_HORIZONTAL);
                TextView avatar=text(actor.substring(0,1).toUpperCase(),24,WHITE,true);
                avatar.setGravity(Gravity.CENTER);
                avatar.setBackground(gradient(0xFF7154BB,0xFF2E1E61));
                person.addView(avatar,new LinearLayout.LayoutParams(dp(68),dp(76)));
                TextView name=text(actor,11,SOFT,false);
                name.setGravity(Gravity.CENTER);
                name.setMaxLines(2);
                name.setEllipsize(android.text.TextUtils.TruncateAt.END);
                person.addView(name,margins(-1,dp(36),0,6,0,0));
                people.addView(person,margins(dp(87),-2,0,0,8,0));
            }
            rail.addView(people);content.addView(rail);
            gap(content,22);
        }
        if(!detail.description.isEmpty()){
            content.addView(text("Synopsis",17,WHITE,true));
            gap(content,9);
            content.addView(text(detail.description,13,0xFFD7D0E9,false));
            gap(content,23);
        }
        if("series".equals(item.kind)){
            content.addView(text("Seasons & Episodes",18,WHITE,true));
            gap(content,12);
            HorizontalScrollView seasonRail=new HorizontalScrollView(this);
            LinearLayout seasonRow=horizontal();
            for(int s:detail.seasons){
                seasonRow.addView(chip("Season "+s,s==season,()->loadSeason(item,s)),
                    margins(-2,-2,0,0,8,0));
            }
            seasonRail.addView(seasonRow);
            content.addView(seasonRail);
            gap(content,14);
            if(detail.episodes.isEmpty())content.addView(text("No episode details available.",13,SOFT,false));
            for(ProviderClient.Episode ep:detail.episodes){
                LinearLayout row=horizontal();
                row.setBackground(stroked(PANEL,14));
                row.setPadding(dp(13),dp(14),dp(13),dp(14));
                TextView number=text(String.valueOf(ep.number),19,WHITE,true);
                row.addView(number,new LinearLayout.LayoutParams(dp(38),-2));
                TextView name=text(ep.title,13,WHITE,true);
                name.setMaxLines(2);
                name.setEllipsize(android.text.TextUtils.TruncateAt.END);
                row.addView(name,new LinearLayout.LayoutParams(0,-2,1));
                row.addView(text("▶",18,SOFT,true));
                row.setOnClickListener(v->launchPlayer(item,season,ep.number));
                content.addView(row,margins(-1,-2,0,0,0,9));
            }
        }
        page.addView(content);
    }
    private void loadSeason(ProviderClient.Item item,int season) {
        int token=requestId.incrementAndGet();
        network.execute(()->{
            try{
                ProviderClient.Detail data=ProviderClient.detail(item,season);
                runOnUiThread(()->{
                    if(token==requestId.get()&&"detail".equals(screen))renderDetail(data,season);
                });
            }catch(Exception ex){
                runOnUiThread(()->{
                    if(token==requestId.get())new AlertDialog.Builder(this)
                        .setMessage("Couldn't load season: "+ex.getMessage()).setPositiveButton("OK",null).show();
                });
            }
        });
    }
    private void launchPlayer(ProviderClient.Item item,int season,int episode){
        Intent intent=new Intent(this,PlayerActivity.class);
        intent.putExtra("id",item.id);
        intent.putExtra("kind",item.kind);
        intent.putExtra("title",item.title);
        intent.putExtra("season",season);
        intent.putExtra("episode",episode);
        startActivity(intent);
    }

    @Override public void onBackPressed(){
        if("detail".equals(screen)){
            requestId.incrementAndGet();screen="home";render();
        }else if(!"home".equals(screen)){
            navigate("home");
        }else super.onBackPressed();
    }
    @Override protected void onDestroy(){
        requestId.incrementAndGet();
        network.shutdownNow();
        super.onDestroy();
    }
}

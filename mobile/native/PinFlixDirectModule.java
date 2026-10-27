package com.pincodeit.pinflix.source;

import android.net.Uri;
import android.graphics.Bitmap;
import android.util.Base64;
import android.util.Log;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import java.util.ArrayList;
import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

public final class PinFlixDirectModule extends ReactContextBaseJavaModule {
    private final ExecutorService io=Executors.newFixedThreadPool(3);
    private final ExecutorService artworkIo=Executors.newFixedThreadPool(3);
    private final Map<String, ProviderClient.Item> known=new ConcurrentHashMap<>();
    private static final Pattern ID=Pattern.compile("^(movie|series)-[0-9]{1,12}$");

    PinFlixDirectModule(ReactApplicationContext context){super(context);}

    @NonNull @Override public String getName(){return "PinFlixDirect";}

    private static WritableArray strings(List<String> items){
        WritableArray a=Arguments.createArray();
        for(String item:items)a.pushString(item);
        return a;
    }

    private static WritableMap toTitle(ProviderClient.Item value){
        WritableMap m=Arguments.createMap();
        m.putString("id",value.id);
        m.putString("providerId",ProviderClient.providerId(value));
        m.putString("kind",value.kind);
        m.putString("title",value.title);
        if(value.image==null||value.image.isEmpty()){m.putNull("poster");m.putNull("backdrop");}
        else{m.putString("poster",value.image);m.putString("backdrop",value.image);}
        int year=0;
        try{year=Integer.parseInt(value.year);}catch(NumberFormatException ignored){}
        if(year>0)m.putInt("year",year);else m.putNull("year");
        m.putString("category",value.category==null?"":value.category);
        m.putNull("language");
        m.putNull("quality");
        m.putNull("rating");
        m.putBoolean("mature",false);
        m.putString("synopsis","");
        WritableArray genres=Arguments.createArray();
        if(value.category!=null&&!value.category.isEmpty())genres.pushString(value.category);
        m.putArray("genres",genres);
        m.putArray("cast",Arguments.createArray());
        m.putArray("seasons",Arguments.createArray());
        return m;
    }
    private ProviderClient.Item item(String id){
        if(id==null||!ID.matcher(id).matches())throw new IllegalArgumentException("Invalid content ID");
        ProviderClient.Item cached=known.get(id);
        if(cached!=null)return cached;
        String kind=id.startsWith("series-")?"series":"movie";
        return new ProviderClient.Item(id,kind,"Video "+id,"","","");
    }

    private static boolean matches(ProviderClient.Item item,String kind,String category,String year,String lang,String quality){
        if(!"all".equals(kind)&&!item.kind.equals(kind))return false;
        if(category!=null&&!category.isEmpty()&&!item.category.toLowerCase().contains(category.toLowerCase()))return false;
        if(year!=null&&!year.isEmpty()&&!year.equals(item.year))return false;
        // The old provider did not supply searchable language/quality fields.
        // Do not invent matches for unverified metadata.
        if(lang!=null&&!lang.isEmpty())return false;
        if(quality!=null&&!quality.isEmpty())return false;
        return true;
    }
    private void async(Promise p,Task task){
        async(io,p,task);
    }
    private void async(ExecutorService executor,Promise p,Task task){
        executor.execute(()->{try{p.resolve(task.run());}catch(Exception e){p.reject("PINFLIX_DIRECT",e.getMessage()==null?"Source unavailable":e.getMessage(),e);}});
    }
    private interface Task{Object run() throws Exception;}

    @ReactMethod public void catalogue(String kind,int page,String query,String category,String year,String lang,String quality,String sort,Promise promise){
        async(promise,()->{
            String selected=kind==null||kind.isEmpty()?"all":kind;
            if(!selected.equals("all")&&!selected.equals("movie")&&!selected.equals("series"))throw new Exception("Unknown catalogue type");
            if(page<1||page>1000)throw new Exception("Invalid page");
            String q=query==null?"":query.trim();
            String cat=category==null?"":category.trim();
            if(q.length()>140||cat.length()>140)throw new Exception("Query too long");
            List<ProviderClient.Item> found=new ArrayList<>();
            // Reuse the SAME Java parsing logic that powered the old APK.
            if(!q.isEmpty()){
                found.addAll(ProviderClient.catalogue(selected.equals("series")?"series":"movie",page,q));
            }else if(!cat.isEmpty()){
                if(selected.equals("all")){
                    found.addAll(ProviderClient.category("movie",cat,page));
                    found.addAll(ProviderClient.category("series",cat,page));
                }else found.addAll(ProviderClient.category(selected,cat,page));
            }else if(selected.equals("all")){
                found.addAll(ProviderClient.catalogue("movie",page,""));
                found.addAll(ProviderClient.catalogue("series",page,""));
            }else found.addAll(ProviderClient.catalogue(selected,page,""));

            Map<String,ProviderClient.Item> unique=new LinkedHashMap<>();
            for(ProviderClient.Item value:found){
                if(matches(value,selected,cat,year,lang,quality))unique.put(value.id,value);
            }
            List<ProviderClient.Item> items=new ArrayList<>(unique.values());
            if("title".equals(sort))items.sort(Comparator.comparing(x->x.title.toLowerCase()));
            else if("year".equals(sort))items.sort((x,y)->y.year.compareTo(x.year));
            WritableArray out=Arguments.createArray();
            WritableArray years=Arguments.createArray();
            java.util.Set<String> seenYears=new java.util.TreeSet<>();
            for(ProviderClient.Item value:items){
                known.put(value.id,value);
                out.pushMap(toTitle(value));
                if(value.year!=null&&value.year.matches("[0-9]{4}"))seenYears.add(value.year);
            }
            for(String y:seenYears)years.pushInt(Integer.parseInt(y));
            WritableMap result=Arguments.createMap();
            result.putArray("items",out);result.putInt("page",page);
            result.putBoolean("hasNext",items.size()>0&&q.isEmpty()&&
                (!"series".equals(selected)||page==1||items.size()>=24));
            result.putBoolean("stale",false);
            result.putArray("years",years);
            result.putArray("categories",Arguments.createArray());
            result.putMap("facets",Arguments.createMap());
            return result;
        });
    }

    @ReactMethod public void detail(String id,int season,Promise promise){
        async(promise,()->{
            ProviderClient.Item title=item(id);
            ProviderClient.Detail detail=ProviderClient.detail(title,season);
            WritableMap titleMap=toTitle(detail.item);
            titleMap.putString("synopsis",detail.description);
            titleMap.putArray("cast",strings(detail.cast));
            WritableArray seasons=Arguments.createArray();
            for(Integer s:detail.seasons)seasons.pushInt(s);
            titleMap.putArray("seasons",seasons);

            WritableArray episodes=Arguments.createArray();
            for(ProviderClient.Episode ep:detail.episodes){
                WritableMap m=Arguments.createMap();
                m.putInt("number",ep.number);
                m.putInt("season",season);
                m.putString("title",ep.title);
                if(ep.image.isEmpty())m.putNull("thumbnail");
                else m.putString("thumbnail",ep.image);
                m.putNull("quality");
                episodes.pushMap(m);
            }
            WritableMap out=Arguments.createMap();
            out.putMap("title",titleMap);
            out.putArray("episodes",episodes);
            out.putArray("related",Arguments.createArray());
            out.putInt("season",season);
            return out;
        });
    }

    @ReactMethod public void playback(String id,int season,int episode,Promise promise){
        async(promise,()->{
            ProviderClient.Item target=item(id);
            ProviderClient.Stream stream=ProviderClient.playback(target,season,episode);
            // The legacy Java provider enforces the exact source host/port allowlist.
            if(!ProviderClient.allowedMedia(Uri.parse(stream.url)))throw new Exception("Media source is not approved");
            Log.i("PinFlixDirect", "Resolved " + id + " episode " + episode + " as " + (stream.hls?"HLS":"MP4"));
            WritableMap out=Arguments.createMap();
            out.putString("status","ready");
            out.putString("message","");
            out.putString("url",stream.url);
            out.putString("format",stream.hls?"hls":"mp4");
            out.putString("transport","direct");
            WritableMap headers=Arguments.createMap();
            for(Map.Entry<String,String> e:stream.headers.entrySet())headers.putString(e.getKey(),e.getValue());
            out.putMap("headers",headers);
            out.putArray("subtitles",Arguments.createArray());
            return out;
        });
    }

    @ReactMethod public void poster(String url,Promise promise){
        async(artworkIo,promise,()->{
            Bitmap bitmap=ProviderClient.poster(url);
            if(bitmap==null)throw new Exception("Artwork unavailable");
            try(ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                if(!bitmap.compress(Bitmap.CompressFormat.JPEG,82,bytes))throw new Exception("Artwork could not be decoded");
                return "data:image/jpeg;base64,"+Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP);
            }finally{bitmap.recycle();}
        });
    }

    @Override public void invalidate(){io.shutdownNow();artworkIo.shutdownNow();super.invalidate();}
}

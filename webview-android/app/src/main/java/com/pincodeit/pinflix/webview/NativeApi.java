package com.pincodeit.pinflix.webview;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import org.json.JSONArray;
import org.json.JSONObject;
import org.jsoup.Jsoup;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;
import java.util.regex.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Bundled HTTPS UI -> device-side provider requests. No remote application host. */
final class NativeApi {
 static final String HOST="appassets.androidplatform.net";
 private final Context context;
 private final byte[] key=new byte[32];
 private final Map<String,ProviderClient.Item> known=Collections.synchronizedMap(new LinkedHashMap<String,ProviderClient.Item>(100,0.75f,true){protected boolean removeEldestEntry(Map.Entry<String,ProviderClient.Item> e){return size()>200;}});
 private final Map<String,ProviderClient.Detail> details=Collections.synchronizedMap(new LinkedHashMap<String,ProviderClient.Detail>(100,0.75f,true){protected boolean removeEldestEntry(Map.Entry<String,ProviderClient.Detail> e){return size()>100;}});
 NativeApi(Context context){this.context=context;new SecureRandom().nextBytes(key);}

 static WebResourceResponse bytes(int status,String mime,byte[] bytes){
  Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");
  return new WebResourceResponse(mime,mime.startsWith("text/")||mime.contains("json")?"UTF-8":null,status,status<400?"OK":"Unavailable",headers,new ByteArrayInputStream(bytes));
 }
 static WebResourceResponse json(int status,Object data){return bytes(status,"application/json",data.toString().getBytes(StandardCharsets.UTF_8));}
 WebResourceResponse handle(WebResourceRequest request){
  Uri uri=request.getUrl();
  if(!HOST.equals(uri.getHost())||!"https".equals(uri.getScheme())||uri.getUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443))return bytes(403,"text/plain",new byte[0]);
  try{
   String path=uri.getPath();
   if(path.startsWith("/api/cineplex/media/"))return media(request);
   if(!"GET".equals(request.getMethod()))return bytes(405,"text/plain",new byte[0]);
   if(path.equals("/api/cineplex/image"))return image(uri.getQueryParameter("url"));
   if(path.startsWith("/api/cineplex/"))return json(200,api(uri));
   if(path.equals("/"))path="/index.html";
   if(path.contains("..")||path.indexOf('\0')>=0)return bytes(400,"text/plain",new byte[0]);
   InputStream data=context.getAssets().open("web"+path);
   String mime=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".html")?"text/html":path.endsWith(".svg")?"image/svg+xml":"application/octet-stream";
   Map<String,String> headers=new HashMap<>();
   headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'");
   headers.put("X-Content-Type-Options","nosniff");
   return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,data);
  }catch(FileNotFoundException e){return bytes(404,"text/plain",new byte[0]);}
  catch(IllegalArgumentException e){return json(400,error("Invalid request."));}
  catch(Exception e){return json(503,error("CineplexBD is unavailable on this network. Check your connection and retry."));}
 }
 private static JSONObject error(String message){JSONObject o=new JSONObject();try{o.put("error",message);}catch(Exception ignored){}return o;}
 private static String q(Uri u,String name){String s=u.getQueryParameter(name);return s==null?"":s.trim();}
 private static int number(String input,int fallback,int maximum){if(input.isEmpty())return fallback;int n=Integer.parseInt(input);if(n<1||n>maximum)throw new IllegalArgumentException();return n;}
 private static String id(String value){if(!value.matches("\\d{1,12}"))throw new IllegalArgumentException();return value;}
 private ProviderClient.Item item(String id,String kind){id=id(id);if(!kind.equals("movie")&&!kind.equals("series"))throw new IllegalArgumentException();ProviderClient.Item item=known.get(kind+":"+id);return item!=null?item:new ProviderClient.Item(kind+"-"+id,kind,(kind.equals("movie")?"Movie ":"Series ")+id,"","","");}
 private JSONObject title(ProviderClient.Item item)throws Exception{
  String id=ProviderClient.providerId(item);known.put(item.kind+":"+id,item);
  JSONObject o=new JSONObject().put("id",id).put("title",item.title).put("type",item.kind).put("source","cineplexbd").put("category",item.category).put("poster",item.image).put("detailUrl",ProviderClient.BASE+(item.kind.equals("series")?"/watch.php?id=":"/view.php?id=")+id);
  if(item.year.matches("\\d{4}"))o.put("year",Integer.parseInt(item.year));return o;
 }
 private JSONObject page(List<ProviderClient.Item> items,int page,int pages,boolean more,String query,String notice)throws Exception{
  JSONArray array=new JSONArray();for(ProviderClient.Item item:items)array.put(title(item));
  return new JSONObject().put("items",array).put("page",page).put("totalPages",Math.max(page,pages)).put("hasMore",more).put("totalFound",items.size()).put("query",query).put("sourceStatus","live").put("countScope","page").put("notice",notice);
 }
 private JSONObject search(Uri u,boolean suggestions)throws Exception{
  String query=q(u,"q");if(query.isEmpty())query=q(u,"name");
  String type=q(u,"type");if(type.isEmpty())type="all";
  if(!Arrays.asList("all","movie","series","anime","wrestling").contains(type))throw new IllegalArgumentException();
  int page=number(q(u,"page"),1,10000),limit=number(q(u,"limit"),suggestions?8:30,60);
  for(String param:Arrays.asList("q","name","generic","actors","category"))if(q(u,param).length()>160)throw new IllegalArgumentException();
  if(suggestions&&query.isEmpty())return page(new ArrayList<>(),1,1,false,"","");
  List<ProviderClient.Item> items;boolean more=false;int pages=page;String notice="Matching titles on this source page.";
  if(query.isEmpty()&&q(u,"category").isEmpty()&&q(u,"generic").isEmpty()&&q(u,"actors").isEmpty()&&u.getQueryParameters("year[]").isEmpty()&&(type.equals("movie")||type.equals("series"))){
   items=ProviderClient.catalogue(type,page,"");more=items.size()>=24;pages=more?page+1:page;
  }else{
   Uri.Builder b=Uri.parse(ProviderClient.BASE+(suggestions?"/search_ajax.php":"/search.php")).buildUpon();
   if(!query.isEmpty())b.appendQueryParameter("q",query);
   b.appendQueryParameter("page",String.valueOf(page));if(suggestions)b.appendQueryParameter("limit",String.valueOf(limit));
   for(String param:Arrays.asList("category","generic","actors"))if(!q(u,param).isEmpty())b.appendQueryParameter(param,q(u,param));
   List<String> years=new ArrayList<>(u.getQueryParameters("year[]"));years.addAll(u.getQueryParameters("year"));if(years.size()>30)throw new IllegalArgumentException();
   for(String year:years){int y=number(year,0,2100);if(y<1888)throw new IllegalArgumentException();b.appendQueryParameter("year[]",year);}
   String path=b.build().toString().substring(ProviderClient.BASE.length());
   String html=ProviderClient.text(path);
   if(suggestions){
    JSONArray result=new JSONObject(html).optJSONArray("results");if(result==null)throw new IOException("Invalid suggestions");items=new ArrayList<>();
    for(int n=0;n<result.length();n++){JSONObject o=result.optJSONObject(n);if(o==null)continue;String k=o.optString("type","movie");String numeric=o.optString("id","");if(!numeric.matches("\\d{1,12}")||(!k.equals("movie")&&!k.equals("series")))continue;
     items.add(new ProviderClient.Item(k+"-"+numeric,k,o.optString("title"),ProviderClient.resolve(o.optString("poster"),ProviderClient.BASE+"/"),o.optString("category"),o.optString("year")));
    }
   }else{
    items=ProviderClient.fromHtml(html);String text=Jsoup.parse(html).text();
    if(items.isEmpty()&&!text.matches("(?is).*no (results|movies|series|items).*|.*0\\s+item found.*"))throw new IOException("Unrecognized source page");
    Matcher m=Pattern.compile("Page\\s+(\\d+)\\s+of\\s+([\\d,]+)",Pattern.CASE_INSENSITIVE).matcher(text);if(m.find())pages=Integer.parseInt(m.group(2).replace(",",""));more=page<pages;
   }
  }
  final String selected=type;
  items.removeIf(x-> selected.equals("movie")&&!x.kind.equals("movie")||selected.equals("series")&&!x.kind.equals("series")||selected.equals("anime")&&!x.category.toLowerCase(Locale.ROOT).matches(".*(anime|animation|cartoon).*")||selected.equals("wrestling")&&!x.category.toLowerCase(Locale.ROOT).matches(".*(wwe|aew|wrestling).*"));
  if(q(u,"sort").equals("title"))items.sort((a,b)->a.title.compareToIgnoreCase(b.title));
  if(suggestions&&items.size()>limit)items=new ArrayList<>(items.subList(0,limit));
  return page(items,page,pages,more,query,suggestions?"":notice);
 }
 private JSONObject season(ProviderClient.Detail d,int number)throws Exception{
  JSONArray episodes=new JSONArray();String seriesId=ProviderClient.providerId(d.item);
  for(ProviderClient.Episode ep:d.episodes)episodes.put(new JSONObject().put("id","s"+number+"e"+ep.number).put("episodeNumber",ep.number).put("title",ep.title).put("isPlayable",!ep.path.isEmpty()).put("detailUrl",ProviderClient.BASE+"/watch.php?id="+seriesId+"&season="+number+"&ep="+ep.number));
  return new JSONObject().put("seasonNumber",number).put("title","Season "+number).put("episodeCount",episodes.length()).put("episodes",episodes);
 }
 private ProviderClient.Detail detail(String id,String type,int number)throws Exception{
  ProviderClient.Detail d=ProviderClient.detail(item(id,type),number);known.put(type+":"+id,d.item);details.put(type+":"+id+":"+number,d);return d;
 }
 private JSONObject stream(ProviderClient.Stream s)throws Exception{return new JSONObject().put("url",ticket(s.url)).put("label","Source").put("quality","Source").put("format",s.hls?"hls":"mp4").put("verified",true);}
 private Object api(Uri u)throws Exception{
  String p=u.getPath();
  if(p.equals("/api/cineplex/latest")){
   List<ProviderClient.Item> list=ProviderClient.fromHtml(ProviderClient.text("/index.php"));list.removeIf(x->!x.kind.equals("movie"));if(list.isEmpty())throw new IOException("No source cards");
   return page(new ArrayList<>(list.subList(0,Math.min(12,list.size()))),1,1,false,"","");
  }
  if(p.equals("/api/cineplex/search"))return search(u,true);
  if(p.equals("/api/cineplex/search/advanced"))return search(u,false);
  if(p.equals("/api/cineplex/health")){
   boolean connected=false;long start=System.currentTimeMillis();try{connected=new JSONObject(ProviderClient.text("/search_ajax.php?q=Avatar&limit=1")).optJSONArray("results")!=null;}catch(Exception ignored){}
   return new JSONObject().put("status",connected?"healthy":"offline").put("endpoint",ProviderClient.BASE).put("directAccessible",connected).put("snapshotItems",0).put("reportedCatalogItems",0).put("latencyMs",System.currentTimeMillis()-start).put("lastChecked",new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.ROOT).format(new Date())).put("notes",connected?"Connected directly from this Android device. Playback is checked separately.":"CineplexBD did not respond on this network. This APK bundles the interface, with no saved catalogue or replacement films.");
  }
  if(p.matches("/api/cineplex/video/\\d{1,12}")){
   String id=p.substring(p.lastIndexOf('/')+1),type=q(u,"type");ProviderClient.Detail d=detail(id,type,1);
   JSONObject result=title(d.item).put("synopsis",d.description).put("actors",new JSONArray(d.cast)).put("sourceStatus","live").put("playableStreams",new JSONArray());
   if(type.equals("series")){JSONArray seasons=new JSONArray();for(int n:d.seasons)seasons.put(n==1?season(d,n):new JSONObject().put("seasonNumber",n).put("title","Season "+n).put("episodeCount",0).put("episodes",new JSONArray()));result.put("seasons",seasons);}
   return result;
  }
  if(p.matches("/api/cineplex/series/\\d{1,12}/episodes")){String id=p.split("/")[4];int n=number(q(u,"season"),1,1000);return season(detail(id,"series",n),n);}
  if(p.equals("/api/cineplex/playback")){
   String id=id(q(u,"id")),type=q(u,"type");int season=1,episode=0;
   if(type.equals("series")){
    Matcher m=Pattern.compile("s(\\d+)e(\\d+)").matcher(q(u,"episode"));if(!m.matches())return new JSONObject().put("streams",new JSONArray()).put("notice","Select an episode from the source list first.");
    season=number(m.group(1),1,1000);episode=number(m.group(2),1,100000);
    ProviderClient.Detail d=details.get(type+":"+id+":"+season);if(d==null)d=detail(id,type,season);
    boolean found=false;for(ProviderClient.Episode ep:d.episodes)if(ep.number==episode)found=true;if(!found)throw new IllegalArgumentException();
   }
   return new JSONObject().put("streams",new JSONArray().put(stream(ProviderClient.playback(item(id,type),season,episode))));
  }
  throw new IllegalArgumentException();
 }
 private WebResourceResponse image(String url)throws Exception{
  if(url==null||!ProviderClient.allowedImage(Uri.parse(url)))throw new IllegalArgumentException();
  byte[] data=ProviderClient.get(url,true,3*1024*1024);String mime=data.length>3&&(data[0]&255)==0x89?"image/png":data.length>12&&data[0]=='R'?"image/webp":"image/jpeg";return bytes(200,mime,data);
 }
 private byte[] mac(String value)throws Exception{Mac m=Mac.getInstance("HmacSHA256");m.init(new SecretKeySpec(key,"HmacSHA256"));return m.doFinal(value.getBytes(StandardCharsets.US_ASCII));}
 private static String b64(byte[] bytes){return Base64.encodeToString(bytes,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);}
 String ticket(String url)throws Exception{
  if(!ProviderClient.allowedMedia(Uri.parse(url)))throw new IllegalArgumentException();
  String payload=b64(new JSONObject().put("u",url).put("e",System.currentTimeMillis()+21600000L).toString().getBytes(StandardCharsets.UTF_8));return "/api/cineplex/media/"+payload+"."+b64(mac(payload));
 }
 String decode(String ticket)throws Exception{
  String[] parts=ticket.split("\\.");if(parts.length!=2||!MessageDigest.isEqual(mac(parts[0]),Base64.decode(parts[1],Base64.URL_SAFE)))throw new IllegalArgumentException();
  JSONObject o=new JSONObject(new String(Base64.decode(parts[0],Base64.URL_SAFE),StandardCharsets.UTF_8));String url=o.getString("u");if(o.getLong("e")<System.currentTimeMillis()||!ProviderClient.allowedMedia(Uri.parse(url)))throw new IllegalArgumentException();return url;
 }
 private String rewrite(String text,String base)throws Exception{
  if(!text.trim().startsWith("#EXTM3U"))throw new IOException("Invalid HLS");StringBuilder out=new StringBuilder();
  for(String line:text.split("\\r?\\n")){
   if(line.startsWith("#")){Matcher m=Pattern.compile("URI=\"([^\"]+)\"").matcher(line);StringBuffer b=new StringBuffer();while(m.find())m.appendReplacement(b,Matcher.quoteReplacement("URI=\""+ticket(ProviderClient.resolve(m.group(1),base))+"\""));m.appendTail(b);out.append(b);}
   else if(!line.trim().isEmpty())out.append(ticket(ProviderClient.resolve(line.trim(),base)));
   out.append('\n');
  }return out.toString();
 }
 private static byte[] read(InputStream input,int limit)throws Exception{try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;long deadline=System.currentTimeMillis()+12000;while((n=in.read(b))!=-1){if(out.size()+n>limit||System.currentTimeMillis()>deadline)throw new IOException("Response limit");out.write(b,0,n);}return out.toByteArray();}}
 private WebResourceResponse media(WebResourceRequest request)throws Exception{
  String url=decode(request.getUrl().getLastPathSegment());if(request.getUrl().getQuery()!=null)throw new IllegalArgumentException();
  if(!request.getMethod().equals("GET")&&!request.getMethod().equals("HEAD"))return bytes(405,"text/plain",new byte[0]);
  for(int hop=0;hop<4;hop++){
   if(!ProviderClient.allowedMedia(Uri.parse(url)))throw new IllegalArgumentException();
   HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(6000);c.setReadTimeout(12000);c.setRequestMethod(request.getMethod());c.setRequestProperty("Referer",ProviderClient.BASE+"/");c.setRequestProperty("User-Agent","PinFlixDirect/1.5 Android");c.setRequestProperty("Accept-Encoding","identity");
   String range=request.getRequestHeaders().get("Range");if(range==null)range=request.getRequestHeaders().get("range");if(range!=null){if(!range.matches("bytes=(\\d+-\\d*|-\\d+)")){c.disconnect();throw new IllegalArgumentException();}c.setRequestProperty("Range",range);}
   int status=c.getResponseCode();
   if(status>=300&&status<400){String next=c.getHeaderField("Location");c.disconnect();if(next==null)throw new IOException("Invalid redirect");url=ProviderClient.resolve(next,url);continue;}
   if(status!=200&&status!=206){c.disconnect();return bytes(status>=400&&status<600?status:502,"text/plain",new byte[0]);}
   String mime=c.getContentType();if(mime==null)mime=url.toLowerCase(Locale.ROOT).contains(".m3u8")?"application/vnd.apple.mpegurl":"video/mp4";mime=mime.split(";")[0];
   if(mime.contains("html")||mime.contains("json")||mime.contains("javascript")){c.disconnect();throw new IOException("Not media");}
   if(!request.getMethod().equals("HEAD")&&(Uri.parse(url).getPath().endsWith(".m3u8")||mime.contains("mpegurl"))){try{return bytes(200,"application/vnd.apple.mpegurl",rewrite(new String(read(c.getInputStream(),2*1024*1024),StandardCharsets.UTF_8),url).getBytes(StandardCharsets.UTF_8));}finally{c.disconnect();}}
   Map<String,String> headers=new HashMap<>();for(String name:Arrays.asList("Content-Length","Content-Range","Accept-Ranges","ETag","Last-Modified")){String value=c.getHeaderField(name);if(value!=null)headers.put(name,value);}headers.put("Cache-Control","no-store");
   InputStream body=request.getMethod().equals("HEAD")?new ByteArrayInputStream(new byte[0]):c.getInputStream();
   InputStream stream=new FilterInputStream(body){@Override public void close()throws IOException{try{super.close();}finally{c.disconnect();}}};
   return new WebResourceResponse(mime,null,status,"OK",headers,stream);
  }throw new IOException("Too many redirects");
 }
}

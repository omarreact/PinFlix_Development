package com.pincodeit.pinflix.webview;

import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.*;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.io.*;

@RunWith(AndroidJUnit4.class)
public class WebViewSmokeTest {
 private Instrumentation instrument;
 private MainActivity activity;
 private WebView web;
 private NativeApi nativeApi;
 private static final String TITLE="Synthetic playback check";
 @Before public void start()throws Exception{
  instrument=InstrumentationRegistry.getInstrumentation();
  Intent intent=new Intent(instrument.getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
  activity=(MainActivity)instrument.startActivitySync(intent);web=activity.browserForTest();nativeApi=new NativeApi(instrument.getTargetContext());
  instrument.runOnMainSync(()->{web.stopLoading();web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
   try{
    String path=req.getUrl().getPath();
    if(path.startsWith("/__test/")){
     String name=path.substring("/__test/".length());if(name.contains(".."))throw new IOException();
     String mime=name.endsWith("m3u8")?"application/vnd.apple.mpegurl":name.endsWith("mpd")?"application/dash+xml":name.endsWith(".ts")?"video/mp2t":"video/mp4";
     return new WebResourceResponse(mime,null,instrument.getContext().getAssets().open("media/"+name));
    }
    if(path.startsWith("/api/cineplex/")){
     JSONObject item=new JSONObject().put("id","42").put("title",TITLE).put("type","movie").put("source","cineplexbd").put("category","Instrumentation fixture only").put("year",2026).put("detailUrl","http://cineplexbd.net/view.php?id=42");
     if(path.equals("/api/cineplex/playback")){
      JSONArray streams=new JSONArray();String[] files={"sample.mp4","hls/index.m3u8","dash/manifest.mpd"};String[] formats={"mp4","hls","dash"};
      for(int n=0;n<3;n++)streams.put(new JSONObject().put("url","/__test/"+files[n]).put("label",formats[n]).put("quality",formats[n]).put("format",formats[n]).put("verified",true));
      return NativeApi.json(200,new JSONObject().put("streams",streams));
     }
     if(path.startsWith("/api/cineplex/video/"))return NativeApi.json(200,item.put("synopsis","Synthetic instrumentation fixture, not provider content.").put("sourceStatus","live").put("playableStreams",new JSONArray()));
     return NativeApi.json(200,new JSONObject().put("items",new JSONArray().put(item)).put("page",1).put("totalPages",1).put("totalFound",1).put("hasMore",false).put("query","").put("sourceStatus","live").put("countScope","page"));
    }
    return nativeApi.handle(req);
   }catch(Exception e){return NativeApi.bytes(500,"text/plain",e.toString().getBytes());}
  }});web.loadUrl("https://appassets.androidplatform.net/");});
  waitJs("!!document.querySelector('[aria-label=\"View latest movie "+TITLE+"\"]')",30000);
 }
 @After public void finish(){if(activity!=null)instrument.runOnMainSync(()->activity.finish());}
 private String eval(String script)throws Exception{
  AtomicReference<String> value=new AtomicReference<>();CountDownLatch latch=new CountDownLatch(1);
  instrument.runOnMainSync(()->web.evaluateJavascript(script,result->{value.set(result);latch.countDown();}));
  assertTrue("JavaScript callback",latch.await(10,TimeUnit.SECONDS));return value.get();
 }
 private void waitJs(String condition,long timeout)throws Exception{
  long end=SystemClock.uptimeMillis()+timeout;while(SystemClock.uptimeMillis()<end){if("true".equals(eval(condition)))return;SystemClock.sleep(150);}fail("Condition timed out: "+condition+"; body="+eval("document.body.innerText"));
 }
 private void openPlayer()throws Exception{
  eval("document.querySelector('[aria-label=\"View latest movie "+TITLE+"\"]').click()");
  waitJs("!!document.querySelector('dialog[open]') && Array.from(document.querySelectorAll('button')).some(b=>b.innerText.includes('Watch movie')&&!b.disabled)",20000);
  eval("Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('Watch movie')).click()");
  waitJs("!!document.querySelector('video') && document.querySelector('video').readyState>=1",20000);
 }
 @Test public void nativeSourceAndTicketRules()throws Exception{
  assertTrue(ProviderClient.allowedMedia(Uri.parse("http://103.136.200.124:8086/Movies/test.mp4?token=abc")));
  assertFalse(ProviderClient.allowedMedia(Uri.parse("http://103.136.200.124:8080/a.mp4")));
  assertFalse(ProviderClient.allowedMedia(Uri.parse("http://127.0.0.1/a.mp4")));
  assertFalse(ProviderClient.allowedMedia(Uri.parse("https://vercel.app/a.mp4")));
  String url="http://vod.cineplexbd.net:8081/tv-series/test/index.m3u8?token=abc";
  String ticket=nativeApi.ticket(url);assertEquals(url,nativeApi.decode(ticket.substring(ticket.lastIndexOf('/')+1)));
  try{nativeApi.decode(ticket.substring(ticket.lastIndexOf('/')+1)+"x");fail("tampered ticket accepted");}catch(IllegalArgumentException expected){}
  assertEquals(1,ProviderClient.fromHtml("<main><a href='view.php?id=42'><span class='movie-title'>Test title</span><p>English • 2026</p></a></main>").size());
 }
 @Test public void bundledUiSearchAndBack()throws Exception{
  assertEquals("true",eval("document.documentElement.scrollWidth<=innerWidth"));
  eval("document.querySelector('[aria-label=\"View latest movie "+TITLE+"\"]').click()");waitJs("!!document.querySelector('dialog[open]')",20000);
  instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);waitJs("!document.querySelector('dialog[open]')",10000);
  assertFalse(activity.isFinishing());
 }
 @Test public void mp4HlsDashAndFullscreenBack()throws Exception{
  openPlayer();
  for(int n=0;n<3;n++){
   System.out.println("PLAYBACK_FORMAT="+new String[]{"mp4","hls","dash"}[n]);
   eval("window.previousVideo=document.querySelector('video')");
   eval("(()=>{const s=document.querySelector('[aria-label=\"Playback quality\"]');s.value='"+n+"';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
   if(n>0)waitJs("!!document.querySelector('video') && document.querySelector('video')!==window.previousVideo",10000);
   waitJs("!!document.querySelector('video') && document.querySelector('video').readyState>=1",30000);
   eval("(()=>{const v=document.querySelector('video');v.muted=true;v.currentTime=0;v.play().catch(e=>window.playFailure=e.message);})()");
   waitJs("document.querySelector('video').currentTime>0.1",20000);
  }
  eval("document.querySelector('[aria-label=\"Fullscreen\"]').scrollIntoView({block:'center'})");SystemClock.sleep(500);
  JSONArray rect=new JSONArray(eval("(()=>{const r=document.querySelector('[aria-label=\"Fullscreen\"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth];})()"));
  int[] origin=new int[2];instrument.runOnMainSync(()->web.getLocationOnScreen(origin));float scale=web.getWidth()/(float)rect.getDouble(2);
  float x=origin[0]+(float)rect.getDouble(0)*scale,y=origin[1]+(float)rect.getDouble(1)*scale;long now=SystemClock.uptimeMillis();
  instrument.sendPointerSync(MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0));instrument.sendPointerSync(MotionEvent.obtain(now,now+80,MotionEvent.ACTION_UP,x,y,0));
  waitJs("!!document.fullscreenElement",10000);
  instrument.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK);waitJs("!document.fullscreenElement",10000);assertFalse(activity.isFinishing());
 }
}

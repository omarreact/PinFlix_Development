import test from "node:test";
import assert from "node:assert/strict";
import {allowedDirectSource,directStreamFromValue,extractLegacySource,resolveLegacyDirect} from "./legacy-source";

test("legacy exact v1.1 movie videoSrc, escaped URL and token",()=>{
  const html='<script>const videoSrc = "http:\\/\\/103.136.200.124:8086\\/Movies\\/test.mp4?token=abc&amp;v=1";</script>';
  const found=extractLegacySource(html);
  assert.deepEqual(found,{url:"http://103.136.200.124:8086/Movies/test.mp4?token=abc&v=1",format:"mp4"});
});
test("relative provider and direct server media paths",()=>{
  assert.deepEqual(directStreamFromValue("/hls/t/Series/a/master.m3u8"),{url:"http://cineplexbd.net/hls/t/Series/a/master.m3u8",format:"hls"});
  assert.deepEqual(directStreamFromValue("Data/TV/file.mp4?token=one"),{url:"http://103.136.200.124:8086/Data/TV/file.mp4?token=one",format:"mp4"});
});
test("strict source only: no other providers, local network or odd protocols",()=>{
  for(const u of ["https://example.org/movie.mp4","http://127.0.0.1/secret.mp4","http://vod.cineplexbd.net:22/stream.m3u8","javascript:alert(1)","http://cineplexbd.net.evil.test/a.mp4"]){
    assert.equal(allowedDirectSource(u),false,u);
  }
  assert.equal(allowedDirectSource("http://vod.cineplexbd.net:8081/tv-series/x/index.m3u8"),true);
});
test("movie resolution from original provider page",async()=>{
  const mock=async(_url:string,_init:RequestInit)=>({ok:true,status:200,text:async()=>'<video><source src="http://103.136.200.124:8086/Movies/X.mp4?token=ABC"></video>'});
  const s=await resolveLegacyDirect("movie-123",1,1,mock);
  assert.equal(s.transport,"direct");assert.equal(s.format,"mp4");assert.match(s.url||"",/token=ABC/);
  assert.equal(s.headers.Referer,"http://cineplexbd.net/");
});
test("episode meta=1 fallback when watch page contains no source",async()=>{
  const urls:string[]=[];
  const mock=async(url:string,_init:RequestInit)=>{
    urls.push(url);
    return {ok:true,status:200,text:async()=>url.includes("meta=1")?JSON.stringify({episodes:{"3":{path:"http://vod.cineplexbd.net:8081/tv-series/a/index.m3u8"}}}):"<html>No direct player</html>"};
  };
  const s=await resolveLegacyDirect("series-456",1,3,mock);
  assert.equal(s.format,"hls");
  assert.equal(s.url,"http://vod.cineplexbd.net:8081/tv-series/a/index.m3u8");
  assert.equal(urls.length,2);
});

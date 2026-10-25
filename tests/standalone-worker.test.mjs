import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.mjs";

const providerPage='<a href="view.php?id=77533"><img alt="Example Film" src="/uploads/example.jpg"/><p class="font-bold">Example Film</p><span>2025</span></a>';
function withMock(fn) {
  const previous=globalThis.fetch;
  globalThis.fetch=async (input) => {
    const url=String(input);
    if(url.includes("category.php")) return new Response(providerPage,{status:200,headers:{"content-type":"text/html"}});
    if(url.includes("search_ajax.php")) return Response.json({results:[{id:77533,type:"movie",title:"Example Film",year:2025}]});
    if(url.includes("watch.php")&&url.includes("meta=1"))return Response.json({episodes:{"1":{episode_number:1,title:"The Beginning",path:"http://vod.cineplexbd.net:8081/tv-series/Example/S01/index.m3u8"}}});
    if(url.includes("watch.php"))return new Response('<h1>Example</h1>',{status:200});
    if(url.includes("vod.cineplexbd.net"))return new Response("#EXTM3U\n#EXTINF:8,\nsegment000.ts\n#EXT-X-ENDLIST\n",{status:200,headers:{"content-type":"application/vnd.apple.mpegurl"}});
    throw Error("Unmocked URL "+url);
  };
  return Promise.resolve().then(fn).finally(()=>{globalThis.fetch=previous});
}
test("renders standalone shell with no catalogue snapshot",async()=>{
  const r=await worker.fetch(new Request("https://example.invalid/"));
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/Stories beyond/);
  assert.match(html,/CineplexBD/);
  assert.doesNotMatch(html,/Star Cineplex/);
});
test("requests movie listing live and normalizes public link",()=>withMock(async()=>{
 const r=await worker.fetch(new Request("https://example.invalid/api/catalogue?kind=movie&page=1"));
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.items[0].title,"Example Film");
 assert.equal(d.items[0].providerId,"77533");
}));
test("search sends live request instead of querying snapshot",()=>withMock(async()=>{
 const r=await worker.fetch(new Request("https://example.invalid/api/catalogue?kind=movie&q=example"));
 const d=await r.json();assert.equal(d.items.length,1);
}));
test("valid TV episode can use explicitly listed HLS source",()=>withMock(async()=>{
 const r=await worker.fetch(new Request("https://example.invalid/api/playback?kind=series&id=31416&season=1&episode=1"));
 const d=await r.json();assert.equal(d.status,"ready");assert.equal(d.format,"hls");assert.ok(d.url.startsWith("/api/media?u="));
 const playlist=await worker.fetch(new Request("https://example.invalid"+d.url));
 assert.equal(playlist.status,200);
 assert.match(await playlist.text(),/api\/media\?u=/);
}));
test("never accepts admin media as playable destination",async()=>{
 const r=await worker.fetch(new Request("https://example.invalid/api/media?u="+encodeURIComponent("http://vod.cineplexbd.net:8081/admin")));
 assert.notEqual(r.status,200);
});
test("never accepts private-IP proxy requests",async()=>{
 const r=await worker.fetch(new Request("https://example.invalid/api/media?u="+encodeURIComponent("http://127.0.0.1:8081/stream.mp4")));
 assert.notEqual(r.status,200);
});

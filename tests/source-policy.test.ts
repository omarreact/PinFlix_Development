import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { allowedUrl } from "../lib/provider/http";

test("only approved CineplexBD media servers are permitted",()=>{
 for(const value of [
  "http://cineplexbd.net/view.php?id=77533",
  "http://vod.cineplexbd.net:8081/tv-series/example/index.m3u8",
  "http://103.136.200.124:8086/Movies/example.mp4"
 ])assert.doesNotThrow(()=>allowedUrl(value,true));
 for(const value of [
  "http://pinflix.akogs-fashion.com/api.php?action=stream",
  "https://movibox.net/watch/movie",
  "https://moviebox.ph/",
  "https://api.themoviedb.org/3/movie/5",
  "http://127.0.0.1/stream.m3u8"
 ])assert.throws(()=>allowedUrl(value,true));
});

test("standalone Cloudflare Worker has no alternative catalogue or stream gateway",()=>{
 const worker=readFileSync("worker/index.mjs","utf8");
 assert.doesNotMatch(worker,/pinflix\.akogs-fashion\.com|\bCPANEL\b|gatewayRequest/);
 assert.match(worker,/const ORIGIN="http:\/\/cineplexbd\.net"/);
});

test("standalone Android uses the native source with no web API",()=>{
 const api=readFileSync("mobile/src/api.android.ts","utf8");
 const playback=readFileSync("mobile/src/playback-source.android.ts","utf8");
 const provider=readFileSync("mobile/native/ProviderClient.java","utf8");
 const config=JSON.parse(readFileSync("mobile/app.json","utf8"));
 assert.match(api,/NativeModules\.PinFlixDirect/);
 assert.match(provider,/http:\/\/cineplexbd\.net/);
 assert.match(playback,/return playback\(id,season,episode\)/);
 assert.equal(config.expo.extra.androidSourceMode,"direct-native-v1");
 assert.equal(config.expo.extra.apiOrigin,undefined);
 assert.doesNotMatch(api,/https?:\/\/(?:pinflix|pin-flix|admin)\.pincodeit\.com/);
});
test("iOS backend retains independent release gating",()=>{
 const api=readFileSync("mobile/src/api.ts","utf8");
 assert.match(api,/EXPO_PUBLIC_PINFLIX_RELEASE_APPROVED/);
 assert.match(api,/const STAGING_API="https:\/\/pin-flix\.pincodeit\.com"/);
});

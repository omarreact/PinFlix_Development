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

test("cross-platform preview uses only the CineplexBD-backed PinFlix Development API",()=>{
 const src=readFileSync("mobile/src/api.ts","utf8");
 const cfg=JSON.parse(readFileSync("mobile/app.json","utf8"));
 const eas=JSON.parse(readFileSync("mobile/eas.json","utf8"));
 assert.equal(cfg.expo.extra.apiOrigin,"https://pin-flix.pincodeit.com");
 assert.match(src,/const STAGING_API="https:\/\/pin-flix\.pincodeit\.com"/);
 assert.match(src,/EXPO_PUBLIC_PINFLIX_RELEASE_APPROVED/);
 assert.equal(eas.build.preview.env.EXPO_PUBLIC_PINFLIX_API_ORIGIN,"https://pin-flix.pincodeit.com");
 assert.notEqual(eas.build.production.env.EXPO_PUBLIC_PINFLIX_API_ORIGIN,"https://pinflix.pincodeit.com");
});

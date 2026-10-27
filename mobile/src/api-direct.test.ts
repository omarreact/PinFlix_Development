import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("the Android app never imports web API or Vercel proxy code",()=>{
 const api=readFileSync("src/api.android.ts","utf8");
 const player=readFileSync("src/playback-source.android.ts","utf8");
 const analytics=readFileSync("src/telemetry.android.ts","utf8");
 const notifications=readFileSync("src/notifications.android.ts","utf8");
 const plugin=readFileSync("plugins/withCineplexMedia.js","utf8");
 const poster=readFileSync("src/poster.android.ts","utf8");
 const module=readFileSync("native/PinFlixDirectModule.java","utf8");
 assert.match(api,/NativeModules\.PinFlixDirect/);
 assert.match(player,/return playback\(id,season,episode\)/);
 for(const source of [api,player,poster,analytics,notifications,plugin]){
  assert.doesNotMatch(source,/https?:\/\/(?:pinflix|pin-flix|admin)\.pincodeit\.com|vercel\.app|cloudflare\.com/);
 }
 assert.match(plugin,/ProviderClient\.java/);
 assert.match(plugin,/org\.jsoup:jsoup/);
 assert.match(plugin,/android:networkSecurityConfig/);
 assert.match(poster,/NativeModules\.PinFlixDirect/);
 assert.match(module,/ProviderClient\.poster\(url\)/);
});

# PinFlix Sources — Android

A **separate native Android catalogue and player app** using CineplexBD only.
This is not a WebView of pinflix.pincodeit.com.

### Source mapping
- Homepage: http://cineplexbd.net/ and /index.php
- Search: /search_ajax.php?q=...&limit=... with /search.php fallback
- Movies: /category.php?category=...&page=...
- TV: /tvs.php and /tvs_more.php?offset=...&limit=...
- TV watch metadata: /watch.php?id=...&season=...&meta=1
- Film metadata: /view.php?id=...
- Film source: /player.php?id=...
- TV playback source: /watch.php?id=...&season=...&ep=...
- Strict native media allowlist: cineplexbd.net (80), vod.cineplexbd.net:8081, 103.136.200.124:8086/8081

Built with native Java Android UI, Jsoup HTML parsing, JSON parsing, Media3 ExoPlayer (MP4/HLS). No site wrapping, no preloaded fake catalogue, no test/sample video substitution, no hardcoded stream URLs. The app never circumvents DRM or login/paywall restrictions.

### Limitations
CineplexBD's public endpoints and videos may not be reachable from every ISP, and source layouts may change. Provider cookies, signed playback links, session access, and upstream policies can affect playback. The backend's signed proxy URLs are specific to that backend and cannot be manufactured inside this app. The pinflix.akogs-fashion.com fallback is deliberately not enabled, as its authorization and availability are not established.

### Build
Run `gradle -p android-source :app:assembleDebug` on JDK 17 + Android SDK 35 with Gradle 8.13, or download the artifact from the GitHub Actions workflow. Debug APK package: `com.pincodeit.pinflix.source.preview`, separate from the original PinFlix app.

This is a debug-key-signed **testing build**, not a Play Store release. Only use streams you have rights to access. Install and playback require real-device QA.

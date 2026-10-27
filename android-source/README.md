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

## Version 1.1 — cinematic UI and player controls

The native UI includes a featured hero, styled poster catalogue, category chips, bottom navigation, polished detail/episode lists, and loading/error feedback.

The Media3 video player provides:
- Large central play/pause, 10-second rewind/forward, tap to toggle controls and double tap to seek on either side
- Seekbar with elapsed/duration timestamps (only when the provider allows seeking)
- 0.5×, 0.75×, 1×, 1.25×, 1.5× and 2× playback speed; speed preference saved
- Adaptive quality selection when HLS exposes selectable video tracks (progressive MP4 often has a single quality)
- Subtitles toggle when a usable text track is present
- Fit/zoom, device volume, fullscreen landscape and picture-in-picture on supported devices
- Control lock, automatic chrome fade, network buffering/error feedback and lifecycle-safe player release

The app still plays **only** provider-authorized media; it does not bypass upstream access controls or invent extra quality/subtitle tracks. The generated preview APK is debug-signed; a publicly distributed update requires signing and real-device playback QA.

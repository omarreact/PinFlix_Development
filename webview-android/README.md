# PinFlix Direct WebView 1.5

The current PinFlix React interface is bundled in the APK, including the latest movie slider, search, filters, in-page movie/series details, and MP4/HLS/DASH player. A small navigation shim replaces server routing; Android handles the CineplexBD endpoints directly from the device's network. There is no remote application gateway, private Sites login, Vercel dependency, saved movie catalogue, or substitute film.

Android intercepts requests on the bundled HTTPS origin. Metadata calls and approved HTTP media are fetched natively, including Referer, checked redirects, signed per-session media URLs, HLS manifest rewriting and MP4 Range requests. WebView mixed content and file access remain disabled. Source requests are bounded and only the configured CineplexBD hosts are accepted. Series seasons load independently from HTML/`meta=1` episode data.

Builds run through GitHub Actions. The artifact is a debug-signed installable test APK, package `com.pincodeit.pinflix.webview.direct`, version `1.5.0-direct`, Android 7 or newer. It installs alongside the previous hosted WebView APK. A persistent private release key is needed for a distributable production release; the default CI debug key is ephemeral.

The workflow validates the web bundle, APK signature/package and Android emulator instrumentation. MP4/HLS/DASH, fullscreen/Back and UI tests use explicitly synthetic clips shipped only in the separate test APK. Passing those checks does not establish live CineplexBD reachability or physical-device playback. Actual catalogue and media still require CineplexBD access on the viewer's network.

Local build: in `web/`, run `npm install`, `npx tsc --noEmit`, `npm run build`; then from this directory run `gradle :app:assembleDebug :app:assembleDebugAndroidTest` using JDK 17, Gradle 8.12.1 and Android SDK 35. No API keys or environment file are required.

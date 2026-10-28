# PinFlix — Android + iOS

**Made by PINCODE IT.** React Native / Expo 54 source. Separate from the earlier native Java Android application.

User-facing copy contains no source-provider branding; internal URLs retain necessary backend identifiers. The mobile app fetches catalogue, search, details and signed playback exclusively from the CineplexBD-only PinFlix_Development HTTPS API (no insecure direct-origin player links, no DRM circumvention).

Run from mobile/: `npm install && npm run check && npx expo start`.
Preview builds require EAS signing credentials and an Expo project ID for remote push notifications.
iOS App Store IPA requires an Apple Developer team, APNs and signing. Android APK can be built through EAS or a hosted Gradle runner after Expo prebuild.

Implemented core: visual discovery, Watch Later, persisted resume and watch history, filters, queue, episode select, track-aware player, speed, fullscreen, PiP, background audio opt-in, notification opt-in, anonymous telemetry opt-in, original credit and short app-produced intro. Features requiring upstream support or rights (4K enhancement, jump ahead, protected downloads, actual extra audio/CC tracks) are not fabricated.

Admin endpoints are separate and require runtime cloud credentials and owner authorization before production reporting or push delivery. Location is unnecessary for basic streaming and is not requested automatically.

## Release-domain safety

During Android/iOS development, every movie, series, episode, artwork and signed stream resolves against **https://pin-flix.pincodeit.com**, which is backed by `omarreact/PinFlix_Development` on Vercel project `pf`. Do not point mobile builds at `https://pinflix.pincodeit.com` yet: its current Vercel project `pinflix` runs the older `omarreact/PinFlix` site and includes non-Cineplex provider code.

Before a **production cutover**: validate web, Android and iOS releases; check a complete Cineplex-only provider audit and authorized playback from real devices; test the final HTTPS domain, range requests, HLS and signed links; switch `pinflix.pincodeit.com` to the verified PinFlix_Development Vercel deployment; then set `EXPO_PUBLIC_PINFLIX_API_ORIGIN=https://pinflix.pincodeit.com` and `EXPO_PUBLIC_PINFLIX_RELEASE_APPROVED=true` in the final signed build environment. Never set approval in preview/staging.

Single-source policy: only CineplexBD and its approved media servers may supply catalogue and playback metadata. Unavailable upstream media must be reported unavailable, never replaced with MovieBox, TMDB, another catalogue, trailer, or uncontrolled cPanel fallback. Provider names must not appear in user-visible branding; `Made by PINCODE IT` is the public credit.

The `pinflix.pincodeit.com` site will become the web entrypoint and offer approved Android/Apple installation links. It does not replace Android APK signatures or Apple App Store/TestFlight distribution.

## Android v2.0.2 direct-source mode (no Vercel)

The Android APK now bundles the **original matching Java ProviderClient.java from PinFlix Sources v1.0** and registers it as a React Native native module. On Android, `src/api.android.ts` communicates only with that module for catalogue, search, details, episode metadata and direct HLS/MP4 playback. Artwork loads directly from the approved upstream hosts. `src/playback-source.android.ts` never contacts any HTTPS PinFlix service. Cookies, user-agent, referer headers, source allowlisting and HTTP transport remain native, as in the uploaded working APK.

`src/api.ts` remains the separate shared/iOS backend implementation and is shadowed by `src/api.android.ts` in Metro's Android resolution. Android telemetry and remote push are disabled rather than contacting the admin Vercel service. Watchlist and resume remain local. Location is optional and doesn't alter the video source.

A new release APK requires a fresh native prebuild because the original Java parser, bridge and Jsoup dependency are injected by `plugins/withCineplexMedia.js`. Standard Expo Go **cannot run this module**. Configure EAS/Android build from this branch and verify on a physical device and network. Do not claim actual playback success based on compilation alone.

## Android 2.0.7 startup-crash investigation

The user reported a physical-device “PinFlix keeps stopping” crash. The original CI emulator previously launched but could not reach the upstream catalogue. Android startup-smoke now separately tests app process stability on API 35/36 and captures AndroidRuntime / crash-buffer logs. The native poster bridge has been changed from eager Base64 strings to bounded JPEG thumbnails cached as file:// URIs (maximum long edge 640 pixels, up to 80 cached files), reducing release-startup memory pressure on devices where the source returns many images. This is a **potential mitigation, not a confirmed root-cause fix** without a physical-device crash log. Preserve the direct-source mode, don't add web/proxy fallbacks. Verify launch and playback on ARM64 Android 17 / actual user network before production.

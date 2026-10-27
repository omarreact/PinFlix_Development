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

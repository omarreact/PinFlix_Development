# PinFlix — Android + iOS

**Made by PINCODE IT.** React Native / Expo 54 source. Separate from the earlier native Java Android application.

User-facing copy contains no source-provider branding; internal URLs retain necessary backend identifiers. The mobile app fetches catalogue, search, details and signed playback exclusively from the existing HTTPS PinFlix API (no insecure direct-origin player links, no DRM circumvention).

Run from mobile/: `npm install && npm run check && npx expo start`.
Preview builds require EAS signing credentials and an Expo project ID for remote push notifications.
iOS App Store IPA requires an Apple Developer team, APNs and signing. Android APK can be built through EAS or a hosted Gradle runner after Expo prebuild.

Implemented core: visual discovery, Watch Later, persisted resume and watch history, filters, queue, episode select, track-aware player, speed, fullscreen, PiP, background audio opt-in, notification opt-in, anonymous telemetry opt-in, original credit and short app-produced intro. Features requiring upstream support or rights (4K enhancement, jump ahead, protected downloads, actual extra audio/CC tracks) are not fabricated.

Admin endpoints are separate and require runtime cloud credentials and owner authorization before production reporting or push delivery. Location is unnecessary for basic streaming and is not requested automatically.

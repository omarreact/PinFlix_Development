# PinFlix mobile — Codex instructions

Read `CODEX_HANDOFF.md` before making changes to this Android release candidate.

The current primary task is the direct CineplexBD Android client, using the original `native/ProviderClient.java` and the React Native bridge. Do not accidentally edit the Next.js web runtime or switch Android back to Vercel. Verify `.android.ts` Metro platform resolution, Java module registration and signed MP4/HLS playback headers.

Do not merge, deploy to final production, change backend URLs, or introduce an alternative provider. Ensure any failures are accurately reported and the built APK is testable. The user-approved branding is **PinFlix — Made by PINCODE IT**.

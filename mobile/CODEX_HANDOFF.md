# Codex handoff — PinFlix Android direct-source release candidate

## Starting point

- Repo: `https://github.com/omarreact/PinFlix_Development`
- Working branch: `feat/pinflix-ios-android-premium-20261027`
- PR: `https://github.com/omarreact/PinFlix_Development/pull/20`
- Last known CI commit: `0de0c5f0aebe769ae792945cbbd22bff5af258bd`
- Latest validated Android workflow: `https://github.com/omarreact/PinFlix_Development/actions/runs/40504646669` (successful, artifact `PinFlix-Unified-Android-Preview`, expires 2026-11-10)
- Uploaded original working APK from the user is not necessarily available to Codex remotely. The matching direct-source implementation has been copied into `mobile/native/ProviderClient.java`; the original repository version also lives in `android-source/app/src/main/java/com/pincodeit/pinflix/source/ProviderClient.java` on `feat/android-direct-cineplex-sources`.

## User instruction — non-negotiable

Finish the **Android** PinFlix Sources variant so it performs **all catalogue, search, posters, movie/series details, episodes and MP4/HLS playback DIRECTLY from CineplexBD infrastructure**, with **zero dependency on Vercel/Cloudflare/cPanel/PinFlix web API at runtime**. Keep the current polished Netflix-inspired PinFlix React Native UI, player controls, Saved/Watch Later and resume. No third-party provider fallbacks or unauthorised access workarounds. The user reported the newer version displayed `No verified playable source was found for this title` while the older APK successfully played videos over their mobile network.

This task is for the native Android application; **do not break/change the separately deployed web application or iOS implementation**. Do not merge into main or deploy to `pinflix.pincodeit.com` until end-to-end acceptance is demonstrated.

## Current code locations

| Component | Location |
|---|---|
| Matching old working Java provider | `mobile/native/ProviderClient.java` |
| React Native Java bridge | `mobile/native/PinFlixDirectModule.java`, `mobile/native/PinFlixDirectPackage.java` |
| Expo prebuild Java injection + Jsoup + narrowly scoped HTTP permissions | `mobile/plugins/withCineplexMedia.js` |
| Android catalogue, search, details, artwork (bypasses Vercel) | `mobile/src/api.android.ts` |
| Android direct playback (bypasses Vercel) | `mobile/src/playback-source.android.ts` |
| Android no-op cloud telemetry/notifications | `mobile/src/telemetry.android.ts`, `mobile/src/notifications.android.ts` |
| Shared app UI | `mobile/App.tsx` |
| Native media3/expo-video player | `mobile/src/PlayerScreen.tsx` |
| Local Watch Later/resume | `mobile/src/library.ts` |
| Source-only regression checks | `mobile/src/api-direct.test.ts`, `tests/source-policy.test.ts` |
| Build pipeline | `.github/workflows/mobile-android-apk.yml` |
| Expo config | `mobile/app.json` |

## Specific work

1. **Audit actual device dependency graph.** Confirm Metro chooses `api.android.ts`, `playback-source.android.ts`, `telemetry.android.ts` and `notifications.android.ts` in the Android release bundle. Search the entire Android runtime for web-origin usage, including poster URL helpers, intro resources, imports, notices, optional analytics, fonts, and UI links. No request to `pin-flix.pincodeit.com`, `pinflix.pincodeit.com`, `admin.pincodeit.com`, `vercel.app`, or unrelated providers is permitted from Android.
2. **Reproduce using actual source fixtures and build artifact.** Compare movie and episode resolution with the old working Java `ProviderClient`: direct `player.php?id=...`, `watch.php?id=...&season=...&ep=...`, `watch.php?...&meta=1`, response cookies, `Referer`, `User-Agent`, redirects, tokens, MP4 Range and HLS segmented playback. Do not break strict source-host allowlists or bypass an access restriction.
3. **Validate Expo native module setup.** Ensure Kotlin/Java `MainApplication` registration, Jsoup Gradle dependency, copied Java sources, permissions, debug/release native startup, Android 8+ compatibility and package namespace compile. Check for failures that pass compilation but cause missing `NativeModules.PinFlixDirect` at runtime.
4. **Fix any issues found:** callback argument marshalling; `Title` and `Detail` serialization, empty catalogue/search states, series pagination, search filters when metadata is missing, season/episode selection; the direct Media3 player headers must be carried into both HLS segments and MP4 requests. Remove fake success states and report provider/network errors intelligibly. Do not silently reintroduce the Vercel fallback.
5. **Preserve UI:** cinematic poster hero, scrolling rails, details, Saved, Watch Later, Continue Watching/resume, speed, seek, fullscreen and PiP; no visible upstream brand name. Visible credit **Made by PINCODE IT**.
6. **Tests:** `cd mobile && npm install && npm run check && npm run test:direct && npm run test:playback`; `npm test`/repository CI; Android `expo prebuild --platform android --clean`; `:app:assembleRelease`. If device/emulator is available, verify installed app can list/search, open a detail, play an MP4 and an HLS episode, seek, close/resume, and rotate to fullscreen. If no device/provider network is available, state this explicitly and distinguish compile validation from runtime playback validation.
7. **Deliverables:** a new versioned test APK artifact, SHA-256 and release build log, small set of reproducible test IDs and results, a PR update with exact code diffs, screenshots/recording of actual working playback if possible, and a clear remaining-blockers checklist.

## Release rules

- Only CineplexBD catalogue + approved original media origins. Keep the explicit hostname/port allowlist.
- No content access circumvention, credential theft, DRM bypass, or unauthorized download logic.
- Do not add any remote proxy, Vercel server, cPanel gateway or non-Cineplex provider to Android.
- User-facing app should say PinFlix and **Made by PINCODE IT**, never the upstream provider name.
- Don't make untested claims of real-media success; test on an Android device with network access.
- Keep PR as a draft/reviewable change until acceptance; do not promote production domain on your own.

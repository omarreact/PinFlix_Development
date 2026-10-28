# PinFlix Next.js Android WebView (one UI)

This is a **separate installable Android package** (`com.pincodeit.pinflix.webview`) that opens the responsive PinFlix Next.js website without maintaining separate React Native screens.

## Which website does it use?

Development APK: `https://pin-flix.pincodeit.com/` (the CineplexBD-focused PinFlix_Development Next.js project).

Production: once the new website and playback have passed acceptance and `pinflix.pincodeit.com` has been switched to the approved site, rebuild using:
```sh
gradle --no-daemon :app:assembleDebug -PPINFLIX_WEB_URL=https://pinflix.pincodeit.com/
```

An HTTP-hosted version can be used by building with an approved site URL such as `http://pinflix.akogs-fashion.com/`, **but only after confirming the full site actually runs there**. Vercel will automatically redirect HTTP requests to HTTPS: the APK cannot override Vercel's hosting policy. No unknown domain is permitted as a shell origin.

## Playback

The WebView allows approved CineplexBD HTTP video/image subresources from an HTTPS page. Android's network policy globally rejects HTTP except explicit original media hosts and trusted app hosts. The WebView blocks unapproved HTTP subrequests and never ignores SSL certificate errors. Browser playback is still subject to Next.js server-side media resolution, CSP, upstream availability and WebView codecs; HTTP access alone is not a cure for non-working media.

**This WebView APK can rely on Vercel because it displays the Next.js website.** The existing direct-Java Android APK is the separate choice if you require **zero Vercel dependence anywhere**.

## User experience

- One shared responsive Next.js interface for website and Android.
- Hardware Back exits fullscreen, navigates back in web history, and only closes after explicit confirmation.
- HTML5 video fullscreen rotates to landscape, restores previous orientation on return.
- First-party cookies and local website storage; no separate React Native session.
- Error/retry view for unreachable site.
- Supports approved HTTP and HTTPS resources without accepting arbitrary HTTP traffic.
- Can be installed alongside the native APK under a separate package ID.

## Build

JDK 17, Android SDK 35, Android Gradle Plugin 8.9.2, Gradle 8.12.1.

```sh
cd webview-android
python3 scripts/check_wrapper.py
gradle --no-daemon :app:assembleDebug
```

The debug-signed test APK is `app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions publishes an artifact when the pull request is opened.

## Manual acceptance before releasing

Test the APK with Wi-Fi and mobile data: home screen, catalogue, search, movie and TV details, a playable MP4 movie, an HLS episode, seek controls, fullscreen/Back without app termination, provider-domain restrictions, and network error recovery. The site must remain accessible; this is not an offline website build.

Only then rebuild pointing at the final production domain. Do not publish the new site or overwrite `pinflix.pincodeit.com` without approval.

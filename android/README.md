# PinFlix Android

Native Android WebView launcher for https://pinflix.pincodeit.com/.

This is an **online wrapper** of the existing PinFlix site. It doesn't bundle a Next.js server or offer offline streaming. The page's media sources must be reachable on the viewer's network.

## Build an installable APK

Requires Android SDK 35, Java 17, Gradle 8.13. From repository root:

```sh
gradle -p android :app:assembleDebug
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` on Android 8.0+ (API 26+). The GitHub workflow **Build PinFlix Android APK** uploads the same APK as a ZIP artifact. The preview application ID is `com.pincodeit.pinflix.preview` so it can coexist with any later signed production installation.

## Behavior and privacy

- Android WebView displays the existing responsive PinFlix design.
- JavaScript/DOM storage are enabled for the web application and playback.
- Fullscreen HTML5 video, landscape rotation, web navigation and Android back are supported.
- External top-level links open in the system browser; embedded video subframes are allowed.
- Cleartext top-level traffic and mixed content are blocked.
- JavaScript-to-native bridges, camera and microphone access are not enabled.
- Failed network loads show a retry screen.
- Download links are handed to the browser, not silently saved.

This **debug-key-signed APK** is intended for testing. Test search, movie playback, TV episode playback, fullscreen video, and app installation on actual devices and mobile data. Do not distribute as a production release without durable release signing and device QA.

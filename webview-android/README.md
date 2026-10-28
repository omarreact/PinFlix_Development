# PinFlix Next.js Android WebView — Cloudflare-only test edition

This Android APK is built by **GitHub Actions**, renders the same PinFlix responsive Next.js UI hosted on **Cloudflare Workers** and must make **no Vercel requests**.

**Test URL:** https://pinflix-nextjs-preview.farukkhanone.workers.dev/

The Cloudflare Worker is independently connected to the same `omarreact/PinFlix_Development` repository, tracking the development branch. The Vercel-hosted website remains independent; no production changes have been made. The Cloudflare test Worker may initially show an environment readiness page until the full vinext build succeeds.

The APK only permits this exact Cloudflare Worker hostname as an internal web origin. HTTP cleartext is restricted to the existing approved CineplexBD media servers; SSL/TLS errors are never bypassed.

**Security/functional limitations:** Next.js server routes run on Cloudflare (the WebView does not bundle the Next.js server). CineplexBD-only catalogue and playback remain on the server-side provider. HTML5 MP4/HLS media and HTTP mixed-content can still fail because of upstream reachability, WebView/CSP restrictions, or source behavior. Test these features before release.

## Build via GitHub Actions

The workflow `.github/workflows/pinflix-webview-android.yml` builds a debug-signed test APK, checks the signature, and uploads `PinFlix-NextJS-WebView-Android-Preview`. A production APK needs a persistent release signing key.

## Test

Install alongside the native APK (different package ID). Open home, search, movie, episode details; verify full-screen/Back, HTTP media fetches and app not closing unexpectedly. Confirm device network logs contain no requests to `*.vercel.app` or `pin-flix.pincodeit.com`; if a site API references Vercel, remove it from the Cloudflare deployment before publication.

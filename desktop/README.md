# PinFlix for Windows (desktop wrapper)

Optional **Windows 10/11 x64** Electron desktop shell around the live site at https://pinflix.pincodeit.com/. It does **not** copy the Next.js server, host a local media API, cache video, or bypass network restrictions.

## Build an unsigned Windows installer

Requires Node.js 24 and npm. From desktop/ on Windows:

```powershell
npm install
npm run check
npm run dist:win
```

The NSIS installer is written under desktop/dist/PinFlix-1.0.0-Windows-Setup.exe. The GitHub Actions **Build PinFlix Windows installer** workflow also builds it on a hosted Windows runner and uploads an artifact named PinFlix-Windows-x64-installer.

## Security and playback

- Renderer sandbox and context isolation are enabled; Node integration is disabled.
- Trusted first-party navigation stays in the embedded app. Web links to other sites open in the system browser. Unknown URL schemes are discarded.
- No automatic media downloads, sample-stream substitution, or injected scripts.
- Video playback depends on whether the deployed site and upstream provider work in Chromium and on the user's network. DRM, codec, and regional restrictions are not bypassed.
- An offline page with a retry button appears on main-page network errors.

## Before distributing publicly

CI produces an **unsigned** installer, not a production-certified release. Use a Windows code-signing certificate, confirm expected SmartScreen behavior, test installation and upgrade on clean Windows 10/11 x64 machines, test video playback on multiple networks, and validate uninstall behavior. This desktop shell requires an internet connection and is not a fully offline app.

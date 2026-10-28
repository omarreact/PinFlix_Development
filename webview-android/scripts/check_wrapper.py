from pathlib import Path
src=Path("app/src/main/java/com/pincodeit/pinflix/webview/MainActivity.java").read_text()
cfg=Path("app/src/main/res/xml/network_security_config.xml").read_text()
gradle=Path("app/build.gradle").read_text()
manifest=Path("app/src/main/AndroidManifest.xml").read_text()
checks={
 "WebView loads a configurable PinFlix URL":"BuildConfig.PINFLIX_WEB_URL" in src,
 "Website navigation uses WebView":"browser.goBack()" in src,
 "Back returns from fullscreen first":"if(fullScreenView!=null){leaveFullscreen();return;}" in src,
 "Mainframe error includes retry":"setOnClickListener" in src and "showError(true)" in src,
 "Fullscreen video events":"onShowCustomView" in src and "onHideCustomView" in src,
 "Request-level HTTP allowlist":"!canUseHttp(url)" in src,
 "SSL errors never bypassed":"handler.cancel()" in src and "handler.proceed()" not in src,
 "Approved original media servers present":all(h in cfg for h in ["cineplexbd.net","vod.cineplexbd.net","103.136.200.124","cds3.cineplexbd.net"]),
 "Cleartext disabled by default":'<base-config cleartextTrafficPermitted="false"/>' in cfg,
 "Separate APK package":"com.pincodeit.pinflix.webview" in gradle,
 "APK contains Cloudflare test URL":"https://pinflix-nextjs-test.farukkhanone.workers.dev/" in gradle,
 "No Vercel or other PinFlix hosting origins in app code":not any(host in (gradle+src+cfg) for host in ["pin-flix.pincodeit.com","pinflix.pincodeit.com","vercel.app","pinflix.akogs-fashion.com"]),
 "Protected Android back behavior":'android:enableOnBackInvokedCallback="false"' in manifest,
}
for title,ok in checks.items():
 print(("PASS" if ok else "FAIL")+": "+title)
if not all(checks.values()):
 raise SystemExit("WebView wrapper policy checks failed")

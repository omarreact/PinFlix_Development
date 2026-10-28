"""Verify the Android release APK really uses native direct sources only.
Run after Gradle :app:assembleRelease; inspect the shipped Hermes/JS bundle.
"""
from __future__ import annotations
import pathlib
import sys
import zipfile
import hashlib

apk=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path("android/app/build/outputs/apk/release/app-release.apk")
if not apk.is_file(): raise SystemExit(f"APK missing: {apk}")
with zipfile.ZipFile(apk) as z:
    corrupt=z.testzip()
    if corrupt: raise SystemExit(f"Corrupt APK member: {corrupt}")
    names=set(z.namelist())
    for required in ("AndroidManifest.xml","classes.dex","assets/index.android.bundle"):
        if required not in names: raise SystemExit(f"Missing {required} from release APK")
    bundle=z.read("assets/index.android.bundle")
    if b"PinFlixDirect" not in bundle: raise SystemExit("Missing native PinFlixDirect bridge in release JS")
    if b"Made by PINCODE IT" not in bundle: raise SystemExit("Missing required branding")
    for forbidden in (
        b"pin-flix.pincodeit.com",b"pinflix.pincodeit.com",
        b"admin.pincodeit.com",b"vercel.app",b"movibox.net",
        b"moviebox.ph",b"api.themoviedb.org",
    ):
        if forbidden in bundle: raise SystemExit(f"Forbidden Android runtime origin: {forbidden.decode()}")
    if b"CineplexBD" in bundle: raise SystemExit("Upstream brand leaked into user-facing Android bundle")
    dex=b"".join(z.read(n) for n in sorted(names) if n.endswith(".dex"))
    if b"cineplexbd.net" not in dex: raise SystemExit("Direct upstream Java provider not found in native APK")
    if not any(n.startswith("lib/") for n in names): raise SystemExit("Native Android libraries missing")
digest=hashlib.sha256(apk.read_bytes()).hexdigest()
print("APK: OK",apk.name)
print("Mode: Native direct media and catalogue; no web/proxy fallback in Android bundle")
print("SHA256:",digest)
print("Size:",apk.stat().st_size)

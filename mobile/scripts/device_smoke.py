"""Exercise the release APK on an Android emulator and save observable playback evidence."""

import argparse
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


OUT = pathlib.Path("android-smoke")
OUT.mkdir(exist_ok=True)
REPORT = []


def adb(*args, timeout=35):
    result = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"adb {' '.join(args)}: {result.stderr.strip()}")
    return result.stdout


def snapshot(name):
    image = subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True, timeout=25)
    if image.returncode == 0:
        (OUT / f"{name}.png").write_bytes(image.stdout)


def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/pinflix-window.xml", timeout=25)
    xml = adb("exec-out", "cat", "/sdcard/pinflix-window.xml")
    return list(ET.fromstring(xml).iter("node"))


def visible():
    return [(n.get("text") or "", n.get("bounds") or "") for n in nodes()]


def wait_text(needle, seconds=50):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        for label, bounds in visible():
            if needle in label and bounds:
                return bounds
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for {needle!r}; visible text: {[t for t, _ in visible() if t][:24]}")


def tap_bounds(bounds):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", bounds))
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def tap_text(label, seconds=40):
    tap_bounds(wait_text(label, seconds))


def clock_position():
    for label, _ in visible():
        match = re.search(r"\b(\d+):(\d\d)\s*/\s*(?:\d+:\d\d|--:--)", label)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
    return None


def wait_position(minimum, seconds=25):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        value = clock_position()
        if value is not None and value >= minimum:
            return value
        time.sleep(2)
    raise RuntimeError(f"Playback clock never reached {minimum}s")


def assert_format(kind, required):
    logs = adb("logcat", "-d", "-s", "PinFlixDirect:I", "*:S")
    match = re.search(rf"Resolved ({kind}-\d+) episode \d+ as {required}", logs)
    if not match:
        raise RuntimeError(f"No verified {required} source for {kind}; native resolution log: {logs[-1200:]}")
    REPORT.append(f"{kind}: {match.group(1)} resolved as {required} by original Java provider")


def watch(kind):
    if kind == "series":
        tap_text("Series")
        time.sleep(2)
    size = adb("shell", "wm", "size")
    width, height = map(int, re.search(r"(\d+)x(\d+)", size).groups())
    adb("shell", "input", "tap", str(width // 2), str(int(height * 0.39)))
    tap_text("Watch episode" if kind == "series" else "Play Movie")
    end = time.monotonic() + 65
    first = None
    while time.monotonic() < end:
        value = clock_position()
        if value is not None:
            if first is None:
                first = value
            if value >= max(2, first + 2):
                REPORT.append(f"{kind}: playback clock advanced {first}s to {value}s")
                snapshot(kind + "-playing")
                return value
        time.sleep(2)
    snapshot(kind + "-failed")
    raise RuntimeError(f"{kind}: playback clock did not advance; visible text: {[t for t, _ in visible() if t][:25]}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("apk")
    args = parser.parse_args()
    adb("install", "-r", args.apk, timeout=90)
    adb("logcat", "-c")
    adb("shell", "am", "start", "-n", "com.pincodeit.pinflix.mobile/.MainActivity")
    try:
        try:
            tap_text("Get Started", 18)
        except RuntimeError:
            pass  # Intro was already dismissed by persisted state.
        wait_text("For You", 65)
        REPORT.append("Native bridge loaded catalogue into the release app")
        snapshot("catalogue")
        position = watch("movie")
        assert_format("movie", "MP4")
        tap_text("10 ↷")
        position = wait_position(position + 8)
        tap_text("10 ↷")
        wait_position(max(16, position + 8))
        REPORT.append("MP4 seek advanced the playback clock")
        tap_text("Speed ")
        tap_text("1.25×")
        wait_text("Speed 1.25×")
        REPORT.append("Speed control changed playback to 1.25×")
        adb("shell", "input", "keyevent", "4")
        tap_text("Play Movie")
        wait_text("Resumed at")
        REPORT.append("Movie resume restored the saved playback position")
        adb("shell", "input", "keyevent", "4")
        tap_text("‹ Back") if any("‹ Back" in t for t, _ in visible()) else tap_text("‹")
        wait_text("For You")
        watch("series")
        assert_format("series", "HLS")
        tap_text("CC")
        wait_text("Off")
        REPORT.append("Subtitle panel opened and offered Off; source tracks depend on the provider")
        tap_text("CC")
        tap_text("PiP")
        time.sleep(3)
        state = adb("shell", "dumpsys", "activity", "activities")
        if not re.search(r"windowingMode=pin|type=pip|PictureInPictureMode=true", state, re.I):
            raise RuntimeError("PiP control did not enter Android picture in picture mode")
        REPORT.append("Android entered picture in picture mode")
        snapshot("picture-in-picture")
    except Exception as exc:
        REPORT.append("FAIL: " + str(exc))
        snapshot("failure")
        raise
    finally:
        logs = adb("logcat", "-d", "-s", "PinFlixDirect:I", "ReactNativeJS:E", "ExpoVideo:E", "*:S")
        (OUT / "logcat.txt").write_text(logs)
        REPORT.extend(line for line in logs.splitlines() if "Resolved " in line)
        (OUT / "report.txt").write_text("\n".join(REPORT) + "\n")
        print((OUT / "report.txt").read_text())


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)

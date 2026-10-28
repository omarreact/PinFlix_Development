"""Launch-only Android smoke check: independent of upstream catalogue access.

A runtime crash should fail this job even when provider HTTP times out.
Produces a compact screenshot, AndroidRuntime / native crash log, and pid history.
"""
import pathlib
import subprocess
import time

OUT=pathlib.Path("android-startup-smoke")
OUT.mkdir(exist_ok=True)

def adb(*args,timeout=30,check=True):
    r=subprocess.run(["adb",*args],text=True,capture_output=True,timeout=timeout)
    if check and r.returncode: raise RuntimeError(f"adb {args}: {r.stderr}")
    return r.stdout

apk=next(pathlib.Path("preview-apk").rglob("*.apk"))
report=[]
try:
    adb("install","-r","--no-streaming",str(apk),timeout=360)
    report.append("APK installation: PASS")
    adb("logcat","-c")
    adb("shell","am","force-stop","com.pincodeit.pinflix.mobile")
    started=adb("shell","am","start","-W","-n","com.pincodeit.pinflix.mobile/.MainActivity")
    report.append("Activity start: "+started.strip().replace("\n"," "))
    time.sleep(3)
    pids=[]
    for second in range(24):
        pid=adb("shell","pidof","com.pincodeit.pinflix.mobile",check=False).strip()
        pids.append(pid)
        if not pid:
            raise RuntimeError(f"App process exited after {second+3}s; pid history {pids}")
        time.sleep(1)
    report.append("Stable startup process for 27s: PASS")
    report.append("PID: "+pids[-1])
except Exception as error:
    report.append("FAIL: "+str(error))
    raise
finally:
    try:
        screenshot=subprocess.run(["adb","exec-out","screencap","-p"],capture_output=True,timeout=20)
        if screenshot.returncode==0:(OUT/"screen.png").write_bytes(screenshot.stdout)
    except Exception as exc:report.append("Screenshot unavailable: "+str(exc))
    try:
        crash=adb("logcat","-d","-b","crash","-v","threadtime",timeout=30,check=False)
        (OUT/"android-crash-buffer.txt").write_text(crash)
        if crash.strip():
            report.append("Crash buffer is not empty — check android-crash-buffer.txt")
            # A crash in the new APK should fail the job even if the process restarted.
            if "com.pincodeit.pinflix.mobile" in crash:
                report.append("FAIL: app appears in Android crash buffer")
                (OUT/"report.txt").write_text("\n".join(report)+"\n")
                raise RuntimeError("PinFlix logged an Android native/runtime crash")
        details=adb("logcat","-d","-v","threadtime",timeout=30,check=False)
        lines=details.splitlines()
        filterterms=("FATAL EXCEPTION","com.pincodeit.pinflix.mobile","ReactNativeJS","ExpoVideo","AndroidRuntime","SIGSEGV","SIGABRT")
        (OUT/"relevant-logcat.txt").write_text("\n".join(x for x in lines if any(t in x for t in filterterms))[-70000:])
    except Exception as exc:
        if "PinFlix logged" in str(exc):raise
        report.append("Log retrieval error: "+str(exc))
    finally:
        (OUT/"report.txt").write_text("\n".join(report)+"\n")
        print("\n".join(report))

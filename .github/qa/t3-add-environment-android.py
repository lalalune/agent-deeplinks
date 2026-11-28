import json
import pathlib
import shlex
import subprocess
import sys
import time
from xml.etree import ElementTree

qa = pathlib.Path(sys.argv[1])
command, serial = sys.argv[2:]
evidence = qa / "evidence"
package = "com.t3tools.t3code"
uri = json.loads((evidence / "requested-links.json").read_text())["android"]
assert uri == "t3code://settings/environment-new"
proof = {
    "variant": "Official 2.4.0 Android internal-track mirror build 833",
    "abi": "arm64-v8a",
    "uri": uri,
    "libraryGitCommit": (evidence / "library-git.txt").read_text().strip(),
    "networkCredentialEntered": False,
    "connectActionInvoked": False,
    "results": {},
}


def adb(*args, timeout=24):
    return subprocess.check_output([command, "-s", serial, *args], stderr=subprocess.STDOUT, timeout=timeout)


def shell(*args, timeout=24):
    return adb("shell", shlex.join(args), timeout=timeout).decode(errors="replace")


def ui():
    try:
        name = "/sdcard/t3-add-environment-qa.xml"
        shell("uiautomator", "dump", name, timeout=15)
        data = adb("exec-out", "cat", name, timeout=6)
        nodes = [node.attrib for node in ElementTree.fromstring(data).iter("node") if node.get("package") == package]
        return data, nodes
    except (subprocess.SubprocessError, ElementTree.ParseError):
        return b"", []


def labels(nodes):
    return {item["text"] or item["content-desc"] for item in nodes if item.get("text") or item.get("content-desc")}


def edits(nodes):
    return [item for item in nodes if item.get("class") == "android.widget.EditText" and item.get("enabled") == "true"]


def wait_ui(test, seconds=48):
    deadline = time.monotonic() + seconds
    data, nodes = b"", []
    while time.monotonic() < deadline:
        data, nodes = ui()
        if test(nodes):
            return True, data, nodes
        time.sleep(0.7)
    return False, data, nodes


def capture(name, data):
    if data:
        (evidence / f"{name}.xml").write_bytes(data)
    (evidence / f"{name}.png").write_bytes(adb("exec-out", "screencap", "-p"))


def pids():
    return {int(pid) for pid in shell("pidof", package, "||", "true").split() if pid.isdigit()}


def stop():
    shell("am", "force-stop", package)
    assert not pids(), "Fixture process remained running before launch"


args = ("-a", "android.intent.action.VIEW", "-c", "android.intent.category.BROWSABLE", "-d", uri)
resolved = shell("cmd", "package", "resolve-activity", "--brief", *args)
assert package + "/" in resolved, "Android default resolver did not select the vendor app"
(evidence / "resolver.txt").write_text(resolved)


def dispatch(name):
    saw_before = pids()
    result = shell("am", "start", "-W", *args, timeout=40)
    (evidence / f"{name}-dispatch.txt").write_text(result)
    assert "Status: ok" in result and package + "/" in result, "Untargeted stock Android dispatch failed"
    form, data, nodes = wait_ui(lambda current: {"Address", "Code"} <= labels(current) and len(edits(current)) == 2)
    capture(name, data)
    activities = shell("dumpsys", "activity", "activities")
    resumed = [line.strip() for line in activities.splitlines()
               if "ResumedActivity" in line and package + "/" in line]
    result_summary = {
        "processesBefore": sorted(saw_before),
        "processesAfter": sorted(pids()),
        "reportedCold": "LaunchState: COLD" in result,
        "foregroundVendorActivity": bool(resumed),
        "visibleAddressAndCodeFields": form,
        "visibleLabels": sorted(labels(nodes)),
        "editFieldCount": len(edits(nodes)),
    }
    proof["results"][name] = result_summary
    (evidence / "proof.json").write_text(json.dumps(proof, indent=2) + "\n")


stop()
baseline = shell("am", "start", "-W", "-a", "android.intent.action.MAIN",
                 "-c", "android.intent.category.LAUNCHER", "-p", package, timeout=40)
assert "Status: ok" in baseline and package + "/" in baseline
home, data, home_nodes = wait_ui(lambda current: bool(current) and "Add environment" in labels(current))
capture("stock-home", data)
proof["warmBaseline"] = {
    "expectedAddEnvironmentControlVisible": home,
    "formAbsent": not ({"Address", "Code"} <= labels(home_nodes) and len(edits(home_nodes)) == 2),
}
dispatch("warm")
stop()
dispatch("cold")
cold = proof["results"]["cold"]
warm = proof["results"]["warm"]
assert cold["reportedCold"] and cold["processesBefore"] == [] and cold["processesAfter"]
assert warm["processesBefore"] == warm["processesAfter"] and warm["processesBefore"]
assert proof["warmBaseline"]["formAbsent"]
for result in (warm, cold):
    assert result["foregroundVendorActivity"] and result["visibleAddressAndCodeFields"]
print("T3 Code exposed the Add Environment Address and Code inputs after warm and cold stock dispatch.")


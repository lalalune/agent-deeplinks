import sys
import time

import pyatspi


def descendants(node):
    yield node
    for child in node:
        if child is not None:
            yield from descendants(child)


def find(name, roles):
    deadline = time.monotonic() + 8
    expected = name.casefold()
    while time.monotonic() < deadline:
        for app in pyatspi.Registry.getDesktop(0):
            try:
                for item in descendants(app):
                    label = " ".join(item.name.casefold().split())
                    if (label != expected and not label.startswith(expected + " ")) or item.getRoleName() not in roles:
                        continue
                    if item.getState().contains(pyatspi.STATE_SHOWING):
                        return item
            except (LookupError, RuntimeError):
                continue
        time.sleep(0.3)
    raise SystemExit(f"No visible OpenClaw {name} control")


verb, name = sys.argv[1:]
if verb == "click":
    element = find(name, {"push button", "toggle button", "button"})
    if not element.queryAction().doAction(0):
        raise SystemExit(f"OpenClaw {name} button could not be activated")
elif verb == "focus":
    element = find(name, {"entry", "text", "password text"})
    if not element.queryComponent().grabFocus():
        raise SystemExit(f"OpenClaw {name} field could not be focused")
else:
    raise SystemExit("Unknown accessibility action")

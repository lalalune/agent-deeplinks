import re
import sys
import xml.etree.ElementTree as ET

path, package, name, *flags = sys.argv[1:]
root = ET.parse(path).getroot()
normalize = lambda value: " ".join(value.split()).casefold()
points = set()
for node in root.iter("node"):
    if node.get("package") != package or node.get("enabled") != "true":
        continue
    if normalize(name) not in {normalize(node.get("text", "")), normalize(node.get("content-desc", ""))}:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
    if not match:
        continue
    left, top, right, bottom = map(int, match.groups())
    if left < right and top < bottom:
        points.add(((left + right) // 2, (top + bottom) // 2))
if flags == ["--exists"]:
    sys.exit(0 if points else 1)
if len(points) != 1:
    sys.exit(1)
print(*points.pop())

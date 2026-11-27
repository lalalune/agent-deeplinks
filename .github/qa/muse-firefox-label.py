import re
import sys
import xml.etree.ElementTree as ET

path, package, name = sys.argv[1:]
root = ET.parse(path).getroot()
points = set()
for node in root.iter("node"):
    if node.get("package") != package or node.get("enabled") != "true":
        continue
    if name.casefold() not in {node.get("text", "").casefold(), node.get("content-desc", "").casefold()}:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
    if not match:
        continue
    left, top, right, bottom = map(int, match.groups())
    if left < right and top < bottom:
        points.add(((left + right) // 2, (top + bottom) // 2))
if len(points) != 1:
    sys.exit(1)
print(*points.pop())

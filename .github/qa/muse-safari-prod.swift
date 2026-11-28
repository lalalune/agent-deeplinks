import AppKit
import CoreGraphics
import Vision

let args = CommandLine.arguments
let mode = args[1]
let safari = "com.apple.Safari"
let muse = "com.meta.endo"

func printJSON(_ value: Any) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
}

func details(_ app: NSRunningApplication) -> [String: Any] {
    return [
        "pid": Int(app.processIdentifier),
        "bundleId": app.bundleIdentifier ?? "",
        "path": app.bundleURL?.resolvingSymlinksInPath().path ?? "",
    ]
}

func visibleWindows(_ app: NSRunningApplication) -> [(id: Int, frame: CGRect)] {
    let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
        as? [[String: Any]] ?? []
    return windows.compactMap { window in
        guard window[kCGWindowOwnerPID as String] as? Int == Int(app.processIdentifier),
              window[kCGWindowLayer as String] as? Int == 0,
              let id = window[kCGWindowNumber as String] as? Int,
              let bounds = window[kCGWindowBounds as String] as? [String: Any],
              let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary),
              rect.width >= 320, rect.height >= 200 else { return nil }
        return (id, rect)
    }
}

if mode == "state" {
    let front = NSWorkspace.shared.frontmostApplication
    try printJSON([
        "frontmost": front.map(details) ?? [:],
        "frontmostOwnedVisibleWindows": front.map { visibleWindows($0).map { ["id": $0.id, "frame": NSStringFromRect($0.frame)] } } ?? [],
        "muse": NSRunningApplication.runningApplications(withBundleIdentifier: muse).map(details),
    ])
    exit(0)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
try VNImageRequestHandler(url: URL(fileURLWithPath: args[2])).perform([request])
let rows = (request.results ?? []).compactMap { observation -> (String, CGRect)? in
    guard let text = observation.topCandidates(1).first?.string else { return nil }
    return (text, observation.boundingBox)
}

if mode == "ocr" {
    print(rows.map { $0.0 }.joined(separator: "\n"))
    exit(0)
}

guard mode == "click" || mode == "context",
      let app = NSWorkspace.shared.frontmostApplication,
      app.bundleIdentifier == safari,
      !visibleWindows(app).isEmpty else { exit(2) }
let markers = rows.filter { $0.0 == args[3] }
guard markers.count == 1 else { exit(3) }
let marker = markers[0].1
let screen = CGDisplayBounds(CGMainDisplayID())
let point = CGPoint(x: screen.minX + screen.width * marker.midX, y: screen.minY + screen.height * (1 - marker.midY))
let right = mode == "context"
let button: CGMouseButton = right ? .right : .left
guard visibleWindows(app).contains(where: { $0.frame.insetBy(dx: 4, dy: 4).contains(point) }),
      let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: button),
      let down = CGEvent(mouseEventSource: nil, mouseType: right ? .rightMouseDown : .leftMouseDown, mouseCursorPosition: point, mouseButton: button),
      let up = CGEvent(mouseEventSource: nil, mouseType: right ? .rightMouseUp : .leftMouseUp, mouseCursorPosition: point, mouseButton: button) else { exit(4) }
move.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.18)
guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { exit(5) }
down.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.12)
up.post(tap: .cghidEventTap)
try printJSON(["applied": ["x": point.x, "y": point.y], "safari": details(app)])

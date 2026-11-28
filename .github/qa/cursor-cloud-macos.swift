import AppKit
import CoreGraphics
import Vision

let args = CommandLine.arguments
let mode = args[1]
let cursor = "com.todesktop.230313mzl4w4u92"

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
        "cursor": NSRunningApplication.runningApplications(withBundleIdentifier: cursor).map(details),
    ])
    exit(0)
}

if mode == "resolve" {
    guard let uri = URL(string: args[2]),
          let owner = NSWorkspace.shared.urlForApplication(toOpen: uri) else { exit(2) }
    print(owner.resolvingSymlinksInPath().path)
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

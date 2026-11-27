import AppKit
import CoreGraphics
import Foundation
import Vision

let mode = CommandLine.arguments[1]
let input = CommandLine.arguments[2]

switch mode {
case "resolve":
    if let uri = URL(string: input),
       let bundle = NSWorkspace.shared.urlForApplication(toOpen: uri) {
        print(bundle.path)
    }
case "running", "running-count":
    let candidates = NSWorkspace.shared.runningApplications.filter {
        $0.bundleIdentifier == "com.t3tools.t3code" &&
            $0.bundleURL?.resolvingSymlinksInPath().path == input
    }
    if mode == "running-count" {
        print(candidates.count)
    } else if candidates.count == 1 {
        print(candidates[0].processIdentifier)
    }
case "process":
    if let pid = Int32(input),
       let bundle = NSRunningApplication(processIdentifier: pid)?.bundleURL {
        print(bundle.path)
    }
case "window":
    if let pid = Int32(input) {
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
        for window in windows {
            guard window[kCGWindowOwnerPID as String] as? Int32 == pid,
                  window[kCGWindowLayer as String] as? Int == 0,
                  let bounds = window[kCGWindowBounds as String] as? [String: Any],
                  let width = bounds["Width"] as? Double, width > 400,
                  let height = bounds["Height"] as? Double, height > 280,
                  let identifier = window[kCGWindowNumber as String] as? Int else { continue }
            let title = window[kCGWindowName as String] as? String ?? ""
            let data = try JSONSerialization.data(withJSONObject: ["windowId": identifier, "title": title])
            print(String(decoding: data, as: UTF8.self))
            break
        }
    }
case "screen":
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    let image = VNImageRequestHandler(url: URL(fileURLWithPath: input))
    try image.perform([request])
    let lines = (request.results ?? []).compactMap { line -> (String, CGRect)? in
        guard let candidate = line.topCandidates(1).first else { return nil }
        let text = candidate.string.precomposedStringWithCanonicalMapping
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (text, line.boundingBox)
    }
    let headings = lines.filter { $0.1.minX > 0.14 && $0.1.midY > 0.84 }
    let composer = lines.filter { $0.1.minX > 0.14 && $0.1.midY < 0.37 }
    let heading = headings.map(\.0).joined(separator: " ")
    let mainThreadTitle = heading.localizedCaseInsensitiveContains("fixture / New thread") ||
        (headings.contains { $0.0 == "fixture" || $0.0 == "fixture /" } &&
            headings.contains { $0.0 == "New thread" })
    let data = try JSONSerialization.data(withJSONObject: [
        "recognizedLines": lines.count,
        "mainThreadTitle": mainThreadTitle,
        "blankComposer": composer.contains { $0.0.localizedCaseInsensitiveContains("Ask anything") },
        "baselineMarker": composer.contains { $0.0 == CommandLine.arguments[3] },
        "targetMarker": composer.contains { $0.0 == CommandLine.arguments[4] },
        "promptAddedNotice": lines.contains { $0.0 == "Prompt added from a link" },
    ])
    print(String(decoding: data, as: UTF8.self))
default:
    fatalError("Unknown observation mode")
}

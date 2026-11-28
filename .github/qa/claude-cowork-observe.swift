import AppKit
import CoreGraphics
import Vision

let args = CommandLine.arguments
let mode = args[1]

if mode == "application" {
    let apps = NSRunningApplication.runningApplications(withBundleIdentifier: args[2]).map { app in
        ["pid": String(app.processIdentifier), "path": app.bundleURL?.path ?? ""]
    }
    let result = try JSONSerialization.data(withJSONObject: apps)
    print(String(decoding: result, as: UTF8.self))
    exit(0)
}

if mode == "resolve" {
    guard let url = URL(string: args[2]) else { exit(2) }
    print(NSWorkspace.shared.urlForApplication(toOpen: url)?.path ?? "")
    exit(0)
}

if mode == "window" {
    guard let pid = Int(args[2]) else { exit(2) }
    let windows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
                   as? [[String: Any]]) ?? []
    let owned = windows.compactMap { window -> (Int, CGRect)? in
        guard window[kCGWindowOwnerPID as String] as? Int == pid,
              window[kCGWindowLayer as String] as? Int == 0,
              let id = window[kCGWindowNumber as String] as? Int,
              let dictionary = window[kCGWindowBounds as String] as? NSDictionary,
              let bounds = CGRect(dictionaryRepresentation: dictionary as CFDictionary),
              bounds.width >= 320, bounds.height >= 250 else { return nil }
        return (id, bounds)
    }
    if let window = owned.max(by: { $0.1.width * $0.1.height < $1.1.width * $1.1.height }) {
        print(window.0)
    }
    exit(0)
}

let screenshot = URL(fileURLWithPath: args[2])
let recognition = VNRecognizeTextRequest()
recognition.recognitionLevel = .accurate
recognition.usesLanguageCorrection = false
try VNImageRequestHandler(url: screenshot).perform([recognition])
let rows = (recognition.results ?? []).compactMap { finding -> (String, CGRect)? in
    guard let text = finding.topCandidates(1).first?.string else { return nil }
    return (text, finding.boundingBox)
}

if mode == "ocr" {
    print(rows.map { $0.0 }.joined(separator: "\n"))
    exit(0)
}

guard mode == "confirm-chrome" || mode == "start-claude",
      let chromePID = pid_t(args[3]),
      NSWorkspace.shared.frontmostApplication?.processIdentifier == chromePID else { exit(2) }

let labels = rows.map { $0.0.lowercased() }
let pattern = mode == "confirm-chrome" ? "^Open Claude(?:\\.app)?$" : "^Get started$"
let buttons = rows.filter { $0.0.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil }
guard buttons.count == 1 else { exit(3) }
if mode == "confirm-chrome" {
    let chromePrompt = labels.contains { $0 == "cancel" } &&
        labels.contains { $0.contains(args[4].lowercased()) } &&
        labels.contains { $0.contains("wants to open this application") }
    guard chromePrompt else { exit(3) }
} else {
    let plainWelcome = labels.contains("claude for mac") &&
        labels.contains("the fastest way to talk with claude") &&
        !labels.contains { $0.contains("terms of service") || $0.contains("i agree") || $0.contains("by continuing") }
    guard plainWelcome else { exit(3) }
}
let target = buttons[0].1
let screen = CGDisplayBounds(CGMainDisplayID())
let point = CGPoint(x: screen.minX + screen.width * target.midX, y: screen.minY + screen.height * (1 - target.midY))
guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left),
      let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left),
      let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) else { exit(4) }
move.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.18)
down.post(tap: .cghidEventTap)
Thread.sleep(forTimeInterval: 0.12)
up.post(tap: .cghidEventTap)
print(mode == "confirm-chrome"
      ? "Clicked Chrome’s one-time Open Claude button at \(point)"
      : "Clicked the plain Claude for Mac Get started button at \(point)")

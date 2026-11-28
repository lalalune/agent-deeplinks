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

if mode == "frontmost" {
    print(NSWorkspace.shared.frontmostApplication?.processIdentifier ?? 0)
    exit(0)
}

if mode == "resolve" {
    guard let url = URL(string: args[2]) else { exit(2) }
    print(NSWorkspace.shared.urlForApplication(toOpen: url)?.path ?? "")
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

guard mode == "confirm-chrome",
      let chromePID = pid_t(args[3]),
      NSWorkspace.shared.frontmostApplication?.processIdentifier == chromePID else { exit(2) }

let labels = rows.map { $0.0.lowercased() }
let openButtons = rows.filter { $0.0.range(of: "^Open Cursor(?:\\.app)?$", options: [.regularExpression, .caseInsensitive]) != nil }
let chromePrompt = labels.contains { $0 == "cancel" } &&
    labels.contains { $0.contains(args[4].lowercased()) } &&
    labels.contains { $0.contains("open this") || $0.contains("open cursor") || $0.contains("application") }

guard chromePrompt, openButtons.count == 1 else { exit(3) }
let target = openButtons[0].1
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
print("Clicked Chrome’s one-time Cursor button at \(point)")

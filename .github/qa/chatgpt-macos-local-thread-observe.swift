import AppKit
import CoreGraphics
import Foundation
import ImageIO
import Vision

let mode = CommandLine.arguments[1]
let input = CommandLine.arguments[2]

func ownedWindow(_ pid: Int32) -> (id: Int, title: String, bounds: CGRect)? {
    let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
    for window in windows {
        guard window[kCGWindowOwnerPID as String] as? Int32 == pid,
              window[kCGWindowLayer as String] as? Int == 0,
              let bounds = window[kCGWindowBounds as String] as? [String: Any],
              let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary),
              rect.width >= 600, rect.height >= 420,
              let identifier = window[kCGWindowNumber as String] as? Int else { continue }
        return (identifier, window[kCGWindowName as String] as? String ?? "", rect)
    }
    return nil
}

func printJSON(_ values: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: values)
    print(String(decoding: data, as: UTF8.self))
}

func normalized(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
}

func opaqueRange(_ image: CGImage) -> Range<Int>? {
    var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
    let sampled = bytes.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: image.width, height: image.height,
                                      bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return true
    }
    let alpha = stride(from: 3, to: bytes.count, by: 4).map { bytes[$0] }
    guard sampled, let first = alpha.firstIndex(where: { $0 >= 250 }),
          let last = alpha.lastIndex(where: { $0 >= 250 }),
          alpha[first...last].allSatisfy({ $0 >= 250 }) else { return nil }
    return first..<(last + 1)
}

func windowPixels(_ source: CGImage, pointWidth: Double, pointHeight: Double) -> CGImage? {
    guard pointWidth >= 600, pointHeight >= 420,
          let row = source.cropping(to: CGRect(x: 0, y: source.height / 2, width: source.width, height: 1)),
          let column = source.cropping(to: CGRect(x: source.width / 2, y: 0, width: 1, height: source.height)),
          let horizontal = opaqueRange(row), let vertical = opaqueRange(column) else { return nil }
    let scale = Double(horizontal.count) / pointWidth
    guard (0.95...2.05).contains(scale), abs(Double(vertical.count) - pointHeight * scale) <= 2 else { return nil }
    return source.cropping(to: CGRect(x: horizontal.lowerBound, y: vertical.lowerBound,
                                      width: horizontal.count, height: vertical.count))
}

func loadImage(_ url: URL) -> CGImage? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func darkMask(_ image: CGImage, brightLimit: Int = 510) -> [Bool]? {
    var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
    let sampled = bytes.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: image.width, height: image.height,
                                      bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return true
    }
    guard sampled else { return nil }
    var mask: [Bool] = []
    mask.reserveCapacity(image.width * image.height)
    for i in stride(from: 0, to: bytes.count, by: 4) {
        let sum = Int(bytes[i]) + Int(bytes[i + 1]) + Int(bytes[i + 2])
        mask.append(bytes[i + 3] >= 250 && sum < brightLimit)
    }
    return mask
}

// Compare only the known 1x window size. Unknown coordinates require a separate observation.
func matchesArchivedLabels(_ image: CGImage, referencePath: String, labels: [CGRect], brightLimit: Int = 510) -> Bool {
    guard image.width == 1024, image.height == 684,
          let source = loadImage(URL(fileURLWithPath: referencePath)),
          let reference = windowPixels(source, pointWidth: 1024, pointHeight: 684) else { return false }
    return labels.allSatisfy { label in
        guard let expectedImage = reference.cropping(to: label), let expected = darkMask(expectedImage, brightLimit: brightLimit),
              expected.filter({ $0 }).count >= 50 else { return false }
        for dx in -2...2 {
            for dy in -2...2 {
                guard let liveImage = image.cropping(to: label.offsetBy(dx: Double(dx), dy: Double(dy))),
                      let live = darkMask(liveImage, brightLimit: brightLimit) else { continue }
                var overlap = 0
                var union = 0
                for (a, b) in zip(expected, live) {
                    if a || b { union += 1 }
                    if a && b { overlap += 1 }
                }
                if overlap * 100 >= union * 72 { return true }
            }
        }
        return false
    }
}

func selectionMark(_ image: CGImage, center: CGPoint, pointWidth: Double, darkRadio: Bool = false) -> String {
    let scale = Double(image.width) / pointWidth
    let pixelCenter = CGPoint(x: center.x * Double(image.width), y: center.y * Double(image.height))
    let radius = max(2, Int(5 * scale))
    let spot = CGRect(x: Int(pixelCenter.x.rounded()) - radius, y: Int(pixelCenter.y.rounded()) - radius,
                      width: radius * 2 + 1, height: radius * 2 + 1)
    guard let crop = image.cropping(to: spot) else { return "uncertain" }
    let width = crop.width
    let height = crop.height
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    let sampled = bytes.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
                                      bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        context.draw(crop, in: CGRect(x: 0, y: 0, width: width, height: height))
        return true
    }
    guard sampled else { return "uncertain" }
    var dark = 0
    var light = 0
    for i in stride(from: 0, to: bytes.count, by: 4) {
        let value = (Int(bytes[i]) + Int(bytes[i+1]) + Int(bytes[i+2])) / 3
        if value < 125 { dark += 1 }
        if value > 205 { light += 1 }
    }
    let count = width * height
    if darkRadio && dark * 100 >= 40 * count { return "checked" }
    if light * 2 < count { return "uncertain" }
    if dark * 100 >= 6 * count { return "checked" }
    if dark * 100 <= count { return "unchecked" }
    return "uncertain"
}

switch mode {
case "resolve":
    if let uri = URL(string: input), let app = NSWorkspace.shared.urlForApplication(toOpen: uri) {
        print(app.resolvingSymlinksInPath().path)
    }
case "running":
    let apps = NSWorkspace.shared.runningApplications.filter {
        $0.bundleIdentifier == "com.openai.codex" && $0.bundleURL?.resolvingSymlinksInPath().path == input
    }
    if apps.count == 1 { print(apps[0].processIdentifier) }
case "window":
    if let pid = Int32(input), let window = ownedWindow(pid) {
        try printJSON(["windowId": window.id, "title": window.title,
                       "width": window.bounds.width, "height": window.bounds.height])
    }
case "click":
    // Standard Quartz input can be used only if this fresh VM already grants posting access.
    guard CGPreflightPostEventAccess() else { print("event-access-required"); break }
    guard let pid = Int32(input), let app = NSRunningApplication(processIdentifier: pid),
          app.bundleIdentifier == "com.openai.codex",
          app.bundleURL?.resolvingSymlinksInPath().path == CommandLine.arguments[3],
          NSWorkspace.shared.frontmostApplication?.processIdentifier == pid,
          let window = ownedWindow(pid), window.id == Int(CommandLine.arguments[4]),
          let x = Double(CommandLine.arguments[5]), let y = Double(CommandLine.arguments[6]),
          (0.03...0.97).contains(x), (0.03...0.97).contains(y) else {
        print("owned-window-not-frontmost"); break
    }
    let point = CGPoint(x: window.bounds.minX + x * window.bounds.width,
                        y: window.bounds.minY + y * window.bounds.height)
    let moveFirst = CommandLine.arguments.count > 7 && CommandLine.arguments[7] == "move-first"
    if moveFirst {
        guard let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left) else {
            print("input-not-available"); break
        }
        move.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.17)
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid,
              let current = ownedWindow(pid), current.id == window.id, current.bounds == window.bounds else {
            print("owned-window-changed-after-pointer-move"); break
        }
    }
    guard let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left),
          let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) else {
        print("input-not-available"); break
    }
    if moveFirst {
        down.setIntegerValueField(.mouseEventClickState, value: 1)
        up.setIntegerValueField(.mouseEventClickState, value: 1)
    }
    down.post(tap: .cghidEventTap)
    if moveFirst { Thread.sleep(forTimeInterval: 0.06) }
    up.post(tap: .cghidEventTap)
    print("posted")
case "screen":
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    let png = URL(fileURLWithPath: input)
    let expected = CommandLine.arguments[3]
    let pointWidth = Double(CommandLine.arguments[4]) ?? 0
    let pointHeight = Double(CommandLine.arguments[5]) ?? 0
    guard let original = loadImage(png),
          let image = windowPixels(original, pointWidth: pointWidth, pointHeight: pointHeight) else {
        try printJSON(["recognizedLines": 0, "uncertainWindowPixels": true]); break
    }
    try VNImageRequestHandler(cgImage: image).perform([request])
    let lines = (request.results ?? []).compactMap { item -> (String, CGRect)? in
        guard let text = item.topCandidates(1).first?.string else { return nil }
        return (text, item.boundingBox)
    }
    let labels = Set(lines.map { normalized($0.0) })
    let targetTitleAnywhere = lines.contains { text, _ in text == expected }
    let upperMainTitle = lines.contains { text, frame in
        text == expected && frame.minX > 0.24 && frame.minY > 0.57
    }
    let sidebarTargetTitle = lines.contains { text, frame in text == expected && frame.minX < 0.24 }
    let accountGateLabels = labels.intersection([
        "sign in", "log in", "sign in to continue", "sign in to chatgpt", "enter your email",
        "continue with google", "continue with apple", "create an account", "sign up",
        "choose a plan", "upgrade now", "connect your account", "enter your api key",
    ]).sorted()
    var controls: [String: [String: Double]] = [:]
    let allowed = ["engineering", "suggest personalized tasks", "continue", "skip", "go to chatgpt"]
    for caption in allowed {
        let matching = lines.filter { normalized($0.0) == caption }
        if matching.count == 1 {
            let frame = matching[0].1
            controls[caption] = ["x": frame.midX, "y": 1 - frame.midY]
        }
    }
    let workLabels = [CGRect(x: 101, y: 276, width: 254, height: 24),
                      CGRect(x: 139, y: 346, width: 100, height: 25),
                      CGRect(x: 421, y: 542, width: 184, height: 27)]
    let offerLabels = [CGRect(x: 101, y: 349, width: 335, height: 27),
                       CGRect(x: 112, y: 452, width: 173, height: 62),
                       CGRect(x: 321, y: 452, width: 174, height: 63)]
    let confirmationLabels = [CGRect(x: 315, y: 295, width: 144, height: 28),
                              CGRect(x: 316, y: 325, width: 213, height: 24),
                              CGRect(x: 432, y: 361, width: 128, height: 28)]
    let visuallyMatchedWorkPage = pointWidth == 1024 && pointHeight == 684 &&
        controls["continue"] != nil &&
        matchesArchivedLabels(image, referencePath: CommandLine.arguments[6], labels: workLabels)
    let taskOffer = pointWidth == 1024 && pointHeight == 684 &&
        controls["skip"].map { control in
            guard let x = control["x"], let y = control["y"] else { return false }
            return (0.48...0.52).contains(x) && (0.87...0.93).contains(y)
        } == true &&
        matchesArchivedLabels(image, referencePath: CommandLine.arguments[7], labels: offerLabels)
    let skipConfirmation = pointWidth == 1024 && pointHeight == 684 &&
        controls["go to chatgpt"].map { control in
            guard let x = control["x"], let y = control["y"] else { return false }
            return (0.58...0.68).contains(x) && (0.52...0.59).contains(y)
        } == true &&
        matchesArchivedLabels(image, referencePath: CommandLine.arguments[8], labels: confirmationLabels)
    let workQuestion = labels.contains("which best describes your work?") || visuallyMatchedWorkPage
    var engineeringSelection = "not-observed"
    if visuallyMatchedWorkPage {
        let radio = CGPoint(x: 126.0 / 1024.0, y: 358.0 / 684.0)
        engineeringSelection = selectionMark(image, center: radio, pointWidth: pointWidth, darkRadio: true)
        controls["engineering"] = ["x": radio.x, "y": radio.y]
    }
    // Vision can combine the tick and the information icon with the caption.
    let checkbox = (request.results ?? []).compactMap { observation -> CGRect? in
        guard let candidate = observation.topCandidates(1).first,
              let range = candidate.string.range(of: "Suggest personalized tasks", options: .caseInsensitive),
              let caption = try? candidate.boundingBox(for: range) else { return nil }
        return caption.boundingBox
    }
    var suggestionState = "not-observed"
    if visuallyMatchedWorkPage {
        let center = CGPoint(x: 407.0 / 1024.0, y: 555.0 / 684.0)
        controls["suggest personalized tasks"] = ["x": center.x, "y": center.y]
        suggestionState = selectionMark(image, center: center, pointWidth: pointWidth)
    } else if workQuestion && checkbox.count == 1 && pointWidth >= 600 {
        let frame = checkbox[0]
        let center = CGPoint(x: frame.minX - 18 / pointWidth, y: 1 - frame.midY)
        controls["suggest personalized tasks"] = ["x": center.x, "y": center.y]
        suggestionState = selectionMark(image, center: center, pointWidth: pointWidth)
    }
    func sidebarCount(_ allowedLabels: Set<String>) -> Int {
        return lines.filter { text, frame in
            allowedLabels.contains(normalized(text)) && frame.minX < 0.25 && frame.midY > 0.53
        }.count
    }
    // Vision sometimes includes the sidebar selector’s chevron in the caption.
    let codexMode = sidebarCount(["codex", "codex -", "codex v", "codex ˅", "codex ›"]) == 1
    let workspaceNavigation = sidebarCount(["projects"]) == 1 && sidebarCount(["recents"]) == 1
    let codexModeLabel = [CGRect(x: 61, y: 54, width: 106, height: 27)]
    let codexHomeLabels = [CGRect(x: 61, y: 135, width: 108, height: 22),
                       CGRect(x: 61, y: 225, width: 108, height: 22),
                       CGRect(x: 535, y: 292, width: 293, height: 35),
                       CGRect(x: 405, y: 539, width: 115, height: 23),
                       CGRect(x: 374, y: 582, width: 115, height: 23)]
    let baselineReference = CommandLine.arguments[9]
    let codexSidebarArchiveMatch = workspaceNavigation && pointWidth == 1024 && pointHeight == 684 &&
        matchesArchivedLabels(image, referencePath: baselineReference, labels: codexModeLabel, brightLimit: 670)
    let codexHomeArchiveMatch = codexSidebarArchiveMatch &&
        matchesArchivedLabels(image, referencePath: baselineReference, labels: codexHomeLabels, brightLimit: 670)
    let baseline = codexHomeArchiveMatch && !targetTitleAnywhere
    try printJSON(["upperMainTitle": upperMainTitle, "accountGate": !accountGateLabels.isEmpty, "accountGateLabels": accountGateLabels,
                   "workQuestion": workQuestion, "archivedPreferenceMatch": visuallyMatchedWorkPage,
                   "archivedTaskOfferMatch": taskOffer, "archivedSkipConfirmationMatch": skipConfirmation,
                   "engineeringSelection": engineeringSelection, "suggestions": suggestionState,
                   "baseline": baseline, "codexModeVisible": codexMode, "workspaceNavigationVisible": workspaceNavigation,
                   "codexSidebarArchiveMatch": codexSidebarArchiveMatch, "codexHomeArchiveMatch": codexHomeArchiveMatch,
                   "targetTitleAnywhere": targetTitleAnywhere, "sidebarTargetTitle": sidebarTargetTitle,
                   "recognizedLines": lines.count,
                   "navigationText": lines.map { text, frame in
                       ["text": text, "left": Double(frame.minX), "top": Double(1 - frame.maxY)] as [String: Any]
                   }, "controls": controls])
default:
    fatalError("Unknown observation mode")
}

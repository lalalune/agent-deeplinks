import AppKit
import Vision

func recognize(_ screenshot: String) throws {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    let image = VNImageRequestHandler(url: URL(fileURLWithPath: screenshot))
    try image.perform([request])
    for row in request.results ?? [] {
        if let text = row.topCandidates(1).first?.string {
            print(text)
        }
    }
}

let mode = CommandLine.arguments[1]
let argument = CommandLine.arguments[2]
if mode == "resolve", let url = URL(string: argument) {
    if let handler = NSWorkspace.shared.urlForApplication(toOpen: url) {
        print(handler.path)
    }
} else if mode == "recognize" {
    try recognize(argument)
}

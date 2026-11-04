// shotloop-text: the lines of text in a picture and where each is, read
// by macOS's own Vision framework, so a promo shot marks or clicks a
// control exactly where it is (promo/text.mjs). Prints JSON:
//   [{ "text": "Export", "x": 2620, "y": 108, "w": 125, "h": 29 }]
// in the picture's pixels, top-left origin. Built with the app
// (app/scripts/sidecars.mjs), or on first use in development.
import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count > 1,
      let image = NSImage(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])),
      let picture = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("usage: shotloop-text <picture.png|jpg>\n".data(using: .utf8)!)
  exit(1)
}
let width = Double(picture.width), height = Double(picture.height)
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
// Interface words, names and numbers: read as they are, not corrected
request.usesLanguageCorrection = false
request.automaticallyDetectsLanguage = true
do {
  try VNImageRequestHandler(cgImage: picture).perform([request])
} catch {
  FileHandle.standardError.write("\(error.localizedDescription)\n".data(using: .utf8)!)
  exit(1)
}
var lines: [[String: Any]] = []
for found in request.results ?? [] {
  guard let best = found.topCandidates(1).first else { continue }
  let b = found.boundingBox
  lines.append(["text": best.string, "x": Int(b.minX * width), "y": Int((1 - b.maxY) * height), "w": Int(b.width * width), "h": Int(b.height * height)])
}
print(String(data: try JSONSerialization.data(withJSONObject: lines), encoding: .utf8)!)

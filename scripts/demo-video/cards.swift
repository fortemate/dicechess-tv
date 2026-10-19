// Draws the stills of the demo video at 1920x1080: title cards, the badge over
// footage, and the end card. scripts/demo-video/assemble.ts writes the spec and
// runs this; nothing else needs it.
//
//   swift scripts/demo-video/cards.swift <spec.json> <out-dir>
//
// AppKit draws the text, so it needs macOS, as the Vega Virtual Device does.
// Title cards and the end card use the app's heading style and colours.
import AppKit

struct Card: Decodable {
  let file: String
  let kicker: String
  let title: String
  // Smaller lines under the title, for a card that lists what the app was
  // built with.
  let lines: [String]?
}

struct Badge: Decodable {
  let file: String
  let text: String
}

// A lower third over footage: a band in the background colour along the
// bottom, a title and a quieter line under it.
struct Caption: Decodable {
  let file: String
  let title: String
  let subtitle: String
}

struct End: Decodable {
  let file: String
  let icon: String
  let title: String
  // A line under the title; left out when there is none.
  let tagline: String?
  let link: String
  // What the app was built with, above the footer; left out when there is none.
  let builtWith: String?
  let footer: String
}

struct Spec: Decodable {
  // The background as the recordings decode it, so the end card follows the
  // footage without a step in colour.
  let background: String
  let cards: [Card]?
  // The device badge over the takes, and any other device a clip names.
  let badges: [Badge]
  let captions: [Caption]?
  let end: End
}

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
  FileHandle.standardError.write(
    "usage: swift cards.swift <spec.json> <out-dir>\n".data(using: .utf8)!)
  exit(2)
}
let spec = try JSONDecoder().decode(
  Spec.self, from: Data(contentsOf: URL(fileURLWithPath: arguments[1])))
let outDir = URL(fileURLWithPath: arguments[2])

let width = 1920
let height = 1080

func colour(_ hex: String) -> NSColor {
  let value = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16)!
  return NSColor(
    srgbRed: CGFloat((value >> 16) & 0xff) / 255,
    green: CGFloat((value >> 8) & 0xff) / 255,
    blue: CGFloat(value & 0xff) / 255,
    alpha: 1)
}

let kickerColour = colour("#92C3BC")
let titleColour = colour("#EEF4F9")
let quietColour = colour("#8AB3B3")

func font(_ name: String, _ size: CGFloat) -> NSFont {
  NSFont(name: name, size: size) ?? NSFont.systemFont(ofSize: size)
}

func style(_ alignment: NSTextAlignment) -> NSParagraphStyle {
  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = alignment
  paragraph.lineHeightMultiple = 1.05
  return paragraph
}

func text(
  _ string: String, _ fontName: String, _ size: CGFloat, _ colour: NSColor,
  kern: CGFloat = 0, alignment: NSTextAlignment = .center
) -> NSAttributedString {
  NSAttributedString(
    string: string,
    attributes: [
      .font: font(fontName, size),
      .foregroundColor: colour,
      .kern: kern,
      .paragraphStyle: style(alignment),
    ])
}

let options: NSString.DrawingOptions = [.usesLineFragmentOrigin, .usesFontLeading]

func measure(_ string: NSAttributedString, _ limit: CGFloat) -> CGFloat {
  ceil(string.boundingRect(with: NSSize(width: limit, height: 2000), options: options).height)
}

// AppKit's origin is the bottom-left corner: `top` is measured from the top
// edge here, and turned round for the drawing.
func draw(_ string: NSAttributedString, top: CGFloat, left: CGFloat, width limit: CGFloat) -> CGFloat {
  let tall = measure(string, limit)
  string.draw(
    with: NSRect(x: left, y: CGFloat(height) - top - tall, width: limit, height: tall),
    options: options)
  return tall
}

func still(_ file: String, fill: NSColor?, _ paint: () -> Void) throws {
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGraphicsContext.current!.imageInterpolation = .high
  if let fill {
    fill.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()
  } else {
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill(using: .copy)
  }
  paint()
  NSGraphicsContext.restoreGraphicsState()
  try rep.representation(using: .png, properties: [:])!
    .write(to: outDir.appendingPathComponent(file))
  print("wrote \(file)")
}

let background = colour(spec.background)
let column: CGFloat = 1440
let columnLeft = (CGFloat(width) - column) / 2

for card in spec.cards ?? [] {
  try still(card.file, fill: background) {
    let kicker = text(card.kicker.uppercased(), "AvenirNext-DemiBold", 36, kickerColour, kern: 7)
    let title = text(card.title, "AvenirNext-Medium", 84, titleColour)
    let lines = (card.lines ?? []).map { text($0, "AvenirNext-Regular", 38, quietColour) }
    let gap: CGFloat = 34
    let lineGap: CGFloat = 16
    let linesTall = lines.reduce(CGFloat(0)) { $0 + measure($1, column) + lineGap }
    let block = measure(kicker, column) + gap + measure(title, column)
      + (lines.isEmpty ? 0 : gap + linesTall)
    // Centred, and a little above the middle, where a reader looks first.
    let top = (CGFloat(height) - block) / 2 - 20
    let kickerTall = draw(kicker, top: top, left: columnLeft, width: column)
    var y = top + kickerTall + gap
    y += draw(title, top: y, left: columnLeft, width: column) + gap
    for line in lines {
      y += draw(line, top: y, left: columnLeft, width: column) + lineGap
    }
  }
}

// Where the first cut had it: top right, in the app's quiet teal, inside the
// margin the app keeps clear. Large enough to read on a laptop screen.
for badge in spec.badges {
  try still(badge.file, fill: nil) {
    let label = text(badge.text, "AvenirNext-Medium", 32, quietColour, alignment: .right)
    _ = draw(label, top: 26, left: CGFloat(width) - 98 - 1200, width: 1200)
  }
}

// A lower third: a band along the bottom in the background colour, nearly
// opaque, the title in the heading colour and the subtitle in the kicker's.
for caption in spec.captions ?? [] {
  try still(caption.file, fill: nil) {
    let bandTop: CGFloat = 950
    background.withAlphaComponent(0.88).setFill()
    NSRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height) - bandTop).fill()
    let left: CGFloat = 72
    let limit = CGFloat(width) - 2 * left
    let title = text(caption.title, "AvenirNext-DemiBold", 36, titleColour, alignment: .left)
    _ = draw(title, top: bandTop + 22, left: left, width: limit)
    if !caption.subtitle.isEmpty {
      let subtitle = text(caption.subtitle, "AvenirNext-Regular", 28, kickerColour, alignment: .left)
      _ = draw(subtitle, top: bandTop + 74, left: left, width: limit)
    }
  }
}

try still(spec.end.file, fill: background) {
  let side: CGFloat = 220
  let top: CGFloat = 250
  if let icon = NSImage(contentsOfFile: spec.end.icon) {
    let frame = NSRect(
      x: (CGFloat(width) - side) / 2, y: CGFloat(height) - top - side, width: side, height: side)
    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: frame, xRadius: side * 0.22, yRadius: side * 0.22).addClip()
    icon.draw(in: frame)
    NSGraphicsContext.restoreGraphicsState()
  }
  var y = top + side + 56
  y += draw(text(spec.end.title, "AvenirNext-Medium", 72, titleColour), top: y, left: columnLeft, width: column) + 22
  if let tagline = spec.end.tagline, !tagline.isEmpty {
    y += draw(text(tagline, "AvenirNext-Regular", 36, kickerColour), top: y, left: columnLeft, width: column) + 30
  } else {
    y += 8
  }
  _ = draw(text(spec.end.link, "AvenirNext-DemiBold", 36, titleColour), top: y, left: columnLeft, width: column)
  // The line naming what the app was built with heads the footer, in the
  // footer's own type (owner, 2026-10-19): one quiet block along the bottom.
  var footer = spec.end.footer
  if let builtWith = spec.end.builtWith, !builtWith.isEmpty {
    footer = builtWith + "\n" + footer
  }
  let footerText = text(footer, "AvenirNext-Regular", 26, quietColour)
  let footerHeight = ceil(footerText.boundingRect(
    with: NSSize(width: column, height: 400), options: [.usesLineFragmentOrigin]).height)
  _ = draw(footerText, top: CGFloat(height) - 44 - footerHeight, left: columnLeft, width: column)
}

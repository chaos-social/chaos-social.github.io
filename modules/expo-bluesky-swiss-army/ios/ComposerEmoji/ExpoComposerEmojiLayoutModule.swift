import ExpoModulesCore
import React
import UIKit

public class ExpoComposerEmojiLayoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoComposerEmojiLayout")
    View(ComposerEmojiLayoutView.self) {
      Prop("emojiLayout") { (view: ComposerEmojiLayoutView, value: String) in
        view.configure(value)
      }
    }
  }
}

private class ComposerEmojiFrameTarget: NSObject {
  weak var view: ComposerEmojiLayoutView?

  @objc func update() {
    view?.positionImages()
  }
}

/** Keeps emoji views attached to UIKit's current character layout. */
class ComposerEmojiLayoutView: ExpoView {
  private var configurationText = ""
  private var configurationAnchors: [String: Int] = [:]
  private var anchors: [String: Int] = [:]
  private weak var input: UITextView?
  private var observer: NSObjectProtocol?
  private var displayLink: CADisplayLink?
  private let frameTarget = ComposerEmojiFrameTarget()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    frameTarget.view = self
    clipsToBounds = false
  }

  deinit {
    displayLink?.invalidate()
    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
  }

  func configure(_ value: String) {
    guard let data = value.data(using: .utf8),
          let configuration = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let text = configuration["text"] as? String,
          let emojis = configuration["emojis"] as? [[String: Any]] else { return }
    configurationText = text
    configurationAnchors = [:]
    for emoji in emojis {
      if let id = emoji["id"] as? String, let index = emoji["index"] as? Int {
        configurationAnchors[id] = index
      }
    }
    updateDisplayLink()
    setNeedsLayout()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateDisplayLink()
  }

  private func updateDisplayLink() {
    if window == nil || configurationAnchors.isEmpty {
      displayLink?.invalidate()
      displayLink = nil
    } else if displayLink == nil {
      let link = CADisplayLink(target: frameTarget, selector: #selector(ComposerEmojiFrameTarget.update))
      link.add(to: .main, forMode: .common)
      displayLink = link
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    positionImages()
  }

  private func visit(_ view: UIView, action: (UIView) -> Void) {
    action(view)
    for child in view.subviews {
      visit(child, action: action)
    }
  }

  func positionImages() {
    guard let container = superview else { return }
    var images: [String: UIView] = [:]
    visit(container) { view in
      if let editor = view as? UITextView, editor !== input {
        observe(editor)
      }
      if let id = view.nativeID, id.hasPrefix("composer-emoji-") {
        images[id] = view
      }
    }
    guard let editor = input else { return }
    let text = (editor.text ?? "") as NSString
    /*
     * Whole-buffer IME rewrites can discard provisional anchors even when the
     * text stays unchanged. A matching snapshot always has current offsets.
     */
    if text as String == configurationText {
      anchors = configurationAnchors
    }
    guard let font = editor.font,
          let emojiFont = UIFont(name: "AppleColorEmoji", size: font.pointSize) else { return }
    let size = ceil(("😀" as NSString).size(withAttributes: [.font: emojiFont]).width)
    let slotAttribute = NSAttributedString.Key("WitchskyComposerEmojiSlot")
    let activeIndices = Set(anchors.values)
    var staleRanges: [(NSRange, UIFont)] = []
    editor.textStorage.enumerateAttribute(slotAttribute, in: NSRange(location: 0, length: text.length)) { value, range, _ in
      guard let originalFont = value as? UIFont else { return }
      for index in range.location..<NSMaxRange(range) where !activeIndices.contains(index) || text.character(at: index) != 0x3000 {
        staleRanges.append((NSRange(location: index, length: 1), originalFont))
      }
    }
    for (range, originalFont) in staleRanges {
      editor.textStorage.removeAttribute(slotAttribute, range: range)
      editor.textStorage.removeAttribute(.kern, range: range)
      editor.textStorage.addAttribute(.font, value: originalFont, range: range)
    }
    let slotWidth = ("\u{3000}" as NSString).size(withAttributes: [.font: emojiFont]).width
    /*
     * Match the system emoji font's advance without adding characters. Attribute
     * edits leave selection and marked IME text intact and do not move anchors.
     */
    for index in anchors.values where index >= 0 && index < text.length && text.character(at: index) == 0x3000 {
      let attributes = editor.textStorage.attributes(at: index, effectiveRange: nil)
      let kern = size - slotWidth
      if attributes[.font] as? UIFont != emojiFont || (attributes[.kern] as? NSNumber)?.doubleValue != Double(kern) {
        editor.textStorage.addAttributes([.font: emojiFont, .kern: kern, slotAttribute: font], range: NSRange(location: index, length: 1))
      }
    }
    if editor.typingAttributes[slotAttribute] != nil {
      editor.typingAttributes.removeValue(forKey: slotAttribute)
      editor.typingAttributes.removeValue(forKey: .kern)
      editor.typingAttributes[.font] = font
    }
    for (id, image) in images {
      guard let index = anchors[id], index >= 0, index < text.length,
            text.character(at: index) == 0x3000,
            let position = editor.position(from: editor.beginningOfDocument, offset: index),
            let end = editor.position(from: position, offset: 1),
            let range = editor.textRange(from: position, to: end),
            let parent = image.superview else {
        image.alpha = 0
        continue
      }
      let rect = editor.convert(editor.firstRect(for: range), to: parent)
      image.alpha = 1
      image.transform = .identity
      guard image.bounds.width > 0, image.bounds.height > 0 else { continue }
      image.layer.anchorPoint = .zero
      image.layer.position = CGPoint(x: rect.minX, y: rect.maxY - size)
      image.transform = CGAffineTransform(scaleX: size / image.bounds.width, y: size / image.bounds.height)
    }
  }

  private func observe(_ editor: UITextView) {
    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
    input = editor
    observer = NotificationCenter.default.addObserver(
      forName: NSTextStorage.didProcessEditingNotification,
      object: editor.textStorage,
      queue: .main
    ) { [weak self] notification in
      guard let self, let storage = notification.object as? NSTextStorage,
            storage.editedMask.contains(.editedCharacters) else { return }
      let start = storage.editedRange.location
      let removed = storage.editedRange.length - storage.changeInLength
      var next: [String: Int] = [:]
      for (id, index) in anchors {
        if index < start {
          next[id] = index
        } else if index >= start + removed {
          next[id] = index + storage.changeInLength
        }
      }
      anchors = next
    }
  }
}

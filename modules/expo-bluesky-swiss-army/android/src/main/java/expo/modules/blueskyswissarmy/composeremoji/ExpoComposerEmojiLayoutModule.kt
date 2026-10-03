package expo.modules.blueskyswissarmy.composeremoji

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.os.Build
import android.text.Editable
import android.text.TextWatcher
import android.text.Spanned
import android.text.style.ReplacementSpan
import kotlin.math.ceil
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.EditText
import com.facebook.react.R
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView
import org.json.JSONObject

class ExpoComposerEmojiLayoutModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoComposerEmojiLayout")
    View(ComposerEmojiLayoutView::class) {
      Prop("emojiLayout") { view: ComposerEmojiLayoutView, value: String ->
        view.configuration = JSONObject(value)
      }
    }
  }
}

/** Reserves the same advance and line metrics as the platform's Unicode emoji. */
private class ComposerEmojiSlot : ReplacementSpan() {
  fun metrics(paint: Paint): Paint.FontMetricsInt {
    val result = Paint.FontMetricsInt()
    if (Build.VERSION.SDK_INT >= 33) {
      paint.getFontMetricsInt("😀", 0, 2, 0, 2, false, result)
    } else {
      paint.getFontMetricsInt(result)
    }
    return result
  }

  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
    if (fm != null) {
      val emoji = metrics(paint)
      fm.top = emoji.top
      fm.ascent = emoji.ascent
      fm.descent = emoji.descent
      fm.bottom = emoji.bottom
      fm.leading = emoji.leading
    }
    return ceil(paint.measureText("😀")).toInt()
  }

  override fun draw(canvas: Canvas, text: CharSequence, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) {}
}

/** Positions existing image views in the same native frame as the input text. */
class ComposerEmojiLayoutView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), ViewTreeObserver.OnPreDrawListener, TextWatcher {
  var configuration = JSONObject()
  private var input: EditText? = null
  private var previousText = ""
  private val anchors = mutableMapOf<String, Int>()

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(this)
  }

  override fun onDetachedFromWindow() {
    if (viewTreeObserver.isAlive) viewTreeObserver.removeOnPreDrawListener(this)
    input?.removeTextChangedListener(this)
    input = null
    super.onDetachedFromWindow()
  }

  private fun visit(view: View, action: (View) -> Unit) {
    action(view)
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) visit(view.getChildAt(index), action)
    }
  }

  override fun onPreDraw(): Boolean {
    val container = parent as? View ?: return true
    val images = mutableMapOf<String, View>()
    visit(container) { view ->
      if (view is EditText && input !== view) {
        input?.removeTextChangedListener(this)
        input = view
        view.addTextChangedListener(this)
      }
      val id = view.getTag(R.id.view_tag_native_id) as? String
      if (id?.startsWith("composer-emoji-") == true) images[id] = view
    }
    val editor = input ?: return true
    val text = editor.text.toString()
    /*
     * An IME can rewrite the whole buffer without changing its contents and
     * remove every provisional anchor. Restore anchors whenever the snapshot
     * matches; differing native text still uses immediate keyboard offsets.
     */
    if (configuration.optString("text") == text) {
      anchors.clear()
      val emojis = configuration.optJSONArray("emojis")
      if (emojis != null) {
        for (index in 0 until emojis.length()) {
          val emoji = emojis.getJSONObject(index)
          anchors[emoji.getString("id")] = emoji.getInt("index")
        }
      }
    }
    val editable = editor.editableText
    var changed = false
    val spans = editable.getSpans(0, editable.length, ComposerEmojiSlot::class.java)
    val indices = anchors.values.filter { it in text.indices && text[it] == '\u3000' }.toSet()
    for (span in spans) {
      if (editable.getSpanStart(span) !in indices) {
        editable.removeSpan(span)
        changed = true
      }
    }
    for (index in indices) {
      if (editable.getSpans(index, index + 1, ComposerEmojiSlot::class.java).isEmpty()) {
        editable.setSpan(ComposerEmojiSlot(), index, index + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        changed = true
      }
    }
    if (changed) {
      editor.requestLayout()
      return false
    }
    val layout = editor.layout ?: return true
    if (layout.text.toString() != text) return true
    val advance = ceil(editor.paint.measureText("😀")).toFloat()
    val bounds = Rect()
    editor.paint.getTextBounds("😀", 0, 2, bounds)
    val size = maxOf(bounds.width(), bounds.height()).toFloat().takeIf { it > 0 } ?: advance
    val bottom = if (bounds.isEmpty) ComposerEmojiSlot().metrics(editor.paint).descent else bounds.bottom

    for ((id, image) in images) {
      val index = anchors[id]
      val valid = index != null && index in text.indices && text[index] == '\u3000'
      image.alpha = if (valid) 1f else 0f
      if (!valid || index == null) continue
      val parent = image.parent as? ViewGroup ?: continue
      val inputOrigin = IntArray(2)
      val parentOrigin = IntArray(2)
      editor.getLocationInWindow(inputOrigin)
      parent.getLocationInWindow(parentOrigin)
      val line = layout.getLineForOffset(index)
      val start = layout.getPrimaryHorizontal(index)
      val end = layout.getPrimaryHorizontal(index + 1)
      val left = if (layout.getLineForOffset(index + 1) == line) {
        minOf(start, end)
      } else if (layout.isRtlCharAt(index)) {
        start - advance
      } else {
        start
      }
      if (image.width == 0 || image.height == 0) continue
      image.pivotX = 0f
      image.pivotY = 0f
      image.scaleX = size / image.width
      image.scaleY = size / image.height
      image.translationX = inputOrigin[0] - parentOrigin[0] + editor.totalPaddingLeft + left + (advance - size) / 2 - editor.scrollX - image.left
      image.translationY = (inputOrigin[1] - parentOrigin[1] + editor.totalPaddingTop + layout.getLineBaseline(line) + bottom - editor.scrollY - size - image.top).toFloat()
    }
    return true
  }

  override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) {
    previousText = text?.toString() ?: ""
  }

  override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) {
    var editStart = start
    var removed = before
    var inserted = count
    /* Keep unaffected emoji attached when an IME replaces its entire buffer. */
    if (start == 0 && before == previousText.length) {
      val next = text?.toString() ?: ""
      var prefix = 0
      while (prefix < minOf(previousText.length, next.length) && previousText[prefix] == next[prefix]) prefix++
      var suffix = 0
      while (suffix < minOf(previousText.length, next.length) - prefix && previousText[previousText.lastIndex - suffix] == next[next.lastIndex - suffix]) suffix++
      editStart = prefix
      removed = previousText.length - prefix - suffix
      inserted = next.length - prefix - suffix
    }
    val iterator = anchors.iterator()
    while (iterator.hasNext()) {
      val entry = iterator.next()
      when {
        entry.value < editStart -> Unit
        entry.value >= editStart + removed -> entry.setValue(entry.value + inserted - removed)
        else -> iterator.remove()
      }
    }
  }

  override fun afterTextChanged(text: Editable?) {}
}

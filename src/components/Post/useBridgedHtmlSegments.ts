import {getBridgedHtml, htmlToSegments} from '#/lib/strings/bridged-html'
import {useRenderBridgedHtml} from '#/state/preferences/render-bridged-html'

/**
 * Formatted segments for posts bridged from the fediverse, for the
 * `htmlSegments` prop of `RichText`. Undefined for regular posts or when the
 * preference is off.
 */
export function useBridgedHtmlSegments(record: unknown) {
  const html = useRenderBridgedHtml() ? getBridgedHtml(record) : undefined
  return html ? htmlToSegments(html) : undefined
}

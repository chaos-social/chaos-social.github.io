/**
 * HTML sanitizer inspired by Mastodon's Sanitize::Config
 * Sanitizes HTML content to prevent XSS while preserving safe formatting
 */

const HTTP_PROTOCOLS = ['http', 'https']

const LINK_PROTOCOLS = [
  'http',
  'https',
  'dat',
  'dweb',
  'ipfs',
  'ipns',
  'ssb',
  'gopher',
  'xmpp',
  'magnet',
  'gemini',
]

const PROTOCOL_REGEX = /^([a-z][a-z0-9.+-]*):\/\//i

interface SanitizeOptions {
  allowOembed?: boolean
}

/**
 * Sanitizes HTML content following Mastodon's strict rules
 */
export function sanitizeHtml(
  html: string,
  options: SanitizeOptions = {},
): string {
  if (typeof DOMParser === 'undefined') {
    // Fallback for environments without DOMParser
    return sanitizeTextOnly(html)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body

  sanitizeNode(body, options)

  return body.innerHTML
}

function sanitizeNode(node: Node, options: SanitizeOptions): void {
  const childNodes = Array.from(node.childNodes)

  for (const child of childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement
      const tagName = element.tagName.toLowerCase()

      // Define allowed elements
      const allowedElements = options.allowOembed
        ? [
            'p',
            'br',
            'span',
            'a',
            'del',
            's',
            'pre',
            'blockquote',
            'code',
            'b',
            'strong',
            'u',
            'i',
            'em',
            'ul',
            'ol',
            'li',
            'ruby',
            'rt',
            'rp',
            'audio',
            'iframe',
            'source',
            'video',
          ]
        : [
            'p',
            'br',
            'span',
            'a',
            'del',
            's',
            'pre',
            'blockquote',
            'code',
            'b',
            'strong',
            'u',
            'i',
            'em',
            'ul',
            'ol',
            'li',
            'ruby',
            'rt',
            'rp',
          ]

      // Handle unsupported elements (h1-h6) - convert to <strong> wrapped in <p>
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const strong = element.ownerDocument!.createElement('strong')
        while (element.firstChild) {
          strong.appendChild(element.firstChild)
        }
        const p = element.ownerDocument!.createElement('p')
        p.appendChild(strong)
        element.replaceWith(p)
        sanitizeNode(p, options)
        continue
      }

      // Handle math elements - extract annotation text
      if (tagName === 'math') {
        const mathText = extractMathAnnotation(element)
        if (mathText) {
          const textNode = element.ownerDocument!.createTextNode(mathText)
          element.replaceWith(textNode)
        } else {
          element.remove()
        }
        continue
      }

      if (tagName === 'li') {
        // Keep li elements but sanitize their children
        sanitizeNode(element, options)
        continue
      }

      // Remove elements not in allowlist
      if (!allowedElements.includes(tagName)) {
        // Replace with text content
        const textNode = element.ownerDocument!.createTextNode(
          element.textContent || '',
        )
        element.replaceWith(textNode)
        continue
      }

      // Sanitize attributes
      sanitizeAttributes(element, options)

      // Recursively sanitize children
      sanitizeNode(element, options)
    }
  }
}

function sanitizeAttributes(
  element: HTMLElement,
  options: SanitizeOptions,
): void {
  const tagName = element.tagName.toLowerCase()
  const allowedAttrs: Record<string, string[]> = {
    a: ['href', 'rel', 'class', 'translate'],
    span: ['class', 'translate'],
    ol: ['start', 'reversed'],
    li: ['value'],
    p: ['class'],
  }

  if (options.allowOembed) {
    allowedAttrs.audio = ['controls']
    allowedAttrs.iframe = [
      'allowfullscreen',
      'frameborder',
      'height',
      'scrolling',
      'src',
      'width',
    ]
    allowedAttrs.source = ['src', 'type']
    allowedAttrs.video = ['controls', 'height', 'loop', 'width']
  }

  const allowed = allowedAttrs[tagName] || []
  const attrs = Array.from(element.attributes)

  // Remove non-allowed attributes
  for (const attr of attrs) {
    const attrName = attr.name.toLowerCase()
    const isAllowed = allowed.some(a => {
      if (a.endsWith('*')) {
        return attrName.startsWith(a.slice(0, -1))
      }
      return a === attrName
    })

    if (!isAllowed) {
      element.removeAttribute(attr.name)
    }
  }

  // Process specific attributes
  if (tagName === 'a') {
    processAnchorElement(element)
  }

  // Process class whitelist
  if (element.hasAttribute('class')) {
    processClassWhitelist(element)
  }

  // Process translate attribute - remove unless it's "no"
  if (element.hasAttribute('translate')) {
    const translate = element.getAttribute('translate')
    if (translate !== 'no') {
      element.removeAttribute('translate')
    }
  }

  // Validate protocols for elements with src/href
  if (element.hasAttribute('href') || element.hasAttribute('src')) {
    validateProtocols(element, options)
  }
}

function processAnchorElement(element: HTMLElement): void {
  // Add required attributes
  element.setAttribute('rel', 'nofollow noopener')
  element.setAttribute('target', '_blank')

  // Check if href has unsupported protocol
  const href = element.getAttribute('href')
  if (href) {
    const scheme = getScheme(href)
    if (scheme !== null && scheme !== 'relative' && !LINK_PROTOCOLS.includes(scheme)) {
      // Replace element with its text content
      const textNode = element.ownerDocument!.createTextNode(
        element.textContent || '',
      )
      element.replaceWith(textNode)
    }
  }
}

function processClassWhitelist(element: HTMLElement): void {
  const classList = element.className.split(/[\t\n\f\r ]+/).filter(Boolean)
  const whitelisted = classList.filter(className => {
    // microformats classes
    if (/^[hpuedt]-/.test(className)) return true
    // semantic classes
    if (/^(mention|hashtag)$/.test(className)) return true
    // link formatting classes
    if (/^(ellipsis|invisible)$/.test(className)) return true
    // quote inline class
    if (className === 'quote-inline') return true
    return false
  })

  if (whitelisted.length > 0) {
    element.className = whitelisted.join(' ')
  } else {
    element.removeAttribute('class')
  }
}

function validateProtocols(
  element: HTMLElement,
  options: SanitizeOptions,
): void {
  const tagName = element.tagName.toLowerCase()
  const src = element.getAttribute('src')
  const href = element.getAttribute('href')
  const url = src || href

  if (!url) return

  const scheme = getScheme(url)

  // For oembed elements, only allow HTTP protocols for src
  if (
    options.allowOembed &&
    src &&
    ['iframe', 'source'].includes(tagName)
  ) {
    if (scheme !== null && !HTTP_PROTOCOLS.includes(scheme)) {
      element.removeAttribute('src')
    }
    // Add sandbox attribute to iframes
    if (tagName === 'iframe') {
      element.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms',
      )
    }
  }
}

function getScheme(url: string): string | null {
  const match = url.match(PROTOCOL_REGEX)
  if (match) {
    return match[1].toLowerCase()
  }
  // Check if it's a relative URL
  if (url.startsWith('/') || url.startsWith('.')) {
    return 'relative'
  }
  return null
}

/**
 * Extract math annotation from MathML element
 * Follows FEP-dc88 spec for math element representation
 */
function extractMathAnnotation(mathElement: HTMLElement): string | null {
  const semantics = Array.from(mathElement.children).find(
    child => child.tagName.toLowerCase() === 'semantics',
  ) as HTMLElement | undefined

  if (!semantics) return null

  // Look for LaTeX annotation (application/x-tex)
  const latexAnnotation = Array.from(semantics.children).find(child => {
    return (
      child.tagName.toLowerCase() === 'annotation' &&
      child.getAttribute('encoding') === 'application/x-tex'
    )
  })

  if (latexAnnotation) {
    const display = mathElement.getAttribute('display')
    const text = latexAnnotation.textContent || ''
    return display === 'block' ? `$$${text}$$` : `$${text}$`
  }

  // Look for plain text annotation
  const plainAnnotation = Array.from(semantics.children).find(child => {
    return (
      child.tagName.toLowerCase() === 'annotation' &&
      child.getAttribute('encoding') === 'text/plain'
    )
  })

  if (plainAnnotation) {
    return plainAnnotation.textContent || null
  }

  return null
}

/**
 * Fallback sanitizer that strips all HTML tags
 */
function sanitizeTextOnly(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

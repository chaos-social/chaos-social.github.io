import {toByteArray} from 'base64-js'
import {Inflate} from 'pako'

/**
 * Inspect PNGs rendered by the image manipulator without retaining decoded RGB
 * pixels. Unknown encodings conservatively keep PNG so alpha is never discarded.
 */
export function renderedPngHasTransparency(base64: string): boolean {
  try {
    const bytes = toByteArray(base64)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (
      view.getUint32(0) !== 0x89504e47 ||
      view.getUint32(4) !== 0x0d0a1a0a ||
      view.getUint32(12) !== 0x49484452
    ) {
      return true
    }

    const width = view.getUint32(16)
    const height = view.getUint32(20)
    const depth = bytes[24]
    const color = bytes[25]
    if (!width || !height || bytes[26] || bytes[27] || bytes[28]) return true

    const chunks: Uint8Array[] = []
    let ended = false
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset)
      const end = offset + 12 + length
      if (end > bytes.length) return true
      const type = view.getUint32(offset + 4)
      if (type === 0x74524e53) return true // tRNS
      if (type === 0x49444154) {
        chunks.push(bytes.subarray(offset + 8, end - 4)) // IDAT
      }
      if (type === 0x49454e44) {
        ended = true
        break
      }
      offset = end
    }
    if (!ended || !chunks.length) return true
    if (color === 0 || color === 2 || color === 3) return false
    if (depth !== 8 || (color !== 4 && color !== 6)) return true

    const channels = color === 4 ? 2 : 4
    const stride = width * channels + 1
    let position = 0
    let filter = 0
    let transparent = false
    const inflater = new Inflate()
    inflater.onData = data => {
      if (transparent) return
      if (!(data instanceof Uint8Array)) {
        transparent = true
        return
      }
      for (const byte of data) {
        const column = position % stride
        const row = Math.floor(position / stride)
        position++
        if (column === 0) {
          filter = byte
          if (filter > 4) transparent = true
        } else if (column % channels === 0) {
          /*
           * Until the first non-opaque alpha, every preceding alpha is 255.
           * Its filtered value can therefore be checked without decoding RGB.
           * For opaque neighbors the Paeth predictor reduces to left || up.
           */
          const left = column > channels ? 255 : 0
          const up = row > 0 ? 255 : 0
          const predictor =
            filter === 0
              ? 0
              : filter === 1
                ? left
                : filter === 2
                  ? up
                  : filter === 3
                    ? Math.floor((left + up) / 2)
                    : left || up
          if (byte !== 255 - predictor) transparent = true
        }
        if (transparent) return
      }
    }
    for (let i = 0; i < chunks.length; i++) {
      if (!inflater.push(chunks[i], i === chunks.length - 1)) return true
      if (transparent || inflater.err) return true
    }
    return position !== stride * height
  } catch {
    return true
  }
}

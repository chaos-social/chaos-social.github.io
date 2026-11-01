/*
 * Archive reading for VNDS games.
 *
 * Games ship as either .tar.gz or .zip, so this handles both and returns a flat
 * path -> bytes map. Pure: no DOM, no service worker, no globals. Kept separate
 * from game-vnds.js so it can be exercised by the test suite.
 */

/** Inflate raw bytes with the browser's DecompressionStream, which every target browser has. */
async function inflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** 512-byte tar headers: name at 0..100, ustar prefix at 345..500, size octal at 124..136. */
async function readTar(bytes) {
  const files = new Map()
  let offset = 0
  const decoder = new TextDecoder()
  const readString = (start, end) => {
    const slice = bytes.subarray(offset + start, offset + end)
    const nul = slice.indexOf(0)
    return decoder.decode(nul === -1 ? slice : slice.subarray(0, nul))
  }

  while (offset + 512 <= bytes.length) {
    const name = readString(0, 100)
    if (!name) break // empty block ends the archive

    const prefix = readString(345, 500)
    const sizeField = readString(124, 136).trim()
    const size = parseInt(sizeField, 8) || 0
    const type = String.fromCharCode(bytes[offset + 156] || 0)
    const path = prefix ? `${prefix}/${name}` : name

    const dataStart = offset + 512
    // Regular files only; directories and metadata headers carry no content.
    if (type === '0' || type === '\0') {
      files.set(path, bytes.subarray(dataStart, dataStart + size))
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return files
}

/** Central-directory-free zip reader: walk local file headers, inflating deflated entries. */
async function readZip(bytes) {
  const files = new Map()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  let offset = 0

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true)
    if (signature !== 0x04034b50) break // not a local file header
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const dataStart = offset + 30 + nameLength + extraLength
    const raw = bytes.subarray(dataStart, dataStart + compressedSize)

    if (!name.endsWith('/')) {
      if (method === 0) files.set(name, raw)
      else if (method === 8) files.set(name, await inflate(raw, 'deflate-raw'))
    }
    /*
     * Sizes are unreliable when a data descriptor is present (0x08 flag), which
     * some zip writers always set. Read sizes from the central directory instead.
     */
    offset = dataStart + compressedSize
    if (compressedSize === 0) offset = findNextHeader(bytes, offset)
  }
  return files
}

function findNextHeader(bytes, offset) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let i = offset; i + 4 <= bytes.length; i++) {
    if (view.getUint32(i, true) === 0x04034b50) return i
  }
  return bytes.length
}

/**
 * Strip a single wrapping directory, e.g. `saya/background/x.png` -> `background/x.png`.
 * Archives produced by "compress this folder" all have one; without this the
 * engine's `dir/background/...` paths would not match.
 */
function stripTopDirectory(files) {
  const paths = Array.from(files.keys())
  const tops = new Set()
  for (const path of paths) {
    const slash = path.indexOf('/')
    if (slash === -1) return files // a loose file at the root: don't strip
    tops.add(path.slice(0, slash))
    if (tops.size > 1) return files
  }
  if (tops.size !== 1) return files
  const top = Array.from(tops)[0] + '/'
  const stripped = new Map()
  for (const [path, data] of files) {
    if (path.startsWith(top)) stripped.set(path.slice(top.length), data)
  }
  return stripped
}

/**
 * Read an archive into a flat file map with any single wrapping directory
 * removed. Throws on an unrecognised format.
 */
async function readArchive(bytes, filenameHint = '') {
  let files
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    files = await readTar(await inflate(bytes, 'gzip'))
  } else if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    files = await readZip(bytes)
  } else if (filenameHint.endsWith('.tar')) {
    files = await readTar(bytes)
  } else {
    throw new Error('Unsupported archive format')
  }
  return stripTopDirectory(files)
}

export {readArchive}

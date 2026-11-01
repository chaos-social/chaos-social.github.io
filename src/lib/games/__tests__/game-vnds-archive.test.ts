// oxlint-disable-next-line import/no-nodejs-modules -- tests run under Node
import fs from 'node:fs'

/*
 * The module is plain ESM because the player loads it with import(); see
 * public/static/iframe/game-vnds.js. It is not part of the app bundle, so it
 * has no TypeScript types of its own.
 */
type ReadArchive = (bytes: Uint8Array) => Promise<Map<string, Uint8Array>>
const ARCHIVE_PATH = '../../../../public/static/iframe/game-vnds-archive'

let readArchive: ReadArchive

beforeAll(async () => {
  const mod = (await import(ARCHIVE_PATH)) as {readArchive: ReadArchive}
  readArchive = mod.readArchive
})

/** Build a minimal ustar archive in memory so the reader is tested without a fixture. */
function tar(entries: [string, Uint8Array][]): Blob {
  const blocks: BlobPart[] = []
  const encoder = new TextEncoder()

  for (const [name, data] of entries) {
    const header = new Uint8Array(512)
    header.set(encoder.encode(name).subarray(0, 100), 0)
    header.set(encoder.encode('0000644').subarray(0, 7), 100) // mode
    header.set(encoder.encode('0000000').subarray(0, 7), 108) // uid
    header.set(encoder.encode('0000000').subarray(0, 7), 116) // gid
    header.set(encoder.encode(data.length.toString(8).padStart(11, '0')), 124)
    header.set(encoder.encode('00000000000'), 136) // mtime
    header[156] = '0'.charCodeAt(0) // regular file
    header.set(encoder.encode('ustar\0'), 257)
    header.set(encoder.encode('00'), 263)
    // The reader does not validate the checksum.
    blocks.push(header, data as BlobPart)

    const padding = (512 - (data.length % 512)) % 512
    if (padding) blocks.push(new Uint8Array(padding))
  }

  blocks.push(new Uint8Array(1024)) // end-of-archive marker
  return new Blob(blocks)
}

async function blobToBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer())
}

/** gzip via the platform stream, so this needs no Node-only import. */
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

describe('readArchive', () => {
  it('reads a gzipped tar and strips the wrapping directory', async () => {
    const encoder = new TextEncoder()
    const source = await blobToBytes(
      tar([
        ['game/info.txt', encoder.encode('title=Saya')],
        ['game/script/main.scr', encoder.encode('text hello')],
      ]),
    )

    const files = await readArchive(await gzip(source))

    expect(Array.from(files.keys()).sort()).toEqual([
      'info.txt',
      'script/main.scr',
    ])
    expect(new TextDecoder().decode(files.get('info.txt'))).toBe('title=Saya')
  })

  it('does not strip when paths share no single directory', async () => {
    const encoder = new TextEncoder()
    const source = await blobToBytes(
      tar([
        ['a/one.txt', encoder.encode('1')],
        ['b/two.txt', encoder.encode('2')],
      ]),
    )

    const files = await readArchive(await gzip(source))

    expect(Array.from(files.keys()).sort()).toEqual(['a/one.txt', 'b/two.txt'])
  })

  it('rejects an unrecognised format', async () => {
    await expect(readArchive(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(
      'Unsupported archive format',
    )
  })

  /*
   * The real test case: a genuine VNDS release. Skipped when absent so the
   * suite still runs on machines that don't have it.
   */
  const saya = 'C:/Users/Maxine/Downloads/saya-1.0.tar.gz'
  const maybe = fs.existsSync(saya) ? it : it.skip

  maybe('reads the Saya archive', async () => {
    const files = await readArchive(new Uint8Array(fs.readFileSync(saya)))

    expect(files.has('info.txt')).toBe(true)
    expect(files.has('script/main.scr')).toBe(true)
    expect(files.get('background/title.jpg')?.subarray(0, 2)).toEqual(
      new Uint8Array([0xff, 0xd8]), // JPEG magic
    )
    expect(new TextDecoder().decode(files.get('info.txt'))).toContain(
      "title=Saya's song",
    )
    // No wrapping directory left over.
    expect(Array.from(files.keys()).some(p => p.startsWith('saya/'))).toBe(false)
  })
})

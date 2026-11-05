import {readArchive as readArchiveJs} from '../../../../../public/static/iframe/game-vnds-archive'

/*
 * The reader is plain JS shared with the player page, so its types do not reach
 * here through the import even under allowJs. This is its actual signature.
 */
const readArchive = readArchiveJs as (
  bytes: Uint8Array,
  filenameHint?: string,
) => Promise<Map<string, Uint8Array>>

/**
 * The cover art a VNDS archive carries. Every archive has one - it is what the
 * engine's own game menu shows - so this needs no emulator and no delay, and it
 * is a better thumbnail than a screenshot of the title screen would be.
 *
 * Resolves to undefined for an unreadable archive or one without art; a
 * thumbnail is a nicety and posting must not fail without one.
 */
export async function captureArchiveThumbnail(
  file: Blob,
): Promise<Blob | undefined> {
  try {
    const files = await readArchive(new Uint8Array(await file.arrayBuffer()))
    const art = files.get('thumbnail.png')
    return art ? new Blob([art as BlobPart], {type: 'image/png'}) : undefined
  } catch {
    return undefined
  }
}

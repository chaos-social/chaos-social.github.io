import {saveVideoToMediaLibrary} from './manip'

export async function saveVideoToDevice({
  uri,
  downloadName,
}: {
  uri: string
  downloadName?: string
}) {
  return await saveVideoToMediaLibrary({uri, downloadName})
}

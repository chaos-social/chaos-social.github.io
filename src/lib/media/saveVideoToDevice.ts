import {saveVideoToMediaLibrary} from './manip'

export async function saveVideoToDevice({uri}: {uri: string}) {
  return await saveVideoToMediaLibrary({uri})
}

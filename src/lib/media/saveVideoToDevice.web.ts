import {downloadVideoWeb} from './manip.web'

export async function saveVideoToDevice({uri}: {uri: string}) {
  return await downloadVideoWeb({uri})
}

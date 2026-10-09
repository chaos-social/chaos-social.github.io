import {downloadVideoWeb} from './manip.web'

export async function saveVideoToDevice({
  uri,
  downloadName,
}: {
  uri: string
  downloadName?: string
}) {
  return await downloadVideoWeb({uri, downloadName})
}

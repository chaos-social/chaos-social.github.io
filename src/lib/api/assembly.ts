import {ASSEMBLY_URL} from '#/env'

/*
 * Links to People's Assembly conversations. Witchsky no longer creates them
 * (the composer writes TOKIMEKI polls), but conversations posted before the
 * switch are still readable and link into the service.
 */

function assemblyOrigin(): string {
  return ASSEMBLY_URL.replace(/\/+$/, '')
}

export function assemblyUrl(conversationId: string): string {
  return `${assemblyOrigin()}/${encodeURIComponent(conversationId)}`
}

export function assemblyReportUrl(reportId: string): string {
  return `${assemblyOrigin()}/report/${encodeURIComponent(reportId)}`
}

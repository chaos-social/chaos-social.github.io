import {useQuery} from '@tanstack/react-query'

import {DOH_ENDPOINT} from '#/lib/constants'
import {STALE} from '#/state/queries'

const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME'] as const

type DnsJsonResponse = {
  Answer?: Array<{data?: string}>
}

export const RQKEY_ROOT = 'handle-link'
export const RQKEY = (handle: string) => [RQKEY_ROOT, handle]

async function hasDnsAnswers(
  handle: string,
  type: (typeof DNS_RECORD_TYPES)[number],
  signal?: AbortSignal,
) {
  const url = new URL(DOH_ENDPOINT)
  url.searchParams.set('name', handle)
  url.searchParams.set('type', type)

  const response = await fetch(url, {
    headers: {
      accept: 'application/dns-json',
    },
    redirect: 'follow',
    signal,
  })

  if (!response.ok) {
    return false
  }

  const result = (await response.json()) as DnsJsonResponse
  return Array.isArray(result.Answer) && result.Answer.length > 0
}

export async function hasWorkingHandleLink(
  handle: string,
  signal?: AbortSignal,
) {
  const results = await Promise.allSettled(
    DNS_RECORD_TYPES.map(type => hasDnsAnswers(handle, type, signal)),
  )

  signal?.throwIfAborted()

  return results.some(
    result => result.status === 'fulfilled' && Boolean(result.value),
  )
}

export function useHandleLinkQuery(handle: string, enabled = true) {
  return useQuery({
    queryKey: RQKEY(handle),
    queryFn: async ({signal}) => {
      return hasWorkingHandleLink(handle, signal)
    },
    enabled,
    staleTime: STALE.HOURS.ONE,
  })
}

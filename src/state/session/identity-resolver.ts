import {type ComAtprotoIdentityDefs, isDid} from '@atproto/api'
import {
  type IdentityInfo,
  type IdentityResolver,
} from '@atproto-labs/identity-resolver'

import {DOH_ENDPOINT} from '#/lib/constants'
import {readPlcDirectory} from '#/state/preferences/plc-directory'
import {createPublicAgent} from './agent'

type AtprotoDid = `did:plc:${string}` | `did:web:${string}`
type DidDocument = {
  id?: string
  alsoKnownAs?: string[]
  service?: Service[]
}

type Service = {
  id?: string
  type?: string
  serviceEndpoint?: string
}

const HANDLE_INVALID = 'handle.invalid'

function asNormalizedHandle(input: string) {
  const handle = input.toLowerCase()
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/.test(
    handle,
  )
    ? handle
    : undefined
}

function extractNormalizedHandle(document: DidDocument) {
  if (!Array.isArray(document.alsoKnownAs)) return

  for (const value of document.alsoKnownAs) {
    if (value.startsWith('at://')) {
      return asNormalizedHandle(value.slice(5))
    }
  }
}

function findService(doc: DidDocument, id: string, type?: string) {
  if (!Array.isArray(doc?.service)) return
  return doc.service.find(
    service =>
      service?.serviceEndpoint &&
      service?.id === id &&
      (!type || service?.type === type),
  )
}

async function resolveHandleUsingAppView(
  handle: string,
  signal?: AbortSignal,
): Promise<AtprotoDid> {
  const agent = createPublicAgent()

  try {
    const res = await agent.resolveHandle({handle}, {signal})
    return res.data.did as AtprotoDid
  } finally {
    agent.dispose()
  }
}

async function resolveHandleUsingDoh(
  handle: string,
  signal?: AbortSignal,
): Promise<AtprotoDid | null> {
  const url = new URL(DOH_ENDPOINT)
  url.searchParams.set('type', 'TXT')
  url.searchParams.set('name', `_atproto.${handle}`)

  const response = await fetch(url, {
    headers: {
      accept: 'application/dns-json',
    },
    redirect: 'follow',
    signal,
  })

  if (!response.ok) {
    return null
  }

  const result = (await response.json()) as {
    Answer?: Array<{type?: number; data?: string}>
  }
  const txtRecords =
    result.Answer?.filter(
      answer => answer.type === 16 && typeof answer.data === 'string',
    ).map(answer => answer.data!.replace(/^"|"$/g, '').replace(/\\"/g, '"')) ??
    []

  let did: AtprotoDid | null = null
  for (const record of txtRecords) {
    if (!record.startsWith('did=')) continue

    const nextDid = record.slice(4)
    if (!isDid(nextDid)) {
      return null
    }

    if (did && did !== nextDid) {
      return null
    }

    did = nextDid as AtprotoDid
  }

  return did
}

async function resolveHandleUsingWellKnown(
  handle: string,
  signal?: AbortSignal,
): Promise<AtprotoDid | null> {
  try {
    const response = await fetch(`https://${handle}/.well-known/atproto-did`, {
      redirect: 'error',
      signal,
    })
    const text = await response.text()
    const firstLine = text.split('\n')[0]?.trim()
    return firstLine && isDid(firstLine) ? (firstLine as AtprotoDid) : null
  } catch {
    signal?.throwIfAborted()
    return null
  }
}

async function resolveHandleClientSide(
  handle: string,
  signal?: AbortSignal,
): Promise<AtprotoDid | null> {
  try {
    const did = await resolveHandleUsingDoh(handle, signal)
    if (did) return did
  } catch {
    signal?.throwIfAborted()
  }

  return resolveHandleUsingWellKnown(handle, signal)
}

async function resolveHandle(
  handle: string,
  signal?: AbortSignal,
): Promise<AtprotoDid> {
  try {
    return await resolveHandleUsingAppView(handle, signal)
  } catch (appViewError) {
    const fallbackDid = await resolveHandleClientSide(handle, signal)
    if (fallbackDid) {
      return fallbackDid
    }

    throw appViewError
  }
}

async function resolveDidDocument(
  did: AtprotoDid,
  signal?: AbortSignal,
): Promise<DidDocument> {
  const docUrl = did.startsWith('did:plc:')
    ? `${readPlcDirectory()}/${did}`
    : `https://${did.substring(8)}/.well-known/did.json`

  const res = await fetch(docUrl, {
    headers: {
      accept: 'application/did+ld+json, application/json',
    },
    signal,
  })

  if (!res.ok) {
    throw new Error(`Failed to resolve DID document for ${did}`)
  }

  return (await res.json()) as DidDocument
}

async function getValidatedHandleFromDidDocument(
  did: AtprotoDid,
  didDoc: DidDocument,
  signal?: AbortSignal,
) {
  const handle = extractNormalizedHandle(didDoc)
  if (!handle) return HANDLE_INVALID

  try {
    const resolvedDid = await resolveHandle(handle, signal)
    return resolvedDid === did ? handle : HANDLE_INVALID
  } catch {
    return HANDLE_INVALID
  }
}

export async function resolveIdentityUsingAppView(
  identifier: string,
  signal?: AbortSignal,
): Promise<ComAtprotoIdentityDefs.IdentityInfo> {
  if (isDid(identifier)) {
    const did = identifier as AtprotoDid
    const didDoc = await resolveDidDocument(did, signal)
    const handle = await getValidatedHandleFromDidDocument(did, didDoc, signal)

    return {
      did,
      didDoc,
      handle,
    }
  }

  const handle = asNormalizedHandle(identifier)
  if (!handle) {
    throw new Error(`Invalid handle "${identifier}" provided.`)
  }

  const did = await resolveHandle(handle, signal)
  const didDoc = await resolveDidDocument(did, signal)

  return {
    did,
    didDoc,
    handle: extractNormalizedHandle(didDoc) ?? HANDLE_INVALID,
  }
}

export function createIdentityResolver(): IdentityResolver {
  return {
    async resolve(
      input: string,
      options?: {signal?: AbortSignal},
    ): Promise<IdentityInfo> {
      const identity = await resolveIdentityUsingAppView(input, options?.signal)

      return {
        did: identity.did as AtprotoDid,
        didDoc: identity.didDoc as IdentityInfo['didDoc'],
        handle: identity.handle,
      }
    },
  }
}

export function getPdsServiceUrlFromIdentityInfo(
  identity: Pick<ComAtprotoIdentityDefs.IdentityInfo, 'didDoc'>,
) {
  return findService(
    identity.didDoc as DidDocument,
    '#atproto_pds',
    'AtprotoPersonalDataServer',
  )?.serviceEndpoint
}

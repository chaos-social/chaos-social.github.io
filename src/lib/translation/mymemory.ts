import {logger} from '#/logger'
import {type TranslationResult} from './types'

type MyMemoryResponse = {
  quotaFinished?: boolean
  responseStatus?: number | string
  responseDetails?: string
  responseData?: {
    translatedText?: string
    detectedLanguage?: string
  }
}

const ENDPOINT = 'https://api.mymemory.translated.net/get'

/** MyMemory rejects `q` over this many characters. */
const MAX_CHUNK_LENGTH = 480
/** A long reply chain in one post is not worth a chunk of the daily quota. */
const MAX_TEXT_LENGTH = 1500

// shortcut: the quota is tracked in memory only, a restart forgets that we ran
// out today and the first call pays for the 403. Fine while the API has no
// cheap way to ask how much is left; upgrade if we start logging those 403s.
let quotaExhausted = false
let quotaLogged = false

/*
 * Repeat translations of the same text are free, so scrolling a post out and
 * back in never spends quota twice. Insertion order doubles as the eviction
 * order, and in-flight promises are cached too so two mounts share a request.
 */
const CACHE_LIMIT = 256
const cache = new Map<string, Promise<TranslationResult>>()

function cachedTranslate(
  key: string,
  fn: () => Promise<TranslationResult>,
): Promise<TranslationResult> {
  const hit = cache.get(key)
  if (hit) return hit

  const promise = fn().catch(err => {
    cache.delete(key)
    throw err
  })
  cache.set(key, promise)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return promise
}

/*
 * MyMemory enforces a call rate and a feed can reveal a screenful of foreign
 * posts at once, so requests go out one at a time rather than as a burst.
 */
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}

/**
 * Splits text into pieces MyMemory accepts, preferring sentence and word
 * boundaries so a translation is not cut mid-phrase.
 */
export function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let rest = text.trim()
  while (rest.length > MAX_CHUNK_LENGTH) {
    const window = rest.slice(0, MAX_CHUNK_LENGTH)
    const boundary =
      Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('! '),
        window.lastIndexOf('? '),
        window.lastIndexOf('\n'),
        window.lastIndexOf(' '),
      ) + 1
    const at = boundary > 0 ? boundary : MAX_CHUNK_LENGTH
    chunks.push(rest.slice(0, at).trimEnd())
    rest = rest.slice(at).trimStart()
  }
  if (rest) chunks.push(rest)
  return chunks
}

async function translateChunk(
  text: string,
  sourceLanguage: string | undefined,
  targetLanguage: string,
  email: string | undefined,
): Promise<{text: string; detectedLanguage: string | null}> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLanguage ?? 'Autodetect'}|${targetLanguage}`,
  })
  if (email) params.set('de', email)

  const res = await fetch(`${ENDPOINT}?${params}`)
  const data = (await res.json()) as MyMemoryResponse

  if (data?.quotaFinished) {
    quotaExhausted = true
    if (!quotaLogged) {
      quotaLogged = true
      logger.warn('MyMemory daily quota finished')
    }
    throw new Error('MyMemory daily quota finished')
  }

  const status = Number(data?.responseStatus)
  if (status !== 200 || !res.ok) {
    throw new Error(
      typeof data?.responseDetails === 'string' && data.responseDetails
        ? data.responseDetails
        : `MyMemory returned ${status || res.status}`,
    )
  }

  const translatedText = data?.responseData?.translatedText
  if (typeof translatedText !== 'string' || !translatedText.trim()) {
    throw new Error('MyMemory returned an empty translation')
  }

  return {
    text: translatedText,
    detectedLanguage: data?.responseData?.detectedLanguage ?? null,
  }
}

/**
 * In-app translation through the free MyMemory API. Used as a provider and as
 * the engine behind automatic translation, since it works on web where there
 * is no on-device translator.
 */
export async function translateWithMyMemory({
  text,
  targetLanguage,
  sourceLanguage,
  email,
}: {
  text: string
  targetLanguage: string
  sourceLanguage?: string
  email?: string
}): Promise<TranslationResult> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Nothing to translate')
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new Error('Text is too long for MyMemory')
  }
  if (quotaExhausted) throw new Error('MyMemory daily quota finished')

  return cachedTranslate(
    `${trimmed}|${sourceLanguage ?? ''}|${targetLanguage}`,
    () =>
      enqueue(async () => {
        const chunks = splitIntoChunks(trimmed)
        const translated: string[] = []
        let detectedLanguage: string | null = null
        for (const chunk of chunks) {
          const result = await translateChunk(
            chunk,
            sourceLanguage,
            targetLanguage,
            email,
          )
          detectedLanguage ??= result.detectedLanguage
          translated.push(result.text)
        }
        return {
          translatedText: translated.join('\n'),
          sourceLanguage: sourceLanguage ?? detectedLanguage,
          targetLanguage,
        }
      }),
  ).catch(err => {
    // Quota exhaustion is logged once by `translateChunk`; an unsupported
    // language pair is routine, so only unexpected failures reach the log.
    const message = String((err as Error)?.message)
    if (!message.startsWith('MyMemory returned') && !/quota/i.test(message)) {
      logger.warn('MyMemory translation failed', {safeMessage: err})
    }
    throw err
  })
}

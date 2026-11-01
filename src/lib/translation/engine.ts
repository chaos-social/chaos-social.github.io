import {type TranslationState} from './types'

export type TranslationEngine = 'on-device' | 'mymemory' | 'none'

/**
 * Picks the inline engine for one translation call. Manual taps keep the
 * existing behaviour: on-device where it exists, otherwise the configured
 * link-out provider. Automatic translation needs an engine that works
 * everywhere, so it uses MyMemory (and the daily quota) instead.
 */
export function resolveTranslationEngine({
  isAuto,
  provider,
  isOnDeviceSupported,
}: {
  isAuto: boolean
  provider: string
  isOnDeviceSupported: boolean
}): TranslationEngine {
  if (provider === 'mymemory') return 'mymemory'
  if (isAuto) return 'mymemory'
  return isOnDeviceSupported ? 'on-device' : 'none'
}

/**
 * Automatic translations fail quietly: the post goes back to looking idle so
 * its Translate link is available, and it is not retried on the next scroll.
 */
export function isSilentlyFailed(state: TranslationState | undefined) {
  return state?.status === 'error' && state.silent === true
}

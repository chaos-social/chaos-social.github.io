import {useCallback} from 'react'

import {useGoogleTranslate} from '#/lib/hooks/useGoogleTranslate'
import {
  useMymemoryEmail,
  useTranslationServicePreference,
} from '#/state/preferences/translation-service-preference'
import {resolveTranslationEngine} from './engine'
import {translateWithMyMemory} from './mymemory'
import {TranslationStateProvider} from './state'
import {type TranslationFunctionParams, type TranslationResult} from './types'

export {useTranslate} from './state'
export * from './types'
export * from './utils'

/**
 * Web translation. There is no on-device translator here, so MyMemory is the
 * only inline engine; without it a translation opens an external service.
 */
export function Provider({children}: React.PropsWithChildren<unknown>) {
  const googleTranslate = useGoogleTranslate()
  const provider = useTranslationServicePreference()
  const email = useMymemoryEmail()

  const canTranslateInline = useCallback(
    (params: TranslationFunctionParams) =>
      !params.forceGoogleTranslate &&
      resolveTranslationEngine({
        isAuto: Boolean(params.isAuto),
        provider,
        isOnDeviceSupported: false,
      }) !== 'none',
    [provider],
  )

  const translateInline = useCallback(
    (params: TranslationFunctionParams): Promise<TranslationResult> =>
      translateWithMyMemory({
        text: params.text,
        targetLanguage: params.expectedTargetLanguage,
        sourceLanguage: params.expectedSourceLanguage,
        email,
      }),
    [email],
  )

  const openExternal = useCallback(
    (params: TranslationFunctionParams) =>
      googleTranslate(
        params.text,
        params.expectedTargetLanguage,
        params.expectedSourceLanguage,
      ),
    [googleTranslate],
  )

  return (
    <TranslationStateProvider
      canTranslateInline={canTranslateInline}
      translateInline={translateInline}
      openExternal={openExternal}>
      {children}
    </TranslationStateProvider>
  )
}

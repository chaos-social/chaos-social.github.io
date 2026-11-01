import {useCallback} from 'react'
import {getLocales} from 'expo-localization'
import {onTranslateTask} from '@bsky.app/expo-translate-text'
import {useLingui} from '@lingui/react/macro'

import {useGoogleTranslate} from '#/lib/hooks/useGoogleTranslate'
import {codeToLanguageName} from '#/locale/helpers'
import {logger} from '#/logger'
import {useLanguagePrefs} from '#/state/preferences'
import {
  useMymemoryEmail,
  useTranslationServicePreference,
} from '#/state/preferences/translation-service-preference'
import {IS_ANDROID, IS_IOS, IS_TRANSLATION_SUPPORTED} from '#/env'
import {resolveTranslationEngine} from './engine'
import {translateWithMyMemory} from './mymemory'
import {TranslationStateProvider} from './state'
import {type TranslationFunctionParams, type TranslationResult} from './types'
import {guessLanguage} from './utils'

export {useTranslate} from './state'
export * from './types'
export * from './utils'

const E_SAME_AS_SOURCE_LANGUAGE =
  'Translation result is the same as the source text.'
const E_EMPTY_RESULT = 'Translation result is empty.'
const E_INVALID_SOURCE_LANGUAGE = 'Invalid source language'

/**
 * Attempts on-device translation via @bsky.app/expo-translate-text.
 * Uses a lazy import to avoid crashing if the native module isn't linked into
 * the current build.
 */
async function attemptTranslation(
  input: string,
  targetLangCodeOriginal: string,
  sourceLangCodeOriginal?: string, // Auto-detects if not provided
): Promise<TranslationResult> {
  // Note that Android only supports two-character language codes and will fail
  // on other input.
  // https://developers.google.com/android/reference/com/google/mlkit/nl/translate/TranslateLanguage
  let targetLangCode = IS_ANDROID
    ? targetLangCodeOriginal.split('-')[0]
    : targetLangCodeOriginal
  const sourceLangCode = IS_ANDROID
    ? sourceLangCodeOriginal?.split('-')[0]
    : sourceLangCodeOriginal

  // Special cases for regional languages since iOS differentiates and missing
  // language packs must be downloaded and installed.
  if (IS_IOS) {
    const deviceLocales = getLocales()
    const primaryLanguageTag = deviceLocales[0]?.languageTag
    switch (targetLangCodeOriginal) {
      case 'en': // en-US, en-GB
      case 'es': // es-419, es-ES
      case 'pt': // pt-BR, pt-PT
      case 'zh': // zh-Hans-CN, zh-Hant-HK, zh-Hant-TW
        if (
          primaryLanguageTag &&
          primaryLanguageTag.startsWith(targetLangCodeOriginal)
        ) {
          targetLangCode = primaryLanguageTag
        }
        break
    }
  }

  const result = await onTranslateTask({
    input,
    targetLangCode,
    sourceLangCode,
  })

  // Since `input` is always a string, the result should always be a string.
  const translatedText =
    typeof result.translatedTexts === 'string' ? result.translatedTexts : ''

  if (translatedText === input) {
    throw new Error(E_SAME_AS_SOURCE_LANGUAGE)
  }

  if (translatedText === '') {
    throw new Error(E_EMPTY_RESULT)
  }

  return {
    translatedText,
    targetLanguage: result.targetLanguage,
    sourceLanguage:
      result.sourceLanguage ?? sourceLangCode ?? guessLanguage(input),
  }
}

/**
 * Native translation. Attempts on-device translation using Apple Translation
 * (iOS 18+) or Google ML Kit (Android), and uses MyMemory when it is the
 * chosen provider or when the translation is automatic.
 *
 * Falls back to the configured translator service (Google by default) when
 * neither is available.
 *
 * Web uses index.web.tsx.
 */
export function Provider({children}: React.PropsWithChildren<unknown>) {
  const {t: l} = useLingui()
  const langPrefs = useLanguagePrefs()
  const googleTranslate = useGoogleTranslate()
  const provider = useTranslationServicePreference()
  const email = useMymemoryEmail()

  const resolveEngine = useCallback(
    (params: TranslationFunctionParams) =>
      params.forceGoogleTranslate
        ? 'none'
        : resolveTranslationEngine({
            isAuto: Boolean(params.isAuto),
            provider,
            isOnDeviceSupported: IS_TRANSLATION_SUPPORTED,
          }),
    [provider],
  )

  const canTranslateInline = useCallback(
    (params: TranslationFunctionParams) => resolveEngine(params) !== 'none',
    [resolveEngine],
  )

  const translateInline = useCallback(
    async (params: TranslationFunctionParams): Promise<TranslationResult> => {
      if (resolveEngine(params) === 'mymemory') {
        return translateWithMyMemory({
          text: params.text,
          targetLanguage: params.expectedTargetLanguage,
          sourceLanguage: params.expectedSourceLanguage,
          email,
        })
      }

      try {
        return await attemptTranslation(
          params.text,
          params.expectedTargetLanguage,
          params.expectedSourceLanguage,
        )
      } catch (err) {
        const e = err as Error
        logger.warn('Failed to translate text on device', {safeMessage: e})
        let errorMessage = l`Device failed to translate :(`
        if (e.message === E_SAME_AS_SOURCE_LANGUAGE) {
          errorMessage = l`Translation to the same language is unavailable on your device.`
        }
        if (e.message === E_EMPTY_RESULT) {
          errorMessage = l`No translation received from your device.`
        }
        if (
          params.expectedSourceLanguage &&
          e.message.includes(E_INVALID_SOURCE_LANGUAGE)
        ) {
          errorMessage = l`${codeToLanguageName(
            params.expectedSourceLanguage,
            langPrefs.appLanguage,
          )} is not supported by your device.`
        }
        throw new Error(errorMessage)
      }
    },
    [email, langPrefs.appLanguage, l, resolveEngine],
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

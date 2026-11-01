import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {LayoutAnimation, Platform} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'

import {useAnalytics} from '#/analytics'
import {IS_ANDROID} from '#/env'
import {Context} from './context'
import {isSilentlyFailed} from './engine'
import {
  type ContextType,
  type TranslationFunctionParams,
  type TranslationOptions,
  type TranslationResult,
  type TranslationState,
} from './types'

export type TranslateText = (
  params: TranslationFunctionParams,
) => Promise<TranslationResult>

export type TranslationEngines = {
  /** False when the only option is to open an external translator. */
  canTranslateInline: (params: TranslationFunctionParams) => boolean
  translateInline: TranslateText
  openExternal: (params: TranslationFunctionParams) => Promise<void>
}

/**
 * Stateful half of the translation feature, shared by the native and web
 * providers. It knows nothing about where a translation comes from: the
 * caller supplies the engines, and this file owns the state map, the
 * per-screen ref counting, and the failure handling.
 */
export function TranslationStateProvider({
  canTranslateInline,
  translateInline,
  openExternal,
  children,
}: React.PropsWithChildren<TranslationEngines>) {
  const [translationState, setTranslationState] = useState<
    Record<string, TranslationState>
  >({})
  /*
   * Kept in a ref rather than state: every post acquires a key on mount and
   * releases it on unmount, so state here re-rendered this near-root provider
   * for every post that scrolled in or out of the feed.
   */
  const refCounts = useRef(new Map<string, number>())
  const isPruneScheduled = useRef(false)
  /*
   * `translate` reads the latest state through a ref so its identity stays
   * stable; otherwise every finished translation would give every consumer a
   * new callback and re-run their effects.
   */
  const stateRef = useRef(translationState)
  useEffect(() => {
    stateRef.current = translationState
  }, [translationState])
  const ax = useAnalytics()

  const acquireTranslation = useCallback((key: string) => {
    refCounts.current.set(key, (refCounts.current.get(key) ?? 0) + 1)

    return () => {
      const newCount = (refCounts.current.get(key) ?? 1) - 1
      if (newCount > 0) {
        refCounts.current.set(key, newCount)
        return
      }
      refCounts.current.delete(key)

      /*
       * Wait for the current flush of effects to finish before pruning. A
       * release is often followed by an acquire of the same key in the same
       * flush - going back from a thread to the feed blurs one screen and
       * focuses the other - and the translation has to survive that.
       */
      if (isPruneScheduled.current) return
      isPruneScheduled.current = true
      queueMicrotask(() => {
        isPruneScheduled.current = false
        /*
         * Drop translations that no mounted post uses anymore. Returning
         * `prev` when there is nothing to drop (the common case) lets React
         * skip the update entirely.
         */
        setTranslationState(prev => {
          const keysToDelete = Object.keys(prev).filter(
            k => !refCounts.current.has(k),
          )
          if (keysToDelete.length === 0) {
            return prev
          }
          const newState = {...prev}
          keysToDelete.forEach(k => {
            delete newState[k]
          })
          return newState
        })
      })
    }
  }, [])

  const clearTranslation = useCallback((key: string) => {
    if (!IS_ANDROID) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
    setTranslationState(prev => {
      const next = {...prev}
      delete next[key]
      return next
    })
  }, [])

  const translate = useCallback<ContextType['translate']>(
    async (
      {
        text,
        expectedTargetLanguage,
        expectedSourceLanguage,
        possibleSourceLanguages,
        forceGoogleTranslate: forceGoogleTranslateOverride,
        isAuto = false,
      },
      {key, forceGoogleTranslate},
    ) => {
      /*
       * Once this post has failed to translate, do not spend another request
       * on it every time it scrolls back into view. A tap always goes through
       * so the reader can decide to retry.
       */
      const previous = stateRef.current[key]
      if (isAuto && previous?.status === 'error') return

      const params: TranslationFunctionParams = {
        text,
        expectedTargetLanguage,
        expectedSourceLanguage,
        possibleSourceLanguages,
        forceGoogleTranslate:
          forceGoogleTranslateOverride ?? forceGoogleTranslate,
        isAuto,
      }
      const inline = canTranslateInline(params)

      ax.metric('translate', {
        os: Platform.OS,
        possibleSourceLanguages,
        expectedTargetLanguage,
        textLength: text.length,
        googleTranslate: !inline,
        isAuto,
        inline,
      })

      if (!inline) {
        await openExternal(params)
        return
      }

      animateNextLayout()
      setTranslationState(prev => ({
        ...prev,
        [key]: {status: 'loading'},
      }))
      try {
        const result = await translateInline(params)
        ax.metric('translate:result', {
          success: true,
          os: Platform.OS,
          possibleSourceLanguages,
          expectedSourceLanguage: expectedSourceLanguage ?? null,
          expectedTargetLanguage,
          resultSourceLanguage: result.sourceLanguage,
          resultTargetLanguage: result.targetLanguage,
          textLength: text.length,
        })
        animateNextLayout()
        setTranslationState(prev => ({
          ...prev,
          [key]: {
            status: 'success',
            translatedText: result.translatedText,
            sourceLanguage: result.sourceLanguage,
            targetLanguage: result.targetLanguage,
          },
        }))
      } catch (err) {
        ax.metric('translate:result', {
          success: false,
          os: Platform.OS,
          possibleSourceLanguages,
          expectedSourceLanguage: expectedSourceLanguage ?? null,
          expectedTargetLanguage,
          resultSourceLanguage: null,
          resultTargetLanguage: null,
          textLength: text.length,
        })
        animateNextLayout()
        setTranslationState(prev => ({
          ...prev,
          [key]: {
            status: 'error',
            message: (err as Error)?.message ?? '',
            silent: isAuto,
          },
        }))
      }
    },
    [ax, canTranslateInline, openExternal, translateInline],
  )

  const ctx = useMemo(
    () => ({acquireTranslation, clearTranslation, translate, translationState}),
    [acquireTranslation, clearTranslation, translate, translationState],
  )

  return <Context.Provider value={ctx}>{children}</Context.Provider>
}

export function useTranslate({
  key,
  forceGoogleTranslate = false,
}: TranslationOptions) {
  const context = useContext(Context)
  if (!context) {
    throw new Error(
      'useTranslate must be used within a TranslateOnDeviceProvider',
    )
  }

  useFocusEffect(
    useCallback(() => {
      return context.acquireTranslation(key)
    }, [key, context]),
  )

  const translate = useCallback(
    async (params: TranslationFunctionParams) => {
      return context.translate(params, {key, forceGoogleTranslate})
    },
    [context, forceGoogleTranslate, key],
  )

  const clearTranslation = useCallback(
    () => context.clearTranslation(key),
    [context, key],
  )

  return useMemo(
    () => ({
      /* Silent failures look idle so the Translate link comes back. */
      translationState: isSilentlyFailed(context.translationState[key])
        ? IDLE
        : (context.translationState[key] ?? IDLE),
      translate,
      clearTranslation,
    }),
    [clearTranslation, context.translationState, key, translate],
  )
}

const IDLE: TranslationState = {status: 'idle'}

function animateNextLayout() {
  if (!IS_ANDROID) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
  }
}

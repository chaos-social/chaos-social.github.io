import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['translationServicePreference']
type SetContext = (v: persisted.Schema['translationServicePreference']) => void
type InstanceStateContext = persisted.Schema['libreTranslateInstance']
type SetInstanceContext = (
  v: persisted.Schema['libreTranslateInstance'],
) => void
type AutoTranslateContext = persisted.Schema['autoTranslatePosts']
type SetAutoTranslateContext = (
  v: persisted.Schema['autoTranslatePosts'],
) => void
type MymemoryEmailContext = persisted.Schema['mymemoryEmail']
type SetMymemoryEmailContext = (v: persisted.Schema['mymemoryEmail']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.translationServicePreference,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['translationServicePreference']) => {},
)
const instanceStateContext = createContext<InstanceStateContext>(
  persisted.defaults.libreTranslateInstance,
)
const setInstanceContext = createContext<SetInstanceContext>(
  (_: persisted.Schema['libreTranslateInstance']) => {},
)
const autoTranslateContext = createContext<AutoTranslateContext>(
  persisted.defaults.autoTranslatePosts,
)
const setAutoTranslateContext = createContext<SetAutoTranslateContext>(
  (_: persisted.Schema['autoTranslatePosts']) => {},
)
const mymemoryEmailContext = createContext<MymemoryEmailContext>(
  persisted.defaults.mymemoryEmail,
)
const setMymemoryEmailContext = createContext<SetMymemoryEmailContext>(
  (_: persisted.Schema['mymemoryEmail']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(
    persisted.get('translationServicePreference'),
  )
  const [instanceState, setInstanceState] = useState(
    persisted.get('libreTranslateInstance'),
  )
  const [autoTranslate, setAutoTranslate] = useState(
    persisted.get('autoTranslatePosts'),
  )
  const [mymemoryEmail, setMymemoryEmail] = useState(
    persisted.get('mymemoryEmail'),
  )

  const setStateWrapped = useCallback(
    (
      translationServicePreference: persisted.Schema['translationServicePreference'],
    ) => {
      setState(translationServicePreference)
      void persisted.write(
        'translationServicePreference',
        translationServicePreference,
      )
    },
    [setState],
  )

  const setInstanceStateWrapped = useCallback(
    (libreTranslateInstance: persisted.Schema['libreTranslateInstance']) => {
      setInstanceState(libreTranslateInstance)
      void persisted.write('libreTranslateInstance', libreTranslateInstance)
    },
    [setInstanceState],
  )

  const setAutoTranslateWrapped = useCallback(
    (v: persisted.Schema['autoTranslatePosts']) => {
      setAutoTranslate(v)
      void persisted.write('autoTranslatePosts', v)
    },
    [setAutoTranslate],
  )

  const setMymemoryEmailWrapped = useCallback(
    (v: persisted.Schema['mymemoryEmail']) => {
      setMymemoryEmail(v)
      void persisted.write('mymemoryEmail', v)
    },
    [setMymemoryEmail],
  )

  useEffect(() => {
    return persisted.onUpdate(
      'translationServicePreference',
      nextTranslationServicePreference => {
        setState(nextTranslationServicePreference)
      },
    )
  }, [setStateWrapped])

  useEffect(() => {
    return persisted.onUpdate('libreTranslateInstance', nextInstance => {
      setInstanceState(nextInstance)
    })
  }, [setInstanceStateWrapped])

  useEffect(() => {
    return persisted.onUpdate('autoTranslatePosts', nextValue => {
      setAutoTranslate(nextValue)
    })
  }, [setAutoTranslateWrapped])

  useEffect(() => {
    return persisted.onUpdate('mymemoryEmail', nextValue => {
      setMymemoryEmail(nextValue)
    })
  }, [setMymemoryEmailWrapped])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        <instanceStateContext.Provider value={instanceState}>
          <setInstanceContext.Provider value={setInstanceStateWrapped}>
            <autoTranslateContext.Provider value={autoTranslate}>
              <setAutoTranslateContext.Provider value={setAutoTranslateWrapped}>
                <mymemoryEmailContext.Provider value={mymemoryEmail}>
                  <setMymemoryEmailContext.Provider
                    value={setMymemoryEmailWrapped}>
                    {children}
                  </setMymemoryEmailContext.Provider>
                </mymemoryEmailContext.Provider>
              </setAutoTranslateContext.Provider>
            </autoTranslateContext.Provider>
          </setInstanceContext.Provider>
        </instanceStateContext.Provider>
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useTranslationServicePreference() {
  return useContext(stateContext)
}

export function useSetTranslationServicePreference() {
  return useContext(setContext)
}

export function useLibreTranslateInstanceSetting() {
  return useContext(instanceStateContext)
}

export function useLibreTranslateInstance() {
  return (
    useContext(instanceStateContext) ??
    persisted.defaults.libreTranslateInstance!
  )
}

export function useSetLibreTranslateInstance() {
  return useContext(setInstanceContext)
}

/** Translate posts in other languages automatically as they scroll into view. */
export function useAutoTranslatePosts() {
  return useContext(autoTranslateContext) ?? false
}

export function useSetAutoTranslatePosts() {
  return useContext(setAutoTranslateContext)
}

/** Contact email sent as `de` to MyMemory, which raises its daily quota. */
export function useMymemoryEmail() {
  return useContext(mymemoryEmailContext)
}

export function useSetMymemoryEmail() {
  return useContext(setMymemoryEmailContext)
}

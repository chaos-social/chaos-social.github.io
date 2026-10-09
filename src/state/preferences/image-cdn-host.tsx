import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['imageCdnHost']
type SetContext = (v: persisted.Schema['imageCdnHost']) => void
type CustomStateContext = persisted.Schema['imageCdnHostCustom']
type SetCustomContext = (v: persisted.Schema['imageCdnHostCustom']) => void

const stateContext = createContext<StateContext>(undefined)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['imageCdnHost']) => {},
)
const customStateContext = createContext<CustomStateContext>(undefined)
const setCustomContext = createContext<SetCustomContext>(
  (_: persisted.Schema['imageCdnHostCustom']) => {},
)

const DEFAULT_IMAGE_CDN_ORIGIN = 'https://cdn.bsky.app'

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('imageCdnHost'))
  const [customState, setCustomState] = useState(
    persisted.get('imageCdnHostCustom'),
  )

  const setStateWrapped = useCallback(
    (imageCdnHost: persisted.Schema['imageCdnHost']) => {
      setState(imageCdnHost)
      void persisted.write('imageCdnHost', imageCdnHost)
    },
    [setState],
  )

  const setCustomStateWrapped = useCallback(
    (imageCdnHostCustom: persisted.Schema['imageCdnHostCustom']) => {
      setCustomState(imageCdnHostCustom)
      void persisted.write('imageCdnHostCustom', imageCdnHostCustom)
    },
    [setCustomState],
  )

  useEffect(() => {
    return persisted.onUpdate('imageCdnHost', nextImageCdnHost => {
      setState(nextImageCdnHost)
    })
  }, [setStateWrapped])

  useEffect(() => {
    return persisted.onUpdate('imageCdnHostCustom', nextImageCdnHostCustom => {
      setCustomState(nextImageCdnHostCustom)
    })
  }, [setCustomStateWrapped])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        <customStateContext.Provider value={customState}>
          <setCustomContext.Provider value={setCustomStateWrapped}>
            {children}
          </setCustomContext.Provider>
        </customStateContext.Provider>
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useImageCdnHostSetting() {
  return useContext(stateContext)
}

export function useImageCdnHostCustom() {
  return useContext(customStateContext)
}

export function useImageCdnHost() {
  return useContext(stateContext)
}

export function useSetImageCdnHost() {
  return useContext(setContext)
}

export function useSetImageCdnHostCustom() {
  return useContext(setCustomContext)
}

function normalizeOrigin(input: string) {
  try {
    return new URL(input).origin
  } catch {
    return null
  }
}

function modifyImageCdnHost(src: string, imageCdnHost: string) {
  try {
    const srcUrl = new URL(src)
    if (srcUrl.protocol !== 'https:' && srcUrl.protocol !== 'http:') {
      return null
    }
    if (!srcUrl.pathname.startsWith('/img/')) {
      return null
    }

    const cdnUrl = new URL(imageCdnHost)
    srcUrl.protocol = cdnUrl.protocol
    srcUrl.hostname = cdnUrl.hostname
    srcUrl.port = cdnUrl.port

    return srcUrl.toString()
  } catch {
    return null
  }
}

export function maybeModifyImageCdnHost(src: string, imageCdnHost?: string) {
  if (!imageCdnHost) {
    return src
  }

  const nextOrigin = normalizeOrigin(imageCdnHost)
  if (!nextOrigin || nextOrigin === DEFAULT_IMAGE_CDN_ORIGIN) {
    return src
  }

  return modifyImageCdnHost(src, nextOrigin) ?? src
}

import {modifyImageFormat} from '#/lib/media/util'

/**
 * Combined image transformation pipeline: applies image format, then CDN host
 * rewrite.
 */
export function applyImageTransforms(
  src: string,
  options: {
    imageCdnHost?: string
    format?: string
    originalMimeType?: string
  },
) {
  const withFormat = options.format
    ? modifyImageFormat(src, options.format, options.originalMimeType)
    : src
  return maybeModifyImageCdnHost(withFormat, options.imageCdnHost)
}

import {createContext, useContext, useEffect, useState} from 'react'

import {type EmojiFont, loadEmojiFont, setEmojiFont} from '#/lib/emojiFont'
import {logger} from '#/logger'
import * as persisted from '#/state/persisted'

const stateContext = createContext<EmojiFont>('system')
const setContext = createContext<(font: EmojiFont) => void>(() => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [font, setFont] = useState<EmojiFont>(
    persisted.get('emojiFont') ?? 'system',
  )

  function setFontAndPersist(value: EmojiFont) {
    setFont(value)
    void persisted.write('emojiFont', value)
  }

  useEffect(() => {
    return persisted.onUpdate('emojiFont', value => {
      setFont(value ?? 'system')
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setEmojiFont('system')
    if (font !== 'system') {
      loadEmojiFont(font)
        .then(() => {
          if (!cancelled) setEmojiFont(font)
        })
        .catch(error => {
          logger.error('Failed to load emoji font', {safeMessage: error})
        })
    }
    return () => {
      cancelled = true
      setEmojiFont('system')
    }
  }, [font])

  return (
    <stateContext.Provider value={font}>
      <setContext.Provider value={setFontAndPersist}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useEmojiFont() {
  return useContext(stateContext)
}

export function useSetEmojiFont() {
  return useContext(setContext)
}

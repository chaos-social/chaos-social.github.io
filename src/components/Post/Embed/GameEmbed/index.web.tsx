import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {type GameEmbed as Game, getGameAspect, getGamePlayerUrl} from './utils'

/**
 * Web plays the game inline. The player is a separate page on the same origin
 * so Ruffle/CheerpJ stay out of the app bundle and a hung game can't block the
 * feed.
 */
export function GameEmbed({
  view,
  game,
  style,
  onOpen,
}: {
  view: app.bsky.embed.external.ViewExternal
  game: Game
  style?: React.ComponentProps<typeof View>['style']
  onOpen?: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const shapePreference = useEnableSquareButtons()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string>()

  const playerOrigin = window.location.origin

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Only trust status from the player itself.
      if (event.origin !== playerOrigin) return
      if (event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as {type?: string; message?: string} | null
      if (data?.type === 'game-ready') setStatus('ready')
      if (data?.type === 'game-error') {
        setStatus('error')
        setError(data.message || l`This game could not be played.`)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [playerOrigin])

  /*
   * The player ships with the app, so load it from whatever origin is serving
   * this page rather than a fixed host - that keeps dev and preview builds
   * working, not just production.
   */
  const src = getGamePlayerUrl(window.location.origin, view.uri, game)

  return (
    <View
      style={[
        a.mt_sm,
        a.flex_col,
        a.rounded_md,
        a.overflow_hidden,
        a.border,
        a.w_full,
        t.atoms.border_contrast_low,
        shapePreference === 'sharp' && SHARP_CORNERS,
        style,
      ]}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: String(getGameAspect(game)),
          backgroundColor: t.palette.black,
        }}>
        <iframe
          ref={iframeRef}
          src={src}
          title={view.title}
          // Games need scripts; the player page restricts what it will run.
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
          allow="autoplay; fullscreen; gamepad"
          style={{border: 0, width: '100%', height: '100%', display: 'block'}}
          onLoad={() => setStatus(s => (s === 'loading' ? 'ready' : s))}
        />
        {status === 'loading' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Loader size="lg" />
          </div>
        )}
        {status === 'error' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}>
            <Text style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
              {error}
            </Text>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        style={{
          all: 'unset',
          cursor: 'pointer',
          padding: '10px 12px',
          borderTop: `1px solid ${t.palette.contrast_100}`,
          color: t.palette.contrast_700,
          fontFamily: 'InterVariable',
          fontSize: 13,
          fontWeight: 600,
        }}>
        {view.title}
      </button>
    </View>
  )
}

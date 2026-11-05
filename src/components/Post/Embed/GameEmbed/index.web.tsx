import {useEffect, useRef, useState} from 'react'
import {Pressable, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {PlayButtonIcon} from '#/components/video/PlayButtonIcon'
import {type app} from '#/lexicons'
import {GameFrame} from './GameFrame'
import {useOnScreen} from './useOnScreen'
import {
  GAME_KIND_LABEL,
  type GameEmbed as Game,
  getGameAspect,
  getGamePlayerUrl,
} from './utils'

/**
 * Web plays the game inline. The player is a separate page on the same origin
 * so Ruffle/CheerpJ stay out of the app bundle and a hung game can't block the
 * feed.
 *
 * Nothing loads until the game is clicked, and it is torn down again as soon
 * as its post scrolls away. A playing game holds a runtime, a service worker
 * and audio, and the web feed keeps every post mounted, so without this a game
 * would keep playing and keep costing memory from anywhere on the site.
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
  const {ref: containerRef, isOnScreen} = useOnScreen()
  const [isActive, setIsActive] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string>()

  // Off screen (or in a hidden tab) the player unmounts, which stops its audio.
  if (isActive && !isOnScreen) setIsActive(false)

  const playerOrigin = window.location.origin

  useEffect(() => {
    if (!isActive) return
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
  }, [isActive, playerOrigin, l])

  function activate() {
    setStatus('loading')
    setError(undefined)
    setIsActive(true)
  }

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
      <View
        ref={containerRef}
        style={[a.relative, {aspectRatio: getGameAspect(game)}]}>
        {isActive ? (
          <GameFrame
            iframeRef={iframeRef}
            /*
             * The player ships with the app, so load it from whatever origin
             * serves this page rather than a fixed host - that keeps dev and
             * preview builds working, not just production.
             */
            src={getGamePlayerUrl(window.location.origin, view.uri, game)}
            title={view.title}
            game={game}
            onLoad={() => setStatus(s => (s === 'loading' ? 'ready' : s))}
          />
        ) : (
          <Pressable
            onPress={activate}
            accessibilityRole="button"
            accessibilityLabel={l`Play ${view.title}`}
            accessibilityHint={l`Loads the game into this post`}
            /*
             * flex_1 is what makes this fill the aspect-ratio box; inset_0
             * alone leaves it content-height, so the centred play button sits
             * above the middle of the frame.
             */
            style={[
              a.absolute,
              a.inset_0,
              a.flex_1,
              a.align_center,
              a.justify_center,
              a.gap_sm,
              t.atoms.bg_contrast_25,
            ]}>
            {/*
             * A still of the game, when the post carries one, stands in for
             * the play glyph; it is what tells the game apart in a feed.
             */}
            {view.thumb && (
              <img
                src={view.thumb}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
            {/*
             * The glyph inside the icon is absolutely positioned, so it would
             * anchor above the label rather than in the circle. Give it its
             * own full-width row to centre against.
             */}
            <View style={[a.w_full, a.align_center]}>
              <PlayButtonIcon />
            </View>
            <Text
              style={[a.text_sm, a.font_bold, t.atoms.text_contrast_medium]}>
              {GAME_KIND_LABEL[game.kind]}
            </Text>
          </Pressable>
        )}
        {isActive && status === 'loading' && (
          <View
            style={[
              a.absolute,
              a.inset_0,
              a.align_center,
              a.justify_center,
              {zIndex: 2},
            ]}>
            <Loader size="lg" />
          </View>
        )}
        {isActive && status === 'error' && (
          <View
            style={[
              a.absolute,
              a.inset_0,
              a.align_center,
              a.justify_center,
              a.p_md,
              {zIndex: 2},
            ]}>
            <Text style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
              {error}
            </Text>
          </View>
        )}
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        style={[
          a.px_md,
          a.py_sm,
          a.border_t,
          t.atoms.border_contrast_low,
          t.atoms.bg,
        ]}>
        <Text numberOfLines={1} style={[a.text_sm, a.font_bold, t.atoms.text]}>
          {view.title}
        </Text>
      </Pressable>
    </View>
  )
}

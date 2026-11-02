import {useEffect, useRef, useState} from 'react'

import {
  type GameEmbed as Game,
  type GameKind,
  getGameNativeSize,
} from './utils'

/**
 * The box a game plays in.
 *
 * Every kind gets the game's aspect ratio. Only VNDS runs at native size: its
 * engine does its own layout math against the game's resolution and goes wrong
 * if the window is larger, so the frame is scaled up around it. Ruffle and
 * CheerpJ lay out at whatever size they are given, so they fill the frame at
 * real pixels.
 */
export function GameFrame({
  src,
  title,
  game,
  onLoad,
  iframeRef,
}: {
  src: string
  title: string
  game: Pick<Game, 'kind' | 'width' | 'height'>
  onLoad?: () => void
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const native = getGameNativeSize(game)
  const aspect = native.width / native.height
  const scaled = needsNativeScale(game.kind)

  useEffect(() => {
    if (!scaled) return
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / native.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [scaled, native.width])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: String(aspect),
        overflow: 'hidden',
      }}>
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        // Games need scripts; the player page restricts what it will run.
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
        allow="autoplay; fullscreen; gamepad"
        style={{
          border: 0,
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          ...(scaled
            ? {
                width: native.width,
                height: native.height,
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
              }
            : {width: '100%', height: '100%'}),
        }}
        onLoad={onLoad}
      />
    </div>
  )
}

/**
 * VNDS is the only runtime that has to be told its own resolution; the others
 * render correctly at whatever size they are given.
 */
function needsNativeScale(kind: GameKind) {
  return kind === 'vnds'
}

import {useEffect, useMemo} from 'react'
import {View} from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {useA11y} from '#/state/a11y'
import {useTheme} from '#/alf'
import {ReactionEmoji} from '#/features/bluemoji/reactions/ReactionEmoji'
import {type ReactionEmoji as ReactionEmojiRef} from '#/features/bluemoji/reactions/util'

const BURST_MS = 620
const PARTICLE_COUNT = 7

type Particle = {
  angle: number
  distance: number
  size: number
  delay: number
}

/**
 * Radial spray of the reacted emoji, ending in a single emoji that scales up
 * and settles. Modelled on the 6-7 confetti burst: fast, self-cleaning, and
 * skipped entirely when the viewer has reduced motion on.
 *
 * Sits above the pill so it reads as coming out of the button. The button's
 * own optimistic state updates underneath it immediately.
 */
export function ReactionBurst({
  emoji,
  onComplete,
}: {
  emoji: ReactionEmojiRef
  onComplete: () => void
}) {
  const t = useTheme()
  const {reduceMotionEnabled} = useA11y()

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({length: PARTICLE_COUNT}, (_, i) => ({
        // Even spread around the circle, jittered so it doesn't look mechanical.
        angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        distance: 14 + Math.random() * 16,
        size: 8 + Math.random() * 6,
        delay: Math.random() * 60,
      })),
    [],
  )

  const progress = useSharedValue(0)
  const core = useSharedValue(0)
  /*
   * Mount-only. The row re-renders as the mutation and its refetch settle, and
   * a fresh `onComplete` closure used to restart the timing outright, which is
   * why the burst only played sometimes.
   */
  const finish = useNonReactiveCallback(onComplete)

  useEffect(() => {
    progress.set(() =>
      withTiming(1, {duration: BURST_MS, easing: Easing.out(Easing.quad)}),
    )
    core.set(() =>
      withTiming(1, {duration: BURST_MS, easing: Easing.out(Easing.back(2))}),
    )
    const timer = setTimeout(finish, BURST_MS)
    return () => clearTimeout(timer)
  }, [progress, core, finish])

  // Reduced motion: the pill turning primary and the haptic are the whole
  // confirmation. The timer still runs so the state clears.
  if (reduceMotionEnabled) return null

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          zIndex: 2,
        },
      ]}>
      {particles.map((particle, i) => (
        <Spray key={i} particle={particle} emoji={emoji} progress={progress} />
      ))}
      <CoreBurst emoji={emoji} progress={core} color={t.palette.primary_500} />
    </View>
  )
}

function Spray({
  particle,
  emoji,
  progress,
}: {
  particle: Particle
  emoji: ReactionEmojiRef
  progress: {get: () => number}
}) {
  const style = useAnimatedStyle(() => {
    // Delay each particle slightly so the spray fans out instead of popping.
    const p = Math.max(
      0,
      (progress.get() - particle.delay / BURST_MS) /
        (1 - particle.delay / BURST_MS),
    )
    const dx = Math.cos(particle.angle) * particle.distance * p
    const dy = Math.sin(particle.angle) * particle.distance * p
    return {
      transform: [
        {translateX: dx},
        {translateY: dy},
        {scale: interpolate(p, [0, 0.3, 1], [1, 1, 0.2])},
      ],
      opacity: interpolate(p, [0, 0.15, 1], [1, 1, 0]),
    }
  })
  return (
    <Animated.View style={[{position: 'absolute'}, style]}>
      <ReactionEmoji emoji={emoji} size={particle.size} />
    </Animated.View>
  )
}

function CoreBurst({
  emoji,
  progress,
  color,
}: {
  emoji: ReactionEmojiRef
  progress: {get: () => number}
  color: string
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      {scale: interpolate(progress.get(), [0, 0.35, 1], [0.4, 1.9, 1])},
    ],
    opacity: interpolate(progress.get(), [0, 0.1, 0.85, 1], [0, 1, 1, 0]),
  }))
  const ring = useAnimatedStyle(() => ({
    transform: [{scale: interpolate(progress.get(), [0, 1], [0.5, 2.4])}],
    opacity: interpolate(progress.get(), [0, 0.3, 1], [0.45, 0.25, 0]),
  }))
  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 22,
            height: 22,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: color,
          },
          ring,
        ]}
      />
      <Animated.View style={style}>
        <ReactionEmoji emoji={emoji} size={16} />
      </Animated.View>
    </>
  )
}

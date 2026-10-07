import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {type ShapePreference} from '#/lib/shapes'
import {atoms as a, useTheme} from '#/alf'
import {Slider} from '#/components/forms/Slider'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const shapes = [false, true, 'sharp'] as const

export function ShapeSlider({
  label,
  value,
  onChange,
  testID,
}: {
  label: string
  value: ShapePreference
  onChange: (value: ShapePreference) => void
  testID: string
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const labels = [l`Circular`, l`Rounded`, l`Sharp`]
  const selected = value === 'sharp' ? 2 : value ? 1 : 0
  const select = (index: number) => onChange(shapes[index])

  return (
    <View style={[a.flex_1, a.gap_xs, {minWidth: 0}]} testID={testID}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_xs]}>
        <Text style={[a.text_md, a.font_bold]}>{label}</Text>
        <Text
          numberOfLines={1}
          style={[
            a.flex_shrink,
            a.text_xs,
            a.text_right,
            t.atoms.text_contrast_medium,
          ]}>
          {labels[selected]}
        </Text>
      </View>
      <View
        style={a.relative}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={l`${label}: ${labels[selected]}`}
        accessibilityHint={l`Choose circular, rounded, or sharp corners`}
        accessibilityValue={{min: 0, max: 2, now: selected}}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={selected}
        aria-valuetext={labels[selected]}
        {...(IS_WEB && {
          tabIndex: 0,
          onKeyDown: (event: {
            key?: string
            nativeEvent: {key: string}
            preventDefault: () => void
            stopPropagation: () => void
          }) => {
            let next = selected
            switch (event.key ?? event.nativeEvent.key) {
              case 'ArrowLeft':
              case 'ArrowDown':
                next = Math.max(0, selected - 1)
                break
              case 'ArrowRight':
              case 'ArrowUp':
                next = Math.min(2, selected + 1)
                break
              case 'Home':
                next = 0
                break
              case 'End':
                next = 2
                break
              default:
                return
            }
            event.preventDefault()
            event.stopPropagation()
            select(next)
          },
        })}
        accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
        onAccessibilityAction={({nativeEvent}) => {
          if (nativeEvent.actionName === 'increment') {
            select(Math.min(2, selected + 1))
          } else if (nativeEvent.actionName === 'decrement') {
            select(Math.max(0, selected - 1))
          }
        }}>
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            {
              left: 12,
              right: 12,
              top: '50%',
              marginTop: -2,
              height: 4,
              borderRadius: selected === 2 ? 0 : 2,
              backgroundColor: t.atoms.bg_contrast_50.backgroundColor,
            },
          ]}>
          <View
            style={{
              width: `${selected * 50}%`,
              height: 4,
              borderRadius: selected === 2 ? 0 : 2,
              backgroundColor: t.palette.primary_500,
            }}
          />
        </View>
        <Slider
          value={selected}
          minimumValue={0}
          maximumValue={2}
          step={1}
          thumbStyle={{
            borderRadius: selected === 2 ? 0 : selected === 1 ? 4 : 12,
          }}
          trackStyle={{backgroundColor: 'transparent'}}
          trackMarks={[0, 1, 2]}
          renderTrackMarkComponent={() => (
            <View
              style={[
                a.rounded_full,
                {
                  width: 6,
                  height: 6,
                  marginLeft: 9,
                  backgroundColor: t.palette.primary_500,
                },
              ]}
            />
          )}
          onValueChange={select}
          minimumTrackStyle={{
            backgroundColor: 'transparent',
          }}
        />
      </View>
    </View>
  )
}

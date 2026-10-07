import {useEffect, useState} from 'react'
import {type ViewStyle} from 'react-native'
import {Slider as RNSlider} from '@miblanchard/react-native-slider'

import {changeHue, useTheme} from '#/alf'

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  minimumValue?: number
  maximumValue?: number
  step?: number
  trackMarks?: number[]
  renderTrackMarkComponent?: (index: number) => React.ReactNode
  trackStyle?: ViewStyle
  minimumTrackStyle?: ViewStyle
  thumbStyle?: ViewStyle
  thumbTouchSize?: {width: number; height: number}
  debounceFull?: boolean
}

export function Slider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 1,
  step = 1,
  trackMarks,
  renderTrackMarkComponent,
  trackStyle,
  minimumTrackStyle,
  thumbStyle,
  thumbTouchSize = {width: 40, height: 40},
  debounceFull,
}: SliderProps) {
  const t = useTheme()
  // We need local state to handle visual updates while dragging if debounceFull is true
  const [localValue, setLocalValue] = useState(value)

  // Sync local state if the parent updates the value prop externally
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <RNSlider
      value={[localValue]} // Read from local state
      onValueChange={values => {
        const nextVal = values[0]
        setLocalValue(nextVal)

        // If NOT debouncing, update parent immediately while dragging
        if (!debounceFull) {
          onValueChange(nextVal)
        }
      }}
      onSlidingComplete={values => {
        // If debouncing, update parent only when done dragging
        if (debounceFull) {
          onValueChange(values[0])
        }
      }}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      step={step}
      trackMarks={trackMarks}
      renderTrackMarkComponent={renderTrackMarkComponent}
      trackStyle={{
        height: 4,
        borderRadius: 2,
        backgroundColor: t.atoms.bg_contrast_50.backgroundColor,
        ...trackStyle,
      }}
      minimumTrackStyle={{
        height: 4,
        borderRadius: 2,
        backgroundColor: changeHue(t.palette.primary_500, localValue - value),
        ...minimumTrackStyle,
      }}
      thumbStyle={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: t.atoms.border_contrast_low.borderColor,
        backgroundColor: t.atoms.bg.backgroundColor,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
        ...thumbStyle,
      }}
      thumbTouchSize={thumbTouchSize}
    />
  )
}

import {useTheme} from '#/alf'
import {DotGrid2x3_Stroke2_Corner0_Rounded as GripIcon} from '#/components/icons/DotGrid'
import {useSupportPalette} from '../palette'

/**
 * The six-dot grip at the end of a pill in the editor. Dragging from it starts
 * at once; holding anywhere else on the pill drags after a beat.
 */
export function DragHandle({onGreen = false}: {onGreen?: boolean}) {
  const t = useTheme()
  const palette = useSupportPalette()
  return (
    <GripIcon
      width={14}
      style={[
        {marginLeft: -2},
        onGreen ? {color: palette.fg, opacity: 0.7} : t.atoms.text_contrast_low,
      ]}
    />
  )
}

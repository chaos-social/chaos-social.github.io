import {Trans} from '@lingui/react/macro'

import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function BetaTag() {
  const t = useTheme()
  const shape = useEnableSquareButtons()

  return (
    <Text
      style={[
        getShapeStyle(shape, a.rounded_sm, a.rounded_full),
        a.px_sm,
        a.text_xs,
        a.font_semi_bold,
        {
          backgroundColor: t.palette.primary_100,
          color: t.palette.primary_600,
          paddingTop: 3,
          paddingBottom: 3,
        },
      ]}>
      <Trans>Beta</Trans>
    </Text>
  )
}

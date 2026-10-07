import {useMemo} from 'react'
import {View} from 'react-native'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {createEmbedViewRecordFromPost} from '#/state/queries/postgate/util'
import {useResolveLinkQuery} from '#/state/queries/resolve-link'
import {atoms as a, useTheme} from '#/alf'
import {QuoteEmbed} from '#/components/Post/Embed'

export function LazyQuoteEmbed({
  uri,
  linkDisabled,
}: {
  uri: string
  linkDisabled?: boolean
}) {
  const shapePreference = useEnableSquareButtons()

  const t = useTheme()
  const {data} = useResolveLinkQuery(uri)

  const view = useMemo(() => {
    if (!data || data.type !== 'record' || data.kind !== 'post') return
    return createEmbedViewRecordFromPost(data.view)
  }, [data])

  return view ? (
    <QuoteEmbed
      embed={{
        type: 'post',
        view,
      }}
      linkDisabled={linkDisabled}
      showPronouns={true}
    />
  ) : (
    <View
      style={[
        a.w_full,
        a.rounded_md,
        t.atoms.bg_contrast_25,
        {
          height: 68,
        },
        shapePreference === 'sharp' && SHARP_CORNERS,
      ]}
    />
  )
}

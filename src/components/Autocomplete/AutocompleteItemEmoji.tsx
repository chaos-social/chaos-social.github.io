import {SiftItem} from '@bsky.app/sift'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {InlineBluemoji} from '#/features/bluemoji/InlineBluemoji'
import {type AutocompleteItemProps} from './types'

export function AutocompleteItemEmoji({
  active,
  props,
  item,
}: AutocompleteItemProps) {
  const t = useTheme()

  if (item.type !== 'emoji' && item.type !== 'bluemoji') return null

  return (
    <SiftItem
      {...props}
      style={s => [
        {paddingVertical: 6, paddingHorizontal: 10},
        a.flex_row,
        a.align_center,
        a.gap_sm,
        active || s.hovered || s.pressed ? [t.atoms.bg_contrast_25] : [],
      ]}>
      {item.type === 'bluemoji' ? (
        <InlineBluemoji
          claim={{
            did: item.bluemoji.did,
            name: item.bluemoji.record.name,
            record: {uri: item.bluemoji.uri, cid: item.bluemoji.cid},
          }}
          fallbackText={item.value}
          size={24}
          interactive={false}
        />
      ) : (
        <Text emoji style={[a.text_xl, a.leading_tight]}>
          {item.value}
        </Text>
      )}
      <Text style={[a.text_md, a.leading_tight]}>
        {item.type === 'bluemoji' ? item.value : `:${item.emoji.id}:`}
      </Text>
    </SiftItem>
  )
}

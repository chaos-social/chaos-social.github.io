import {useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {Button, ButtonText} from '#/components/Button'
import {type ParsedEvent} from '../record'
import {useEventLive} from '../useEventLive'

export function LiveWatchButton({parsed}: {parsed: ParsedEvent}) {
  const {t: l} = useLingui()
  const openLink = useOpenLink()
  const live = useEventLive(parsed)
  if (!live || !parsed.streamplaceUrl) return null
  return (
    <Button
      label={l`Live now, watch on Streamplace`}
      size="tiny"
      color="negative"
      onPress={e => {
        e.preventDefault()
        e.stopPropagation()
        openLink(parsed.streamplaceUrl!, undefined, true)
      }}>
      <ButtonText>LIVE · Watch</ButtonText>
    </Button>
  )
}

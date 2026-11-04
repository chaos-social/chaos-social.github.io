import {useProfileQuery} from '#/state/queries/profile'
import {useActorStatus} from '#/features/liveNow'
import {inLiveWindow, isLiveOnStreamplace, parseStreamplaceActor} from './live'
import {type ParsedEvent} from './record'

/** Whether the event's own Streamplace channel is live right now. */
export function useEventLive(parsed: ParsedEvent): boolean {
  const actor =
    parsed.streamplaceUrl &&
    !parsed.cancelled &&
    inLiveWindow(parsed, new Date())
      ? parseStreamplaceActor(parsed.streamplaceUrl)
      : undefined
  const {data: streamer} = useProfileQuery({did: actor})
  const status = useActorStatus(streamer)
  return streamer ? isLiveOnStreamplace(status, streamer) : false
}

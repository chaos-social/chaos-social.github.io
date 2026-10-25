import {useSession} from '#/state/session'
import {usePostKeyboardActions} from '#/features/keyboardShortcuts/postActions.web'
import {RepostButtonMenu, type RepostButtonProps} from './RepostButtonMenu'

export function RepostButton({
  onRepost,
  onQuote,
  embeddingDisabled,
  ...props
}: RepostButtonProps) {
  const {hasSession} = useSession()
  const keyboardActionsRef = usePostKeyboardActions({
    onRepost,
    onQuote,
    embeddingDisabled,
    enabled: hasSession,
  })

  return (
    <div ref={keyboardActionsRef} style={{display: 'contents'}}>
      <RepostButtonMenu
        {...props}
        onRepost={onRepost}
        onQuote={onQuote}
        embeddingDisabled={embeddingDisabled}
      />
    </div>
  )
}

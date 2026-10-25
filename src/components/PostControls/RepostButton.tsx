import {memo, useCallback} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {CloseQuote_Stroke2_Corner1_Rounded as QuoteIcon} from '#/components/icons/Quote'
import {
  Repost_Stroke2_Corner3_Rounded as RepostIcon,
  RepostRepost_Stroke2_Corner2_Rounded as BumpRepostIcon,
} from '#/components/icons/Repost'
import {MetricCountLabel} from '#/components/PostControls/MetricCountLabel'
import {Text} from '#/components/Typography'
import {IS_IPAD} from '#/env'
import {PostControlButton, PostControlButtonIcon} from './PostControlButton'
import {RepostButtonMenu, type RepostButtonProps} from './RepostButtonMenu'

let RepostButton = (props: RepostButtonProps): React.ReactNode =>
  IS_IPAD ? (
    <RepostButtonMenu {...props} longPressToQuote />
  ) : (
    <RepostButtonDialog {...props} />
  )

RepostButton = memo(RepostButton)
export {RepostButton}

function RepostButtonDialog({
  isReposted,
  repostCount,
  metricsDisplay = 'visible',
  onRepost,
  onBumpRepost,
  onQuote,
  onLongPress,
  big,
  embeddingDisabled,
}: RepostButtonProps): React.ReactNode {
  const t = useTheme()
  const {t: l} = useLingui()
  const requireAuth = useRequireAuth()
  const dialogControl = Dialog.useDialogControl()

  const onPress = () => requireAuth(() => dialogControl.open())

  const onDefaultLongPress = () =>
    requireAuth(() => {
      if (embeddingDisabled) {
        dialogControl.open()
      } else {
        onQuote()
      }
    })

  return (
    <View>
      <PostControlButton
        testID="repostBtn"
        active={isReposted}
        activeColor={t.palette.positive_500}
        big={big}
        onPress={onPress}
        onLongPress={onLongPress ?? onDefaultLongPress}
        label={
          isReposted
            ? l({
                message: `Undo repost (${plural(repostCount || 0, {
                  one: '# repost',
                  other: '# reposts',
                })})`,
                comment:
                  'Accessibility label for the repost button when the post has been reposted, verb followed by number of reposts and noun',
              })
            : l({
                message: `Repost (${plural(repostCount || 0, {
                  one: '# repost',
                  other: '# reposts',
                })})`,
                comment:
                  'Accessibility label for the repost button when the post has not been reposted, verb form followed by number of reposts and noun form',
              })
        }>
        <PostControlButtonIcon icon={RepostIcon} />
        {typeof repostCount !== 'undefined' ? (
          <MetricCountLabel
            display={metricsDisplay}
            count={repostCount}
            testID="repostCount"
            labelOnly={plural(repostCount, {
              one: 'repost',
              other: 'reposts',
            })}
          />
        ) : null}
      </PostControlButton>
      <Dialog.Outer
        control={dialogControl}
        nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <RepostButtonDialogInner
          isReposted={isReposted}
          onRepost={onRepost}
          onBumpRepost={onBumpRepost}
          onQuote={onQuote}
          embeddingDisabled={embeddingDisabled}
        />
      </Dialog.Outer>
    </View>
  )
}

export const RepostButtonDialogInner = memo(function RepostButtonDialogInner({
  isReposted,
  onRepost,
  onBumpRepost,
  onQuote,
  embeddingDisabled,
}: {
  isReposted: boolean
  onRepost: () => void
  onBumpRepost?: () => void
  onQuote: () => void
  embeddingDisabled: boolean
}): React.ReactNode {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const control = Dialog.useDialogContext()

  const onPressRepost = useCallback(() => {
    if (!isReposted) haptics.confirm()

    control.close(() => {
      onRepost()
    })
  }, [control, isReposted, onRepost, haptics])

  const onPressQuote = useCallback(() => {
    haptics.confirm()
    control.close(() => {
      onQuote()
    })
  }, [control, onQuote, haptics])

  const onPressClose = useCallback(() => control.close(), [control])

  return (
    <Dialog.ScrollableInner label={l`Repost or quote post`}>
      <View style={a.gap_xl}>
        <View style={a.gap_xs}>
          <Button
            style={[a.justify_start, a.px_md, a.gap_sm]}
            label={
              isReposted
                ? l`Remove repost`
                : l({message: `Repost`, context: 'action'})
            }
            onPress={onPressRepost}
            size="large"
            variant="ghost"
            color="primary">
            <RepostIcon size="lg" fill={t.palette.primary_500} />
            <Text style={[a.font_semi_bold, a.text_xl]}>
              {isReposted ? (
                <Trans>Remove repost</Trans>
              ) : (
                <Trans context="action">Repost</Trans>
              )}
            </Text>
          </Button>
          {isReposted && onBumpRepost && (
            <Button
              testID="bumpRepostBtn"
              style={[a.justify_start, a.px_md, a.gap_sm]}
              label={l`Bump repost`}
              onPress={() => {
                haptics.confirm()
                control.close(() => onBumpRepost())
              }}
              size="large"
              variant="ghost"
              color="primary">
              <BumpRepostIcon size="lg" fill={t.palette.primary_500} />
              <Text style={[a.font_semi_bold, a.text_xl]}>
                <Trans>Bump repost</Trans>
              </Text>
            </Button>
          )}
          <Button
            disabled={embeddingDisabled}
            testID="quoteBtn"
            style={[a.justify_start, a.px_md, a.gap_sm]}
            label={embeddingDisabled ? l`Quote posts disabled` : l`Quote post`}
            onPress={onPressQuote}
            size="large"
            variant="ghost"
            color="primary">
            <QuoteIcon
              size="lg"
              fill={
                embeddingDisabled
                  ? t.atoms.text_contrast_low.color
                  : t.palette.primary_500
              }
            />
            <Text
              style={[
                a.font_semi_bold,
                a.text_xl,
                embeddingDisabled && t.atoms.text_contrast_low,
              ]}>
              {embeddingDisabled ? (
                <Trans>Quote posts disabled</Trans>
              ) : (
                <Trans>Quote post</Trans>
              )}
            </Text>
          </Button>
        </View>
        <Button
          label={l`Cancel quote post`}
          onPress={onPressClose}
          size="large"
          color="secondary">
          <ButtonText>
            <Trans>Cancel</Trans>
          </ButtonText>
        </Button>
      </View>
    </Dialog.ScrollableInner>
  )
})

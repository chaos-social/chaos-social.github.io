import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {nanoid} from 'nanoid/non-secure'

import {
  DEFAULT_POLL_DURATION,
  getOptionIssues,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_CHARS,
  type PollDraft,
  type PollDuration,
} from '#/lib/api/poll'
import {type PostAction} from '#/view/com/composer/state/composer'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Poll_Stroke2_Corner0_Rounded as PollIcon} from '#/components/icons/Poll'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'

export function PollEditor({
  poll,
  text,
  dispatch,
}: {
  poll: PollDraft
  text: string
  dispatch: (action: PostAction) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const durationLabel = (value: PollDuration) =>
    ({
      '1h': l`1 hour`,
      '6h': l`6 hours`,
      '12h': l`12 hours`,
      '1d': l`1 day`,
      '3d': l`3 days`,
      '7d': l`7 days`,
    })[value]
  const options = poll.options ?? ['', '']
  const duration = poll.duration ?? DEFAULT_POLL_DURATION
  const canAdd = options.length < POLL_MAX_OPTIONS
  const canRemove = options.length > POLL_MIN_OPTIONS
  const issues = getOptionIssues(options)
  const isQuestionMissing = text.trim().length === 0
  const [rowKeys, setRowKeys] = useState(() => options.map(() => nanoid()))

  return (
    <View
      testID="pollEditor"
      style={[
        a.mt_lg,
        a.p_md,
        a.gap_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
      ]}>
      <View style={[a.flex_row, a.align_center, a.justify_between]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <PollIcon size="sm" fill={t.palette.primary_500} />
          <Text
            style={[
              a.text_xs,
              a.font_bold,
              {color: t.palette.primary_500, textTransform: 'uppercase'},
            ]}>
            <Trans comment="Heading of the poll editor card in the post composer">
              Poll
            </Trans>
          </Text>
        </View>
        <Button
          testID="removePollBtn"
          label={l`Remove poll`}
          size="tiny"
          variant="ghost"
          color="secondary"
          onPress={() => {
            ax.metric('composer:poll:remove', {})
            dispatch({type: 'embed_remove_poll'})
          }}>
          <ButtonText>
            <Trans>Remove</Trans>
          </ButtonText>
        </Button>
      </View>

      {isQuestionMissing && (
        <Text
          testID="pollQuestionHint"
          style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>Add post text to ask your question.</Trans>
        </Text>
      )}

      {options.map((option, index) => {
        const issue = issues[index]
        const isInvalid = issue === 'invalid' || issue === 'too_long'
        return (
          <View key={rowKeys[index]} style={[a.gap_2xs]}>
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <View style={[a.flex_1]}>
                <TextField.Root isInvalid={isInvalid}>
                  <TextField.Input
                    testID={`pollOptionInput-${index}`}
                    maxLength={POLL_OPTION_MAX_CHARS}
                    label={l({
                      message: `Choice ${index + 1}`,
                      comment:
                        'Accessibility label for a poll choice text field in the composer. The number is the position of the choice.',
                    })}
                    placeholder={l({
                      message: 'Choice',
                      comment:
                        'Placeholder for a poll choice text field in the composer',
                    })}
                    value={option}
                    onChangeText={next =>
                      dispatch({
                        type: 'embed_update_poll_option',
                        index,
                        text: next,
                      })
                    }
                  />
                </TextField.Root>
              </View>
              {canRemove && (
                <Button
                  testID={`pollOptionRemove-${index}`}
                  label={l`Remove choice`}
                  size="tiny"
                  shape="round"
                  variant="ghost"
                  color="secondary"
                  onPress={() => {
                    setRowKeys(keys =>
                      keys.length > 1
                        ? keys.filter((_, i) => i !== index)
                        : keys,
                    )
                    dispatch({type: 'embed_remove_poll_option', index})
                  }}>
                  <ButtonIcon icon={XIcon} />
                </Button>
              )}
            </View>
            {issue === 'invalid' && (
              <Text
                testID={`pollOptionHint-${index}`}
                style={[a.text_xs, a.text_right, {color: t.palette.negative_500}]}>
                <Trans>
                  This choice contains characters that cannot be saved.
                </Trans>
              </Text>
            )}
          </View>
        )
      })}

      {canAdd && (
        <Button
          testID="addPollOptionBtn"
          label={l`Add another choice`}
          size="small"
          variant="outline"
          color="secondary"
          onPress={() => {
            ax.metric('composer:poll:optionAdd', {
              count: options.length + 1,
            })
            setRowKeys(keys =>
              keys.length < POLL_MAX_OPTIONS ? [...keys, nanoid()] : keys,
            )
            dispatch({type: 'embed_add_poll_option'})
          }}>
          <ButtonIcon icon={PlusIcon} position="left" />
          <ButtonText>
            <Trans>Add another choice</Trans>
          </ButtonText>
        </Button>
      )}

      <View style={[a.gap_xs]}>
        <Text style={[a.text_xs, a.font_medium, t.atoms.text_contrast_medium]}>
          <Trans comment="Label above the poll duration choices in the composer">
            Poll closes after
          </Trans>
        </Text>
        <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
          {POLL_DURATIONS.map(value => {
            const selected = value === duration
            return (
              <Button
                key={value}
                testID={`pollDuration-${value}`}
                label={l`Poll closes after ${durationLabel(value)}`}
                onPress={() =>
                  dispatch({type: 'embed_set_poll_duration', duration: value})
                }
                accessibilityState={{selected}}
                size="tiny"
                color={selected ? 'primary' : 'secondary'}>
                <ButtonText>{durationLabel(value)}</ButtonText>
              </Button>
            )
          })}
        </View>
      </View>

      <View>
        <Text style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Your post text is the question.</Trans>
        </Text>
        <Text style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Votes are public and handled by TOKIMEKI.</Trans>
        </Text>
      </View>
    </View>
  )
}

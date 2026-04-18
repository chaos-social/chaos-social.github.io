import {View} from 'react-native'
import {type $Typed, ComAtprotoLabelDefs} from '@atproto/api'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQueryClient} from '@tanstack/react-query'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {RQKEY_ROOT as POST_FEED_RQKEY_ROOT} from '#/state/queries/post-feed'
import {
  useProfileQuery,
  useProfileUpdateMutation,
} from '#/state/queries/profile'
import {postThreadQueryKeyRoot} from '#/state/queries/usePostThread/types'
import {useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, platform, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {Pet_Filled as PetIcon} from '#/components/icons/Pet'
import * as Layout from '#/components/Layout'
import {PetBadge} from '#/components/PetBadge'
import {Text} from '#/components/Typography'
import {useSimpleVerificationState} from '#/components/verification'
import {VerificationCheck} from '#/components/verification/VerificationCheck'
import {useAnalytics} from '#/analytics'
import * as bsky from '#/types/bsky'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PetLabelSettings'>
export function PetLabelSettingsScreen({}: Props) {
  const t = useTheme()
  const ax = useAnalytics()
  const {t: l} = useLingui()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const updateProfile = useProfileUpdateMutation()
  const verification = useSimpleVerificationState({profile})

  const isPetLabeled =
    profile?.labels?.some(l => l.val === 'pet' && l.src === profile.did) ??
    false
  const canToggle = profile && !updateProfile.isPending

  const onToggle = () => {
    if (!profile) {
      return
    }
    let wasAdded = false
    ax.metric('pet:label:toggle', {state: isPetLabeled ? 'remove' : 'add'})
    updateProfile.mutate(
      {
        profile,
        updates: existing => {
          const labels: $Typed<ComAtprotoLabelDefs.SelfLabels> = bsky.validate(
            existing.labels,
            ComAtprotoLabelDefs.validateSelfLabels,
          )
            ? existing.labels
            : {
                $type: 'com.atproto.label.defs#selfLabels',
                values: [],
              }

          const hasLabel = labels.values.some(l => l.val === 'pet')
          if (hasLabel) {
            wasAdded = false
            labels.values = labels.values.filter(l => l.val !== 'pet')
          } else {
            wasAdded = true
            labels.values.push({val: 'pet'})
          }

          if (labels.values.length === 0) {
            delete existing.labels
          } else {
            existing.labels = labels
          }

          return existing
        },
        checkCommitted: res => {
          const exists = !!res.data.labels?.some(l => l.val === 'pet')
          return exists === wasAdded
        },
      },
      {
        onSuccess() {
          queryClient.invalidateQueries({queryKey: [POST_FEED_RQKEY_ROOT]})
          queryClient.invalidateQueries({queryKey: [postThreadQueryKeyRoot]})
        },
      },
    )
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Pet Label</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_xl, a.gap_xl]}>
          {profile && (
            <View
              style={[
                a.flex_row,
                a.justify_center,
                a.align_center,
                a.gap_sm,
                a.rounded_lg,
                a.border,
                t.atoms.bg_contrast_50,
                t.atoms.border_contrast_low,
                {
                  height: 160,
                  paddingRight: 20,
                },
              ]}>
              <UserAvatar size={42} avatar={profile.avatar} type="user" />
              <View>
                <View style={[a.flex_row, a.align_baseline]}>
                  <View style={[a.flex_row, a.align_center, a.gap_xs]}>
                    <Text
                      emoji
                      style={[
                        a.text_xl,
                        a.font_semi_bold,
                        a.flex_shrink,
                        a.leading_tight,
                      ]}
                      numberOfLines={1}>
                      {profile.displayName || profile.handle}
                    </Text>
                    {verification.isVerified && (
                      <VerificationCheck
                        verifier={verification.role === 'verifier'}
                        size="sm"
                      />
                    )}
                    <View style={{top: platform({ios: -1})}}>
                      <PetBadge profile={profile} alwaysShow width={17} />
                    </View>
                  </View>
                </View>
                <Text
                  style={[
                    a.text_md,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}
                  numberOfLines={1}>
                  @{profile.handle}
                </Text>
              </View>
            </View>
          )}
          <View style={[a.gap_sm]}>
            <Text style={[a.text_2xl, a.font_bold]}>
              <Trans>Add pet label to account</Trans>
            </Text>
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                This label lets the world know that the account holder is a pet.
                If turned on, this label appears next to the account's name on
                their profile and posts. It can be turned on or off at any time.
              </Trans>
            </Text>
          </View>
          <Toggle.Item
            name="pet_label"
            disabled={!canToggle || updateProfile.isPending}
            value={isPetLabeled}
            onChange={onToggle}
            label={l`Show pet label`}
            style={[
              a.w_full,
              a.p_md,
              a.rounded_lg,
              a.border,
              t.atoms.border_contrast_low,
              t.atoms.bg_contrast_50,
            ]}>
            <View style={[a.pr_xs]}>
              <PetIcon width={24} fill={t.atoms.text_contrast_medium.color} />
            </View>
            <Toggle.LabelText style={[a.flex_1, a.text_md, a.font_medium]}>
              <Trans>Show pet label</Trans>
            </Toggle.LabelText>
            <Toggle.Platform />
          </Toggle.Item>
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

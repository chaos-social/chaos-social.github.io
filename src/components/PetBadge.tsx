import {View} from 'react-native'
import {type ComAtprotoLabelDefs} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {Pet_Filled as PetIcon} from '#/components/icons/Pet'
import {PetAccountAlert} from '#/components/PetAccountAlert'
import {useAnalytics} from '#/analytics'
import type * as bsky from '#/types/bsky'

export function isPetAccount(profile: {
  did: string
  labels?: ComAtprotoLabelDefs.Label[]
}): boolean {
  return (
    profile.labels?.some(l => l.val === 'pet' && l.src === profile.did) ?? false
  )
}

export function PetBadge({
  profile,
  alwaysShow = false,
  width,
}: {
  profile: bsky.profile.AnyProfileView
  alwaysShow?: boolean
  width: number
}) {
  const t = useTheme()

  if (!isPetAccount(profile) && !alwaysShow) {
    return null
  }

  return (
    <View>
      <PetIcon width={width} fill={t.atoms.text_contrast_medium.color} />
    </View>
  )
}

export function PetBadgeButton({
  profile,
  width,
}: {
  profile: bsky.profile.AnyProfileView
  width: number
}) {
  const t = useTheme()
  const ax = useAnalytics()
  const {t: l} = useLingui()
  const control = useDialogControl()

  if (!isPetAccount(profile)) {
    return null
  }

  return (
    <>
      <Button
        label={l`Pet account`}
        hitSlop={20}
        onPress={evt => {
          evt.preventDefault()
          ax.metric('pet:badge:click', {})
          control.open()
        }}>
        {({hovered}) => (
          <View
            style={[
              a.justify_end,
              a.align_end,
              a.transition_transform,
              {
                width: width,
                height: width,
                transform: [{scale: hovered ? 1.1 : 1}],
              },
            ]}>
            <PetIcon width={width} fill={t.atoms.text_contrast_medium.color} />
          </View>
        )}
      </Button>
      <PetAccountAlert control={control} profile={profile} />
    </>
  )
}

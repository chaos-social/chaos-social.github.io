import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  useMymemoryEmail,
  useSetMymemoryEmail,
} from '#/state/preferences/translation-service-preference'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Contact email for MyMemory, sent as its `de` parameter. A valid address
 * raises the daily character limit from 5,000 to 50,000.
 */
export function MymemoryEmailDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {t: l} = useLingui()

  const mymemoryEmail = useMymemoryEmail()
  const setMymemoryEmail = useSetMymemoryEmail()
  const [email, setEmail] = useState(mymemoryEmail ?? '')
  const trimmed = email.trim()
  const isClear = trimmed.length === 0
  const isValid = isClear || EMAIL_REGEX.test(trimmed)

  const submit = () => {
    if (!isValid) return
    control.close(() => {
      setMymemoryEmail(trimmed || undefined)
    })
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setEmail(mymemoryEmail ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`MyMemory contact email`}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>MyMemory contact email</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label={l`Email address`}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={setEmail}
            placeholder={l`you@example.com`}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={l`Input an email address to raise the MyMemory translation limit`}
            defaultValue={mymemoryEmail}
          />

          {!isValid && (
            <Admonition type="error">
              <Trans>Enter a valid email address, or clear the field.</Trans>
            </Admonition>
          )}

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={isClear ? l`Clear` : l`Save`}
              size="large"
              onPress={submit}
              variant="solid"
              color={isClear ? 'secondary' : 'primary'}
              disabled={!isValid}>
              <ButtonText>
                {isClear ? <Trans>Clear</Trans> : <Trans>Save</Trans>}
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

const styles = {
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
}

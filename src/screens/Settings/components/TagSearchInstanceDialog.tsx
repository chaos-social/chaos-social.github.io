import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {usePalette} from '#/lib/hooks/usePalette'
import {testTagSearchUrl} from '#/lib/infrastructure/url-test'
import * as persisted from '#/state/persisted'
import {
  useSetTagSearchInstance,
  useTagSearchInstanceSetting,
} from '#/state/preferences/tag-search-instance'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {
  isValidHostnameUrl,
  normalizeInfrastructureUrl,
  normalizeOrigin,
  useInfrastructureUrlSave,
} from './infrastructureUrlSave'

export function TagSearchInstanceDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {t: l} = useLingui()

  const tagSearchInstanceSetting = useTagSearchInstanceSetting()
  const savedCustomUrl = getTagSearchDialogUrl(tagSearchInstanceSetting)
  const [url, setUrl] = useState(savedCustomUrl)
  const setTagSearchInstance = useSetTagSearchInstance()
  const {submit, isTesting, testError, canSubmit, isClear, clearTestError} =
    useInfrastructureUrlSave({
      url,
      isUrlValid: isValidHostnameUrl,
      testUrl: testTagSearchUrl,
      onSave: setTagSearchInstance,
      onClear: () => {
        setTagSearchInstance(undefined)
      },
      control,
    })

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => {
        setUrl(savedCustomUrl)
        clearTestError()
      }}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Tag search server URL`}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Tag search server URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={text => {
              setUrl(text)
              clearTestError()
            }}
            placeholder={persisted.defaults.tagSearchInstance}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={() => void submit()}
            accessibilityHint={l`Input the URL of the tag search server to use`}
            defaultValue={savedCustomUrl}
          />

          {testError && <Admonition type="error">{testError}</Admonition>}

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={isClear ? l`Clear` : l`Save`}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color={isClear ? 'secondary' : 'primary'}
              disabled={!canSubmit}>
              {isTesting && <ButtonIcon icon={Loader} />}
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

function getTagSearchDialogUrl(raw: string | undefined) {
  if (!raw) {
    return ''
  }

  if (normalizeOrigin(raw) === persisted.defaults.tagSearchInstance) {
    return ''
  }

  return normalizeInfrastructureUrl(raw)
}

const styles = {
  textInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
}

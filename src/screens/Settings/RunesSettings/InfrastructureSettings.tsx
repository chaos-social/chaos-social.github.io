import {useLayoutEffect, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  testConstellationUrl,
  testImageCdnUrl,
  testPlcDirectoryUrl,
  testSlingshotUrl,
} from '#/lib/infrastructure/url-test'
import * as persisted from '#/state/persisted'
import {
  useConstellationInstanceCustom,
  useConstellationInstanceSetting,
  useSetConstellationInstance,
  useSetConstellationInstanceCustom,
} from '#/state/preferences/constellation-instance'
import {
  useImageCdnHostCustom,
  useImageCdnHostSetting,
  useSetImageCdnHost,
  useSetImageCdnHostCustom,
} from '#/state/preferences/image-cdn-host'
import {
  usePlcDirectoryCustom,
  usePlcDirectorySetting,
  useSetPlcDirectory,
  useSetPlcDirectoryCustom,
} from '#/state/preferences/plc-directory'
import {
  useSetSlingshotInstance,
  useSetSlingshotInstanceCustom,
  useSlingshotInstanceCustom,
  useSlingshotInstanceSetting,
} from '#/state/preferences/slingshot-instance'
import {
  isValidHostnameUrl,
  isValidPlcDirectoryUrl,
  normalizeOrigin,
  useInfrastructureUrlSave,
} from '#/screens/Settings/components/infrastructureUrlSave'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {TagSearchInstanceDialog} from '#/screens/Settings/components/TagSearchInstanceDialog'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {createStaticClick, InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Select from '#/components/Select'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {RunesScreenLayout} from './components/RunesScreenLayout'

const IMAGE_CDN_PRESETS = [
  'https://porxie-bsky.dollware.net',
  'https://luna.madebydanny.uk',
] as const

const APP_SERVER_CDN_ORIGIN = 'https://cdn.bsky.app'

const PLC_DIRECTORY_PRESETS = [
  'https://plc.directory',
  'https://plc.eurosky.network',
  'https://plc.wafflehouse.dev',
] as const

const CONSTELLATION_PRESETS = [
  'https://constellation.microcosm.blue',
  'https://constellation.wafflehouse.dev',
] as const

const SLINGSHOT_PRESETS = [
  'https://slingshot.microcosm.blue',
  'https://slingshot.wafflehouse.dev',
] as const

export function RunesInfrastructureSettingsScreen() {
  const {t: l} = useLingui()

  const imageCdnHostSetting = useImageCdnHostSetting()
  const setImageCdnHost = useSetImageCdnHost()
  const setImageCdnHostControl = Dialog.useDialogControl()
  const [imageCdnDialogSession, setImageCdnDialogSession] = useState(0)

  const plcDirectorySetting = usePlcDirectorySetting()
  const setPlcDirectory = useSetPlcDirectory()
  const setPlcDirectoryControl = Dialog.useDialogControl()
  const [plcDirectoryDialogSession, setPlcDirectoryDialogSession] = useState(0)

  const constellationInstanceSetting = useConstellationInstanceSetting()
  const setConstellationInstance = useSetConstellationInstance()
  const setConstellationInstanceControl = Dialog.useDialogControl()
  const [constellationDialogSession, setConstellationDialogSession] =
    useState(0)

  const slingshotInstanceSetting = useSlingshotInstanceSetting()
  const setSlingshotInstance = useSetSlingshotInstance()
  const setSlingshotInstanceControl = Dialog.useDialogControl()
  const [slingshotDialogSession, setSlingshotDialogSession] = useState(0)

  const tagSearchInstanceControl = Dialog.useDialogControl()

  const openImageCdnCustomDialog = () => {
    setImageCdnDialogSession(session => session + 1)
    setImageCdnHostControl.open()
  }

  const openPlcDirectoryCustomDialog = () => {
    setPlcDirectoryDialogSession(session => session + 1)
    setPlcDirectoryControl.open()
  }

  const openConstellationCustomDialog = () => {
    setConstellationDialogSession(session => session + 1)
    setConstellationInstanceControl.open()
  }

  const openSlingshotCustomDialog = () => {
    setSlingshotDialogSession(session => session + 1)
    setSlingshotInstanceControl.open()
  }

  const imageCdnSelectValue = getImageCdnSelectValue(imageCdnHostSetting)
  const plcDirectorySelectValue =
    getPlcDirectorySelectValue(plcDirectorySetting)
  const constellationSelectValue = getConstellationSelectValue(
    constellationInstanceSetting,
  )
  const slingshotSelectValue = getSlingshotSelectValue(slingshotInstanceSetting)

  const imageCdnItems = [
    {value: 'default', label: l`App server default`},
    {value: IMAGE_CDN_PRESETS[0], label: l`Dollware Porxie`},
    {value: IMAGE_CDN_PRESETS[1], label: l`Luna`},
    {value: 'custom', label: l`Custom`},
  ]

  const plcDirectoryItems = [
    {value: PLC_DIRECTORY_PRESETS[0], label: l`plc.directory`},
    {value: PLC_DIRECTORY_PRESETS[1], label: l`Eurosky`},
    {value: PLC_DIRECTORY_PRESETS[2], label: l`Wafflehouse.dev`},
    {value: 'custom', label: l`Custom`},
  ]

  const constellationItems = [
    {value: CONSTELLATION_PRESETS[0], label: l`microcosm.blue`},
    {value: CONSTELLATION_PRESETS[1], label: l`Wafflehouse.dev`},
    {value: 'custom', label: l`Custom`},
  ]

  const slingshotItems = [
    {value: SLINGSHOT_PRESETS[0], label: l`microcosm.blue`},
    {value: SLINGSHOT_PRESETS[1], label: l`Wafflehouse.dev`},
    {value: 'custom', label: l`Custom`},
  ]

  return (
    <RunesScreenLayout titleText={l`Infrastructure`}>
      <SettingsList.Group iconInset={false}>
        <SettingsList.ItemText>
          <Trans>{`Image CDN`}</Trans>
        </SettingsList.ItemText>
        <View style={[a.gap_md, a.w_full]}>
          <Text style={[a.leading_snug]}>
            <Trans>Override the CDN host for all images.</Trans>
          </Text>
          <Select.Root
            value={imageCdnSelectValue}
            onValueChange={value => {
              if (value === 'custom') {
                openImageCdnCustomDialog()
                return
              }
              if (value === 'default') {
                setImageCdnHost(undefined)
                return
              }
              setImageCdnHost(value)
            }}>
            <Select.Trigger label={l`Select image CDN`}>
              <Select.ValueText />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content
              label={l`Image CDN`}
              renderItem={({label, value}) => (
                <Select.Item value={value} label={label}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              )}
              items={imageCdnItems}
            />
          </Select.Root>
        </View>
      </SettingsList.Group>

      <SettingsList.Divider />

      <SettingsList.Group iconInset={false}>
        <SettingsList.ItemText>
          <Trans>{`PLC Directory`}</Trans>
        </SettingsList.ItemText>
        <View style={[a.gap_md, a.w_full]}>
          <Text style={[a.leading_snug]}>
            <Trans>The directory used to resolve did:plc accounts.</Trans>
          </Text>
          <Select.Root
            value={plcDirectorySelectValue}
            onValueChange={value => {
              if (value === 'custom') {
                openPlcDirectoryCustomDialog()
                return
              }
              if (value === PLC_DIRECTORY_PRESETS[0]) {
                setPlcDirectory(undefined)
                return
              }
              setPlcDirectory(value)
            }}>
            <Select.Trigger label={l`Select PLC directory`}>
              <Select.ValueText />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content
              label={l`PLC Directory`}
              renderItem={({label, value}) => (
                <Select.Item value={value} label={label}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              )}
              items={plcDirectoryItems}
            />
          </Select.Root>
        </View>
      </SettingsList.Group>

      <SettingsList.Divider />

      <SettingsList.Group iconInset={false}>
        <SettingsList.ItemText>
          <Trans>{`Constellation Instance`}</Trans>
        </SettingsList.ItemText>
        <View style={[a.gap_md, a.w_full]}>
          <Text style={[a.leading_snug]}>
            <Trans>
              Used for custom verifications and fixing nuclear blocks via
              backlinks.
            </Trans>
          </Text>
          <Select.Root
            value={constellationSelectValue}
            onValueChange={value => {
              if (value === 'custom') {
                openConstellationCustomDialog()
                return
              }
              setConstellationInstance(value)
            }}>
            <Select.Trigger label={l`Select constellation instance`}>
              <Select.ValueText />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content
              label={l`Constellation Instance`}
              renderItem={({label, value}) => (
                <Select.Item value={value} label={label}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              )}
              items={constellationItems}
            />
          </Select.Root>
        </View>
      </SettingsList.Group>

      <SettingsList.Divider />

      <SettingsList.Group iconInset={false}>
        <SettingsList.ItemText>
          <Trans>{`Slingshot Instance`}</Trans>
        </SettingsList.ItemText>
        <View style={[a.gap_md, a.w_full]}>
          <Text style={[a.leading_snug]}>
            <Trans>
              Used to resolve and cache public AT Protocol records, including
              themes.
            </Trans>
          </Text>
          <Select.Root
            value={slingshotSelectValue}
            onValueChange={value => {
              if (value === 'custom') {
                openSlingshotCustomDialog()
                return
              }
              setSlingshotInstance(value)
            }}>
            <Select.Trigger label={l`Select slingshot instance`}>
              <Select.ValueText />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content
              label={l`Slingshot Instance`}
              renderItem={({label, value}) => (
                <Select.Item value={value} label={label}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              )}
              items={slingshotItems}
            />
          </Select.Root>
        </View>
      </SettingsList.Group>

      <SettingsList.Divider />

      <SettingsList.Group iconInset={false}>
        <SettingsList.ItemText>
          <Trans>Tag Search Server</Trans>
        </SettingsList.ItemText>
        <View style={[a.gap_md, a.w_full]}>
          <Text style={[a.leading_snug]}>
            <Trans>
              Used by the Tags tab in search to find posts by their
              auto-generated image tags.
            </Trans>
          </Text>
          <View style={[a.w_full, a.align_start]}>
            <InlineLinkText
              label={l`Change server`}
              {...createStaticClick(() => tagSearchInstanceControl.open())}>
              <Trans>Change server</Trans>
            </InlineLinkText>
          </View>
        </View>
      </SettingsList.Group>

      <TagSearchInstanceDialog control={tagSearchInstanceControl} />
      <ConstellationInstanceDialog
        control={setConstellationInstanceControl}
        openGeneration={constellationDialogSession}
      />
      <SlingshotInstanceDialog
        control={setSlingshotInstanceControl}
        openGeneration={slingshotDialogSession}
      />
      <ImageCdnHostDialog
        control={setImageCdnHostControl}
        openGeneration={imageCdnDialogSession}
      />
      <PlcDirectoryDialog
        control={setPlcDirectoryControl}
        openGeneration={plcDirectoryDialogSession}
      />
    </RunesScreenLayout>
  )
}

function SlingshotInstanceDialog({
  control,
  openGeneration,
}: {
  control: Dialog.DialogControlProps
  openGeneration: number
}) {
  const pal = usePalette('default')
  const {t: l} = useLingui()

  const slingshotInstanceCustom = useSlingshotInstanceCustom()
  const savedCustomUrl = slingshotInstanceCustom ?? ''
  const [url, setUrl] = useState(savedCustomUrl)
  const setSlingshotInstance = useSetSlingshotInstance()
  const setSlingshotInstanceCustom = useSetSlingshotInstanceCustom()
  const {submit, isTesting, testError, canSubmit, isClear, clearTestError} =
    useInfrastructureUrlSave({
      url,
      isUrlValid: isValidHostnameUrl,
      testUrl: testSlingshotUrl,
      onSave: nextUrl => {
        setSlingshotInstanceCustom(nextUrl)
        setSlingshotInstance(nextUrl)
      },
      onClear: () => {
        setSlingshotInstanceCustom(undefined)
        setSlingshotInstance(persisted.defaults.slingshotInstance)
      },
      control,
    })

  useLayoutEffect(() => {
    setUrl(savedCustomUrl)
    clearTestError()
  }, [savedCustomUrl, openGeneration, clearTestError])

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => {
        setUrl(savedCustomUrl)
        clearTestError()
      }}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Slingshot instance URL`}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Slingshot instance URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            key={openGeneration}
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={text => {
              setUrl(text)
              clearTestError()
            }}
            placeholder={persisted.defaults.slingshotInstance}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={() => void submit()}
            accessibilityHint={l`Input the URL of the Slingshot instance to use`}
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

function ConstellationInstanceDialog({
  control,
  openGeneration,
}: {
  control: Dialog.DialogControlProps
  openGeneration: number
}) {
  const pal = usePalette('default')
  const {t: l} = useLingui()

  const constellationInstanceCustom = useConstellationInstanceCustom()
  const savedCustomUrl = constellationInstanceCustom ?? ''
  const [url, setUrl] = useState(savedCustomUrl)
  const setConstellationInstance = useSetConstellationInstance()
  const setConstellationInstanceCustom = useSetConstellationInstanceCustom()
  const {submit, isTesting, testError, canSubmit, isClear, clearTestError} =
    useInfrastructureUrlSave({
      url,
      isUrlValid: isValidHostnameUrl,
      testUrl: testConstellationUrl,
      onSave: nextUrl => {
        setConstellationInstanceCustom(nextUrl)
        setConstellationInstance(nextUrl)
      },
      onClear: () => {
        setConstellationInstanceCustom(undefined)
        setConstellationInstance(persisted.defaults.constellationInstance)
      },
      control,
    })

  useLayoutEffect(() => {
    setUrl(savedCustomUrl)
    clearTestError()
  }, [savedCustomUrl, openGeneration, clearTestError])

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => {
        setUrl(savedCustomUrl)
        clearTestError()
      }}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Constellations instance URL`}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Constellations instance URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            key={openGeneration}
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={text => {
              setUrl(text)
              clearTestError()
            }}
            placeholder={persisted.defaults.constellationInstance}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={() => void submit()}
            accessibilityHint={l`Input the url of the constellations instance to use`}
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

function ImageCdnHostDialog({
  control,
  openGeneration,
}: {
  control: Dialog.DialogControlProps
  openGeneration: number
}) {
  const pal = usePalette('default')
  const {t: l} = useLingui()

  const imageCdnHostCustom = useImageCdnHostCustom()
  const savedCustomUrl = imageCdnHostCustom ?? ''
  const [url, setUrl] = useState(savedCustomUrl)
  const setImageCdnHost = useSetImageCdnHost()
  const setImageCdnHostCustom = useSetImageCdnHostCustom()
  const {submit, isTesting, testError, canSubmit, isClear, clearTestError} =
    useInfrastructureUrlSave({
      url,
      isUrlValid: isValidHostnameUrl,
      testUrl: testImageCdnUrl,
      onSave: nextUrl => {
        setImageCdnHostCustom(nextUrl)
        setImageCdnHost(nextUrl)
      },
      onClear: () => {
        setImageCdnHostCustom(undefined)
        setImageCdnHost(undefined)
      },
      control,
    })

  useLayoutEffect(() => {
    setUrl(savedCustomUrl)
    clearTestError()
  }, [savedCustomUrl, openGeneration, clearTestError])

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => {
        setUrl(savedCustomUrl)
        clearTestError()
      }}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Image CDN URL`}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Image CDN URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            key={openGeneration}
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={text => {
              setUrl(text)
              clearTestError()
            }}
            placeholder={APP_SERVER_CDN_ORIGIN}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={() => void submit()}
            accessibilityHint={l`Input the URL of the image CDN to use`}
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

function PlcDirectoryDialog({
  control,
  openGeneration,
}: {
  control: Dialog.DialogControlProps
  openGeneration: number
}) {
  const pal = usePalette('default')
  const {t: l} = useLingui()

  const plcDirectoryCustom = usePlcDirectoryCustom()
  const savedCustomUrl = plcDirectoryCustom ?? ''
  const [url, setUrl] = useState(savedCustomUrl)
  const setPlcDirectory = useSetPlcDirectory()
  const setPlcDirectoryCustom = useSetPlcDirectoryCustom()
  const {submit, isTesting, testError, canSubmit, isClear, clearTestError} =
    useInfrastructureUrlSave({
      url,
      isUrlValid: isValidPlcDirectoryUrl,
      testUrl: testPlcDirectoryUrl,
      onSave: nextUrl => {
        setPlcDirectoryCustom(nextUrl)
        setPlcDirectory(nextUrl)
      },
      onClear: () => {
        setPlcDirectoryCustom(undefined)
        setPlcDirectory(undefined)
      },
      control,
    })

  useLayoutEffect(() => {
    setUrl(savedCustomUrl)
    clearTestError()
  }, [savedCustomUrl, openGeneration, clearTestError])

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => {
        setUrl(savedCustomUrl)
        clearTestError()
      }}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`PLC Directory URL`}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>PLC Directory URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            key={openGeneration}
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={text => {
              setUrl(text)
              clearTestError()
            }}
            placeholder={persisted.defaults.plcDirectory}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={() => void submit()}
            accessibilityHint={l`Input the URL of the PLC directory to use`}
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

function getImageCdnSelectValue(raw: string | undefined) {
  if (!raw || normalizeOrigin(raw) === APP_SERVER_CDN_ORIGIN) {
    return 'default'
  }

  const origin = normalizeOrigin(raw)
  if (
    origin &&
    IMAGE_CDN_PRESETS.includes(origin as (typeof IMAGE_CDN_PRESETS)[number])
  ) {
    return origin
  }

  return 'custom'
}

function getPlcDirectorySelectValue(raw: string | undefined) {
  const origin = normalizeOrigin(raw ?? persisted.defaults.plcDirectory)
  if (
    origin &&
    PLC_DIRECTORY_PRESETS.includes(
      origin as (typeof PLC_DIRECTORY_PRESETS)[number],
    )
  ) {
    return origin
  }

  return 'custom'
}

function getConstellationSelectValue(raw: string | undefined) {
  const origin = normalizeOrigin(
    raw ?? persisted.defaults.constellationInstance,
  )
  if (
    origin &&
    CONSTELLATION_PRESETS.includes(
      origin as (typeof CONSTELLATION_PRESETS)[number],
    )
  ) {
    return origin
  }

  return 'custom'
}

function getSlingshotSelectValue(raw: string | undefined) {
  const origin = normalizeOrigin(raw ?? persisted.defaults.slingshotInstance)
  if (
    origin &&
    SLINGSHOT_PRESETS.includes(origin as (typeof SLINGSHOT_PRESETS)[number])
  ) {
    return origin
  }

  return 'custom'
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

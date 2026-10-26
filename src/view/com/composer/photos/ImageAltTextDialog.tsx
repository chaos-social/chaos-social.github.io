import {useRef, useState} from 'react'
import {useCallback} from 'react'
import {type ImageStyle, View} from 'react-native'
import {ActivityIndicator} from 'react-native'
import {EncodingType, readAsStringAsync} from 'expo-file-system/legacy'
import {Image} from 'expo-image'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Plural, Trans} from '@lingui/react/macro'

import {generateAltText} from '#/lib/ai/generateAltText'
import {MAX_ALT_TEXT} from '#/lib/constants'
import {getShapeRadius, getShapeStyle} from '#/lib/shapes'
import {enforceLen} from '#/lib/strings/helpers'
import {type ComposerImage} from '#/state/gallery'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {
  useAltTextAiConfig,
  useAltTextAiConfigured,
} from '#/state/preferences/openrouter'
import {AltTextCounterWrapper} from '#/view/com/composer/AltTextCounterWrapper'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {type DialogControlProps} from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfo} from '#/components/icons/CircleInfo'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

type Props = {
  control: Dialog.DialogOuterProps['control']
  image: ComposerImage
  onChange: (next: ComposerImage) => void
  sourceViewTag?: number
}

export const ImageAltTextDialog = ({
  control,
  image,
  onChange,
  sourceViewTag,
}: Props): React.ReactNode => {
  /*
   * The text being edited lives in ImageAltTextInner, not here. The sheet's
   * portal forwards its children from an effect, so state held above it reaches
   * the controlled input a commit late and makes typing jumpy. This only tracks
   * the latest edit so it can be saved on close, however the dialog is closed.
   */
  const editedAltText = useRef<string | null>(null)

  return (
    <Dialog.Outer
      control={control}
      onClose={() => {
        if (editedAltText.current === null) return
        onChange({
          ...image,
          alt: enforceLen(editedAltText.current, MAX_ALT_TEXT, true),
        })
        editedAltText.current = null
      }}
      nativeOptions={{fullHeight: true, sourceViewTag}}>
      <Dialog.Handle />
      <ImageAltTextInner
        control={control}
        image={image}
        onChangeText={text => {
          editedAltText.current = text
        }}
      />
    </Dialog.Outer>
  )
}

const ImageAltTextInner = ({
  onChangeText,
  control,
  image,
}: {
  onChangeText: (text: string) => void
  control: DialogControlProps
  image: Props['image']
}): React.ReactNode => {
  const [altText, setAltText] = useState(image.alt)
  const {_, i18n} = useLingui()
  const t = useTheme()
  const shape = useEnableSquareButtons()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const aiConfigured = useAltTextAiConfigured()
  const aiConfig = useAltTextAiConfig()

  const source = image.transformed ?? image.source
  const imageStyle: ImageStyle = {
    width: '100%',
    aspectRatio: Math.max(1, source.width / source.height),
    borderRadius: getShapeRadius(shape, 8, 8),
  }

  const handleGenerateAltText = useCallback(async () => {
    if (!aiConfig) return

    setIsGenerating(true)
    setGenerateError(null)

    try {
      const imagePath = (image.transformed ?? image.source).path

      let base64: string
      let mimeType: string

      if (IS_WEB) {
        const response = await fetch(imagePath)
        const blob = await response.blob()
        mimeType = blob.type || 'image/jpeg'
        const arrayBuffer = await blob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        let binary = ''
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i])
        }
        base64 = btoa(binary)
      } else {
        const base64Result = await readAsStringAsync(imagePath, {
          encoding: EncodingType.Base64,
        })
        base64 = base64Result
        const pathParts = imagePath.split('.')
        const ext = pathParts[pathParts.length - 1]?.toLowerCase()
        mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
      }

      const generated = await generateAltText(aiConfig, base64, mimeType)

      const text = enforceLen(generated, MAX_ALT_TEXT, true)
      setAltText(text)
      onChangeText(text)
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : 'Failed to generate alt text',
      )
    } finally {
      setIsGenerating(false)
    }
  }, [aiConfig, image, setAltText, onChangeText])

  return (
    <Dialog.ScrollableInner label={_(msg`Add alt text`)}>
      <Dialog.Close />

      <View>
        {/* vertical space is too precious - gets scrolled out of the way anyway */}
        {IS_WEB && (
          <Text
            style={[a.text_2xl, a.font_semi_bold, a.leading_tight, a.pb_sm]}>
            <Trans>Add alt text</Trans>
          </Text>
        )}

        <View
          style={[
            t.atoms.bg_contrast_50,
            getShapeStyle(shape, a.rounded_sm, a.rounded_sm),
            a.overflow_hidden,
          ]}>
          <Image
            style={imageStyle}
            source={{uri: (image.transformed ?? image.source).path}}
            contentFit="contain"
            accessible={true}
            accessibilityIgnoresInvertColors
            enableLiveTextInteraction
            autoplay={false}
          />
        </View>
      </View>

      <View style={[a.mt_md, a.gap_md]}>
        <View style={[a.gap_sm]}>
          <View style={[a.relative, {width: '100%'}]}>
            <TextField.LabelText>
              <Trans>Descriptive alt text</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                label={_(msg`Alt text`)}
                onChangeText={text => {
                  setAltText(text)
                  onChangeText(text)
                }}
                value={altText}
                multiline
                autoFocus
                scrollEnabled={false}
              />
            </TextField.Root>
          </View>

          {altText.length > MAX_ALT_TEXT && (
            <View style={[a.pb_sm, a.flex_row, a.gap_xs]}>
              <CircleInfo fill={t.palette.negative_500} />
              <Text
                style={[
                  a.italic,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>
                  Alt text will be truncated.{' '}
                  <Plural
                    value={MAX_ALT_TEXT}
                    other={`Limit: ${i18n.number(MAX_ALT_TEXT)} characters.`}
                  />
                </Trans>
              </Text>
            </View>
          )}

          {generateError && (
            <View style={[a.pb_sm, a.flex_row, a.gap_xs]}>
              <CircleInfo fill={t.palette.negative_500} />
              <Text style={[t.atoms.text_contrast_medium]}>
                {generateError}
              </Text>
            </View>
          )}
        </View>

        {aiConfigured && (
          <Button
            label={_(msg`Generate alt text`)}
            size="large"
            color="secondary"
            variant="solid"
            onPress={() => void handleGenerateAltText()}
            disabled={isGenerating}
            style={[a.flex_grow]}>
            {isGenerating ? (
              <ActivityIndicator color={t.palette.primary_500} />
            ) : (
              <SparkleIcon size="sm" />
            )}
            <ButtonText>
              <Trans>Generate alt text</Trans>
            </ButtonText>
          </Button>
        )}

        <AltTextCounterWrapper altText={altText}>
          <Button
            label={_(msg`Save`)}
            disabled={altText === image.alt}
            size="large"
            color="primary"
            variant="solid"
            onPress={() => {
              control.close()
            }}
            style={[a.flex_grow]}>
            <ButtonText>
              <Trans>Save</Trans>
            </ButtonText>
          </Button>
        </AltTextCounterWrapper>
      </View>
    </Dialog.ScrollableInner>
  )
}

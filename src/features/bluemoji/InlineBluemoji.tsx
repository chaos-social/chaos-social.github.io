import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {useAutoplayDisabled} from '#/state/preferences'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, web} from '#/alf'
import {Button} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Portal} from '#/components/Portal'
import * as Tooltip from '#/components/Tooltip'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'
import {InlineImage} from '#/features/bluemoji/InlineImage'
import {useBluemojiItemQuery} from '#/features/bluemoji/queries'
import {
  type BluemojiRef,
  getBluemojiImage,
  getBluemojiModeration,
} from '#/features/bluemoji/util'

export function InlineBluemoji({
  claim,
  fallbackText,
  size,
  baselineOffset,
  interactive = true,
}: {
  claim: BluemojiRef
  fallbackText: string
  size: number
  baselineOffset?: number
  interactive?: boolean
}) {
  const {t: l} = useLingui()
  const detailsControl = Dialog.useDialogControl()
  const [visible, setVisible] = useState(false)
  const {data: item} = useBluemojiItemQuery(claim)
  const opts = useModerationOpts()
  const autoplayDisabled = useAutoplayDisabled()
  const [failedUri, setFailedUri] = useState<string>()
  const uri =
    item && getBluemojiModeration(item, opts) === 'ignore'
      ? getBluemojiImage(item)
      : undefined
  if (!uri || uri === failedUri || !item) return fallbackText
  const alt = item.record.alt?.trim() || item.record.name
  const image = (
    <InlineImage
      testID="inlineBluemoji"
      source={{uri}}
      accessibilityLabel={alt}
      accessibilityHint={undefined}
      size={size}
      baselineOffset={baselineOffset}
      contentFit="contain"
      autoplay={!autoplayDisabled}
      onError={() => setFailedUri(uri)}
    />
  )
  if (!interactive) return image
  if (IS_NATIVE) {
    return (
      <>
        <Pressable
          testID="bluemojiDetails"
          style={{width: size, height: size}}
          accessibilityRole="button"
          accessibilityLabel={
            alt === item.record.name ? alt : `${item.record.name} ${alt}`
          }
          accessibilityHint={l`Show emoji details`}
          onPress={event => {
            event.stopPropagation()
            detailsControl.open()
          }}>
          {image}
        </Pressable>
        <Portal>
          <Dialog.Outer
            control={detailsControl}
            nativeOptions={{preventExpansion: true}}>
            <Dialog.Handle />
            <Dialog.ScrollableInner label={l`Emoji details`}>
              <View style={[a.flex_row, a.align_center, a.gap_md]}>
                <Image
                  source={{uri}}
                  accessibilityLabel={alt}
                  accessibilityHint={undefined}
                  style={{width: 48, height: 48}}
                  contentFit="contain"
                  autoplay={!autoplayDisabled}
                />
                <View style={[a.flex_1, a.gap_xs]}>
                  <Text emoji style={a.font_bold}>
                    {item.record.name}
                  </Text>
                  {alt !== item.record.name ? <Text emoji>{alt}</Text> : null}
                </View>
              </View>
            </Dialog.ScrollableInner>
          </Dialog.Outer>
        </Portal>
      </>
    )
  }
  return (
    <Tooltip.Outer visible={visible} onVisibleChange={setVisible}>
      <Tooltip.Target
        style={web({display: 'inline-block', verticalAlign: 'baseline'})}>
        <Button
          testID="bluemojiDetails"
          label={alt === item.record.name ? alt : `${item.record.name} ${alt}`}
          accessibilityHint={l`Show emoji details`}
          style={web({display: 'inline-block', verticalAlign: 'baseline'})}
          onPress={event => {
            event.preventDefault()
            event.stopPropagation()
            setVisible(!visible)
          }}>
          {image}
        </Button>
      </Tooltip.Target>
      <Tooltip.Content label={l`Emoji details`}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <Image
            source={{uri}}
            accessibilityLabel={alt}
            accessibilityHint={undefined}
            style={{width: 48, height: 48}}
            contentFit="contain"
            autoplay={!autoplayDisabled}
          />
          <View style={[a.flex_1, a.gap_xs]}>
            <Text emoji style={a.font_bold}>
              {item.record.name}
            </Text>
            {alt !== item.record.name ? <Text emoji>{alt}</Text> : null}
          </View>
        </View>
      </Tooltip.Content>
    </Tooltip.Outer>
  )
}

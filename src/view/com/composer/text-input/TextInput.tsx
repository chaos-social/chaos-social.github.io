import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type NativeSyntheticEvent,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputSelectionChangeEventData,
  View,
} from 'react-native'
import {type PasteEventPayload, TextInputWrapper} from 'expo-paste-input'
import {AppBskyRichtextFacet, RichText, UnicodeString} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'

import {POST_IMG_MAX} from '#/lib/constants'
import {downloadAndResize} from '#/lib/media/manip'
import {isUriImage} from '#/lib/media/util'
import {detectFacetsWithoutResolution} from '#/lib/strings/detect-facets'
import {getMentionAt, insertMentionAt} from '#/lib/strings/mention-manip'
import {useTheme} from '#/lib/ThemeContext'
import {
  type LinkFacetMatch,
  suggestLinkCardUri,
} from '#/view/com/composer/text-input/text-input-util'
import {atoms as a, useAlf, utils} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {IS_ANDROID, IS_NATIVE} from '#/env'
import {Autocomplete} from './mobile/Autocomplete'
import {type TextInputProps} from './TextInput.types'

interface Selection {
  start: number
  end: number
}

export function TextInput({
  ref,
  richtext,
  placeholder,
  hasRightPadding,
  setRichText,
  onPhotoPasted,
  onNewLink,
  onError,
  ...props
}: TextInputProps) {
  const {t: l} = useLingui()
  const {theme: t, fonts} = useAlf()
  const textInput = useRef<RNTextInput>(null)
  const textInputSelection = useRef<Selection>({start: 0, end: 0})
  const theme = useTheme()
  const [autocompletePrefix, setAutocompletePrefix] = useState('')
  const prevLength = useRef(richtext.length)
  const prevText = useRef(richtext.text)

  useImperativeHandle(ref, () => ({
    focus: () => textInput.current?.focus(),
    blur: () => {
      textInput.current?.blur()
    },
    getCursorPosition: () => undefined, // Not implemented on native
    maybeClosePopup: () => false, // Not needed on native
  }))

  const pastSuggestedUris = useRef(new Set<string>())
  const prevDetectedUris = useRef(new Map<string, LinkFacetMatch>())
  const onChangeText = useCallback(
    async (newText: string) => {
      const mayBePaste = newText.length > prevLength.current + 1

      // Check if this is a paste over selected text with a URL
      // NOTE: onChangeText happens before onSelectionChange, so textInputSelection.current
      // still contains the selection from before the paste
      if (
        mayBePaste &&
        textInputSelection.current.start !== textInputSelection.current.end
      ) {
        const selectionStart = textInputSelection.current.start
        const selectionEnd = textInputSelection.current.end
        const selectedText = prevText.current.substring(
          selectionStart,
          selectionEnd,
        )

        // Calculate what was pasted
        const beforeSelection = prevText.current.substring(0, selectionStart)
        const afterSelection = prevText.current.substring(selectionEnd)
        const expectedLength = beforeSelection.length + afterSelection.length
        const pastedLength = newText.length - expectedLength

        if (pastedLength > 0 && selectedText.length > 0) {
          const pastedText = newText.substring(
            selectionStart,
            selectionStart + pastedLength,
          )

          // Check if pasted text is a URL
          const urlPattern =
            /^(?:(?:(?:https?|ftp):)?\/\/)?(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i

          if (urlPattern.test(pastedText.trim())) {
            // Create markdown-style link: [selectedText](url)
            const markdownLink = `[${selectedText}](${pastedText.trim()})`
            newText = beforeSelection + markdownLink + afterSelection
          }
        }
      }

      const newRt = new RichText({text: newText})
      detectFacetsWithoutResolution(newRt)

      const markdownFacets: AppBskyRichtextFacet.Main[] = []
      const regex = /\[([^\]]+)\]\s*\(([^)]+)\)/g
      let match
      while ((match = regex.exec(newText)) !== null) {
        const [fullMatch, _linkText, linkUrl] = match
        const matchStart = match.index
        const matchEnd = matchStart + fullMatch.length
        const prefix = newText.slice(0, matchStart)
        const matchStr = newText.slice(matchStart, matchEnd)
        const byteStart = new UnicodeString(prefix).length
        const byteEnd = byteStart + new UnicodeString(matchStr).length

        let validUrl = linkUrl
        if (
          !validUrl.startsWith('http://') &&
          !validUrl.startsWith('https://') &&
          !validUrl.startsWith('mailto:')
        ) {
          validUrl = `https://${validUrl}`
        }

        markdownFacets.push({
          index: {byteStart, byteEnd},
          features: [{$type: 'app.bsky.richtext.facet#link', uri: validUrl}],
        })
      }

      if (markdownFacets.length > 0) {
        const nonOverlapping = (newRt.facets || []).filter(f => {
          return !markdownFacets.some(mf => {
            return (
              (f.index.byteStart >= mf.index.byteStart &&
                f.index.byteStart < mf.index.byteEnd) ||
              (f.index.byteEnd > mf.index.byteStart &&
                f.index.byteEnd <= mf.index.byteEnd) ||
              (mf.index.byteStart >= f.index.byteStart &&
                mf.index.byteStart < f.index.byteEnd)
            )
          })
        })
        newRt.facets = [...nonOverlapping, ...markdownFacets].sort(
          (a, b) => a.index.byteStart - b.index.byteStart,
        )
      }

      setRichText(newRt)

      // NOTE: BinaryFiddler
      // onChangeText happens before onSelectionChange, cursorPos is out of bound if the user deletes characters,
      const cursorPos = textInputSelection.current?.start ?? 0
      const prefix = getMentionAt(newText, Math.min(cursorPos, newText.length))

      if (prefix) {
        setAutocompletePrefix(prefix.value)
      } else if (autocompletePrefix) {
        setAutocompletePrefix('')
      }

      const nextDetectedUris = new Map<string, LinkFacetMatch>()
      if (newRt.facets) {
        for (const facet of newRt.facets) {
          for (const feature of facet.features) {
            if (AppBskyRichtextFacet.isLink(feature)) {
              if (isUriImage(feature.uri)) {
                const res = await downloadAndResize({
                  uri: feature.uri,
                  width: POST_IMG_MAX.width,
                  height: POST_IMG_MAX.height,
                  mode: 'contain',
                  maxSize: POST_IMG_MAX.size,
                  timeout: 15e3,
                })

                if (res !== undefined) {
                  onPhotoPasted(res.path)
                }
              } else {
                nextDetectedUris.set(feature.uri, {facet, rt: newRt})
              }
            }
          }
        }
      }
      const suggestedUri = suggestLinkCardUri(
        mayBePaste,
        nextDetectedUris,
        prevDetectedUris.current,
        pastSuggestedUris.current,
      )
      prevDetectedUris.current = nextDetectedUris
      if (suggestedUri) {
        onNewLink(suggestedUri)
      }
      prevLength.current = newText.length
      prevText.current = newText
    },
    [setRichText, autocompletePrefix, onPhotoPasted, onNewLink],
  )

  const onPaste = useCallback(
    (payload: PasteEventPayload) => {
      if (payload.type === 'unsupported') {
        onError(l`Unsupported clipboard content`)
        return
      }

      if (payload.type === 'images') {
        for (const uri of payload.uris) {
          if (isUriImage(uri)) {
            onPhotoPasted(uri)
          }
        }
      }
    },
    [l, onError, onPhotoPasted],
  )

  const onSelectionChange = useCallback(
    (evt: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      // NOTE we track the input selection using a ref to avoid excessive renders -prf
      textInputSelection.current = evt.nativeEvent.selection
    },
    [textInputSelection],
  )

  const onSelectAutocompleteItem = useCallback(
    (item: string) => {
      onChangeText(
        insertMentionAt(
          richtext.text,
          textInputSelection.current?.start || 0,
          item,
        ),
      )
      setAutocompletePrefix('')
    },
    [onChangeText, richtext, setAutocompletePrefix],
  )

  const inputTextStyle = useMemo(() => {
    const style = normalizeTextStyles(
      [a.text_lg, a.leading_snug, t.atoms.text],
      {
        fontScale: fonts.scaleMultiplier,
        fontFamily: fonts.family,
        flags: {},
      },
    )

    /**
     * PasteInput doesn't like `lineHeight`, results in jumpiness
     */
    if (IS_NATIVE) {
      style.lineHeight = undefined
    }

    /*
     * Android impl of `PasteInput` doesn't support the array syntax for `fontVariant`
     */
    if (IS_ANDROID) {
      // @ts-ignore
      style.fontVariant = style.fontVariant
        ? style.fontVariant.join(' ')
        : undefined
    }
    return style
  }, [t, fonts])

  const textDecorated = useMemo(() => {
    let i = 0

    return Array.from(richtext.segments()).map(segment => {
      return (
        <RNText
          key={i++}
          style={[
            inputTextStyle,
            {
              color: segment.facet ? t.palette.primary_500 : t.atoms.text.color,
              marginTop: -1,
            },
          ]}>
          {segment.text}
        </RNText>
      )
    })
  }, [t, richtext, inputTextStyle])

  return (
    <View style={[a.flex_1, a.pl_md, hasRightPadding && a.pr_4xl]}>
      <TextInputWrapper onPaste={onPaste}>
        <RNTextInput
          testID="composerTextInput"
          ref={textInput}
          onChangeText={onChangeText}
          onSelectionChange={onSelectionChange}
          placeholder={placeholder}
          placeholderTextColor={t.atoms.text_contrast_low.color}
          keyboardAppearance={theme.colorScheme}
          autoFocus={props.autoFocus !== undefined ? props.autoFocus : true}
          allowFontScaling
          multiline
          scrollEnabled={false}
          numberOfLines={2}
          // Note: should be the default value, but as of v1.104
          // it switched to "none" on Android
          autoCapitalize="sentences"
          selectionColor={utils.alpha(t.palette.primary_500, 0.4)}
          cursorColor={t.palette.primary_500}
          selectionHandleColor={t.palette.primary_500}
          {...props}
          style={[
            inputTextStyle,
            a.w_full,
            !autocompletePrefix && a.h_full,
            {
              textAlignVertical: 'top',
              minHeight: 60,
              includeFontPadding: false,
            },
            {
              borderWidth: 1,
              borderColor: 'transparent',
            },
            props.style,
          ]}>
          {textDecorated}
        </RNTextInput>
      </TextInputWrapper>
      <Autocomplete
        prefix={autocompletePrefix}
        onSelect={onSelectAutocompleteItem}
      />
    </View>
  )
}

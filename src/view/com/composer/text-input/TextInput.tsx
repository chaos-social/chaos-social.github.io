import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  PixelRatio,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputSelectionChangeEvent,
  type TextLayoutEvent,
  View,
} from 'react-native'
import {type PasteEventPayload, TextInputWrapper} from 'expo-paste-input'
import {RichText} from '@bsky/sdk/richtext'
import {useLingui} from '@lingui/react/macro'

import {IMAGE_SIZE_CONFIG_POSTS} from '#/lib/constants'
import {downloadAndResize} from '#/lib/media/manip'
import {isUriImage} from '#/lib/media/util'
import {formatMarkdownLinkDestination} from '#/lib/strings/markdown-links'
import {getMentionAt, insertMentionAt} from '#/lib/strings/mention-manip'
import {
  applyFacetSyntax,
  applyMarkdownLinkFacets,
} from '#/lib/strings/rich-text-manip'
import {useTheme} from '#/lib/ThemeContext'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {
  type LinkFacetMatch,
  suggestLinkCardUri,
} from '#/view/com/composer/text-input/text-input-util'
import {atoms as a, useAlf, utils} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {IS_ANDROID} from '#/env'
import {InlineBluemoji} from '#/features/bluemoji/InlineBluemoji'
import {
  applyNativeEmojiEdit,
  nativeToRaw,
  projectNativeEmoji,
  rawToNative,
} from '#/features/bluemoji/nativeEditor'
import {useComposerBluemojiItems} from '#/features/bluemoji/useComposerItems'
import {getBluemojiImage, getBluemojiModeration} from '#/features/bluemoji/util'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {Autocomplete} from './mobile/Autocomplete'
import {type TextInputProps} from './TextInput.types'

interface Selection {
  start: number
  end: number
}

export function TextInput({
  ref,
  richtext,
  bluemoji,
  bluemojiRepo,
  onSelectBluemoji: _onSelectBluemoji,
  placeholder,
  hasRightPadding,
  setRichText,
  onPhotoPasted,
  onNewLink,
  onError,
  canAddPost: _canAddPost,
  canMovePostUp: _canMovePostUp,
  canMovePostDown: _canMovePostDown,
  onBackspaceEmpty,
  onAddPost: _onAddPost,
  onMovePost: _onMovePost,
  onFocusPost: _onFocusPost,
  ...props
}: TextInputProps) {
  const {t: l} = useLingui()
  const {theme: t, fonts} = useAlf()
  const textInput = useRef<React.ComponentRef<typeof RNTextInput>>(null)
  const textInputSelection = useRef<Selection>({start: 0, end: 0})
  const items = useComposerBluemojiItems(richtext, bluemoji, bluemojiRepo)
  const moderationOpts = useModerationOpts()
  const verifiedItems = new Map(
    [...items].filter(
      ([, item]) =>
        getBluemojiImage(item) &&
        getBluemojiModeration(item, moderationOpts) === 'ignore',
    ),
  )
  const projection = projectNativeEmoji(richtext, verifiedItems)
  const [emojiLines, setEmojiLines] = useState<{
    text: string
    lines: TextLayoutEvent['nativeEvent']['lines']
  }>()
  const [emojiPrefixWidths, setEmojiPrefixWidths] = useState<
    Record<string, number>
  >({})
  const projectionRef = useRef(projection)
  const pendingSelection = useRef<Selection | null>(null)
  useLayoutEffect(() => {
    const previous = projectionRef.current
    const selection = pendingSelection.current ?? {
      start: nativeToRaw(previous, textInputSelection.current.start),
      end: nativeToRaw(previous, textInputSelection.current.end),
    }
    projectionRef.current = projection
    if (
      pendingSelection.current ||
      (previous.text !== projection.text && previous.raw === projection.raw)
    ) {
      const next = {
        start: rawToNative(projection, selection.start),
        end: rawToNative(projection, selection.end),
      }
      textInputSelection.current = next
      textInput.current?.setNativeProps({selection: next})
    }
    pendingSelection.current = null
  }, [projection])
  const theme = useTheme()
  const [autocompletePrefix, setAutocompletePrefix] = useState('')
  const prevLength = useRef(richtext.length)
  const prevText = useRef(richtext.text)

  useImperativeHandle(ref, () => ({
    insertText: text => {
      const previous = projectionRef.current
      const start = nativeToRaw(previous, textInputSelection.current.start)
      const end = nativeToRaw(previous, textInputSelection.current.end)
      const nextText =
        previous.raw.slice(0, start) + text + previous.raw.slice(end)
      const cursor = start + text.length
      pendingSelection.current = {start: cursor, end: cursor}
      void onChangeText(nextText)
      textInput.current?.focus()
    },
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
      const current = projectionRef.current
      const rawSelection = {
        start: nativeToRaw(current, textInputSelection.current.start),
        end: nativeToRaw(current, textInputSelection.current.end),
      }
      const mayBePaste = newText.length > prevLength.current + 1

      // Check if this is a paste over selected text with a URL
      // NOTE: onChangeText happens before onSelectionChange, so textInputSelection.current
      // still contains the selection from before the paste
      if (mayBePaste && rawSelection.start !== rawSelection.end) {
        const selectionStart = rawSelection.start
        const selectionEnd = rawSelection.end
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
            const markdownLink = `[${selectedText}](${formatMarkdownLinkDestination(pastedText.trim())})`
            newText = beforeSelection + markdownLink + afterSelection
          }
        }
      }

      const newRt = new RichText({text: newText})
      newRt.detectFacetsWithoutResolution()

      applyMarkdownLinkFacets(newRt)
      applyFacetSyntax(newRt)
      prevLength.current = newText.length
      prevText.current = newText
      projectionRef.current = projectNativeEmoji(newRt, verifiedItems)
      setRichText(newRt)

      // NOTE: BinaryFiddler
      // onChangeText happens before onSelectionChange, cursorPos is out of bound if the user deletes characters,
      const cursorPos = rawSelection.start
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
            if (bsky.isType(app.bsky.richtext.facet.link, feature)) {
              if (isUriImage(feature.uri)) {
                const res = await downloadAndResize({
                  uri: feature.uri,
                  ...IMAGE_SIZE_CONFIG_POSTS,
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
    },
    [setRichText, autocompletePrefix, onPhotoPasted, onNewLink, verifiedItems],
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
    (evt: TextInputSelectionChangeEvent) => {
      // NOTE we track the input selection using a ref to avoid excessive renders -prf
      textInputSelection.current = evt.nativeEvent.selection
    },
    [textInputSelection],
  )

  const onSelectAutocompleteItem = useCallback(
    (item: string) => {
      void onChangeText(
        insertMentionAt(
          richtext.text,
          nativeToRaw(projectionRef.current, textInputSelection.current.start),
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

    /*
     * Android impl of `PasteInput` doesn't support the array syntax for `fontVariant`
     */
    if (IS_ANDROID) {
      style.fontVariant =
        typeof style.fontVariant === 'string'
          ? style.fontVariant
          : style.fontVariant?.join(' ')
    }
    return style
  }, [t, fonts])

  /*
   * Opacity hides color emoji too. Measure the same plain text as TextInput,
   * without inline attachments that would change its line heights.
   */
  const emojiSize =
    (inputTextStyle.fontSize ?? a.text_lg.fontSize) * PixelRatio.getFontScale()
  const positionedEmoji = projection.tokens.map(token => {
    let start = 0
    const line =
      emojiLines?.text === projection.text
        ? emojiLines.lines.find(candidate => {
            const end = start + candidate.text.length
            if (token.index < end) return true
            start = end
            return false
          })
        : undefined
    const prefix = line ? projection.text.slice(start, token.index) : ''
    const width = prefix ? emojiPrefixWidths[prefix] : 0
    return {token, line, prefix, width}
  })

  return (
    <View style={[a.flex_1, a.pl_md, hasRightPadding && a.pr_4xl]}>
      <TextInputWrapper onPaste={onPaste}>
        <View style={props.style}>
          <View
            testID="composerEmojiMeasurement"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: 1,
              left: 1,
              right: 1,
              opacity: 0,
            }}>
            <RNText
              testID="composerEmojiImageLayer"
              accessible={false}
              textBreakStrategy="simple"
              onTextLayout={event => {
                setEmojiLines({
                  text: projection.text,
                  lines: event.nativeEvent.lines,
                })
              }}
              style={[inputTextStyle, {padding: 0, includeFontPadding: false}]}>
              {projection.text}
            </RNText>
            {positionedEmoji.map(({token, prefix}) =>
              prefix ? (
                <RNText
                  key={token.index}
                  testID={`composerEmojiPrefix-${token.index}`}
                  accessible={false}
                  numberOfLines={1}
                  onTextLayout={event => {
                    const width = event.nativeEvent.lines[0]?.width
                    if (width === undefined) return
                    setEmojiPrefixWidths(previous =>
                      previous[prefix] === width
                        ? previous
                        : {...previous, [prefix]: width},
                    )
                  }}
                  style={[
                    inputTextStyle,
                    {
                      position: 'absolute',
                      width: 10000,
                      includeFontPadding: false,
                    },
                  ]}>
                  {prefix}
                </RNText>
              ) : null,
            )}
          </View>
          {positionedEmoji.map(({token, line, width}) => {
            if (!line || width === undefined) return null
            return (
              <View
                key={token.index}
                testID={`composerEmojiPosition-${token.index}`}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  position: 'absolute',
                  left: line.x + width + 1,
                  top: line.y + line.height + 1 - emojiSize,
                }}>
                <InlineBluemoji
                  interactive={false}
                  claim={{
                    did: token.item.did,
                    name: token.item.record.name,
                    record: {uri: token.item.uri, cid: token.item.cid},
                  }}
                  fallbackText=""
                  size={emojiSize}
                  baselineOffset={0}
                />
              </View>
            )
          })}
          <RNTextInput
            testID="composerTextInput"
            ref={textInput}
            value={projection.text}
            accessibilityValue={{text: richtext.text}}
            onChangeText={(newText: string) => {
              const raw = applyNativeEmojiEdit(
                projectionRef.current,
                newText,
                textInputSelection.current,
              )
              void onChangeText(raw)
            }}
            onSelectionChange={onSelectionChange}
            onKeyPress={({nativeEvent}) => {
              if (nativeEvent.key === 'Backspace' && prevText.current === '') {
                onBackspaceEmpty()
              }
            }}
            placeholder={placeholder}
            placeholderTextColor={t.atoms.text_contrast_low.color}
            keyboardAppearance={theme.colorScheme}
            autoFocus={props.autoFocus !== undefined ? props.autoFocus : true}
            allowFontScaling
            multiline
            textBreakStrategy="simple"
            scrollEnabled={false}
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
              {
                padding: 0,
                textAlignVertical: 'top',
                minHeight: 60,
                includeFontPadding: false,
              },
              {
                borderWidth: 1,
                borderColor: 'transparent',
              },
            ]}
          />
        </View>
      </TextInputWrapper>
      <Autocomplete
        prefix={autocompletePrefix}
        onSelect={onSelectAutocompleteItem}
      />
    </View>
  )
}

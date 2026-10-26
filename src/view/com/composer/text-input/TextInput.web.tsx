import {
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {RichText} from '@bsky/sdk/richtext'
import {Trans} from '@lingui/react/macro'
import {getSchema} from '@tiptap/core'
import {Document} from '@tiptap/extension-document'
import Hardbreak from '@tiptap/extension-hard-break'
import History from '@tiptap/extension-history'
import {Mention} from '@tiptap/extension-mention'
import {Paragraph} from '@tiptap/extension-paragraph'
import {Placeholder} from '@tiptap/extension-placeholder'
import {Text as TiptapText} from '@tiptap/extension-text'
import {
  DOMParser as ProseMirrorDOMParser,
  Fragment,
  Node,
  Slice,
} from '@tiptap/pm/model'
import {EditorContent, type JSONContent, useEditor} from '@tiptap/react'
import {splitGraphemes} from 'unicode-segmenter/grapheme'

import {useColorSchemeStyle} from '#/lib/hooks/useColorSchemeStyle'
import {blobToDataUri, isUriImage} from '#/lib/media/util'
import {formatMarkdownLinkDestination} from '#/lib/strings/markdown-links'
import {
  applyFacetSyntax,
  applyMarkdownLinkFacets,
} from '#/lib/strings/rich-text-manip'
import {useActorAutocompleteFn} from '#/state/queries/actor-autocomplete'
import {
  type LinkFacetMatch,
  suggestLinkCardUri,
} from '#/view/com/composer/text-input/text-input-util'
import {textInputWebEmitter} from '#/view/com/composer/text-input/textInputWebEmitter'
import {atoms as a, useAlf} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {type Emoji} from '#/components/EmojiPicker'
import {Portal} from '#/components/Portal'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type TextInputProps} from './TextInput.types'
import {getThreadShortcut} from './thread-shortcuts'
import {type AutocompleteRef, createSuggestion} from './web/Autocomplete'
import {LinkDecorator} from './web/LinkDecorator'
import {TagDecorator} from './web/TagDecorator'

export function TextInput({
  ref,
  richtext,
  placeholder,
  webForceMinHeight,
  hasRightPadding,
  isActive,
  setRichText,
  onPhotoPasted,
  onPressPublish,
  onNewLink,
  onFocus,
  canAddPost,
  canMovePostUp,
  canMovePostDown,
  onBackspaceEmpty,
  onAddPost,
  onMovePost,
  onFocusPost,
  autoFocus,
}: TextInputProps) {
  const {theme: t, fonts} = useAlf()
  const autocomplete = useActorAutocompleteFn()
  const modeClass = useColorSchemeStyle('ProseMirror-light', 'ProseMirror-dark')

  const [isDropping, setIsDropping] = useState(false)
  const onBackspaceEmptyRef = useRef(onBackspaceEmpty)
  onBackspaceEmptyRef.current = onBackspaceEmpty
  const autocompleteRef = useRef<AutocompleteRef>(null)
  const threadShortcutState = useRef({
    canAddPost,
    canMovePostUp,
    canMovePostDown,
  })
  threadShortcutState.current = {
    canAddPost,
    canMovePostUp,
    canMovePostDown,
  }

  const extensions = useMemo(
    () => [
      Document,
      LinkDecorator,
      TagDecorator,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: createSuggestion({autocomplete, autocompleteRef}),
      }),
      Paragraph,
      Placeholder.configure({
        placeholder,
      }),
      TiptapText,
      History,
      Hardbreak,
    ],
    [autocomplete, placeholder],
  )

  useEffect(() => {
    if (!isActive) {
      return
    }
    const onPublish = () => onPressPublish(richtext)
    textInputWebEmitter.addListener('publish', onPublish)
    return () => {
      textInputWebEmitter.removeListener('publish', onPublish)
    }
  }, [onPressPublish, richtext, isActive])

  useEffect(() => {
    if (!isActive) {
      return
    }
    textInputWebEmitter.addListener('add-post', onAddPost)
    textInputWebEmitter.addListener('move-post', onMovePost)
    textInputWebEmitter.addListener('focus-post', onFocusPost)
    return () => {
      textInputWebEmitter.removeListener('add-post', onAddPost)
      textInputWebEmitter.removeListener('move-post', onMovePost)
      textInputWebEmitter.removeListener('focus-post', onFocusPost)
    }
  }, [isActive, onAddPost, onMovePost, onFocusPost])

  useEffect(() => {
    if (!isActive) {
      return
    }
    textInputWebEmitter.addListener('media-pasted', onPhotoPasted)
    return () => {
      textInputWebEmitter.removeListener('media-pasted', onPhotoPasted)
    }
  }, [isActive, onPhotoPasted])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleDrop = (event: DragEvent) => {
      const transfer = event.dataTransfer
      if (transfer) {
        const items = transfer.items

        getImageOrVideoFromUri(items, (uri: string) => {
          textInputWebEmitter.emit('media-pasted', uri)
        })
      }

      event.preventDefault()
      setIsDropping(false)
    }
    const handleDragEnter = (event: DragEvent) => {
      const transfer = event.dataTransfer

      event.preventDefault()
      if (transfer && transfer.types.includes('Files')) {
        setIsDropping(true)
      }
    }
    const handleDragLeave = (event: DragEvent) => {
      event.preventDefault()
      setIsDropping(false)
    }

    document.body.addEventListener('drop', handleDrop)
    document.body.addEventListener('dragenter', handleDragEnter)
    document.body.addEventListener('dragover', handleDragEnter)
    document.body.addEventListener('dragleave', handleDragLeave)

    return () => {
      document.body.removeEventListener('drop', handleDrop)
      document.body.removeEventListener('dragenter', handleDragEnter)
      document.body.removeEventListener('dragover', handleDragEnter)
      document.body.removeEventListener('dragleave', handleDragLeave)
    }
  }, [setIsDropping, isActive])

  const pastSuggestedUris = useRef(new Set<string>())
  const prevDetectedUris = useRef(new Map<string, LinkFacetMatch>())
  const editor = useEditor(
    {
      extensions,
      coreExtensionOptions: {
        clipboardTextSerializer: {
          blockSeparator: '\n',
        },
      },
      onFocus() {
        onFocus?.()
      },
      editorProps: {
        attributes: {
          class: modeClass,
        },
        clipboardTextParser: (text, context) => {
          const blocks = text.split(/(?:\r\n?|\n)/)
          const nodes: Node[] = blocks.map(line => {
            return Node.fromJSON(
              context.doc.type.schema,
              line.length > 0
                ? {type: 'paragraph', content: [{type: 'text', text: line}]}
                : {type: 'paragraph', content: []},
            )
          })

          const fragment = Fragment.fromArray(nodes)
          return Slice.maxOpen(fragment)
        },
        handlePaste: (view, event) => {
          const clipboardData = event.clipboardData
          let preventDefault = false

          if (clipboardData) {
            // Check if text is selected and pasted content is a URL
            const selection = view.state.selection
            const hasSelection = !selection.empty

            if (hasSelection && clipboardData.types.includes('text/plain')) {
              const pastedText = clipboardData.getData('text/plain').trim()
              const urlPattern =
                /^(?:(?:(?:https?|ftp):)?\/\/)?(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i

              if (urlPattern.test(pastedText)) {
                const selectedText = view.state.doc.textBetween(
                  selection.from,
                  selection.to,
                  '',
                )

                if (selectedText) {
                  // Create markdown-style link: [selectedText](url)
                  const markdownLink = `[${selectedText}](${formatMarkdownLinkDestination(pastedText)})`
                  const {from, to} = selection

                  view.dispatch(
                    view.state.tr.replaceWith(
                      from,
                      to,
                      view.state.schema.text(markdownLink),
                    ),
                  )

                  preventDefault = true
                  return true
                }
              }
            }

            if (clipboardData.types.includes('text/html')) {
              // Rich-text formatting is pasted, try retrieving plain text
              const text = clipboardData.getData('text/plain')
              // `pasteText` will invoke this handler again, but `clipboardData` will be null.
              view.pasteText(text)
              preventDefault = true
            }
            getImageOrVideoFromUri(clipboardData.items, (uri: string) => {
              textInputWebEmitter.emit('media-pasted', uri)
            })
            if (preventDefault) {
              // Return `true` to prevent ProseMirror's default paste behavior.
              return true
            }
          }
        },
        handleKeyDown: (view, event) => {
          if ((event.metaKey || event.ctrlKey) && event.code === 'Enter') {
            textInputWebEmitter.emit('publish')
            return true
          }

          const threadShortcut = getThreadShortcut(
            event,
            threadShortcutState.current,
          )
          switch (threadShortcut) {
            case 'add-post':
              textInputWebEmitter.emit('add-post')
              return true
            case 'focus-post-up':
              textInputWebEmitter.emit('focus-post', 'up')
              return true
            case 'focus-post-down':
              textInputWebEmitter.emit('focus-post', 'down')
              return true
            case 'move-post-up':
              textInputWebEmitter.emit('move-post', 'up')
              return true
            case 'move-post-down':
              textInputWebEmitter.emit('move-post', 'down')
              return true
          }

          if (
            event.code === 'Backspace' &&
            !(event.metaKey || event.altKey || event.ctrlKey)
          ) {
            if (
              !event.isComposing &&
              !view.composing &&
              !event.repeat &&
              view.state.doc.childCount === 1 &&
              view.state.doc.firstChild?.content.size === 0 &&
              onBackspaceEmptyRef.current()
            ) {
              return true
            }
            const isNotSelection = view.state.selection.empty
            if (isNotSelection) {
              const cursorPosition = view.state.selection.$anchor.pos
              const textBefore = view.state.doc.textBetween(
                0,
                cursorPosition,
                // important - use \n as a block separator, otherwise
                // all the lines get mushed together -sfn
                '\n',
              )
              const graphemes = [...splitGraphemes(textBefore)]

              if (graphemes.length > 0) {
                const lastGrapheme = graphemes[graphemes.length - 1]
                // deleteRange doesn't work on newlines, because tiptap
                // treats them as separate 'blocks' and we're using \n
                // as a stand-in. bail out if the last grapheme is a newline
                // to let the default behavior handle it -sfn
                if (lastGrapheme !== '\n') {
                  const deleteFrom = cursorPosition - lastGrapheme.length
                  /*
                   * Delete the whole grapheme through the active view so emoji
                   * stay intact. The editor captured by this handler
                   * can be stale after useEditor recreates it for a new theme.
                   */
                  view.dispatch(
                    view.state.tr.delete(deleteFrom, cursorPosition),
                  )
                  return true
                }
              }
            }
          }
        },
      },
      content: richTextToEditorJson(richtext, extensions),
      autofocus: autoFocus ? 'end' : null,
      editable: true,
      injectCSS: true,
      shouldRerenderOnTransaction: false,
      onUpdate({editor: editorProp}) {
        const json = editorProp.getJSON()
        const newText = editorJsonToText(json)
        const isPaste = window.event?.type === 'paste'

        const newRt = new RichText({text: newText})
        newRt.detectFacetsWithoutResolution()

        applyMarkdownLinkFacets(newRt)
        applyFacetSyntax(newRt)

        /*
         * TipTap owns the editable DOM, so its transaction has already made
         * the new character visible. The composer state update can re-render
         * most of the sheet (counter, controls, embeds, etc.), which is not
         * urgent and can be expensive on slower browsers. Marking it as a
         * transition lets React yield to the browser so the editor paints the
         * keystroke before doing that work.
         */
        startTransition(() => {
          setRichText(newRt)
        })

        const nextDetectedUris = new Map<string, LinkFacetMatch>()
        if (newRt.facets) {
          for (const facet of newRt.facets) {
            for (const feature of facet.features) {
              if (bsky.isType(app.bsky.richtext.facet.link, feature)) {
                nextDetectedUris.set(feature.uri, {facet, rt: newRt})
              }
            }
          }
        }

        const suggestedUri = suggestLinkCardUri(
          isPaste,
          nextDetectedUris,
          prevDetectedUris.current,
          pastSuggestedUris.current,
        )
        prevDetectedUris.current = nextDetectedUris
        if (suggestedUri) {
          onNewLink(suggestedUri)
        }
      },
    },
    [modeClass],
  )

  const onEmojiInserted = useCallback(
    (emoji: Emoji) => {
      editor?.chain().focus().insertContent(emoji.native).run()
    },
    [editor],
  )
  useEffect(() => {
    if (!isActive) {
      return
    }
    textInputWebEmitter.addListener('emoji-inserted', onEmojiInserted)
    return () => {
      textInputWebEmitter.removeListener('emoji-inserted', onEmojiInserted)
    }
  }, [onEmojiInserted, isActive])

  useImperativeHandle(ref, () => ({
    focus: () => {
      editor?.chain().focus().run()
    },
    blur: () => {
      editor?.chain().blur()
    },
    getCursorPosition: () => {
      const pos = editor?.state.selection.$anchor.pos
      return pos ? editor?.view.coordsAtPos(pos) : undefined
    },
    maybeClosePopup: () => autocompleteRef.current?.maybeClose() ?? false,
  }))

  const inputStyle = useMemo(() => {
    const style = normalizeTextStyles(
      [a.text_lg, a.leading_snug, t.atoms.text],
      {
        fontScale: fonts.scaleMultiplier,
        fontFamily: fonts.family,
        flags: {},
      },
    )
    /*
     * TipTap component isn't a RN View and while it seems to convert
     * `fontSize` to `px`, it doesn't convert `lineHeight`.
     *
     * `lineHeight` should always be defined here, this is defensive.
     */
    style.lineHeight = style.lineHeight
      ? ((style.lineHeight + 'px') as unknown as number)
      : undefined
    style.minHeight = webForceMinHeight ? 140 : undefined
    return {
      ...style,
      '--placeholder-color': t.atoms.text_contrast_low.color,
    }
  }, [t, fonts, webForceMinHeight])

  return (
    <>
      <View style={[styles.container, hasRightPadding && styles.rightPadding]}>
        {/* @ts-expect-error inputStyle is fine */}
        <EditorContent editor={editor} style={inputStyle} />
      </View>

      {isDropping && (
        <Portal>
          <Animated.View
            style={styles.dropContainer}
            entering={FadeIn.duration(80)}
            exiting={FadeOut.duration(80)}>
            <View
              style={[
                t.atoms.bg,
                t.atoms.border_contrast_low,
                styles.dropModal,
              ]}>
              <Text
                style={[
                  a.text_lg,
                  a.font_semi_bold,
                  t.atoms.text_contrast_medium,
                  t.atoms.border_contrast_high,
                  styles.dropText,
                ]}>
                <Trans>Drop to add images</Trans>
              </Text>
            </View>
          </Animated.View>
        </Portal>
      )}
    </>
  )
}

/**
 * Helper function to initialise the editor with RichText, which expects HTML
 *
 * All the extensions are able to initialise themselves from plain text, *except*
 * for the Mention extension - we need to manually convert it into a `<span>` element
 *
 * It also escapes HTML characters
 */
/*
 * Equivalent of @tiptap/html's generateJSON, but using the browser's native
 * DOMParser. The @tiptap/html version supports SSR via zeed-dom, which pulls
 * ~250KB of parser dependencies into the bundle - we are always in a browser
 * here, so we don't need it.
 */
function richTextToEditorJson(
  richtext: RichText,
  extensions: Parameters<typeof getSchema>[0],
): JSONContent {
  const schema = getSchema(extensions)
  const dom = new DOMParser().parseFromString(
    richTextToHTML(richtext),
    'text/html',
  ).body
  return ProseMirrorDOMParser.fromSchema(schema)
    .parse(dom, {preserveWhitespace: 'full'})
    .toJSON()
}

function richTextToHTML(richtext: RichText): string {
  let html = ''

  for (const segment of richtext.segments()) {
    if (segment.mention) {
      html += `<span data-type="mention" data-id="${escapeHTML(segment.mention.did)}"></span>`
    } else {
      html += escapeHTML(segment.text)
    }
  }

  // the body wrapper preserves leading whitespace, which the parser
  // otherwise strips
  return `<body>${html}</body>`
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
}

function editorJsonToText(
  json: JSONContent,
  isLastDocumentChild: boolean = false,
): string {
  let text = ''
  if (json.type === 'doc') {
    if (json.content?.length) {
      for (let i = 0; i < json.content.length; i++) {
        const node = json.content[i]
        const isLastNode = i === json.content.length - 1
        text += editorJsonToText(node, isLastNode)
      }
    }
  } else if (json.type === 'paragraph') {
    if (json.content?.length) {
      for (let i = 0; i < json.content.length; i++) {
        const node = json.content[i]
        text += editorJsonToText(node)
      }
    }
    if (!isLastDocumentChild) {
      text += '\n'
    }
  } else if (json.type === 'hardBreak') {
    text += '\n'
  } else if (json.type === 'text') {
    text += json.text || ''
  } else if (json.type === 'mention') {
    text += `@${json.attrs?.id || ''}`
  }
  return text
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'flex-start',
    padding: 5,
    marginLeft: 8,
    marginBottom: 10,
  },
  rightPadding: {
    paddingRight: 32,
  },
  dropContainer: {
    backgroundColor: '#0007',
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-expect-error web only -prf
    position: 'fixed',
    padding: 16,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  dropModal: {
    boxShadow: 'rgba(0, 0, 0, 0.3) 0px 5px 20px',
    padding: 8,
    borderWidth: 1,
    borderRadius: 16,
  },
  dropText: {
    paddingVertical: 44,
    paddingHorizontal: 36,
    borderStyle: 'dashed',
    borderRadius: 8,
    borderWidth: 2,
  },
})

function getImageOrVideoFromUri(
  items: DataTransferItemList,
  callback: (uri: string) => void,
) {
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const type = item.type

    if (type === 'text/plain') {
      item.getAsString(async itemString => {
        if (isUriImage(itemString)) {
          const response = await fetch(itemString)
          const blob = await response.blob()

          if (blob.type.startsWith('image/')) {
            blobToDataUri(blob).then(callback, err => console.error(err))
          }

          if (blob.type.startsWith('video/')) {
            blobToDataUri(blob).then(callback, err => console.error(err))
          }
        }
      })
    } else if (type.startsWith('image/')) {
      const file = item.getAsFile()

      if (file) {
        blobToDataUri(file).then(callback, err => console.error(err))
      }
    } else if (type.startsWith('video/')) {
      const file = item.getAsFile()

      if (file) {
        blobToDataUri(file).then(callback, err => console.error(err))
      }
    }
  }
}

import {useRef} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {openPostMediaTarget, type PostMediaTarget} from './postNavigation.web'

export function PostMediaDialog({
  control,
  targets,
}: {
  control: Dialog.DialogControlProps
  targets: PostMediaTarget[]
}) {
  const openingVideoRef = useRef(false)
  const {t: l} = useLingui()
  const t = useTheme()
  const labels = {
    media: l`Media`,
    embed: l`Embed`,
    quote: l`Quoted post`,
  }

  function choose(index: number) {
    const target = targets[index]
    if (target) {
      openingVideoRef.current = !!target.control.closest(
        '[data-testid="postVideoFocusTarget"]',
      )
      control.close(() => openPostMediaTarget(target))
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const isNext = event.key === 'j' || event.key === 'ArrowDown'
    const isPrevious = event.key === 'k' || event.key === 'ArrowUp'
    if (event.repeat && !isNext && !isPrevious) return
    const number = Number(event.key)
    if (number >= 1 && number <= targets.length) {
      event.preventDefault()
      event.stopPropagation()
      choose(number - 1)
      return
    }
    if (!isNext && !isPrevious && event.key !== 'b') return
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[data-testid^="postMediaChoice-"]',
      ),
    )
    const currentIndex = buttons.findIndex(
      button => button === document.activeElement,
    )
    if (event.key === 'b') {
      event.preventDefault()
      event.stopPropagation()
      choose(currentIndex < 0 ? 0 : currentIndex)
      return
    }
    const direction = isNext ? 1 : -1
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + direction + buttons.length) % buttons.length
    event.preventDefault()
    event.stopPropagation()
    buttons[nextIndex]?.focus()
  }

  return (
    <Dialog.Outer
      control={control}
      onOpen={() => {
        openingVideoRef.current = false
      }}
      webOptions={{alignCenter: true}}>
      <Dialog.ScrollableInner
        label={l`Open from this post`}
        onCloseAutoFocus={event => {
          if (openingVideoRef.current) event.preventDefault()
        }}
        style={[web({maxWidth: 400}), a.w_full]}>
        <div onKeyDown={onKeyDown}>
          <View style={[a.gap_lg]}>
            <Text style={[a.text_xl, a.font_bold]}>
              <Trans>Open from this post</Trans>
            </Text>
            <Text style={[t.atoms.text_contrast_medium]}>
              <Trans>
                Choose with j/k or the arrow keys, then press b or Enter. You
                can also press a number.
              </Trans>
            </Text>
            <View style={[a.gap_sm]}>
              {targets.map((target, index) => {
                const label = labels[target.kind]
                const number = index + 1
                return (
                  <Button
                    key={index}
                    testID={`postMediaChoice-${index}`}
                    label={l`${number}. ${label}`}
                    size="large"
                    color="secondary"
                    style={[a.justify_start, a.gap_md]}
                    onPress={() => choose(index)}>
                    <View
                      aria-hidden
                      style={[
                        a.align_center,
                        a.justify_center,
                        a.rounded_full,
                        a.border,
                        t.atoms.border_contrast_medium,
                        {width: 28, height: 28},
                      ]}>
                      <ButtonText>{number}</ButtonText>
                    </View>
                    <ButtonText>{label}</ButtonText>
                  </Button>
                )
              })}
            </View>
          </View>
        </div>
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

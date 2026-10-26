// Adapted from eurosky-social/eurosky-social-app (MIT), eurosky/fork.
import {useState} from 'react'
import {useWindowDimensions, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon,
  ChevronTop_Stroke2_Corner0_Rounded as ChevronUpIcon,
} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {KeyboardKey} from './KeyboardKey'
import {useKeyboardShortcutsPreference} from './preferences'

export function KeyboardShortcutsDialog({
  control,
  onOpen,
  onClose,
}: {
  control: Dialog.DialogControlProps
  onOpen?: () => void
  onClose?: () => void
}) {
  return (
    <Dialog.Outer
      control={control}
      onOpen={onOpen}
      onClose={onClose}
      nativeOptions={{preventExpansion: true}}
      webOptions={{alignCenter: true}}>
      <KeyboardShortcutsDialogInner />
    </Dialog.Outer>
  )
}

function KeyboardShortcutsDialogInner() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {enabled, setEnabled} = useKeyboardShortcutsPreference()
  const {width} = useWindowDimensions()
  const twoColumns = width >= 900

  return (
    <Dialog.ScrollableInner
      label={l`Keyboard shortcuts`}
      style={web({
        width: twoColumns ? 1040 : 520,
        maxWidth: '100%',
        maxHeight: '80vh',
        overflowY: 'auto',
        scrollbarGutter: 'stable',
      })}>
      <View style={[a.gap_xl]}>
        <View style={[a.gap_xs]}>
          <Text accessibilityRole="header" style={[a.text_2xl, a.font_bold]}>
            <Trans>Keyboard shortcuts</Trans>
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Navigate and interact without needing a mouse!</Trans>
          </Text>
        </View>

        <View style={[a.gap_xs]}>
          <Toggle.Item
            name="keyboard_shortcuts_dialog"
            label={l`Enable keyboard shortcuts`}
            value={enabled}
            onChange={setEnabled}>
            <Toggle.Platform />
            <Toggle.LabelText style={[a.flex_1]}>
              <Trans>Enable app keyboard shortcuts</Trans>
            </Toggle.LabelText>
          </Toggle.Item>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              You can turn app shortcuts back on later in
              Settings → Accessibility.
            </Trans>
          </Text>
        </View>

        <View
          style={web({
            display: 'block',
            columnCount: twoColumns ? 2 : 1,
            columnGap: 24,
          })}>
          <ShortcutGroup title={l`General`}>
            <ShortcutRow
              shortcut="?"
              shortcutLabel={l`question mark`}
              label={l`Show keyboard shortcuts`}
            />
            <ShortcutRow
              shortcut="/"
              shortcutLabel={l`slash`}
              label={l`Focus search`}
            />
            <ShortcutRow shortcut="n" label={l`Compose a new post`} />
            <ShortcutRow shortcut="u" label={l`Refresh the current feed`} />
            <ShortcutRow
              shortcut={l`esc`}
              shortcutLabel={l`escape`}
              label={l`Clear selection`}
            />
          </ShortcutGroup>

          <ShortcutGroup title={l`Go to a page`}>
            <ShortcutRow
              shortcut={['g', 'h']}
              shortcutLabel={l`g then h`}
              label={l`Home`}
            />
            <ShortcutRow
              shortcut={['g', 'e']}
              shortcutLabel={l`g then e`}
              label={l`Explore`}
            />
            <ShortcutRow
              shortcut={['g', 'n']}
              shortcutLabel={l`g then n`}
              label={l`Notifications`}
            />
            <ShortcutRow
              shortcut={['g', 'c']}
              shortcutLabel={l`g then c`}
              label={l`Chat`}
            />
            <ShortcutRow
              shortcut={['g', 'f']}
              shortcutLabel={l`g then f`}
              label={l`Feeds`}
            />
            <ShortcutRow
              shortcut={['g', 'l']}
              shortcutLabel={l`g then l`}
              label={l`Lists`}
            />
            <ShortcutRow
              shortcut={['g', 'b']}
              shortcutLabel={l`g then b`}
              label={l`Saved`}
            />
            <ShortcutRow
              shortcut={['g', 'p']}
              shortcutLabel={l`g then p`}
              label={l`Profile`}
            />
            <ShortcutRow
              shortcut={['g', 's']}
              shortcutLabel={l`g then s`}
              label={l`Settings`}
            />
          </ShortcutGroup>

          <ShortcutGroup title={l`Page navigation`}>
            <ShortcutRow
              shortcut={['[', {separator: '/'}, ']']}
              shortcutLabel={l`left or right square bracket`}
              label={l`Previous or next page tab`}
            />
            <ShortcutRow shortcut="h" label={l`Return to the previous feed`} />
            <ShortcutRow shortcut="j" label={l`Select the next item`} />
            <ShortcutRow shortcut="k" label={l`Select the previous item`} />
            <ShortcutRow
              shortcut={['b', {separator: '/'}, l`enter`]}
              shortcutLabel={l`b or enter`}
              label={l`Open or toggle the selected item`}
            />
          </ShortcutGroup>

          <ShortcutGroup title={l`Selected post`}>
            <ShortcutRow shortcut="p" label={l`View the author’s profile`} />
            <ShortcutRow
              shortcut="o"
              label={l`Open the image, video, or embed`}
            />
            <ShortcutRow shortcut="r" label={l`Reply to the selected post`} />
            <ShortcutRow
              shortcut="l"
              label={l`Like or unlike the selected post`}
            />
            <ShortcutRow shortcut="t" label={l`Repost or undo repost`} />
            <ShortcutRow shortcut="q" label={l`Quote the selected post`} />
            <ShortcutRow
              shortcut="s"
              label={l`Save or unsave the selected post`}
            />
            <ShortcutRow shortcut="x" label={l`Open sharing options`} />
            <ShortcutRow shortcut="m" label={l`Open the post menu`} />
            <ShortcutRow
              shortcut={[
                '⇧',
                {separator: '+'},
                {separator: '('},
                'r',
                {separator: '/'},
                't',
                {separator: '/'},
                'q',
                {separator: '/'},
                'l',
                {separator: '/'},
                's',
                {separator: ')'},
              ]}
              shortcutLabel={l`hold shift and press r, t, q, l, or s`}
              label={l`Choose an account for interacting`}
            />
            <ShortcutRow
              shortcut={[
                '⌥/alt',
                {separator: '+'},
                {separator: '('},
                't',
                {separator: '/'},
                'q',
                {separator: '/'},
                'l',
                {separator: ')'},
              ]}
              shortcutLabel={l`hold alt or option and press t, q, or l`}
              label={l`View reposts, quotes, or likes`}
            />
          </ShortcutGroup>

          <ShortcutGroup title={l`Composer`}>
            <ShortcutRow
              shortcut={['⌘/ctrl', {separator: '+'}, l`enter`]}
              shortcutLabel={l`command on Mac, or control on Windows and Linux, plus enter`}
              label={l`Publish from the composer`}
            />
            <ShortcutRow
              shortcut={['⌥/alt', {separator: '+'}, l`enter`]}
              shortcutLabel={l`alt or option plus enter`}
              label={l`Add a post to the thread`}
            />
            <ShortcutRow
              shortcut={[
                '⌥/alt',
                {separator: '+'},
                {separator: '('},
                '↑',
                {separator: '/'},
                '↓',
                {separator: ')'},
              ]}
              shortcutLabel={l`alt plus up or down arrow`}
              label={l`Focus the previous or next post`}
            />
            <ShortcutRow
              shortcut={[
                '⌥/alt',
                {separator: '+'},
                '⇧',
                {separator: '+'},
                {separator: '('},
                '↑',
                {separator: '/'},
                '↓',
                {separator: ')'},
              ]}
              shortcutLabel={l`alt plus shift plus up or down arrow`}
              label={l`Move the current post`}
            />
            <ShortcutRow
              shortcut={l`backspace`}
              label={l`Remove an empty post slot`}
            />
          </ShortcutGroup>

          <ShortcutGroup title={l`Focused video`}>
            <ShortcutRow shortcut={l`space`} label={l`Play or pause video`} />
            <ShortcutRow
              shortcut={l`space`}
              note={l`(hold)`}
              shortcutLabel={l`hold space`}
              label={l`Temporarily play at 2× speed`}
            />
            <ShortcutRow
              shortcut="c"
              label={l`Toggle captions when available`}
            />
            <ShortcutRow shortcut="f" label={l`Toggle fullscreen`} />
            <ShortcutRow shortcut="m" label={l`Mute or unmute video`} />
            <ShortcutRow
              shortcut={['←', {separator: '/'}, '→']}
              shortcutLabel={l`left or right arrow`}
              label={l`Seek backward or forward 5 seconds`}
            />
            <ShortcutRow
              shortcut={['↑', {separator: '/'}, '↓']}
              shortcutLabel={l`up or down arrow`}
              label={l`Increase or decrease volume`}
            />
            <ShortcutRow
              shortcut={[',', {separator: '/'}, '.']}
              shortcutLabel={l`comma or period`}
              label={l`Step backward or forward one frame`}
            />
            <ShortcutRow
              shortcut={['<', {separator: '/'}, '>']}
              shortcutLabel={l`less than or greater than`}
              label={l`Decrease or increase video playback speed`}
            />
          </ShortcutGroup>
        </View>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function ShortcutGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [expanded, setExpanded] = useState(true)

  return (
    <View
      style={[
        a.gap_sm,
        a.px_sm,
        a.mb_xl,
        web({
          display: 'inline-flex',
          verticalAlign: 'top',
          breakInside: 'avoid',
          width: '100%',
        }),
      ]}>
      <View accessibilityRole="header">
        <Button
          label={
            expanded
              ? l`Collapse ${title} shortcuts`
              : l`Expand ${title} shortcuts`
          }
          accessibilityState={{expanded}}
          onPress={() => setExpanded(value => !value)}
          style={[
            a.flex_row,
            a.align_center,
            a.justify_between,
            a.gap_sm,
            a.px_sm,
            a.py_sm,
            a.rounded_sm,
            {marginHorizontal: -a.p_sm.padding},
          ]}
          hoverStyle={[t.atoms.bg_contrast_25]}>
          <ButtonText style={[a.text_lg, a.font_bold]}>{title}</ButtonText>
          <View style={[a.mr_2xs]}>
            <ButtonIcon icon={expanded ? ChevronUpIcon : ChevronDownIcon} />
          </View>
        </Button>
      </View>
      {expanded && <View>{children}</View>}
    </View>
  )
}

function ShortcutRow({
  shortcut,
  shortcutLabel,
  note,
  label,
}: {
  shortcut: string | (string | {separator: string})[]
  shortcutLabel?: string
  note?: string
  label: string
}) {
  const t = useTheme()

  return (
    <View
      style={[
        a.flex_row,
        a.flex_wrap,
        a.align_center,
        a.justify_between,
        a.gap_sm,
        a.py_xs,
      ]}>
      <Text
        style={[
          a.flex_1,
          a.text_sm,
          t.atoms.text_contrast_high,
          {minWidth: 160},
        ]}>
        {label}
      </Text>
      <View
        accessible={!!shortcutLabel}
        accessibilityLabel={shortcutLabel}
        accessibilityHint=""
        style={[
          a.flex_row,
          a.flex_wrap,
          a.align_center,
          a.gap_2xs,
          {maxWidth: '100%'},
        ]}>
        {note && (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{note}</Text>
        )}
        {(typeof shortcut === 'string' ? [shortcut] : shortcut).map(
          (part, index) =>
            typeof part === 'string' ? (
              <View
                key={index}
                style={[
                  a.rounded_sm,
                  a.border,
                  t.atoms.border_contrast_medium,
                  t.atoms.bg_contrast_25,
                  a.px_xs,
                  a.py_2xs,
                ]}>
                <KeyboardKey>{part}</KeyboardKey>
              </View>
            ) : (
              <Text
                key={index}
                style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {part.separator}
              </Text>
            ),
        )}
      </View>
    </View>
  )
}

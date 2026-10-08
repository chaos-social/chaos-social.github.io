// Adapted from eurosky-social/eurosky-social-app (MIT), eurosky/fork.
import {useState} from 'react'
import {View} from 'react-native'
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

  return (
    <Dialog.ScrollableInner
      label={l`Keyboard shortcuts`}
      style={web({
        maxWidth: 620,
        maxHeight: '80vh',
        overflowY: 'auto',
      })}>
      <View style={[a.gap_xl]}>
        <View style={[a.gap_xs]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Keyboard shortcuts</Trans>
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              Navigate and interact without taking your hands off the keyboard.
            </Trans>
          </Text>
        </View>

        <ShortcutGroup title={l`General`}>
          <ShortcutRow shortcut="?" label={l`Show keyboard shortcuts`} />
          <ShortcutRow shortcut="/" label={l`Focus search`} />
          <ShortcutRow shortcut="N" label={l`Compose a new post`} />
          <ShortcutRow shortcut="U" label={l`Refresh the current feed`} />
          <ShortcutRow shortcut="Esc" label={l`Clear selection`} />
        </ShortcutGroup>

        <ShortcutGroup title={l`Focused video`}>
          <ShortcutRow shortcut="F" label={l`Toggle fullscreen`} />
          <ShortcutRow shortcut="M" label={l`Mute or unmute video`} />
          <ShortcutRow
            shortcut="← / →"
            label={l`Seek backward or forward 5 seconds`}
          />
          <ShortcutRow
            shortcut=", / ."
            label={l`Step backward or forward one frame`}
          />
          <ShortcutRow
            shortcut="< / >"
            label={l`Decrease or increase video playback speed`}
          />
        </ShortcutGroup>

        <ShortcutGroup title={l`Composer`}>
          <ShortcutRow
            shortcut="Cmd/Ctrl Enter"
            label={l`Publish from the composer`}
          />
          <ShortcutRow
            shortcut="Alt/⌥ Enter"
            label={l`Add a post to the thread`}
          />
          <ShortcutRow
            shortcut="Alt/⌥ ↑ / ↓"
            label={l`Focus the previous or next post`}
          />
          <ShortcutRow
            shortcut="Alt/⌥ Shift ↑ / ↓"
            label={l`Move the current post`}
          />
        </ShortcutGroup>

        <ShortcutGroup title={l`Go to`}>
          <ShortcutRow shortcut="G H" label={l`Home`} />
          <ShortcutRow shortcut="G E" label={l`Explore`} />
          <ShortcutRow shortcut="G N" label={l`Notifications`} />
          <ShortcutRow shortcut="G C" label={l`Chat`} />
          <ShortcutRow shortcut="G F" label={l`Feeds`} />
          <ShortcutRow shortcut="G L" label={l`Lists`} />
          <ShortcutRow shortcut="G B" label={l`Saved`} />
          <ShortcutRow shortcut="G P" label={l`Profile`} />
          <ShortcutRow shortcut="G S" label={l`Settings`} />
        </ShortcutGroup>

        <ShortcutGroup title={l`Page navigation`}>
          <ShortcutRow shortcut="[ / ]" label={l`Previous or next page tab`} />
          <ShortcutRow shortcut="H" label={l`Return to the previous feed`} />
          <ShortcutRow shortcut="J" label={l`Select the next item`} />
          <ShortcutRow shortcut="K" label={l`Select the previous item`} />
          <ShortcutRow
            shortcut="B / Enter"
            label={l`Open or toggle the selected item`}
          />
        </ShortcutGroup>

        <ShortcutGroup title={l`Selected post`}>
          <ShortcutRow shortcut="P" label={l`View the author’s profile`} />
          <ShortcutRow
            shortcut="O"
            label={l`Open the image, video, or embed`}
          />
          <ShortcutRow shortcut="R" label={l`Reply to the selected post`} />
          <ShortcutRow
            shortcut="L"
            label={l`Like or unlike the selected post`}
          />
          <ShortcutRow shortcut="T" label={l`Repost or undo repost`} />
          <ShortcutRow shortcut="Q" label={l`Quote the selected post`} />
          <ShortcutRow
            shortcut="S"
            label={l`Save or unsave the selected post`}
          />
          <ShortcutRow shortcut="X" label={l`Open sharing options`} />
          <ShortcutRow shortcut="M" label={l`Open the post menu`} />
          <ShortcutRow
            shortcut="Shift + R / T / Q / L / S"
            label={l`Open the interaction dropdown`}
          />
          <ShortcutRow
            shortcut="Alt/⌥ + T / Q / L"
            label={l`View reposts, quotes, or likes`}
          />
        </ShortcutGroup>

        <View
          style={[a.border_t, t.atoms.border_contrast_low, a.pt_lg, a.gap_xs]}>
          <Toggle.Item
            name="keyboard_shortcuts_dialog"
            label={l`Enable keyboard shortcuts`}
            value={enabled}
            onChange={setEnabled}>
            <Toggle.LabelText style={[a.flex_1]}>
              <Trans>Enable app keyboard shortcuts</Trans>
            </Toggle.LabelText>
            <Toggle.Platform />
          </Toggle.Item>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>Standard keyboard controls remain available.</Trans>
          </Text>
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
    <View style={[a.gap_sm, a.px_sm]}>
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
      {expanded && <View style={[a.gap_xs]}>{children}</View>}
    </View>
  )
}

function ShortcutRow({shortcut, label}: {shortcut: string; label: string}) {
  const t = useTheme()

  return (
    <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_lg]}>
      <Text style={[a.text_sm, t.atoms.text_contrast_high]}>{label}</Text>
      <View
        style={[
          a.rounded_sm,
          a.border,
          t.atoms.border_contrast_medium,
          t.atoms.bg_contrast_25,
          a.px_sm,
          a.py_2xs,
        ]}>
        <Text style={[a.text_xs, a.font_semi_bold]}>{shortcut}</Text>
      </View>
    </View>
  )
}

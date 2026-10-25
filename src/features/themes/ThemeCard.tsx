import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {shareUrl} from '#/lib/sharing'
import {useSession} from '#/state/session'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {ArrowOutOfBoxModified_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowOutOfBox'
import {
  Bookmark_Filled_Corner0_Rounded as BookmarkFilled,
  Bookmark_Stroke2_Corner0_Rounded as Bookmark,
} from '#/components/icons/Bookmark'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {DotGrid3x1_Stroke2_Corner0_Rounded as EllipsisIcon} from '#/components/icons/DotGrid'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {themeShareUrl} from '#/features/themes/urls'
import {useApplyTheme, useSaveTheme, useUnsaveTheme} from './api'
import {ThemePreview} from './ThemePreview'
import {getColorSet, getColorSets, themeRkey, type ThemeView} from './types'

export function ThemeCard({
  theme,
  selected,
  selectedSetName,
  savedRecordUri,
  onPress,
  label,
  showMenu = true,
}: {
  theme: ThemeView
  selected?: boolean
  selectedSetName?: string
  savedRecordUri?: string
  onPress?: () => void
  label?: string
  showMenu?: boolean
}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  const colorSet = getColorSet(theme.record, selectedSetName)
  const colorSets = getColorSets(theme.record)
  if (!colorSet) return null

  return (
    <View
      style={[
        a.relative,
        a.gap_sm,
        {
          flexBasis: gtMobile ? '30%' : '46%',
          flexGrow: gtMobile ? 0 : 1,
          flexShrink: 1,
          minWidth: gtMobile ? 150 : 0,
          maxWidth: gtMobile ? 190 : '48%',
        },
        web(
          gtMobile
            ? {
                flexBasis: 'calc((100% - 32px) / 3)',
                maxWidth: 'calc((100% - 32px) / 3)',
              }
            : {
                flexBasis: 'calc((100% - 16px) / 2)',
                maxWidth: 'calc((100% - 16px) / 2)',
              },
        ),
      ]}>
      <ThemePreview
        colorSet={colorSet}
        colorSets={colorSets}
        special={Boolean(theme.record.special)}
        variantCount={colorSets.length}
        label={label ?? theme.record.name}
        hideLabel
        selected={selected}
        onPress={
          onPress ??
          (() =>
            navigation.navigate('Theme', {
              name: theme.author,
              rkey: themeRkey(theme.uri),
            }))
        }
      />
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <View style={[a.flex_1]}>
          <Text
            emoji
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[a.text_lg, a.font_semi_bold]}>
            {theme.record.name}
          </Text>
          {theme.record.description ? (
            <Text
              emoji
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {theme.record.description}
            </Text>
          ) : null}
        </View>
        {showMenu && (
          <ThemeCardMenu
            theme={theme}
            colorSetName={colorSet.name}
            savedRecordUri={savedRecordUri}
            selected={selected}
          />
        )}
      </View>
    </View>
  )
}

function ThemeCardMenu({
  theme,
  colorSetName,
  savedRecordUri,
  selected,
}: {
  theme: ThemeView
  colorSetName: string
  savedRecordUri?: string
  selected?: boolean
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {currentAccount} = useSession()
  const isOwn = Boolean(
    currentAccount && theme.uri.startsWith(`at://${currentAccount.did}/`),
  )
  const applyTheme = useApplyTheme()
  const saveTheme = useSaveTheme()
  const unsaveTheme = useUnsaveTheme()
  return (
    <Menu.Root>
      <Menu.Trigger label={l`Open theme actions`}>
        {({props}) => (
          <Button
            {...props}
            label={l`Open theme actions`}
            size="small"
            variant="solid"
            color="secondary"
            shape="square">
            <ButtonIcon icon={EllipsisIcon} size="sm" />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Item
          label={l`Use theme`}
          disabled={selected}
          onPress={() => applyTheme(theme, colorSetName)}>
          <Menu.ItemText>
            <Trans>Use theme</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={CheckIcon} position="right" />
        </Menu.Item>
        {currentAccount && (
          <Menu.Item
            label={savedRecordUri ? l`Unsave theme` : l`Save theme`}
            onPress={() => {
              if (savedRecordUri) {
                unsaveTheme.mutate(savedRecordUri)
              } else {
                saveTheme.mutate(theme)
              }
            }}>
            <Menu.ItemText>
              {savedRecordUri ? <Trans>Unsave</Trans> : <Trans>Save</Trans>}
            </Menu.ItemText>
            <Menu.ItemIcon
              icon={savedRecordUri ? BookmarkFilled : Bookmark}
              position="right"
            />
          </Menu.Item>
        )}
        {currentAccount && !isOwn && (
          <Menu.Item
            label={l`Remix theme`}
            onPress={() =>
              navigation.navigate('ThemeEditor', {
                remix: {
                  name: theme.author,
                  rkey: themeRkey(theme.uri),
                  colorSet: colorSetName,
                },
              })
            }>
            <Menu.ItemText>
              <Trans>Remix</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={PencilIcon} position="right" />
          </Menu.Item>
        )}
        {isOwn && (
          <Menu.Item
            testID="editThemeMenuItem"
            label={l`Edit theme`}
            onPress={() =>
              navigation.navigate('ThemeEditor', {rkey: themeRkey(theme.uri)})
            }>
            <Menu.ItemText>
              <Trans>Edit</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={PencilIcon} position="right" />
          </Menu.Item>
        )}
        <Menu.Item
          label={l`Share theme`}
          onPress={() =>
            void shareUrl(themeShareUrl(theme.author, themeRkey(theme.uri)))
          }>
          <Menu.ItemText>
            <Trans>Share</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={ShareIcon} position="right" />
        </Menu.Item>
      </Menu.Outer>
    </Menu.Root>
  )
}

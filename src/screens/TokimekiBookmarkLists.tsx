import {FlatList, Pressable, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {SettingsGear2_Stroke2_Corner0_Rounded as GearIcon} from '#/components/icons/SettingsGear2'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {useBookmarkListMutation} from '#/features/tokimeki/bookmarkListMutations'
import {
  type TokimekiBookmarkList,
  useTokimekiBookmarkListsQuery,
} from '#/features/tokimeki/bookmarkLists'
import {CreateOrEditBookmarkListDialog} from '#/features/tokimeki/components/CreateOrEditBookmarkListDialog'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'TokimekiBookmarkLists'
>

export function TokimekiBookmarkListsScreen({}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const createControl = useDialogControl()
  const {data, isLoading, isError, error} = useTokimekiBookmarkListsQuery()
  const lists = data?.bookmarks ?? []

  return (
    <Layout.Screen testID="tokimekiBookmarkListsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>{l`Private lists`}</Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot>
          <Button
            label={l`New private list`}
            size="small"
            color="secondary"
            onPress={() => createControl.open()}>
            <ButtonIcon icon={PlusIcon} />
          </Button>
        </Layout.Header.Slot>
      </Layout.Header.Outer>
      {/* Layout.Screen does not constrain a bare list, so center the column here. */}
      <Layout.Center style={[a.flex_1]}>
        {isLoading ? (
          <View style={[a.flex_1, a.align_center, a.justify_center]}>
            <Loader size="lg" />
          </View>
        ) : isError ? (
          <View style={[a.p_xl]}>
            <Text style={[a.text_md]}>{cleanError(error)}</Text>
          </View>
        ) : lists.length === 0 ? (
          <View
            style={[
              a.flex_1,
              a.align_center,
              a.justify_center,
              a.p_xl,
              a.gap_lg,
            ]}>
            <LockIcon size="2xl" fill={t.palette.contrast_400} />
            <Text style={[a.text_md, a.text_center]}>
              {l`No private lists yet. Lists are stored with TOKIMEKI and only you can see them.`}
            </Text>
            <Button
              label={l`New private list`}
              color="primary"
              size="large"
              onPress={() => createControl.open()}>
              <ButtonText>{l`New private list`}</ButtonText>
            </Button>
          </View>
        ) : (
          <FlatList
            style={[a.flex_1]}
            data={lists}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => <ListRow list={item} />}
          />
        )}
      </Layout.Center>
      <CreateOrEditBookmarkListDialog control={createControl} />
    </Layout.Screen>
  )
}

function ListRow({list}: {list: TokimekiBookmarkList}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {mutate} = useBookmarkListMutation()
  const editControl = useDialogControl()
  const deleteControl = useDialogControl()

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={list.name}
        accessibilityHint={l`Opens the posts saved in this list`}
        testID={`tokimekiBookmarkList-${list.id}`}
        onPress={() =>
          navigation.navigate('TokimekiBookmarkList', {
            listId: String(list.id),
          })
        }
        style={[
          a.flex_row,
          a.align_center,
          a.gap_md,
          a.px_lg,
          a.py_md,
          a.border_b,
          t.atoms.border_contrast_low,
        ]}>
        <LockIcon size="md" fill={t.palette.contrast_500} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
            {list.name}
          </Text>
          {list.text ? (
            <Text
              emoji
              numberOfLines={1}
              style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {list.text}
            </Text>
          ) : null}
        </View>
        <Menu.Root>
          <Menu.Trigger label={l`List options`}>
            {({props}) => (
              <Pressable
                {...props}
                style={[a.p_sm]}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <GearIcon size="sm" fill={t.palette.contrast_500} />
              </Pressable>
            )}
          </Menu.Trigger>
          <Menu.Outer>
            <Menu.Group>
              <Menu.Item label={l`Rename`} onPress={() => editControl.open()}>
                <Menu.ItemText>{l`Rename`}</Menu.ItemText>
              </Menu.Item>
              <Menu.Item
                destructive
                label={l`Delete list`}
                onPress={() => deleteControl.open()}>
                <Menu.ItemText>{l`Delete list`}</Menu.ItemText>
                <Menu.ItemIcon icon={TrashIcon} position="right" />
              </Menu.Item>
            </Menu.Group>
          </Menu.Outer>
        </Menu.Root>
      </Pressable>
      <Prompt.Basic
        control={deleteControl}
        title={l`Delete “${list.name}”?`}
        description={l`The posts saved in this list are removed with it. This cannot be undone.`}
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
        onConfirm={() => mutate({action: 'deleteList', id: list.id})}
      />
      <CreateOrEditBookmarkListDialog control={editControl} list={list} />
    </>
  )
}

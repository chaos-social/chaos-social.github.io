import {useCallback, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Plural, Trans, useLingui} from '@lingui/react/macro'

import {MAX_DESCRIPTION, MAX_DISPLAY_NAME, urls} from '#/lib/constants'
import {useCallOnce} from '#/lib/once'
import {getShapeStyle} from '#/lib/shapes'
import {cleanError} from '#/lib/strings/errors'
import {isOverMaxGraphemeCount} from '#/lib/strings/helpers'
import {logger} from '#/logger'
import {type ImageMeta} from '#/state/gallery'
import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useProfileUpdateMutation} from '#/state/queries/profile'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import {
  EditableUserAvatar,
  getSquareAvatarRadius,
} from '#/view/com/util/UserAvatar'
import {UserBanner} from '#/view/com/util/UserBanner'
import {Logo} from '#/view/icons/Logo'
import {WitchHatEditor} from '#/screens/Profile/Header/WitchHatEditor'
import {isOctober} from '#/screens/Profile/Header/WitchHatEditor/utils'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useSimpleVerificationStateWithDeer} from '#/components/verification'
import {useAnalytics} from '#/analytics'
import {IS_WEB} from '#/env'
import {
  logProfileLinkChanges,
  type ProfileLink,
  ProfileLinksEditor,
  sameProfileLinks,
  useCanEditProfileLinks,
  useOwnProfileLinksQuery,
  useSetOwnProfileLinksCache,
  useWriteProfileLinks,
} from '#/features/profileLinks'
import {type app} from '#/lexicons'

const PRONOUNS_MAX_GRAPHEMES = 20

export function EditProfileDialog({
  profile,
  control,
  onUpdate,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  control: Dialog.DialogControlProps
  onUpdate?: () => void
}) {
  const {t: l} = useLingui()
  const cancelControl = Dialog.useDialogControl()
  const [dirty, setDirty] = useState(false)
  const [isPresented, setIsPresented] = useState(false)

  const onPressCancel = useCallback(() => {
    if (dirty) {
      cancelControl.open()
    } else {
      control.close()
    }
  }, [dirty, control, cancelControl])

  return (
    <Dialog.Outer
      control={control}
      onOpen={() => setIsPresented(IS_WEB)}
      onClose={() => setIsPresented(false)}
      nativeOptions={{
        preventDismiss: dirty,
        fullHeight: true,
        onStateChange: event => {
          setIsPresented(event.nativeEvent.state === 'open')
        },
      }}
      webOptions={{
        onBackgroundPress: () => {
          if (dirty) {
            cancelControl.open()
          } else {
            control.close()
          }
        },
      }}
      testID="editProfileModal">
      <DialogInner
        profile={profile}
        onUpdate={onUpdate}
        setDirty={setDirty}
        onPressCancel={onPressCancel}
        isPresented={isPresented}
      />

      <Prompt.Basic
        control={cancelControl}
        title={l`Discard changes?`}
        description={l`Are you sure you want to discard your changes?`}
        onConfirm={() => control.close()}
        confirmButtonCta={l`Discard`}
        confirmButtonColor="negative"
      />
    </Dialog.Outer>
  )
}

function DialogInner({
  profile,
  onUpdate,
  setDirty,
  onPressCancel,
  isPresented,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  onUpdate?: () => void
  setDirty: (dirty: boolean) => void
  onPressCancel: () => void
  isPresented: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const ax = useAnalytics()
  const control = Dialog.useDialogContext()
  const enableSquareButtons = useEnableSquareButtons()
  // the dialog's contents mount on every open, so this fires once per open
  useCallOnce(() => {
    ax.metric('profile:edit:open', {})
  })()
  const verification = useSimpleVerificationStateWithDeer({
    profile,
  })
  const {
    mutateAsync: updateProfileMutation,
    error: updateProfileError,
    isError: isUpdateProfileError,
    isPending: isUpdatingProfile,
  } = useProfileUpdateMutation()
  const [imageError, setImageError] = useState('')
  const witchHatControl = Dialog.useDialogControl()
  const initialDisplayName = profile.displayName || ''
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const initialDescription = profile.description || ''
  const [description, setDescription] = useState(initialDescription)
  const initialPronouns = profile.pronouns || ''
  const [pronouns, setPronouns] = useState(initialPronouns)
  const [websiteTransferred, setWebsiteTransferred] = useState(false)
  const [userBanner, setUserBanner] = useState<string | undefined | null>(
    profile.banner,
  )
  const [userAvatar, setUserAvatar] = useState<string | undefined | null>(
    profile.avatar,
  )
  const [newUserBanner, setNewUserBanner] = useState<
    ImageMeta | undefined | null
  >()
  const [newUserAvatar, setNewUserAvatar] = useState<
    ImageMeta | undefined | null
  >()

  const linksEnabled = useCanEditProfileLinks()
  const {data: storedLinks} = useOwnProfileLinksQuery(profile.did, {
    enabled: linksEnabled,
  })
  const writeProfileLinks = useWriteProfileLinks()
  const setOwnProfileLinksCache = useSetOwnProfileLinksCache()
  /*
   * Unset until the owner edits their links, so edits always start from the
   * loaded records and a save can't overwrite links that hadn't loaded yet.
   */
  const [editedLinks, setEditedLinks] = useState<ProfileLink[]>()
  const links = editedLinks ?? storedLinks
  const linksLoaded = !!storedLinks

  useEffect(() => {
    if (!linksEnabled || !storedLinks) return
    ax.metric('profile:links:editorOpen', {
      linkCount: storedLinks.length,
    })
    // Once, when the links first load.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [linksEnabled, linksLoaded])
  const [isDraggingLinks, setIsDraggingLinks] = useState(false)
  // on Android the sheet turns its own drag off while scrolled, so put that back after
  const sheetDragWasDisabled = useRef(false)

  const profileDirty =
    displayName !== initialDisplayName ||
    description !== initialDescription ||
    userAvatar !== profile.avatar ||
    userBanner !== profile.banner ||
    pronouns !== initialPronouns ||
    websiteTransferred
  const linksDirty =
    !!editedLinks &&
    !!storedLinks &&
    !sameProfileLinks(editedLinks, storedLinks)
  const dirty = profileDirty || linksDirty

  const enableSquareAvatars = useEnableSquareAvatars()

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])

  const onSelectNewAvatar = useCallback(
    (img: ImageMeta | null) => {
      setImageError('')
      if (img === null) {
        setNewUserAvatar(null)
        setUserAvatar(null)
        return
      }
      try {
        setNewUserAvatar(img)
        setUserAvatar(img.path)
      } catch (e: any) {
        setImageError(cleanError(e))
      }
    },
    [setNewUserAvatar, setUserAvatar, setImageError],
  )

  const onSelectNewBanner = useCallback(
    (img: ImageMeta | null) => {
      setImageError('')
      if (!img) {
        setNewUserBanner(null)
        setUserBanner(null)
        return
      }
      try {
        setNewUserBanner(img)
        setUserBanner(img.path)
      } catch (e: any) {
        setImageError(cleanError(e))
      }
    },
    [setNewUserBanner, setUserBanner, setImageError],
  )

  const onPressSave = useCallback(async () => {
    setImageError('')
    try {
      const nextLinks = linksDirty ? editedLinks : undefined
      // the profile can only point at link records that already exist
      const written = nextLinks
        ? await writeProfileLinks(profile.did, nextLinks, storedLinks ?? [])
        : undefined
      await updateProfileMutation({
        profile,
        updates: {
          displayName: displayName.trimEnd(),
          description: description.trimEnd(),
          pronouns: pronouns.trim().toLowerCase() || undefined,
          ...(websiteTransferred && {website: undefined}),
          ...(written && {
            links: written.refs.length ? written.refs : undefined,
          }),
        },
        newUserAvatar,
        newUserBanner,
      })
      if (nextLinks && written) {
        logProfileLinkChanges(ax, storedLinks ?? [], nextLinks)
        setOwnProfileLinksCache(profile.did, nextLinks, written.refs)
        await written.deleteRemoved()
      }
      control.close(() => onUpdate?.())
      Toast.show(l({message: 'Profile updated', context: 'toast'}))
    } catch (e: any) {
      logger.error('Failed to update user profile', {message: String(e)})
    }
  }, [
    updateProfileMutation,
    profile,
    onUpdate,
    control,
    displayName,
    description,
    pronouns,
    websiteTransferred,
    newUserAvatar,
    newUserBanner,
    setImageError,
    l,
    editedLinks,
    linksDirty,
    storedLinks,
    ax,
    writeProfileLinks,
    setOwnProfileLinksCache,
  ])

  const displayNameTooLong = isOverMaxGraphemeCount({
    text: displayName,
    maxCount: MAX_DISPLAY_NAME,
  })
  const pronounsTooLong = isOverMaxGraphemeCount({
    text: pronouns,
    maxCount: PRONOUNS_MAX_GRAPHEMES,
  })
  const descriptionTooLong = isOverMaxGraphemeCount({
    text: description,
    maxCount: MAX_DESCRIPTION,
  })

  const cancelButton = () => (
    <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
      <Button
        label={l`Cancel`}
        onPress={onPressCancel}
        size="small"
        color="primary"
        variant="ghost"
        style={[
          getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
        ]}
        testID="editProfileCancelBtn">
        <ButtonText style={[a.text_md]}>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
      {isOctober() && (
        <Button
          label={l`Add a witch hat to your avatar`}
          accessibilityHint={l`Choose an avatar photo first, then position the witch hat`}
          onPress={() => witchHatControl.open()}
          disabled={!userAvatar || isUpdatingProfile}
          size="tiny"
          color="secondary"
          style={[
            getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
          ]}
          testID="editProfileWitchHatBtn">
          <ButtonText>+</ButtonText>
          <Logo allowVariants={false} width={18} height={18} />
        </Button>
      )}
    </View>
  )

  const saveButton = useCallback(
    () => (
      <Button
        label={l`Save`}
        onPress={onPressSave}
        disabled={
          !dirty ||
          isUpdatingProfile ||
          displayNameTooLong ||
          descriptionTooLong
        }
        size="small"
        color="primary"
        variant="ghost"
        style={[
          getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
        ]}
        testID="editProfileSaveBtn">
        <ButtonText style={[a.text_md, !dirty && t.atoms.text_contrast_low]}>
          <Trans>Save</Trans>
        </ButtonText>
        {isUpdatingProfile && <ButtonIcon icon={Loader} />}
      </Button>
    ),
    [
      l,
      t,
      dirty,
      onPressSave,
      isUpdatingProfile,
      displayNameTooLong,
      descriptionTooLong,
      enableSquareButtons,
    ],
  )

  return (
    <Dialog.ScrollableInner
      label={l`Edit profile`}
      scrollEnabled={!isDraggingLinks}
      style={[a.overflow_hidden]}
      contentContainerStyle={[a.px_0, a.pt_0]}
      header={
        <Dialog.Header style={a.px_sm}>
          {cancelButton()}
          <Dialog.HeaderText style={[a.flex_1, a.px_sm]}>
            <Trans>Edit profile</Trans>
          </Dialog.HeaderText>
          {saveButton()}
        </Dialog.Header>
      }>
      <View style={[a.relative]}>
        <UserBanner banner={userBanner} onSelectNewBanner={onSelectNewBanner} />
        <View
          style={[
            a.absolute,
            {
              top: 80,
              left: 20,
              width: 84,
              height: 84,
              borderWidth: 2,
              borderRadius: enableSquareAvatars
                ? getSquareAvatarRadius(80, enableSquareAvatars) +
                  (enableSquareAvatars === 'sharp' ? 0 : 2)
                : 42,
              borderColor: t.atoms.bg.backgroundColor,
            },
          ]}>
          <EditableUserAvatar
            size={80}
            avatar={userAvatar}
            onSelectNewAvatar={onSelectNewAvatar}
          />
        </View>
      </View>
      {isUpdateProfileError && (
        <View style={[a.mt_xl]}>
          <ErrorMessage message={cleanError(updateProfileError)} />
        </View>
      )}
      {imageError !== '' && (
        <View style={[a.mt_xl]}>
          <ErrorMessage message={imageError} />
        </View>
      )}
      <View style={[a.mt_4xl, a.px_xl, a.gap_xl]}>
        <View>
          <TextField.LabelText>
            <Trans>Display name</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={displayNameTooLong}>
            <Dialog.Input
              value={displayName}
              onChangeText={setDisplayName}
              label={l`Display name`}
              placeholder={l`e.g. Alice Lastname`}
              testID="editProfileDisplayNameInput"
            />
          </TextField.Root>
          {displayNameTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={MAX_DISPLAY_NAME}
                other="Display name is too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        {verification.isVerified &&
          verification.role === 'default' &&
          displayName !== initialDisplayName && (
            <Admonition type="error">
              <Trans>
                You are verified. You will lose your verification status if you
                change your display name.{' '}
                <InlineLinkText
                  label={l({
                    message: `Learn more`,
                    context: `english-only-resource`,
                  })}
                  to={urls.website.blog.initialVerificationAnnouncement}>
                  <Trans context="english-only-resource">Learn more.</Trans>
                </InlineLinkText>
              </Trans>
            </Admonition>
          )}

        <View>
          <TextField.LabelText>
            <Trans>Description</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={descriptionTooLong}>
            <Dialog.Input
              value={description}
              onChangeText={setDescription}
              multiline
              label={l`Description`}
              placeholder={l`Tell us a bit about yourself`}
              testID="editProfileDescriptionInput"
            />
          </TextField.Root>
          {descriptionTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={MAX_DESCRIPTION}
                other="Description is too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Pronouns</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={pronounsTooLong}>
            <Dialog.Input
              defaultValue={pronouns}
              onChangeText={setPronouns}
              label={l`Pronouns`}
              placeholder={l`e.g. she/her`}
              testID="editProfilePronounsInput"
            />
          </TextField.Root>
          {pronounsTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={PRONOUNS_MAX_GRAPHEMES}
                other="The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        {linksEnabled && links && (
          <ProfileLinksEditor
            did={profile.did}
            links={links}
            onChange={setEditedLinks}
            legacyWebsite={websiteTransferred ? undefined : profile.website}
            websiteTransferReady={isPresented}
            onWebsiteTransferred={() => setWebsiteTransferred(true)}
            onDragStateChange={dragging => {
              setIsDraggingLinks(dragging)
              if (dragging) {
                sheetDragWasDisabled.current = control.disableDrag
                control.setDisableDrag(true)
              } else {
                control.setDisableDrag(sheetDragWasDisabled.current)
              }
            }}
          />
        )}
      </View>
      {isOctober() && userAvatar && (
        <WitchHatEditor
          avatar={userAvatar}
          control={witchHatControl}
          onSave={onSelectNewAvatar}
        />
      )}
    </Dialog.ScrollableInner>
  )
}

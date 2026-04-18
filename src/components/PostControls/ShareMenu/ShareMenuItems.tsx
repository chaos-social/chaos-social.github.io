import {memo, useMemo} from 'react'
import * as ExpoClipboard from 'expo-clipboard'
import {AtUri} from '@atproto/api'
import {isIOS} from '@bsky.app/alf'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {makeProfileLink} from '#/lib/routes/links'
import {type NavigationProp} from '#/lib/routes/types'
import {shareText, shareUrl} from '#/lib/sharing'
import {toShareUrl, toShareUrlBsky} from '#/lib/strings/url-helpers'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useShowExternalShareButtons} from '#/state/preferences/external-share-buttons'
import {precachePost} from '#/state/queries/post'
import {useSession} from '#/state/session'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {useDialogControl} from '#/components/Dialog'
import {SendViaChatDialog} from '#/components/dms/dialogs/ShareViaChatDialog'
import {ArrowOutOfBoxModified_Stroke2_Corner2_Rounded as ArrowOutOfBoxIcon} from '#/components/icons/ArrowOutOfBox'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {Clipboard_Stroke2_Corner2_Rounded as ClipboardIcon} from '#/components/icons/Clipboard'
import {PaperPlane_Stroke2_Corner0_Rounded as PaperPlaneIcon} from '#/components/icons/PaperPlane'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as ExternalIcon} from '#/components/icons/SquareArrowTopRight'
import * as Menu from '#/components/Menu'
import * as Toast from '#/components/Toast'
import {useAgeAssurance} from '#/ageAssurance'
import {useAnalytics} from '#/analytics'
import {IS_IOS} from '#/env'
import {useDevMode} from '#/storage/hooks/dev-mode'
import {RecentChats} from './RecentChats'
import {type ShareMenuItemsProps} from './ShareMenuItems.types'

let ShareMenuItems = ({
  post,
  onShare: onShareProp,
}: ShareMenuItemsProps): React.ReactNode => {
  const ax = useAnalytics()
  const {hasSession} = useSession()
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const sendViaChatControl = useDialogControl()
  const [devModeEnabled] = useDevMode()
  const aa = useAgeAssurance()
  const openLink = useOpenLink()
  const queryClient = useQueryClient()

  const postUri = post.uri
  const postAuthor = useProfileShadow(post.author)

  const href = useMemo(() => {
    const urip = new AtUri(postUri)
    return makeProfileLink(postAuthor, 'post', urip.rkey)
  }, [postUri, postAuthor])

  const hideInPWI = useMemo(() => {
    return !!postAuthor.labels?.find(
      label => label.val === '!no-unauthenticated',
    )
  }, [postAuthor])

  const onSharePost = () => {
    ax.metric('share:press:nativeShare', {})
    const url = toShareUrl(href)
    shareUrl(url)
    onShareProp()
  }

  const onSharePostBsky = () => {
    ax.metric('share:press:nativeShare', {})
    const url = toShareUrlBsky(href)
    shareUrl(url)
    onShareProp()
  }

  const onCopyLink = async () => {
    ax.metric('share:press:copyLink', {})
    const url = toShareUrl(href)
    if (IS_IOS) {
      // iOS only
      await ExpoClipboard.setUrlAsync(url)
    } else {
      await ExpoClipboard.setStringAsync(url)
    }
    Toast.show(_(msg`Copied to clipboard`), {
      type: 'success',
    })
    onShareProp()
  }

  const onCopyLinkBsky = async () => {
    ax.metric('share:press:copyLink', {})
    const url = toShareUrlBsky(href)
    if (isIOS) {
      // iOS only
      await ExpoClipboard.setUrlAsync(url)
    } else {
      await ExpoClipboard.setStringAsync(url)
    }
    Toast.show(_(msg`Copied to clipboard`), {
      type: 'success',
    })
    onShareProp()
  }

  const onBeforeShareViaChat = () => {
    precachePost(queryClient, postUri, post)
  }

  const onSelectChatToShareTo = (conversation: string) => {
    onBeforeShareViaChat()
    navigation.navigate('MessagesConversation', {
      conversation,
      embed: postUri,
    })
  }

  const onShareATURI = () => {
    shareText(postUri)
  }

  const onShareAuthorDID = () => {
    shareText(postAuthor.did)
  }

  const showExternalShareButtons = useShowExternalShareButtons()
  const isBridgedPost =
    !!post.record.bridgyOriginalUrl || !!post.record.fediverseId
  const originalPostUrl = (post.record.bridgyOriginalUrl ||
    post.record.fediverseId) as string | undefined

  const onOpenOriginalPost = () => {
    if (originalPostUrl) {
      openLink(originalPostUrl, true)
    }
  }

  const onOpenPostInPdsls = () => {
    openLink(`https://pdsls.dev/${post.uri}`, true)
  }

  return (
    <>
      <Menu.Outer>
        {hasSession && aa.state.access === aa.Access.Full && (
          <Menu.Group>
            <Menu.ContainerItem>
              <RecentChats
                postUri={postUri}
                onBeforePress={onBeforeShareViaChat}
              />
            </Menu.ContainerItem>
            <Menu.Item
              testID="postDropdownSendViaDMBtn"
              label={_(msg`Send via direct message`)}
              onPress={() => {
                ax.metric('share:press:openDmSearch', {})
                sendViaChatControl.open()
              }}>
              <Menu.ItemText>
                <Trans>Send via direct message</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={PaperPlaneIcon} position="right" />
            </Menu.Item>
          </Menu.Group>
        )}

        {showExternalShareButtons && (
          <Menu.Group>
            {isBridgedPost && (
              <Menu.Item
                testID="postDropdownOpenOriginalPost"
                label={_(msg`Open original post`)}
                onPress={onOpenOriginalPost}>
                <Menu.ItemText>
                  <Trans>Open original post</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={ExternalIcon} position="right" />
              </Menu.Item>
            )}

            <Menu.Item
              testID="postDropdownOpenInPdsls"
              label={_(msg`Open post in PDSls`)}
              onPress={onOpenPostInPdsls}>
              <Menu.ItemText>
                <Trans>Open post in PDSls</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={ExternalIcon} position="right" />
            </Menu.Item>
          </Menu.Group>
        )}

        <Menu.Group>
          <Menu.Item
            testID="postDropdownShareBtn"
            label={_(msg`Share via...`)}
            onPress={onSharePost}>
            <Menu.ItemText>
              <Trans>Share via...</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={ArrowOutOfBoxIcon} position="right" />
          </Menu.Item>

          <Menu.Item
            testID="postDropdownShareBtn"
            label={_(msg`Share via bsky.app...`)}
            onPress={onSharePostBsky}>
            <Menu.ItemText>
              <Trans>Share via bsky.app...</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={ArrowOutOfBoxIcon} position="right" />
          </Menu.Item>

          <Menu.Item
            testID="postDropdownShareBtn"
            label={_(msg`Copy link to post`)}
            onPress={onCopyLink}>
            <Menu.ItemText>
              <Trans>Copy link to post</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={ChainLinkIcon} position="right" />
          </Menu.Item>

          <Menu.Item
            testID="postDropdownShareBtn"
            label={_(msg`Copy via bsky.app`)}
            onPress={onCopyLinkBsky}>
            <Menu.ItemText>
              <Trans>Copy via bsky.app</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={ChainLinkIcon} position="right" />
          </Menu.Item>
        </Menu.Group>

        {hideInPWI && (
          <Menu.Group>
            <Menu.ContainerItem>
              <Admonition
                type="warning"
                style={[a.flex_1, a.border_0, a.p_0, a.bg_transparent]}>
                <Trans>This post is only visible to logged-in users.</Trans>
              </Admonition>
            </Menu.ContainerItem>
          </Menu.Group>
        )}

        {devModeEnabled && (
          <Menu.Group>
            <Menu.Item
              testID="postAtUriShareBtn"
              label={_(msg`Share post at:// URI`)}
              onPress={onShareATURI}>
              <Menu.ItemText>
                <Trans>Share post at:// URI</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={ClipboardIcon} position="right" />
            </Menu.Item>
            <Menu.Item
              testID="postAuthorDIDShareBtn"
              label={_(msg`Share author DID`)}
              onPress={onShareAuthorDID}>
              <Menu.ItemText>
                <Trans>Share author DID</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={ClipboardIcon} position="right" />
            </Menu.Item>
          </Menu.Group>
        )}
      </Menu.Outer>

      <SendViaChatDialog
        control={sendViaChatControl}
        onSelectChat={onSelectChatToShareTo}
      />
    </>
  )
}
ShareMenuItems = memo(ShareMenuItems)
export {ShareMenuItems}

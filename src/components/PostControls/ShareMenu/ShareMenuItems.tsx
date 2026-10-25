import {memo, useMemo, useRef} from 'react'
import * as ExpoClipboard from 'expo-clipboard'
import {AtUri} from '@atproto/syntax'
import {isIOS} from '@bsky.app/alf'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {makeProfileLink} from '#/lib/routes/links'
import {type NavigationProp} from '#/lib/routes/types'
import {shareUrl, simpleShareText} from '#/lib/sharing'
import {toShareUrl, toShareUrlBsky} from '#/lib/strings/url-helpers'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {
  toAtprotoExplorerUrl,
  useAtprotoExplorer,
} from '#/state/preferences/atproto-explorer'
import {precachePost} from '#/state/queries/post'
import {useSession} from '#/state/session'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {useDialogControl} from '#/components/Dialog'
import {SendViaChatDialog} from '#/components/dms/dialogs/ShareViaChatDialog'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Clipboard_Stroke2_Corner2_Rounded as ClipboardIcon} from '#/components/icons/Clipboard'
import {PaperPlane_Stroke2_Corner0_Rounded as PaperPlaneIcon} from '#/components/icons/PaperPlane'
import {BlueskyIcon} from '#/components/icons/services/Bluesky'
import {PDSlsIcon} from '#/components/icons/services/PDSls'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as ExternalIcon} from '#/components/icons/SquareArrowTopRight'
import * as Menu from '#/components/Menu'
import {CheckboxItemText} from '#/components/Menu/CheckboxItem'
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
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const sendViaChatControl = useDialogControl()
  const [devModeEnabled] = useDevMode()
  const aa = useAgeAssurance()
  const openLink = useOpenLink()
  const queryClient = useQueryClient()
  const copyLinksRef = useRef(false)
  const atprotoExplorer = useAtprotoExplorer()

  const postUri = post.uri
  const atprotoExplorerUrl = toAtprotoExplorerUrl(atprotoExplorer, postUri)
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

  const onSharePostBsky = () => {
    ax.metric('share:press:nativeShare', {})
    const url = toShareUrlBsky(href)
    void shareUrl(url).then(result => {
      if (!result) return
      ax.metric('share:nativeShare:result', {
        uri: postUri,
        authorDid: postAuthor.did,
        entryPoint: 'ShareMenu',
        ...result,
      })
    })
    onShareProp()
  }

  const onCopyLink = async () => {
    ax.metric('share:press:copyLink', {uri: postUri})
    const url = toShareUrl(href)
    if (IS_IOS) {
      // iOS only
      await ExpoClipboard.setUrlAsync(url)
    } else {
      await ExpoClipboard.setStringAsync(url)
    }
    Toast.show(l`Copied to clipboard`, {
      type: 'success',
    })
    onShareProp()
  }

  const onCopyLinkBsky = async () => {
    ax.metric('share:press:copyLink', {uri: postUri})
    const url = toShareUrlBsky(href)
    if (isIOS) {
      // iOS only
      await ExpoClipboard.setUrlAsync(url)
    } else {
      await ExpoClipboard.setStringAsync(url)
    }
    Toast.show(l`Copied to clipboard`, {
      type: 'success',
    })
    onShareProp()
  }

  const onSharePostInAtprotoExplorer = () => {
    void shareUrl(atprotoExplorerUrl)
    onShareProp()
  }

  const onCopyAtprotoExplorerLink = async () => {
    if (isIOS) {
      await ExpoClipboard.setUrlAsync(atprotoExplorerUrl)
    } else {
      await ExpoClipboard.setStringAsync(atprotoExplorerUrl)
    }
    Toast.show(l`Copied to clipboard`, {
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
    void simpleShareText(postUri)
  }

  const onShareAuthorDID = () => {
    void simpleShareText(postAuthor.did)
  }

  const isBridgedPost =
    !!post.record.bridgyOriginalUrl || !!post.record.fediverseId
  const originalPostUrl = (post.record.bridgyOriginalUrl ||
    post.record.fediverseId) as string | undefined

  const onOpenOriginalPost = () => {
    if (originalPostUrl) {
      openLink(originalPostUrl)
    }
  }

  const onOpenPostInAtprotoExplorer = () => {
    openLink(toAtprotoExplorerUrl(atprotoExplorer, post.uri))
  }

  const onOpenPostInSkythread = () => {
    openLink(
      `https://skythread.mackuba.eu/?q=${encodeURIComponent(
        toShareUrlBsky(href),
      )}`,
    )
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
              label={l`Send via chat`}
              onPress={() => {
                ax.metric('share:press:openDmSearch', {})
                sendViaChatControl.open()
              }}>
              <Menu.ItemText>
                <Trans>Send via chat</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={PaperPlaneIcon} position="right" />
            </Menu.Item>
          </Menu.Group>
        )}

        <Menu.Group>
          <Menu.Item
            testID="postDropdownCopyLinkBtn"
            label={l`Copy link to post`}
            onPress={onCopyLink}>
            <Menu.ItemText>
              <Trans>Copy link to post</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={ChainLinkIcon} position="right" />
          </Menu.Item>

          <Menu.Submenu
            label={l`Share link`}
            trigger={
              <>
                <Menu.ItemIcon icon={ShareIcon} />
                <Menu.ItemText>
                  <Trans>Share link</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={ChevronRightIcon} position="right" />
              </>
            }>
            <Menu.Group>
              <Menu.Item
                testID="postDropdownShareBlueskyBtn"
                label={l`Bluesky`}
                onPress={() => {
                  if (copyLinksRef.current) {
                    void onCopyLinkBsky()
                  } else {
                    onSharePostBsky()
                  }
                }}>
                <Menu.ItemText>
                  <Trans>Bluesky</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={BlueskyIcon} position="right" />
              </Menu.Item>
              <Menu.Item
                testID="postDropdownShareAtprotoExplorerBtn"
                label={atprotoExplorer.name}
                onPress={() => {
                  if (copyLinksRef.current) {
                    void onCopyAtprotoExplorerLink()
                  } else {
                    onSharePostInAtprotoExplorer()
                  }
                }}>
                <Menu.ItemText>{atprotoExplorer.name}</Menu.ItemText>
                <Menu.ItemIcon
                  icon={
                    atprotoExplorer.name === 'PDSls' ? PDSlsIcon : ChainLinkIcon
                  }
                  position="right"
                />
              </Menu.Item>
              <Menu.ContainerItem>
                <CheckboxItemText
                  label={l`Copy instead of opening the share sheet`}
                  initialValue={copyLinksRef.current}
                  onChange={value => {
                    copyLinksRef.current = value
                  }}>
                  <Trans>Copy</Trans>
                </CheckboxItemText>
              </Menu.ContainerItem>
            </Menu.Group>
          </Menu.Submenu>

          <Menu.Submenu
            label={l`Open with`}
            trigger={
              <>
                <Menu.ItemIcon icon={ExternalIcon} />
                <Menu.ItemText>
                  <Trans>Open with</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={ChevronRightIcon} position="right" />
              </>
            }>
            <Menu.Group>
              {isBridgedPost && (
                <Menu.Item
                  testID="postDropdownOpenOriginalPost"
                  label={l`Original post`}
                  onPress={onOpenOriginalPost}>
                  <Menu.ItemText>
                    <Trans>Original post</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={ExternalIcon} position="right" />
                </Menu.Item>
              )}
              <Menu.Item
                testID="postDropdownOpenInAtprotoExplorer"
                label={atprotoExplorer.name}
                onPress={onOpenPostInAtprotoExplorer}>
                <Menu.ItemText>{atprotoExplorer.name}</Menu.ItemText>
                <Menu.ItemIcon
                  icon={
                    atprotoExplorer.name === 'PDSls' ? PDSlsIcon : ChainLinkIcon
                  }
                  position="right"
                />
              </Menu.Item>
              <Menu.Item
                testID="postDropdownOpenInSkythread"
                label={l`Skythread`}
                onPress={onOpenPostInSkythread}>
                <Menu.ItemText>
                  <Trans>Skythread</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={ExternalIcon} position="right" />
              </Menu.Item>
            </Menu.Group>
          </Menu.Submenu>
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
              label={l`Share post at:// URI`}
              onPress={onShareATURI}>
              <Menu.ItemText>
                <Trans>Share post at:// URI</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={ClipboardIcon} position="right" />
            </Menu.Item>
            <Menu.Item
              testID="postAuthorDIDShareBtn"
              label={l`Share author DID`}
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

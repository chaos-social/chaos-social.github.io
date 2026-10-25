import {memo, useMemo} from 'react'
import {AtUri} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

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
import {useSession} from '#/state/session'
import {useBreakpoints} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {EmbedDialog} from '#/components/dialogs/Embed'
import {SendViaChatDialog} from '#/components/dms/dialogs/ShareViaChatDialog'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Clipboard_Stroke2_Corner2_Rounded as ClipboardIcon} from '#/components/icons/Clipboard'
import {CodeBrackets_Stroke2_Corner0_Rounded as CodeBracketsIcon} from '#/components/icons/CodeBrackets'
import {PaperPlane_Stroke2_Corner0_Rounded as Send} from '#/components/icons/PaperPlane'
import {BlueskyIcon} from '#/components/icons/services/Bluesky'
import {PDSlsIcon} from '#/components/icons/services/PDSls'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as ExternalIcon} from '#/components/icons/SquareArrowTopRight'
import * as Menu from '#/components/Menu'
import {useAgeAssurance} from '#/ageAssurance'
import {useAnalytics} from '#/analytics'
import {IS_WEB} from '#/env'
import {useDevMode} from '#/storage/hooks/dev-mode'
import {type ShareMenuItemsProps} from './ShareMenuItems.types'

let ShareMenuItems = ({
  post,
  record,
  timestamp,
  onShare: onShareProp,
}: ShareMenuItemsProps): React.ReactNode => {
  const ax = useAnalytics()
  const {hasSession} = useSession()
  const {gtMobile} = useBreakpoints()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const embedPostControl = useDialogControl()
  const sendViaChatControl = useDialogControl()
  const [devModeEnabled] = useDevMode()
  const aa = useAgeAssurance()
  const openLink = useOpenLink()
  const atprotoExplorer = useAtprotoExplorer()

  const postUri = post.uri
  const atprotoExplorerUrl = toAtprotoExplorerUrl(atprotoExplorer, postUri)
  const postCid = post.cid
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

  const onCopyLink = () => {
    ax.metric('share:press:copyLink', {uri: postUri})
    const url = toShareUrl(href)
    void shareUrl(url)
    onShareProp()
  }

  const onCopyLinkBsky = () => {
    ax.metric('share:press:copyLink', {uri: postUri})
    const url = toShareUrlBsky(href)
    void shareUrl(url)
    onShareProp()
  }

  const onCopyAtprotoExplorerLink = () => {
    void shareUrl(atprotoExplorerUrl)
    onShareProp()
  }

  const onSelectChatToShareTo = (conversation: string) => {
    ax.metric('share:press:dmSelected', {uri: postUri})
    navigation.navigate('MessagesConversation', {
      conversation,
      embed: postUri,
    })
  }

  const canEmbed = IS_WEB && gtMobile && !hideInPWI

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
            <Menu.Item
              testID="postDropdownShareBlueskyBtn"
              label={l`Bluesky`}
              onPress={onCopyLinkBsky}>
              <Menu.ItemText>
                <Trans>Bluesky</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={BlueskyIcon} position="right" />
            </Menu.Item>
            <Menu.Item
              testID="postDropdownShareAtprotoExplorerBtn"
              label={atprotoExplorer.name}
              onPress={onCopyAtprotoExplorerLink}>
              <Menu.ItemText>{atprotoExplorer.name}</Menu.ItemText>
              <Menu.ItemIcon
                icon={
                  atprotoExplorer.name === 'PDSls' ? PDSlsIcon : ChainLinkIcon
                }
                position="right"
              />
            </Menu.Item>
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
          </Menu.Submenu>
        </Menu.Group>

        {hasSession && aa.state.access === aa.Access.Full && (
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
            <Menu.ItemIcon icon={Send} position="right" />
          </Menu.Item>
        )}

        {canEmbed && (
          <Menu.Item
            testID="postDropdownEmbedBtn"
            label={l`Embed post`}
            onPress={() => {
              ax.metric('share:press:embed', {uri: postUri})
              embedPostControl.open()
            }}>
            <Menu.ItemText>{l`Embed post`}</Menu.ItemText>
            <Menu.ItemIcon icon={CodeBracketsIcon} position="right" />
          </Menu.Item>
        )}

        {false && hideInPWI && (
          <>
            {hasSession && <Menu.Divider />}
            <Menu.LabelText style={{maxWidth: 220}}>
              <Trans>Note: This post is only visible to logged-in users.</Trans>
            </Menu.LabelText>
          </>
        )}

        {devModeEnabled && (
          <>
            <Menu.Divider />
            <Menu.Item
              testID="postAtUriShareBtn"
              label={l`Copy post at:// URI`}
              onPress={onShareATURI}>
              <Menu.ItemText>
                <Trans>Copy post at:// URI</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={ClipboardIcon} position="right" />
            </Menu.Item>
            <Menu.Item
              testID="postAuthorDIDShareBtn"
              label={l`Copy author DID`}
              onPress={onShareAuthorDID}>
              <Menu.ItemText>
                <Trans>Copy author DID</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={ClipboardIcon} position="right" />
            </Menu.Item>
          </>
        )}
      </Menu.Outer>
      {canEmbed && (
        <EmbedDialog
          control={embedPostControl}
          postCid={postCid}
          postUri={postUri}
          record={record}
          postAuthor={postAuthor}
          timestamp={timestamp}
        />
      )}
      <SendViaChatDialog
        control={sendViaChatControl}
        onSelectChat={onSelectChatToShareTo}
      />
    </>
  )
}
ShareMenuItems = memo(ShareMenuItems)
export {ShareMenuItems}

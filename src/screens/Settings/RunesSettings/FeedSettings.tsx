import {Trans, useLingui} from '@lingui/react/macro'

import {
  useDeckLayoutEnabled,
  useSetDeckLayoutEnabled,
} from '#/state/preferences/deck-layout'
import {
  useDisableComposerPrompt,
  useSetDisableComposerPrompt,
} from '#/state/preferences/disable-composer-prompt'
import {
  useDisableInfiniteScroll,
  useSetDisableInfiniteScroll,
} from '#/state/preferences/disable-infinite-scroll'
import {
  useDisableTopOfFeedButton,
  useSetDisableTopOfFeedButton,
} from '#/state/preferences/disable-top-of-feed-button'
import {
  useHideFeedsPromoTab,
  useSetHideFeedsPromoTab,
} from '#/state/preferences/hide-feeds-promo-tab'
import {
  useHideQuotesOfBlockedAccounts,
  useSetHideQuotesOfBlockedAccounts,
} from '#/state/preferences/hide-quotes-of-blocked-accounts'
import {
  useHideUnreplyablePosts,
  useSetHideUnreplyablePosts,
} from '#/state/preferences/hide-unreplyable-posts'
import {
  useNoDiscoverFallback,
  useSetNoDiscoverFallback,
} from '#/state/preferences/no-discover-fallback'
import {
  useSeenPostsSetting,
  useSetSeenPostsEnabled,
} from '#/state/preferences/seen-posts'
import {
  useSetShowAvatarFollowButton,
  useShowAvatarFollowButton,
} from '#/state/preferences/show-avatar-follow-button'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as Toggle from '#/components/forms/Toggle'
import {ArrowTopCircle_Stroke2_Corner0_Rounded as ArrowTopIcon} from '#/components/icons/ArrowTopCircle'
import {BulletList_Stroke2_Corner0_Rounded as BulletListIcon} from '#/components/icons/BulletList'
import {Eye_Stroke2_Corner2_Rounded as EyeIcon} from '#/components/icons/Eye'
import {EyeSlash_Stroke2_Corner0_Rounded as EyeSlashIcon} from '#/components/icons/EyeSlash'
import {PencilLine_Stroke2_Corner2_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {CloseQuote_Stroke2_Corner1_Rounded as QuoteIcon} from '#/components/icons/Quote'
import {Reply_Stroke2_Corner0_Rounded as ReplyIcon} from '#/components/icons/Reply'
import {TimesLarge_Stroke2_Corner0_Rounded as TimesIcon} from '#/components/icons/Times'
import {IS_WEB} from '#/env'
import {RunesScreenLayout} from './components/RunesScreenLayout'

export function RunesUsabilityFeedSettingsScreen() {
  const {t: l} = useLingui()

  const disableInfiniteScroll = useDisableInfiniteScroll()
  const setDisableInfiniteScroll = useSetDisableInfiniteScroll()

  const noDiscoverFallback = useNoDiscoverFallback()
  const setNoDiscoverFallback = useSetNoDiscoverFallback()

  const hideFeedsPromoTab = useHideFeedsPromoTab()
  const setHideFeedsPromoTab = useSetHideFeedsPromoTab()

  const disableComposerPrompt = useDisableComposerPrompt()
  const setDisableComposerPrompt = useSetDisableComposerPrompt()

  const disableTopOfFeedButton = useDisableTopOfFeedButton()
  const setDisableTopOfFeedButton = useSetDisableTopOfFeedButton()

  const showAvatarFollowButton = useShowAvatarFollowButton()
  const setShowAvatarFollowButton = useSetShowAvatarFollowButton()

  const hideUnreplyablePosts = useHideUnreplyablePosts()
  const setHideUnreplyablePosts = useSetHideUnreplyablePosts()

  const seenPostsEnabled = useSeenPostsSetting()
  const setSeenPostsEnabled = useSetSeenPostsEnabled()

  const deckLayoutEnabled = useDeckLayoutEnabled()
  const setDeckLayoutEnabled = useSetDeckLayoutEnabled()

  const hideQuotesOfBlockedAccounts = useHideQuotesOfBlockedAccounts()
  const setHideQuotesOfBlockedAccounts = useSetHideQuotesOfBlockedAccounts()

  return (
    <RunesScreenLayout titleText={l`Feeds`}>
      <Toggle.Item
        name="disable_infinite_scroll"
        label={l`Disable infinite scroll`}
        value={disableInfiniteScroll}
        onChange={setDisableInfiniteScroll}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={TimesIcon} />
          <SettingsList.ItemText>
            <Trans>Disable infinite scroll</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <SettingsList.Item>
        <Admonition type="info" style={[a.flex_1]}>
          <Trans>
            Use pages in feeds, search results, and saved posts. Each new page
            replaces the previous results to reduce memory use.
          </Trans>
        </Admonition>
      </SettingsList.Item>
      <Toggle.Item
        name="no_discover_fallback"
        label={l`Do not fall back to discover feed`}
        value={noDiscoverFallback}
        onChange={value => setNoDiscoverFallback(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={EyeSlashIcon} />
          <SettingsList.ItemText>
            <Trans>Do not fall back to discover feed</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="hide_feeds_promo_tab"
        label={l`Hide "Feeds ✨" tab when only one feed is selected`}
        value={hideFeedsPromoTab}
        onChange={value => setHideFeedsPromoTab(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={EyeIcon} />
          <SettingsList.ItemText>
            <Trans>Hide "Feeds ✨" tab when only one feed is selected</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="disable_composer_prompt"
        label={l`Disable composer prompt`}
        value={disableComposerPrompt}
        onChange={value => setDisableComposerPrompt(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={PencilIcon} />
          <SettingsList.ItemText>
            <Trans>Disable composer prompt</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="disable_top_of_feed_button"
        label={l`Disable top-of-feed button`}
        value={disableTopOfFeedButton ?? false}
        onChange={value => setDisableTopOfFeedButton(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={ArrowTopIcon} />
          <SettingsList.ItemText>
            <Trans>Disable top-of-feed button</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="show_avatar_follow_button"
        label={l`Show plus icon on unfollowed feed avatars`}
        value={showAvatarFollowButton}
        onChange={value => setShowAvatarFollowButton(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={PlusIcon} />
          <SettingsList.ItemText>
            <Trans>Show plus icon on unfollowed feed avatars</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="hide_unreplyable_posts"
        label={l`Hide posts that cannot be replied to from feeds`}
        value={hideUnreplyablePosts}
        onChange={value => setHideUnreplyablePosts(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={ReplyIcon} />
          <SettingsList.ItemText>
            <Trans>Hide posts that cannot be replied to from feeds</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        testID="seenPostsToggle"
        name="seen_posts_enabled"
        label={l`Hide posts you’ve already seen from feeds`}
        value={seenPostsEnabled}
        onChange={value => setSeenPostsEnabled(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={EyeSlashIcon} />
          <SettingsList.ItemText>
            <Trans>Hide posts you’ve already seen from feeds</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <SettingsList.Item>
        <Admonition type="info" style={[a.flex_1]}>
          <Trans>
            Seen posts are stored on this device and listed under “Seen posts”
            in My Feeds.
          </Trans>
        </Admonition>
      </SettingsList.Item>
      {IS_WEB && (
        <Toggle.Item
          testID="deckLayoutToggle"
          name="deck_layout_enabled"
          label={l`Show each feed in its own column`}
          value={deckLayoutEnabled}
          onChange={setDeckLayoutEnabled}>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={BulletListIcon} />
            <SettingsList.ItemText>
              <Trans>Show each feed in its own column</Trans>
            </SettingsList.ItemText>
            <Toggle.Platform />
          </SettingsList.Item>
        </Toggle.Item>
      )}
      <Toggle.Item
        testID="hideQuotesOfBlockedAccountsToggle"
        name="hide_quotes_of_blocked_accounts"
        label={l`Hide posts quoting blocked accounts`}
        value={hideQuotesOfBlockedAccounts}
        onChange={setHideQuotesOfBlockedAccounts}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={QuoteIcon} />
          <SettingsList.ItemText>
            <Trans>Hide posts quoting blocked accounts</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
    </RunesScreenLayout>
  )
}

# Bluemoji

Witchsky displays inline `blue.moji.richtext.facet` emoji, provides a picker for
the composing account's collection and public discovery, and supports
`blue.moji.feed.reaction` reactions. Sticker attachments and packs are not
supported. Selected emoji retain their source owner in drafts, including when
two collections use the same alias.

## Trust boundary

Everything inside someone else's record is self-attested: a facet's `did`,
`name`, `formats`, `alt`, `adultOnly` and labels are whatever the poster's client
wrote, and nothing validates them. So:

- inline emoji render only after `fetchBluemojiItem` reads the
  `blue.moji.collection.item` back from its owner's PDS, and images and labels
  come from that record, never from the facet;
- picker search results are claims too, and only become tappable once the owning
  PDS confirms them;
- reaction `emojiRef`s from moji.blue's AppView are already rebuilt from the
  indexed source item. The Constellation fallback has no AppView, so it
  re-verifies every claimed item against its owner's PDS and drops the ones that
  do not resolve.

## Reactions

`src/features/bluemoji/reactions/` holds the whole feature:

- `queries.ts`: counts, per-post groups, the viewer's own reactions, and
  trending. Counts are asked for per post but fetched in bulk; lookups opened in
  the same tick coalesce into one `getReactionCounts` call, since a feed renders
  many posts at once.
- `constellation.ts`: the fallback for posts the AppView has nothing for. It is
  expensive (one `getRecord` per reactor), so it only runs once the AppView has
  answered with an empty list for a post that is actually on screen.
- `mutations.ts`: ordinary `createRecord`/`deleteRecord` against the user's own
  PDS, mirroring the TOKIMEKI poll vote. `validate: false` because our PDS does
  not know the lexicon.
- `ReactionStrip.tsx`: the row under a post. `ReactionDialog.tsx`: the sheet both
  the strip and the `PostControls` button open.

The AppView only fills in `group.viewer` for a request authenticated as that
actor, and our sessions live with our own OAuth client, so the viewer's own
reactions are read once per account with a `listRecords` walk of their repo
(reaction rkeys are TIDs and cannot be derived). Shortcut: the walk caps at 500
records; past that, the upgrade is an AppView query that takes a DID list.

The web composer extends TipTap 2's Emoji node and renders verified aliases as
inline images. Shortcode autocomplete uses the upstream shared Autocomplete/Sift
menu and emoji search, combining local Unicode matches with verified results
from the composing account's collection. Unicode matches appear while custom
emoji load; arrows, Enter, and Tab select a result, and Escape dismisses the list. Selected sources are saved just like picker
selections. TipTap's default input and paste rules are disabled so the shared
escape-aware conversion handles typing, pasting, and commands consistently.
Arrow keys cross
each image in one step, and deletion removes the whole emoji. Editing, copying,
drafts, character counts, and posting retain the original alias text. Backslashes
follow the same escape rules as other facet syntax: an odd number of backslashes
before an alias disables its facet; escaped Markdown and angle brackets also
protect aliases inside them. Source resolution happens before removing escapes
so posting cannot re-enable an escaped emoji.

The native composer keeps source aliases in React state and projects verified
emoji into single full-width input slots. The native input draws text, the cursor,
and selection. A zero-size native observer anchors sibling image views to the
input's current character positions without laying out the composer or its
children. React Native controls the container, input size, and multiline growth.
Android updates before drawing; iOS uses
UIKit's character rectangles. Native edit ranges move and remove anchors without
waiting for JavaScript, and stale JS snapshots cannot rewind those positions.
No hidden text or asynchronous JS measurement layers are needed. Source verification,
escaping, drafts, and posting remain shared with the web composer.

Images and descriptions come from the owning PDS's verified collection record,
never from unverified facet claims or search results. Asset URLs use the verified
blob CID through moji.blue. Source alt text labels the image; empty descriptions
fall back to the emoji name. Clicking an emoji opens a compact popup showing its
name and source description. Native details use a bottom sheet and are enabled
only on the focused post; feed and reply-row emoji remain ordinary inline images. Hidden, warned, missing, or unsupported emoji remain
readable as aliases. Animation follows the autoplay preference.

Canonical references derive record keys using NFC normalization and RFC 0005
punycode. Historical collections with unrelated record keys carry an optional
strong reference extension on the facet. Posting writes CID-based v1 formats;
reading supports v0 and v1. The collection fallback schema permits one grapheme
rather than one byte, since actual fallback emoji contain multibyte characters.

Inline images match the surrounding emoji font metrics on web. Native posts use
a measured Unicode emoji advance and descender to size and align image attachments,
including both the app's font scale and the system's accessibility font scale.
Short emoji-only
posts enlarge both Unicode emoji and Bluemoji using the existing post sizing rule.
The feature schemas cover collection items, listing, search, and rich-text facets.

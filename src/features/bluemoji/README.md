# Bluemoji

Witchsky displays inline `blue.moji.richtext.facet` emoji and provides a picker
for the composing account's collection and public discovery. Sticker attachments
are not supported. Selected emoji retain their source owner in drafts, including
when two collections use the same alias.

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

Images and descriptions come from the owning PDS's verified collection record,
never from unverified facet claims or search results. Asset URLs use the verified
blob CID through moji.blue. Source alt text labels the image; empty descriptions
fall back to the emoji name. Clicking an emoji opens a compact popup showing its
name and source description. Hidden, warned, missing, or unsupported emoji remain
readable as aliases. Animation follows the autoplay preference.

Canonical references derive record keys using NFC normalization and RFC 0005
punycode. Historical collections with unrelated record keys carry an optional
strong reference extension on the facet. Posting writes CID-based v1 formats;
reading supports v0 and v1. The collection fallback schema permits one grapheme
rather than one byte, since actual fallback emoji contain multibyte characters.

Inline images match the surrounding emoji font metrics on web. Short emoji-only
posts enlarge both Unicode emoji and Bluemoji using the existing post sizing rule.
The feature schemas cover collection items, listing, search, and rich-text facets.

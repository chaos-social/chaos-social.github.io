import {type BlobRef} from '@atproto/lex'

export type ProfileLink = {
  url: string
  title?: string
  /**
   * The site's favicon or an uploaded icon, stored on the user's PDS so it
   * goes through blob scanning like any other profile image.
   */
  icon?: BlobRef
  /**
   * The icon's image URL, as returned in profile views. For an icon that was
   * just selected or fetched and isn't saved yet, a local preview URI.
   */
  iconUrl?: string
  /** The `app.bsky.actor.link` record, once the link has been saved. */
  uri?: string
  cid?: string
}

export const MAX_PROFILE_LINKS = 10

/** Keeps a pill from swallowing the whole row. */
export const MAX_TITLE_LENGTH = 30

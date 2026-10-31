import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {type BlobRef} from '@atproto/api'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {postUriToRelativePath, toBskyAppUrl} from '#/lib/strings/url-helpers'
import {purgeTemporaryImageFiles} from '#/state/gallery'
import {
  precacheResolveLinkQuery,
  RQKEY_GIF_ROOT,
  RQKEY_LINK_ROOT,
} from '#/state/queries/resolve-link'
import {useSession} from '#/state/session'
import {clearRecovery, readRecovery} from '#/state/shell/composer/recovery'
import {type Recovery} from '#/state/shell/composer/recovery/codec'
import {type ComposerState} from '#/view/com/composer/state/composer'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {type app} from '#/lexicons'

export interface ComposerOptsPostRef {
  uri: string
  cid: string
  text: string
  langs?: string[]
  author: app.bsky.actor.defs.ProfileViewBasic
  embed?: app.bsky.feed.defs.PostView['embed']
  moderation?: ModerationDecision
}

export type OnPostSuccessData =
  | {
      replyToUri?: string
      posts: app.bsky.unspecced.getPostThreadV2.ThreadItem[]
    }
  | undefined

export type ComposerLogContext =
  'Fab' | 'PostReply' | 'QuotePost' | 'ProfileFeed' | 'Deeplink' | 'Other'

export interface ComposerOpts {
  /** Local composition restored after an account switch or native app termination. */
  recoveredState?: ComposerState

  /** Open the account picker when the composer mounts. */
  openAccountSwitcher?: boolean
  activeAccountDid?: string
  replyTo?: ComposerOptsPostRef
  onPost?: (postUri: string | undefined, data?: OnPostSuccessData) => void
  onPostSuccess?: (data: OnPostSuccessData) => void
  quote?: app.bsky.feed.defs.PostView
  mention?: string // handle of user to mention
  text?: string
  /**
   * Outline tags from `app.bsky.feed.post` `tags` (e.g. when redrafting).
   */
  tags?: string[]
  imageUris?: {
    uri: string
    width: number
    height: number
    altText?: string
    blobRef?: BlobRef
  }[]
  videoUri?: {
    ownerDid?: string
    captions?: {lang: string; file: File}[]
    originalCaptions?: app.bsky.embed.video.Caption[]
    uri: string
    width: number
    height: number
    blobRef?: BlobRef
    altText?: string
  }
  openGallery?: boolean
  logContext?: ComposerLogContext
}

type ComposerTarget = Pick<ComposerOpts, 'replyTo' | 'quote'>
type StateContext =
  (ComposerOpts & {isMinimized?: boolean; target?: ComposerTarget}) | undefined
type ControlsContext = {
  openComposer: (opts: ComposerOpts) => void
  closeComposer: (opts?: {includeMinimized?: boolean}) => boolean
  minimizeComposer: () => void
  restoreComposer: () => void
}

const stateContext = createContext<StateContext>(undefined)
stateContext.displayName = 'ComposerStateContext'
const controlsContext = createContext<ControlsContext>({
  openComposer(_opts: ComposerOpts) {},
  closeComposer() {
    return false
  },
  minimizeComposer() {},
  restoreComposer() {},
})
controlsContext.displayName = 'ComposerControlsContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const {t: l} = useLingui()
  const switchControl = Prompt.usePromptControl()
  const [pendingTarget, setPendingTarget] = useState<{
    opts: ComposerOpts
    session: NonNullable<StateContext>
  }>()
  const {currentAccount, accounts} = useSession()
  const [recovery] = useState<
    Recovery | Promise<Recovery | undefined> | undefined
  >(() => (currentAccount ? readRecovery(currentAccount.did) : undefined))
  const recoveryCancelled = useRef(false)
  const [state, setState] = useState<StateContext>(() => {
    if (
      !recovery ||
      recovery instanceof Promise ||
      !accounts.some(a => a.did === recovery.opts.activeAccountDid)
    ) {
      return undefined
    }
    return {...recovery.opts, recoveredState: recovery.state}
  })
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!(recovery instanceof Promise)) return
    let cancelled = false
    void recovery.then(restored => {
      if (
        cancelled ||
        recoveryCancelled.current ||
        !restored ||
        !accounts.some(
          account => account.did === restored.opts.activeAccountDid,
        )
      ) {
        return
      }
      setState(
        previous =>
          previous ?? {...restored.opts, recoveredState: restored.state},
      )
    })
    return () => {
      cancelled = true
    }
  }, [recovery, accounts])

  const openComposer = useNonReactiveCallback((opts: ComposerOpts) => {
    recoveryCancelled.current = true
    if (opts.quote) {
      const path = postUriToRelativePath(opts.quote.uri)
      if (path) {
        const appUrl = toBskyAppUrl(path)
        precacheResolveLinkQuery(queryClient, appUrl, {
          type: 'record',
          kind: 'post',
          record: {
            cid: opts.quote.cid,
            uri: opts.quote.uri,
          },
          view: opts.quote,
        })
      }
    }
    const author = opts.replyTo?.author || opts.quote?.author
    const isBlocked = Boolean(
      author &&
      (author.viewer?.blocking ||
        author.viewer?.blockedBy ||
        author.viewer?.blockingByList),
    )
    if (isBlocked) {
      Toast.show(l`Cannot interact with a blocked user`, {
        type: 'warning',
      })
    } else {
      if (state) {
        if (state.isMinimized && (opts.replyTo || opts.quote)) {
          setPendingTarget({opts, session: state})
          switchControl.open()
        } else {
          setState({...state, isMinimized: false})
        }
        return
      }
      setState(prevOpts => {
        if (prevOpts) {
          // Never replace an already open composer.
          return prevOpts
        }
        return opts
      })
    }
  })

  const closeComposer = useNonReactiveCallback(
    (opts?: {includeMinimized?: boolean}) => {
      let wasOpen = !!state && (!state.isMinimized || !!opts?.includeMinimized)
      if (wasOpen) {
        recoveryCancelled.current = true
        setState(undefined)
        if (currentAccount) clearRecovery(currentAccount.did)
        void purgeTemporaryImageFiles()
        // Purging deletes cached thumbnails on disk, so remove the query
        // caches that may hold references to those now-deleted file paths.
        // Without this, restoring a draft would serve stale ResolvedLink
        // data pointing at missing files, causing "Failed to load blob".
        queryClient.removeQueries({queryKey: [RQKEY_LINK_ROOT]})
        queryClient.removeQueries({queryKey: [RQKEY_GIF_ROOT]})
      }

      return wasOpen
    },
  )

  const minimizeComposer = useNonReactiveCallback(() => {
    setState(previous =>
      previous
        ? {
            ...previous,
            isMinimized: true,
            openGallery: false,
            openAccountSwitcher: false,
          }
        : previous,
    )
  })

  const restoreComposer = useNonReactiveCallback(() => {
    setState(previous =>
      previous ? {...previous, isMinimized: false} : previous,
    )
  })

  const api = useMemo(
    () => ({
      openComposer,
      closeComposer,
      minimizeComposer,
      restoreComposer,
    }),
    [openComposer, closeComposer, minimizeComposer, restoreComposer],
  )

  return (
    <stateContext.Provider value={state}>
      <controlsContext.Provider value={api}>
        {children}
        <Prompt.Basic
          control={switchControl}
          title={
            pendingTarget?.opts.replyTo
              ? l`Reply to this post?`
              : l`Quote this post?`
          }
          description={l`Your minimized post will stay the same, besides any current reply or quote, which will be replaced.`}
          confirmButtonCta={
            pendingTarget?.opts.replyTo
              ? l`Switch to reply`
              : l`Switch to quote`
          }
          onClose={() => setPendingTarget(undefined)}
          onConfirm={() => {
            if (!pendingTarget) return
            const {opts, session} = pendingTarget
            setState(previous =>
              previous === session
                ? {
                    ...previous,
                    replyTo: opts.replyTo,
                    quote: opts.quote,
                    onPost: opts.onPost,
                    onPostSuccess: opts.onPostSuccess,
                    logContext: opts.logContext,
                    target: {replyTo: opts.replyTo, quote: opts.quote},
                    isMinimized: false,
                  }
                : previous,
            )
          }}
        />
      </controlsContext.Provider>
    </stateContext.Provider>
  )
}

export function useComposerState() {
  return useContext(stateContext)
}

export function useComposerControls() {
  const {closeComposer, minimizeComposer, restoreComposer} =
    useContext(controlsContext)
  return useMemo(
    () => ({closeComposer, minimizeComposer, restoreComposer}),
    [closeComposer, minimizeComposer, restoreComposer],
  )
}

/**
 * DO NOT USE DIRECTLY. The deprecation notice as a warning only, it's not
 * actually deprecated.
 *
 * @deprecated use `#/lib/hooks/useOpenComposer` instead
 */
export function useOpenComposer() {
  const {openComposer} = useContext(controlsContext)
  return useMemo(() => ({openComposer}), [openComposer])
}

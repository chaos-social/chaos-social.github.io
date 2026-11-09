import {useCallback} from 'react'

import {useDialogStateControlContext} from '#/state/dialogs'
import {useComposerControls, useComposerState} from '#/state/shell/composer'
import {useLightboxControls} from '#/components/Lightbox/state'
import {IS_WEB} from '#/env'
import {useSetDrawerOpen} from './shell/drawer-open'

/**
 * returns true if something was closed
 * (used by the android hardware back btn)
 */
export function useCloseAnyActiveElement() {
  const {closeLightbox} = useLightboxControls()
  const composer = useComposerState()
  const {closeAllDialogs} = useDialogStateControlContext()
  const setDrawerOpen = useSetDrawerOpen()
  return useCallback(() => {
    if (closeLightbox()) {
      return true
    }
    if (composer && !composer.isMinimized) {
      return false
    }
    if (closeAllDialogs()) {
      return true
    }
    setDrawerOpen(false)
    return false
  }, [closeLightbox, composer, setDrawerOpen, closeAllDialogs])
}

/**
 * used to clear out any modals, eg for a navigation
 */
export function useCloseAllActiveElements() {
  const {closeLightbox} = useLightboxControls()
  const {closeComposer} = useComposerControls()
  const {closeAllDialogs: closeAlfDialogs} = useDialogStateControlContext()
  const setDrawerOpen = useSetDrawerOpen()
  return useCallback(() => {
    closeLightbox()
    // Web navigation can continue underneath the open composer.
    if (!IS_WEB) closeComposer()
    closeAlfDialogs()
    setDrawerOpen(false)
  }, [closeLightbox, closeComposer, closeAlfDialogs, setDrawerOpen])
}

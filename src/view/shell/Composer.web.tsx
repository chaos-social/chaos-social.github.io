import {useEffect} from 'react'
import {StyleSheet, View} from 'react-native'
import {DismissableLayer, FocusGuards, FocusScope} from 'radix-ui/internal'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useA11y} from '#/state/a11y'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {type ComposerOpts, useComposerState} from '#/state/shell/composer'
import {ComposePost, useComposerCancelRef} from '#/view/com/composer/Composer'
import {atoms as a, flatten, useBreakpoints, useTheme} from '#/alf'

const BOTTOM_BAR_HEIGHT = 61

export function Composer() {
  const state = useComposerState()
  const isActive = !!state

  if (!isActive) {
    return null
  }

  return (
    <>
      <RemoveScrollBar />
      <Inner state={state} />
    </>
  )
}

function Inner({state}: {state: ComposerOpts}) {
  const ref = useComposerCancelRef()
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  const {gtMobile} = useBreakpoints()
  const {reduceMotionEnabled} = useA11y()

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  FocusGuards.useFocusGuards()

  return (
    <FocusScope.FocusScope loop trapped asChild>
      <DismissableLayer.DismissableLayer
        role="dialog"
        aria-modal
        style={flatten([
          {position: 'fixed'},
          a.inset_0,
          {backgroundColor: '#000c'},
          a.flex,
          a.flex_col,
          a.align_center,
          !reduceMotionEnabled && a.fade_in,
        ])}
        onFocusOutside={evt => evt.preventDefault()}
        onInteractOutside={evt => evt.preventDefault()}
        onDismiss={() => ref.current?.onPressCancel()}>
        <View
          style={[
            styles.container,
            !gtMobile && styles.containerMobile,
            t.atoms.bg,
            t.atoms.border_contrast_medium,
            !reduceMotionEnabled && [
              a.zoom_fade_in,
              {animationDelay: 0.1},
              {animationFillMode: 'backwards'},
            ],
            enableSquareButtons === 'sharp' && SHARP_CORNERS,
          ]}>
          <ComposePost
            recoveredState={state.recoveredState}
            cancelRef={ref}
            activeAccountDid={state.activeAccountDid}
            openAccountSwitcher={state.openAccountSwitcher}
            replyTo={state.replyTo}
            quote={state.quote}
            onPost={state.onPost}
            onPostSuccess={state.onPostSuccess}
            mention={state.mention}
            text={state.text}
            tags={state.tags}
            imageUris={state.imageUris}
            videoUri={state.videoUri}
            openGallery={state.openGallery}
          />
        </View>
      </DismissableLayer.DismissableLayer>
    </FocusScope.FocusScope>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 50,
    maxWidth: 600,
    width: '100%',
    paddingVertical: 0,
    borderRadius: 8,
    marginBottom: 0,
    borderWidth: 1,
    maxHeight: 'calc(100% - (40px * 2))',
    overflow: 'hidden',
  },
  containerMobile: {
    borderRadius: 0,
    marginBottom: BOTTOM_BAR_HEIGHT,
    maxHeight: `calc(100% - ${BOTTOM_BAR_HEIGHT}px)`,
  },
})

import '#/platform/markBundleStartTime'
import '#/platform/polyfills'

import {registerRootComponent} from 'expo'

import {chromaFormatsReady} from '#/platform/chroma-formats.web'
import App from '#/App'

/*
 * Referenced so tree shaking keeps chroma-js's format registrations; see that
 * module. It is always true, so this branch is a no-op.
 */
if (chromaFormatsReady) registerRootComponent(App)

if (!__DEV__ && 'serviceWorker' in navigator) {
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Unable to register the service worker', error)
    })
  }
  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, {once: true})
  }
}

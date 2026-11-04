const {withGradleProperties} = require('expo/config-plugins')

/*
 * Expo sets CMAKE_OBJECT_PATH_MAX=1024 for every native module so object file
 * names stay readable. On Windows those names then exceed the 260-character
 * path limit, and the build fails with "Filename longer than 260 characters"
 * on deep pnpm paths. 0 keeps CMake's platform default (250), which makes
 * CMake hash long object names instead.
 */
module.exports = function withAndroidCmakeObjectPathMax(config) {
  return withGradleProperties(config, exportedConfig => {
    const key = 'expo.android.cmakeObjectPathMax'
    const idx = exportedConfig.modResults.findIndex(
      item => item.type === 'property' && item.key === key,
    )
    const entry = {type: 'property', key, value: '0'}
    if (idx >= 0) {
      exportedConfig.modResults.splice(idx, 1, entry)
    } else {
      exportedConfig.modResults.push(entry)
    }
    return exportedConfig
  })
}

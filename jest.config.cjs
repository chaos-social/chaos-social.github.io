const common = require('./jest/config.json')
const domTests = [
  '<rootDir>/src/features/keyboardShortcuts/PostMediaDialog.web.test.tsx',
  '<rootDir>/src/components/Post/Embed/VideoEmbed/VideoEmbedInner/web-controls/VideoControls.web.test.tsx',
  '<rootDir>/src/lib/routes/pasteLink.test.ts',
  '<rootDir>/src/view/com/pager/TabBar.web.test.tsx',
  '<rootDir>/src/components/Post/Embed/VideoEmbed/VideoEmbedInner/web-controls/usePictureInPicture.test.tsx',
  '<rootDir>/src/features/keyboardShortcuts/postNavigation.web.test.ts',
  '<rootDir>/src/features/keyboardShortcuts/overlayNavigation.web.test.ts',
]

function preset(name) {
  const {
    passWithNoTests: _passWithNoTests,
    watchPlugins: _watchPlugins,
    ...project
  } = require(name)
  return project
}

module.exports = {
  reporters: ['default', 'jest-junit'],
  projects: [
    {
      ...preset('jest-expo/ios/jest-preset'),
      ...common,
      displayName: 'iOS',
      testPathIgnorePatterns: [
        '/node_modules/',
        ...domTests.map(path => path.replace('<rootDir>/', '')),
      ],
    },
    {
      ...preset('jest-expo/web/jest-preset'),
      ...common,
      preset: 'jest-expo/web',
      displayName: 'Web',
      moduleNameMapper: {
        ...preset('jest-expo/web/jest-preset').moduleNameMapper,
        ...common.moduleNameMapper,
      },
      testMatch: domTests,
      setupFilesAfterEnv: ['<rootDir>/jest/webSetup.js'],
    },
  ],
}

export PATH := "./node_modules/.bin:" + env_var('PATH')

# lots of just -> pnpm, but this lets us chain pnpm command deps

[group('dist')]
dist-build-web: intl build-web

[group('dist')]
dist-build-android-sideload: intl build-android-sideload

[group('dist')]
dist-build-android-gradle: intl build-android-gradle

[group('build')]
intl:
    pnpm intl:build

[group('build')]
prebuild-android:
    expo prebuild -p android

[group('build')]
build-web:
    pnpm build-web

[group('build')]
build-android-sideload: prebuild-android
    eas build --local --platform android --profile sideload-android

[group('build')]
[working-directory: 'android']
build-android-gradle: prebuild-android
    ./gradlew app:assembleRelease

[group('dev')]
dev-android-setup: prebuild-android
    pnpm android

[group('dev')]
dev-web:
    pnpm web

[group('dev')]
dev-web-functions: build-web
    wrangler pages dev ./dist

[group('lint')]
typecheck:
    pnpm typecheck

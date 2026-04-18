export PATH := "./node_modules/.bin:" + env_var('PATH')

# lots of just -> yarn, but this lets us chain yarn command deps

[group('dist')]
dist-build-web: intl build-web

[group('dist')]
dist-build-android-sideload: intl build-android-sideload

[group('dist')]
dist-build-android-gradle: intl build-android-gradle

[group('build')]
intl:
    yarn intl:build

[group('build')]
prebuild-android:
    expo prebuild -p android

[group('build')]
build-web: && postbuild-web
    NODE_ENV=production rspack build

[group('build')]
build-android-sideload: prebuild-android
    eas build --local --platform android --profile sideload-android

[group('build')]
[working-directory: 'android']
build-android-gradle: prebuild-android
    ./gradlew app:assembleRelease

[group('build')]
postbuild-web:
    # we need to copy the static iframe html to support youtube embeds
    cp -r bskyweb/static/iframe/ web-build/iframe
    # copy well-known files to support app deeplinks too
    cp -r bskyweb/static/.well-known/ web-build/.well-known
    # copy files to support oauth
    cp bskyweb/static/oauth-client-metadata.json web-build/oauth-client-metadata.json
    cp bskyweb/static/oauth-client-metadata-native.json web-build/oauth-client-metadata-native.json

    # copy static info pages over!
    cp -r witchsky-static-about web-build/about

[group('dev')]
dev-android-setup: prebuild-android
    yarn android

[group('dev')]
dev-web:
    rspack serve

[group('dev')]
dev-web-functions: build-web
    wrangler pages dev ./web-build

[group('lint')]
typecheck:
    yarn typecheck

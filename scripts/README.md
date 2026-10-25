# Tool Scripts

## PWA install icons

Run `pnpm pwa:icons` after changing the native icon artwork to regenerate the
checked-in icons in `public/pwa`. The web build also generates these icons into
`dist/pwa`, then copies them and the manifest to `bskyweb/static/pwa`.

The Apple touch icon uses the native app's opaque square artwork. The general
192px and 512px manifest icons use the transparent orange hat without adaptive
launcher padding. Chrome also uses these images for its startup screen and
Recents, where a padded tile produces a small mark or a visible square.
The manifest theme color matches the dark startup background so Android's
Recents badge has contrast behind the orange mark.

The default manifest intentionally omits a maskable icon. Chrome prefers maskable
artwork for both the primary icon and splash image, but its shortcut splash path
renders that image without its adaptive treatment. See
[Chromium's icon selection](https://github.com/chromium/chromium/blob/124.0.6367.219/components/webapps/browser/android/shortcut_info.cc)
and [shortcut splash rendering](https://github.com/chromium/chromium/blob/124.0.6367.219/chrome/android/java/src/org/chromium/chrome/browser/browserservices/ui/splashscreen/webapps/WebappSplashController.java).
Do not add a padded launcher tile to this manifest without checking startup and
Recents as well as the Home Screen.

The monochrome icon retains the native alpha mask for supporting browsers.
[Chromium's WebAPK pipeline](https://chromium.googlesource.com/chromium/src/+/lkgr/components/webapk/webapk.proto)
currently ignores monochrome manifest icons, so Material You recoloring is not
guaranteed. Safari uses the separate Apple touch icon; iOS generates Clear and
Tinted appearances from that image. Native Icon Composer layers are not supplied
through the web manifest.

To verify, serve the web build locally and add it to the simulator's Home Screen.
Check Light, Dark, Tinted, and Clear appearances on iOS. On Android, check the
launcher, startup screen, and Recents with themed icons enabled and disabled.
Re-add the web app after changing its icons to avoid testing a cached install.
Local Chrome installs use the shortcut path; HTTPS WebAPK installation needs a
separate check after deployment.

Verified the final manifest and icons in an Android 15 / Chrome 124 simulator
install: startup shows the transparent orange hat on the dark background, and
Recents shows the full-size orange hat on a contrasting dark badge. The separate
Apple touch icon was checked in iOS 26.5 Default, Dark, Clear, and Tinted modes.

## updateExtensions.sh

Updates the extensions in `/modules` with the current iOS/Android project changes.

## patch-package-to-pnpm.mjs
_(Witchsky-specific)_

Run this periodically when the upstream patches change, to update the patch files in the `patches` directory. This is a
custom script that generates patch files compatible with pnpm's patching system, which has some differences from the
standard `patch-package` format. It uses git to create the patches and ensures they are correctly formatted for pnpm.

Then, update patchedDependencies in `package.json` to remove version specifiers from patches that don't need them
(anything except @atproto/api, usually). That matches the `patch-package` behavior better.

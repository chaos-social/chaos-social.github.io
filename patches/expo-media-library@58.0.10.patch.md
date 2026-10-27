# expo-media-library

## Android: `createAssetAsync` without the storage permission

Skips the `requireSystemPermissions()` check in `createAssetAsync` so saving a photo works even when the user
declined the media permission.

The original reason was never written down (the patch dates back to "Fix Android save to camera permissions",
December 2024). The most likely reason, from reading the 58.0.10 source: `requireSystemPermissions()` throws
unless `WRITE_EXTERNAL_STORAGE` is granted on Android 12L and below (API 32 and lower; on API 33+ the check is
a no-op). Since Android 10 (API 29) an app can insert its own images into MediaStore without that permission,
so the check needlessly blocks `OpenCameraBtn`, which calls `createAssetAsync` after taking a photo even when
the permission request was declined. On API 28 and below the insert still fails without the permission, which
the caller already catches.

Unchanged upstream in 58.0.10. Android-only, and expo-media-library ships a prebuilt Android AAR, so it must stay
in `expo.autolinking.android.buildFromSource` for this patch to take effect.

## Android: video albums belong under Movies

Routes video albums to `Environment.DIRECTORY_MOVIES` when `useCameraDir` is false.
Upstream puts both image and video albums under Pictures. Image albums continue
using Pictures, and camera saves continue using DCIM.

Witchsky creates download albums from each local file instead of looking up an
album by name. This lets the file's MIME type select `Pictures/Witchsky` or
`Movies/Witchsky` without confusing two albums that share the name Witchsky.
The album creation path reuses an existing directory and inserts a new asset
without moving previously saved media. Existing downloads are not migrated.

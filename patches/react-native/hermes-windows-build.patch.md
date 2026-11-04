# Build Hermes on a Windows host

Three problems building React Native's Hermes from source on Windows, all in
`ReactAndroid/hermes-engine/build.gradle.kts`:

1. **Tarball folder name.** The unzip step strips the one wrapping folder from
   the Hermes source tarball, but only matches the old `facebook-hermes-`
   prefix. The repo moved from `facebook/hermes` to `meta/hermes`, so the
   folder is now `meta-hermes-<sha>`. The prefix misses it, sources end up a
   level too deep, and the build fails with `The source directory ".../sdks/hermes"
   does not appear to contain CMakeLists.txt`. Flatten whatever the single
   top-level folder is called.

2. **`JSI_DIR` path escaping.** The path is passed to CMake as an absolute
   Windows path, and CMake parses `\` in an argument as an escape, so
   `...\jsi\test\testlib.cpp` fails with `Invalid character escape '\p'`.
   Pass forward slashes instead.

3. **`_WINDOWS` leaks into the Android build.** Hermes' `CMakeLists.txt` runs
   `if (WIN32) add_definitions(-D_WINDOWS)` before `project()`; `WIN32` is true
   for a Windows *host*, so the NDK build gets `-D_WINDOWS` and
   `ProcessStats.cpp` includes `windows.h`, which the NDK does not have. Pass
   `-U_WINDOWS` in the compile flags to undo it.

These are local-machine blockers for `pnpm android`; CI builds on Linux/macOS.
Hermes' own sources are re-extracted on each build, so the fixes have to live
in this Gradle file. Remove this patch once upstream handles these cases.

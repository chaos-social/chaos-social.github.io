/*
 * chroma-js registers its color formats as a side effect of its barrel entry:
 * importing "chroma-js" pulls in src/io/<format>/index.js, and each of those
 * assigns into input.format and pushes an autodetect entry.
 *
 * Production web builds set EXPO_UNSTABLE_TREE_SHAKING, and this Metro has no
 * "sideEffects" support, so those imports are treated as unused and dropped.
 * The format table then ends up empty and chroma("#rrggbb") throws
 * "unknown format: #rrggbb", which crashed every profile page.
 *
 * Importing the format modules explicitly and re-exporting something the
 * caller uses keeps them reachable, so nothing can prune them. Importing for
 * side effects alone is NOT enough - a bare `import '...'` gets dropped too,
 * which is why this returns a value rather than being import-for-effect.
 */

// Format registrations. Add the matching module if a new chroma format call
// starts throwing in a production build.
import 'chroma-js/src/io/hex/index.js'
import 'chroma-js/src/io/rgb/index.js'
import 'chroma-js/src/io/oklch/index.js'

/**
 * Import this once, at web startup, and reference the result to keep
 * chroma-js's format table populated through tree shaking.
 */
export const chromaFormatsReady = true

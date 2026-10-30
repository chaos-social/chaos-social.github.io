/*
 * chroma-js registers its color formats and operators as a side effect of its
 * barrel entry: importing "chroma-js" pulls in src/io/<format>/index.js and
 * src/ops/<op>.js, and each of those assigns onto the Color prototype or into
 * input.format.
 *
 * Production web builds set EXPO_UNSTABLE_TREE_SHAKING, and this Metro has no
 * "sideEffects" support, so those imports are treated as unused and dropped.
 * The result is that chroma() parses nothing ("unknown format: #rrggbb") and
 * Color instances have no methods ("e.luminance is not a function"), both of
 * which are runtime-only failures.
 *
 * Import the full set here rather than the handful that current call sites
 * happen to use: chroma reaches operators indirectly (chroma.contrast calls
 * .luminance(), mix uses the mix generator, and so on), so a per-method list
 * breaks again the moment a new call site appears. The whole set is a few KB.
 *
 * A bare `import '...'` for side effects gets pruned too. The caller imports
 * the exported value below and uses it, which keeps this module alive.
 */

// Formats - each also registers an autodetect entry for input parsing.
import 'chroma-js/src/io/cmyk/index.js'
import 'chroma-js/src/io/css/index.js'
import 'chroma-js/src/io/gl/index.js'
import 'chroma-js/src/io/hcg/index.js'
import 'chroma-js/src/io/hex/index.js'
import 'chroma-js/src/io/hsi/index.js'
import 'chroma-js/src/io/hsl/index.js'
import 'chroma-js/src/io/hsv/index.js'
import 'chroma-js/src/io/lab/index.js'
import 'chroma-js/src/io/lch/index.js'
import 'chroma-js/src/io/named/index.js'
import 'chroma-js/src/io/num/index.js'
import 'chroma-js/src/io/oklab/index.js'
import 'chroma-js/src/io/oklch/index.js'
import 'chroma-js/src/io/rgb/index.js'
import 'chroma-js/src/io/temp/index.js'
// Operators - the methods available on a chroma color.
import 'chroma-js/src/ops/alpha.js'
import 'chroma-js/src/ops/clipped.js'
import 'chroma-js/src/ops/darken.js'
import 'chroma-js/src/ops/get.js'
import 'chroma-js/src/ops/luminance.js'
import 'chroma-js/src/ops/mix.js'
import 'chroma-js/src/ops/premultiply.js'
import 'chroma-js/src/ops/saturate.js'
import 'chroma-js/src/ops/set.js'
import 'chroma-js/src/ops/shade.js'
// Used by chroma.mix / chroma.scale.
import 'chroma-js/src/generator/mix.js'

/**
 * Import this once at web startup and reference the value; see the note above
 * on why a bare side-effect import is not enough.
 */
export const chromaFormatsReady = true

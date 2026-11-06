# Web build notes

## chroma-js and tree shaking

`pnpm build-web` sets `EXPO_UNSTABLE_TREE_SHAKING=1`. This Metro has no
`sideEffects` support in package.json, so a package's side-effect-only imports
can be pruned even though upstream declared them safe.

chroma-js works entirely through those side effects. Importing `chroma-js`
pulls in:

- `src/io/<format>/index.js` - assigns into `input.format` and pushes an
  autodetect entry, which is what makes `chroma('#rrggbb')` parse at all.
- `src/ops/<op>.js` - assigns methods onto `Color.prototype`, which is what
  makes `.oklch()`, `.hex()`, `.luminance()`, `.darken()` etc. exist.
- `src/interpolator/<space>.js` - registers each color space with
  `chroma.mix`; without them, `chroma.mix(a, b, t, 'lab')` throws
  `interpolation mode lab is not defined`.
- `src/generator/mix.js` - backs `chroma.mix` and `chroma.scale`.

Under tree shaking all of that is dropped, and both failures are runtime-only:

| Missing | Symptom |
| --- | --- |
| format registrations | `unknown format: #rrggbb` |
| operator registrations | `e.luminance is not a function` |
| interpolator registrations | `interpolation mode lab is not defined` |

`src/platform/chroma-formats.web.ts` imports the **whole** io, ops and
interpolator sets so all of them survive pruning. It also exports `chroma`
itself, and every call site imports chroma from `#/platform/chroma-formats`
(the native sibling just re-exports the barrel). Importing the wrapper rather
than the package is what keeps the registrations ahead of the first call:
ordering modules in the entry file is not enough, because tree shaking may
evaluate them in a different order. Registering the full set rather than only
the methods currently called is deliberate: chroma reaches operators
indirectly (`chroma.contrast` calls `.luminance()`, `chroma.mix` uses the mix
generator), so a per-method list breaks again as soon as a new call site
appears. The whole set is a few KB.

To confirm a build is good, either run the deploy workflow's
`Check chroma registrations survived tree shaking` step, or grep the bundle:

```sh
grep -c '\[3,4,5,6,7,8,9\]' dist/_expo/static/js/web/index-*.js   # hex format
grep -c 'prototype\.luminance' dist/_expo/static/js/web/index-*.js # an operator
grep -c 'default\.lab=' dist/_expo/static/js/web/index-*.js              # an interpolator
```

All three must be non-zero.

Do not "fix" this by setting `EXPO_UNSTABLE_TREE_SHAKING=0`: that disables
tree shaking for the whole app (roughly 2 MiB of extra JS) to work around one
library.

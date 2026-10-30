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
- `src/generator/mix.js` - backs `chroma.mix` and `chroma.scale`.

Under tree shaking all of that is dropped, and both failures are runtime-only:

| Missing | Symptom |
| --- | --- |
| format registrations | `unknown format: #rrggbb` |
| operator registrations | `e.luminance is not a function` |

`src/platform/chroma-formats.web.ts` imports the **whole** io and ops set so
both survive pruning, and `index.web.ts` references its exported value so the
module itself is not pruned either - a bare side-effect import is dropped too.
Registering the full set rather than only the methods currently called is
deliberate: chroma reaches operators indirectly (`chroma.contrast` calls
`.luminance()`, `chroma.mix` uses the mix generator), so a per-method list
breaks again as soon as a new call site appears. The whole set is a few KB.

To confirm a build is good, either run the deploy workflow's
`Check chroma registrations survived tree shaking` step, or grep the bundle:

```sh
grep -c '\[3,4,5,6,7,8,9\]' dist/_expo/static/js/web/index-*.js   # hex format
grep -c 'prototype\.luminance' dist/_expo/static/js/web/index-*.js # an operator
```

Both must be non-zero.

Do not "fix" this by setting `EXPO_UNSTABLE_TREE_SHAKING=0`: that disables
tree shaking for the whole app (roughly 2 MiB of extra JS) to work around one
library.

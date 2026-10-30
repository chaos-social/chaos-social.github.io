# Web build notes

## chroma-js and tree shaking

`pnpm build-web` sets `EXPO_UNSTABLE_TREE_SHAKING=1`. This Metro has no
`sideEffects` support in package.json, so a package's side-effect-only imports
can be pruned even though upstream declared them safe.

chroma-js registers its color formats that way: importing `chroma-js` pulls in
`src/io/*/index.js`, and each of those assigns into `input.format` and pushes
an autodetect entry. Under tree shaking the format table ends up empty, so
`chroma('#rrggbb')` throws `unknown format: #rrggbb`. In practice that made
every profile page crash, because profile badges call `verifierColor()`.

`src/platform/chroma-formats.web.ts` imports the format modules explicitly
(`hex`, `rgb`, `oklch`) so they survive pruning, and `polyfills.web.ts` imports
it before anything else runs. **If you add a new `chroma.<format>()` call, add
the matching `src/io/<format>/index.js` import there**, or it will work in dev
and throw in production.

Symptoms to recognize:

- Dev works, deployed build throws `unknown format: #119d56`.
- Grepping the built chunk for the chroma autodetect entry finds only `p:5`
  (the `named` format) instead of the full table.

Do not "fix" this by setting `EXPO_UNSTABLE_TREE_SHAKING=0`: that disables
tree shaking for the whole app (roughly 2 MiB of extra JS) to work around one
library.

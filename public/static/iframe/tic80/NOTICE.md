# TIC-80 web player

The files in this directory are the unmodified web player from the upstream
[TIC-80](https://github.com/nesbox/TIC-80) `v1.4.1` release, asset
`tic80-v1.4-html.zip`:

- `index.html` — the player page. Its `Module.arguments` list names the cart.
- `tic80.js` — the Emscripten loader
- `tic80.wasm` — the emulator (11 MB)

MIT licensed, Copyright (c) 2017 Vadim Grigoruk.

Updating: download the newer `tic80-vX.Y-html.zip` from the TIC-80 releases and
replace all three files. `game.js` sets `Module.arguments` to the cart URL before
loading `tic80.js`, which is the same thing upstream's own HTML exporter does.

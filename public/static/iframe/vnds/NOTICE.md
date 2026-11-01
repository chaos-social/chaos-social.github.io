# VNDS engine

The files in this directory are vendored from
[VaYurik/vnds-online](https://github.com/VaYurik/vnds-online) at commit
`9fd1d0c084ada04d92067f24b1d693432574c09a` (2022-06-25).

- `functions.js`, `vnds.class.js`, `jquery.smoke.effect.js` — the VNDS interpreter
- `jquery-3.3.1.min.js` — jQuery, MIT licensed, upstream's bundled copy
- `styles.css` — the engine's stylesheet

Licensed **CC BY 3.0** (see the upstream `LICENSE.md`). Attribution: VNDS-online
by VaYurik.

`play_game.html` is not vendored because it is the engine's own menu shell. The
player builds that markup itself in `game-vnds.js`; the only pieces it depends on
are the element IDs the engine looks up, which are listed in that file.

Updating: replace these files from a newer upstream commit and update the SHA
above. Diffs against pristine upstream should stay empty.

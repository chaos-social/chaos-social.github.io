# Twemoji (web only)

Artwork: [jdecked/twemoji 17.0.3](https://github.com/jdecked/twemoji/releases/tag/v17.0.3),
supporting Unicode Emoji 17.0. No Unicode 18 Twemoji release was available when
this font was added.

Font build: [TCOTC/twemoji-colr v17.0.3](https://github.com/TCOTC/twemoji-colr/releases/tag/v17.0.3),
commit `f08d02b53ea25ce6e43a90e93553a80cd85bbd4a`.
`WitchskyTwemoji.woff2` is the release's `twemoji-colr.woff2` with its family and
PostScript names changed to avoid collisions with installed fonts. The COLRv1
artwork, character mappings, and emoji ligatures are preserved.

Twemoji graphics are copyright Twitter, Inc. and other contributors and are
licensed under CC-BY 4.0 (see `LICENSE-GRAPHICS`). Font construction uses nanoemoji
and the upstream GSUB patch for variation selectors and ZWJ sequences.

The font downloads only after Twemoji is selected, or on startup with a saved
Twemoji preference. Native builds do not import or package this font.

To regenerate, download `twemoji-colr.woff2` from the pinned release and run
`python scripts/convertTwemoji.py /path/to/twemoji-colr.woff2` with
`fonttools[woff]==4.61.1` installed.

"""Rename the pinned Twemoji COLRv1 web font to avoid system font collisions.

Requires fonttools[woff]==4.61.1. Run from the repository root.
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont

font = TTFont(sys.argv[1], recalcTimestamp=False)
for record in font["name"].names:
    value = {
        1: "Witchsky Twemoji",
        3: "Witchsky Twemoji 17.0.3",
        4: "Witchsky Twemoji",
        6: "WitchskyTwemoji",
    }.get(record.nameID)
    if value:
        record.string = value.encode(record.getEncoding())

font.flavor = "woff2"
font.save(Path("assets/fonts/twemoji/WitchskyTwemoji.woff2"))

import {renderedPngHasTransparency} from '#/lib/media/image/transparency'

/** 2x2 RGBA fixtures; the transparent variant has one alpha=254 pixel at the end. */
const fixtures = [
  [
    0,
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGMQNM3/f5cr8D8DV+rX/wpeFf8BQzEIMNzUU80AAAAASUVORK5CYII=',
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGMQNM3/f5cr8D8DV+rX/wpeFf8AQzAIL21+Hb8AAAAASUVORK5CYII=',
  ],
  [
    1,
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVR4nGMUNM3/f+bqIwZGrtSv/8WeNjMAAEj4CBvDKZN9AAAAAElFTkSuQmCC',
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVR4nGMUNM3/f+bqIwZGrtSv/8WeNv8HAEn3CRoIbXe1AAAAAElFTkSuQmCC',
  ],
  [
    2,
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGMSNM3/f5cr8D/TT4M2BmcHdQYAQKQGSfkezjgAAAAASUVORK5CYII=',
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGMSNM3/f5cr8D/TT4M2BmcH9f8AQaMHSJB6HCwAAAAASUVORK5CYII=',
  ],
  [
    3,
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGMWNM3/f/WDVAMzk/e+hrXCVxkAQx4HOucieTEAAAAASUVORK5CYII=',
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVR4nGMWNM3/f/WDVAMzk/e+hrXCV/8DAEQdCDl9+BvNAAAAAElFTkSuQmCC',
  ],
  [
    4,
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGMRNM3/f+bqIwaWnwZtDM6izQwARf0Gyi6eBuUAAAAASUVORK5CYII=',
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAGklEQVR4nGMRNM3/f+bqIwaWnwZtDM6izf8BRvwHyROd4cAAAAAASUVORK5CYII=',
  ],
] as const

it.each(fixtures)(
  'checks every pixel with PNG filter %i',
  (_filter, opaque, transparent) => {
    expect(renderedPngHasTransparency(opaque)).toBe(false)
    expect(renderedPngHasTransparency(transparent)).toBe(true)
  },
)

it('also detects grayscale alpha', () => {
  expect(
    renderedPngHasTransparency(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAQAAADYv8WvAAAAEklEQVR4nGMR/H+GgeUngzMDABLVAyHCW6xeAAAAAElFTkSuQmCC',
    ),
  ).toBe(false)
  expect(
    renderedPngHasTransparency(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAQAAADYv8WvAAAAEklEQVR4nGMR/H+GgeUngzMjABLWAyJeuEaLAAAAAElFTkSuQmCC',
    ),
  ).toBe(true)
})

it('preserves alpha when the PNG encoding is unknown or damaged', () => {
  for (const value of ['', 'not png', fixtures[0][1].slice(0, 60)]) {
    expect(renderedPngHasTransparency(value)).toBe(true)
  }
})

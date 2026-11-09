import {act, renderHook} from '@testing-library/react-native'

import {htmlToSegments} from '#/lib/strings/bridged-html'
import {usePostTextLimit} from '#/components/Post/usePostTextLimit'

jest.mock('#/lib/constants', () => ({MAX_POST_LINES: 25}))

it('collapses a long formatted paragraph and expands it on press', () => {
  const segments = htmlToSegments(
    `<p><strong>${'word '.repeat(250)}</strong></p>`,
  )
  const {result} = renderHook(() =>
    usePostTextLimit('short fallback', segments),
  )

  expect(result.current.limitLines).toBe(true)
  act(() => result.current.onPressShowMore())
  expect(result.current.limitLines).toBe(false)
  expect(segments).toEqual([{text: 'word '.repeat(250).trim(), bold: true}])
})

it('leaves short HTML and ordinary paragraphs uncollapsed', () => {
  const {result} = renderHook(() =>
    usePostTextLimit(
      'short fallback',
      htmlToSegments('<p>Hello <b>world</b></p>'),
    ),
  )
  expect(result.current.limitLines).toBe(false)
  const plain = renderHook(() =>
    usePostTextLimit('word '.repeat(250), undefined),
  )
  expect(plain.result.current.limitLines).toBe(false)
})

it('recomputes eligibility when HTML rendering is toggled', () => {
  const segments = htmlToSegments('<p>' + 'word '.repeat(250) + '</p>')
  const {result, rerender} = renderHook(
    ({enabled}: {enabled: boolean}) =>
      usePostTextLimit('short fallback', enabled ? segments : undefined),
    {initialProps: {enabled: false}},
  )
  expect(result.current.limitLines).toBe(false)
  rerender({enabled: true})
  expect(result.current.limitLines).toBe(true)
  act(() => result.current.onPressShowMore())
  rerender({enabled: false})
  rerender({enabled: true})
  expect(result.current.limitLines).toBe(false)
})

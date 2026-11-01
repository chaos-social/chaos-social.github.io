import {describe, expect, it} from '@jest/globals'
import {act, renderHook} from '@testing-library/react-native'

import {createPdsViewabilityStore} from '#/state/pds-viewability'
import {PostVisibilityProvider, usePostVisible} from '#/state/post-visibility'

describe('post visibility', () => {
  it('reports a post visible only after the list marks it', () => {
    const store = createPdsViewabilityStore()
    const wrapper = ({children}: React.PropsWithChildren<{}>) => (
      <PostVisibilityProvider store={store}>{children}</PostVisibilityProvider>
    )

    const {result} = renderHook(() => usePostVisible('at://post/1'), {
      wrapper,
    })
    expect(result.current).toBe(false)

    act(() => {
      store.markVisible(['at://post/1'])
    })
    expect(result.current).toBe(true)
  })

  it('is never visible without a provider', () => {
    const {result} = renderHook(() => usePostVisible('at://post/1'))
    expect(result.current).toBe(false)
  })
})

import mockData from '@emoji-mart/data'
import {renderHook} from '@testing-library/react-native'

import {useEmojiSearch} from '#/components/Autocomplete/useAutocomplete/useEmojiSearch'

jest.mock('#/lib/useGetEmojis', () => ({
  useGetEmojis: () => () => Promise.resolve(mockData),
}))

describe('emoji autocomplete search', () => {
  it('searches the unprocessed emoji dataset by shortcode', async () => {
    const {result} = renderHook(() => useEmojiSearch())
    const items = await result.current('smil')
    expect(items.some(item => item.emoji.id === 'smile')).toBe(true)
    expect(items.every(item => item.type === 'emoji' && item.value)).toBe(true)
  })

  it('finds descriptive keywords and respects the result limit', async () => {
    const {result} = renderHook(() => useEmojiSearch())
    const items = await result.current('happy', 3)
    expect(items).toHaveLength(3)
    expect(items.some(item => item.emoji.keywords.includes('happy'))).toBe(true)
  })
})

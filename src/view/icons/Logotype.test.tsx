import Svg, {Path} from 'react-native-svg'
import {describe, expect, it, jest} from '@jest/globals'
import {render} from '@testing-library/react-native'

let mockAppName = 'Witchsky'
jest.mock('#/env', () => ({
  get APP_NAME() {
    return mockAppName
  },
}))

jest.mock('#/lib/hooks/usePalette', () => ({
  usePalette: () => ({text: {color: '#000'}}),
}))

import {Logotype} from './Logotype'

describe('Logotype', () => {
  it('draws the letterforms when the name is unchanged', () => {
    mockAppName = 'Witchsky'
    const {queryByText, UNSAFE_root} = render(<Logotype width={80} />)
    expect(queryByText('Witchsky')).toBeNull()
    expect(UNSAFE_root.findAllByType(Path).length).toBeGreaterThan(1)
    expect(UNSAFE_root.findAllByType(Svg).length).toBe(1)
  })

  it('renders the configured name as text', () => {
    mockAppName = 'Hocus Pocus'
    const {getByText} = render(<Logotype width={80} />)
    expect(getByText('Hocus Pocus')).toBeTruthy()
  })
})

import {type useEffect, useReducer, type useRef} from 'react'
import {act, fireEvent, render} from '@testing-library/react-native'

import {
  composerReducer,
  type ComposerState,
  createComposerState,
  type PostAction,
} from '#/view/com/composer/state/composer'

type ReactHooks = {useEffect: typeof useEffect; useRef: typeof useRef}

jest.mock('@lingui/react', () => {
  const format = (
    message:
      | {message?: string; values?: Record<string, string | number>}
      | string,
  ) => {
    if (typeof message === 'string') return message
    return (message.message ?? '').replace(/{(\w+)}/g, (_, key: string) =>
      String(message.values?.[key] ?? ''),
    )
  }
  return {
    useLingui: () => ({_: format, t: format}),
    Trans: ({
      id,
      message,
      values,
    }: {
      id: string
      message?: string
      values?: Record<string, string | number>
    }) => format({message: message ?? id, values}),
  }
})
jest.mock('#/alf', () => {
  const blank = new Proxy({}, {get: () => ({})})
  return {
    atoms: blank,
    useTheme: () => ({
      atoms: blank,
      palette: new Proxy({}, {get: (target, key) => String(key)}),
    }),
  }
})
jest.mock('#/components/Typography', () => {
  const {Text} = require('react-native')
  return {Text}
})
jest.mock('#/components/icons/Poll', () => ({
  Poll_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/icons/Plus', () => ({
  PlusLarge_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/icons/Times', () => ({
  TimesLarge_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {
    Button: ({
      children,
      label,
      onPress,
      testID,
    }: {
      children: React.ReactNode
      label: string
      onPress: () => void
      testID?: string
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint=""
        onPress={onPress}
        testID={testID}>
        {children}
      </Pressable>
    ),
    ButtonText: ({children}: {children: React.ReactNode}) => (
      <Text>{children}</Text>
    ),
    ButtonIcon: () => null,
  }
})

const mockInputLifecycle = jest.fn()
jest.mock('#/components/forms/TextField', () => {
  const hooks = jest.requireActual<ReactHooks>('react')
  const {TextInput} = require('react-native')
  return {
    Root: ({children}: {children: React.ReactNode}) => children,
    Input: ({
      label,
      maxLength,
      onChangeText,
      placeholder,
      testID,
      value,
    }: {
      label: string
      maxLength: number
      onChangeText: (text: string) => void
      placeholder: string
      testID: string
      value: string
    }) => {
      const mountedWith = hooks.useRef(value)
      hooks.useEffect(() => {
        const initial = mountedWith.current
        mockInputLifecycle('mount', initial)
        return () => mockInputLifecycle('unmount', initial)
      }, [])
      return (
        <TextInput
          maxLength={maxLength}
          accessibilityLabel={label}
          accessibilityHint=""
          onChangeText={onChangeText}
          placeholder={placeholder}
          testID={testID}
          value={value}
        />
      )
    },
  }
})

const mockMetric = jest.fn()
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({metric: mockMetric}),
}))

jest.mock('#/state/gallery', () => ({createInitialImages: jest.fn()}))
jest.mock('#/state/queries/threadgate', () => ({
  threadgateRecordToAllowUISetting: jest.fn(() => []),
}))
jest.mock('#/view/com/composer/state/video', () => ({
  createVideoState: jest.fn(),
  videoReducer: jest.fn(),
}))

import {PollEditor} from '../PollEditor'

function composerWith(options: string[]): ComposerState {
  let state = createComposerState({
    initText: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
  const postId = state.thread.posts[0].id
  const actions: PostAction[] = [
    {type: 'embed_add_poll'},
    ...options.slice(2).map(() => ({
      type: 'embed_add_poll_option' as const,
    })),
    ...options.map((text, index) => ({
      type: 'embed_update_poll_option' as const,
      index,
      text,
    })),
  ]
  for (const postAction of actions) {
    state = composerReducer(state, {type: 'update_post', postId, postAction})
  }
  return state
}

const mockDispatch = jest.fn()

function ComposerHarness({
  options,
  text,
}: {
  options: string[]
  text: string
}) {
  const [state, dispatch] = useReducer(composerReducer, options, composerWith)
  const post = state.thread.posts[0]
  if (!post.embed.poll) return null
  return (
    <PollEditor
      poll={post.embed.poll}
      text={text}
      dispatch={postAction => {
        mockDispatch(postAction)
        dispatch({type: 'update_post', postId: post.id, postAction})
      }}
    />
  )
}

function renderEditor(options: string[], text = 'Which one?') {
  return render(<ComposerHarness options={options} text={text} />)
}

function lifecycle(kind: 'mount' | 'unmount') {
  return (mockInputLifecycle.mock.calls as [string, string][])
    .filter(([event]) => event === kind)
    .map(([, value]) => value)
}

describe('PollEditor', () => {
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('reports an edit with the index of the choice', () => {
    const {getByTestId} = renderEditor(['one', 'two'])

    expect(getByTestId('pollOptionInput-1')).toHaveProp(
      'accessibilityLabel',
      'Choice 2',
    )
    fireEvent.changeText(getByTestId('pollOptionInput-1'), 'changed')

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'embed_update_poll_option',
      index: 1,
      text: 'changed',
    })
    expect(getByTestId('pollOptionInput-0')).toHaveProp('value', 'one')
    expect(getByTestId('pollOptionInput-1')).toHaveProp('value', 'changed')
  })

  it('stops each choice at the length TOKIMEKI accepts', () => {
    const {getByTestId} = renderEditor(['one', 'two'])
    expect(getByTestId('pollOptionInput-0')).toHaveProp('maxLength', 100)
    expect(getByTestId('pollOptionInput-1')).toHaveProp('maxLength', 100)
  })

  it('adds a choice and reports the new count', () => {
    const {getByTestId} = renderEditor(['one', 'two'])

    fireEvent.press(getByTestId('addPollOptionBtn'))

    expect(mockMetric).toHaveBeenCalledTimes(1)
    expect(mockMetric).toHaveBeenCalledWith('composer:poll:optionAdd', {
      count: 3,
    })
    expect(mockDispatch).toHaveBeenCalledWith({type: 'embed_add_poll_option'})
  })

  it('hides the add row at four choices', () => {
    const three = renderEditor(['a', 'b', 'c'])
    expect(three.getByTestId('addPollOptionBtn')).toBeTruthy()
    three.unmount()

    const four = renderEditor(['a', 'b', 'c', 'd'])
    expect(four.getByTestId('pollOptionInput-3')).toBeTruthy()
    expect(four.queryByTestId('addPollOptionBtn')).toBeNull()
  })

  it('hides the per-choice remove when there are two choices', () => {
    const {queryByTestId} = renderEditor(['one', 'two'])
    expect(queryByTestId('pollOptionRemove-0')).toBeNull()
  })

  it('removes a choice by its index', () => {
    const {getByTestId} = renderEditor(['one', 'two', 'three'])

    fireEvent.press(getByTestId('pollOptionRemove-1'))

    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'embed_remove_poll_option',
      index: 1,
    })
    expect(mockMetric).not.toHaveBeenCalled()
  })

  it('removes the poll and reports it', () => {
    const {getByTestId, queryByTestId} = renderEditor(['one', 'two'])

    fireEvent.press(getByTestId('removePollBtn'))

    expect(mockMetric).toHaveBeenCalledTimes(1)
    expect(mockMetric).toHaveBeenCalledWith('composer:poll:remove', {})
    expect(mockDispatch).toHaveBeenCalledWith({type: 'embed_remove_poll'})
    expect(queryByTestId('pollEditor')).toBeNull()
  })

  it('reports the chosen closing time', () => {
    const {getByTestId} = renderEditor(['one', 'two'])

    fireEvent.press(getByTestId('pollDuration-7d'))

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'embed_set_poll_duration',
      duration: '7d',
    })
  })

  it('points out a choice that cannot be saved', () => {
    const {getByTestId, queryByTestId} = renderEditor(['a\u0000b', 'fine'])
    const hint = getByTestId('pollOptionHint-0')
    expect(hint).toHaveTextContent(
      'This choice contains characters that cannot be saved.',
      {exact: true},
    )
    expect(queryByTestId('pollOptionHint-1')).toBeNull()
  })

  it.each([
    {kind: 'empty', text: ''},
    {kind: 'only whitespace', text: ' \n\t '},
  ])('asks for post text when it is $kind', ({text}) => {
    const {getByTestId} = renderEditor(['one', 'two'], text)
    expect(getByTestId('pollQuestionHint')).toHaveTextContent(
      'Add post text to ask your question.',
      {exact: true},
    )
  })

  it('shows no post text hint when there is post text', () => {
    const {queryByTestId} = renderEditor(['one', 'two'], 'A question')
    expect(queryByTestId('pollQuestionHint')).toBeNull()
  })

  it('says where the question comes from and who runs voting', () => {
    const {getByText} = renderEditor(['one', 'two'])
    expect(getByText('Your post text is the question.', {exact: true})).toBeTruthy()
    expect(
      getByText('Votes are public and handled by TOKIMEKI.', {exact: true}),
    ).toBeTruthy()
  })

  it('unmounts only the removed row so the others keep their input', () => {
    const {getByTestId, queryByTestId} = renderEditor(['A', 'B', 'C'])
    expect(lifecycle('mount')).toEqual(['A', 'B', 'C'])

    fireEvent.press(getByTestId('pollOptionRemove-0'))

    expect(lifecycle('unmount')).toEqual(['A'])
    expect(getByTestId('pollOptionInput-0')).toHaveProp('value', 'B')
    expect(getByTestId('pollOptionInput-1')).toHaveProp('value', 'C')
    expect(queryByTestId('pollOptionInput-2')).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('stops adding rows at four when the add row is pressed twice', () => {
    const {getByTestId, queryByTestId} = renderEditor(['A', 'B', 'C'])
    const add = getByTestId('addPollOptionBtn')

    act(() => {
      fireEvent.press(add)
      fireEvent.press(add)
    })

    expect(lifecycle('mount')).toHaveLength(4)
    expect(queryByTestId('addPollOptionBtn')).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})

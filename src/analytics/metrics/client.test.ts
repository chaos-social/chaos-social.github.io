import {MetricsClient} from './client'

let appStateCallback: (state: string) => void
const mockSentryLogInfo = jest.fn()
let mockMetricsApiHost: string | undefined = 'https://test.metrics.api'
let mockSentryDsn: string | undefined

jest.mock('#/lib/appState', () => ({
  onAppStateChange: jest.fn(cb => {
    appStateCallback = cb
    return {remove: jest.fn()}
  }),
}))

jest.mock('#/logger', () => ({
  Logger: {
    create: () => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    }),
    Context: {Metric: 'metric'},
  },
}))

jest.mock('#/logger/sentry/lib', () => ({
  Sentry: {logger: {info: (...args: unknown[]) => mockSentryLogInfo(...args)}},
}))

jest.mock('#/env', () => ({
  get METRICS_API_HOST() {
    return mockMetricsApiHost
  },
  get SENTRY_DSN() {
    return mockSentryDsn
  },
  IS_WEB: false,
}))

type TestEvents = {
  click: {button: string}
  view: {screen: string}
}

type FetchRequestBody = {
  events: Array<{
    event: string
  }>
}

function parseFetchBody(options?: RequestInit): FetchRequestBody {
  const {body} = options ?? {}
  const raw =
    typeof body === 'string' ? body : body == null ? '{}' : JSON.stringify(body)
  return JSON.parse(raw) as FetchRequestBody
}

describe('MetricsClient', () => {
  let fetchMock: jest.Mock
  let fetchRequests: {body: FetchRequestBody}[]

  beforeEach(() => {
    jest.useFakeTimers({advanceTimers: true})
    mockMetricsApiHost = 'https://test.metrics.api'
    mockSentryDsn = undefined
    mockSentryLogInfo.mockReset()
    fetchRequests = []
    fetchMock = jest.fn().mockImplementation((_url, options?: RequestInit) => {
      const body = parseFetchBody(options)
      fetchRequests.push({body})
      return Promise.resolve({ok: true, status: 200})
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('flushes events on interval', async () => {
    const client = new MetricsClient<TestEvents>()
    client.track('click', {button: 'submit'})
    client.track('view', {screen: 'home'})

    expect(fetchRequests).toHaveLength(0)

    // Advance past the 10 second interval
    await jest.advanceTimersByTimeAsync(10_000)

    expect(fetchRequests).toHaveLength(1)
    expect(fetchRequests[0].body.events).toHaveLength(2)
    expect(fetchRequests[0].body.events[0].event).toBe('click')
    expect(fetchRequests[0].body.events[1].event).toBe('view')
  })

  it('flushes when maxBatchSize is exceeded', async () => {
    const client = new MetricsClient<TestEvents>()
    client.maxBatchSize = 5

    // Add events up to maxBatchSize (should not flush yet)
    for (let i = 0; i < 5; i++) {
      client.track('click', {button: `btn-${i}`})
    }

    expect(fetchRequests).toHaveLength(0)

    // One more event should trigger flush (> maxBatchSize)
    client.track('click', {button: 'btn-trigger'})

    // Allow microtasks to run
    await jest.advanceTimersByTimeAsync(0)

    expect(fetchRequests).toHaveLength(1)
    expect(fetchRequests[0].body.events).toHaveLength(6)
  })

  it('retries failed events once on 500 response', async () => {
    let requestCount = 0

    fetchMock.mockImplementation((_url, options?: RequestInit) => {
      requestCount++
      const body = parseFetchBody(options)

      if (requestCount === 1) {
        // First request fails with 500 - "Failed to fetch" triggers isNetworkError
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        })
      }

      // Retry succeeds
      fetchRequests.push({body})
      return Promise.resolve({ok: true, status: 200})
    })

    const client = new MetricsClient<TestEvents>()
    client.track('click', {button: 'submit'})

    // Trigger flush via interval
    await jest.advanceTimersByTimeAsync(10_000)

    expect(requestCount).toBe(1)
    expect(fetchRequests).toHaveLength(0)

    // Simulate app coming to foreground to trigger retry
    appStateCallback('active')
    await jest.advanceTimersByTimeAsync(0)

    expect(requestCount).toBe(2)
    expect(fetchRequests).toHaveLength(1)
    expect(fetchRequests[0].body.events).toHaveLength(1)
    expect(fetchRequests[0].body.events[0].event).toBe('click')
  })

  it('does not retry more than once', async () => {
    let requestCount = 0

    fetchMock.mockImplementation(() => {
      requestCount++
      // Always fail with network-like error
      return Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })
    })

    const client = new MetricsClient<TestEvents>()
    client.track('click', {button: 'submit'})

    // First flush fails
    await jest.advanceTimersByTimeAsync(10_000)

    expect(requestCount).toBe(1)

    // Retry also fails
    appStateCallback('active')
    await jest.advanceTimersByTimeAsync(0)

    expect(requestCount).toBe(2)

    // Another foreground event should not retry again (events are dropped)
    appStateCallback('active')
    await jest.advanceTimersByTimeAsync(0)

    expect(requestCount).toBe(2) // No additional requests
  })

  it('backs off instead of retrying every flush when the endpoint is unreachable', async () => {
    let requestCount = 0

    fetchMock.mockImplementation(() => {
      requestCount++
      return Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })
    })

    const client = new MetricsClient<TestEvents>()
    client.track('click', {button: 'first'})

    await jest.advanceTimersByTimeAsync(10_000)
    expect(requestCount).toBe(1)

    // No further requests go out during the backoff, even though the flush
    // interval keeps firing and events keep arriving.
    client.track('click', {button: 'during-backoff'})
    await jest.advanceTimersByTimeAsync(25_000)
    expect(requestCount).toBe(1)

    // Backoff expires, and a single further attempt is made.
    await jest.advanceTimersByTimeAsync(15_000)
    expect(requestCount).toBe(2)

    // That one fails too, so the backoff doubles.
    client.track('click', {button: 'after-second-failure'})
    await jest.advanceTimersByTimeAsync(40_000)
    expect(requestCount).toBe(2)
  })

  it('caps the failed queue at maxBatchSize', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    )

    const client = new MetricsClient<TestEvents>()
    client.maxBatchSize = 5

    // Exceeding maxBatchSize flushes all six events as one failing batch.
    for (let i = 0; i < 6; i++) {
      client.track('click', {button: `btn-${i}`})
    }
    await jest.advanceTimersByTimeAsync(0)

    let retried: {payload: {button: string}}[] = []
    fetchMock.mockImplementation((_url: string, options: {body: string}) => {
      retried = (
        JSON.parse(options.body) as {events: {payload: {button: string}}[]}
      ).events
      return Promise.resolve({ok: true, status: 200})
    })

    appStateCallback('active')
    await jest.advanceTimersByTimeAsync(0)

    // The oldest event was dropped rather than buffered indefinitely.
    expect(retried).toHaveLength(5)
    expect(retried[0].payload.button).toBe('btn-1')
    expect(retried[4].payload.button).toBe('btn-5')
  })

  it('flushes when app goes to background', async () => {
    const client = new MetricsClient<TestEvents>()
    client.track('click', {button: 'submit'})

    expect(fetchRequests).toHaveLength(0)

    // Simulate app going to background
    appStateCallback('background')
    await jest.advanceTimersByTimeAsync(0)

    expect(fetchRequests).toHaveLength(1)
  })

  it('sends metrics through sentry when metrics api host is unset', async () => {
    mockMetricsApiHost = undefined
    mockSentryDsn = 'https://public@example.glitchtip.com/1'

    const client = new MetricsClient<TestEvents>()
    client.track('click', {button: 'submit'})
    client.track('view', {screen: 'home'})

    await jest.advanceTimersByTimeAsync(10_000)

    expect(fetchRequests).toHaveLength(0)
    expect(mockSentryLogInfo).toHaveBeenCalledTimes(2)
    expect(mockSentryLogInfo).toHaveBeenNthCalledWith(
      1,
      'metric:click',
      expect.objectContaining({
        logger: 'metric',
        metric_name: 'click',
        metric_source: 'app',
        payload: {button: 'submit'},
      }),
    )
  })
})

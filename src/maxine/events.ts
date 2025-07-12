
/*!
https://github.com/ai/nanoevents

The MIT License (MIT)

Copyright 2016 Andrey Sitnik <andrey@sitnik.ru>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
interface EventsMap {
    [event: string]: any
}

interface DefaultEvents extends EventsMap {
    [event: string]: (...args: any) => void
}

export interface Unsubscribe {
    (): void
}

export interface Emitter<Events extends EventsMap = DefaultEvents> {
    /**
     * Calls each of the listeners registered for a given event.
     *
     * ```js
     * ee.emit('tick', tickType, tickDuration)
     * ```
     *
     * @param event The event name.
     * @param args The arguments for listeners.
     */
    emit<K extends keyof Events>(
        this: this,
        event: K,
        ...args: Parameters<Events[K]>
    ): void

    /**
     * Add a listener for a given event.
     *
     * ```js
     * const unbind = ee.on('tick', (tickType, tickDuration) => {
     *   count += 1
     * })
     *
     * disable () {
     *   unbind()
     * }
     * ```
     *
     * @param event The event name.
     * @param cb The listener function.
     * @returns Unbind listener from event.
     */
    on<K extends keyof Events>(this: this, event: K, cb: Events[K]): Unsubscribe
}

export let createEvents = <
    Events extends EventsMap = DefaultEvents
>(): Emitter<Events> => {
    const events: { [E in keyof Events]?: Set<Events[E]> } = {} 
    return {
        emit(event, ...args) {
            for (const callback of events[event] || []) {
                callback(...args)
            }
        },
        on(event, cb) {
            (events[event] ||= new Set()).add(cb)
            return () => {
                events[event]!.delete(cb)
            }
        }
    }
}
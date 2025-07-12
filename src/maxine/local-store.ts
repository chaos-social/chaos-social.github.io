import { useSyncExternalStore } from 'react';

import { createEvents } from './events';

interface LocalStorageEvents {
    setValue(key: string | null, value: string | null): void
}

const storageEvents = createEvents<LocalStorageEvents>()

addEventListener('storage', event => {
    if (event.storageArea !== localStorage) return

    storageEvents.emit('setValue', event.key, event.newValue)
})

export function useLocalStorage(key: string, initialValue: string) {
    const value = useSyncExternalStore(
        callback => {
            return storageEvents.on('setValue', (theKey) => {
                if (theKey === key) {
                    callback()
                }
            })
        },
        () => localStorage.getItem(key) ?? initialValue,
    )

    const setValue = (newValue: string) => {
        localStorage.setItem(key, newValue)
        storageEvents.emit('setValue', key, newValue)
    }

    return [value, setValue] as const
}
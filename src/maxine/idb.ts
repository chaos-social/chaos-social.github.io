/*!
MIT License

Copyright (c) 2018 KayleePop

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

export default class IdbKV<K extends IDBValidKey, V> {
    storeName: string
    db: Promise<IDBDatabase>

    constructor(dbName: string) {
        this.storeName = 'idb-kv'

        // Promise for the indexeddb DB object
        this.db = new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1)

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => {
                reject(new Error(`error opening the indexedDB database named ${dbName}: ${request.error}`))
            }

            // if db doesn't already exist
            request.onupgradeneeded = () => request.result.createObjectStore(this.storeName)
        })
    }

    async get(key: K) {
        const db = await this.db

        const store = db.transaction(this.storeName, 'readonly').objectStore(this.storeName)

        const request = store.get(key)

        return new Promise<V | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
    }

    async getBatch(keys: K[]): Promise<Map<K, V | undefined>> {
        const db = await this.db

        const store = db.transaction(this.storeName, 'readonly').objectStore(this.storeName)

        const request = store.getAll(keys)

        function zip(a: K[], b: V[]) {
            return a.map((k, i) => [k, b[i]] as const)
        }

        return new Promise<Map<K, V>>((resolve, reject) => {
            request.onsuccess = () => resolve(new Map<K, V>(zip(keys, request.result as V[])))
            request.onerror = () => reject(request.error)
        })
    }

    async set(key: K, value: V) {
        const db = await this.db

        const store = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName)

        const request = store.put(value, key)

        return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    async delete(key: K) {
        const db = await this.db

        const store = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName)

        const request = store.delete(key)

        return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    async destroy() {
        const db = await this.db

        // the onsuccess event will only be called after the DB closes
        db.close()

        const request = indexedDB.deleteDatabase(db.name)

        // reject commits after destruction and by extension reject new actions
        this.db = Promise.reject(new Error('This idb-kv instance has been destroyed'))

        return new Promise<void>((resolve, reject) => {
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }
}

export class IdbWithInMemoryCache<K extends IDBValidKey, V> {
    private readonly idb: IdbKV<K, V>
    private readonly cache: Map<K, V | undefined>
    constructor(dbName: string) {
        this.idb = new IdbKV(dbName)
        this.cache = new Map()
    }

    set(key: K, value: V) {
        this.cache.set(key, value)
        this.idb.set(key, value)
    }

    get(key: K): Promise<V | undefined> {
        if (this.cache.has(key)) {
            return Promise.resolve(this.cache.get(key))
        }
        return this.idb.get(key).then(value => {
            this.cache.set(key, value)
            return value
        })
    }

    getBatch(keys: K[]): Promise<Map<K, V | undefined>> {
        let readAllKeysFromCache = true

        const result = new Map<K, V | undefined>()
        for (const key of keys) {
            if (this.cache.has(key)) {
                result.set(key, this.cache.get(key))
            } else {
                readAllKeysFromCache = false
                break
            }
        }

        if (readAllKeysFromCache) {
            return Promise.resolve(result)
        }

        return this.idb.getBatch(keys).then(batch => {
            for (const [key, value] of batch) {
                this.cache.set(key, value)
            }
            return batch
        })
    }
}

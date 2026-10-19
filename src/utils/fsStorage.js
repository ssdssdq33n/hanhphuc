/**
 * File System Access API wrapper.
 * Allows the app to read/write a single JSON state file in a user-chosen folder.
 *
 * Persistence model:
 *   1. User picks a folder once (e.g. D:\data-hp) via pickDirectory()
 *   2. The FileSystemDirectoryHandle is stored in a tiny separate IndexedDB database
 *   3. On each page load we reload the handle and call requestPermission() (requires a
 *      user-gesture click — so we show a "Reconnect" button in the header)
 *   4. All state is saved as gallery-state.json inside that folder
 *   5. Falls back to Dexie/IndexedDB when the API is unsupported or folder not configured
 */

export const STATE_FILE = 'gallery-state.json'

// Check browser support (Chrome/Edge 86+; Firefox/Safari not supported)
export const supported =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window

// ── Tiny IndexedDB for storing the directory handle ───────────────────────────
// We use raw IDB (not Dexie) to keep this module self-contained and avoid
// issues with Dexie's version schema when the main DB is also being used.

const META_DB   = 'hanhphuc-fs-meta'
const META_STORE = 'handles'
const DIR_KEY   = 'dataDir'

let _metaDb = null

async function openMetaDb() {
  if (_metaDb) return _metaDb
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(META_DB, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(META_STORE)
    req.onsuccess  = e => { _metaDb = e.target.result; resolve(_metaDb) }
    req.onerror    = () => reject(req.error)
  })
}

async function metaGet(key) {
  try {
    const db = await openMetaDb()
    return new Promise(res => {
      const req = db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(key)
      req.onsuccess = () => res(req.result ?? null)
      req.onerror   = () => res(null)
    })
  } catch { return null }
}

async function metaPut(key, val) {
  try {
    const db = await openMetaDb()
    await new Promise(res => {
      const tx = db.transaction(META_STORE, 'readwrite')
      tx.objectStore(META_STORE).put(val, key)
      tx.oncomplete = () => res()
      tx.onerror    = () => res()
    })
  } catch {}
}

async function metaDel(key) {
  try {
    const db = await openMetaDb()
    await new Promise(res => {
      const tx = db.transaction(META_STORE, 'readwrite')
      tx.objectStore(META_STORE).delete(key)
      tx.oncomplete = () => res()
      tx.onerror    = () => res()
    })
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load the previously stored directory handle (may need permission re-grant). */
export async function loadStoredHandle() {
  return metaGet(DIR_KEY)
}

/** Persist the directory handle across sessions. */
export async function persistHandle(handle) {
  return metaPut(DIR_KEY, handle)
}

/** Remove the stored handle (disconnect). */
export async function removeStoredHandle() {
  return metaDel(DIR_KEY)
}

/**
 * Check / request 'readwrite' permission for a handle.
 * MUST be called in a user-gesture handler (click callback).
 * @returns {boolean}
 */
export async function verifyPermission(handle) {
  if (!handle) return false
  try {
    const opts = { mode: 'readwrite' }
    if (await handle.queryPermission(opts) === 'granted') return true
    if (await handle.requestPermission(opts) === 'granted') return true
    return false
  } catch { return false }
}

/**
 * Query current permission WITHOUT prompting.
 * Safe to call on page load (not a user gesture).
 */
export async function checkPermission(handle) {
  if (!handle) return false
  try {
    return await handle.queryPermission({ mode: 'readwrite' }) === 'granted'
  } catch { return false }
}

/**
 * Open the native folder picker (user-gesture required).
 * Persists the chosen handle automatically.
 */
export async function pickDirectory() {
  const handle = await window.showDirectoryPicker({
    id: 'hanhphuc-data',
    mode: 'readwrite',
    startIn: 'documents',
  })
  await persistHandle(handle)
  return handle
}

/** Read gallery-state.json from the folder. Returns null if not found. */
export async function readState(handle) {
  try {
    const fh   = await handle.getFileHandle(STATE_FILE)
    const file = await fh.getFile()
    return JSON.parse(await file.text())
  } catch { return null }
}

/** Write gallery-state.json to the folder (creates file if needed). */
export async function writeState(handle, state) {
  const fh       = await handle.getFileHandle(STATE_FILE, { create: true })
  const writable = await fh.createWritable()
  await writable.write(JSON.stringify(state, null, 2))
  await writable.close()
}

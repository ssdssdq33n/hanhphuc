import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import * as db from '@/utils/db.js'
import * as fsStorage from '@/utils/fsStorage.js'

const MAX_UNDO = 60

function cycleStatus(current) {
  if (current === null || current === undefined) return 'selected'
  if (current === 'selected') return 'rejected'
  return null
}

function snapshotImages(imageIds, selectionsRef) {
  const snap = {}
  for (const id of imageIds) snap[id] = selectionsRef[id] ? { ...selectionsRef[id] } : {}
  return snap
}

export const useGalleryStore = defineStore('gallery', () => {
  // ── Core state ─────────────────────────────────────────────────────────────

  const images         = ref([])
  const rounds         = ref([{ id: 1, name: 'Vòng 1', createdAt: new Date().toISOString() }])
  const currentRoundId = ref(1)
  const selections     = ref({})
  const notes          = ref({})

  const filters = ref({
    search: '', warehouses: [], status: 'all',
    hasNote: null, sttFrom: '', sttTo: '',
    sortBy: 'stt', sortDir: 'asc',
  })

  const thumbnailSize      = ref('medium')
  const colWidth           = ref(240)
  const lightboxStartIndex = ref(null)
  const noteModalImageId   = ref(null)
  const exportModalOpen    = ref(false)
  const loaded             = ref(false)
  const undoStack          = ref([])
  const redoStack          = ref([])

  const compareList      = ref([])
  const comparePanelOpen = ref(false)
  const hoveredImageId   = ref(null)
  const batchNoteOpen    = ref(false)

  // ── Images-folder state (full-res originals via File System Access API) ──────
  const imagesHandle     = ref(null)
  const imagesFolderName = ref('')
  const imagesReady      = ref(false)
  const _fullResCache    = new Map()  // id → blob URL (persists across panel opens)
  const _pendingLoads    = new Map()  // id → Promise<string|null> (dedup concurrent requests)

  // ── Folder storage state ───────────────────────────────────────────────────

  /** Current FileSystemDirectoryHandle (null = not configured) */
  const folderHandle = ref(null)
  /** Display name of the chosen folder */
  const folderName   = ref('')
  /**
   * 'idle'             — supported but no folder picked yet
   * 'loading'          — checking stored handle on startup
   * 'ready'            — folder open, permission granted
   * 'permission-needed'— handle stored but permission not yet granted (need user click)
   * 'unsupported'      — browser doesn't support File System Access API
   */
  const folderStatus = ref('idle')

  const hasFolderStorage = computed(() => folderStatus.value === 'ready')

  // ── Folder: debounced auto-save ────────────────────────────────────────────

  let _saveTimer = null

  function scheduleFolderSave() {
    if (!folderHandle.value || folderStatus.value !== 'ready') return
    clearTimeout(_saveTimer)
    _saveTimer = setTimeout(_doFolderSave, 800)
  }

  function buildStateSnapshot() {
    return {
      version: 1,
      rounds: rounds.value,
      currentRoundId: currentRoundId.value,
      thumbnailSize: thumbnailSize.value,
      colWidth: colWidth.value,
      selections: selections.value,
      notes: notes.value,
      savedAt: new Date().toISOString(),
    }
  }

  async function _doFolderSave() {
    if (!folderHandle.value || folderStatus.value !== 'ready') return
    try {
      await fsStorage.writeState(folderHandle.value, buildStateSnapshot())
    } catch (e) {
      console.error('[folder] save error:', e)
      if (e.name === 'NotAllowedError') folderStatus.value = 'permission-needed'
    }
  }

  /** Force immediate save (no debounce). */
  async function flushFolderSave() {
    clearTimeout(_saveTimer)
    await _doFolderSave()
  }

  function _applyStateObject(state) {
    if (!state) return
    if (state.rounds)         rounds.value        = state.rounds
    if (state.currentRoundId) currentRoundId.value = state.currentRoundId
    if (state.thumbnailSize)  thumbnailSize.value  = state.thumbnailSize
    if (state.colWidth)       colWidth.value       = state.colWidth
    if (state.selections)     selections.value     = state.selections
    if (state.notes)          notes.value          = state.notes
  }

  // ── Folder: public actions ─────────────────────────────────────────────────

  /** Open native folder picker — MUST be called from a user-gesture handler. */
  async function pickDataFolder() {
    if (!fsStorage.supported) return
    try {
      const handle = await fsStorage.pickDirectory()
      folderHandle.value = handle
      folderName.value   = handle.name
      folderStatus.value = 'ready'

      const fileState = await fsStorage.readState(handle)
      if (fileState) {
        const useFile = confirm(
          `Tìm thấy dữ liệu cũ trong thư mục "${handle.name}"` +
          (fileState.savedAt ? ` (${fileState.savedAt.slice(0, 10)})` : '') +
          `.\n\nBạn muốn tải dữ liệu này không?\n• OK → Tải từ thư mục\n• Cancel → Ghi đè bằng dữ liệu hiện tại`
        )
        if (useFile) {
          _applyStateObject(fileState)
          await db.importState(fileState)
        } else {
          await flushFolderSave()
        }
      } else {
        await flushFolderSave()
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('[folder] pick error:', e)
        folderStatus.value = 'idle'
      }
    }
  }

  /** Re-request permission for the stored handle — MUST be called from user gesture. */
  async function reconnectFolder() {
    if (!folderHandle.value) return
    const ok = await fsStorage.verifyPermission(folderHandle.value)
    if (ok) {
      folderStatus.value = 'ready'
      const fileState    = await fsStorage.readState(folderHandle.value)
      if (fileState) { _applyStateObject(fileState) }
    } else {
      folderStatus.value = 'permission-needed'
    }
  }

  /** Forget the folder (disconnect). */
  async function disconnectFolder() {
    clearTimeout(_saveTimer)
    await fsStorage.removeStoredHandle()
    folderHandle.value = null
    folderName.value   = ''
    folderStatus.value = 'idle'
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentRoundIndex = computed(() => rounds.value.findIndex(r => r.id === currentRoundId.value))
  const currentRound      = computed(() => rounds.value.find(r => r.id === currentRoundId.value) ?? rounds.value[0])

  function getPoolForRound(roundId) {
    const idx = rounds.value.findIndex(r => r.id === roundId)
    if (idx <= 0) return images.value
    const prev = rounds.value[idx - 1]
    return images.value.filter(img => selections.value[img.id]?.[prev.id] === 'selected')
  }

  const currentPool = computed(() => getPoolForRound(currentRoundId.value))

  const filteredImages = computed(() => {
    const f      = filters.value
    const pool   = currentPool.value
    const search = f.search.trim().toLowerCase()
    const sttFrom = f.sttFrom !== '' ? parseInt(f.sttFrom) : null
    const sttTo   = f.sttTo   !== '' ? parseInt(f.sttTo)   : null
    const rid    = currentRoundId.value

    let result = pool.filter(img => {
      if (search) {
        const note   = notes.value[img.id]
        const inId   = img.id.toLowerCase().includes(search)
        const inFile = img.filename?.toLowerCase().includes(search)
        const inNote = note?.text?.toLowerCase().includes(search)
        const inTags = note?.tags?.some(t => t.toLowerCase().includes(search))
        if (!inId && !inFile && !inNote && !inTags) return false
      }
      if (f.warehouses.length > 0 && !f.warehouses.includes(img.warehouse)) return false
      if (f.status !== 'all') {
        const st = selections.value[img.id]?.[rid] ?? null
        if (f.status === 'selected' && st !== 'selected') return false
        if (f.status === 'rejected' && st !== 'rejected') return false
        if (f.status === 'pending'  && st !== null)       return false
      }
      if (f.hasNote === true  && !notes.value[img.id]?.text) return false
      if (f.hasNote === false &&  notes.value[img.id]?.text) return false
      if (sttFrom !== null && img.stt < sttFrom) return false
      if (sttTo   !== null && img.stt > sttTo)   return false
      return true
    })

    const dir = f.sortDir === 'asc' ? 1 : -1
    if (f.sortBy === 'id') {
      result = [...result].sort((a, b) => dir * a.id.localeCompare(b.id))
    } else if (f.sortBy === 'status') {
      const order = { selected: 0, rejected: 1 }
      result = [...result].sort((a, b) => {
        const oa = order[selections.value[a.id]?.[rid] ?? null] ?? 2
        const ob = order[selections.value[b.id]?.[rid] ?? null] ?? 2
        return dir * (oa - ob) || (a.stt - b.stt)
      })
    } else if (f.sortBy === 'note') {
      result = [...result].sort((a, b) => {
        const na = notes.value[a.id]?.text ? 1 : 0
        const nb = notes.value[b.id]?.text ? 1 : 0
        return dir * (nb - na) || (a.stt - b.stt)
      })
    } else if (f.sortDir === 'desc') {
      result = [...result].sort((a, b) => b.stt - a.stt)
    }

    return result
  })

  function getStatsForRound(roundId) {
    const pool = getPoolForRound(roundId)
    let selected = 0, rejected = 0
    for (const img of pool) {
      const st = selections.value[img.id]?.[roundId] ?? null
      if (st === 'selected') selected++
      else if (st === 'rejected') rejected++
    }
    return { total: pool.length, selected, rejected, pending: pool.length - selected - rejected }
  }

  const currentStats   = computed(() => getStatsForRound(currentRoundId.value))
  const allWarehouse   = computed(() => [...new Set(images.value.map(i => i.warehouse))].sort())
  const hasUndo        = computed(() => undoStack.value.length > 0)
  const hasRedo        = computed(() => redoStack.value.length > 0)

  const warehouseStats = computed(() => {
    const rid = currentRoundId.value
    return allWarehouse.value.map(w => {
      const pool = images.value.filter(i => i.warehouse === w)
      let selected = 0, rejected = 0
      for (const img of pool) {
        const st = selections.value[img.id]?.[rid] ?? null
        if (st === 'selected') selected++
        else if (st === 'rejected') rejected++
      }
      return { name: w, total: pool.length, selected, rejected, pending: pool.length - selected - rejected }
    })
  })

  const batchNoteTargets = computed(() =>
    filteredImages.value
      .filter(img => selections.value[img.id]?.[currentRoundId.value] === 'selected')
      .map(img => img.id)
  )

  // ── Selection helpers ──────────────────────────────────────────────────────

  function cascadeClear(imageId, fromRoundId) {
    const idx = rounds.value.findIndex(r => r.id === fromRoundId)
    for (let i = idx + 1; i < rounds.value.length; i++) {
      const fid = rounds.value[i].id
      if (selections.value[imageId]) {
        delete selections.value[imageId][fid]
        if (Object.keys(selections.value[imageId]).length === 0) delete selections.value[imageId]
      }
    }
  }

  function applyStatusNoSave(imageId, roundId, status) {
    const prev        = selections.value[imageId]?.[roundId] ?? null
    const wasSelected = prev === 'selected'
    if (status === null) {
      if (selections.value[imageId]) {
        delete selections.value[imageId][roundId]
        if (Object.keys(selections.value[imageId]).length === 0) delete selections.value[imageId]
      }
    } else {
      if (!selections.value[imageId]) selections.value[imageId] = {}
      selections.value[imageId][roundId] = status
    }
    if (wasSelected && status !== 'selected') cascadeClear(imageId, roundId)
  }

  function applyStatus(imageId, roundId, status) {
    applyStatusNoSave(imageId, roundId, status)
    db.saveSelection(imageId, selections.value[imageId] || {})
    scheduleFolderSave()
  }

  // ── Selection actions ──────────────────────────────────────────────────────

  function setStatus(imageId, roundId, status) {
    const prevSnap = snapshotImages([imageId], selections.value)
    applyStatus(imageId, roundId, status)
    const nextSnap = snapshotImages([imageId], selections.value)
    undoStack.value.push({ imageIds: [imageId], prev: prevSnap, next: nextSnap })
    if (undoStack.value.length > MAX_UNDO) undoStack.value.shift()
    redoStack.value = []
  }

  function toggleStatus(imageId) {
    const current = selections.value[imageId]?.[currentRoundId.value] ?? null
    setStatus(imageId, currentRoundId.value, cycleStatus(current))
  }

  function selectImages(imageIds, status = 'selected') {
    const prevSnap = snapshotImages(imageIds, selections.value)
    for (const id of imageIds) applyStatusNoSave(id, currentRoundId.value, status)
    const changed = {}
    for (const id of imageIds) changed[id] = selections.value[id] || {}
    db.bulkSaveSelections(changed)
    scheduleFolderSave()
    const nextSnap = snapshotImages(imageIds, selections.value)
    undoStack.value.push({ imageIds, prev: prevSnap, next: nextSnap })
    if (undoStack.value.length > MAX_UNDO) undoStack.value.shift()
    redoStack.value = []
  }

  function selectAll()  { selectImages(filteredImages.value.map(i => i.id), 'selected') }
  function deselectAll(){ selectImages(filteredImages.value.map(i => i.id), null) }
  function rejectAll()  { selectImages(filteredImages.value.map(i => i.id), 'rejected') }

  function restoreSnapshot(snap) {
    const changed = {}
    for (const [id, data] of Object.entries(snap)) {
      if (!data || Object.keys(data).length === 0) delete selections.value[id]
      else selections.value[id] = { ...data }
      changed[id] = selections.value[id] || {}
    }
    db.bulkSaveSelections(changed)
    scheduleFolderSave()
  }

  function undo() {
    if (!undoStack.value.length) return
    const entry = undoStack.value.pop()
    redoStack.value.push(entry)
    restoreSnapshot(entry.prev)
  }

  function redo() {
    if (!redoStack.value.length) return
    const entry = redoStack.value.pop()
    undoStack.value.push(entry)
    restoreSnapshot(entry.next)
  }

  // ── Rounds ─────────────────────────────────────────────────────────────────

  function addRound() {
    const maxId    = Math.max(...rounds.value.map(r => r.id))
    const newRound = { id: maxId + 1, name: `Vòng ${rounds.value.length + 1}`, createdAt: new Date().toISOString() }
    rounds.value.push(newRound)
    currentRoundId.value = newRound.id
    db.saveRounds(rounds.value); db.saveCurrentRoundId(currentRoundId.value)
    scheduleFolderSave()
  }

  function renameRound(roundId, name) {
    const r = rounds.value.find(r => r.id === roundId)
    if (r) { r.name = name; db.saveRounds(rounds.value); scheduleFolderSave() }
  }

  function deleteRound(roundId) {
    if (rounds.value.length <= 1) return
    const idx = rounds.value.findIndex(r => r.id === roundId)
    if (idx === -1) return
    for (const imageId in selections.value) {
      if (selections.value[imageId][roundId]) {
        delete selections.value[imageId][roundId]
        db.saveSelection(imageId, selections.value[imageId])
      }
    }
    rounds.value.splice(idx, 1)
    if (currentRoundId.value === roundId) currentRoundId.value = rounds.value[Math.max(0, idx - 1)].id
    db.saveRounds(rounds.value); db.saveCurrentRoundId(currentRoundId.value)
    scheduleFolderSave()
  }

  function switchRound(roundId) {
    currentRoundId.value = roundId
    filters.value.status = 'all'
    db.saveCurrentRoundId(roundId)
    scheduleFolderSave()
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  function saveNote(imageId, text, tags) {
    if (!text && (!tags || tags.length === 0)) delete notes.value[imageId]
    else notes.value[imageId] = { text, tags: tags || [], updatedAt: new Date().toISOString() }
    db.saveNote(imageId, text, tags)
    scheduleFolderSave()
  }

  function saveBatchNote(imageIds, text, tags, mode = 'replace') {
    for (const id of imageIds) {
      if (mode === 'append') {
        const existing   = notes.value[id]?.text || ''
        const mergedText = existing ? (existing + (text ? '\n' + text : '')) : text
        const mergedTags = [...new Set([...(notes.value[id]?.tags || []), ...tags])]
        saveNote(id, mergedText, mergedTags)
      } else {
        saveNote(id, text, tags)
      }
    }
  }

  // ── Images folder: full-res loading ───────────────────────────────────────

  /** Open native picker to select the root folder that contains full-res images. */
  async function pickImagesFolder() {
    if (!fsStorage.supported) return
    try {
      const handle = await window.showDirectoryPicker({
        id: 'hanhphuc-images', mode: 'read', startIn: 'pictures',
      })
      imagesHandle.value     = handle
      imagesFolderName.value = handle.name
      imagesReady.value      = true
      await fsStorage.persistImagesHandle(handle)
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[images folder]', e)
    }
  }

  /** Re-request read permission for the stored images handle (user-gesture required). */
  async function reconnectImagesFolder() {
    if (!imagesHandle.value) { await pickImagesFolder(); return }
    const granted = await fsStorage.verifyReadPermission(imagesHandle.value)
    if (granted) imagesReady.value = true
  }

  /** Forget the images folder and clear all blob URL caches. */
  function disconnectImagesFolder() {
    _pendingLoads.clear()
    _fullResCache.forEach(url => URL.revokeObjectURL(url))
    _fullResCache.clear()
    imagesHandle.value     = null
    imagesFolderName.value = ''
    imagesReady.value      = false
    fsStorage.removeImagesHandle()
  }

  /**
   * Return a blob URL for the full-res image file from the images folder.
   * Caches the URL so the file is only read once per session.
   * Returns null if images folder not connected or file not found.
   */
  async function getFullResUrl(image) {
    if (!image || !imagesHandle.value || !imagesReady.value) return null
    if (_fullResCache.has(image.id)) return _fullResCache.get(image.id)
    // Dedup: if a load is already in-flight for this id, await the same promise
    if (_pendingLoads.has(image.id)) return _pendingLoads.get(image.id)

    const p = (async () => {
      try {
        const file = await fsStorage.getFileFromPath(imagesHandle.value, image.path)
        const url  = URL.createObjectURL(file)
        _fullResCache.set(image.id, url)
        return url
      } catch (e) {
        if (e.name === 'NotAllowedError') imagesReady.value = false
        return null
      } finally {
        _pendingLoads.delete(image.id)
      }
    })()

    _pendingLoads.set(image.id, p)
    return p
  }

  /** Synchronous: returns cached blob URL if already loaded, else null */
  function getCachedFullResUrl(image) {
    if (!image) return null
    return _fullResCache.get(image.id) ?? null
  }

  // ── Compare ────────────────────────────────────────────────────────────────

  function toggleCompare(imageId) {
    const idx = compareList.value.indexOf(imageId)
    if (idx >= 0) {
      compareList.value.splice(idx, 1)
      if (compareList.value.length === 0) comparePanelOpen.value = false
    } else if (compareList.value.length < 6) {
      compareList.value.push(imageId)
    }
  }

  function clearCompare() {
    compareList.value      = []
    comparePanelOpen.value = false
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  function resetFilters() {
    filters.value = {
      search: '', warehouses: [], status: 'all',
      hasNote: null, sttFrom: '', sttTo: '',
      sortBy: 'stt', sortDir: 'asc',
    }
  }
  function setFilter(key, value) { filters.value[key] = value }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function openLightbox(index) { lightboxStartIndex.value = index }
  function closeLightbox()     { lightboxStartIndex.value = null }
  function setThumbnailSize(size) { thumbnailSize.value = size; db.saveThumbnailSize(size); scheduleFolderSave() }
  function setColWidth(w) {
    colWidth.value = Math.max(140, Math.min(520, w))
    db.saveColWidth(colWidth.value)
    scheduleFolderSave()
  }

  // ── DB load ────────────────────────────────────────────────────────────────

  async function loadFromDB() {
    const [savedRounds, savedRoundId, savedThumbSize, savedColWidth, savedSelections, savedNotes] = await Promise.all([
      db.loadRounds(), db.loadCurrentRoundId(), db.loadThumbnailSize(),
      db.loadColWidth(), db.loadAllSelections(), db.loadAllNotes(),
    ])
    if (savedRounds)    rounds.value        = savedRounds
    if (savedRoundId)   currentRoundId.value = savedRoundId
    if (savedThumbSize) thumbnailSize.value  = savedThumbSize
    if (savedColWidth)  colWidth.value       = savedColWidth
    selections.value = savedSelections
    notes.value      = savedNotes
  }

  async function loadManifest() {
    try {
      const res = await fetch('./manifest.json')
      if (!res.ok) throw new Error('manifest.json not found')
      images.value = (await res.json()).images || []
    } catch (e) { console.error('manifest.json:', e); images.value = [] }
  }

  // ── Initialize ─────────────────────────────────────────────────────────────

  async function initialize() {
    await loadManifest()

    let loadedFromFolder = false

    if (fsStorage.supported) {
      folderStatus.value = 'loading'
      const handle = await fsStorage.loadStoredHandle()
      if (handle) {
        folderHandle.value = handle
        folderName.value   = handle.name
        // Silent permission check — no user gesture needed
        const alreadyGranted = await fsStorage.checkPermission(handle)
        if (alreadyGranted) {
          folderStatus.value = 'ready'
          const fileState   = await fsStorage.readState(handle)
          if (fileState) { _applyStateObject(fileState); loadedFromFolder = true }
        } else {
          // Browser needs user to click before we can re-request
          folderStatus.value = 'permission-needed'
        }
      } else {
        folderStatus.value = 'idle'
      }
    } else {
      folderStatus.value = 'unsupported'
    }

    if (!loadedFromFolder) await loadFromDB()

    if (!rounds.value.find(r => r.id === currentRoundId.value))
      currentRoundId.value = rounds.value[0]?.id ?? 1

    // Restore images folder handle (silent check — no user gesture needed)
    if (fsStorage.supported) {
      const imgHandle = await fsStorage.loadImagesHandle()
      if (imgHandle) {
        imagesHandle.value     = imgHandle
        imagesFolderName.value = imgHandle.name
        const granted = await fsStorage.checkReadPermission(imgHandle)
        if (granted) imagesReady.value = true
      }
    }

    loaded.value = true
  }

  // ── Backup / restore ───────────────────────────────────────────────────────

  async function exportStateJSON() {
    const blob = new Blob([JSON.stringify(buildStateSnapshot(), null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `gallery-state_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 500)
  }

  async function importStateJSON(file) {
    const state = JSON.parse(await file.text())
    _applyStateObject(state)
    await db.importState(state)
    if (hasFolderStorage.value) await flushFolderSave()
  }

  async function resetAllData() {
    clearTimeout(_saveTimer)
    await db.clearAllData()
    rounds.value        = [{ id: 1, name: 'Vòng 1', createdAt: new Date().toISOString() }]
    currentRoundId.value = 1
    selections.value    = {}
    notes.value         = {}
    filters.value       = { search: '', warehouses: [], status: 'all', hasNote: null, sttFrom: '', sttTo: '', sortBy: 'stt', sortDir: 'asc' }
    undoStack.value     = []
    redoStack.value     = []
    compareList.value   = []
    if (hasFolderStorage.value) await flushFolderSave()
  }

  // ── Auto-save watch ────────────────────────────────────────────────────────
  // Triggers folder save 800ms after any state change (guards against load phase)
  watch(
    () => [selections.value, notes.value, rounds.value, currentRoundId.value, thumbnailSize.value, colWidth.value],
    () => { if (loaded.value) scheduleFolderSave() },
    { deep: true }
  )

  // ── Exports ────────────────────────────────────────────────────────────────

  return {
    // state
    images, rounds, currentRoundId, selections, notes, filters,
    thumbnailSize, colWidth, lightboxStartIndex, noteModalImageId,
    exportModalOpen, loaded, undoStack, redoStack,
    compareList, comparePanelOpen, hoveredImageId, batchNoteOpen,
    // folder
    folderHandle, folderName, folderStatus, hasFolderStorage,
    // computed
    currentRound, currentRoundIndex, currentPool, filteredImages,
    currentStats, allWarehouse, hasUndo, hasRedo, warehouseStats, batchNoteTargets,
    // methods
    getPoolForRound, getStatsForRound,
    toggleStatus, setStatus, selectImages, selectAll, deselectAll, rejectAll,
    undo, redo,
    addRound, renameRound, deleteRound, switchRound,
    saveNote, saveBatchNote,
    toggleCompare, clearCompare,
    resetFilters, setFilter,
    openLightbox, closeLightbox,
    setThumbnailSize, setColWidth,
    initialize, exportStateJSON, importStateJSON, resetAllData,
    pickDataFolder, reconnectFolder, disconnectFolder, flushFolderSave,
    // images folder (full-res)
    imagesHandle, imagesFolderName, imagesReady,
    getFullResUrl, getCachedFullResUrl, pickImagesFolder, reconnectImagesFolder, disconnectImagesFolder,
  }
})

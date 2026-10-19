import Dexie from 'dexie'

const db = new Dexie('HanhPhucGallery')

db.version(1).stores({
  kv: 'key',          // general key-value: { key, value }
  selections: 'imageId', // { imageId, data: { [roundId]: 'selected'|'rejected' } }
  notes: 'imageId',   // { imageId, text, tags, updatedAt }
})

// ── rounds & app state ────────────────────────────────────────────────────────

export async function loadRounds() {
  const row = await db.kv.get('rounds')
  return row?.value ?? null
}

export async function saveRounds(rounds) {
  await db.kv.put({ key: 'rounds', value: rounds })
}

export async function loadCurrentRoundId() {
  const row = await db.kv.get('currentRoundId')
  return row?.value ?? null
}

export async function saveCurrentRoundId(id) {
  await db.kv.put({ key: 'currentRoundId', value: id })
}

export async function loadThumbnailSize() {
  const row = await db.kv.get('thumbnailSize')
  return row?.value ?? 'medium'
}

export async function saveThumbnailSize(size) {
  await db.kv.put({ key: 'thumbnailSize', value: size })
}

export async function loadColWidth() {
  const row = await db.kv.get('colWidth')
  return row?.value ?? 240
}

export async function saveColWidth(w) {
  await db.kv.put({ key: 'colWidth', value: w })
}

// ── selections ────────────────────────────────────────────────────────────────

export async function loadAllSelections() {
  const rows = await db.selections.toArray()
  const result = {}
  for (const row of rows) result[row.imageId] = row.data
  return result
}

export async function saveSelection(imageId, data) {
  if (!data || Object.keys(data).length === 0) {
    await db.selections.delete(imageId)
  } else {
    await db.selections.put({ imageId, data })
  }
}

export async function bulkSaveSelections(selectionsMap) {
  const toUpsert = []
  const toDelete = []
  for (const [imageId, data] of Object.entries(selectionsMap)) {
    if (data && Object.keys(data).length > 0) toUpsert.push({ imageId, data })
    else toDelete.push(imageId)
  }
  await db.transaction('rw', db.selections, async () => {
    if (toUpsert.length) await db.selections.bulkPut(toUpsert)
    if (toDelete.length) await db.selections.bulkDelete(toDelete)
  })
}

// ── notes ─────────────────────────────────────────────────────────────────────

export async function loadAllNotes() {
  const rows = await db.notes.toArray()
  const result = {}
  for (const row of rows) result[row.imageId] = { text: row.text, tags: row.tags, updatedAt: row.updatedAt }
  return result
}

export async function saveNote(imageId, text, tags) {
  if (!text && (!tags || tags.length === 0)) {
    await db.notes.delete(imageId)
  } else {
    await db.notes.put({ imageId, text, tags, updatedAt: new Date().toISOString() })
  }
}

// ── full backup / restore ─────────────────────────────────────────────────────

export async function exportState() {
  const [rounds, currentRoundId, thumbnailSize, selections, notes] = await Promise.all([
    loadRounds(),
    loadCurrentRoundId(),
    loadThumbnailSize(),
    loadAllSelections(),
    loadAllNotes(),
  ])
  return { rounds, currentRoundId, thumbnailSize, selections, notes, exportedAt: new Date().toISOString() }
}

export async function importState(state) {
  await db.transaction('rw', [db.kv, db.selections, db.notes], async () => {
    await db.kv.clear()
    await db.selections.clear()
    await db.notes.clear()

    if (state.rounds) await saveRounds(state.rounds)
    if (state.currentRoundId) await saveCurrentRoundId(state.currentRoundId)
    if (state.thumbnailSize) await saveThumbnailSize(state.thumbnailSize)
    if (state.selections) await bulkSaveSelections(state.selections)
    if (state.notes) {
      const noteRows = Object.entries(state.notes).map(([imageId, n]) => ({
        imageId, text: n.text, tags: n.tags, updatedAt: n.updatedAt
      }))
      await db.notes.bulkPut(noteRows)
    }
  })
}

export async function clearAllData() {
  await db.transaction('rw', [db.kv, db.selections, db.notes], async () => {
    await db.kv.clear()
    await db.selections.clear()
    await db.notes.clear()
  })
}

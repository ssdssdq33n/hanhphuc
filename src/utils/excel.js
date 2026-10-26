/**
 * Excel export utilities.
 * Thumbnail column uses =IMAGE() formula for copy-paste compatibility.
 * Falls back to embedded binary on localhost (not publicly accessible).
 */

const THUMB_COL_WIDTH  = 22
const THUMB_ROW_HEIGHT = 90
const HEADER_HEIGHT    = 30

const COLORS = {
  header:     'C8A97E',
  headerText: 'FFFFFF',
  selected:   'E8F5E9',
  rejected:   'FFEBEE',
  pending:    'FFFFFF',
  altRow:     'FAFAF8',
  border:     'E0D8D0',
  text:       '1A1A1A',
  muted:      '6B6B6B',
  content:    'FFFEF0',  // light yellow for writable "Nội dung" column
}

const STATUS_LABEL = {
  selected:  'Đã chọn',
  rejected:  'Đã loại',
  null:      'Chưa xử lý',
  undefined: 'Chưa xử lý',
}

// Compute absolute URL to a thumbnail from the current deployment
function getThumbUrl(img) {
  try { return new URL('./' + img.thumbPath, window.location.href).href }
  catch { return '' }
}

// Only use IMAGE formula if the URL is publicly accessible (not localhost)
function isPublicUrl(url) {
  if (!url) return false
  return !url.startsWith('http://localhost') && !url.startsWith('http://127.')
}

async function imgUrlToJpegBase64(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const MAX = 300
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function cellBorder() {
  const side = { style: 'thin', color: { argb: COLORS.border } }
  return { top: side, left: side, bottom: side, right: side }
}
function bgFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function buildColDefs(cols, rounds) {
  const colDefs = []
  if (cols.has('stt'))     colDefs.push({ key: 'stt',     width: 6 })
  if (cols.has('id'))      colDefs.push({ key: 'id',      width: 18 })
  if (cols.has('thumb'))   colDefs.push({ key: 'thumb',   width: THUMB_COL_WIDTH })
  if (cols.has('folder'))  colDefs.push({ key: 'folder',  width: 16 })
  if (cols.has('status'))  rounds.forEach(r => colDefs.push({ key: `r_${r.id}`, width: 14 }))
  if (cols.has('note'))    colDefs.push({ key: 'note',    width: 35 })
  if (cols.has('link'))    colDefs.push({ key: 'link',    width: 24 })
  if (cols.has('content')) colDefs.push({ key: 'content', width: 32 })
  return colDefs
}

function buildHeaderValues(cols, rounds) {
  const headers = []
  if (cols.has('stt'))     headers.push('STT')
  if (cols.has('id'))      headers.push('ID Ảnh')
  if (cols.has('thumb'))   headers.push('Ảnh')
  if (cols.has('folder'))  headers.push('Folder/Bộ')
  if (cols.has('status'))  rounds.forEach(r => headers.push(r.name))
  if (cols.has('note'))    headers.push('Ghi chú')
  if (cols.has('link'))    headers.push('Link ảnh gốc')
  if (cols.has('content')) headers.push('Nội dung')
  return headers
}

async function fillSheet(ws, wb, { images, selections, notes, rounds, filterRoundId, cols, onProgress, offset = 0, total = 0 }) {
  const includeThumb   = cols.has('thumb')
  const includeStatus  = cols.has('status')
  const includeLink    = cols.has('link')
  const includeContent = cols.has('content')
  const colDefs        = buildColDefs(cols, rounds)
  const thumbColIdx    = colDefs.findIndex(c => c.key === 'thumb')
  const linkColIdx     = colDefs.findIndex(c => c.key === 'link')
  const contentColIdx  = colDefs.findIndex(c => c.key === 'content')

  ws.columns = colDefs

  // Header row
  const headerRow = ws.addRow(buildHeaderValues(cols, rounds))
  headerRow.height = HEADER_HEIGHT
  headerRow.eachCell((cell, colNumber) => {
    cell.fill      = bgFill(COLORS.header)
    cell.font      = { name: 'Arial', bold: true, color: { argb: COLORS.headerText }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border    = cellBorder()

    // Special header styling for content column
    if (contentColIdx >= 0 && colNumber === contentColIdx + 1) {
      cell.fill = bgFill('A08040')
      cell.note = { texts: [{ text: 'Cột trống — điền nội dung vào đây' }] }
    }
  })

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  for (let i = 0; i < images.length; i++) {
    const img      = images[i]
    const sel      = selections[img.id] || {}
    const note     = notes[img.id]
    const noteCell = [note?.text, note?.tags?.join(', ')].filter(Boolean).join(' | ')
    const curSt    = filterRoundId ? (sel[filterRoundId] ?? null) : null
    const rowBg    = curSt === 'selected' ? COLORS.selected
      : curSt === 'rejected' ? COLORS.rejected
      : i % 2 === 0 ? COLORS.altRow : COLORS.pending

    const rowData = []
    if (cols.has('stt'))    rowData.push(img.stt)
    if (cols.has('id'))     rowData.push(img.id)
    if (includeThumb)       rowData.push('')
    if (cols.has('folder')) rowData.push(img.warehouse + (img.album ? `/${img.album}` : ''))
    if (includeStatus)      rounds.forEach(r => rowData.push(STATUS_LABEL[sel[r.id] ?? null] ?? 'Chưa xử lý'))
    if (cols.has('note'))   rowData.push(noteCell)
    if (includeLink)        rowData.push('')
    if (includeContent)     rowData.push('')

    const dataRow  = ws.addRow(rowData)
    dataRow.height = includeThumb ? THUMB_ROW_HEIGHT : 20

    dataRow.eachCell((cell, colNumber) => {
      cell.fill      = bgFill(rowBg)
      cell.font      = { name: 'Arial', size: 10, color: { argb: COLORS.text } }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border    = cellBorder()
      if (colNumber === 1 || (includeThumb && colNumber === thumbColIdx + 1)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      }
    })

    // ── Ảnh (thumb): =IMAGE() formula or fallback embed ───────────────────────
    if (includeThumb && thumbColIdx >= 0) {
      const thumbUrl = getThumbUrl(img)
      const thumbCell = dataRow.getCell(thumbColIdx + 1)
      if (isPublicUrl(thumbUrl)) {
        // Use IMAGE() formula — copies correctly with cell paste
        thumbCell.value = { formula: `IMAGE("${thumbUrl}")`, result: '' }
      } else {
        // Localhost fallback: embed binary
        const base64 = await imgUrlToJpegBase64(`./${img.thumbPath}`)
        if (base64) {
          const imgId = wb.addImage({ base64, extension: 'jpeg' })
          ws.addImage(imgId, {
            tl: { col: thumbColIdx,     row: i + 1 },
            br: { col: thumbColIdx + 1, row: i + 2 },
            editAs: 'twoCell',
          })
        }
      }
    }

    // ── Link ảnh gốc ──────────────────────────────────────────────────────────
    if (includeLink && linkColIdx >= 0) {
      const thumbUrl  = getThumbUrl(img)
      const linkCell  = dataRow.getCell(linkColIdx + 1)
      const pathText  = img.path || img.thumbPath || img.id
      if (isPublicUrl(thumbUrl)) {
        linkCell.value = { text: pathText, hyperlink: thumbUrl, tooltip: 'Click để xem thumbnail online' }
        linkCell.font  = { name: 'Arial', size: 9, color: { argb: '0563C1' }, underline: true }
      } else {
        linkCell.value = pathText
        linkCell.font  = { name: 'Arial', size: 9, color: { argb: COLORS.muted } }
      }
      linkCell.alignment = { vertical: 'middle', wrapText: true }
    }

    // ── Nội dung (empty write area) ───────────────────────────────────────────
    if (includeContent && contentColIdx >= 0) {
      const contentCell = dataRow.getCell(contentColIdx + 1)
      contentCell.fill      = bgFill(COLORS.content)
      contentCell.alignment = { vertical: 'top', wrapText: true }
      contentCell.border    = cellBorder()
    }

    if (onProgress) onProgress(offset + i + 1, total)
  }
}

/**
 * Export images to a single-sheet Excel file.
 */
export async function exportToExcel({
  images,
  selections,
  notes,
  rounds,
  sheetTitle = 'Ảnh đã lọc',
  filterRoundId = null,
  columns = ['stt', 'id', 'thumb', 'folder', 'status', 'note', 'content'],
  onProgress,
}) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Hạnh Phúc Gallery'

  const ws   = wb.addWorksheet(sheetTitle, { pageSetup: { orientation: 'landscape', fitToPage: true } })
  const cols = new Set(columns)

  await fillSheet(ws, wb, {
    images, selections, notes, rounds, filterRoundId, cols,
    onProgress, offset: 0, total: images.length,
  })

  await downloadWorkbook(wb, sheetTitle)
}

/**
 * Export all rounds to a multi-sheet Excel file (one sheet per round).
 */
export async function exportMultiSheet({
  sheets,
  selections,
  notes,
  rounds,
  columns = ['stt', 'id', 'thumb', 'folder', 'status', 'note', 'content'],
  onProgress,
}) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Hạnh Phúc Gallery'

  const cols   = new Set(columns)
  const total  = sheets.reduce((s, sh) => s + sh.images.length, 0)
  let   offset = 0

  for (const sh of sheets) {
    if (!sh.images.length) continue
    const safeName = sh.title.replace(/[\\/?*[\]:]/g, '_').slice(0, 31)
    const ws = wb.addWorksheet(safeName, { pageSetup: { orientation: 'landscape', fitToPage: true } })

    await fillSheet(ws, wb, {
      images: sh.images, selections, notes, rounds,
      filterRoundId: sh.roundId,
      cols, onProgress, offset, total,
    })
    offset += sh.images.length
  }

  await downloadWorkbook(wb, `HanhPhuc_AllRounds`)
}

async function downloadWorkbook(wb, name) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href     = url
  a.download = `${name.replace(/[^a-zA-Z0-9À-ỿ_\- ]/g, '_')}_export.xlsx`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 1000)
}

<template>
  <Teleport to="body">
    <div v-if="store.exportModalOpen" class="export-backdrop" @click.self="store.exportModalOpen = false">
      <div class="export-modal">
        <div class="export-header">
          <div class="export-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="export-icon">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Xuất Excel
          </div>
          <button class="close-btn" @click="store.exportModalOpen = false">×</button>
        </div>

        <div class="export-body">
          <!-- Multi-sheet toggle -->
          <div class="section">
            <label class="multi-toggle">
              <input type="checkbox" v-model="multiSheet" />
              <span class="mt-body">
                <span class="mt-title">Xuất nhiều sheet</span>
                <span class="mt-desc">Mỗi vòng một sheet riêng trong cùng 1 file Excel</span>
              </span>
            </label>
          </div>

          <!-- Single-sheet options -->
          <template v-if="!multiSheet">
            <!-- Round -->
            <div class="section">
              <div class="section-label">Xuất từ vòng nào?</div>
              <div class="option-group">
                <label v-for="r in store.rounds" :key="r.id" class="radio-option">
                  <input type="radio" v-model="selectedRoundId" :value="r.id" />
                  <span class="radio-label">
                    {{ r.name }}
                    <span class="opt-count">{{ store.getStatsForRound(r.id).total }} ảnh</span>
                  </span>
                </label>
                <label class="radio-option">
                  <input type="radio" v-model="selectedRoundId" :value="null" />
                  <span class="radio-label">
                    Tất cả ảnh
                    <span class="opt-count">{{ store.images.length }} ảnh</span>
                  </span>
                </label>
              </div>
            </div>

            <!-- Status filter -->
            <div class="section" :style="selectedRoundId === null ? 'opacity:0.4;pointer-events:none' : ''">
              <div class="section-label">Lọc theo trạng thái:</div>
              <div class="option-group horizontal">
                <label v-for="s in statusOpts" :key="s.value" class="radio-option horizontal">
                  <input type="radio" v-model="statusFilter" :value="s.value" />
                  <span class="radio-label">{{ s.label }} <span class="opt-count">({{ countForFilter(s.value) }})</span></span>
                </label>
              </div>
            </div>
          </template>

          <!-- Multi-sheet: per-round status -->
          <template v-else>
            <div class="section">
              <div class="section-label">Trạng thái cho mỗi vòng:</div>
              <div class="option-group horizontal">
                <label v-for="s in statusOpts" :key="s.value" class="radio-option horizontal">
                  <input type="radio" v-model="statusFilter" :value="s.value" />
                  <span class="radio-label">{{ s.label }}</span>
                </label>
              </div>
              <div class="multi-preview">
                <div v-for="r in store.rounds" :key="r.id" class="mp-row">
                  <span class="mp-round">{{ r.name }}</span>
                  <span class="mp-count">{{ multiSheetCount(r.id) }} ảnh</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Columns -->
          <div class="section">
            <div class="section-label">Cột xuất:</div>
            <div class="col-checks">
              <label v-for="c in columnOpts" :key="c.key" class="check-option">
                <input type="checkbox" v-model="selectedColumns" :value="c.key" />
                <span>{{ c.label }}</span>
              </label>
            </div>
            <div class="col-note">
              💡 Cột "Ảnh" dùng công thức <code>=IMAGE(url)</code> — copy/paste đúng, yêu cầu Excel 365 hoặc Google Sheets. Trên localhost sẽ embed ảnh thay thế.
            </div>
          </div>

          <!-- Preview -->
          <div class="export-preview">
            <div class="preview-label">Sẽ xuất:</div>
            <div class="preview-value">
              <strong>{{ previewCount }}</strong> ảnh
              <template v-if="multiSheet"> trên <strong>{{ store.rounds.length }}</strong> sheets</template>
              <template v-else>
                từ <strong>{{ selectedRoundName }}</strong>
                <template v-if="statusFilter !== 'all'"> · {{ statusLabel }}</template>
              </template>
            </div>
          </div>

          <!-- Progress -->
          <div v-if="exporting" class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
            </div>
            <div class="progress-text">Đang xử lý {{ progressCurrent }}/{{ progressTotal }} ảnh...</div>
          </div>
        </div>

        <div class="export-footer">
          <button class="cancel-btn" @click="store.exportModalOpen = false" :disabled="exporting">Hủy</button>
          <button class="export-btn" @click="doExport" :disabled="exporting || previewCount === 0">
            <span v-if="exporting">⏳ Đang xuất...</span>
            <span v-else>⬇ Xuất {{ previewCount }} ảnh</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'
import { exportToExcel, exportMultiSheet } from '@/utils/excel.js'

const store = useGalleryStore()

const multiSheet     = ref(false)
const selectedRoundId = ref(store.currentRoundId)
const statusFilter   = ref('selected')
const selectedColumns = ref(['stt', 'id', 'thumb', 'folder', 'status', 'note', 'content'])
const exporting      = ref(false)
const progressCurrent = ref(0)
const progressTotal   = ref(0)
const progress        = computed(() =>
  progressTotal.value ? Math.round(progressCurrent.value / progressTotal.value * 100) : 0
)

watch(selectedRoundId, (val) => { if (val === null) statusFilter.value = 'all' })

const statusOpts = [
  { value: 'all',      label: 'Tất cả' },
  { value: 'selected', label: '✓ Đã chọn' },
  { value: 'rejected', label: '✗ Đã loại' },
  { value: 'pending',  label: '⋯ Chưa xử lý' },
]

const columnOpts = [
  { key: 'stt',     label: 'STT' },
  { key: 'id',      label: 'ID Ảnh' },
  { key: 'thumb',   label: 'Ảnh (=IMAGE công thức)' },
  { key: 'folder',  label: 'Folder/Bộ' },
  { key: 'status',  label: 'Trạng thái' },
  { key: 'note',    label: 'Ghi chú' },
  { key: 'link',    label: 'Link ảnh gốc' },
  { key: 'content', label: 'Nội dung (cột trống)' },
]

function filterPool(pool, rid, sf) {
  if (sf === 'all') return pool
  return pool.filter(img => {
    const st = store.selections[img.id]?.[rid] ?? null
    if (sf === 'selected') return st === 'selected'
    if (sf === 'rejected') return st === 'rejected'
    return st === null
  })
}

function getExportImages() {
  const pool = selectedRoundId.value !== null
    ? store.getPoolForRound(selectedRoundId.value)
    : store.images
  return filterPool(pool, selectedRoundId.value, statusFilter.value)
}

function countForFilter(sf) {
  const pool = selectedRoundId.value !== null
    ? store.getPoolForRound(selectedRoundId.value)
    : store.images
  return filterPool(pool, selectedRoundId.value, sf).length
}

function multiSheetCount(rid) {
  return filterPool(store.getPoolForRound(rid), rid, statusFilter.value).length
}

const previewCount = computed(() => {
  if (multiSheet.value) return store.rounds.reduce((s, r) => s + multiSheetCount(r.id), 0)
  return getExportImages().length
})

const selectedRoundName = computed(() => {
  if (selectedRoundId.value === null) return 'Tất cả ảnh'
  return store.rounds.find(r => r.id === selectedRoundId.value)?.name ?? ''
})
const statusLabel = computed(() => statusOpts.find(s => s.value === statusFilter.value)?.label ?? '')

async function doExport() {
  if (previewCount.value === 0) return
  exporting.value = true
  progressCurrent.value = 0
  progressTotal.value   = previewCount.value

  const onProgress = (cur, tot) => { progressCurrent.value = cur; progressTotal.value = tot }

  try {
    if (multiSheet.value) {
      const sheets = store.rounds
        .map(r => ({
          title:   r.name,
          roundId: r.id,
          images:  filterPool(store.getPoolForRound(r.id), r.id, statusFilter.value),
        }))
        .filter(sh => sh.images.length > 0)

      await exportMultiSheet({
        sheets,
        selections: store.selections,
        notes:      store.notes,
        rounds:     store.rounds,
        columns:    selectedColumns.value,
        onProgress,
      })
    } else {
      const images = getExportImages()
      const title  = `${selectedRoundName.value}_${statusLabel.value || 'Tất cả'}`
      await exportToExcel({
        images,
        selections:    store.selections,
        notes:         store.notes,
        rounds:        store.rounds,
        sheetTitle:    title,
        filterRoundId: selectedRoundId.value,
        columns:       selectedColumns.value,
        onProgress,
      })
    }
    store.exportModalOpen = false
  } catch (err) {
    alert('Lỗi xuất Excel: ' + err.message)
    console.error(err)
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.export-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 300;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  backdrop-filter: blur(2px);
}
.export-modal {
  background: #fff; border-radius: 14px;
  width: min(560px, 95vw);
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  overflow: hidden; max-height: 92vh; display: flex; flex-direction: column;
}
.export-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.export-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--text-primary); }
.export-icon { width: 18px; height: 18px; color: var(--accent-gold); }
.close-btn {
  margin-left: auto; width: 30px; height: 30px; border-radius: 50%;
  border: none; background: var(--bg-primary); cursor: pointer;
  font-size: 20px; color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
}
.close-btn:hover { background: #f0e0e0; color: #dc3545; }

.export-body { padding: 20px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; }

.section {}
.section-label {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-muted); margin-bottom: 8px;
}

/* Multi-sheet toggle */
.multi-toggle {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; border-radius: 10px;
  border: 1.5px solid var(--border);
  cursor: pointer; transition: border-color .14s;
}
.multi-toggle:has(input:checked) { border-color: var(--accent-gold); background: var(--gold-faint, #F5EDD9); }
.multi-toggle input { margin-top: 2px; accent-color: var(--accent-gold); flex-shrink: 0; }
.mt-body { display: flex; flex-direction: column; gap: 2px; }
.mt-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.mt-desc  { font-size: 11px; color: var(--text-muted); }

.option-group { display: flex; flex-direction: column; gap: 6px; }
.option-group.horizontal { flex-direction: row; flex-wrap: wrap; gap: 8px 16px; }
.radio-option { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; color: var(--text-primary); }
.radio-option input[type="radio"] { accent-color: var(--accent-gold); cursor: pointer; }
.radio-label { display: flex; align-items: center; gap: 6px; }
.opt-count   { font-size: 11px; color: var(--text-muted); }

.multi-preview {
  margin-top: 8px; display: flex; flex-direction: column; gap: 4px;
  background: var(--bg-primary); border-radius: 8px; padding: 10px 12px;
}
.mp-row { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
.mp-round { color: var(--text-secondary); }
.mp-count { font-weight: 700; color: var(--accent-gold); }

.col-checks { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.check-option { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: var(--text-secondary); }
.check-option input[type="checkbox"] { accent-color: var(--accent-gold); cursor: pointer; }
.col-note {
  margin-top: 8px; font-size: 11px; color: var(--text-muted);
  background: var(--bg-primary); border-radius: 6px;
  padding: 7px 10px; border-left: 3px solid var(--accent-gold);
  line-height: 1.5;
}
.col-note code { font-family: monospace; background: rgba(0,0,0,.06); padding: 1px 4px; border-radius: 3px; }

.export-preview {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  background: rgba(200,169,126,.08); border: 1px solid rgba(200,169,126,.3); border-radius: 8px;
}
.preview-label { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.preview-value { font-size: 14px; color: var(--text-primary); }
.preview-value strong { color: var(--accent-gold-dark); }

.progress-wrap { display: flex; flex-direction: column; gap: 6px; }
.progress-bar  { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent-gold); border-radius: 3px; transition: width .2s; }
.progress-text { font-size: 12px; color: var(--text-muted); text-align: center; }

.export-footer {
  display: flex; gap: 10px;
  padding: 16px 20px; border-top: 1px solid var(--border);
  background: var(--bg-primary); flex-shrink: 0;
}
.cancel-btn {
  padding: 9px 20px; border-radius: 8px;
  border: 1.5px solid var(--border); background: transparent;
  cursor: pointer; font-size: 14px; font-family: inherit; color: var(--text-secondary);
}
.cancel-btn:hover:not(:disabled) { border-color: var(--accent-gold); }
.export-btn {
  flex: 1; padding: 9px 20px; border-radius: 8px;
  border: none; background: var(--accent-gold); color: #fff;
  cursor: pointer; font-size: 14px; font-weight: 600; font-family: inherit; transition: background .15s;
}
.export-btn:hover:not(:disabled) { background: var(--accent-gold-dark); }
.export-btn:disabled, .cancel-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>

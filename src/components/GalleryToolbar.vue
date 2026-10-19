<template>
  <div class="gtoolbar">
    <div class="gt-left">
      <!-- Sidebar toggle -->
      <button class="gt-sidebar-btn" @click="$emit('toggle-sidebar')" :title="sidebarOpen ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      <!-- Search -->
      <div class="search-wrap">
        <svg class="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          v-model="store.filters.search"
          class="search-in"
          placeholder="Tìm ID, tên file, ghi chú..."
          @keydown.escape="store.filters.search = ''"
        />
        <button v-if="store.filters.search" class="sc" @click="store.filters.search = ''" title="Xóa">×</button>
      </div>

      <!-- Active chips -->
      <div class="chips">
        <span v-if="store.filters.status !== 'all'" class="chip">
          {{ statusLabel }}
          <span class="cx" @click="store.filters.status = 'all'">×</span>
        </span>
        <span v-for="w in store.filters.warehouses" :key="w" class="chip">
          {{ w }}
          <span class="cx" @click="removeWarehouse(w)">×</span>
        </span>
        <span v-if="store.filters.hasNote !== null" class="chip">
          {{ store.filters.hasNote ? 'Có note' : 'Không note' }}
          <span class="cx" @click="store.filters.hasNote = null">×</span>
        </span>
        <span v-if="store.filters.sttFrom || store.filters.sttTo" class="chip">
          STT {{ store.filters.sttFrom || '1' }}–{{ store.filters.sttTo || '∞' }}
          <span class="cx" @click="store.filters.sttFrom = ''; store.filters.sttTo = ''">×</span>
        </span>
        <span v-if="store.filters.sortBy !== 'stt' || store.filters.sortDir !== 'asc'" class="chip chip-sort">
          {{ sortLabel }}
          <span class="cx" @click="store.filters.sortBy = 'stt'; store.filters.sortDir = 'asc'">×</span>
        </span>
      </div>
    </div>

    <div class="gt-right">
      <span class="count-lbl">{{ store.filteredImages.length }}&thinsp;/&thinsp;{{ store.currentPool.length }}</span>

      <!-- Sort -->
      <div class="sort-wrap" title="Sắp xếp">
        <select v-model="store.filters.sortBy" class="sort-sel">
          <option value="stt">STT</option>
          <option value="id">ID</option>
          <option value="status">Trạng thái</option>
          <option value="note">Ghi chú</option>
        </select>
        <button class="sort-dir" @click="toggleDir" :title="store.filters.sortDir === 'asc' ? 'Tăng dần – click để đảo' : 'Giảm dần – click để đảo'">
          <svg v-if="store.filters.sortDir === 'asc'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        </button>
      </div>

      <!-- Compare indicator -->
      <button
        v-if="store.compareList.length > 0"
        class="compare-btn"
        @click="store.comparePanelOpen = !store.comparePanelOpen"
        :title="`${store.compareList.length} ảnh đang so sánh – click để xem`"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="7" height="18" rx="1"/><rect x="15" y="3" width="7" height="18" rx="1"/></svg>
        <span class="cb-count">{{ store.compareList.length }}</span>
      </button>

      <!-- Batch note -->
      <button
        v-if="store.batchNoteTargets.length > 0"
        class="batchnote-btn"
        @click="store.batchNoteOpen = true"
        :title="`Ghi chú hàng loạt cho ${store.batchNoteTargets.length} ảnh đã chọn`"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span class="cb-count">{{ store.batchNoteTargets.length }}</span>
      </button>

      <!-- Undo/Redo -->
      <button class="ict-btn" :disabled="!store.hasUndo" @click="store.undo()" title="Undo (Ctrl+Z)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>
      </button>
      <button class="ict-btn" :disabled="!store.hasRedo" @click="store.redo()" title="Redo (Ctrl+Y)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.96"/></svg>
      </button>

      <!-- Zoom slider -->
      <div class="zoom-wrap" title="Kéo để thay đổi kích thước ảnh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zi sm"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        <input
          type="range" class="zoom-slider"
          min="140" max="480" step="10"
          :value="store.colWidth"
          :style="sliderStyle"
          @input="store.setColWidth(+$event.target.value)"
        />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zi lg"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

defineProps({ sidebarOpen: Boolean })
defineEmits(['toggle-sidebar'])

const store = useGalleryStore()

const STATUS_LABELS = { all: 'Tất cả', selected: 'Đã chọn', rejected: 'Đã loại', pending: 'Chưa xử lý' }
const SORT_LABELS   = { stt: 'STT', id: 'ID', status: 'Trạng thái', note: 'Ghi chú' }
const statusLabel   = computed(() => STATUS_LABELS[store.filters.status] ?? store.filters.status)
const sortLabel     = computed(() => {
  const dir = store.filters.sortDir === 'asc' ? '↑' : '↓'
  return `${SORT_LABELS[store.filters.sortBy] ?? store.filters.sortBy} ${dir}`
})

const sliderStyle = computed(() => {
  const pct = ((store.colWidth - 140) / (480 - 140) * 100).toFixed(1)
  return { background: `linear-gradient(to right, var(--gold) ${pct}%, var(--border) ${pct}%)` }
})

function removeWarehouse(w) {
  const i = store.filters.warehouses.indexOf(w)
  if (i >= 0) store.filters.warehouses.splice(i, 1)
}

function toggleDir() {
  store.filters.sortDir = store.filters.sortDir === 'asc' ? 'desc' : 'asc'
}
</script>

<style scoped>
.gtoolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
  min-height: 46px;
}
.gt-left  { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; flex-wrap: wrap; }
.gt-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.gt-sidebar-btn {
  width: 32px; height: 32px; flex-shrink: 0;
  border: 1.5px solid var(--border); border-radius: 8px;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .14s;
}
.gt-sidebar-btn svg { width: 15px; height: 15px; color: var(--text-2); }
.gt-sidebar-btn:hover { border-color: var(--gold); background: var(--gold-faint); }
.gt-sidebar-btn:hover svg { color: var(--gold); }

.search-wrap { position: relative; display: flex; align-items: center; flex-shrink: 0; }
.si { position: absolute; left: 9px; width: 14px; height: 14px; color: var(--text-3); pointer-events: none; }
.search-in {
  width: 210px; padding: 5px 26px 5px 29px;
  border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 12.5px; color: var(--text); outline: none;
  background: var(--bg); transition: border-color .14s;
}
.search-in:focus { border-color: var(--gold); background: #fff; }
.sc {
  position: absolute; right: 7px;
  border: none; background: none; cursor: pointer;
  color: var(--text-3); font-size: 16px; line-height: 1; padding: 0;
}

.chips { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.chip {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 8px; border-radius: 10px;
  background: var(--gold-faint); border: 1px solid var(--gold-light);
  font-size: 11px; color: var(--gold-dark); white-space: nowrap;
}
.chip-sort { background: #F0F0FF; border-color: #C0C0E0; color: #4040A0; }
.cx { cursor: pointer; font-weight: 700; opacity: .6; margin-left: 1px; }
.cx:hover { opacity: 1; }

.count-lbl { font-size: 11.5px; color: var(--text-3); white-space: nowrap; min-width: 55px; text-align: right; }

/* Sort */
.sort-wrap { display: flex; align-items: center; gap: 2px; }
.sort-sel {
  height: 28px; padding: 0 6px;
  border: 1.5px solid var(--border); border-radius: 6px 0 0 6px;
  background: var(--bg); color: var(--text); font-size: 11.5px;
  font-family: inherit; outline: none; cursor: pointer;
  transition: border-color .14s;
}
.sort-sel:focus { border-color: var(--gold); }
.sort-dir {
  width: 28px; height: 28px;
  border: 1.5px solid var(--border); border-left: none; border-radius: 0 6px 6px 0;
  background: var(--bg); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-2); transition: all .14s;
}
.sort-dir svg { width: 13px; height: 13px; }
.sort-dir:hover { background: var(--gold-faint); border-color: var(--gold); color: var(--gold); }

/* Compare & BatchNote indicator buttons */
.compare-btn, .batchnote-btn {
  display: flex; align-items: center; gap: 4px;
  height: 28px; padding: 0 8px;
  border-radius: 7px; border: 1.5px solid var(--border);
  background: transparent; cursor: pointer;
  font-size: 11px; font-family: inherit;
  transition: all .14s;
  position: relative;
}
.compare-btn  { color: var(--gold-dark); border-color: var(--gold-light); background: var(--gold-faint); }
.batchnote-btn { color: #3B6EA5; border-color: #9BC0E0; background: #EEF4FB; }
.compare-btn svg, .batchnote-btn svg { width: 13px; height: 13px; }
.compare-btn:hover  { background: var(--gold-faint); border-color: var(--gold); }
.batchnote-btn:hover { background: #DCE9F8; }
.cb-count {
  background: rgba(0,0,0,.12); border-radius: 8px;
  padding: 0 4px; font-size: 10px; font-weight: 700;
}

.ict-btn {
  width: 29px; height: 29px;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--border); border-radius: 7px;
  background: transparent; cursor: pointer; color: var(--text-2);
  transition: all .12s;
}
.ict-btn svg { width: 13px; height: 13px; }
.ict-btn:hover:not(:disabled) { border-color: var(--gold); color: var(--gold); background: var(--gold-faint); }
.ict-btn:disabled { opacity: .3; cursor: not-allowed; }

.zoom-wrap { display: flex; align-items: center; gap: 4px; }
.zi { color: var(--text-3); flex-shrink: 0; }
.zi.sm { width: 13px; height: 13px; }
.zi.lg { width: 16px; height: 16px; }

.zoom-slider {
  width: 88px; cursor: pointer; outline: none;
  appearance: none; height: 3px;
  border-radius: 2px;
}
.zoom-slider::-webkit-slider-thumb {
  appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: var(--gold); border: 2.5px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.2); cursor: grab;
}
.zoom-slider:active::-webkit-slider-thumb { cursor: grabbing; }
.zoom-slider::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--gold); border: 2.5px solid #fff;
}
</style>

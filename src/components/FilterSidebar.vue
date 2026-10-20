<template>
  <div class="fsidebar">

    <!-- Status -->
    <div class="fs-section">
      <div class="fs-title">Trạng thái</div>
      <div class="fs-opts">
        <label v-for="s in statusOpts" :key="s.v" class="fs-opt">
          <input type="radio" v-model="store.filters.status" :value="s.v" />
          <span class="fs-opt-label">{{ s.label }}</span>
          <span class="fs-count">{{ countStatus(s.v) }}</span>
        </label>
      </div>
    </div>

    <!-- Note filter -->
    <div class="fs-section">
      <div class="fs-title">Ghi chú</div>
      <div class="fs-opts">
        <label class="fs-opt-check">
          <input type="checkbox" :checked="store.filters.hasNote === true" @change="toggleNote(true)" />
          <span class="fs-opt-label">Có ghi chú</span>
          <span class="fs-count">{{ countNote(true) }}</span>
        </label>
        <label class="fs-opt-check">
          <input type="checkbox" :checked="store.filters.hasNote === false" @change="toggleNote(false)" />
          <span class="fs-opt-label">Chưa có ghi chú</span>
        </label>
      </div>
    </div>

    <!-- STT range -->
    <div class="fs-section">
      <div class="fs-title">Khoảng STT</div>
      <div class="stt-row">
        <input v-model="store.filters.sttFrom" type="number" placeholder="Từ" class="stt-in" min="1" />
        <span class="stt-sep">–</span>
        <input v-model="store.filters.sttTo" type="number" placeholder="Đến" class="stt-in" min="1" />
      </div>
    </div>

    <div class="fs-divider"></div>

    <!-- Overall stats -->
    <div class="fs-section">
      <div class="fs-title">Thống kê vòng này</div>
      <div class="stat-list">
        <div class="stat-row">
          <span class="sd gray"></span><span class="sl">Pool</span>
          <strong>{{ stats.total }}</strong>
        </div>
        <div class="stat-row">
          <span class="sd green"></span><span class="sl">Đã chọn</span>
          <strong class="c-sel">{{ stats.selected }}</strong>
        </div>
        <div class="stat-row">
          <span class="sd red"></span><span class="sl">Đã loại</span>
          <strong class="c-rej">{{ stats.rejected }}</strong>
        </div>
        <div class="stat-row">
          <span class="sd muted"></span><span class="sl">Chưa xử lý</span>
          <strong>{{ stats.pending }}</strong>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="p-track">
          <div class="p-sel" :style="{ width: selPct + '%' }"></div>
          <div class="p-rej" :style="{ left: selPct + '%', width: rejPct + '%' }"></div>
        </div>
        <span class="p-pct">{{ done }}% đã xử lý</span>
      </div>
    </div>

    <div class="fs-divider"></div>

    <!-- Bulk actions -->
    <div class="fs-section">
      <div class="fs-title">Thao tác hàng loạt</div>
      <div class="bulk-list">
        <button class="ba sel" @click="store.selectAll()">✓ Chọn tất cả đang xem</button>
        <button class="ba" @click="store.deselectAll()">○ Bỏ chọn tất cả</button>
        <button class="ba rej" @click="store.rejectAll()">✗ Loại tất cả đang xem</button>
        <button
          v-if="store.batchNoteTargets.length > 0"
          class="ba note"
          @click="store.batchNoteOpen = true"
        >
          📝 Ghi chú {{ store.batchNoteTargets.length }} ảnh đã chọn
        </button>
      </div>
    </div>

    <!-- Clear filters -->
    <div v-if="hasFilters" class="fs-section">
      <button class="clear-all-btn" @click="store.resetFilters()">× Xóa tất cả bộ lọc</button>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store = useGalleryStore()

const statusOpts = [
  { v: 'all',      label: 'Tất cả' },
  { v: 'selected', label: '✓ Đã chọn' },
  { v: 'rejected', label: '✗ Đã loại' },
  { v: 'pending',  label: '⋯ Chưa xử lý' },
]

const stats  = computed(() => store.currentStats)
const selPct = computed(() => stats.value.total ? +(stats.value.selected / stats.value.total * 100).toFixed(1) : 0)
const rejPct = computed(() => stats.value.total ? +(stats.value.rejected / stats.value.total * 100).toFixed(1) : 0)
const done   = computed(() => stats.value.total ? +((stats.value.selected + stats.value.rejected) / stats.value.total * 100).toFixed(0) : 0)

const hasFilters = computed(() =>
  store.filters.search || store.filters.status !== 'all' ||
  store.filters.hasNote !== null || store.filters.sttFrom || store.filters.sttTo
)

function countStatus(v) {
  const pool = store.currentPool
  const rid  = store.currentRoundId
  if (v === 'all') return pool.length
  return pool.filter(i => {
    const s = store.selections[i.id]?.[rid] ?? null
    if (v === 'selected') return s === 'selected'
    if (v === 'rejected') return s === 'rejected'
    return s === null
  }).length
}
function countNote(has) { return store.currentPool.filter(i => has ? !!store.notes[i.id]?.text : !store.notes[i.id]?.text).length }
function toggleNote(val) { store.filters.hasNote = store.filters.hasNote === val ? null : val }
</script>

<style scoped>
.fsidebar { padding: 12px 0; height: 100%; overflow-y: auto; }

.fs-section { padding: 8px 14px; }

.fs-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .7px; color: var(--text-3); margin-bottom: 7px;
}

.fs-opts { display: flex; flex-direction: column; gap: 2px; }

.fs-opt, .fs-opt-check {
  display: flex; align-items: center; gap: 7px;
  padding: 5px 7px; border-radius: 7px; cursor: pointer;
  font-size: 12.5px; color: var(--text-2); transition: background .1s;
}
.fs-opt:hover, .fs-opt-check:hover { background: var(--bg); }
.fs-opt input, .fs-opt-check input { accent-color: var(--gold); cursor: pointer; flex-shrink: 0; }
.fs-opt-label { flex: 1; font-size: 12.5px; }

.fs-count {
  margin-left: auto; font-size: 10.5px; font-weight: 600;
  color: var(--text-3); background: var(--bg);
  padding: 1px 6px; border-radius: 8px; flex-shrink: 0;
}

.stt-row { display: flex; align-items: center; gap: 6px; padding: 0 7px; }
.stt-in {
  width: 68px; padding: 5px 7px;
  border: 1.5px solid var(--border); border-radius: 6px;
  font-size: 12px; color: var(--text); outline: none; background: var(--bg);
}
.stt-in:focus { border-color: var(--gold); background: #fff; }
.stt-sep { color: var(--text-3); font-size: 14px; }

.fs-divider { border-top: 1px solid var(--border-2); margin: 6px 0; }

/* Overall stats */
.stat-list { display: flex; flex-direction: column; gap: 3px; }
.stat-row { display: flex; align-items: center; gap: 7px; padding: 3px 7px; font-size: 12.5px; }
.sd { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.sd.gray  { background: var(--border); }
.sd.green { background: var(--selected); }
.sd.red   { background: var(--rejected); }
.sd.muted { background: var(--text-3); }
.sl { flex: 1; color: var(--text-2); }
.stat-row strong { font-weight: 700; color: var(--text); font-size: 12.5px; }
.c-sel { color: var(--selected); }
.c-rej { color: var(--rejected); }

.progress-wrap { padding: 5px 7px 2px; }
.p-track { position: relative; height: 5px; background: var(--border-2); border-radius: 3px; overflow: hidden; margin-bottom: 3px; }
.p-sel { position: absolute; left: 0; top: 0; height: 100%; background: var(--selected); transition: width .3s; }
.p-rej { position: absolute; top: 0; height: 100%; background: var(--rejected); transition: .3s; }
.p-pct { font-size: 10px; color: var(--text-3); }

/* Bulk actions */
.bulk-list { display: flex; flex-direction: column; gap: 5px; }
.ba {
  padding: 7px 10px; border-radius: 7px;
  border: 1.5px solid var(--border);
  background: transparent; cursor: pointer;
  font-size: 12px; color: var(--text-2);
  font-family: inherit; text-align: left;
  transition: all .12s;
}
.ba:hover      { border-color: var(--gold);     color: var(--gold);     background: var(--gold-faint); }
.ba.sel:hover  { border-color: var(--selected); color: var(--selected); background: var(--selected-bg); }
.ba.rej:hover  { border-color: var(--rejected); color: var(--rejected); background: var(--rejected-bg); }
.ba.note:hover { border-color: #3B6EA5; color: #3B6EA5; background: #EEF4FB; }

.clear-all-btn {
  width: 100%; padding: 7px 10px; border-radius: 7px;
  border: none; background: var(--gold); color: #fff;
  cursor: pointer; font-size: 12px; font-weight: 600;
  font-family: inherit; transition: background .12s;
}
.clear-all-btn:hover { background: var(--gold-dark); }
</style>

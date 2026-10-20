<template>
  <Teleport to="body">
    <!-- ── Bottom tray ──────────────────────────────────────────────── -->
    <Transition name="tray">
      <div v-if="store.compareList.length > 0" class="compare-tray">
        <div class="tray-images">
          <div
            v-for="(id, i) in store.compareList" :key="id"
            class="tray-item"
            :class="{ 'is-a': isDiff && diffA === id, 'is-b': isDiff && diffB === id }"
          >
            <div class="tray-badges">
              <span class="tray-num">{{ i + 1 }}</span>
              <span v-if="isDiff && diffA === id" class="ab-chip a">A</span>
              <span v-if="isDiff && diffB === id" class="ab-chip b">B</span>
            </div>
            <img :src="thumbOf(id)" class="tray-thumb" :alt="id" draggable="false" />
            <div class="tray-info">
              <span class="tray-id">{{ id }}</span>
              <span class="tray-st" :class="statusOf(id) ?? 'pending'">{{ statusLabel(id) }}</span>
            </div>
            <button class="tray-remove" @click="store.toggleCompare(id)" title="Xóa">×</button>
          </div>
        </div>
        <div class="tray-actions">
          <button class="tray-btn primary" @click="openOverlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            So sánh
          </button>
          <button class="tray-btn" @click="store.clearCompare()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Xóa hết
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Fullscreen overlay ───────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="store.comparePanelOpen" class="compare-overlay" ref="overlayEl">

        <!-- Header -->
        <div class="co-header">
          <div class="co-title-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="co-icon">
              <rect x="2" y="3" width="7" height="18" rx="1"/><rect x="15" y="3" width="7" height="18" rx="1"/>
            </svg>
            <span class="co-title">So sánh ảnh</span>
            <span class="co-badge">{{ store.compareList.length }}</span>
          </div>

          <!-- Mode toggle -->
          <div class="co-mode">
            <button class="mode-btn" :class="{ active: viewMode === 'diff' }" @click="setMode('diff')" :disabled="store.compareList.length < 2" title="Kéo slider để thấy sự khác biệt giữa 2 ảnh">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="5 8 2 12 5 16"/><polyline points="19 8 22 12 19 16"/></svg>
              Diff Slider
            </button>
            <button class="mode-btn" :class="{ active: viewMode === 'grid' }" @click="setMode('grid')" title="Xem tất cả ảnh cạnh nhau">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Lưới
            </button>
          </div>

          <button class="co-close" @click="store.comparePanelOpen = false" title="Đóng (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- ── DIFF MODE ─────────────────────────────────────────────── -->
        <template v-if="viewMode === 'diff'">

          <!-- Image pair selector (shown when >2 in compare list) -->
          <div v-if="store.compareList.length > 2" class="diff-selector">
            <span class="ds-hint">Click trái = A &nbsp;·&nbsp; Click phải = B</span>
            <div class="ds-thumbs">
              <div
                v-for="(id, i) in store.compareList" :key="id"
                class="ds-item"
                :class="{ 'sel-a': diffA === id, 'sel-b': diffB === id }"
                @click="setDiffA(id)"
                @contextmenu.prevent="setDiffB(id)"
                :title="`Click = đặt A · Chuột phải = đặt B`"
              >
                <img :src="thumbOf(id)" class="ds-img" />
                <span class="ds-chip a" v-if="diffA === id">A</span>
                <span class="ds-chip b" v-else-if="diffB === id">B</span>
                <span class="ds-stt">#{{ imgOf(id)?.stt }}</span>
              </div>
            </div>
          </div>

          <!-- Slider area -->
          <div
            class="diff-area"
            ref="sliderEl"
            @mousedown.prevent="startDrag"
            @touchstart.prevent="startDragTouch"
          >
            <!-- Image A — base layer (always fully visible) -->
            <div class="diff-layer">
              <img :src="thumbOf(diffA)" class="diff-img" :alt="diffA" draggable="false" />
            </div>

            <!-- Image B — top layer, clipped by slider position -->
            <div
              class="diff-layer diff-layer-b"
              :style="{ clipPath: `inset(0 ${(100 - sliderPos).toFixed(2)}% 0 0)` }"
            >
              <img :src="thumbOf(diffB)" class="diff-img" :alt="diffB" draggable="false" />
            </div>

            <!-- Labels -->
            <div class="diff-label dl-left">
              <span class="dl-tag a">A</span>
              <span class="dl-id">{{ imgOf(diffA)?.id }}</span>
              <span class="dl-stt">#{{ imgOf(diffA)?.stt }}</span>
            </div>
            <div class="diff-label dl-right">
              <span class="dl-stt">#{{ imgOf(diffB)?.stt }}</span>
              <span class="dl-id">{{ imgOf(diffB)?.id }}</span>
              <span class="dl-tag b">B</span>
            </div>

            <!-- Drag handle -->
            <div class="diff-handle" :style="{ left: sliderPos + '%' }" @mousedown.stop.prevent="startDrag">
              <div class="dh-line"></div>
              <div class="dh-knob">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
                  <polyline points="9 18 3 12 9 6"/><polyline points="15 6 21 12 15 18"/>
                </svg>
              </div>
            </div>

            <!-- Percentage hint -->
            <div class="diff-pct">{{ Math.round(sliderPos) }}%</div>
          </div>

          <!-- Diff footer: action buttons for A and B -->
          <div class="diff-footer">
            <div class="df-card" v-for="(id, side) in [diffA, diffB]" :key="id">
              <div class="df-tag" :class="side === 0 ? 'a' : 'b'">{{ side === 0 ? 'A' : 'B' }}</div>
              <div class="df-meta">
                <span class="df-id">{{ imgOf(id)?.id }}</span>
                <span class="df-stt">#{{ imgOf(id)?.stt }}</span>
                <span class="df-status" :class="statusOf(id) ?? 'pending'">{{ statusLabel(id) }}</span>
              </div>
              <div class="df-btns">
                <button class="dfb sel" :class="{ active: statusOf(id) === 'selected' }" @click="toggleSelect(id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  Chọn
                </button>
                <button class="dfb rej" :class="{ active: statusOf(id) === 'rejected' }" @click="toggleReject(id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Loại
                </button>
              </div>
            </div>
            <button class="swap-btn" @click="swapAB" title="Đổi A và B">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              A↔B
            </button>
          </div>
        </template>

        <!-- ── GRID MODE ─────────────────────────────────────────────── -->
        <div v-else class="co-grid" :class="`cols-${gridCols}`">
          <div v-for="(id, i) in store.compareList" :key="id" class="co-card">
            <div class="co-num">{{ i + 1 }}</div>
            <div class="co-img-wrap">
              <img :src="thumbOf(id)" class="co-img" :alt="id" draggable="false" />
            </div>
            <div class="co-meta">
              <div class="co-id">{{ imgOf(id)?.id }}</div>
              <div class="co-stt">STT #{{ imgOf(id)?.stt }}</div>
              <div class="co-status" :class="statusOf(id) ?? 'pending'">{{ statusLabel(id) }}</div>
              <div v-if="noteOf(id)" class="co-note">{{ noteOf(id) }}</div>
            </div>
            <div class="co-btns">
              <button class="co-sel" :class="{ active: statusOf(id) === 'selected' }" @click="toggleSelect(id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Chọn
              </button>
              <button class="co-rej" :class="{ active: statusOf(id) === 'rejected' }" @click="toggleReject(id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Loại
              </button>
              <button class="co-rm" @click="store.toggleCompare(id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store      = useGalleryStore()
const overlayEl  = ref(null)
const sliderEl   = ref(null)
const viewMode   = ref('diff')   // 'diff' | 'grid'
const sliderPos  = ref(50)       // 0–100 %
const isDragging = ref(false)

// Which images are A and B in diff mode
const diffA = ref('')
const diffB = ref('')

const isDiff = computed(() => viewMode.value === 'diff')
const gridCols = computed(() => Math.min(4, Math.max(1, store.compareList.length)))

// Image lookup
const imageMap = computed(() => {
  const m = {}
  for (const img of store.images) m[img.id] = img
  return m
})
function imgOf(id)    { return imageMap.value[id] }
function thumbOf(id)  { const img = imgOf(id); return img ? `./${img.thumbPath}` : '' }
function statusOf(id) { return store.selections[id]?.[store.currentRoundId] ?? null }
const ST = { selected: 'Đã chọn', rejected: 'Đã loại' }
function statusLabel(id) { return ST[statusOf(id)] ?? 'Chưa xử lý' }
function noteOf(id)   { return store.notes[id]?.text || '' }

// Initialise diff pair whenever the compare list or overlay changes
watch(
  () => [store.compareList.slice(), store.comparePanelOpen],
  () => initDiffPair(),
  { deep: true, immediate: true }
)

function initDiffPair() {
  const list = store.compareList
  if (list.length === 0) return
  if (!list.includes(diffA.value)) diffA.value = list[0] ?? ''
  if (!list.includes(diffB.value) || diffB.value === diffA.value) diffB.value = list[1] ?? list[0] ?? ''
}

function setMode(m) {
  viewMode.value = m
  if (m === 'diff') initDiffPair()
}

function openOverlay() {
  initDiffPair()
  // Default diff when exactly 2, grid when 3+
  viewMode.value = store.compareList.length === 2 ? 'diff' : 'grid'
  store.comparePanelOpen = true
}

function setDiffA(id) { diffA.value = id; if (diffB.value === id) diffB.value = store.compareList.find(x => x !== id) ?? '' }
function setDiffB(id) { diffB.value = id; if (diffA.value === id) diffA.value = store.compareList.find(x => x !== id) ?? '' }
function swapAB()     { const tmp = diffA.value; diffA.value = diffB.value; diffB.value = tmp }

// ── Drag logic ────────────────────────────────────────────────────────────────

function getSliderPos(clientX) {
  if (!sliderEl.value) return sliderPos.value
  const rect = sliderEl.value.getBoundingClientRect()
  return Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100))
}

function startDrag(e) {
  isDragging.value = true
  sliderPos.value  = getSliderPos(e.clientX ?? e.touches?.[0]?.clientX)
}
function startDragTouch(e) {
  isDragging.value = true
  sliderPos.value  = getSliderPos(e.touches[0].clientX)
}
function onMouseMove(e)  { if (isDragging.value) sliderPos.value = getSliderPos(e.clientX) }
function onTouchMove(e)  { if (isDragging.value) sliderPos.value = getSliderPos(e.touches[0].clientX) }
function stopDrag()      { isDragging.value = false }

// Keyboard shortcuts inside overlay
function onKeyDown(e) {
  if (!store.comparePanelOpen) return
  if (e.key === 'Escape') { store.comparePanelOpen = false; return }
  if (viewMode.value !== 'diff') return
  if (e.key === 'ArrowLeft')  sliderPos.value = Math.max(0,   sliderPos.value - 5)
  if (e.key === 'ArrowRight') sliderPos.value = Math.min(100, sliderPos.value + 5)
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); swapAB() }
}

function toggleSelect(id) { store.setStatus(id, store.currentRoundId, statusOf(id) === 'selected' ? null : 'selected') }
function toggleReject(id) { store.setStatus(id, store.currentRoundId, statusOf(id) === 'rejected' ? null : 'rejected') }

onMounted(() => {
  window.addEventListener('mousemove',   onMouseMove)
  window.addEventListener('mouseup',     stopDrag)
  window.addEventListener('touchmove',   onTouchMove, { passive: true })
  window.addEventListener('touchend',    stopDrag)
  window.addEventListener('keydown',     onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('mousemove',  onMouseMove)
  window.removeEventListener('mouseup',    stopDrag)
  window.removeEventListener('touchmove',  onTouchMove)
  window.removeEventListener('touchend',   stopDrag)
  window.removeEventListener('keydown',    onKeyDown)
})
</script>

<style scoped>
/* ── Tray ─────────────────────────────────────────────────────────────────── */
.compare-tray {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: rgba(255,255,255,.97);
  border-top: 2px solid var(--gold-light);
  box-shadow: 0 -4px 24px rgba(0,0,0,.14);
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  backdrop-filter: blur(10px);
}
.tray-enter-active, .tray-leave-active { transition: transform .22s ease, opacity .2s; }
.tray-enter-from, .tray-leave-to { transform: translateY(100%); opacity: 0; }

.tray-images { display: flex; gap: 8px; flex: 1; overflow-x: auto; }

.tray-item {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px;
  padding: 5px 8px; min-width: 170px; flex-shrink: 0; transition: border-color .14s;
}
.tray-item.is-a { border-color: #4FC3F7; background: rgba(79,195,247,.06); }
.tray-item.is-b { border-color: #FFB74D; background: rgba(255,183,77,.06); }

.tray-badges { display: flex; flex-direction: column; gap: 2px; align-items: center; }
.tray-num {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--gold); color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.ab-chip {
  font-size: 9px; font-weight: 800; padding: 0 4px; border-radius: 4px; line-height: 14px;
}
.ab-chip.a { background: #4FC3F7; color: #01579B; }
.ab-chip.b { background: #FFB74D; color: #E65100; }

.tray-thumb { width: 38px; height: 52px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.tray-info  { flex: 1; min-width: 0; }
.tray-id  { display: block; font-size: 10px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tray-st  { display: block; font-size: 10px; margin-top: 2px; font-weight: 600; }
.tray-st.selected { color: var(--selected); }
.tray-st.rejected { color: var(--rejected); }
.tray-st.pending  { color: var(--text-3); }

.tray-remove {
  width: 20px; height: 20px; border-radius: 50%; border: none;
  background: var(--border); cursor: pointer; font-size: 14px;
  color: var(--text-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.tray-remove:hover { background: #f0d0d0; color: var(--rejected); }

.tray-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.tray-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 8px;
  border: 1.5px solid var(--border); background: transparent;
  cursor: pointer; font-size: 12px; font-family: inherit;
  color: var(--text-2); transition: all .12s; white-space: nowrap;
}
.tray-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
.tray-btn:hover { border-color: var(--gold); color: var(--gold-dark); background: var(--gold-faint); }
.tray-btn.primary { background: var(--gold); border-color: var(--gold); color: #fff; }
.tray-btn.primary:hover { background: var(--gold-dark); }

/* ── Fullscreen overlay ───────────────────────────────────────────────────── */
.compare-overlay {
  position: fixed; inset: 0; z-index: 400;
  background: #111;
  display: flex; flex-direction: column; overflow: hidden;
}
.fade-enter-active, .fade-leave-active { transition: opacity .18s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Header */
.co-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  background: rgba(0,0,0,.6);
  border-bottom: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}
.co-title-group { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.co-icon { width: 16px; height: 16px; color: var(--gold); flex-shrink: 0; }
.co-title { font-size: 15px; font-weight: 700; color: #fff; }
.co-badge {
  font-size: 11px; font-weight: 700;
  background: var(--gold); color: #fff;
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}

/* Mode toggle */
.co-mode { display: flex; gap: 2px; background: rgba(255,255,255,.06); border-radius: 8px; padding: 2px; flex-shrink: 0; }
.mode-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 6px;
  border: none; background: transparent; cursor: pointer;
  font-size: 12px; font-weight: 500; font-family: inherit;
  color: rgba(255,255,255,.55); transition: all .14s;
}
.mode-btn svg { width: 13px; height: 13px; }
.mode-btn:hover:not(:disabled) { color: rgba(255,255,255,.85); background: rgba(255,255,255,.08); }
.mode-btn.active { background: rgba(255,255,255,.15); color: #fff; }
.mode-btn:disabled { opacity: .3; cursor: not-allowed; }

.co-close {
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.15);
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #fff;
  transition: background .14s; flex-shrink: 0;
}
.co-close svg { width: 15px; height: 15px; }
.co-close:hover { background: rgba(255,255,255,.12); }

/* ── Diff mode ─────────────────────────────────────────────────────────────── */

/* Image pair selector (shown when >2 images) */
.diff-selector {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 16px;
  background: rgba(0,0,0,.4);
  border-bottom: 1px solid rgba(255,255,255,.06);
  flex-shrink: 0;
}
.ds-hint { font-size: 11px; color: rgba(255,255,255,.4); white-space: nowrap; }
.ds-thumbs { display: flex; gap: 6px; overflow-x: auto; }
.ds-item {
  position: relative; width: 48px; height: 64px; flex-shrink: 0;
  border-radius: 5px; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; transition: border-color .14s;
}
.ds-item:hover    { border-color: rgba(255,255,255,.4); }
.ds-item.sel-a    { border-color: #4FC3F7; }
.ds-item.sel-b    { border-color: #FFB74D; }
.ds-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ds-chip {
  position: absolute; top: 2px; left: 2px;
  font-size: 9px; font-weight: 800; padding: 0 3px; border-radius: 3px; line-height: 14px;
}
.ds-chip.a { background: #4FC3F7; color: #01579B; }
.ds-chip.b { background: #FFB74D; color: #E65100; }
.ds-stt {
  position: absolute; bottom: 2px; left: 0; right: 0; text-align: center;
  font-size: 9px; color: #fff; font-weight: 600;
  text-shadow: 0 1px 2px rgba(0,0,0,.8);
}

/* Diff slider */
.diff-area {
  flex: 1; position: relative; overflow: hidden;
  cursor: col-resize; user-select: none;
  background: #000;
  display: flex; align-items: stretch;
}

.diff-layer {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
}
.diff-img {
  max-width: 100%; max-height: 100%;
  object-fit: contain; display: block;
  pointer-events: none;
  image-rendering: high-quality;
}

/* Labels */
.diff-label {
  position: absolute; top: 12px; z-index: 5;
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 20px;
  background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
  color: rgba(255,255,255,.9); font-size: 11px;
  pointer-events: none;
}
.dl-left  { left: 16px; }
.dl-right { right: 16px; flex-direction: row-reverse; }
.dl-tag {
  font-size: 11px; font-weight: 800; padding: 1px 6px; border-radius: 4px;
}
.dl-tag.a { background: #4FC3F7; color: #01579B; }
.dl-tag.b { background: #FFB74D; color: #E65100; }
.dl-id   { font-weight: 600; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-stt  { color: rgba(255,255,255,.5); font-size: 10px; }

/* Slider handle */
.diff-handle {
  position: absolute; top: 0; bottom: 0; z-index: 10;
  transform: translateX(-50%); pointer-events: none;
}
.dh-line {
  position: absolute; top: 0; bottom: 0; left: 50%;
  width: 2px; background: rgba(255,255,255,.9);
  box-shadow: 0 0 8px rgba(0,0,0,.6);
  transform: translateX(-50%);
}
.dh-knob {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.5);
  pointer-events: all; cursor: col-resize;
}
.dh-knob svg { color: #333; }

/* Percentage indicator */
.diff-pct {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 11px; font-weight: 700; color: rgba(255,255,255,.75);
  background: rgba(0,0,0,.5); padding: 2px 8px; border-radius: 10px;
  pointer-events: none; z-index: 6;
}

/* Diff footer */
.diff-footer {
  display: flex; gap: 8px; align-items: stretch;
  padding: 10px 16px;
  background: rgba(0,0,0,.5);
  border-top: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}
.df-card {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.05); border-radius: 8px;
  padding: 8px 12px;
}
.df-tag {
  font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px; flex-shrink: 0;
}
.df-tag.a { background: #4FC3F7; color: #01579B; }
.df-tag.b { background: #FFB74D; color: #E65100; }
.df-meta { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.df-id  { font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.df-stt { font-size: 10px; color: rgba(255,255,255,.4); }
.df-status { font-size: 10px; font-weight: 600; }
.df-status.selected { color: #81C784; }
.df-status.rejected { color: #E57373; }
.df-status.pending  { color: rgba(255,255,255,.4); }
.df-btns { display: flex; gap: 5px; flex-shrink: 0; }
.dfb {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.15);
  background: transparent; cursor: pointer;
  font-size: 11px; font-family: inherit; color: rgba(255,255,255,.65);
  transition: all .14s;
}
.dfb svg { width: 10px; height: 10px; }
.dfb.sel:hover, .dfb.sel.active { background: rgba(46,125,50,.5); border-color: #4CAF50; color: #81C784; }
.dfb.rej:hover, .dfb.rej.active { background: rgba(198,40,40,.5); border-color: #E53935; color: #E57373; }

.swap-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 8px 12px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,.15); background: transparent;
  cursor: pointer; font-size: 12px; font-family: inherit;
  color: rgba(255,255,255,.55); transition: all .14s; flex-shrink: 0;
}
.swap-btn svg { width: 14px; height: 14px; }
.swap-btn:hover { border-color: rgba(255,255,255,.35); color: rgba(255,255,255,.9); }

/* ── Grid mode ────────────────────────────────────────────────────────────── */
.co-grid {
  display: grid; flex: 1;
  gap: 2px; padding: 8px; overflow: auto; align-items: start;
}
.co-grid.cols-1 { grid-template-columns: 1fr; max-width: 540px; margin: 0 auto; }
.co-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.co-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.co-grid.cols-4 { grid-template-columns: repeat(2, 1fr); }

.co-card {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px; overflow: hidden;
  display: flex; flex-direction: column; position: relative;
}
.co-num {
  position: absolute; top: 8px; left: 8px; z-index: 2;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--gold); color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.co-img-wrap { position: relative; overflow: hidden; }
.co-img { width: 100%; height: auto; display: block; image-rendering: high-quality; }
.co-meta {
  padding: 8px 10px 4px;
  border-top: 1px solid rgba(255,255,255,.06);
  display: flex; flex-direction: column; gap: 2px;
}
.co-id     { font-size: 11px; font-weight: 700; color: #fff; }
.co-stt    { font-size: 9px;  color: rgba(255,255,255,.4); }
.co-status { font-size: 10px; font-weight: 600; }
.co-status.selected { color: #81C784; }
.co-status.rejected { color: #E57373; }
.co-status.pending  { color: rgba(255,255,255,.35); }
.co-note   { font-size: 9px; color: rgba(255,255,255,.45); font-style: italic; }
.co-btns   { display: flex; gap: 4px; padding: 6px 10px; border-top: 1px solid rgba(255,255,255,.05); }
.co-sel, .co-rej {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 5px 0; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.12);
  background: transparent; cursor: pointer;
  font-size: 10px; font-family: inherit; color: rgba(255,255,255,.6); transition: all .14s;
}
.co-sel svg, .co-rej svg { width: 10px; height: 10px; }
.co-sel:hover, .co-sel.active { background: rgba(46,125,50,.4); border-color: #4CAF50; color: #81C784; }
.co-rej:hover, .co-rej.active { background: rgba(198,40,40,.4); border-color: #E53935; color: #E57373; }
.co-rm {
  width: 28px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.08); background: transparent;
  cursor: pointer; color: rgba(255,255,255,.35); transition: all .14s;
  display: flex; align-items: center; justify-content: center;
}
.co-rm svg { width: 11px; height: 11px; }
.co-rm:hover { background: rgba(255,255,255,.08); color: #E57373; }
</style>

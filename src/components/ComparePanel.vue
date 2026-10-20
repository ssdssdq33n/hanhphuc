<template>
  <Teleport to="body">
    <!-- ── Bottom tray ──────────────────────────────────────────────────────── -->
    <Transition name="tray">
      <div v-if="store.compareList.length > 0" class="compare-tray">
        <div class="tray-images">
          <div v-for="(id, i) in store.compareList" :key="id" class="tray-item">
            <span class="tray-num">{{ i + 1 }}</span>
            <img :src="thumbOf(id)" class="tray-thumb" :alt="id" draggable="false" />
            <div class="tray-info">
              <span class="tray-id">{{ id }}</span>
              <span class="tray-st" :class="statusOf(id) ?? 'pending'">{{ statusLabel(id) }}</span>
            </div>
            <button class="tray-rm" @click="store.toggleCompare(id)" title="Xóa">×</button>
          </div>
        </div>
        <div class="tray-actions">
          <button class="tray-btn primary" @click="openOverlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            So sánh ({{ store.compareList.length }})
          </button>
          <button class="tray-btn" @click="store.clearCompare()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Xóa hết
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Fullscreen overlay ───────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="store.comparePanelOpen" class="compare-overlay" ref="overlayEl">

        <!-- Header -->
        <div class="co-header">
          <div class="co-title-group">
            <span class="co-title">So sánh ảnh</span>
            <span class="co-badge">{{ store.compareList.length }}</span>
            <span v-if="store.imagesReady" class="quality-chip" title="Đang dùng ảnh gốc chất lượng cao">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
              Ảnh gốc
            </span>
            <button v-else-if="fsSupported" class="quality-btn" @click="store.pickImagesFolder()" title="Chọn thư mục ảnh gốc để so sánh chất lượng cao">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Tải ảnh gốc
            </button>
          </div>

          <div class="co-mode">
            <button class="mode-btn" :class="{ active: viewMode === 'diff' }" @click="setMode('diff')" :disabled="store.compareList.length < 2" title="Kéo slider để thấy sự khác biệt">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="5 8 2 12 5 16"/><polyline points="19 8 22 12 19 16"/></svg>
              Diff Slider
            </button>
            <button class="mode-btn" :class="{ active: viewMode === 'split' }" @click="setMode('split')" title="Xem song song + zoom đồng bộ (scroll = zoom, drag = pan)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
              Song song
            </button>
          </div>

          <button class="co-close" @click="store.comparePanelOpen = false" title="Đóng (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- ══════════════ DIFF SLIDER MODE ══════════════ -->
        <template v-if="viewMode === 'diff'">

          <!-- Pair selector (when >2 images) -->
          <div v-if="store.compareList.length > 2" class="diff-selector">
            <span class="ds-hint">Click = A &nbsp;·&nbsp; Chuột phải = B</span>
            <div class="ds-thumbs">
              <div v-for="id in store.compareList" :key="id"
                class="ds-item" :class="{ 'sel-a': diffA === id, 'sel-b': diffB === id }"
                @click="setDiffA(id)" @contextmenu.prevent="setDiffB(id)"
              >
                <img :src="thumbOf(id)" class="ds-img" draggable="false" />
                <span class="ds-chip a" v-if="diffA === id">A</span>
                <span class="ds-chip b" v-else-if="diffB === id">B</span>
                <span class="ds-stt">#{{ imgOf(id)?.stt }}</span>
              </div>
            </div>
          </div>

          <!-- Diff slider -->
          <div class="diff-area" ref="sliderEl"
            @mousedown.prevent="startSliderDrag"
            @touchstart.prevent="startSliderDragTouch"
          >
            <div class="diff-layer">
              <img :src="activeImgSrc(diffA)" class="diff-img" :alt="diffA" draggable="false" @load="onImgLoad(diffA)" />
              <div v-if="isLoading(diffA)" class="diff-loading"><div class="spin"></div></div>
            </div>
            <div class="diff-layer diff-layer-b" :style="{ clipPath: `inset(0 ${(100-sliderPos).toFixed(2)}% 0 0)` }">
              <img :src="activeImgSrc(diffB)" class="diff-img" :alt="diffB" draggable="false" @load="onImgLoad(diffB)" />
              <div v-if="isLoading(diffB)" class="diff-loading"><div class="spin"></div></div>
            </div>

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

            <div class="diff-handle" :style="{ left: sliderPos + '%' }">
              <div class="dh-line"></div>
              <div class="dh-knob">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
                  <polyline points="9 18 3 12 9 6"/><polyline points="15 6 21 12 15 18"/>
                </svg>
              </div>
            </div>
            <div class="diff-pct">{{ Math.round(sliderPos) }}%</div>
          </div>

          <div class="diff-footer">
            <div class="df-card" v-for="(id, si) in [diffA, diffB]" :key="id + si">
              <div class="df-tag" :class="si === 0 ? 'a' : 'b'">{{ si === 0 ? 'A' : 'B' }}</div>
              <div class="df-meta">
                <span class="df-id">{{ imgOf(id)?.id }}</span>
                <span class="df-stt">#{{ imgOf(id)?.stt }}</span>
                <span class="df-status" :class="statusOf(id) ?? 'pending'">{{ statusLabel(id) }}</span>
              </div>
              <div class="df-btns">
                <button class="dfb sel" :class="{ active: statusOf(id) === 'selected' }" @click="toggleSelect(id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Chọn
                </button>
                <button class="dfb rej" :class="{ active: statusOf(id) === 'rejected' }" @click="toggleReject(id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Loại
                </button>
              </div>
            </div>
            <button class="swap-btn" @click="swapAB" title="Đổi A↔B (S)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              A↔B
            </button>
          </div>
        </template>

        <!-- ══════════════ SPLIT / MULTI-PANEL MODE ══════════════ -->
        <template v-else>
          <!-- Zoom bar -->
          <div class="zoom-bar">
            <button class="zb-btn" @click="zoomOut" :disabled="zoom <= 1" title="Thu nhỏ (-)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div class="zb-pct" @click="resetZoom" title="Click để reset 100%">{{ Math.round(zoom * 100) }}%</div>
            <button class="zb-btn" @click="zoomIn" :disabled="zoom >= 8" title="Phóng to (+)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <div class="zb-sep"></div>
            <span class="zb-hint">Scroll = zoom &nbsp;·&nbsp; Drag = pan &nbsp;·&nbsp; Dbl-click = reset &nbsp;·&nbsp; Kéo đường phân cách để thay đổi tỉ lệ</span>
          </div>

          <!-- Split area -->
          <div class="split-area" ref="splitAreaEl"
            @wheel.prevent="onWheelSplit"
            @mousedown="startPan"
            @dblclick="resetZoom"
            :style="{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }"
          >
            <!-- Zoom wrap (all panels inside, transform here) -->
            <div class="split-zoom-wrap" :style="zoomWrapStyle">
              <div
                v-for="panel in panelLayout" :key="panel.id"
                class="split-panel"
                :style="{ left: panel.left + '%', width: panel.width + '%' }"
              >
                <img :src="activeImgSrc(panel.id)" class="split-img" :alt="panel.id" draggable="false" @load="onImgLoad(panel.id)" />
                <div v-if="isLoading(panel.id)" class="split-loading"><div class="spin"></div></div>
              </div>
            </div>

            <!-- Dividers (outside zoom-wrap, fixed position) -->
            <div
              v-for="(pos, di) in dividerPositions" :key="'div-' + di"
              class="split-divider"
              :style="{ left: pos + '%' }"
              @mousedown.stop.prevent="startDividerDrag(di, $event)"
              title="Kéo để thay đổi tỉ lệ"
            >
              <div class="divider-line"></div>
              <div class="divider-knob">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                  <line x1="5" y1="9" x2="5" y2="15"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="19" y1="9" x2="19" y2="15"/>
                </svg>
              </div>
            </div>

            <!-- Panel labels (top-center of each panel, outside zoom) -->
            <div class="panel-labels">
              <div
                v-for="(panel, pi) in panelLayout" :key="panel.id + '-lbl'"
                class="panel-label"
                :style="{ left: (panel.left + panel.width / 2) + '%' }"
              >
                <span class="pl-num">{{ pi + 1 }}</span>
                <span class="pl-id">{{ panel.id }}</span>
                <span class="pl-stt">#{{ imgOf(panel.id)?.stt }}</span>
              </div>
            </div>
          </div>

          <!-- Per-panel action bar -->
          <div class="split-actions">
            <div v-for="(panel, pi) in panelLayout" :key="panel.id + '-act'" class="sa-card">
              <span class="sa-num">{{ pi + 1 }}</span>
              <span class="sa-id">{{ imgOf(panel.id)?.id }}</span>
              <span class="sa-status" :class="statusOf(panel.id) ?? 'pending'">{{ statusLabel(panel.id) }}</span>
              <div class="sa-btns">
                <button class="sab sel" :class="{ active: statusOf(panel.id) === 'selected' }" @click="toggleSelect(panel.id)" title="Chọn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
                <button class="sab rej" :class="{ active: statusOf(panel.id) === 'rejected' }" @click="toggleReject(panel.id)" title="Loại">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <button class="sab rm" @click="store.toggleCompare(panel.id)" title="Xóa khỏi compare">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </template>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store       = useGalleryStore()
const overlayEl   = ref(null)
const sliderEl    = ref(null)
const splitAreaEl = ref(null)

const fsSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

// ── View mode ──────────────────────────────────────────────────────────────────
const viewMode = ref('diff')

function setMode(m) {
  viewMode.value = m
  if (m === 'diff') { initDiffPair() }
  else              { resetZoom(); initSplitRatios() }
}

function openOverlay() {
  viewMode.value = store.compareList.length <= 2 ? 'diff' : 'split'
  initDiffPair()
  initSplitRatios()
  resetZoom()
  store.comparePanelOpen = true
  nextTick(loadFullResForAll)
}

// ── Image helpers ──────────────────────────────────────────────────────────────
const imageMap = computed(() => {
  const m = {}
  for (const img of store.images) m[img.id] = img
  return m
})
function imgOf(id)   { return imageMap.value[id] }
function thumbOf(id) { const img = imgOf(id); return img ? `./${img.thumbPath}` : '' }

const ST_LABEL = { selected: 'Đã chọn', rejected: 'Đã loại' }
function statusOf(id)    { return store.selections[id]?.[store.currentRoundId] ?? null }
function statusLabel(id) { return ST_LABEL[statusOf(id)] ?? 'Chưa xử lý' }
function toggleSelect(id){ store.setStatus(id, store.currentRoundId, statusOf(id) === 'selected' ? null : 'selected') }
function toggleReject(id){ store.setStatus(id, store.currentRoundId, statusOf(id) === 'rejected' ? null : 'rejected') }

// ── Full-res loading ───────────────────────────────────────────────────────────
const fullResMap = ref({})  // id → blob URL
const loadingIds = ref(new Set())

function isLoading(id) { return loadingIds.value.has(id) }

function activeImgSrc(id) {
  if (!id) return ''
  return fullResMap.value[id] ?? thumbOf(id)
}

function onImgLoad(id) {
  const s = new Set(loadingIds.value); s.delete(id); loadingIds.value = s
}

async function loadFullResFor(id) {
  if (!store.imagesReady || fullResMap.value[id]) return
  const img = imgOf(id)
  if (!img) return
  const s = new Set(loadingIds.value); s.add(id); loadingIds.value = s
  const url = await store.getFullResUrl(img)
  if (url) fullResMap.value = { ...fullResMap.value, [id]: url }
  const s2 = new Set(loadingIds.value); s2.delete(id); loadingIds.value = s2
}

async function loadFullResForAll() {
  if (!store.imagesReady) return
  for (const id of store.compareList) loadFullResFor(id)
}

watch(() => store.imagesReady, v => { if (v && store.comparePanelOpen) loadFullResForAll() })

// ── DIFF MODE ─────────────────────────────────────────────────────────────────
const diffA     = ref('')
const diffB     = ref('')
const sliderPos = ref(50)
const isSliding = ref(false)

function initDiffPair() {
  const list = store.compareList
  if (!list.length) return
  if (!list.includes(diffA.value))                          diffA.value = list[0]
  if (!list.includes(diffB.value) || diffB.value === diffA.value)
    diffB.value = list.find(x => x !== diffA.value) ?? list[0]
}

function setDiffA(id) {
  diffA.value = id
  if (diffB.value === id) diffB.value = store.compareList.find(x => x !== id) ?? ''
}
function setDiffB(id) {
  diffB.value = id
  if (diffA.value === id) diffA.value = store.compareList.find(x => x !== id) ?? ''
}
function swapAB() { const t = diffA.value; diffA.value = diffB.value; diffB.value = t }

function getSliderPct(clientX) {
  if (!sliderEl.value) return sliderPos.value
  const r = sliderEl.value.getBoundingClientRect()
  return Math.max(0, Math.min(100, (clientX - r.left) / r.width * 100))
}
function startSliderDrag(e)      { isSliding.value = true; sliderPos.value = getSliderPct(e.clientX) }
function startSliderDragTouch(e) { isSliding.value = true; sliderPos.value = getSliderPct(e.touches[0].clientX) }

// ── SPLIT MODE ────────────────────────────────────────────────────────────────
const splitRatios = ref([50, 50])

function initSplitRatios() {
  const n = store.compareList.length || 2
  const each = 100 / n
  splitRatios.value = Array.from({ length: n }, (_, i) =>
    i < n - 1 ? each : 100 - each * (n - 1)
  )
}

const panelLayout = computed(() => {
  let left = 0
  return store.compareList.map((id, i) => {
    const l = left
    left += splitRatios.value[i] ?? 0
    return { id, left: l, width: splitRatios.value[i] ?? 0 }
  })
})

const dividerPositions = computed(() => {
  let acc = 0
  return splitRatios.value.slice(0, -1).map(r => { acc += r; return acc })
})

// Divider drag
const activeDivider  = ref(-1)
const dividerStartX  = ref(0)
const dividerStartR  = ref([])

function startDividerDrag(idx, e) {
  activeDivider.value = idx
  dividerStartX.value = e.clientX
  dividerStartR.value = [...splitRatios.value]
}
function onDividerMove(e) {
  if (activeDivider.value < 0 || !splitAreaEl.value) return
  const rect = splitAreaEl.value.getBoundingClientRect()
  const dPct = (e.clientX - dividerStartX.value) / rect.width * 100
  const newR  = [...dividerStartR.value]
  const i     = activeDivider.value
  const MIN   = 8
  const a     = Math.max(MIN, newR[i]     + dPct)
  const b     = Math.max(MIN, newR[i + 1] - dPct)
  const total = newR[i] + newR[i + 1]
  newR[i]     = Math.min(total - MIN, a)
  newR[i + 1] = total - newR[i]
  splitRatios.value = newR
}
function stopDivider() { activeDivider.value = -1 }

// Zoom & pan
const zoom      = ref(1)
const panX      = ref(0)
const panY      = ref(0)
const isPanning = ref(false)
const panStart  = ref({ x: 0, y: 0, px: 0, py: 0 })

const zoomWrapStyle = computed(() => ({
  transform: zoom.value === 1
    ? 'none'
    : `scale(${zoom.value}) translate(${(panX.value / zoom.value).toFixed(2)}px, ${(panY.value / zoom.value).toFixed(2)}px)`,
  transformOrigin: 'center center',
}))

function clampPan() {
  if (!splitAreaEl.value) return
  const r    = splitAreaEl.value.getBoundingClientRect()
  const maxX = Math.max(0, (zoom.value - 1) / 2 * r.width)
  const maxY = Math.max(0, (zoom.value - 1) / 2 * r.height)
  panX.value = Math.max(-maxX, Math.min(maxX, panX.value))
  panY.value = Math.max(-maxY, Math.min(maxY, panY.value))
}

function resetZoom() { zoom.value = 1; panX.value = 0; panY.value = 0 }
function zoomIn()    { applyZoom(1.3,  0, 0) }
function zoomOut()   { applyZoom(0.77, 0, 0) }

function applyZoom(factor, curX, curY) {
  const oldZ = zoom.value
  zoom.value = Math.max(1, Math.min(8, oldZ * factor))
  if (zoom.value <= 1) { resetZoom(); return }
  const zr   = zoom.value / oldZ
  panX.value = curX * (1 - zr) + panX.value * zr
  panY.value = curY * (1 - zr) + panY.value * zr
  clampPan()
}

function onWheelSplit(e) {
  if (!splitAreaEl.value) return
  const rect   = splitAreaEl.value.getBoundingClientRect()
  const cursorX = e.clientX - rect.left - rect.width  / 2
  const cursorY = e.clientY - rect.top  - rect.height / 2
  applyZoom(e.deltaY < 0 ? 1.18 : 0.85, cursorX, cursorY)
}

function startPan(e) {
  if (activeDivider.value >= 0 || zoom.value <= 1) return
  isPanning.value = true
  panStart.value  = { x: e.clientX, y: e.clientY, px: panX.value, py: panY.value }
}
function onPanMove(e) {
  if (!isPanning.value) return
  panX.value = panStart.value.px + (e.clientX - panStart.value.x)
  panY.value = panStart.value.py + (e.clientY - panStart.value.y)
  clampPan()
}
function stopPan() { isPanning.value = false }

// ── Global mouse/touch/key listeners ──────────────────────────────────────────
function onGlobalMove(e) {
  if (isSliding.value)          sliderPos.value = getSliderPct(e.clientX)
  if (activeDivider.value >= 0) onDividerMove(e)
  if (isPanning.value)          onPanMove(e)
}
function onGlobalUp() {
  isSliding.value = false
  stopDivider()
  stopPan()
}
function onGlobalTouchMove(e) {
  if (isSliding.value) sliderPos.value = getSliderPct(e.touches[0].clientX)
}

function onKeyDown(e) {
  if (!store.comparePanelOpen) return
  if (e.key === 'Escape') { store.comparePanelOpen = false; return }
  if (document.activeElement?.matches('input,textarea,select')) return

  if (viewMode.value === 'diff') {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); sliderPos.value = Math.max(0,   sliderPos.value - 5) }
    if (e.key === 'ArrowRight') { e.preventDefault(); sliderPos.value = Math.min(100, sliderPos.value + 5) }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); swapAB() }
  }
  if (viewMode.value === 'split') {
    if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn()  }
    if (e.key === '-')                  { e.preventDefault(); zoomOut() }
    if (e.key === '0')                  { e.preventDefault(); resetZoom() }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); panX.value -= 40; clampPan() }
    if (e.key === 'ArrowRight') { e.preventDefault(); panX.value += 40; clampPan() }
    if (e.key === 'ArrowUp')    { e.preventDefault(); panY.value -= 40; clampPan() }
    if (e.key === 'ArrowDown')  { e.preventDefault(); panY.value += 40; clampPan() }
  }
}

// Sync state when compareList changes
watch(() => store.compareList.length, () => {
  initDiffPair()
  initSplitRatios()
  if (store.compareList.length === 0) store.comparePanelOpen = false
})

watch(() => store.comparePanelOpen, v => {
  if (v) { initDiffPair(); initSplitRatios(); nextTick(loadFullResForAll) }
})

onMounted(() => {
  window.addEventListener('mousemove', onGlobalMove)
  window.addEventListener('mouseup',   onGlobalUp)
  window.addEventListener('touchmove', onGlobalTouchMove, { passive: true })
  window.addEventListener('touchend',  onGlobalUp)
  window.addEventListener('keydown',   onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMove)
  window.removeEventListener('mouseup',   onGlobalUp)
  window.removeEventListener('touchmove', onGlobalTouchMove)
  window.removeEventListener('touchend',  onGlobalUp)
  window.removeEventListener('keydown',   onKeyDown)
})
</script>

<style scoped>
/* ── Tray ────────────────────────────────────────────────────────────────────── */
.compare-tray {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: rgba(255,255,255,.97); border-top: 2px solid var(--gold-light);
  box-shadow: 0 -4px 24px rgba(0,0,0,.14);
  display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  backdrop-filter: blur(10px);
}
.tray-enter-active,.tray-leave-active { transition: transform .22s ease, opacity .2s; }
.tray-enter-from,.tray-leave-to       { transform: translateY(100%); opacity: 0; }

.tray-images { display: flex; gap: 8px; flex: 1; overflow-x: auto; }
.tray-item {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px;
  padding: 5px 8px; min-width: 160px; flex-shrink: 0;
}
.tray-num {
  width: 18px; height: 18px; border-radius: 50%; background: var(--gold); color: #fff;
  font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.tray-thumb { width: 36px; height: 50px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.tray-info  { flex: 1; min-width: 0; }
.tray-id  { display: block; font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tray-st  { display: block; font-size: 10px; margin-top: 2px; font-weight: 600; }
.tray-st.selected { color: var(--selected); }
.tray-st.rejected { color: var(--rejected); }
.tray-st.pending  { color: var(--text-3); }
.tray-rm {
  width: 20px; height: 20px; border-radius: 50%; border: none; background: var(--border);
  cursor: pointer; font-size: 14px; color: var(--text-2); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.tray-rm:hover { background: #f0d0d0; color: var(--rejected); }

.tray-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.tray-btn {
  display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px;
  border: 1.5px solid var(--border); background: transparent;
  cursor: pointer; font-size: 12px; font-family: inherit; color: var(--text-2);
  transition: all .12s; white-space: nowrap;
}
.tray-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
.tray-btn:hover { border-color: var(--gold); color: var(--gold-dark); background: var(--gold-faint); }
.tray-btn.primary { background: var(--gold); border-color: var(--gold); color: #fff; }
.tray-btn.primary:hover { background: var(--gold-dark); }

/* ── Overlay ─────────────────────────────────────────────────────────────────── */
.compare-overlay {
  position: fixed; inset: 0; z-index: 400;
  background: #111; display: flex; flex-direction: column; overflow: hidden;
}
.fade-enter-active,.fade-leave-active { transition: opacity .18s; }
.fade-enter-from,.fade-leave-to       { opacity: 0; }

/* Header */
.co-header {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: rgba(0,0,0,.6);
  border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0;
}
.co-title-group { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; }
.co-title { font-size: 15px; font-weight: 700; color: #fff; }
.co-badge {
  width: 20px; height: 20px; border-radius: 50%; background: var(--gold); color: #fff;
  font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}

.quality-chip {
  display: flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700;
  padding: 2px 7px; border-radius: 10px;
  background: rgba(76,175,80,.18); color: #81C784; border: 1px solid rgba(76,175,80,.3);
}
.quality-btn {
  display: flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 10px; cursor: pointer; font-family: inherit;
  background: rgba(255,183,77,.12); color: #FFB74D; border: 1px solid rgba(255,183,77,.3);
  transition: background .12s;
}
.quality-btn:hover { background: rgba(255,183,77,.22); }

.co-mode {
  display: flex; gap: 2px; background: rgba(255,255,255,.06); border-radius: 8px;
  padding: 2px; flex-shrink: 0;
}
.mode-btn {
  display: flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 6px;
  border: none; background: transparent; cursor: pointer; font-size: 12px;
  font-weight: 500; font-family: inherit; color: rgba(255,255,255,.5); transition: all .14s;
}
.mode-btn svg { width: 13px; height: 13px; }
.mode-btn:hover:not(:disabled) { color: rgba(255,255,255,.8); background: rgba(255,255,255,.08); }
.mode-btn.active { background: rgba(255,255,255,.14); color: #fff; }
.mode-btn:disabled { opacity: .3; cursor: not-allowed; }

.co-close {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.14); background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
  transition: background .14s;
}
.co-close svg { width: 14px; height: 14px; }
.co-close:hover { background: rgba(255,255,255,.12); }

/* ── DIFF MODE ───────────────────────────────────────────────────────────────── */
.diff-selector {
  display: flex; align-items: center; gap: 12px; padding: 8px 16px;
  background: rgba(0,0,0,.4); border-bottom: 1px solid rgba(255,255,255,.06); flex-shrink: 0;
}
.ds-hint { font-size: 11px; color: rgba(255,255,255,.4); white-space: nowrap; }
.ds-thumbs { display: flex; gap: 6px; overflow-x: auto; }
.ds-item {
  position: relative; width: 48px; height: 64px; flex-shrink: 0;
  border-radius: 5px; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; transition: border-color .14s;
}
.ds-item:hover  { border-color: rgba(255,255,255,.4); }
.ds-item.sel-a  { border-color: #4FC3F7; }
.ds-item.sel-b  { border-color: #FFB74D; }
.ds-img  { width: 100%; height: 100%; object-fit: cover; display: block; }
.ds-chip {
  position: absolute; top: 2px; left: 2px; font-size: 9px; font-weight: 800;
  padding: 0 3px; border-radius: 3px; line-height: 14px;
}
.ds-chip.a { background: #4FC3F7; color: #01579B; }
.ds-chip.b { background: #FFB74D; color: #E65100; }
.ds-stt {
  position: absolute; bottom: 2px; left: 0; right: 0; text-align: center;
  font-size: 9px; color: #fff; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,.8);
}

.diff-area {
  flex: 1; position: relative; overflow: hidden;
  cursor: col-resize; user-select: none; background: #000;
}
.diff-layer {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
}
.diff-img {
  max-width: 100%; max-height: 100%; display: block; object-fit: contain;
  pointer-events: none; image-rendering: high-quality;
}
.diff-loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.3); pointer-events: none;
}

.diff-label {
  position: absolute; top: 12px; z-index: 5;
  display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px;
  background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
  color: rgba(255,255,255,.9); font-size: 11px; pointer-events: none;
}
.dl-left  { left: 16px; }
.dl-right { right: 16px; flex-direction: row-reverse; }
.dl-tag { font-size: 11px; font-weight: 800; padding: 1px 6px; border-radius: 4px; }
.dl-tag.a { background: #4FC3F7; color: #01579B; }
.dl-tag.b { background: #FFB74D; color: #E65100; }
.dl-id  { font-weight: 600; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-stt { color: rgba(255,255,255,.5); font-size: 10px; }

.diff-handle {
  position: absolute; top: 0; bottom: 0; z-index: 10;
  transform: translateX(-50%); pointer-events: none;
}
.dh-line {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 2px;
  background: rgba(255,255,255,.9); box-shadow: 0 0 8px rgba(0,0,0,.6);
  transform: translateX(-50%);
}
.dh-knob {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 44px; height: 44px; border-radius: 50%; background: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 12px rgba(0,0,0,.5); pointer-events: all; cursor: col-resize;
}
.dh-knob svg { color: #333; }

.diff-pct {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 11px; font-weight: 700; color: rgba(255,255,255,.75);
  background: rgba(0,0,0,.5); padding: 2px 8px; border-radius: 10px;
  pointer-events: none; z-index: 6;
}

.diff-footer {
  display: flex; gap: 8px; align-items: stretch;
  padding: 10px 16px; background: rgba(0,0,0,.5);
  border-top: 1px solid rgba(255,255,255,.07); flex-shrink: 0;
}
.df-card {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.05); border-radius: 8px; padding: 8px 12px;
}
.df-tag { font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px; flex-shrink: 0; }
.df-tag.a { background: #4FC3F7; color: #01579B; }
.df-tag.b { background: #FFB74D; color: #E65100; }
.df-meta { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.df-id   { font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.df-stt  { font-size: 10px; color: rgba(255,255,255,.4); }
.df-status { font-size: 10px; font-weight: 600; }
.df-status.selected { color: #81C784; }
.df-status.rejected { color: #E57373; }
.df-status.pending  { color: rgba(255,255,255,.4); }
.df-btns { display: flex; gap: 5px; flex-shrink: 0; }
.dfb {
  display: flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.15); background: transparent;
  cursor: pointer; font-size: 11px; font-family: inherit; color: rgba(255,255,255,.65);
  transition: all .14s;
}
.dfb svg { width: 10px; height: 10px; }
.dfb.sel:hover, .dfb.sel.active { background: rgba(46,125,50,.5); border-color: #4CAF50; color: #81C784; }
.dfb.rej:hover, .dfb.rej.active { background: rgba(198,40,40,.5); border-color: #E53935; color: #E57373; }

.swap-btn {
  display: flex; align-items: center; gap: 5px; padding: 8px 12px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,.15); background: transparent;
  cursor: pointer; font-size: 12px; font-family: inherit; color: rgba(255,255,255,.55);
  transition: all .14s; flex-shrink: 0;
}
.swap-btn svg { width: 14px; height: 14px; }
.swap-btn:hover { border-color: rgba(255,255,255,.35); color: rgba(255,255,255,.9); }

/* ── SPLIT MODE ──────────────────────────────────────────────────────────────── */
.zoom-bar {
  display: flex; align-items: center; gap: 8px; padding: 6px 16px;
  background: rgba(0,0,0,.45); border-bottom: 1px solid rgba(255,255,255,.06); flex-shrink: 0;
}
.zb-btn {
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.14); background: transparent;
  cursor: pointer; color: rgba(255,255,255,.7);
  display: flex; align-items: center; justify-content: center; transition: all .12s;
}
.zb-btn svg { width: 13px; height: 13px; }
.zb-btn:hover:not(:disabled) { background: rgba(255,255,255,.1); color: #fff; }
.zb-btn:disabled { opacity: .3; cursor: not-allowed; }
.zb-pct {
  min-width: 44px; text-align: center; font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,.85); cursor: pointer; padding: 2px 6px;
  border-radius: 4px; transition: background .12s;
}
.zb-pct:hover { background: rgba(255,255,255,.08); }
.zb-sep { width: 1px; height: 16px; background: rgba(255,255,255,.12); }
.zb-hint { font-size: 10px; color: rgba(255,255,255,.3); }

.split-area {
  flex: 1; position: relative; overflow: hidden; background: #000;
  /* cursor set via :style binding */
}
.split-zoom-wrap {
  position: absolute; inset: 0;
  /* transform applied via :style binding */
}
.split-panel {
  position: absolute; top: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center;
  background: #000; overflow: hidden;
}
/* Thin separator between panels (always visible even before divider is added) */
.split-panel + .split-panel { border-left: 1px solid rgba(255,255,255,.06); }
.split-img {
  max-width: 100%; max-height: 100%; display: block;
  object-fit: contain; pointer-events: none;
  image-rendering: high-quality; user-select: none;
}
.split-loading {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}

/* Dividers */
.split-divider {
  position: absolute; top: 0; bottom: 0; z-index: 20;
  width: 8px; transform: translateX(-50%);
  cursor: col-resize; display: flex; align-items: center; justify-content: center;
}
.divider-line {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 2px;
  background: rgba(255,255,255,.2); transform: translateX(-50%); transition: background .14s;
}
.split-divider:hover .divider-line,
.split-divider:active .divider-line { background: rgba(255,255,255,.7); }
.divider-knob {
  width: 24px; height: 44px; border-radius: 5px;
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,.6); transition: all .14s;
}
.split-divider:hover .divider-knob,
.split-divider:active .divider-knob { background: rgba(255,255,255,.22); color: #fff; }

/* Panel labels */
.panel-labels { position: absolute; top: 0; left: 0; right: 0; z-index: 10; pointer-events: none; }
.panel-label {
  position: absolute; top: 8px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 5px;
  background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
  padding: 3px 9px; border-radius: 12px; white-space: nowrap;
}
.pl-num {
  width: 16px; height: 16px; border-radius: 50%; background: var(--gold); color: #fff;
  font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.pl-id  { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.9); }
.pl-stt { font-size: 9px; color: rgba(255,255,255,.5); }

/* Per-panel actions */
.split-actions {
  display: flex; align-items: center; gap: 6px; padding: 8px 16px;
  background: rgba(0,0,0,.5); border-top: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0; overflow-x: auto;
}
.sa-card {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,.05); border-radius: 8px; padding: 6px 10px;
  flex-shrink: 0; min-width: 130px;
}
.sa-num {
  width: 18px; height: 18px; border-radius: 50%; background: var(--gold); color: #fff;
  font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sa-id     { font-size: 10px; font-weight: 700; color: #fff; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-status { font-size: 9px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
.sa-status.selected { color: #81C784; }
.sa-status.rejected { color: #E57373; }
.sa-status.pending  { color: rgba(255,255,255,.35); }
.sa-btns { display: flex; gap: 3px; flex-shrink: 0; }
.sab {
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.12); background: transparent;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,.5); transition: all .14s;
}
.sab svg { width: 10px; height: 10px; }
.sab.sel:hover, .sab.sel.active { background: rgba(46,125,50,.4); border-color: #4CAF50; color: #81C784; }
.sab.rej:hover, .sab.rej.active { background: rgba(198,40,40,.4); border-color: #E53935; color: #E57373; }
.sab.rm:hover  { background: rgba(255,255,255,.08); color: #E57373; }

/* ── Shared ──────────────────────────────────────────────────────────────────── */
.spin {
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid rgba(255,255,255,.15); border-top-color: rgba(255,255,255,.7);
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

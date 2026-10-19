<template>
  <div class="gallery-scroll" ref="scrollEl" @scroll.passive="onScroll">
    <!-- Loading -->
    <div v-if="!store.loaded" class="g-empty">
      <div class="spinner"></div>
      <p>Đang tải...</p>
    </div>

    <!-- No manifest -->
    <div v-else-if="store.images.length === 0" class="g-empty">
      <div class="e-icon">🖼</div>
      <h3>Chưa có ảnh</h3>
      <p>Chạy lệnh sau để tạo thumbnails:</p>
      <code>npm run generate</code>
    </div>

    <!-- No results -->
    <div v-else-if="store.filteredImages.length === 0" class="g-empty">
      <div class="e-icon">🔍</div>
      <h3>Không tìm thấy ảnh</h3>
      <p>Thử thay đổi bộ lọc.</p>
      <button class="reset-btn" @click="store.resetFilters()">Xóa bộ lọc</button>
    </div>

    <!-- Virtual masonry grid -->
    <div v-else class="masonry-inner" :style="{ height: totalHeight + 'px' }">
      <ImageCard
        v-for="item in visibleItems"
        :key="item.image.id"
        :image="item.image"
        :index="item.index"
        :shift-active="shiftKey"
        :style="{
          position: 'absolute',
          top: item.top + 'px',
          left: item.left + 'px',
          width: item.width + 'px',
        }"
        @shift-click="onShiftClick"
      />
    </div>

    <button v-if="showTop" class="to-top" @click="scrollEl.scrollTop = 0" title="Lên đầu">↑</button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'
import ImageCard from './ImageCard.vue'

const store = useGalleryStore()
const scrollEl  = ref(null)
const shiftKey  = ref(false)
const lastIdx   = ref(null)
const scrollTop = ref(0)
const wrapWidth = ref(0)
const viewH     = ref(600)
const showTop   = ref(false)

const GAP      = 10
const FOOTER_H = 34
const BUFFER   = 1400

// ── Virtual masonry layout ────────────────────────────────────────────────────

const layout = computed(() => {
  const w = wrapWidth.value
  if (!w) return { items: [], totalHeight: 0 }

  const colW     = store.colWidth
  const colCount = Math.max(1, Math.floor((w + GAP) / (colW + GAP)))
  const actualW  = (w - GAP * (colCount - 1)) / colCount
  const colH     = new Array(colCount).fill(0)

  const items = store.filteredImages.map((img, idx) => {
    let minVal = colH[0], col = 0
    for (let i = 1; i < colCount; i++) {
      if (colH[i] < minVal) { minVal = colH[i]; col = i }
    }
    const iw   = img.width  || 3
    const ih   = img.height || 2
    const imgH = Math.round(actualW * ih / iw)
    const top  = colH[col]
    const left = col * (actualW + GAP)
    colH[col] += imgH + FOOTER_H + GAP
    return { image: img, index: idx, top, left, width: Math.round(actualW), height: imgH + FOOTER_H }
  })

  return { items, totalHeight: Math.max(0, ...colH) }
})

const totalHeight = computed(() => layout.value.totalHeight)

const visibleItems = computed(() => {
  const st  = scrollTop.value
  const min = st - BUFFER
  const max = st + viewH.value + BUFFER
  return layout.value.items.filter(it => it.top + it.height > min && it.top < max)
})

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function onKeyDown(e) {
  shiftKey.value = e.shiftKey
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); store.undo(); return }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); store.redo(); return }

  const hid = store.hoveredImageId
  if (!hid || e.ctrlKey || e.metaKey || e.altKey) return

  if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    const cur = store.selections[hid]?.[store.currentRoundId] ?? null
    store.setStatus(hid, store.currentRoundId, cur === 'selected' ? null : 'selected')
  } else if (e.key === 'x' || e.key === 'X') {
    e.preventDefault()
    const cur = store.selections[hid]?.[store.currentRoundId] ?? null
    store.setStatus(hid, store.currentRoundId, cur === 'rejected' ? null : 'rejected')
  } else if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    store.noteModalImageId = hid
  } else if (e.key === 'c' || e.key === 'C') {
    e.preventDefault()
    store.toggleCompare(hid)
  }
}
function onKeyUp(e) { shiftKey.value = e.shiftKey }

// ── Scroll tracking ───────────────────────────────────────────────────────────

function onScroll() {
  scrollTop.value = scrollEl.value?.scrollTop || 0
  showTop.value   = scrollTop.value > 500
}

// ── Shift-click range select ──────────────────────────────────────────────────

function onShiftClick(idx) {
  if (lastIdx.value === null) {
    store.toggleStatus(store.filteredImages[idx].id)
    lastIdx.value = idx
    return
  }
  const from = Math.min(lastIdx.value, idx)
  const to   = Math.max(lastIdx.value, idx)
  const ids  = store.filteredImages.slice(from, to + 1).map(i => i.id)
  const cur  = store.selections[store.filteredImages[idx].id]?.[store.currentRoundId] ?? null
  store.selectImages(ids, cur === 'selected' ? null : 'selected')
  lastIdx.value = idx
}

// Reset scroll position when filter changes
watch(
  () => ({ ...store.filters, roundId: store.currentRoundId }),
  () => nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0
    scrollTop.value = 0
    lastIdx.value   = null
  }),
  { deep: true }
)

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let ro = null

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup',   onKeyUp)
  scrollEl.value?.addEventListener('scroll', onScroll, { passive: true })

  ro = new ResizeObserver(() => {
    if (!scrollEl.value) return
    wrapWidth.value = scrollEl.value.clientWidth - 24
    viewH.value     = scrollEl.value.clientHeight
  })
  if (scrollEl.value) {
    ro.observe(scrollEl.value)
    wrapWidth.value = scrollEl.value.clientWidth - 24
    viewH.value     = scrollEl.value.clientHeight
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup',   onKeyUp)
  scrollEl.value?.removeEventListener('scroll', onScroll)
  ro?.disconnect()
})
</script>

<style scoped>
.gallery-scroll {
  flex: 1; overflow-y: auto;
  padding: 12px;
  background: var(--bg);
  position: relative;
}

.masonry-inner { position: relative; width: 100%; }

/* ── Empty states ── */
.g-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 60vh;
  text-align: center; gap: 12px; color: var(--text-2);
}
.e-icon { font-size: 52px; }
.g-empty h3 { font-size: 18px; font-weight: 700; color: var(--text); }
.g-empty p  { font-size: 14px; }
.g-empty code {
  background: var(--bg-card); border: 1px solid var(--border);
  padding: 6px 14px; border-radius: 6px;
  font-family: monospace; font-size: 13px; color: var(--gold-dark);
}
.reset-btn {
  padding: 8px 20px; background: var(--gold); color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 13px; font-family: inherit;
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border); border-top-color: var(--gold);
  border-radius: 50%; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Back to top ── */
.to-top {
  position: sticky; bottom: 14px;
  float: right; margin-right: 4px;
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--gold); color: #fff;
  border: none; cursor: pointer;
  font-size: 16px; font-weight: 700;
  box-shadow: var(--shadow-md);
  display: flex; align-items: center; justify-content: center;
  transition: transform .14s;
}
.to-top:hover { transform: scale(1.1); }
</style>

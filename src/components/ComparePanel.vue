<template>
  <Teleport to="body">
    <!-- Bottom tray -->
    <Transition name="tray">
      <div v-if="store.compareList.length > 0" class="compare-tray">
        <div class="tray-images">
          <div v-for="(id, i) in store.compareList" :key="id" class="tray-item">
            <span class="tray-num">{{ i + 1 }}</span>
            <img :src="thumbOf(id)" class="tray-thumb" :alt="id" />
            <div class="tray-info">
              <span class="tray-id">{{ id }}</span>
              <span class="tray-st" :class="statusOf(id)">{{ statusLabel(id) }}</span>
            </div>
            <button class="tray-remove" @click="store.toggleCompare(id)" title="Xóa khỏi so sánh">×</button>
          </div>
        </div>
        <div class="tray-actions">
          <button class="tray-btn primary" @click="store.comparePanelOpen = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            So sánh
          </button>
          <button class="tray-btn" @click="store.clearCompare()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Xóa tất cả
          </button>
        </div>
      </div>
    </Transition>

    <!-- Fullscreen overlay -->
    <Transition name="fade">
      <div v-if="store.comparePanelOpen" class="compare-overlay" @click.self="store.comparePanelOpen = false">
        <div class="co-header">
          <span class="co-title">So sánh {{ store.compareList.length }} ảnh</span>
          <div class="co-header-right">
            <button class="co-close" @click="store.comparePanelOpen = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="co-grid" :class="`cols-${colCount}`">
          <div v-for="(id, i) in store.compareList" :key="id" class="co-card">
            <div class="co-num">{{ i + 1 }}</div>
            <div class="co-img-wrap">
              <img :src="thumbOf(id)" class="co-img" :alt="id" />
            </div>
            <div class="co-meta">
              <div class="co-id">{{ id }}</div>
              <div class="co-stt">STT #{{ imgOf(id)?.stt }}</div>
              <div class="co-status" :class="statusOf(id)">{{ statusLabel(id) }}</div>
              <div v-if="noteOf(id)" class="co-note">{{ noteOf(id) }}</div>
            </div>
            <div class="co-btns">
              <button
                class="co-select"
                :class="{ active: statusOf(id) === 'selected' }"
                @click="toggleSelect(id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                Chọn
              </button>
              <button
                class="co-reject"
                :class="{ active: statusOf(id) === 'rejected' }"
                @click="toggleReject(id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Loại
              </button>
              <button class="co-remove" @click="store.toggleCompare(id)" title="Xóa khỏi so sánh">
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
import { computed } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store = useGalleryStore()

const imageMap = computed(() => {
  const m = {}
  for (const img of store.images) m[img.id] = img
  return m
})

const colCount = computed(() => Math.min(4, Math.max(1, store.compareList.length)))

function imgOf(id)    { return imageMap.value[id] }
function thumbOf(id)  { const img = imgOf(id); return img ? `./${img.thumbPath}` : '' }
function statusOf(id) { return store.selections[id]?.[store.currentRoundId] ?? null }

const STATUS_LABEL = { selected: 'Đã chọn', rejected: 'Đã loại' }
function statusLabel(id) { return STATUS_LABEL[statusOf(id)] ?? 'Chưa xử lý' }
function noteOf(id) { return store.notes[id]?.text || '' }

function toggleSelect(id) {
  store.setStatus(id, store.currentRoundId, statusOf(id) === 'selected' ? null : 'selected')
}
function toggleReject(id) {
  store.setStatus(id, store.currentRoundId, statusOf(id) === 'rejected' ? null : 'rejected')
}
</script>

<style scoped>
/* ── Tray ── */
.compare-tray {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: rgba(255,255,255,0.97);
  border-top: 2px solid var(--gold-light);
  box-shadow: 0 -4px 20px rgba(0,0,0,.12);
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  backdrop-filter: blur(8px);
}
.tray-enter-active, .tray-leave-active { transition: transform .22s ease, opacity .2s; }
.tray-enter-from, .tray-leave-to { transform: translateY(100%); opacity: 0; }

.tray-images { display: flex; gap: 8px; flex: 1; overflow-x: auto; }

.tray-item {
  display: flex; align-items: center; gap: 7px;
  background: var(--bg); border: 1.5px solid var(--border);
  border-radius: 8px; padding: 5px 8px;
  min-width: 180px; position: relative; flex-shrink: 0;
}
.tray-num {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--gold); color: #fff;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.tray-thumb {
  width: 42px; height: 56px; object-fit: cover;
  border-radius: 4px; flex-shrink: 0;
}
.tray-info { flex: 1; min-width: 0; }
.tray-id { display: block; font-size: 11px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tray-st { display: block; font-size: 10px; margin-top: 2px; font-weight: 600; }
.tray-st.selected { color: var(--selected); }
.tray-st.rejected { color: var(--rejected); }
.tray-st.null, .tray-st:not(.selected):not(.rejected) { color: var(--text-3); }
.tray-remove {
  width: 20px; height: 20px; border-radius: 50%;
  border: none; background: var(--border); cursor: pointer;
  font-size: 14px; line-height: 1; color: var(--text-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
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
.tray-btn.primary:hover { background: var(--gold-dark); border-color: var(--gold-dark); }

/* ── Fullscreen overlay ── */
.compare-overlay {
  position: fixed; inset: 0; z-index: 400;
  background: rgba(18,18,18,0.95);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.co-header {
  display: flex; align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,.1);
  flex-shrink: 0;
}
.co-title { font-size: 16px; font-weight: 700; color: #fff; flex: 1; }
.co-header-right { display: flex; gap: 10px; }
.co-close {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.2);
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #fff; transition: background .14s;
}
.co-close svg { width: 16px; height: 16px; }
.co-close:hover { background: rgba(255,255,255,.12); }

.co-grid {
  display: grid; flex: 1;
  gap: 2px; padding: 12px;
  overflow: auto;
  align-items: start;
}
.co-grid.cols-1 { grid-template-columns: 1fr; max-width: 600px; margin: 0 auto; }
.co-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.co-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.co-grid.cols-4 { grid-template-columns: repeat(2, 1fr); }

.co-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px; overflow: hidden;
  display: flex; flex-direction: column;
  position: relative;
}
.co-num {
  position: absolute; top: 8px; left: 8px; z-index: 2;
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--gold); color: #fff;
  font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.co-img-wrap { position: relative; flex: 1; min-height: 0; overflow: hidden; }
.co-img { width: 100%; height: auto; display: block; object-fit: contain; }

.co-meta {
  padding: 10px 12px 6px;
  border-top: 1px solid rgba(255,255,255,.08);
  display: flex; flex-direction: column; gap: 3px;
}
.co-id  { font-size: 12px; font-weight: 700; color: #fff; }
.co-stt { font-size: 10px; color: rgba(255,255,255,.5); }
.co-status { font-size: 11px; font-weight: 600; }
.co-status.selected { color: #81C784; }
.co-status.rejected { color: #E57373; }
.co-note { font-size: 10px; color: rgba(255,255,255,.55); font-style: italic; margin-top: 2px; }

.co-btns {
  display: flex; gap: 6px; padding: 8px 12px;
  border-top: 1px solid rgba(255,255,255,.06);
}
.co-select, .co-reject {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 6px 0; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.15);
  background: transparent; cursor: pointer;
  font-size: 11px; font-family: inherit;
  color: rgba(255,255,255,.7); transition: all .14s;
}
.co-select svg, .co-reject svg { width: 11px; height: 11px; }
.co-select:hover, .co-select.active { background: rgba(46,125,50,.4); border-color: #4CAF50; color: #81C784; }
.co-reject:hover, .co-reject.active { background: rgba(198,40,40,.4); border-color: #E53935; color: #E57373; }
.co-remove {
  width: 30px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.1);
  background: transparent; cursor: pointer;
  color: rgba(255,255,255,.4); transition: all .14s;
  display: flex; align-items: center; justify-content: center;
}
.co-remove svg { width: 12px; height: 12px; }
.co-remove:hover { background: rgba(255,255,255,.1); color: #E57373; }
</style>

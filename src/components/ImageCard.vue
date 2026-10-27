<template>
  <div
    class="icard"
    :class="[statusCls, { 'in-compare': isInCompare }]"
    @click="onClick"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <div class="img-wrap" :class="{ loaded: imgLoaded }">
      <!-- LQIP blurred placeholder -->
      <div
        v-if="image.placeholder"
        class="lqip"
        :style="{ backgroundImage: `url('${image.placeholder}')` }"
      ></div>

      <!-- Actual thumbnail — width+height reserves correct portrait space -->
      <img
        :src="thumbSrc"
        :width="image.width"
        :height="image.height"
        :alt="image.id"
        loading="lazy"
        class="thumb"
        @load="imgLoaded = true"
        draggable="false"
      />

      <!-- Full-res overlay: fades in on top of thumbnail when images folder is connected -->
      <img
        v-if="fullResSrc"
        :src="fullResSrc"
        class="fullres-overlay"
        :class="{ loaded: fullResLoaded }"
        @load="fullResLoaded = true"
        draggable="false"
        alt=""
      />

      <!-- Hover overlay -->
      <transition name="ov">
        <div v-show="hovered || status !== null" class="overlay">
          <div class="ov-actions">
            <button
              class="ov-btn"
              :class="{ active: status === 'selected' }"
              @click.stop="setStatus('selected')"
              title="Chọn (S)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button
              class="ov-btn rej"
              :class="{ active: status === 'rejected' }"
              @click.stop="setStatus('rejected')"
              title="Loại (X)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <button
              class="ov-btn note"
              :class="{ 'has-note': hasNote }"
              @click.stop="openNote"
              title="Ghi chú (N)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button
              class="ov-btn cmp"
              :class="{ active: isInCompare }"
              @click.stop="store.toggleCompare(image.id)"
              title="So sánh (C)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="7" height="18" rx="1"/><rect x="15" y="3" width="7" height="18" rx="1"/></svg>
            </button>
            <button
              class="ov-btn view"
              @click.stop="openLightbox"
              title="Xem fullscreen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      </transition>

      <!-- Status badge (top-right) -->
      <div v-if="status" class="s-badge" :class="status">
        <svg v-if="status === 'selected'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>

      <!-- Compare badge (top-left) -->
      <div v-if="isInCompare" class="cmp-badge" :title="`So sánh #${comparePos}`">{{ comparePos }}</div>

      <!-- Note badge -->
      <div v-else-if="hasNote" class="n-badge" @click.stop="openNote" title="Có ghi chú – click để xem">📝</div>
    </div>

    <!-- Card footer -->
    <div class="ifoot">
      <span class="f-stt">#{{ image.stt }}</span>
      <span class="f-id">{{ image.id }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const props = defineProps({
  image:       { type: Object,  required: true },
  index:       { type: Number,  required: true },
  shiftActive: { type: Boolean, default: false },
})
const emit = defineEmits(['shift-click'])

const store        = useGalleryStore()
const hovered      = ref(false)
const imgLoaded    = ref(false)
const fullResSrc   = ref(null)   // blob URL of full-res image (null = not yet loaded)
const fullResLoaded = ref(false) // true after the fullres img fires @load

const status      = computed(() => store.selections[props.image.id]?.[store.currentRoundId] ?? null)
const hasNote     = computed(() => !!store.notes[props.image.id]?.text)
const isInCompare = computed(() => store.compareList.includes(props.image.id))
const comparePos  = computed(() => store.compareList.indexOf(props.image.id) + 1)

const statusCls = computed(() => ({
  'is-selected': status.value === 'selected',
  'is-rejected': status.value === 'rejected',
}))

const thumbSrc = computed(() => `./${props.image.thumbPath}`)

// Load full-res from the connected images folder (non-blocking)
async function tryLoadFullRes() {
  if (!store.imagesReady || fullResSrc.value) return
  const url = await store.getFullResUrl(props.image)
  if (url) fullResSrc.value = url
}

// When images folder is connected/disconnected, react immediately
watch(() => store.imagesReady, (ready) => {
  if (ready) {
    tryLoadFullRes()
  } else {
    // Folder disconnected → blob URLs revoked, fall back to thumbnail
    fullResSrc.value    = null
    fullResLoaded.value = false
  }
})

// On mount: card is visible (virtual masonry only renders visible range)
onMounted(() => { if (store.imagesReady) tryLoadFullRes() })

function onEnter() { hovered.value = true;  store.hoveredImageId = props.image.id }
function onLeave() { hovered.value = false; if (store.hoveredImageId === props.image.id) store.hoveredImageId = null }

function onClick(e) {
  if (e.shiftKey) emit('shift-click', props.index)
  else store.toggleStatus(props.image.id)
}

function setStatus(s) {
  store.setStatus(props.image.id, store.currentRoundId, status.value === s ? null : s)
}

function openNote()     { store.noteModalImageId = props.image.id }
function openLightbox() { store.openLightbox(props.index) }
</script>

<style scoped>
.icard {
  break-inside: avoid;
  margin-bottom: 10px;
  border-radius: var(--radius);
  background: var(--bg-card);
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s, transform .1s;
  box-shadow: var(--shadow-sm);
}
.icard:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.icard.is-selected {
  border-color: var(--selected);
  box-shadow: 0 0 0 1px var(--selected-ring), var(--shadow-md);
}
.icard.is-rejected {
  border-color: var(--rejected);
  opacity: .85;
}
.icard.in-compare {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px rgba(184,149,90,0.4), var(--shadow-md);
}

/* ── Image wrapper ── */
.img-wrap {
  position: relative;
  overflow: hidden;
  background: #EDE8E0;
  line-height: 0;
}

.lqip {
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
  filter: blur(10px); transform: scale(1.08);
  transition: opacity .4s;
}
.img-wrap.loaded .lqip { opacity: 0; pointer-events: none; }

.thumb {
  display: block; width: 100%; height: auto;
  opacity: 0; transition: opacity .4s;
  position: relative; z-index: 1;
}
.img-wrap.loaded .thumb { opacity: 1; }

/* Full-res overlay — positioned absolute over thumbnail, fades in when loaded */
.fullres-overlay {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity .5s ease;
  z-index: 2;
  pointer-events: none;
}
.fullres-overlay.loaded { opacity: 1; }

/* ── Hover overlay ── */
.overlay {
  position: absolute; inset: 0; z-index: 2;
  background: linear-gradient(to top, rgba(0,0,0,.65) 0%, rgba(0,0,0,.18) 40%, transparent 100%);
  display: flex; align-items: flex-end; padding: 9px;
}
.ov-enter-active, .ov-leave-active { transition: opacity .15s; }
.ov-enter-from, .ov-leave-to { opacity: 0; }

.ov-actions { display: flex; gap: 5px; flex-wrap: wrap; }
.ov-btn {
  width: 29px; height: 29px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.6);
  background: rgba(0,0,0,.38); backdrop-filter: blur(4px);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .14s; padding: 0; flex-shrink: 0;
}
.ov-btn svg { width: 12px; height: 12px; stroke: #fff; }
.ov-btn:hover { transform: scale(1.12); border-color: rgba(255,255,255,.9); }

.ov-btn.active             { background: var(--selected); border-color: var(--selected); }
.ov-btn.rej:hover          { background: var(--rejected); border-color: var(--rejected); }
.ov-btn.rej.active         { background: var(--rejected); border-color: var(--rejected); }
.ov-btn.note.has-note      { background: var(--gold);     border-color: var(--gold); }
.ov-btn.cmp.active         { background: var(--gold);     border-color: var(--gold); }
.ov-btn.cmp:hover          { background: rgba(184,149,90,.6); }
.ov-btn.view:hover         { background: rgba(255,255,255,.2); }

/* ── Status badge ── */
.s-badge {
  position: absolute; top: 7px; right: 7px; z-index: 3;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,.3);
}
.s-badge svg { width: 12px; height: 12px; stroke: #fff; }
.s-badge.selected { background: var(--selected); }
.s-badge.rejected { background: var(--rejected); }

/* ── Compare badge ── */
.cmp-badge {
  position: absolute; top: 7px; left: 7px; z-index: 3;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--gold); color: #fff;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,.3);
}

/* ── Note badge ── */
.n-badge {
  position: absolute; top: 7px; left: 7px; z-index: 3;
  width: 22px; height: 22px; border-radius: 6px;
  background: var(--gold); display: flex;
  align-items: center; justify-content: center;
  font-size: 11px; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.25);
}

/* ── Card footer ── */
.ifoot {
  padding: 5px 8px;
  display: flex; align-items: center; gap: 5px;
  border-top: 1px solid var(--border-2);
}
.f-stt { font-size: 10px; color: var(--text-3); font-weight: 600; flex-shrink: 0; }
.f-id  {
  font-size: 11px; font-weight: 700; color: var(--text-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}

/* ── Tint overlays ── */
.icard.is-selected .img-wrap::after {
  content: ''; position: absolute; inset: 0; z-index: 1;
  background: var(--selected-bg); pointer-events: none;
}
.icard.is-rejected .img-wrap::after {
  content: ''; position: absolute; inset: 0; z-index: 1;
  background: var(--rejected-bg); pointer-events: none;
}
</style>

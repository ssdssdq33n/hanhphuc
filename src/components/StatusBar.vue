<template>
  <div class="sbar">
    <!-- Progress line at top -->
    <div class="progress-line">
      <div class="pl-sel" :style="{ width: selPct + '%' }"></div>
      <div class="pl-rej" :style="{ left: selPct + '%', width: rejPct + '%' }"></div>
    </div>

    <div class="sbar-inner">
      <div class="s-left">
        <span class="round-chip" :style="{ background: roundColor }">
          {{ store.currentRound?.name }}
        </span>
        <span class="s-pool">Pool <b>{{ stats.total }}</b></span>
      </div>

      <div class="s-center">
        <span class="s-stat"><span class="dot sel"></span>Đã chọn <b class="sel">{{ stats.selected }}</b></span>
        <span class="sep">·</span>
        <span class="s-stat"><span class="dot rej"></span>Đã loại <b class="rej">{{ stats.rejected }}</b></span>
        <span class="sep">·</span>
        <span class="s-stat"><span class="dot pnd"></span>Chưa xử lý <b>{{ stats.pending }}</b></span>
      </div>

      <div class="s-right">
        <span class="s-view">Xem {{ store.filteredImages.length }} ảnh</span>
        <span class="s-hint">Shift+Click dải · Ctrl+Z undo · Ctrl+Y redo</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'
const store = useGalleryStore()

const COLORS = ['#B8955A', '#5A7EB8', '#5AB87A', '#B85AA0', '#B8B85A', '#B86E5A']
const roundColor = computed(() => COLORS[store.currentRoundIndex % COLORS.length])
const stats   = computed(() => store.currentStats)
const selPct  = computed(() => stats.value.total ? +(stats.value.selected / stats.value.total * 100).toFixed(1) : 0)
const rejPct  = computed(() => stats.value.total ? +(stats.value.rejected / stats.value.total * 100).toFixed(1) : 0)
</script>

<style scoped>
.sbar {
  height: var(--status-h);
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  box-shadow: 0 -2px 8px rgba(0,0,0,.04);
  position: relative;
}

.progress-line {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--border-2); overflow: hidden;
}
.pl-sel { position: absolute; left: 0; top: 0; height: 3px; background: var(--selected); transition: width .3s; }
.pl-rej { position: absolute; top: 0; height: 3px; background: var(--rejected); transition: .3s; }

.sbar-inner {
  height: 100%; display: flex; align-items: center;
  padding: 0 16px; gap: 14px;
}

.s-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.round-chip {
  padding: 2px 10px; border-radius: 10px;
  color: #fff; font-size: 11px; font-weight: 700;
  box-shadow: 0 1px 4px rgba(0,0,0,.15);
}
.s-pool { font-size: 11.5px; color: var(--text-3); }
.s-pool b { color: var(--text); font-weight: 700; }

.s-center {
  flex: 1; display: flex; align-items: center;
  gap: 7px; justify-content: center;
}
.s-stat { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-2); }
.s-stat b { font-weight: 700; color: var(--text); font-size: 12.5px; }
.s-stat b.sel { color: var(--selected); }
.s-stat b.rej { color: var(--rejected); }
.dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot.sel { background: var(--selected); }
.dot.rej { background: var(--rejected); }
.dot.pnd { background: var(--text-3); }
.sep { color: var(--border); }

.s-right { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; gap: 0; }
.s-view { font-size: 12px; font-weight: 600; color: var(--text); }
.s-hint { font-size: 10px; color: var(--text-3); }

@media (max-width: 860px) {
  .s-hint { display: none; }
}
@media (max-width: 600px) {
  .s-right .s-view { font-size: 11px; }
  .s-stat { font-size: 11px; gap: 3px; }
  .sbar-inner { padding: 0 10px; gap: 8px; }
}
@media (max-width: 480px) {
  .s-center { display: none; }
  .s-right  { flex-direction: row; align-items: center; gap: 6px; }
}
</style>

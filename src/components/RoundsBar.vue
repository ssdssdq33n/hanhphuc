<template>
  <div class="rounds-bar">
    <div class="rounds-scroll">
      <button
        v-for="(round, idx) in store.rounds"
        :key="round.id"
        class="round-tab"
        :class="{ active: round.id === store.currentRoundId }"
        @click="store.switchRound(round.id)"
        @dblclick="startRename(round)"
        :title="`${round.name}: pool ${getStats(round.id).total} / chọn ${getStats(round.id).selected} / loại ${getStats(round.id).rejected}`"
      >
        <span class="r-dot" :style="{ background: roundColor(idx) }"></span>

        <template v-if="renamingId === round.id">
          <input
            ref="renameEl"
            v-model="renameVal"
            class="r-rename"
            @blur="commitRename"
            @keydown.enter="commitRename"
            @keydown.escape="renamingId = null"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="r-name">{{ round.name }}</span>
          <span class="r-badge">{{ getStats(round.id).selected }}</span>
          <span v-if="store.rounds.length > 1" class="r-del" @click.stop="delRound(round)" title="Xóa vòng">×</span>
        </template>
      </button>

      <button class="round-tab add" @click="store.addRound()" title="Thêm vòng lọc mới">
        + Thêm vòng
      </button>
    </div>

    <div class="rounds-right">
      <span class="pool-info">
        Pool:&nbsp;<strong>{{ store.currentStats.total }}</strong>
        <template v-if="store.currentRoundIndex > 0">
          &nbsp;từ {{ store.rounds[store.currentRoundIndex - 1].name }}
        </template>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'
const store = useGalleryStore()

const COLORS = ['#B8955A', '#5A7EB8', '#5AB87A', '#B85AA0', '#B8B85A', '#B86E5A', '#5AB0B8', '#8A5AB8']
const roundColor = idx => COLORS[idx % COLORS.length]
const getStats = id => store.getStatsForRound(id)

const renamingId = ref(null)
const renameVal = ref('')
const renameEl = ref(null)

function startRename(round) {
  renamingId.value = round.id
  renameVal.value = round.name
  nextTick(() => renameEl.value?.[0]?.focus())
}
function commitRename() {
  if (renamingId.value && renameVal.value.trim())
    store.renameRound(renamingId.value, renameVal.value.trim())
  renamingId.value = null
}
function delRound(round) {
  if (confirm(`Xóa "${round.name}"? Dữ liệu chọn ảnh của vòng này sẽ mất.`))
    store.deleteRound(round.id)
}
</script>

<style scoped>
.rounds-bar {
  height: var(--rounds-h);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center;
  padding: 0 14px;
  gap: 8px;
  flex-shrink: 0;
}

.rounds-scroll {
  display: flex; align-items: center; gap: 4px;
  overflow-x: auto; flex: 1;
  scrollbar-width: none;
}
.rounds-scroll::-webkit-scrollbar { display: none; }

.round-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 11px; border-radius: 18px;
  border: 1.5px solid var(--border);
  background: transparent; cursor: pointer;
  font-size: 12px; font-weight: 500; color: var(--text-2);
  transition: all .14s; white-space: nowrap; font-family: inherit;
  flex-shrink: 0;
}
.round-tab:hover { border-color: var(--gold); color: var(--gold); background: var(--gold-faint); }
.round-tab.active {
  background: var(--gold); border-color: var(--gold);
  color: #fff; font-weight: 600;
  box-shadow: 0 2px 8px rgba(184,149,90,.35);
}
.round-tab.add { border-style: dashed; font-size: 11.5px; opacity: .75; }
.round-tab.add:hover { opacity: 1; }

.r-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.round-tab.active .r-dot { background: rgba(255,255,255,.55) !important; }

.r-name { max-width: 90px; overflow: hidden; text-overflow: ellipsis; }

.r-badge {
  padding: 0 6px; border-radius: 8px; font-size: 11px; font-weight: 700;
  background: rgba(255,255,255,.28);
}
.round-tab:not(.active) .r-badge {
  background: var(--gold-faint); color: var(--gold-dark);
}

.r-del {
  width: 15px; height: 15px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; line-height: 1; opacity: .55; transition: all .12s;
}
.r-del:hover { background: rgba(220,60,60,.75); color: #fff; opacity: 1; }

.r-rename {
  width: 72px; background: transparent; border: none;
  border-bottom: 1.5px solid rgba(255,255,255,.6);
  color: #fff; font-size: 12px; font-weight: 600;
  outline: none; font-family: inherit;
}

.rounds-right { flex-shrink: 0; font-size: 11.5px; color: var(--text-3); white-space: nowrap; }
.rounds-right strong { color: var(--text-2); font-weight: 700; }
</style>

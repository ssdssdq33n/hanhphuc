<template>
  <header class="app-header">
    <!-- Brand -->
    <div class="brand">
      <span class="brand-icon">❀</span>
      <div class="brand-text">
        <div class="brand-name">Hạnh Phúc Gallery</div>
        <div class="brand-sub">{{ store.images.length }} ảnh · {{ store.allWarehouse.length }} bộ</div>
      </div>
    </div>

    <!-- Folder storage status (center) -->
    <div class="header-center">

      <!-- Checking on startup -->
      <div v-if="store.folderStatus === 'loading'" class="fs-badge muted">
        <div class="spin-sm"></div>
        Đang kiểm tra...
      </div>

      <!-- Ready — folder active -->
      <div v-else-if="store.folderStatus === 'ready'" class="fs-badge success" :title="`Dữ liệu lưu tại: ${store.folderName}`">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="fs-name">{{ store.folderName }}</span>
        <span class="fs-dot"></span>
        <button class="fs-change" @click="store.pickDataFolder()" title="Đổi thư mục">đổi</button>
        <button class="fs-disc" @click="confirmDisconnect" title="Ngừng lưu vào thư mục">×</button>
      </div>

      <!-- Permission needed — stored handle but needs re-grant -->
      <button
        v-else-if="store.folderStatus === 'permission-needed'"
        class="fs-badge warn"
        @click="store.reconnectFolder()"
        title="Click để kết nối lại và tải dữ liệu từ thư mục"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Kết nối lại thư mục <strong>{{ store.folderName }}</strong></span>
      </button>

      <!-- Idle — no folder configured yet (API supported) -->
      <button
        v-else-if="store.folderStatus === 'idle'"
        class="fs-badge idle"
        @click="store.pickDataFolder()"
        title="Chọn thư mục để lưu dữ liệu ra file JSON (e.g. D:\data-hp)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        Chọn thư mục lưu data
      </button>

      <!-- Unsupported browser (Firefox / Safari) — fall back to IndexedDB only -->
      <div v-else-if="store.folderStatus === 'unsupported'" class="fs-badge muted" title="Dữ liệu tự lưu trong trình duyệt (IndexedDB)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Auto-saved (Browser)
      </div>

    </div>

    <!-- Header actions -->
    <div class="header-actions">
      <button class="hbtn accent" @click="store.exportModalOpen = true" title="Xuất Excel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Xuất Excel
      </button>

      <div class="hbtn-group" ref="menuRef">
        <button class="hbtn icon" @click="menuOpen = !menuOpen" title="Tuỳ chọn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>
        </button>
        <div v-if="menuOpen" class="hdrop" @click="menuOpen = false">
          <button @click="store.exportStateJSON()">💾 Lưu tiến trình (JSON)</button>
          <button @click="triggerImport">📂 Tải tiến trình (JSON)</button>
          <template v-if="store.folderStatus !== 'unsupported'">
            <div class="hdrop-div"></div>
            <button v-if="store.folderStatus !== 'ready'" @click="store.pickDataFolder()">📁 Chọn thư mục data...</button>
            <button v-if="store.folderStatus === 'ready'" @click="store.flushFolderSave()">💾 Lưu ngay vào thư mục</button>
            <button v-if="store.folderStatus === 'ready'" @click="confirmDisconnect">⏏ Ngắt kết nối thư mục data</button>
            <div class="hdrop-div"></div>
            <button v-if="!store.imagesReady" @click="store.pickImagesFolder()" title="Chọn thư mục gốc chứa ảnh JPG gốc để xem chất lượng cao trong Compare">
              🖼 Chọn thư mục ảnh gốc...
            </button>
            <button v-else @click="store.reconnectImagesFolder()" class="success-text">
              🖼 Ảnh gốc: {{ store.imagesFolderName }}
            </button>
            <button v-if="store.imagesReady" @click="store.disconnectImagesFolder()">⏏ Ngắt thư mục ảnh gốc</button>
          </template>
          <div class="hdrop-div"></div>
          <button class="danger" @click="confirmReset">🗑 Reset tất cả dữ liệu</button>
          <input ref="importFile" type="file" accept=".json" style="display:none" @change="handleImport" />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store     = useGalleryStore()
const menuOpen  = ref(false)
const menuRef   = ref(null)
const importFile = ref(null)

function triggerImport() { importFile.value?.click() }
async function handleImport(e) {
  const f = e.target.files?.[0]; if (!f) return
  try { await store.importStateJSON(f); alert('Đã tải tiến trình!') }
  catch (err) { alert('Lỗi: ' + err.message) }
  e.target.value = ''
}
function confirmReset() {
  menuOpen.value = false
  if (confirm('Reset toàn bộ dữ liệu? Không thể hoàn tác!')) store.resetAllData()
}
function confirmDisconnect() {
  menuOpen.value = false
  if (confirm(`Ngắt kết nối thư mục "${store.folderName}"?\nDữ liệu vẫn còn trong trình duyệt (IndexedDB).`))
    store.disconnectFolder()
}

const onOutside = e => { if (menuRef.value && !menuRef.value.contains(e.target)) menuOpen.value = false }
onMounted(()   => document.addEventListener('click', onOutside))
onUnmounted(() => document.removeEventListener('click', onOutside))
</script>

<style scoped>
.app-header {
  height: var(--header-h);
  background: var(--bg-header);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center;
  padding: 0 18px; gap: 14px; flex-shrink: 0;
  box-shadow: var(--shadow-sm); z-index: 100;
}

.brand { display: flex; align-items: center; gap: 10px; }
.brand-icon { font-size: 22px; color: var(--gold); line-height: 1; }
.brand-name { font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
.brand-sub  { font-size: 11px; color: var(--text-3); }

.header-center { flex: 1; display: flex; justify-content: center; }

/* ── Folder storage badge ── */
.fs-badge {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 11px; border-radius: 20px;
  font-size: 12px; font-weight: 500;
  border: 1.5px solid transparent;
  transition: all .14s; white-space: nowrap;
}
.fs-badge svg { width: 13px; height: 13px; flex-shrink: 0; }
button.fs-badge { cursor: pointer; font-family: inherit; }

.fs-badge.success {
  background: #F0FBF0; border-color: #C8E6C9; color: #2E7D32;
}
.fs-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4CAF50; animation: pulse 2s infinite;
}
@keyframes pulse {
  0%,100% { opacity: 1; } 50% { opacity: 0.4; }
}
.fs-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.fs-change, .fs-disc {
  border: none; background: none; cursor: pointer;
  font-size: 11px; padding: 0 3px;
  color: inherit; opacity: .55; font-family: inherit;
}
.fs-change:hover { opacity: 1; text-decoration: underline; }
.fs-disc { font-size: 15px; line-height: 1; }
.fs-disc:hover { opacity: 1; color: var(--rejected); }

.fs-badge.warn {
  background: #FFF8E1; border-color: #FFD54F; color: #F57F17;
}
.fs-badge.warn:hover { background: #FFF3CD; border-color: #FFC107; }

.fs-badge.idle {
  background: transparent; border: 1.5px dashed var(--border);
  color: var(--text-3);
}
.fs-badge.idle:hover { border-color: var(--gold); color: var(--gold); background: var(--gold-faint); }

.fs-badge.muted {
  background: var(--gold-faint); border-color: var(--gold-light);
  color: var(--gold-dark);
}

/* ── Spinner ── */
.spin-sm {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--gold);
  animation: spin .7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Header actions ── */
.header-actions { display: flex; align-items: center; gap: 7px; }
.hbtn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 13px; border-radius: 8px;
  border: 1.5px solid var(--border); background: transparent;
  cursor: pointer; font-size: 13px; color: var(--text-2);
  transition: all .14s; white-space: nowrap;
}
.hbtn svg { width: 14px; height: 14px; }
.hbtn:hover { border-color: var(--gold); color: var(--gold); background: var(--gold-faint); }
.hbtn.accent { background: var(--gold); border-color: var(--gold); color: #fff; font-weight: 600; }
.hbtn.accent:hover { background: var(--gold-dark); border-color: var(--gold-dark); }
.hbtn.icon { padding: 6px 8px; }

.hbtn-group { position: relative; }
.hdrop {
  position: absolute; right: 0; top: calc(100% + 6px);
  background: #fff; border: 1px solid var(--border);
  border-radius: 10px; box-shadow: var(--shadow-lg);
  min-width: 220px; overflow: hidden; z-index: 300;
}
.hdrop button {
  display: block; width: 100%; padding: 9px 14px;
  border: none; background: transparent; text-align: left;
  cursor: pointer; font-size: 13px; color: var(--text);
  font-family: inherit; transition: background .1s;
}
.hdrop button:hover { background: var(--bg); }
.hdrop button.danger { color: var(--rejected); }
.hdrop button.success-text { color: #2E7D32; }
.hdrop-div { border-top: 1px solid var(--border); margin: 3px 0; }
</style>

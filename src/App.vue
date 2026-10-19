<template>
  <div class="app-root">
    <AppHeader />
    <RoundsBar />
    <div class="workspace">
      <aside class="sidebar" :class="{ open: sidebarOpen }">
        <FilterSidebar />
      </aside>
      <main class="gallery-main">
        <GalleryToolbar @toggle-sidebar="sidebarOpen = !sidebarOpen" :sidebar-open="sidebarOpen" />
        <GalleryGrid />
      </main>
    </div>
    <StatusBar />
    <NoteModal />
    <LightboxViewer />
    <ExportModal />
    <ComparePanel />
    <BatchNoteModal />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'
import AppHeader from '@/components/AppHeader.vue'
import RoundsBar from '@/components/RoundsBar.vue'
import FilterSidebar from '@/components/FilterSidebar.vue'
import GalleryToolbar from '@/components/GalleryToolbar.vue'
import GalleryGrid from '@/components/GalleryGrid.vue'
import StatusBar from '@/components/StatusBar.vue'
import NoteModal from '@/components/NoteModal.vue'
import LightboxViewer from '@/components/LightboxViewer.vue'
import ExportModal from '@/components/ExportModal.vue'
import ComparePanel from '@/components/ComparePanel.vue'
import BatchNoteModal from '@/components/BatchNoteModal.vue'

const store = useGalleryStore()
const sidebarOpen = ref(true)

onMounted(async () => {
  await store.initialize()
})
</script>

<style>
/* ── CSS Variables ───────────────────────────────────── */
:root {
  --bg:            #F7F4F0;
  --bg-card:       #FFFFFF;
  --bg-sidebar:    #FDFBF8;
  --bg-header:     #FFFFFF;
  --gold:          #B8955A;
  --gold-light:    #D4B483;
  --gold-dark:     #8C6E3D;
  --gold-faint:    #F5EDD9;
  --selected:      #2E7D32;
  --selected-bg:   rgba(46,125,50,0.08);
  --selected-ring: rgba(46,125,50,0.30);
  --rejected:      #C62828;
  --rejected-bg:   rgba(198,40,40,0.06);
  --rejected-ring: rgba(198,40,40,0.30);
  --text:          #18181B;
  --text-2:        #52525B;
  --text-3:        #A1A1AA;
  --border:        #E5DFD8;
  --border-2:      #F0EBE4;
  --shadow-sm:     0 1px 3px rgba(0,0,0,0.07);
  --shadow-md:     0 4px 16px rgba(0,0,0,0.09);
  --shadow-lg:     0 12px 40px rgba(0,0,0,0.13);
  --radius:        10px;
  --sidebar-w:     268px;
  --header-h:      56px;
  --rounds-h:      44px;
  --status-h:      46px;

  /* legacy aliases so ExportModal/NoteModal still work */
  --bg-primary:       #F7F4F0;
  --accent-gold:      #B8955A;
  --accent-gold-dark: #8C6E3D;
  --text-primary:     #18181B;
  --text-secondary:   #52525B;
  --text-muted:       #A1A1AA;
  --color-selected:   #2E7D32;
  --color-rejected:   #C62828;
}

/* ── Reset ───────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

/* ── Scrollbar ───────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--gold-light); }

/* ── Layout ──────────────────────────────────────────── */
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  width: 0;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  transition: width 0.22s ease;
}
.sidebar.open { width: var(--sidebar-w); overflow-y: auto; }

.gallery-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Utility ─────────────────────────────────────────── */
button, input, textarea, select { font-family: inherit; }
img { display: block; }
</style>

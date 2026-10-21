<template>
  <!-- PhotoSwipe mounts itself to body; this component just manages its lifecycle -->
  <div></div>
</template>

<script setup>
import { watch, onUnmounted } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store = useGalleryStore()

let pswp = null
let items = []            // mutable — src upgraded to full-res as slides are visited
const loadedFullRes = new Set()  // indices already upgraded

async function loadFullResForSlide(idx) {
  if (!store.imagesReady || loadedFullRes.has(idx)) return
  if (idx < 0 || idx >= items.length) return
  const imgData = items[idx]._imgData
  const url = await store.getFullResUrl(imgData)
  if (!url) return
  loadedFullRes.add(idx)
  items[idx].src = url
  // Refresh the slide in PhotoSwipe so it re-renders at full resolution
  if (pswp && Math.abs(pswp.currIndex - idx) <= 1) {
    try { pswp.refreshSlideContent(idx) } catch {}
  }
}

async function openAt(startIndex) {
  if (pswp) { pswp.destroy(); pswp = null }
  loadedFullRes.clear()

  const { default: PhotoSwipe } = await import('photoswipe')

  items = store.filteredImages.map(img => ({
    // Always start with thumbnail; full-res loads on-demand when imagesReady
    src:   `./${img.thumbPath}`,
    msrc:  `./${img.thumbPath}`,
    width:  img.width  || 1600,
    height: img.height || 1067,
    alt: img.id,
    _imgData: img,
  }))

  pswp = new PhotoSwipe({
    dataSource: items,
    index: startIndex,
    bgOpacity: 0.92,
    showHideAnimationType: 'zoom',
    zoom: true,
    closeTitle: 'Đóng (Esc)',
    zoomTitle: 'Phóng to',
    arrowPrevTitle: 'Ảnh trước (←)',
    arrowNextTitle: 'Ảnh sau (→)',
    padding: { top: 20, bottom: 60, left: 20, right: 20 },
  })

  // Custom UI: inject toolbar into PhotoSwipe
  pswp.on('uiRegister', () => {
    // "Select/Reject" button
    pswp.ui.registerElement({
      name: 'select-button',
      order: 9,
      isButton: true,
      appendTo: 'bar',
      html: '',
      onInit: (el) => {
        const update = () => {
          const img = pswp.currSlide?.data?._imgData
          if (!img) return
          const st = store.selections[img.id]?.[store.currentRoundId] ?? null
          if (st === 'selected') {
            el.innerHTML = '✓ Đã chọn'
            el.className = 'pswp__button pswp__button--select pswp-sel-active'
          } else if (st === 'rejected') {
            el.innerHTML = '✗ Đã loại'
            el.className = 'pswp__button pswp__button--select pswp-rej-active'
          } else {
            el.innerHTML = '○ Chọn ảnh'
            el.className = 'pswp__button pswp__button--select'
          }
        }
        update()
        pswp.on('change', update)
        el.addEventListener('click', () => {
          const img = pswp.currSlide?.data?._imgData
          if (img) { store.toggleStatus(img.id); update() }
        })
      },
    })

    // "View Original" button
    pswp.ui.registerElement({
      name: 'original-button',
      order: 10,
      isButton: true,
      appendTo: 'bar',
      html: '🖼 Ảnh gốc',
      onInit: (el) => {
        el.className = 'pswp__button pswp__button--original'
        const update = () => {
          const img = pswp.currSlide?.data?._imgData
          if (!img) { el.style.display = 'none'; return }
          el.style.display = 'flex'
          el.title = store.imagesReady
            ? `Mở ảnh gốc: ${img.filename}`
            : 'Kết nối thư mục ảnh gốc trong menu Options để xem ảnh gốc'
          el.style.opacity = store.imagesReady ? '1' : '0.45'
        }
        update()
        pswp.on('change', update)
        el.addEventListener('click', async () => {
          const img = pswp.currSlide?.data?._imgData
          if (!img) return
          if (!store.imagesReady) {
            alert(`Chưa kết nối thư mục ảnh gốc.\n\nVào menu Options → "Chọn thư mục ảnh gốc..." để xem ảnh gốc chất lượng cao.`)
            return
          }
          const url = await store.getFullResUrl(img)
          if (url) { window.open(url, '_blank') }
          else { alert(`Không tìm thấy file: ${img.path}`) }
        })
      },
    })

    // "Note" button
    pswp.ui.registerElement({
      name: 'note-button',
      order: 11,
      isButton: true,
      appendTo: 'bar',
      html: '📝 Ghi chú',
      onInit: (el) => {
        el.className = 'pswp__button pswp__button--note'
        el.addEventListener('click', () => {
          const img = pswp.currSlide?.data?._imgData
          if (img) {
            pswp.close()
            store.noteModalImageId = img.id
          }
        })
      },
    })
  })

  // Load full-res for current + adjacent slides when available
  pswp.on('change', () => {
    updateCaption()
    const idx = pswp.currIndex
    loadFullResForSlide(idx)
    loadFullResForSlide(idx - 1)
    loadFullResForSlide(idx + 1)
  })

  pswp.on('afterInit', () => {
    updateCaption()
    // Load full-res for the opening slide
    loadFullResForSlide(startIndex)
    loadFullResForSlide(startIndex - 1)
    loadFullResForSlide(startIndex + 1)
  })

  function updateCaption() {
    let captionEl = document.querySelector('.pswp__custom-caption')
    if (!captionEl) {
      captionEl = document.createElement('div')
      captionEl.className = 'pswp__custom-caption'
      document.querySelector('.pswp')?.appendChild(captionEl)
    }
    const img = pswp.currSlide?.data?._imgData
    if (!img) return
    const note = store.notes[img.id]
    captionEl.innerHTML = `
      <span class="cap-id">${img.id}</span>
      <span class="cap-stt">#${img.stt}</span>
      <span class="cap-folder">${img.warehouse}${img.album ? ' / ' + img.album : ''}</span>
      ${note?.text ? `<span class="cap-note">📝 ${note.text.slice(0, 80)}${note.text.length > 80 ? '…' : ''}</span>` : ''}
    `
  }

  pswp.on('close', () => {
    store.closeLightbox()
    pswp = null
    document.querySelector('.pswp__custom-caption')?.remove()
  })

  pswp.init()
}

watch(() => store.lightboxStartIndex, (idx) => {
  if (idx !== null && idx !== undefined) {
    openAt(idx)
  } else if (pswp) {
    pswp.destroy()
    pswp = null
  }
})

onUnmounted(() => {
  if (pswp) { pswp.destroy(); pswp = null }
})
</script>

<style>
/* PhotoSwipe custom styles — global (not scoped) */
.pswp__button--select,
.pswp__button--original,
.pswp__button--note {
  display: flex !important;
  align-items: center;
  padding: 0 14px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  border-radius: 20px !important;
  margin: 0 4px !important;
  height: 34px !important;
  width: auto !important;
  background: rgba(255,255,255,0.15) !important;
  backdrop-filter: blur(4px);
  border: 1.5px solid rgba(255,255,255,0.3) !important;
  color: #fff !important;
  cursor: pointer !important;
  font-family: 'Be Vietnam Pro', sans-serif !important;
  transition: all 0.15s !important;
  white-space: nowrap;
}
.pswp__button--select:hover,
.pswp__button--original:hover,
.pswp__button--note:hover {
  background: rgba(255,255,255,0.25) !important;
}
.pswp__button--select.pswp-sel-active {
  background: rgba(76,175,80,0.8) !important;
  border-color: #4caf50 !important;
}
.pswp__button--select.pswp-rej-active {
  background: rgba(220,80,80,0.8) !important;
  border-color: #dc5050 !important;
}
.pswp__button--original { opacity: 0.8; }

.pswp__custom-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 14px 20px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  z-index: 1;
  pointer-events: none;
}
.cap-id { font-weight: 700; font-size: 14px; color: #fff; }
.cap-stt { font-size: 12px; color: rgba(255,255,255,0.6); }
.cap-folder { font-size: 12px; color: rgba(255,255,255,0.5); }
.cap-note {
  font-size: 12px;
  color: rgba(255,255,200,0.9);
  background: rgba(200,169,126,0.3);
  padding: 2px 10px;
  border-radius: 10px;
}

/* Override default zoom icon with text */
.pswp__button--zoom::before { content: none; }
</style>

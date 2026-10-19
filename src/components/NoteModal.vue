<template>
  <Teleport to="body">
    <div v-if="imageId" class="note-backdrop" @click.self="close">
      <div class="note-modal">
        <!-- Header -->
        <div class="note-header">
          <div class="note-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="note-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Ghi chú ảnh
          </div>
          <div class="note-meta">
            <span class="img-id">{{ image?.id }}</span>
            <span class="img-folder">{{ image?.warehouse }}</span>
          </div>
          <button class="close-btn" @click="close">×</button>
        </div>

        <div class="note-body">
          <!-- Thumbnail -->
          <div class="note-thumb">
            <img :src="thumbSrc" :alt="image?.id" />
          </div>

          <!-- Edit area -->
          <div class="note-edit">
            <!-- Quick tags -->
            <div class="tag-label">Thêm nhãn nhanh:</div>
            <div class="quick-tags">
              <button
                v-for="tag in QUICK_TAGS"
                :key="tag"
                class="quick-tag"
                :class="{ active: activeTags.has(tag) }"
                @click="toggleTag(tag)"
              >{{ tag }}</button>
            </div>

            <!-- Active tags display -->
            <div v-if="activeTags.size" class="active-tags">
              <span v-for="tag in activeTags" :key="tag" class="tag-chip">
                {{ tag }}
                <span class="tag-x" @click="toggleTag(tag)">×</span>
              </span>
            </div>

            <!-- Text note -->
            <textarea
              ref="textareaEl"
              v-model="noteText"
              class="note-textarea"
              placeholder="Ghi chú chi tiết... (ví dụ: cần làm mịn da vùng trán, chỉnh màu áo cô dâu)"
              rows="4"
            ></textarea>

            <!-- Prev/next navigation within filtered images -->
            <div class="note-nav">
              <button class="nav-btn" :disabled="!prevImage" @click="goTo(prevImage)">← Ảnh trước</button>
              <button class="save-btn" @click="saveAndClose">💾 Lưu ghi chú</button>
              <button class="nav-btn" :disabled="!nextImage" @click="goTo(nextImage)">Ảnh sau →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store = useGalleryStore()

const QUICK_TAGS = [
  '✏️ Cần chỉnh sửa',
  '💡 Chỉnh sáng',
  '🎨 Đổi tone',
  '✂️ Crop lại',
  '💆 Làm mịn da',
  '🔄 Góc khác',
  '⭐ Ưu tiên cao',
  '✅ OK rồi',
  '🗑 Loại ảnh',
]

const noteText = ref('')
const activeTags = ref(new Set())
const textareaEl = ref(null)

const imageId = computed(() => store.noteModalImageId)
const image = computed(() => store.images.find(i => i.id === imageId.value) ?? null)
const thumbSrc = computed(() => image.value ? `./${image.value.thumbPath}` : '')

// Navigation within filteredImages
const currentIndex = computed(() => store.filteredImages.findIndex(i => i.id === imageId.value))
const prevImage = computed(() => store.filteredImages[currentIndex.value - 1] ?? null)
const nextImage = computed(() => store.filteredImages[currentIndex.value + 1] ?? null)

watch(imageId, (id) => {
  if (!id) return
  const saved = store.notes[id]
  noteText.value = saved?.text ?? ''
  activeTags.value = new Set(saved?.tags ?? [])
  nextTick(() => textareaEl.value?.focus())
})

function toggleTag(tag) {
  if (activeTags.value.has(tag)) activeTags.value.delete(tag)
  else activeTags.value.add(tag)
}

function saveAndClose() {
  if (imageId.value) {
    store.saveNote(imageId.value, noteText.value.trim(), [...activeTags.value])
  }
  close()
}

function close() {
  // Auto-save on close
  if (imageId.value) {
    store.saveNote(imageId.value, noteText.value.trim(), [...activeTags.value])
  }
  store.noteModalImageId = null
}

function goTo(img) {
  if (!img) return
  // Save current note before switching
  if (imageId.value) {
    store.saveNote(imageId.value, noteText.value.trim(), [...activeTags.value])
  }
  store.noteModalImageId = img.id
}
</script>

<style scoped>
.note-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  backdrop-filter: blur(2px);
}

.note-modal {
  background: #fff;
  border-radius: 14px;
  width: min(700px, 95vw);
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}

.note-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.note-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}
.note-icon { width: 18px; height: 18px; color: var(--accent-gold); }

.note-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: auto;
  text-align: right;
}
.img-id { font-size: 13px; font-weight: 700; color: var(--accent-gold-dark); }
.img-folder { font-size: 11px; color: var(--text-muted); }

.close-btn {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.close-btn:hover { background: #f0e0e0; color: #dc3545; }

.note-body {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 0;
}

.note-thumb {
  padding: 20px;
  border-right: 1px solid var(--border);
}
.note-thumb img {
  width: 100%;
  border-radius: 8px;
  object-fit: contain;
  max-height: 280px;
}

.note-edit { padding: 20px; display: flex; flex-direction: column; gap: 12px; }

.tag-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

.quick-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.quick-tag {
  padding: 5px 10px;
  border-radius: 16px;
  border: 1.5px solid var(--border);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: inherit;
  transition: all 0.12s;
}
.quick-tag:hover { border-color: var(--accent-gold); color: var(--accent-gold); }
.quick-tag.active { background: var(--accent-gold); border-color: var(--accent-gold); color: #fff; font-weight: 600; }

.active-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tag-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 9px;
  background: rgba(200,169,126,0.12);
  border: 1px solid var(--accent-gold);
  border-radius: 10px;
  font-size: 11px;
  color: var(--accent-gold-dark);
}
.tag-x { cursor: pointer; font-weight: 700; }

.note-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary);
  resize: vertical;
  outline: none;
  line-height: 1.6;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.note-textarea:focus { border-color: var(--accent-gold); }

.note-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.nav-btn {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: inherit;
  transition: all 0.12s;
  white-space: nowrap;
}
.nav-btn:hover:not(:disabled) { border-color: var(--accent-gold); color: var(--accent-gold); }
.nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.save-btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--accent-gold);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.15s;
}
.save-btn:hover { background: var(--accent-gold-dark); }

@media (max-width: 560px) {
  .note-body { grid-template-columns: 1fr; }
  .note-thumb { border-right: none; border-bottom: 1px solid var(--border); padding: 12px; }
}
</style>

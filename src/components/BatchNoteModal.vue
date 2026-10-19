<template>
  <Teleport to="body">
    <div v-if="store.batchNoteOpen" class="bnm-backdrop" @click.self="close">
      <div class="bnm-modal">
        <!-- Header -->
        <div class="bnm-header">
          <div class="bnm-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="bnm-icon">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Ghi chú hàng loạt
          </div>
          <div class="bnm-subtitle">{{ store.batchNoteTargets.length }} ảnh đã chọn trong khung nhìn hiện tại</div>
          <button class="bnm-close" @click="close">×</button>
        </div>

        <!-- Body -->
        <div class="bnm-body">
          <!-- Note text -->
          <div class="form-group">
            <label class="form-label">Nội dung ghi chú</label>
            <textarea
              v-model="noteText"
              class="note-ta"
              placeholder="Nhập ghi chú cho tất cả ảnh đã chọn..."
              rows="4"
              ref="taRef"
            ></textarea>
          </div>

          <!-- Tags -->
          <div class="form-group">
            <label class="form-label">Tags</label>
            <div class="tags-wrap">
              <div class="tag-chips">
                <span v-for="t in tags" :key="t" class="tag-chip">
                  {{ t }}
                  <button class="tag-rm" @click="removeTag(t)">×</button>
                </span>
                <input
                  v-model="tagInput"
                  class="tag-in"
                  placeholder="Nhập tag, Enter để thêm..."
                  @keydown.enter.prevent="addTag"
                  @keydown.comma.prevent="addTag"
                  @keydown.backspace="onTagBackspace"
                />
              </div>
            </div>
            <div class="tag-hints">
              <span
                v-for="h in tagHints"
                :key="h"
                class="tag-hint"
                @click="addTagValue(h)"
              >+ {{ h }}</span>
            </div>
          </div>

          <!-- Mode -->
          <div class="form-group">
            <label class="form-label">Chế độ áp dụng</label>
            <div class="mode-opts">
              <label class="mode-opt" :class="{ active: mode === 'replace' }">
                <input type="radio" v-model="mode" value="replace" />
                <div class="mode-body">
                  <span class="mode-name">Thay thế</span>
                  <span class="mode-desc">Ghi đè toàn bộ ghi chú hiện tại</span>
                </div>
              </label>
              <label class="mode-opt" :class="{ active: mode === 'append' }">
                <input type="radio" v-model="mode" value="append" />
                <div class="mode-body">
                  <span class="mode-name">Bổ sung thêm</span>
                  <span class="mode-desc">Gộp với ghi chú & tags đang có</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Preview -->
          <div class="bnm-preview">
            <span class="prev-label">Áp dụng cho:</span>
            <span class="prev-val">
              <strong>{{ store.batchNoteTargets.length }}</strong> ảnh đã chọn
              <span v-if="store.filters.search"> (tìm kiếm: "{{ store.filters.search }}")</span>
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="bnm-footer">
          <button class="btn-cancel" @click="close">Hủy</button>
          <button
            class="btn-apply"
            :disabled="!noteText && tags.length === 0"
            @click="apply"
          >
            ✓ Áp dụng cho {{ store.batchNoteTargets.length }} ảnh
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useGalleryStore } from '@/stores/gallery.js'

const store    = useGalleryStore()
const noteText = ref('')
const tags     = ref([])
const tagInput = ref('')
const mode     = ref('replace')
const taRef    = ref(null)

const tagHints = ['OK', 'Print', 'Favorite', 'Touch-up', 'Review', 'Skip']

watch(() => store.batchNoteOpen, async (open) => {
  if (open) {
    noteText.value = ''
    tags.value     = []
    tagInput.value = ''
    mode.value     = 'replace'
    await nextTick()
    taRef.value?.focus()
  }
})

function addTagValue(val) {
  const v = val.trim()
  if (v && !tags.value.includes(v)) tags.value.push(v)
}

function addTag() {
  const parts = tagInput.value.split(/[,，]/)
  for (const p of parts) addTagValue(p)
  tagInput.value = ''
}

function removeTag(t) {
  tags.value = tags.value.filter(x => x !== t)
}

function onTagBackspace() {
  if (!tagInput.value && tags.value.length > 0) tags.value.pop()
}

function close() { store.batchNoteOpen = false }

function apply() {
  store.saveBatchNote(store.batchNoteTargets, noteText.value, tags.value, mode.value)
  close()
}
</script>

<style scoped>
.bnm-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 350;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  backdrop-filter: blur(2px);
}

.bnm-modal {
  background: #fff; border-radius: 14px;
  width: min(520px, 95vw);
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
  overflow: hidden; display: flex; flex-direction: column;
}

.bnm-header {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.bnm-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 16px; font-weight: 700; color: var(--text);
  flex: 1;
}
.bnm-icon { width: 18px; height: 18px; color: #3B6EA5; flex-shrink: 0; }
.bnm-subtitle { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.bnm-close {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: var(--bg);
  cursor: pointer; font-size: 20px; color: var(--text-3);
  display: flex; align-items: center; justify-content: center;
  transition: all .12s; flex-shrink: 0;
}
.bnm-close:hover { background: #f0e0e0; color: var(--rejected); }

.bnm-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }

.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-3);
}

.note-ta {
  width: 100%; padding: 10px 12px;
  border: 1.5px solid var(--border); border-radius: 8px;
  font-size: 13.5px; font-family: inherit; color: var(--text);
  resize: vertical; outline: none;
  background: var(--bg); transition: border-color .14s;
}
.note-ta:focus { border-color: var(--accent-gold); background: #fff; }

.tags-wrap {
  border: 1.5px solid var(--border); border-radius: 8px;
  padding: 6px 8px; cursor: text;
  background: var(--bg); transition: border-color .14s;
  min-height: 40px;
}
.tags-wrap:focus-within { border-color: var(--accent-gold); background: #fff; }
.tag-chips { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.tag-chip {
  display: flex; align-items: center; gap: 4px;
  background: var(--gold-faint); border: 1px solid var(--gold-light);
  color: var(--gold-dark); font-size: 12px; font-weight: 600;
  padding: 2px 8px; border-radius: 12px;
}
.tag-rm {
  border: none; background: none; cursor: pointer;
  color: var(--gold-dark); font-size: 14px; line-height: 1; padding: 0;
  opacity: .6;
}
.tag-rm:hover { opacity: 1; }
.tag-in {
  flex: 1; min-width: 120px; border: none; background: transparent;
  outline: none; font-size: 12.5px; color: var(--text); font-family: inherit;
  padding: 2px 0;
}

.tag-hints { display: flex; flex-wrap: wrap; gap: 5px; }
.tag-hint {
  font-size: 11px; color: var(--text-3);
  border: 1px dashed var(--border); border-radius: 8px;
  padding: 2px 8px; cursor: pointer;
  transition: all .12s;
}
.tag-hint:hover { border-color: var(--gold); color: var(--gold-dark); background: var(--gold-faint); }

.mode-opts { display: flex; gap: 8px; }
.mode-opt {
  flex: 1; display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border-radius: 8px;
  border: 1.5px solid var(--border);
  cursor: pointer; transition: all .14s;
}
.mode-opt input { margin-top: 2px; accent-color: var(--accent-gold); flex-shrink: 0; }
.mode-opt.active { border-color: var(--accent-gold); background: var(--gold-faint); }
.mode-body { display: flex; flex-direction: column; gap: 2px; }
.mode-name { font-size: 13px; font-weight: 600; color: var(--text); }
.mode-desc { font-size: 11px; color: var(--text-3); }

.bnm-preview {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: rgba(59,110,165,0.07);
  border: 1px solid rgba(59,110,165,0.2);
  border-radius: 8px; font-size: 13px;
}
.prev-label { color: var(--text-3); font-weight: 600; }
.prev-val strong { color: #3B6EA5; }

.bnm-footer {
  display: flex; gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}
.btn-cancel {
  padding: 9px 20px; border-radius: 8px;
  border: 1.5px solid var(--border); background: transparent;
  cursor: pointer; font-size: 14px; font-family: inherit;
  color: var(--text-2); transition: border-color .12s;
}
.btn-cancel:hover { border-color: var(--gold); }
.btn-apply {
  flex: 1; padding: 9px 20px; border-radius: 8px;
  border: none; background: #3B6EA5; color: #fff;
  cursor: pointer; font-size: 14px; font-weight: 600;
  font-family: inherit; transition: background .14s;
}
.btn-apply:hover:not(:disabled) { background: #2d5a8e; }
.btn-apply:disabled { opacity: .5; cursor: not-allowed; }
</style>

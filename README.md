# Hạnh Phúc Gallery — Web Lọc Ảnh Studio

Web app lọc ảnh cưới nhiều vòng, xuất Excel, ghi chú, xem ảnh gốc.

## Chạy local (đầy đủ tính năng)

```bash
npm install
npm run dev
```

Mở trình duyệt: `http://localhost:5173`

> **Lần đầu**: thumbnails đã được generate sẵn. Nếu thêm ảnh mới thì chạy `npm run generate`.

## Cấu trúc thư mục

```
images/                   ← ảnh gốc (KHÔNG đẩy lên GitHub)
  warehouse1/
    TUẤN ANH - HIỀN THỊ JPG/
      *.JPG
  warehouse2/...
public/
  thumbnails/              ← thumbnails WebP 500px (đẩy lên GitHub)
  manifest.json            ← danh sách ảnh (đẩy lên GitHub)
src/                       ← source code Vue
```

## Thêm ảnh mới

1. Đặt ảnh vào `images/<bộ>/<album>/`
2. Chạy `npm run generate` để cập nhật thumbnails + manifest
3. Chạy lại `npm run dev`

## Deploy lên GitHub Pages

1. Tạo repo GitHub, push code lên nhánh `main`
2. Vào **Settings → Pages → Source**: chọn **GitHub Actions**
3. Push → Actions tự deploy

> Trên GitHub Pages chỉ có thumbnails (không có ảnh gốc). Để xem ảnh gốc full resolution cần chạy local.

## Tính năng

- **Nhiều vòng lọc** — pool-based: vòng N chỉ chứa ảnh được chọn từ vòng N-1
- **Chọn/loại/bỏ chọn** — click cycle, Shift+Click chọn dải, Ctrl+Click rời rạc
- **Undo/Redo** — Ctrl+Z / Ctrl+Y, bao gồm cả cascade effects
- **Ghi chú** — text + tag nhanh (cần sửa sáng, làm mịn da, v.v.)
- **Search & Filter** — theo ID, folder, trạng thái, có note, STT range
- **Lightbox** — xem ảnh, chọn/loại ngay trong lightbox, nút "Ảnh gốc"
- **Xuất Excel** — ảnh nhúng thật, chọn theo vòng + trạng thái
- **Auto-save** — lưu vào IndexedDB, tắt mở lại vẫn còn
- **Backup/Restore** — export/import JSON state
# hanhphuc

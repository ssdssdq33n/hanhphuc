/**
 * Generate manifest.json and WebP thumbnails from images/ folder.
 * Run: node scripts/generate.js
 *      node scripts/generate.js --force   (regenerate all thumbnails)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMAGES_DIR = path.join(ROOT, 'images')
const THUMB_DIR = path.join(ROOT, 'public', 'thumbnails')
const MANIFEST_PATH = path.join(ROOT, 'public', 'manifest.json')

const THUMB_WIDTH = 1200    // px, max width for thumbnails
const THUMB_QUALITY = 80    // WebP quality
const PLACEHOLDER_SIZE = 14 // tiny LQIP placeholder
const CONCURRENCY = 8       // parallel Sharp operations

// EXIF orientations 5-8 require swapping width and height for correct display dimensions
const SWAP_ORIENTATIONS = new Set([5, 6, 7, 8])

const FORCE = process.argv.includes('--force')

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

// ── helpers ──────────────────────────────────────────────────────────────────

function scanDir(dir, base = '') {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...scanDir(path.join(dir, entry.name), rel))
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      results.push(rel)
    }
  }
  return results
}

async function runConcurrent(tasks, limit = CONCURRENCY) {
  const results = new Array(tasks.length)
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

// ── main ─────────────────────────────────────────────────────────────────────

async function processImage(relPath, stt) {
  const srcPath = path.join(IMAGES_DIR, relPath)
  const thumbRelPath = relPath.replace(/\.[^.]+$/, '.webp')
  const thumbAbsPath = path.join(THUMB_DIR, thumbRelPath)

  // Ensure thumb directory exists
  fs.mkdirSync(path.dirname(thumbAbsPath), { recursive: true })

  let meta
  try {
    meta = await sharp(srcPath).metadata()
  } catch (e) {
    console.error(`  ✗ metadata error: ${relPath}`, e.message)
    return null
  }

  // Compute DISPLAY dimensions after EXIF auto-rotation
  const shouldSwap = SWAP_ORIENTATIONS.has(meta.orientation)
  const displayWidth  = shouldSwap ? meta.height : meta.width
  const displayHeight = shouldSwap ? meta.width  : meta.height

  // Generate thumbnail if missing or forced (.rotate() applies EXIF orientation)
  if (FORCE || !fs.existsSync(thumbAbsPath)) {
    try {
      await sharp(srcPath)
        .rotate()                           // apply EXIF rotation so thumbnail is upright
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumbAbsPath)
    } catch (e) {
      console.error(`  ✗ thumb error: ${relPath}`, e.message)
      return null
    }
  }

  // Generate tiny LQIP placeholder (inline base64)
  let placeholder = ''
  try {
    const buf = await sharp(srcPath)
      .rotate()
      .resize(PLACEHOLDER_SIZE, PLACEHOLDER_SIZE, { fit: 'inside' })
      .jpeg({ quality: 40 })
      .toBuffer()
    placeholder = `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    placeholder = ''
  }

  // Parse folder structure: warehouse / album / filename
  const parts = relPath.split('/')
  const filename = parts[parts.length - 1]
  const warehouse = parts[0] || 'root'
  const album = parts.length > 2 ? parts.slice(1, -1).join('/') : ''
  const id = path.basename(filename, path.extname(filename))

  return {
    stt,
    id,
    filename,
    warehouse,
    album,
    path: `images/${relPath}`,
    thumbPath: `thumbnails/${thumbRelPath}`,
    placeholder,
    width: displayWidth || 0,
    height: displayHeight || 0,
  }
}

async function main() {
  console.log('🔍 Scanning images/...')
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error('❌ images/ folder not found.')
    process.exit(1)
  }

  const relPaths = scanDir(IMAGES_DIR)
  console.log(`   Found ${relPaths.length} images`)

  console.log(`📐 Generating thumbnails (${FORCE ? 'force' : 'skip existing'})...`)
  let done = 0

  const tasks = relPaths.map((rel, i) => async () => {
    const result = await processImage(rel, i + 1)
    done++
    if (done % 50 === 0 || done === relPaths.length) {
      process.stdout.write(`\r   ${done}/${relPaths.length}`)
    }
    return result
  })

  const images = (await runConcurrent(tasks)).filter(Boolean)
  console.log(`\n✅ Processed ${images.length} images`)

  // Build warehouses list
  const warehouses = [...new Set(images.map(img => img.warehouse))].sort()

  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    total: images.length,
    warehouses,
    images,
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8')
  console.log(`📄 manifest.json written (${(JSON.stringify(manifest).length / 1024).toFixed(1)} KB)`)
  console.log('🎉 Done! Run: npm run dev')
}

main().catch(err => { console.error(err); process.exit(1) })

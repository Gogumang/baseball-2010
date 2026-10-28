// 스프라이트 PNG 를 다시 쓴 뒤 **브라우저가 푼 RGBA 가 원본과 바이트 단위로 같은지** 본다 (r311 A4 — `tools/repack_sprite_png.py`).
//
//   node e2e/png-rgba.mjs                     # 기준 판(PNG_RGBA_BASE, 기본 afd0770e = 다시 쓰기 앞)과 다른 PNG 전부 × chromium · webkit
//   PNG_RGBA_BASE=HEAD node e2e/png-rgba.mjs   # 마지막 커밋과 비교 (자산을 다시 뽑은 뒤)
//   PNG_RGBA_ONLY=webkit node e2e/png-rgba.mjs
//
// 서버가 필요 없다. 두 판의 파일 바이트를 data URL 로 넘겨 `Image` → `drawImage` → `getImageData` 를 두 번 하고 견준다.
// 크기 · 바이트가 하나라도 다르면 그 파일을 찍고 끝 코드 1.
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, webkit } from 'playwright'
import { chromiumExecutable } from './lib/browsers.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const BASE = process.env.PNG_RGBA_BASE ?? 'afd0770e'
const ONLY = process.env.PNG_RGBA_ONLY
const BATCH = 150

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=M', BASE, '--', 'public/sprites'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((path) => path.endsWith('.png'))

/** 기준 판의 파일 바이트 — `git cat-file --batch` 하나로 모두 */
async function baseBlobs(paths) {
  const child = spawn('git', ['cat-file', '--batch'], { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] })
  const parts = []
  child.stdout.on('data', (chunk) => parts.push(chunk))
  const done = new Promise((resolve) => child.on('close', resolve))
  child.stdin.end(paths.map((path) => `${BASE}:${path}\n`).join(''))
  await done
  const all = Buffer.concat(parts)
  const blobs = []
  let at = 0
  for (const path of paths) {
    const lineEnd = all.indexOf(10, at)
    const header = all.toString('utf8', at, lineEnd).split(' ')
    if (header[1] !== 'blob') throw new Error(`기준 판에 없다: ${path} (${header.join(' ')})`)
    const size = Number(header[2])
    blobs.push(all.subarray(lineEnd + 1, lineEnd + 1 + size))
    at = lineEnd + 1 + size + 1
  }
  return blobs
}

/** 쪽 안 — 두 data URL 을 풀어 RGBA 를 견준다. 다른 것의 번호와 까닭 */
const COMPARE = async (pairs) => {
  const rgba = async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data }
  }
  const wrong = []
  for (const [index, before, after] of pairs) {
    try {
      const a = await rgba(before)
      const b = await rgba(after)
      if (a.width !== b.width || a.height !== b.height) {
        wrong.push([index, `크기 ${a.width}×${a.height} ↔ ${b.width}×${b.height}`])
        continue
      }
      let diff = 0
      for (let at = 0; at < a.data.length; at += 1) if (a.data[at] !== b.data[at]) diff += 1
      if (diff > 0) wrong.push([index, `다른 바이트 ${diff}`])
    } catch (error) {
      wrong.push([index, `풀기 실패 ${String(error)}`])
    }
  }
  return wrong
}

const blobs = await baseBlobs(changed)
const dataUrl = (bytes) => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
console.log(`기준 ${BASE} 와 다른 PNG ${changed.length}장`)
let failed = 0
for (const [name, type] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  if (ONLY !== undefined && ONLY !== name) continue
  const executablePath = name === 'chromium' ? chromiumExecutable() : undefined
  const browser = await type.launch({ headless: true, ...(executablePath === undefined ? {} : { executablePath }) })
  const page = await browser.newPage()
  await page.setContent('<!doctype html><title>png</title>')
  const started = Date.now()
  const wrong = []
  for (let from = 0; from < changed.length; from += BATCH) {
    const pairs = []
    for (let index = from; index < Math.min(changed.length, from + BATCH); index += 1) {
      pairs.push([index, dataUrl(blobs[index]), dataUrl(readFileSync(`${ROOT}${changed[index]}`))])
    }
    wrong.push(...(await page.evaluate(COMPARE, pairs)))
  }
  await browser.close()
  for (const [index, why] of wrong) console.log(`  다름 ${name} ${changed[index]}: ${why}`)
  console.log(`${name}: ${changed.length - wrong.length}/${changed.length} 같음 · ${((Date.now() - started) / 1000).toFixed(1)}초`)
  failed += wrong.length
}
process.exit(failed === 0 ? 0 : 1)

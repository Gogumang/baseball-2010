// 지금 쪽의 저장(localStorage)을 픽스처 파일로 — `scene.mjs` 가 다시 내보낸다(`import { dumpFixture } from './lib/scene.mjs'`).
import { writeFileSync } from 'node:fs'

/**
 * 지금 쪽의 저장(localStorage `compus-baseball/` 칸)을 픽스처 파일로 뜬다 — `e2e/fixtures/<이름>.json`.
 * 값은 저장 모듈이 `JSON.stringify` 로 쓴 것이라 풀어 둔다(JSON 이 아닌 글은 `{ "$raw": 글 }`).
 */
export async function dumpFixture(page, path, { note = '', seed } = {}) {
  const raw = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.startsWith('compus-baseball/'))
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  )
  const storage = {}
  for (const [key, value] of Object.entries(raw)) {
    try {
      storage[key] = JSON.parse(value)
    } catch {
      storage[key] = { $raw: value }
    }
  }
  writeFileSync(path, `${JSON.stringify({ note, ...(seed === undefined ? {} : { seed }), localStorage: storage }, null, 2)}\n`)
  return Object.keys(storage)
}

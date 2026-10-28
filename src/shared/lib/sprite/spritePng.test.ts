import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `public/sprites` PNG 꼴 지킴 (r311 A4 팔레트 다시 쓰기 — `tools/repack_sprite_png.py`).
 * 색 관리 덩이(gAMA · iCCP · sRGB · cHRM)나 다른 덩이가 붙으면 브라우저가 색을 바꿀 수 있다 — 픽셀이 원본과 달라진다.
 * 원본과 RGBA 가 같은지는 브라우저에서 `e2e/png-rgba.mjs` 로 본다.
 */
const ROOT = 'public/sprites'
const ALLOWED = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'])

function pngFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return pngFiles(path)
    return name.endsWith('.png') ? [path] : []
  })
}

describe('스프라이트 PNG 꼴', () => {
  it('덩이는 IHDR · PLTE · tRNS · IDAT · IEND 뿐 · 8비트 RGBA 또는 팔레트(tRNS) · 비비월', () => {
    const files = pngFiles(ROOT)
    expect(files.length).toBeGreaterThan(9000)
    const wrong: string[] = []
    for (const file of files) {
      const bytes = readFileSync(file)
      let at = 8
      const types: string[] = []
      while (at < bytes.length) {
        const length = bytes.readUInt32BE(at)
        types.push(bytes.toString('latin1', at + 4, at + 8))
        at += 12 + length
      }
      const depth = bytes[24]
      const colorType = bytes[25]
      const interlace = bytes[28]
      const isRgba = colorType === 6 && depth === 8
      const isPalette = colorType === 3 && [1, 2, 4, 8].includes(depth) && types.includes('PLTE')
      if (!types.every((type) => ALLOWED.has(type)) || !(isRgba || isPalette) || interlace !== 0)
        wrong.push(`${file} ${types.join(',')} ${colorType}/${depth}`)
    }
    expect(wrong).toEqual([])
  })
})

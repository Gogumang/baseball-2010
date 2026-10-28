import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FRAME_COPY_FOLDERS, flippedFrameUrlOf, frameCopyUrlsOf, hasFrameCopies } from '@/shared/lib/sprite/frameCopies'

const pngSize = (path: string) => {
  const file = readFileSync(path)
  return [file.readUInt32BE(16), file.readUInt32BE(20)]
}

describe('0x11 뒤집기 복사판 (copy.json)', () => {
  it('목록을 청하는 폴더 = copy.json 을 둔 폴더', () => {
    const withCopies = readdirSync('public/sprites').filter((name) => existsSync(`public/sprites/${name}/frames/copy.json`))
    expect(new Set(withCopies)).toEqual(FRAME_COPY_FOLDERS)
    expect(hasFrameCopies('./sprites/player_effect/frames')).toBe(true)
    expect(hasFrameCopies('./sprites/pitcher/frames')).toBe(false)
  })

  it('복사판은 구운 프레임과 크기가 같다(파트가 같아 상자도 같다)', () => {
    for (const name of FRAME_COPY_FOLDERS) {
      const listed = JSON.parse(readFileSync(`public/sprites/${name}/frames/copy.json`, 'utf8')) as number[]
      expect(listed.length).toBeGreaterThan(0)
      for (const frame of listed) {
        const key = String(frame).padStart(3, '0')
        expect(pngSize(`public/sprites/${name}/frames/copy/${key}.png`)).toEqual(pngSize(`public/sprites/${name}/frames/${key}.png`))
      }
    }
  })

  it('투구 바람 칸 40 · 41 — 뒤집을 때만 복사판, 목록이 아직이면 구운 프레임', () => {
    const folder = './sprites/player_effect/frames'
    expect(flippedFrameUrlOf(folder, 40, [40, 41])).toBe(`${folder}/copy/040.png`)
    expect(flippedFrameUrlOf(folder, 39, [40, 41])).toBe(`${folder}/039.png`)
    expect(flippedFrameUrlOf(folder, 40, null)).toBe(`${folder}/040.png`)
    expect(frameCopyUrlsOf(folder, [40, 41], [37, 40, 41, 41])).toEqual([`${folder}/copy/040.png`, `${folder}/copy/041.png`])
  })
})

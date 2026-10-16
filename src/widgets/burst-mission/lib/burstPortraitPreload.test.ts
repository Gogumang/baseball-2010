import { describe, expect, it } from 'vitest'
import { burstPortraitPreloads } from '@/widgets/burst-mission/lib/burstPortraitPreload'

describe('돌발미션 초상 미리 받기', () => {
  it('세 돌발 표 대사의 화자 · 표정 애니를 폴더마다 모은다 — 화자 5 · 표정 2 = event_char_0 애니 39(칸 104~106)', () => {
    const preloads = burstPortraitPreloads()
    expect(preloads.map((preload) => preload.folder)).toEqual([
      './sprites/event_char_0/frames',
      './sprites/event_char_1/frames',
      './sprites/event_char_2/frames',
    ])
    const main = preloads[0]
    expect(main.animations).toContain(39)
    expect(main.json).toEqual(['animations.json', 'origins.json'])
    // 화자 2 (애니 바탕 16) 표정 0 · 1 · 3 · 4 · 6 — 화자 1 · 8 · 9 는 돌발 대사에 없다
    expect(main.animations).toEqual(expect.arrayContaining([16, 17, 19, 20, 22]))
  })
})

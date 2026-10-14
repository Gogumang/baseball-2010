import { describe, expect, it } from 'vitest'
import { SEASON_OUTING_PRESENTATIONS, nariOutingPresentationOf } from '@/pages/season/lib/seasonOutingPopup'

describe('외출 연출 0x85074 — 시즌이 아닌 갈래(나만의리그 126)', () => {
  it('장소 p → event_ani 애니 [1,0,2,4,3] · event_char_1 k + 0x1e · event_char_0 k + 0x5d (점프표 0xd4a90)', () => {
    expect([0, 1, 2, 3, 4].map((place) => nariOutingPresentationOf(place, { isSlugger: false }))).toEqual(
      [1, 0, 2, 4, 3].map((k) => ({
        folder: './sprites/event_ani/frames',
        animation: k,
        overlays: { char1: k + 0x1e, char0: k + 0x5d },
      })),
    )
  })

  it('타자편 장타형(0x1fc21 +0xb >> 5 == 1)이면 event_char_0 은 k + 0x63 (8515e~8517e)', () => {
    expect(nariOutingPresentationOf(3, { isSlugger: true }).overlays).toEqual({ char1: 4 + 0x1e, char0: 4 + 0x63 })
  })

  it('장소 0 만 시즌과 갈린다 — 시즌은 team_traning_ani 애니 5 · 덧애니 없음', () => {
    expect(SEASON_OUTING_PRESENTATIONS[0].overlays).toBeNull()
    expect(nariOutingPresentationOf(0, { isSlugger: false }).overlays).not.toBeNull()
    for (const place of [1, 2, 3, 4]) {
      expect(nariOutingPresentationOf(place, { isSlugger: false })).toEqual(SEASON_OUTING_PRESENTATIONS[place])
    }
  })
})

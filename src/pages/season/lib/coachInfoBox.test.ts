import { describe, expect, it } from 'vitest'
import { COACH_INFO_BOX, coachInfoBoxPaintsOf, coachInfoTextOf } from '@/pages/season/lib/coachInfoBox'

/** 0xaa6c~0xad78 (r263 직접 뜸) — 칠 칸은 R (106, 64) 왼쪽 위 기준 */
describe('코치채용 정보 상자', () => {
  const 칠 = coachInfoBoxPaintsOf()
  const 칸 = (x: number, y: number) => [...칠].reverse().find((p) => x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height)?.color

  it('R = (106, 64, 128, 75) · R2 = (109, 67, 123, 70) — W/2 − 14 · H/2 − 0x60', () => {
    expect(COACH_INFO_BOX.box).toEqual({ x: 106, y: 64, width: 128, height: 75 })
    expect(COACH_INFO_BOX.inner).toEqual({ x: 109, y: 67, width: 123, height: 70 })
  })

  it('둥근 칠은 네 모서리 점을 비우고, 안쪽은 #041D53', () => {
    expect(칸(0, 0)).toBeUndefined()
    expect(칸(128, 75)).toBeUndefined()
    expect(칸(1, 0)).toBe('#395DCE')
    expect(칸(3, 3)).toBe('#041D53')
  })

  it('오른쪽 아래가 비스듬히 깎인다 — 밑줄 (109..176, 137) · 대각 점 · 그 오른쪽 #395DCE · 윗줄 (182..231, 131)', () => {
    const at = (x: number, y: number) => 칸(x - 106, y - 64)
    expect(at(109, 137)).toBe('#4A7DF7')
    expect(at(176, 137)).toBe('#4A7DF7')
    expect(at(177, 137)).toBe('#395DCE')
    expect(at(181, 132)).toBe('#4A7DF7')
    expect(at(232, 132)).toBe('#395DCE')
    expect(at(182, 131)).toBe('#4A7DF7')
    expect(at(231, 131)).toBe('#4A7DF7')
    expect(at(180, 131)).toBe('#041D53')
  })

  it('글 = [149 + 칸] "!N!cFFFFFF" [159] "!N" [160]', () => {
    expect(coachInfoTextOf(9)).toBe('!cFFFF00팀 타자 히트/파워 +7!N!cFFFFFF계약금 : 3억5000!N필요 인기도 : 1000')
  })
})

import { describe, expect, it } from 'vitest'
import { nariMainMenuOffIdsOf } from '@/pages/management/lib/nariMenuEnable'

describe('나리 관리 메뉴 켬 표 — 105 진입 0x11910', () => {
  it('행동했으면 트레이닝 · 휴식 · 외출을 끈다', () => {
    expect([...nariMainMenuOffIdsOf({ hasActedThisCycle: true, season: 3, gamesPlayed: 20 })]).toEqual(['트레이닝', '휴식', '외출'])
  })

  it('첫 해(S+0xb3 == 0) 경기 수 ≤ 9 면 외출만 꺼진다 — 10 경기부터 켜진다', () => {
    expect([...nariMainMenuOffIdsOf({ hasActedThisCycle: false, season: 1, gamesPlayed: 9 })]).toEqual(['외출'])
    expect([...nariMainMenuOffIdsOf({ hasActedThisCycle: false, season: 1, gamesPlayed: 10 })]).toEqual([])
    expect([...nariMainMenuOffIdsOf({ hasActedThisCycle: false, season: 2, gamesPlayed: 0 })]).toEqual([])
  })
})

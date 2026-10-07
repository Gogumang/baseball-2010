import { describe, expect, it } from 'vitest'
import {
  createPitcherCupTeams,
  pitcherCupPositionCodeOf,
  preparePitcherCupMatch,
} from '@/entities/pitcher-career/model/pitcherCupTeams'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'

const 나 = -1

describe('투수편 국가대항전 대회 레코드 — 133 의 0xb521d · 142 의 모드 3 갈래', () => {
  it('내 칸 k 에 내 투수, 옛 k 번은 맨 끝 (0xb521c 0x80 갈래)', () => {
    expect(createPitcherCupTeams(7, 11).korea.pitchers).toEqual([0, 1, 2, 3, 4, 5, 6, 나, 7])
    expect(createPitcherCupTeams(2, 11).korea.pitchers).toEqual([0, 1, 나, 3, 4, 5, 6, 7, 2])
  })

  it('선발: 대회 첫날 0x1b684 로 내가 0번 · 그 뒤는 0xa4f60 −2(S+0x12c)라 그대로 — 상대국은 g ≠ 0 이면 돈다', () => {
    const 첫날 = preparePitcherCupMatch(createPitcherCupTeams(2, 11), 0, PITCHER_ROLE.starter)
    expect(첫날.korea.pitchers).toEqual([나, 1, 0, 3, 4, 5, 6, 7, 2])
    expect(pitcherCupPositionCodeOf(첫날)).toBe(0)
    const 둘째 = preparePitcherCupMatch(첫날, 1, PITCHER_ROLE.starter)
    expect(둘째.korea.pitchers).toEqual(첫날.korea.pitchers)
    expect(둘째.opponent.pitchers).toEqual([1, 2, 3, 0, 4, 5, 6, 7])
  })

  it('구원: 첫날 그대로 · 그 뒤 0~3 을 돌린다(−1)', () => {
    const 첫날 = preparePitcherCupMatch(createPitcherCupTeams(7, 11), 0, PITCHER_ROLE.relief)
    expect(첫날.korea.pitchers).toEqual([0, 1, 2, 3, 4, 5, 6, 나, 7])
    expect(preparePitcherCupMatch(첫날, 1, PITCHER_ROLE.relief).korea.pitchers).toEqual([1, 2, 3, 0, 4, 5, 6, 나, 7])
  })
})

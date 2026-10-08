import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_OUTING_ACTIVITIES, SEASON_OUTING_COSTS, SEASON_OUTING_EFFECTS, SEASON_OUTING_PLACES,
  SEASON_OUTING_REQUIRED_POPULARITY, checkSeasonOuting, rollSeasonOuting,
} from '@/widgets/season/lib/seasonOuting'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 시즌 외출 5종 — P4 3절(가드 0xbd38 · 효과 0xc81c) 확정값을 못박는다.
 * 나만의리그 외출(`shared/config/outingPlaces.ts`)과 섞이면 안 되는 표라 값까지 적어 둔다.
 */

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

describe('시즌 외출 표 (P4 3절)', () => {
  it('장소 다섯 곳과 StrMODE[54+p] 기능 이름이 차례대로다', () => {
    expect(SEASON_OUTING_PLACES).toEqual(['경기장', '번화가', '병원', '학교', '방송국'])
    expect(SEASON_OUTING_ACTIVITIES).toEqual(['친선경기', '회식', '입원', '야구교실', '구단CF'])
  })

  it('비용은 100만 단위로 p1 4 · p2 5 · p4 10 뿐이다', () => {
    expect(SEASON_OUTING_COSTS).toEqual([0, 4, 5, 0, 10])
  })

  it('인기도 조건은 친선경기 200 · 구단CF 400 두 곳뿐이다', () => {
    expect(SEASON_OUTING_REQUIRED_POPULARITY).toEqual([200, 0, 0, 0, 400])
  })

  it('친선경기·야구교실만 사기 난수의 부호를 뒤집는다 (0xc8b0)', () => {
    expect(SEASON_OUTING_EFFECTS.map((effect) => effect.negatesMorale)).toEqual([
      true, false, false, true, false,
    ])
  })

  it('효과표의 난수 구간이 [a, b) 로 들어 있다', () => {
    // 친선경기 사기 −(14~18) · 소지금 +(8~10)
    expect(SEASON_OUTING_EFFECTS[0].moraleRange).toEqual([14, 19])
    expect(SEASON_OUTING_EFFECTS[0].moneyRange).toEqual([8, 11])
    // 회식 사기 +25~30 · 소지금 −4
    expect(SEASON_OUTING_EFFECTS[1].moraleRange).toEqual([25, 31])
    expect(SEASON_OUTING_EFFECTS[1].money).toBe(-4)
    // 야구교실 인기도 +1~3 · 평판 +3~5
    expect(SEASON_OUTING_EFFECTS[3].popularityRange).toEqual([1, 4])
    expect(SEASON_OUTING_EFFECTS[3].reputationRange).toEqual([3, 6])
    // 구단CF 사기 +2 (rand(2,3)) · 인기도 +4~6
    expect(SEASON_OUTING_EFFECTS[4].moraleRange).toEqual([2, 3])
    expect(SEASON_OUTING_EFFECTS[4].popularityRange).toEqual([4, 7])
  })
})

describe('시즌 외출 가드 0xbd38', () => {
  it('친선경기는 인기도 200 미만이면 StrMODE[62] 로 막힌다', () => {
    expect(checkSeasonOuting(레코드({ popularity: 199 }), 50, 0)).toEqual({
      ok: false, reason: '인기도부족', required: 200, cost: 0,
    })
    expect(checkSeasonOuting(레코드({ popularity: 200 }), 50, 0).ok).toBe(true)
  })

  it('구단CF는 인기도 400 이 필요하고 소지금 1000만을 쓴다', () => {
    expect(checkSeasonOuting(레코드({ popularity: 399, money: 50 }), 50, 4).reason).toBe('인기도부족')
    expect(checkSeasonOuting(레코드({ popularity: 400, money: 9 }), 50, 4).reason).toBe('소지금부족')
    expect(checkSeasonOuting(레코드({ popularity: 400, money: 10 }), 50, 4).ok).toBe(true)
  })

  it('입원은 건강하면 StrMODE[196] 로 막힌다', () => {
    expect(checkSeasonOuting(레코드({ illness: 0 }), 50, 2).reason).toBe('질병없음')
    expect(checkSeasonOuting(레코드({ illness: 1 }), 50, 2).ok).toBe(true)
  })

  it('회식은 사기가 100 이면 StrMODE[91] 로 막힌다', () => {
    expect(checkSeasonOuting(레코드(), 100, 1).reason).toBe('사기최고')
    expect(checkSeasonOuting(레코드(), 99, 1).ok).toBe(true)
  })

  it('가드 차례는 인기도 → 소지금 → 질병 → 사기다', () => {
    // 인기도도 소지금도 모자란 구단CF → 인기도가 먼저 걸린다
    expect(checkSeasonOuting(레코드({ popularity: 0, money: 0 }), 50, 4).reason).toBe('인기도부족')
    // 건강하고 소지금도 모자란 입원 → 소지금이 먼저 걸린다
    expect(checkSeasonOuting(레코드({ money: 4, illness: 0 }), 50, 2).reason).toBe('소지금부족')
    // 소지금이 모자라고 사기가 최고인 회식 → 소지금이 먼저 걸린다
    expect(checkSeasonOuting(레코드({ money: 3 }), 100, 1).reason).toBe('소지금부족')
  })

  it('⚠️ 원본 버그 — 소지금 검사가 서브 아이템(입원 무료)을 보지 않는다', () => {
    // StrITEM[222] "병원 [입원] 시 소지금 감소없음" 을 가졌어도 소지금 500만이 없으면 막힌다.
    // 가드는 서브 아이템 칸(SR+0x5f)을 아예 읽지 않는다 — 나리 보험증서 버그(G 3-2)와 같은 모양이다.
    expect(checkSeasonOuting(레코드({ money: 4, illness: 2 }), 50, 2).reason).toBe('소지금부족')
  })

  it('시즌 팀에는 부상 개념이 없어 부상 검사가 없다', () => {
    // 나리 외출에는 부상 가드가 있지만 시즌 가드 0xbd38 에는 없다 — 네 가지뿐이다.
    const 통과 = checkSeasonOuting(레코드({ illness: 3, money: 50, popularity: 999 }), 50, 3)
    expect(통과).toEqual({ ok: true, cost: 0 })
  })
})

/** 굴림을 차례로 돌려주고 받은 구간을 적어 두는 난수 */
const 차례난수 = (값들: readonly number[]) => {
  const 굴림: [number, number][] = []
  let i = 0
  const random: RandomPort = {
    rand: (lo, hi) => {
      굴림.push([lo, hi])
      return 값들[i++] ?? lo
    },
    rand9d: () => 0,
  }
  return { random, 굴림 }
}

const 서브아이템 = (place: number) => [0, 1, 2, 3, 4].map((p) => p === place)

describe('외출 결과 0xc81c — 서브 아이템 보정 (점프표 0xcbe6c)', () => {
  it('친선경기: 사기 굴림 → 소지금 굴림, 서브 아이템이면 소지금 +5 (사기 −m 은 그대로)', () => {
    const { random, 굴림 } = 차례난수([15, 9])
    const 결과 = rollSeasonOuting(레코드({ money: 10, outingSubItems: 서브아이템(0) }), 50, 0, random)!
    expect(굴림).toEqual([[14, 19], [8, 11]])
    expect(결과.record.money).toBe(10 + 9 + 5)
    expect(결과.teamMorale).toBe(50 - 15)
  })

  it('회식: 서브 아이템이면 사기 +4 를 더한다', () => {
    const { random } = 차례난수([27])
    const 결과 = rollSeasonOuting(레코드({ money: 10, outingSubItems: 서브아이템(1) }), 50, 1, random)!
    expect(결과.teamMorale).toBe(50 + 27 + 4)
    expect(결과.record.money).toBe(10 - 4)
  })

  it('입원: 서브 아이템이면 소지금 +5(비용 상쇄) · 사기 +1, 그 뒤 치료를 굴린다', () => {
    const { random, 굴림 } = 차례난수([4, 0])
    const 결과 = rollSeasonOuting(레코드({ money: 10, illness: 2, illnessSlack: 3, outingSubItems: 서브아이템(2) }), 50, 2, random)!
    expect(굴림).toEqual([[3, 6], [0, 101]])
    expect(결과.record.money).toBe(10)
    expect(결과.teamMorale).toBe(50 + 4 + 1)
    expect(결과.record.illness).toBe(0)
  })

  it('야구교실: 보정 인기도 +1 · 평판 +1 은 뒤집지 않고, 사기는 −m', () => {
    const { random, 굴림 } = 차례난수([9, 2, 4])
    const 결과 = rollSeasonOuting(레코드({ popularity: 100, reputation: 100, outingSubItems: 서브아이템(3) }), 50, 3, random)!
    expect(굴림).toEqual([[8, 11], [1, 4], [3, 6]])
    expect(결과.record.popularity).toBe(100 + 2 + 1)
    expect(결과.record.reputation).toBe(100 + 4 + 1)
    expect(결과.teamMorale).toBe(50 - 9)
  })

  it('구단CF: 서브 아이템이면 인기도 +2', () => {
    const { random } = 차례난수([2, 5])
    const 결과 = rollSeasonOuting(레코드({ popularity: 500, money: 20, outingSubItems: 서브아이템(4) }), 50, 4, random)!
    expect(결과.record.popularity).toBe(500 + 5 + 2)
    expect(결과.record.money).toBe(20 - 10)
  })

  it('다른 장소의 서브 아이템은 보지 않는다 (SR+0x5d+p 한 칸만)', () => {
    const { random } = 차례난수([27])
    const 결과 = rollSeasonOuting(레코드({ money: 10, outingSubItems: 서브아이템(0) }), 50, 1, random)!
    expect(결과.teamMorale).toBe(50 + 27)
  })
})

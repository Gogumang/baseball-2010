import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  ATTENDANCE_BASE,
  ATTENDANCE_FLOOR,
  MY_RANK_BONUS,
  OPPONENT_RANK_BONUS,
  STORE_INCOME_BONUS,
  attendanceOf,
  lastGameBonusOf,
  settleGameIncome,
} from '@/entities/season-mode/model/seasonAttendance'

const 기본 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스트구단').record,
  ...덮어쓰기,
})

describe('직전 경기 인기도 평가 → 관중 보정 (J 4-7, ⚠️ "연승" 이 아니다)', () => {
  it('구간표 그대로다', () => {
    expect(lastGameBonusOf(-8)).toBe(-150)
    expect(lastGameBonusOf(-7)).toBe(-150)
    expect(lastGameBonusOf(-6)).toBe(-100)
    expect(lastGameBonusOf(-4)).toBe(-100)
    expect(lastGameBonusOf(-3)).toBe(-50)
    expect(lastGameBonusOf(-2)).toBe(-50)
    expect(lastGameBonusOf(-1)).toBe(0)
    expect(lastGameBonusOf(3)).toBe(0)
    expect(lastGameBonusOf(4)).toBe(50)
    expect(lastGameBonusOf(6)).toBe(100)
    expect(lastGameBonusOf(8)).toBe(150)
    expect(lastGameBonusOf(10)).toBe(200)
    expect(lastGameBonusOf(12)).toBe(200)
  })
})

describe('관중 수 0xa34b8', () => {
  it('J 4-7 의 예제와 같다 — 평판 300 · 10경기 이후 · 1위 vs 5위 → 18160명, 수입 13', () => {
    const record = 기본({ reputation: 300, games: 10, stadiumEquipped: [0, 0, 0] })
    const 결과 = attendanceOf(record, { myRank: 0, opponentRank: 4 })
    // p = 300 + 0 + 120 + 20 + 150 = 590 → 118 × 120 = 14160 + 0 + 4000 = 18160 (관중석 0 = 2만 상한)
    expect(결과.attendance).toBe(18_160)
    expect(결과.income).toBe(13)
  })

  it('경기 수가 9 이하면 순위 대신 +100 을 쓴다', () => {
    const 초반 = attendanceOf(기본({ reputation: 300, games: 9 }), { myRank: 9, opponentRank: 9 })
    const 이후 = attendanceOf(기본({ reputation: 300, games: 10 }), { myRank: 9, opponentRank: 9 })
    // 초반 p = 300 + 100 + 150 = 550 · 이후 p = 300 − 40 − 30 + 150 = 380
    expect(초반.attendance).toBe(Math.trunc(550 / 5) * 120 + 4_000)
    expect(이후.attendance).toBe(Math.trunc(380 / 5) * 120 + 4_000)
  })

  it('전광판은 가산, 관중석은 상한이다', () => {
    const 가산 = attendanceOf(기본({ reputation: 300, games: 10, stadiumEquipped: [3, 4, 0] }), {
      myRank: 0,
      opponentRank: 4,
    })
    // 전광판 4 = +5000 → 18160 + 5000 = 23160, 관중석 3 = 35000 상한이라 그대로
    expect(가산.attendance).toBe(23_160)
    const 상한 = attendanceOf(기본({ reputation: 9_999, games: 10, stadiumEquipped: [0, 0, 0] }), {
      myRank: 0,
      opponentRank: 0,
    })
    expect(상한.attendance).toBe(20_000)
  })

  it('평판이 아무리 낮아도 기본 4000명은 들어온다 — 하한 3000 은 사실상 닿지 않는다', () => {
    const 결과 = attendanceOf(기본({ reputation: 0, games: 10, lastPopularityChange: -8 }), {
      myRank: 9,
      opponentRank: 9,
    })
    // p = 0 − 150 − 70 + 150 = −70 → max(p,1)/5 = 0 → 0 + 0 + 4000
    expect(결과.attendance).toBe(ATTENDANCE_BASE)
    // 관중석 상한이 가장 작아도 2만이라 3000 하한에는 원본에서도 걸릴 일이 없다
    expect(결과.attendance).toBeGreaterThan(ATTENDANCE_FLOOR)
  })

  it('순위 보너스 표는 0xd7db8 그대로다', () => {
    expect(MY_RANK_BONUS).toEqual([120, 100, 80, 60, 40, 0, -10, -20, -30, -40])
    expect(OPPONENT_RANK_BONUS).toEqual([100, 80, 60, 40, 20, 0, 0, -10, -20, -30])
  })

  it('만원 판정은 수용의 80% / 35% 로 갈린다', () => {
    // 관중석 0 = 20000 수용. 18160 ≥ 16000 → 2
    expect(attendanceOf(기본({ reputation: 300, games: 10 }), { myRank: 0, opponentRank: 4 }).crowdLevel).toBe(2)
    // 하한 3000 은 35%(7000) 아래 → 0
    expect(
      attendanceOf(기본({ reputation: 0, games: 10, lastPopularityChange: -8 }), { myRank: 9, opponentRank: 9 })
        .crowdLevel,
    ).toBe(0)
  })
})

describe('수입 정산 — 관중 1명당 7500원 (100만 단위)', () => {
  it('소지금에 더하고 직전 관중·수입을 남긴다', () => {
    const 결과 = settleGameIncome(기본({ reputation: 300, games: 10, money: 100 }), {
      myRank: 0,
      opponentRank: 4,
    })
    expect(결과.income).toBe(13)
    expect(결과.record.money).toBe(113)
    expect(결과.record.lastAttendance).toBe(18_160)
    expect(결과.record.lastIncome).toBe(13)
  })

  it('구내매점이 남아 있으면 +2 이고 경기마다 한 칸 준다', () => {
    const record = 기본({ reputation: 300, games: 10, storeGames: 2 })
    const 첫판 = settleGameIncome(record, { myRank: 0, opponentRank: 4 })
    expect(첫판.income).toBe(13 + STORE_INCOME_BONUS)
    expect(첫판.record.storeGames).toBe(1)
    expect(첫판.storeExpired).toBe(false)

    const 둘째판 = settleGameIncome(첫판.record, { myRank: 0, opponentRank: 4 })
    // 이 경기까지는 매점이 살아 있고(+2), 끝나면서 0 이 되어 만료 안내가 붙는다
    expect(둘째판.income).toBe(13 + STORE_INCOME_BONUS)
    expect(둘째판.record.storeGames).toBe(0)
    expect(둘째판.storeExpired).toBe(true)

    const 셋째판 = settleGameIncome(둘째판.record, { myRank: 0, opponentRank: 4 })
    expect(셋째판.income).toBe(13)
    expect(셋째판.storeExpired).toBe(false)
  })
})

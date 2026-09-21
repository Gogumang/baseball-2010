import { describe, expect, it } from 'vitest'
import { NO_COACH, startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  COACH_CONTRACT_TABLE, COACH_COUNT, COACH_REQUIRED_POPULARITY, checkCoachHire, coachEffectTextOf,
  coachFeeOf, coachNameOf, coachRequiredPopularityOf, hasCoach, hireCoach,
} from '@/entities/season-mode/model/seasonCoach'

/**
 * 코치채용 (화면 0xaa24 · 채용 0xa248) — `docs/re/J-modes-rules.md` 4-2·4-3 확정.
 */

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스터').record,
  ...덮어쓰기,
})

describe('계약금·필요 인기도 표 (0xcbc24 · 0xcbc10)', () => {
  it('계약금은 1억·1.5억·2억·2.5억·3.5억 두 줄이다 (표값 ×10 = 100만 단위)', () => {
    expect(COACH_CONTRACT_TABLE).toEqual([10, 15, 20, 25, 35, 10, 15, 20, 25, 35])
    expect(coachFeeOf(0)).toBe(100)
    expect(coachFeeOf(4)).toBe(350)
    // 마타자 줄(5~9)도 같은 값이다
    expect(coachFeeOf(5)).toBe(100)
    expect(coachFeeOf(9)).toBe(350)
  })

  it('필요 인기도는 0·100·300·500·1000 두 줄이다', () => {
    expect(COACH_REQUIRED_POPULARITY).toEqual([0, 100, 300, 500, 1000, 0, 100, 300, 500, 1000])
    expect(coachRequiredPopularityOf(3)).toBe(500)
  })

  it('없는 칸은 null 이다', () => {
    expect(coachFeeOf(COACH_COUNT)).toBeNull()
    expect(coachRequiredPopularityOf(-1)).toBeNull()
  })
})

describe('코치 칸 ↔ 마선수 (0~4 마투수 · 5~9 마타자)', () => {
  it('칸 0~4 는 마투수, 5~9 는 마타자 이름이다', () => {
    expect(coachNameOf(0)).toBe('싸이커')
    expect(coachNameOf(4)).toBe('드래고나')
    expect(coachNameOf(5)).toBe('메디카')
    expect(coachNameOf(9)).toBe('킹타이거')
  })

  it('보너스 설명은 StrMODE[149]~[158] 이고 경기 쪽 표(0xd884c)와 값이 맞는다', () => {
    expect(coachEffectTextOf(0)).toBe('팀 투수 변화 +8')
    expect(coachEffectTextOf(9)).toBe('팀 타자 히트/파워 +7')
    // 경기 쪽 보너스 표 0xd884c 의 값이 문구에 그대로 적혀 있다
    const 보너스표 = [8, 9, 10, 6, 4, 8, 5, 10, 6, 7]
    보너스표.forEach((bonus, slot) => {
      expect(coachEffectTextOf(slot)).toContain(`+${bonus}`)
    })
  })
})

describe('가드 순서 (0xa79c~) — ① 이미 이 코치 ② 소지금 ③ 인기도', () => {
  it('이미 채용한 코치를 다시 고르면 StrMODE[147] 쪽이다', () => {
    const result = checkCoachHire(레코드({ coach: 2, money: 9999, popularity: 9999 }), 9999, 2)
    expect(result).toEqual({ ok: false, reason: '이미채용' })
  })

  it('소지금이 인기도보다 **먼저** 걸린다 (둘 다 모자랄 때)', () => {
    const record = 레코드({ money: 0, popularity: 0 })
    expect(checkCoachHire(record, record.popularity, 4)).toEqual({
      ok: false, reason: '소지금부족', required: 350,
    })
  })

  it('소지금이 되면 인기도를 본다 — 필요한 값을 함께 준다 (StrMODE[62] "%d")', () => {
    const record = 레코드({ money: 9999, popularity: 99 })
    expect(checkCoachHire(record, record.popularity, 1)).toEqual({
      ok: false, reason: '인기도부족', required: 100,
    })
  })

  it('둘 다 되면 계약금을 붙여 통과한다', () => {
    const record = 레코드({ money: 9999, popularity: 9999 })
    expect(checkCoachHire(record, record.popularity, 3)).toEqual({ ok: true, fee: 250 })
  })
})

describe('채용 확정 (0xa248)', () => {
  it('소지금을 계약금만큼 깎고 SR+0x185 에 칸을 적는다', () => {
    const 채용 = hireCoach(레코드({ money: 400 }), 4)

    expect(채용.money).toBe(50)
    expect(채용.coach).toBe(4)
    expect(hasCoach(채용)).toBe(true)
  })

  it('⚠️ 코치를 바꾸면 계약금을 **새로 낸다** — 이전 코치 환불이 없다', () => {
    const 첫채용 = hireCoach(레코드({ money: 1000 }), 0) // −100
    const 갈아타기 = hireCoach(첫채용, 4) // −350

    expect(갈아타기.money).toBe(550)
    expect(갈아타기.coach).toBe(4)
  })

  it('새 시즌은 코치가 없다 (−1)', () => {
    expect(startNewSeason(0, '테스터').record.coach).toBe(NO_COACH)
    expect(hasCoach(레코드())).toBe(false)
  })
})

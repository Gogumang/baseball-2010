import { describe, expect, it } from 'vitest'
import {
  RECORD_CODE_TO_SLOT,
  SEASON_RECORD_CODE,
  clearSeasonGameRecord,
  hitTotalBonusOf,
  recordSeasonGameEvent,
  reputationGradeOf,
  seasonReputationChangeOf,
  seasonReputationScoreOf,
  sideOfRecordCode,
} from '@/entities/season-mode/model/seasonReputation'
import type { SeasonGameContext } from '@/entities/season-mode/model/seasonReputation'

const 빈칸 = () => clearSeasonGameRecord()
const 칸 = (배치: Readonly<Record<number, number>>): number[] => {
  const slots = 빈칸()
  for (const [index, value] of Object.entries(배치)) slots[Number(index)] = value
  return slots
}

/**
 * 0:0 **패배** 를 기준 맥락으로 쓴다. 원본식은 패배에 `s −= 2` 를 붙이므로
 * 아래 기대값들은 모두 **기본 −2 를 포함**한 값이다.
 */
const 기본맥락: SeasonGameContext = {
  opponentRuns: 0,
  myRuns: 0,
  won: false,
  completeGame: null,
}
/** 패배 기본 감점 (0xa6f7e) */
const 패배기본 = -2

describe('점프표 0xd7d7c — ⚠️ 코드 4·5 만 뒤집혀 있다 (원본 버그 그대로)', () => {
  it('4 와 5 를 뺀 나머지는 코드 번호가 곧 칸 번호다', () => {
    for (const code of [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
      expect(RECORD_CODE_TO_SLOT[code]).toBe(code)
    }
  })

  it('탈삼진(코드 4)이 S[5] 로, 병살(코드 5)이 S[4] 로 들어간다', () => {
    expect(RECORD_CODE_TO_SLOT[SEASON_RECORD_CODE.탈삼진]).toBe(5)
    expect(RECORD_CODE_TO_SLOT[SEASON_RECORD_CODE.병살]).toBe(4)
  })

  it('그래서 탈삼진은 평판을 올리고 병살은 깎는다 — 표 그대로가 실행값이다', () => {
    let 탈삼진칸 = 빈칸()
    let 병살칸 = 빈칸()
    for (let i = 0; i < 3; i += 1) {
      탈삼진칸 = recordSeasonGameEvent(탈삼진칸, SEASON_RECORD_CODE.탈삼진, '수비')
      병살칸 = recordSeasonGameEvent(병살칸, SEASON_RECORD_CODE.병살, '수비')
    }
    // 탈삼진 3개 → S[5] = 3 → + S[5]/3 = +1
    expect(seasonReputationScoreOf(탈삼진칸, 기본맥락)).toBe(패배기본 + 1)
    // 병살 3개 → S[4] = 3 → − 2×(S[4]/3) = −2
    expect(seasonReputationScoreOf(병살칸, 기본맥락)).toBe(패배기본 - 2)
    // 부호가 반대다 — 잡을수록 깎이고 삼진이 올려 준다
    expect(seasonReputationScoreOf(탈삼진칸, 기본맥락)).toBeGreaterThan(
      seasonReputationScoreOf(병살칸, 기본맥락),
    )
  })
})

describe('게이트 0xa755c — 코드 ≤5 는 내 수비, ≥6 은 내 공격일 때만 센다', () => {
  it('코드로 쪽이 갈린다', () => {
    expect(sideOfRecordCode(SEASON_RECORD_CODE.삼중살)).toBe('수비')
    expect(sideOfRecordCode(SEASON_RECORD_CODE.병살)).toBe('수비')
    expect(sideOfRecordCode(SEASON_RECORD_CODE.내타자삼진)).toBe('공격')
    expect(sideOfRecordCode(SEASON_RECORD_CODE.사이클)).toBe('공격')
  })

  it('쪽이 다르면 아무것도 안 센다', () => {
    expect(recordSeasonGameEvent(빈칸(), SEASON_RECORD_CODE.탈삼진, '공격')).toEqual(빈칸())
    expect(recordSeasonGameEvent(빈칸(), SEASON_RECORD_CODE.안타, '수비')).toEqual(빈칸())
  })

  it('코드가 14 를 넘으면 0xa3440 이 아무것도 안 한다', () => {
    expect(recordSeasonGameEvent(빈칸(), 15, '공격')).toEqual(빈칸())
    expect(recordSeasonGameEvent(빈칸(), 99, '수비')).toEqual(빈칸())
  })

  it('값 인자가 없어 언제나 +1 이다 — 삼진이 둘 나와도 1 만 오른다', () => {
    const 한번 = recordSeasonGameEvent(빈칸(), SEASON_RECORD_CODE.탈삼진, '수비')
    expect(한번[5]).toBe(1)
  })

  it('u8 이라 255 에서 한 바퀴 돈다 (원본 그대로)', () => {
    const 가득 = 칸({ 0: 255 })
    expect(recordSeasonGameEvent(가득, SEASON_RECORD_CODE.삼중살, '수비')[0]).toBe(0)
  })
})

describe('평판식 0xa6f1c', () => {
  it('상대 득점이 깎는다 — >4 면 s 를 −4 로 **대입**하고 시작한다', () => {
    // 이긴 경기로 봐야 패배 −2 가 안 섞인다
    const 승리 = { ...기본맥락, won: true }
    expect(seasonReputationScoreOf(빈칸(), { ...승리, opponentRuns: 5 })).toBe(-4 + 2)
    expect(seasonReputationScoreOf(빈칸(), { ...승리, opponentRuns: 4 })).toBe(-2 + 2)
    expect(seasonReputationScoreOf(빈칸(), { ...승리, opponentRuns: 3 })).toBe(-1 + 2)
    expect(seasonReputationScoreOf(빈칸(), { ...승리, opponentRuns: 2 })).toBe(2)
  })

  it('패배는 −2, 승리는 +2 다', () => {
    expect(seasonReputationScoreOf(빈칸(), { ...기본맥락, won: false })).toBe(-2)
    expect(seasonReputationScoreOf(빈칸(), { ...기본맥락, won: true })).toBe(2)
  })

  it('승리 완투 보너스 — 퍼펙트 7 · 노히트 6 · 완봉 4 · 완투 3', () => {
    const 점수 = (kind: SeasonGameContext['completeGame']) =>
      seasonReputationScoreOf(빈칸(), { ...기본맥락, won: true, completeGame: kind })
    expect(점수('퍼펙트')).toBe(2 + 7)
    expect(점수('노히트')).toBe(2 + 6)
    expect(점수('완봉')).toBe(2 + 4)
    expect(점수('완투')).toBe(2 + 3)
  })

  it('완투 보너스는 이겼을 때만 붙는다', () => {
    expect(seasonReputationScoreOf(빈칸(), { ...기본맥락, won: false, completeGame: '퍼펙트' })).toBe(패배기본)
  })

  it('벤치클리어링은 개당 −1, 삼중살은 개당 +4 다', () => {
    expect(seasonReputationScoreOf(칸({ 1: 3 }), 기본맥락)).toBe(패배기본 - 3)
    expect(seasonReputationScoreOf(칸({ 0: 2 }), 기본맥락)).toBe(패배기본 + 8)
  })

  it('내 타자 삼진은 3개당 −1 이다 (버림)', () => {
    expect(seasonReputationScoreOf(칸({ 6: 2 }), 기본맥락)).toBe(패배기본)
    expect(seasonReputationScoreOf(칸({ 6: 5 }), 기본맥락)).toBe(패배기본 - 1)
    expect(seasonReputationScoreOf(칸({ 6: 6 }), 기본맥락)).toBe(패배기본 - 2)
  })

  it('홈런 가중치는 솔로 1 · 2점 3 · 3점 4 · 만루 5 · 사이클 7 · 3루타 2 다', () => {
    expect(seasonReputationScoreOf(칸({ 10: 1 }), 기본맥락)).toBe(패배기본 + 1)
    expect(seasonReputationScoreOf(칸({ 11: 1 }), 기본맥락)).toBe(패배기본 + 3)
    expect(seasonReputationScoreOf(칸({ 12: 1 }), 기본맥락)).toBe(패배기본 + 4)
    expect(seasonReputationScoreOf(칸({ 13: 1 }), 기본맥락)).toBe(패배기본 + 5)
    expect(seasonReputationScoreOf(칸({ 14: 1 }), 기본맥락)).toBe(패배기본 + 7)
    // 3루타는 ×2 에 더해 t 합계에도 들어간다 — 여기서는 t 가 4 미만이라 구간 가산이 0
    expect(seasonReputationScoreOf(칸({ 9: 1 }), 기본맥락)).toBe(패배기본 + 2)
  })

  it('안타 합계 t 는 S[7]+S[8]+S[9] 구간표다', () => {
    expect(hitTotalBonusOf(3)).toBe(0)
    expect(hitTotalBonusOf(4)).toBe(1)
    expect(hitTotalBonusOf(5)).toBe(1)
    expect(hitTotalBonusOf(6)).toBe(2)
    expect(hitTotalBonusOf(9)).toBe(2)
    expect(hitTotalBonusOf(10)).toBe(3)
    expect(hitTotalBonusOf(14)).toBe(3)
    expect(hitTotalBonusOf(15)).toBe(4)
    expect(hitTotalBonusOf(19)).toBe(4)
    expect(hitTotalBonusOf(20)).toBe(6)
  })

  it('S[2](피안타)·S[3](수비 실수)·S[15] 는 평판식이 읽지 않는다', () => {
    expect(seasonReputationScoreOf(칸({ 2: 9, 3: 9, 15: 9 }), 기본맥락)).toBe(패배기본)
  })

  it('2루타·3루타는 S[7] 과 함께 올라 t 에서 두 번 세어진다 (원본 그대로)', () => {
    // 2루타 한 개는 안타 칸과 2루타 칸을 둘 다 올린다 → t = 2
    let slots = recordSeasonGameEvent(빈칸(), SEASON_RECORD_CODE.안타, '공격')
    slots = recordSeasonGameEvent(slots, SEASON_RECORD_CODE.이루타, '공격')
    expect(slots[7] + slots[8] + slots[9]).toBe(2)
  })
})

describe('등급 g — −2 ~ +6', () => {
  it('구간표 그대로다', () => {
    expect(reputationGradeOf(-99)).toBe(-2)
    expect(reputationGradeOf(-4)).toBe(-2)
    expect(reputationGradeOf(-3)).toBe(-1)
    expect(reputationGradeOf(-2)).toBe(-1)
    expect(reputationGradeOf(-1)).toBe(0)
    expect(reputationGradeOf(0)).toBe(0)
    expect(reputationGradeOf(1)).toBe(1)
    expect(reputationGradeOf(4)).toBe(2)
    expect(reputationGradeOf(6)).toBe(3)
    expect(reputationGradeOf(8)).toBe(4)
    expect(reputationGradeOf(10)).toBe(5)
    expect(reputationGradeOf(11)).toBe(6)
    expect(reputationGradeOf(999)).toBe(6)
  })

  it('한 경기 평판 변화는 −2 와 +6 사이에서 막힌다', () => {
    const 최악 = seasonReputationChangeOf(칸({ 1: 10, 6: 30 }), { ...기본맥락, opponentRuns: 20 })
    const 최고 = seasonReputationChangeOf(칸({ 0: 3, 14: 2, 7: 30 }), {
      ...기본맥락,
      won: true,
      completeGame: '퍼펙트',
    })
    expect(최악).toBe(-2)
    expect(최고).toBe(6)
  })
})

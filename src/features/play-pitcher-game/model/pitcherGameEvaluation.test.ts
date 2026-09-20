import { describe, expect, it } from 'vitest'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { NO_ENTRY_USER_EVENT_INDEX } from '@/entities/pitcher-career/model/pitcherRotation'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import {
  EMPTY_PITCHER_EVALUATION_RECORD,
  MANAGER_TEXT_SECTION_STARTS,
  REPUTATION_GAIN_TABLE,
  REPUTATION_PENALTY_TABLE,
  applyReputationTail,
  completeGameKindOf,
  evaluatePitcherGame,
  managerCommentIndexOf,
  moraleChangeOf,
  popularityChangeOf,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import type {
  PitcherEvaluationContext,
  PitcherEvaluationRecord,
} from '@/features/play-pitcher-game/model/pitcherGameEvaluation'

const 선발: PitcherEvaluationContext = {
  positionCode: 0,
  role: PITCHER_ROLE.starter,
  won: true,
  endedInningIndex: 8,
  teamWalksAllowed: 0,
  teamHitsAllowed: 0,
  teamRunsAllowed: 0,
  neverEntered: false,
  reputation: 500,
}
const 구원: PitcherEvaluationContext = { ...선발, positionCode: 5, role: PITCHER_ROLE.relief }

/** 9이닝 완투 = 아웃 27 */
const 완투기록: PitcherEvaluationRecord = {
  ...EMPTY_PITCHER_EVALUATION_RECORD,
  outsRecorded: 27,
  hitsAllowed: 5,
  strikeouts: 8,
}

describe('완투 계열 판정', () => {
  it('아웃 == 3·이닝 + 3 이면 완투다', () => {
    expect(completeGameKindOf(완투기록, 선발)).not.toBe('없음')
    expect(completeGameKindOf({ ...완투기록, outsRecorded: 24 }, 선발)).toBe('없음')
  })

  it('⚠️ 원본 버그 그대로 — R+0x128(실점)이 늘 0 이라 완투가 늘 완봉으로 센다', () => {
    // 팀은 5점을 내줬는데도 평가 칸은 0 이라 "완봉" 이 된다
    expect(completeGameKindOf(완투기록, { ...선발, teamRunsAllowed: 5 })).toBe('완봉')
  })

  it('피안타가 0 이면 노히트, 볼넷·사구까지 0 이면 퍼펙트다', () => {
    const 노히트 = { ...완투기록, hitsAllowed: 0, walksAllowed: 2 }
    const 퍼펙트 = { ...완투기록, hitsAllowed: 0, walksAllowed: 0, hitByPitch: 0 }

    expect(completeGameKindOf(노히트, 선발)).toBe('노히트')
    expect(completeGameKindOf(퍼펙트, 선발)).toBe('퍼펙트')
  })
})

describe('인기도 변화 p (0xa690c)', () => {
  it('선발형 눈금은 −2 … 12 의 짝수 위주다', () => {
    const p = popularityChangeOf(완투기록, 선발)

    expect(p % 2).toBe(0)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThanOrEqual(12)
  })

  it('지면 선발형 점수가 −1 에서 시작한다 — 같은 기록이라도 p 가 줄어든다', () => {
    expect(popularityChangeOf(완투기록, { ...선발, won: false })).toBeLessThan(
      popularityChangeOf(완투기록, 선발),
    )
  })

  it('구원형 눈금은 −2 … 6 이다', () => {
    const 기록 = { ...EMPTY_PITCHER_EVALUATION_RECORD, outsRecorded: 3, strikeouts: 2 }
    const p = popularityChangeOf(기록, 구원)

    expect(p).toBeGreaterThanOrEqual(-2)
    expect(p).toBeLessThanOrEqual(6)
  })

  it('세이브 기회에 올라와 승·세이브를 따면 +3 이 붙는다 (R+0x150)', () => {
    const 기록 = {
      ...EMPTY_PITCHER_EVALUATION_RECORD,
      outsRecorded: 3,
      strikeouts: 1,
      leadingAtEntry: true,
    }
    const 없음 = popularityChangeOf({ ...기록, decisionCode: 0 }, 구원)
    const 세이브 = popularityChangeOf({ ...기록, decisionCode: 3 }, 구원)

    expect(세이브).toBeGreaterThan(없음)
  })

  it('아웃 ≤ 2 이고 등판조차 못 했으면 p 가 0 이다', () => {
    const 기록 = { ...EMPTY_PITCHER_EVALUATION_RECORD, outsRecorded: 0 }

    expect(popularityChangeOf(기록, { ...구원, neverEntered: true })).toBe(0)
  })
})

describe('평판 꼬리 표 (0xd82a0 · 0xd82c8)', () => {
  it('표는 10칸이고 평판이 낮을수록 가점이 커진다', () => {
    expect(REPUTATION_GAIN_TABLE).toHaveLength(10)
    expect(REPUTATION_PENALTY_TABLE).toHaveLength(10)
    expect(REPUTATION_GAIN_TABLE[0]).toBeGreaterThan(REPUTATION_GAIN_TABLE[9])
  })

  it('평판이 낮으면 가점이 거의 두 배, 감점은 10% 로 줄어든다', () => {
    const 낮음 = applyReputationTail({ gain: 10, penalty: -10 }, 1)

    // 10 + 10·90/100 = 19, −10 − (10·(−90)/100) = −10 + 9 = −1
    expect(낮음).toBe(19 - 1)
  })

  it('평판이 높으면 가점이 줄고 감점이 늘어난다', () => {
    const 높음 = applyReputationTail({ gain: 10, penalty: -10 }, 999)

    // 10 + trunc(10·(−20)/100) = 8, −10 − trunc(10·30/100) = −13
    expect(높음).toBe(8 - 13)
  })

  it('평판 0 도 표 첫 칸을 쓴다 (원본은 trunc((평판−1)/100) 이라 음수가 안 된다)', () => {
    expect(applyReputationTail({ gain: 10, penalty: 0 }, 0)).toBe(19)
  })
})

describe('사기 변화 (0xa73c4)', () => {
  it('이기면 +5, 지면 −7 이고 라이벌전이면 두 배다', () => {
    expect(moraleChangeOf({ ...선발, role: PITCHER_ROLE.relief }, 0)).toBe(5)
    expect(moraleChangeOf({ ...선발, role: PITCHER_ROLE.relief, won: false }, 0)).toBe(-7)
    expect(moraleChangeOf({ ...선발, role: PITCHER_ROLE.relief, isRivalGame: true }, 0)).toBe(10)
  })

  it('투수편 선발만 p 를 반으로 줄여 타자 눈금에 맞춘다', () => {
    // p = 8 · 패배 → 선발: p → 4, c = −7 + 2 = −5 / 구원: c = −7 + 4 = −3
    const 선발패 = moraleChangeOf({ ...선발, won: false }, 8)
    const 구원패 = moraleChangeOf({ ...구원, won: false }, 8)

    expect(선발패).toBe(-5)
    expect(구원패).toBe(-3)
  })

  it('행운 스킬이면 +1 이다', () => {
    expect(moraleChangeOf({ ...선발, hasLuckSkill: true }, 0)).toBe(6)
  })
})

describe('감독 평가 글 (0x1278c)', () => {
  it('모드 3 구간 시작은 2·11·20·29 다', () => {
    expect(MANAGER_TEXT_SECTION_STARTS).toEqual([2, 11, 20, 29])
  })

  it('선발형은 등급 표가 두 배라 p = 12 가 마지막 칸이다', () => {
    expect(managerCommentIndexOf({ ...선발, reputation: 100 }, 12)).toBe(2 + 8)
    expect(managerCommentIndexOf({ ...선발, reputation: 100 }, -2)).toBe(2)
  })

  it('평판 구간이 올라가면 글 번호도 한 묶음씩 올라간다', () => {
    expect(managerCommentIndexOf({ ...선발, reputation: 200 }, 0)).toBe(11 + 2)
    expect(managerCommentIndexOf({ ...선발, reputation: 800 }, 0)).toBe(29 + 2)
  })

  it('구원이 등판조차 못 했으면 38 "오늘은 등판할 기회가 없었구나." 다', () => {
    const 번호 = managerCommentIndexOf({ ...구원, neverEntered: true }, 0)

    expect(번호).toBe(NO_ENTRY_USER_EVENT_INDEX)
    expect(ORIGINAL_USER_EVENTS[번호]).toContain('등판할 기회가 없었')
  })

  it('선발에는 38 이 나오지 않는다', () => {
    expect(managerCommentIndexOf({ ...선발, neverEntered: true }, 0)).not.toBe(
      NO_ENTRY_USER_EVENT_INDEX,
    )
  })

  it('고른 글 번호가 StrUSER_EVT 안에 있다', () => {
    for (const p of [-2, -1, 0, 2, 4, 6, 8, 10, 12]) {
      const 번호 = managerCommentIndexOf({ ...선발, reputation: 900 }, p)
      expect(ORIGINAL_USER_EVENTS[번호]).toBeTypeOf('string')
    }
  })
})

describe('한꺼번에', () => {
  it('인기도 → 평판 → 사기 순서로 한 번에 낸다', () => {
    const 결과 = evaluatePitcherGame(완투기록, 선발)

    expect(결과.popularityChange).toBeGreaterThan(0)
    expect(결과.completeGame).toBe('완봉')
    expect(결과.managerCommentIndex).toBeGreaterThanOrEqual(2)
    expect(결과.moraleChange).toBe(5)
  })
})

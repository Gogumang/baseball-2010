import { describe, expect, it } from 'vitest'
import {
  PITCH_TRAINING_TABLE,
  PITCH_TRAINING_TEXT,
  hasPitchType,
  openHiddenPitchRow,
  openableHiddenPitchEventOf,
  pitchTrainingCellOf,
  pitchTrainingCostOf,
  pitchTrainingGateOf,
  trainPitchType,
} from '@/entities/pitcher-career/model/pitchTraining'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { DEFAULT_PITCHER_ROOKIE_PROFILE } from '@/entities/pitcher-career/model/pitcherRegistration'

/** 기본 변화구를 칸 0(구질 2 TWO-SEAM)·칸 1(구질 3 H.FAST) 로 고른 신인 */
const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트', { ...DEFAULT_PITCHER_ROOKIE_PROFILE, breakingPitchSlots: [0, 1] }),
  gamePoint: 5000,
  ...overrides,
})

describe('구질 훈련 표 — 0xcc390 (J 3-2)', () => {
  it('4행 × 5열이고 행0 은 TWO-SEAM · H.FAST · CUT FAST · R.FAST · P.SINKER 다', () => {
    expect(PITCH_TRAINING_TABLE).toEqual([
      [2, 3, 10, 11, 18],
      [5, 4, 13, 12, 19],
      [7, 6, 15, 14, 20],
      [8, 9, 16, 17, 21],
    ])
  })

  it('단계 칸은 행·2 + 열%2 — 열0 과 열2 가 한 칸을 함께 쓴다', () => {
    expect(pitchTrainingCellOf(1, 0)).toBe(2)
    expect(pitchTrainingCellOf(1, 2)).toBe(2)
    expect(pitchTrainingCellOf(1, 3)).toBe(3)
  })

  it('비용은 열/2 로 고른다 — 300 · 300 · 600 · 600 · 1000 (표 0xcc3e0)', () => {
    expect([0, 1, 2, 3, 4].map(pitchTrainingCostOf)).toEqual([300, 300, 600, 600, 1000])
  })
})

describe('가드 순서 — 0x17912~0x17a4c', () => {
  it('이미 가진 구질은 아무 말 없이 무시한다 (0xa436c)', () => {
    // 칸 0 = 구질 2 는 등록에서 이미 배웠다
    expect(pitchTrainingGateOf(투수(), 0, 0)).toEqual({ kind: '무시' })
  })

  it('선행을 안 채운 상위 구질은 StrMODE[68] 로 막는다', () => {
    // 행1 열2 는 행1 열0(SHOOT)을 먼저 배워야 한다
    expect(pitchTrainingGateOf(투수(), 1, 2)).toEqual({
      kind: '막힘',
      textIndex: PITCH_TRAINING_TEXT.prerequisite,
    })
  })

  it('열4 는 계열이 안 열렸으면 StrMODE[67] 이다 — 선행보다 먼저 본다', () => {
    expect(pitchTrainingGateOf(투수(), 0, 4)).toEqual({
      kind: '막힘',
      textIndex: PITCH_TRAINING_TEXT.hiddenLocked,
    })
  })

  it('G포인트가 모자라면 StrMODE[65] 다', () => {
    expect(pitchTrainingGateOf(투수({ gamePoint: 100 }), 0, 2)).toEqual({
      kind: '막힘',
      textIndex: PITCH_TRAINING_TEXT.notEnoughPoints,
    })
  })

  it('그 밖에는 StrMODE[66] 확인 상자다', () => {
    expect(pitchTrainingGateOf(투수(), 0, 2)).toEqual({
      kind: '확인',
      cost: 600,
      textIndex: PITCH_TRAINING_TEXT.confirm,
    })
  })

  it('안 배운 기본 구질은 그대로 배울 수 있다 (열0 은 단계 ≤ 0 조건)', () => {
    expect(pitchTrainingGateOf(투수(), 2, 0).kind).toBe('확인')
  })
})

describe('배우기', () => {
  it('상위 구질을 배우면 칸 단계가 2 가 되고 비트마스크에 구질이 붙는다', () => {
    const after = trainPitchType(투수(), 0, 2)

    expect(hasPitchType(after, 10)).toBe(true)
    expect(after.pitchTrainingStages[0]).toBe(2)
    expect(after.gamePoint).toBe(5000 - 600)
  })

  it('히든은 계열이 열리고 그 행 두 칸 중 하나가 단계 2 여야 배운다', () => {
    const 상위습득 = trainPitchType(투수(), 0, 2)
    const 열림 = openHiddenPitchRow(상위습득, 0)

    expect(pitchTrainingGateOf(열림, 0, 4)).toEqual({
      kind: '확인',
      cost: 1000,
      textIndex: PITCH_TRAINING_TEXT.confirm,
    })
    // 히든은 계열 플래그로만 관리된다 — 단계 칸을 건드리지 않는다
    expect(trainPitchType(열림, 0, 4).pitchTrainingStages).toEqual(열림.pitchTrainingStages)
  })

  it('막힌 칸을 배우려 하면 예외다 — 조용히 넘기지 않는다', () => {
    expect(() => trainPitchType(투수(), 0, 4)).toThrow()
  })
})

describe('히든 변화구 이벤트 조건 (J 3-3)', () => {
  it('5년차 9경기부터 제구 200 · 구속 250 · 변화 300 이면 P.SLIDER 계열(행1)이 열린다', () => {
    const career = 투수({
      season: 5,
      gamesPlayed: 9,
      ability: { control: 200, velocity: 250, breaking: 300, stamina: 100 },
    })

    expect(openableHiddenPitchEventOf(career)?.eventId).toBe(30)
    expect(openableHiddenPitchEventOf(career)?.row).toBe(1)
  })

  it('능력치가 모자라면 아무것도 열리지 않는다', () => {
    expect(openableHiddenPitchEventOf(투수({ season: 5, gamesPlayed: 8 }))).toBeNull()
    expect(openableHiddenPitchEventOf(투수({ season: 5, gamesPlayed: 20 }))).toBeNull()
  })

  /**
   * 날짜 창 `from=(a−1)·45+b`, `now=(연차−1)·45+경기+1` (0xad110~0xad140).
   * 이벤트 30 은 `from = 4·45+9 = 189` 이고 5년차 **8경기째**가 이미 `now = 189` 다.
   */
  it('기간 첫 날은 5년차 8경기째다 — now 가 경기 수 + 1 이다 (0xad124)', () => {
    const 능력 = { control: 200, velocity: 250, breaking: 300, stamina: 100 }

    expect(openableHiddenPitchEventOf(투수({ season: 5, gamesPlayed: 8, ability: 능력 }))?.eventId).toBe(30)
    expect(openableHiddenPitchEventOf(투수({ season: 5, gamesPlayed: 7, ability: 능력 }))).toBeNull()
  })

  it('기간 끝 13년 45경기를 지나면 더는 열리지 않는다 (to = 12·45+45 = 585)', () => {
    const 능력 = { control: 200, velocity: 250, breaking: 300, stamina: 100 }

    expect(openableHiddenPitchEventOf(투수({ season: 13, gamesPlayed: 44, ability: 능력 }))?.eventId).toBe(30)
    expect(openableHiddenPitchEventOf(투수({ season: 13, gamesPlayed: 45, ability: 능력 }))).toBeNull()
  })
})

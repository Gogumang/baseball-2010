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
  pitchTypeNameOf,
  applyPitchTypeTraining,
  pitchTrainingCountOf,
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
  it('4행 × 5열이고 행0 은 TWO-SEAM · H.FAST · CUT FAST · R.FAST · GYRO 다', () => {
    expect(PITCH_TRAINING_TABLE).toEqual([
      [2, 3, 10, 11, 18],
      [5, 4, 13, 12, 19],
      [7, 6, 15, 14, 20],
      [8, 9, 16, 17, 21],
    ])
  })

  it('이름은 원본 이름표 [0x140026c] — 16 SF · 17 S.CHANGEUP · 히든 열 18~21 은 GYRO · P.SINKER · P.SLIDER · KNUCKLE', () => {
    expect(pitchTypeNameOf(15)).toBe('S.CURVE')
    expect(pitchTypeNameOf(16)).toBe('SF')
    expect(pitchTypeNameOf(17)).toBe('S.CHANGEUP')
    expect(PITCH_TRAINING_TABLE.map((row) => pitchTypeNameOf(row[4]))).toEqual(['GYRO', 'P.SINKER', 'P.SLIDER', 'KNUCKLE'])
    expect(pitchTypeNameOf(22)).toBe('SPECIAL')
    expect(pitchTypeNameOf(0)).toBe('')
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

/** 같은 칸을 n 번 훈련한다 */
const 훈련 = (career: PitcherCareer, row: number, column: number, times: number): PitcherCareer => {
  let current = career
  for (let i = 0; i < times; i += 1) current = applyPitchTypeTraining(current, row, column).career
  return current
}

describe('훈련 적용 0xa3bac 종류 5 (0xa3cc8~0xa3d76) — 필요 횟수 0xd80de [2, 4, 5] · 훈련마다 G 0xd80d8', () => {
  it('상위 구질(열 2)은 네 번 훈련해야 단계가 2 가 된다 — 한 번마다 600 G, 보유 마스크는 안 건드린다', () => {
    const 한번 = applyPitchTypeTraining(투수(), 0, 2)
    expect(한번.progress).toEqual({ sessions: 1, required: 4, isLearned: false })
    expect(pitchTrainingCountOf(한번.career, 0)).toBe(1)
    expect(한번.career.pitchTrainingStages[0]).toBe(1)
    expect(한번.career.gamePoint).toBe(5000 - 600)

    const 세번 = 훈련(투수(), 0, 2, 3)
    const 네번 = applyPitchTypeTraining(세번, 0, 2)
    expect(네번.progress).toEqual({ sessions: 0, required: 4, isLearned: true })
    expect(네번.career.pitchTrainingStages[0]).toBe(2)
    expect(pitchTrainingCountOf(네번.career, 0)).toBe(0)
    expect(네번.career.gamePoint).toBe(5000 - 600 * 4)
    expect(hasPitchType(네번.career, 10)).toBe(false)
    // 다 배운 칸은 가드 ② 단계 > 열/2 로 무시
    expect(pitchTrainingGateOf(네번.career, 0, 2).kind).toBe('무시')
  })

  it('기본 구질(열 0·1)은 두 번 — 300 G 씩', () => {
    const 한번 = applyPitchTypeTraining(투수(), 2, 0)
    expect(한번.progress).toEqual({ sessions: 1, required: 2, isLearned: false })
    const 두번 = applyPitchTypeTraining(한번.career, 2, 0)
    expect(두번.progress.isLearned).toBe(true)
    expect(두번.career.pitchTrainingStages[pitchTrainingCellOf(2, 0)]).toBe(1)
    expect(두번.career.gamePoint).toBe(5000 - 600)
  })

  it('히든(열 4)은 다섯 번 · 1000 G — 그 행 cell0 단계가 2 면 cell0 에, 아니면 cell1 에 쌓는다', () => {
    const 열림 = openHiddenPitchRow(훈련(투수({ gamePoint: 20000 }), 0, 2, 4), 0)
    expect(pitchTrainingGateOf(열림, 0, 4)).toEqual({ kind: '확인', cost: 1000, textIndex: PITCH_TRAINING_TEXT.confirm })
    const 다섯번 = 훈련(열림, 0, 4, 5)
    expect(다섯번.pitchTrainingStages[0]).toBe(3)
    expect(다섯번.pitchTrainingStages[1]).toBe(열림.pitchTrainingStages[1])

    // cell0 이 단계 1 이고 cell1 이 2 면 cell1 에 쌓는다
    const 오른쪽 = openHiddenPitchRow(훈련(투수(), 0, 3, 4), 0)
    const 한번 = applyPitchTypeTraining(오른쪽, 0, 4)
    expect(pitchTrainingCountOf(한번.career, 1)).toBe(1)
    expect(pitchTrainingCountOf(한번.career, 0)).toBe(0)
  })

  it('G 는 0 에서 바닥을 친다 (0xa3d4e)', () => {
    expect(applyPitchTypeTraining(투수({ gamePoint: 300 }), 2, 0).career.gamePoint).toBe(0)
  })

  it('막힌 칸을 배우려 하면 예외다 — 조용히 넘기지 않는다', () => {
    expect(() => applyPitchTypeTraining(투수(), 0, 4)).toThrow()
  })
})

describe('히든 변화구 이벤트 조건 (J 3-3)', () => {
  it('5년차 9경기부터 제구 200 · 구속 250 · 변화 300 이면 P.SINKER 계열(행1)이 열린다', () => {
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

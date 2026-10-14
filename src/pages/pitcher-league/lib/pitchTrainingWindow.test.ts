import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { DEFAULT_PITCHER_ROOKIE_PROFILE } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  PITCH_TRAINING_START, cellLookOf, pitchTrainingKeyOutcomeOf, pitchTrainingWindowCostOf, pitchTrainingWindowProgressOf,
  statusLabelOf, tabMarkTopLeftOf,
} from '@/pages/pitcher-league/lib/pitchTrainingWindow'

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  ...createPitcherCareer('테스트', { ...DEFAULT_PITCHER_ROOKIE_PROFILE, breakingPitchSlots: [0, 1] }),
  ...overrides,
})

describe('0x803d4 탭 2 — unicorn 으로 돌린 그리기 호출과 같은 값', () => {
  it('꺾쇠 mode_ui 40 은 (24 + 탭칸.x, 72 + 3 − 2) — 행 1 이면 (74, 73)', () => {
    expect(tabMarkTopLeftOf(1)).toEqual({ x: 74, y: 73 })
  })

  it('행 1 · 히든 열림 · 칸 단계 [1,0,2,1,…] · 마스크 13 · 12 — 칸 판·글 색', () => {
    const career = 투수({
      pitchTrainingStages: [1, 0, 2, 1, 0, 0, 3, 1],
      pitchTrainingCounts: [0, 0, 1, 0, 0, 0, 0, 0],
      hiddenPitchRows: [false, true, true, false],
      pitchMask: (1 << 12) | (1 << 11) | 1,
    })
    expect(cellLookOf(career, 1, 0)).toEqual({ plate: null, nameFrame: 4, nameColor: '#FFFFFF' })
    expect(cellLookOf(career, 1, 4)).toEqual({ plate: 42, nameFrame: 18, nameColor: '#000000' })
  })

  it('비용은 칸 번호를 자르지 않고 /2 — 칸 5 도 1000', () => {
    expect([0, 1, 2, 3, 4, 5].map(pitchTrainingWindowCostOf)).toEqual([300, 300, 600, 600, 1000, 1000])
  })

  it('횟수 — 단계 == 열/2 면 그 칸 횟수, 더 낮으면 0, 넘으면 필요/필요', () => {
    const career = 투수({ pitchTrainingStages: [1, 0, 0, 0, 0, 0, 0, 0], pitchTrainingCounts: [3, 0, 0, 0, 0, 0, 0, 0] })
    expect(pitchTrainingWindowProgressOf(career, 0, 2)).toEqual({ count: 3, required: 4 })
    expect(pitchTrainingWindowProgressOf(career, 0, 3)).toEqual({ count: 0, required: 4 })
    expect(pitchTrainingWindowProgressOf(career, 0, 0)).toEqual({ count: 2, required: 2 })
  })

  it('글 — 열 4 의 "배움" 은 보정 없이 cell0 단계 > 2 로 본다(원본 그대로)', () => {
    const career = 투수({ pitchTrainingStages: [1, 3, 0, 0, 0, 0, 0, 0], hiddenPitchRows: [true, false, false, false], pitchMask: 1 })
    expect(statusLabelOf(career, 0, 4, true)).toBe(0x125)
    expect(statusLabelOf(career, 0, 4, false)).toBe(0x125)
  })
})

describe('키 0x17828 · 0x80268', () => {
  it('탭 줄 OK 는 초점만 칸으로(칸 커서 그대로), ↓ 는 칸 (0,0) 으로', () => {
    const held = { ...PITCH_TRAINING_START, cell: 3 }
    expect(pitchTrainingKeyOutcomeOf(held, 'ok')).toEqual({ kind: 'move', cursor: { ...held, isCellFocus: true } })
    expect(pitchTrainingKeyOutcomeOf(held, 'down')).toEqual({ kind: 'move', cursor: { ...held, isCellFocus: true, cell: 0 } })
  })

  it('탭 줄 ↑ 는 0x330 감기로 왼쪽 탭 — 0 에서 3', () => {
    expect(pitchTrainingKeyOutcomeOf(PITCH_TRAINING_START, 'up')).toEqual({ kind: 'move', cursor: { ...PITCH_TRAINING_START, tab: 3 } })
  })

  it('칸 격자 2×3 꼴 0x30 — 아래 줄에서 ↓ 는 첫 줄로 감고, 칸 4·5 는 열 4 로 확인한다', () => {
    const bottom = { isCellFocus: true, tab: 2, cell: 5 }
    expect(pitchTrainingKeyOutcomeOf(bottom, 'down')).toEqual({ kind: 'move', cursor: { ...bottom, cell: 1 } })
    expect(pitchTrainingKeyOutcomeOf(bottom, 'ok')).toEqual({ kind: 'confirm', row: 2, column: 4 })
  })

  it('칸 초점 취소는 탭 줄로, 탭 줄 취소는 닫기', () => {
    expect(pitchTrainingKeyOutcomeOf({ isCellFocus: true, tab: 0, cell: 2 }, 'clr'))
      .toEqual({ kind: 'move', cursor: { isCellFocus: false, tab: 0, cell: 2 } })
    expect(pitchTrainingKeyOutcomeOf(PITCH_TRAINING_START, 'clr')).toEqual({ kind: 'close' })
  })
})

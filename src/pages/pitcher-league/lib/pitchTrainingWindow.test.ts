import { describe, expect, it } from 'vitest'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { DEFAULT_PITCHER_ROOKIE_PROFILE } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  PITCH_TRAINING_START, cellLookOf, pitchTrainingKeyOutcomeOf, pitchTrainingWindowCostOf, pitchTrainingWindowProgressOf,
  PITCH_TRAINING_CELL_BOXES, statusLabelOf, tabMarkTopLeftOf,
} from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

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

  it('123(0x7b) 은 처음 글이 0x127 "장착"(80cea) · 배운 칸도 0x127(81174) · 목록에 든 구질만 0x128', () => {
    const career = 투수({ pitchTrainingStages: [1, 0, 0, 0, 0, 0, 0, 0], pitchMask: 0b10 })
    expect(statusLabelOf(career, 0, 0, false, '장착')).toBe(0x127)
    expect(statusLabelOf(career, 0, 0, true, '장착')).toBe(0x128)
    expect(statusLabelOf(career, 0, 2, true, '장착')).toBe(0x127)
    expect(statusLabelOf(career, 1, 0, true, '장착')).toBe(0x127)
    // 108 은 배운 칸이 −1(안 그림)
    expect(statusLabelOf(투수({ pitchTrainingStages: [1, 0, 0, 0, 0, 0, 0, 0], pitchMask: 0 }), 0, 0, true)).toBeNull()
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

/**
 * r203 — '???' 칸(5 번째, 96~149 × 172~187)의 누름 칸은 창이 띄운 상자(알림 '확인' 100~141 × 177~192, 예/아니오 59~100 · 140~181 —
 * 헤드리스로 잰 값)의 단추 자리를 덮는다. 상자가 칸 아래 겹(예전 5 < 7)이면 '예' 끝을 누를 때 '???' 칸이 눌려 "아직 배울 수 없는 구질"
 * 상자가 새로 떴고, 알림 확인은 위 ⅔ 가 죽었다. 칸은 원본 좌표 그대로 두고 상자 겹을 칸 위로 올린다.
 */
describe('구질훈련 창 — 칸 누름과 상자 단추가 겹친다', () => {
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

  it('\'???\' 칸이 알림 확인 · 예 · 아니오 단추와 겹치므로 상자 겹은 누름 칸보다 위다', () => {
    const cell = PITCH_TRAINING_CELL_BOXES[4]
    expect(overlaps(cell, { x: 100, y: 177, width: 41, height: 15 })).toBe(true)
    expect(overlaps(cell, { x: 59, y: 177, width: 41, height: 15 })).toBe(true)
    expect(overlaps(cell, { x: 140, y: 177, width: 41, height: 15 })).toBe(true)
    expect(SCREEN_LAYERS.POPUP_WINDOW).toBeGreaterThan(SCREEN_LAYERS.PRESS_AREA)
  })
})

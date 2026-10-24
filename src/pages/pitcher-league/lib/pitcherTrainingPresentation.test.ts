import { describe, expect, it } from 'vitest'
import {
  PITCHER_MAGIC_TRAINING_SLOT,
  isPitcherTrainingSkipKey,
  pitcherTrainingPresentationOf,
} from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'

describe('투수편 125 훈련 연출 (0x84664 모드 3 · 점프표 0xd4990)', () => {
  it('raise 애니는 4t + [3, 5, 4, −, 6] — t = 기록 +0xb >> 5 (투수 타입)', () => {
    const 애니 = (slot: number, t: number) => pitcherTrainingPresentationOf(slot, t).animation
    expect([0, 1, 2].map((t) => [0, 1, 2, 4].map((slot) => 애니(slot, t)))).toEqual([
      [3, 5, 4, 6],
      [7, 9, 8, 10],
      [11, 13, 12, 14],
    ])
  })

  it('칸 3 은 타입과 상관없이 team_traning_ani 3 이고 투수 그림이 없다', () => {
    for (const t of [0, 1, 2]) {
      expect(pitcherTrainingPresentationOf(3, t)).toEqual({ slot: 3, file: 'team_traning_ani', animation: 3, figure: null })
    }
  })

  it('투수 그림은 표 0xd49a4 (17칸) · (가운데 − 0x34, 바닥 − 12) (0x849b8~0x84a18)', () => {
    const { figure, file } = pitcherTrainingPresentationOf(PITCHER_MAGIC_TRAINING_SLOT, 0)
    expect(file).toBe('raise_traning_ani')
    expect(figure).toEqual({ poses: [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 14, 14, 14], dx: -0x34, dy: -12 })
  })

  it('건너뛰기 키는 확인(−5) · \'5\' 뿐이다 — 취소는 안 받는다 (0x105a4)', () => {
    expect(['Enter', '5', ' '].every(isPitcherTrainingSkipKey)).toBe(true)
    expect(['Escape', 'Backspace', '0'].some(isPitcherTrainingSkipKey)).toBe(false)
  })
})

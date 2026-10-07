import { describe, expect, it } from 'vitest'
import {
  SEASON_TRAINING_BATTER_FORM, SEASON_TRAINING_PRESENTATIONS, isSeasonTrainingSkipKey,
} from '@/pages/season/lib/seasonTrainingPopup'

describe('시즌 0xde 훈련 팝업 — 0x84664 시즌 갈래 · 0x848d0 시즌 캐릭터', () => {
  it('점프표 0xd4968 — 칸마다 파일 · 애니', () => {
    expect(SEASON_TRAINING_PRESENTATIONS.map(({ file, animation }) => `${file}:${animation}`)).toEqual([
      'raise_traning_ani:3', 'raise_traning_ani:0', 'team_traning_ani:0', 'team_traning_ani:1', 'team_traning_ani:2',
    ])
  })

  it('칸 0 투수(0xd49a4 · 가운데 − 0x34 · 바닥 − 12) · 칸 1 타자(0xd4a48 · + 0x37 · − 2) · 그 밖 캐릭터 없음', () => {
    const [투수, 타자, ...나머지] = SEASON_TRAINING_PRESENTATIONS.map((presentation) => presentation.figure)
    expect(투수).toMatchObject({ kind: '투수', dx: -52, dy: -12 })
    expect(투수?.poses).toHaveLength(17)
    expect(투수?.poses.slice(0, 3)).toEqual([0, 3, 4])
    expect(타자).toEqual({ kind: '타자', poses: [0, 4, 5, 6, 7, 7, 7, 7, 7], dx: 55, dy: -2 })
    expect(나머지).toEqual([null, null, null])
  })

  it('타자 그림은 balancer · 안 뒤집음(+0x3c = 1) — 폼 1', () => {
    expect(SEASON_TRAINING_BATTER_FORM).toBe(1)
  })

  it('확인(−5 · 5)만 건너뛴다 — 취소는 없다', () => {
    expect(['Enter', '5', ' ', 'Escape', 'Backspace'].map(isSeasonTrainingSkipKey)).toEqual([true, true, true, false, false])
  })
})

import type { TrainingAnimationFile } from '@/shared/config/original/trainingAnimation'

/**
 * 시즌 상태 **0xde** 훈련 팝업 — 갱신 0x5198 · 그리기 0xa0e4 → `0x848d0(gfx, 1, 0)` · 0x84664 시즌 갈래 (직접 떴다).
 *
 * ```
 * 0x5198  t = 고른 칸 → 0x84664(gfx, t)
 *         t ≤ 1 이면 캐릭터를 새로 만든다 — t == 1 타자 0x789f0 · t == 0 투수 0x79368
 *         vt+8(obj, 내 팀, 0, 0, 1, −1)  → 타입 0(balancer) · 피부 0 · 마선수 아님   (0x78ab0 · 0x793b0)
 *         obj+0x48 = 0(그림자 없음) · obj+0x3c = (t == 1 ? 1 : 0)                    — 둘 다 안 뒤집는다
 * 0x84664 시즌(0x7b998 — [gfx+0x20] == 2) 점프표 0xd4968:
 *         0 → raise_traning_ani 애니 3 · 1 → raise 0 · 2 → team_traning_ani 0 · 3 → team 1 · 4 → team 2
 *         [gfx+0x1c0] · [gfx+0x1c4] 는 비운다(덧애니 없음) · 게이지 0x84634(gfx, 31, 60)
 * 0x848d0 시즌 갈래(0x84c2c~0x84d46): 칸 [gfx+0x1cc]
 *         0 → 표 0xd49a4(17칸, 칸 번호 16 에서 자름) · (가운데 − 0x34, 바닥 − 12)
 *         1 → 표 0xd4a48(9칸, 8 에서 자름)           · (가운데 + 0x37, 바닥 − 2)
 *         그 밖 → 캐릭터 없음
 * 키 0x4968  확인(−5 / '5') → [gfx+0x1d0] = [gfx+0x1d8] (게이지 끝으로) · 그 밖 키 없음
 * 끝 0xc384  0x84e58(애니 끝) → 0xc074 굴림 → 팝업 0x13 → 0xc9
 * ```
 */
export interface SeasonTrainingFigure {
  readonly kind: '투수' | '타자'
  readonly poses: readonly number[]
  /** 연출 기준점 (120, 137) 에서 */
  readonly dx: number
  readonly dy: number
}

export interface SeasonTrainingPresentation {
  readonly file: TrainingAnimationFile
  readonly animation: number
  readonly figure: SeasonTrainingFigure | null
}

/** 0xd49a4 — 칸 번호 16 에서 자른다 */
const PITCHER_POSES = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 14, 14, 14] as const
/** 0xd4a48 — 칸 번호 8 에서 자른다 */
const BATTER_POSES = [0, 4, 5, 6, 7, 7, 7, 7, 7] as const

export const SEASON_TRAINING_PRESENTATIONS: readonly SeasonTrainingPresentation[] = [
  { file: 'raise_traning_ani', animation: 3, figure: { kind: '투수', poses: PITCHER_POSES, dx: -0x34, dy: -12 } },
  { file: 'raise_traning_ani', animation: 0, figure: { kind: '타자', poses: BATTER_POSES, dx: 0x37, dy: -2 } },
  { file: 'team_traning_ani', animation: 0, figure: null },
  { file: 'team_traning_ani', animation: 1, figure: null },
  { file: 'team_traning_ani', animation: 2, figure: null },
]

/** 타자 그림 폼 — 타입 0(balancer) · +0x3c = 1(안 뒤집음) → `2 × 0 + 1` */
export const SEASON_TRAINING_BATTER_FORM = 1
/** 피부 — vt+8 의 셋째 인자 0 (팔레트 = 피부 × 15 + 팀) */
export const SEASON_TRAINING_SKIN = 0

/** 확인 키 (0x4968: −5 · '5') */
export const isSeasonTrainingSkipKey = (key: string): boolean => key === 'Enter' || key === '5' || key === ' '

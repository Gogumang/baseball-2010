import type { TrainingAnimationFile } from '@/shared/config/original/trainingAnimation'

/**
 * **나리 투수편 훈련 연출(상태 125)** — 0x84664 모드 3 갈래 · 0x848d0 모드 3 갈래 · 진입 0x11744 (직접 떴다, r198).
 *
 * ```
 * 107 칸 0~3 [85] 예 · 108 [66] 예(마구) · 108 탭 2 확인(구질) → 125
 * 진입 0x11744  칸 = 107 메뉴 객체 [장면+0x94] 커서(+0x10 × +0x14 + +0xc) — 108 에서 와도 107 칸 4 그대로
 *               0x84664(팝업, 칸) · 캐릭터는 칸 0 · 1 · 4, 칸 2 는 모드 ≠ 4 일 때만(모드 3 은 그린다), 칸 3 은 없다
 *               모드 3 = 단일 PZX 투수 0x79369 → 0x10810(장면, 내 기록) — 팀 · 폼 · 피부 · 장비 니블(기본정보 카드와 같은 값)
 *               그 뒤 그림 +0x3c = 0 (11802~1181e — 모드 4 만 1) → 0x79525 가 안 뒤집는다(손 무관)
 * 0x84664 모드 3 (0x7b998 · 0x7b970 둘 다 아님 · 846e8~8471e): t = 기록 +0xb >> 5 (투수 타입 0 오버 · 1 사이드 · 2 언더)
 *               점프표 0xd4990: 칸 0 → raise_traning_ani 4t+3 · 1 → raise 4t+5 · 2 → raise 4t+4 · 3 → team_traning_ani 3
 *               · 4 → raise 4t+6. [+0x1c0] · [+0x1c4] 덧애니는 비우기만 한다(파티클 없음) · 게이지 0x84634(31, 60)
 * 0x848d0 모드 3 (0x7b984 · 849b8~84a2a): 칸 ∈ {0, 1, 2, 4}(마스크 0x17) 이면 표 0xd49a4 (17칸, 칸 번호 16 에서 자름)
 *               · (가운데 − 0x34, 바닥 − 12). 동작 번호 = pitcher.pzx 프레임 번호(0x79525)
 * 키 0x105a4    확인(−5) · '5' → [+0x1d0] = [+0x1d8](게이지 끝으로) · 그 밖 키 없음(취소도 안 받는다)
 * 틀 0x18dd8    0x84e58(게이지 끝 → 애니 셋 지우고 참) 이면 0x17f5c 훈련 적용(굴림) → 결과 창. 애니가 지워져 그 뒤 0x848d0 은
 *               [+0x1c8] == 0 이라 아무것도 안 그린다(848e8). 그림 0x19da4 는 상태 0x7d 면 가운데 판 0x7f814 를 뺀다
 * ```
 * 연출 함수(0x84664 · 0x848d0 · 0x84e58 · 0x105a4 · 0x11744 · 0x10810)는 난수 0xbfa55 를 부르지 않는다. 소리도 없다.
 */
export interface PitcherTrainingFigure {
  /** 0xd49a4 — 연출 칸 번호로 고르는 pitcher.pzx 프레임 */
  readonly poses: readonly number[]
  /** 연출 기준점 (120, 137) 에서 */
  readonly dx: number
  readonly dy: number
}

export interface PitcherTrainingPresentation {
  readonly slot: number
  readonly file: TrainingAnimationFile
  readonly animation: number
  readonly figure: PitcherTrainingFigure | null
}

/** 0xd49a4 — 칸 번호 16 에서 자른다 */
const PITCHER_POSES = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 14, 14, 14] as const
const FIGURE: PitcherTrainingFigure = { poses: PITCHER_POSES, dx: -0x34, dy: -12 }

/** 0xd4990 칸별 raise 애니 = 4t + 이 값 (칸 3 은 team 3) */
const RAISE_BASE_BY_SLOT: readonly (number | null)[] = [3, 5, 4, null, 6]
/** 0x84664 칸 3 → 0x84712 (타자편 칸 3 주루와 같은 자리) */
const TEAM_ANIMATION = 3

/** 107 커서 칸 4 — 마구 · 구질 훈련(108 에서 와도 같다) */
export const PITCHER_MAGIC_TRAINING_SLOT = 4

export function pitcherTrainingPresentationOf(slot: number, typeIndex: number): PitcherTrainingPresentation {
  const base = RAISE_BASE_BY_SLOT[slot]
  if (base === null || base === undefined) {
    return { slot, file: 'team_traning_ani', animation: TEAM_ANIMATION, figure: null }
  }
  return { slot, file: 'raise_traning_ani', animation: typeIndex * 4 + base, figure: FIGURE }
}

/** 키 0x105a4 — 확인(−5) · '5' 가 게이지를 끝으로 보낸다 */
export const isPitcherTrainingSkipKey = (key: string): boolean => key === 'Enter' || key === '5' || key === ' '

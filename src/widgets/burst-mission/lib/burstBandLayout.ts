import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { BURST_REWARD_NAMES } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'

/**
 * **타석 HUD 돌발 띠 — 원본 `0x8e858`** (r133 직접 떴다, 0x8e858~0x8e9e0). 돌발 창(0x8f3c0 · `BurstMissionWindow`)과 다른,
 * 타석 화면 오른쪽 위에 뜨는 작은 판이다.
 *
 * 부르는 곳 둘:
 * - 타석 공용 그리기 **0x4c4bc** 의 4c510~4c524 — 모드 [장면+0x1104] − 2 ≤ 2(시즌 2 · 나리 투수 3 · 나리 타자 4)이고
 *   돌발 객체 [장면+0xf28] 가 있으면. 점수판(0x373d0 / 0x45a54) 바로 뒤, 0xf 구질 목록의 빛 지도(4c5a6)보다 앞이다.
 * - 돌발 창 상태 0x1b 그리기 **0x4a198** 의 4a1e0 — 창 0x8f3c0 바로 뒤.
 *
 * ```
 * 8e866  [M+0xc](지금 돌발 행) == −1 이면 아무것도 안 그린다
 * 8e87c  (w, h) = 0xba815(trainning [M+0x240] = 장면+0x19e8, 14, 종류 1)            ; 합성 프레임 14 = 83×51
 * 8e8a2  bx = W − w = 157
 * 8e8c0  0xba759(trainning, 14, 종류 1, bx − 5, 5, 0, 0, 0, 1)                     ; 판 (152, 5)
 * 8e8c4  g = [M+0x22c](경기 = [0x1552d0c]) — g[0x31 + s8 g[9]] == 0(공격 측이 사람) →
 *          0xba759(trainning, 8, 종류 0, bx + 2, 7, …)                           ; 이미지 8 방망이 (159, 7)
 *        아니고 g[0x31 + s8 g[10]] == 0(수비 측이 사람) →
 *          0xba759(trainning, 7, 종류 0, bx + 2, 6, …)                           ; 이미지 7 공 (159, 6)
 *        둘 다 아니면 아이콘 없음
 * 8e932  행 = [M+0x10] + 16 × [M+0xc]
 * 8e962  0xba269(표[0x14002dc][s8 행 b8], bx − 5 + 3, 0x18, w − 6, −1, 0)          ; 목표 (155, 24, 77)
 * 8e966  글 = 표[0x14002c8][s8 b10] + " +"(0xcc288) + (b10 == 4 ? s8 b11 × 100 : s8 b11)
 * 8e9ce  0xba269(글, bx − 5 + 3, 0x28, w, −1, 0)                                  ; 보상 (155, 40, 83)
 * ```
 * - [M+0xc] 는 발동 0x8f000(0x8f104)이 채우고, 결과 줄(+0x21c ≠ −1)에서 키를 받은 0x8e5b8(0x8e7ee~0x8e800)과
 *   내림 0x8f628 만 −1 로 되돌린다 — 곧 띠는 제안 창부터 타석 동안 · 판정 뒤 결과 창이 닫힐 때까지 선다.
 * - 보상 글은 0x8e5b8 의 결과 창 글과 달리 **b10 ≠ 0 을 안 보고** 첫 보상 하나만 쓴다(종류 0 이면 "없음 +0").
 * - 두 글 모두 `!C` 머리라 폭 안 가운데다. 색 −1 은 흰 글.
 */

/** 타석 캔버스 폭 W (0x14008b8) */
const SCREEN_WIDTH = 240

export const BURST_BAND_FOLDER = './sprites/trainning'
/** trainning 합성 프레임 14 (83×51, 원점 (0, 0)) — 0xba815 의 상자 */
export const BURST_BAND_FRAME_SRC = './sprites/trainning/frames/014.png'
const BAND_WIDTH = 83

/** bx = W − w */
const BAND_X = SCREEN_WIDTH - BAND_WIDTH

/** 판 — (bx − 5, 5) */
export const BURST_BAND_PANEL = { left: BAND_X - 5, top: 5 } as const

/** 8e8c4 아이콘 — 사람이 공격이면 이미지 8 방망이 (bx + 2, 7), 수비면 이미지 7 공 (bx + 2, 6) */
export const BURST_BAND_ICONS = {
  공격: { src: `${BURST_BAND_FOLDER}/008.png`, left: BAND_X + 2, top: 7 },
  수비: { src: `${BURST_BAND_FOLDER}/007.png`, left: BAND_X + 2, top: 6 },
} as const

/** 목표 글 (bx − 2, 0x18, w − 6) · 보상 글 (bx − 2, 0x28, w) */
export const BURST_BAND_GOAL_TEXT = { left: BAND_X - 5 + 3, top: 0x18, width: BAND_WIDTH - 6 } as const
export const BURST_BAND_REWARD_TEXT = { left: BAND_X - 5 + 3, top: 0x28, width: BAND_WIDTH } as const

/**
 * 목표 이름 표 [0x14002dc] (0xd500c~0xd50a0) — 행 b8 로 고른다. 칸 5 는 판정 점프표에서 아무것도 안 하는 칸이지만 이름은 "주자진루".
 * ⚠️ 칸 10 의 자리 [0x1400304] 는 글이 아니라 0x94ae5 다 — 세 표에 b8 = 10 인 행이 없어 웹은 빈 글로 둔다.
 */
export const BURST_GOAL_NAMES: readonly string[] = [
  '!C!cffffff안타', '!C!cffffff장타', '!C!cffffff홈런', '!C!cffffff타점', '!C!cffffff번트',
  '!C!cffffff주자진루', '!C!cffffff아웃', '!C!cffffff삼진', '!C!cffffff병살', '!C!cffffff고의사구',
]

/** 소지금(4) 보상은 표시 값 ×100 (0x8e994~0x8e9a0) */
const MONEY_KIND = 4
const MONEY_DISPLAY_SCALE = 100

const asSignedByte = (value: number): number => (value > 127 ? value - 256 : value)

/** 사람 팀이 이 장면에서 공격인가 수비인가 — 0x8e8c4 의 g[0x31 + g[9]] · g[0x31 + g[10]]. 둘 다 아니면 null */
export type BurstBandRole = '공격' | '수비' | null

export interface BurstBandDraw {
  readonly icon: (typeof BURST_BAND_ICONS)[keyof typeof BURST_BAND_ICONS] | null
  /** 마크업 원문 (`!C!cffffff…`) */
  readonly goalText: string
  readonly rewardText: string
}

/** 띠 한 장 — 지금 돌발 행이 없으면([M+0xc] == −1) null */
export function burstBandOf(row: BurstMissionRow | null, role: BurstBandRole): BurstBandDraw | null {
  if (row === null) return null
  const [first] = row.successRewards
  const amount = asSignedByte(first.amount)
  const value = first.kind === MONEY_KIND ? amount * MONEY_DISPLAY_SCALE : amount
  return {
    icon: role === null ? null : BURST_BAND_ICONS[role],
    goalText: BURST_GOAL_NAMES[row.goal] ?? '',
    rewardText: `${BURST_REWARD_NAMES[first.kind] ?? ''} +${value}`,
  }
}

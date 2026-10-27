import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { InningHalf, PlayerSide } from '@/entities/game/model/gameState'
import { BURST_REWARD_NAMES } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

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
 * - **[M+0xc] 쓰기 전수** (r136 — 돌발 클래스 0x8e0bc~0x8f638 의 `str …, [M, #0xc]` 과 장면 +0xf28 을 읽는 17곳을 모두 떴다):
 *   8e26e 초기화 0x8e1b0 = −1 · 8f104 발동 0x8f000 = 고른 행 · 8f184 0x8f158 = −1(이미 −1 일 때만 닿는다 — 8f15a~8f15e) ·
 *   8e800 결과 줄(+0x21c ≠ −1)에서 키를 받은 0x8e5b8 = −1 · 8f634 내림 0x8f628 = −1. 다섯뿐이다.
 *   장면 +0xf28 을 읽는 곳(0x33938 · 0x3ac56 · 0x3ad38 · 0x3af96 · 0x3afd6 · 0x3b016 · 0x3b04e · 0x3b06a · 0x3d9ec · 0x46f08 ·
 *   0x48c0e · 0x4a1d0 · 0x4c518 · 0x4d20c · 0x4e75a · 0x4e7b2 · 0x50c34 · 0x52a6c)은 모두 위 메서드나 0x8e34d · 0x8eb95 · 0x8f3c1 ·
 *   0x8e859 · 0x8f415 · 가상 소멸자(0xd4fac)를 부를 뿐 +0xc 를 직접 쓰지 않는다. 클래스 안 바깥 호출은 r0 이 M 이 아니거나
 *   M 의 다른 칸(+0x10 표 · +0x14 대사 버퍼)을 넘긴다. M 을 r1~r3 로 넘기는 호출도 없다(r181 확정 — 메서드 23개 전수:
 *   M 을 든 레지스터(0x8e0e4 · 0x8e124 · 0x8e164 · 0x8f3c0 r4 · 0x8e1b0 · 0x8f000 · 0x8f414 r5 · 0x8e5b8 · 0x8e858 r6 · 0x8ea18 r7)를
 *   r1~r3 으로 옮기는 곳이 없고, r0 을 r1~r3 로 옮기는 셋(8e8a4 · 8ed5e · 8f1d4)은 모두 M 이 아닌 값 — 폭 · [M+0x22c] · 글 폭).
 *   → 띠는 발동(제안 창)부터 타석 동안 · 판정 뒤 결과 창을 닫을 때(8e800) 또는 내림(0x21 진입 · 반 이닝 뒤집힘)까지 선다.
 * - 보상 글은 0x8e5b8 의 결과 창 글과 달리 **b10 ≠ 0 을 안 보고** 첫 보상 하나만 쓴다(종류 0 이면 "없음 +0").
 * - 두 글 모두 `!C` 머리라 폭 안 가운데다. 색 −1 은 흰 글.
 * - **정수 붙이기 0xbc73d → 0xbc6c0** (r136 확정): `n < 0` 이면 '-'(0x2d) 를 붙이고 −n 을 다시 붙인다(bc6c6~bc6d2), 아니면
 *   0x6c805(n, 10)(n 을 10 으로 나눠 0 이 될 때까지 센 수 = 자릿수 − 1, 0 이면 0)만큼 위 자리부터 '0' + 자리 를 붙인다.
 *   곧 보통 십진 표기라 음수 보상은 " +" 뒤에 붙어 **"+-2"** 가 된다(원본 그대로) · 0 은 "+0".
 */

/** 타석 캔버스 폭 W (0x14008b8) */
const SCREEN_WIDTH = 240

export const BURST_BAND_FOLDER = assetUrl('./sprites/trainning')
/** trainning 합성 프레임 14 (83×51, 원점 (0, 0)) — 0xba815 의 상자 */
export const BURST_BAND_FRAME_SRC = assetUrl('./sprites/trainning/frames/014.png')
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

/**
 * 아이콘 갈래를 **진행 상태에서** 읽는다 (0x8e8c4~0x8e914) — g = [M+0x22c](= 경기 [0x1552d0c]).
 * g[9] = 공격 측(초 0 · 말 1), g[10] = 수비 측, g[0x31 + 측] == 0 이면 그 측을 사람이 조작한다.
 * 띠가 서는 모드 2(시즌 팀 경기 0x6548 6630) · 3 · 4(0x3a20a)는 사람 측(`playerSide`)만 0, 상대는 1 로 세운다.
 * 공격 측부터 보므로 둘 다 사람이면 방망이, 사람 측이 없으면(`null`) 아이콘이 없다.
 */
export function burstBandRoleOf(half: InningHalf, humanSide: PlayerSide | null): BurstBandRole {
  const attackSide: PlayerSide = half === '초' ? 0 : 1
  const defenseSide: PlayerSide = attackSide === 0 ? 1 : 0
  if (humanSide === attackSide) return '공격'
  if (humanSide === defenseSide) return '수비'
  return null
}

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

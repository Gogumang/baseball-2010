import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { BATTER_SIDE, STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'

/**
 * **타석 화면 루상 주자 0x35b94** (직접 떴다, 0x35b94~0x3605e). 타석 공용 묶음(0x50828 · 0x4cb1c · 0x4d2ac …)이 부른다.
 * ```
 * 35ba4  모드 [+0x1104] == 7 이고 주자 수 0xa9598 == 0 이면 끝
 * 35bd2  (px, py) = 투수 앵커 표 0xcfb18[+0x17e1] 투영 + 카메라 ; y0 = py − 0x2f ; 깊이 = 투수판 z(24500) − 1
 * 35c14  w = game_ui 이미지 22(+0x58) 폭 (34)
 * 루 i = 0..2:
 *   35c36  p = 0xa97a1(주자 관리, i + 1) ; p 없거나 경기 st[0x15 + i] ≠ 0 이면 건너뜀
 *   35c62  애니 i(장면 +0xf24 = defender.pzx, 팔레트 = p+0xac 팀) 한 칸 진행(0x93d91) · 안 돌면 반복으로 켬(0x93cfd(애니, 1))
 *   35c9e  상태 [+0x1c] == 0x13 이면 그리지 않는다(진행만)
 *   i = 0: 이미지 22 를 (W − w − 3, y0 + 7) · 애니 0 을 (W − (w >> 1) − 3, y0 + 7 + 0x18)
 *   i = 1: 애니 1 을 (px − (좌타 ? 0x1b : 5), py − 0x12) 에 **효과 0xc · 인자 0**(검정 실루엣 — 유력)
 *   i = 2: 이미지 22 를 효과 0x11(좌우 뒤집기)로 (3, y0 + 7) · 애니 2 를 ((w >> 1) + 3, y0 + 7 + 0x18)
 *   모두 그리기 목록(+0x234, 0xbe905 · 0xbe8a5)에 깊이 24499 로 넣는다.
 *   35f6e  상태 0xe 면 주자 아래·옆에 game_ui 이미지 0x61 칸(능력 0xb570d / 0x14d + 1 개, 나머지 4 칸까지 효과 0xa)을 더 넣는다 — 웹 미이식.
 * ```
 * 애니는 0x93c45 가 칸의 (dx, dy) 만큼 비켜 그리고, 칸 길이는 max(1, 지연) 그림이다. 원본은 장면에 애니 셋을 들고 그릴 때마다 한 칸씩
 * 돌린다(루에 주자가 있을 때만) — 웹은 타석 화면 틱으로 센다(근사). 경기 st[0x15 + i] 칸은 웹에 없어 늘 0 으로 본다.
 */

/** game_ui 이미지 22 — 1·3루 쪽 작은 창(34×35) */
export const BASE_WINDOW_IMAGE = './sprites/game_ui/022.png'
const BASE_WINDOW_WIDTH = 34
const SCREEN_MARGIN = 3
const WINDOW_RAISE = 0x2f
const WINDOW_DOWN = 7
const RUNNER_BELOW_WINDOW = 0x18
const SECOND_RUNNER_RAISE = 0x12
const SECOND_RUNNER_SHIFT = { left: 0x1b, right: 5 } as const

/** 주자 그림 = defender.pzx 애니 0 · 1 · 2 (주자 칸 프레임 0 · 1 을 흔든다) */
export const RUNNER_FRAMES = './sprites/defender/frames'

export interface BaseRunnerBases {
  readonly first: boolean
  readonly second: boolean
  readonly third: boolean
}

export type BaseRunnerDraw =
  | { readonly kind: 'window'; readonly x: number; readonly y: number; readonly isMirrored: boolean }
  | { readonly kind: 'runner'; readonly animation: number; readonly x: number; readonly y: number; readonly isSilhouette: boolean }

/** 상태 0x13(웹 '타격')은 애니만 돌리고 안 그린다 (35c9e) */
export function showsBaseRunners(phase: StagePhaseSnapshot | undefined): boolean {
  return phase?.kind !== '타격'
}

/** 그리기 목록에 넣는 차례대로 — 1루 창 · 1루 주자 · 2루 주자 · 3루 창 · 3루 주자 */
export function baseRunnerDrawsOf(bases: BaseRunnerBases, side: number): BaseRunnerDraw[] {
  const { pitcherAnchor } = stageLayoutOf(side)
  const windowY = pitcherAnchor.y - WINDOW_RAISE + WINDOW_DOWN
  const runnerY = windowY + RUNNER_BELOW_WINDOW
  const draws: BaseRunnerDraw[] = []
  if (bases.first) {
    draws.push({ kind: 'window', x: STAGE_WIDTH - BASE_WINDOW_WIDTH - SCREEN_MARGIN, y: windowY, isMirrored: false })
    draws.push({ kind: 'runner', animation: 0, x: STAGE_WIDTH - (BASE_WINDOW_WIDTH >> 1) - SCREEN_MARGIN, y: runnerY, isSilhouette: false })
  }
  if (bases.second) {
    const shift = side === BATTER_SIDE.우타 ? SECOND_RUNNER_SHIFT.right : SECOND_RUNNER_SHIFT.left
    draws.push({ kind: 'runner', animation: 1, x: pitcherAnchor.x - shift, y: pitcherAnchor.y - SECOND_RUNNER_RAISE, isSilhouette: true })
  }
  if (bases.third) {
    draws.push({ kind: 'window', x: SCREEN_MARGIN, y: windowY, isMirrored: true })
    draws.push({ kind: 'runner', animation: 2, x: (BASE_WINDOW_WIDTH >> 1) + SCREEN_MARGIN, y: runnerY, isSilhouette: false })
  }
  return draws
}

/** 반복 애니의 지금 칸 — 칸 길이 max(1, 지연) 그림 (0x93d90). 표가 비면 null */
export function loopingAnimationStepAt(
  entries: readonly StageAnimationEntry[],
  tick: number,
): { readonly frame: number; readonly dx: number; readonly dy: number } | null {
  if (entries.length === 0) return null
  const total = entries.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)
  let remaining = ((Math.trunc(tick) % total) + total) % total
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return { frame: entry.frame, dx: entry.dx ?? 0, dy: entry.dy ?? 0 }
    remaining -= length
  }
  return null
}

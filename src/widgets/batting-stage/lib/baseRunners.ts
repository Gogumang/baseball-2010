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
 *   35f6e  상태 0xe 면 주자 곁에 주루 칸(game_ui 이미지 0x61) 넷을 더 넣는다 — `runPipDrawsOf`
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

/**
 * **상태 0xe 주루 칸** — 0x35b94 의 35f4e~3604c (직접 떴다). 루마다 주자 애니를 그린 뒤 그 애니의 지금 칸 상자를
 * 0x93e7d(애니, x, y, 상자, 0, 0) 로 얻는다 — (x + dx + 원점x, y + dy + 원점y, 그림 w, h). 상자를 잡는 점은 그리는 점과 조금 다르다:
 * ```
 * 1루 35d80: (W − (w >> 1) − 3, y0 + 0x18)      ; 그리기는 y0 + 7 + 0x18 — 상자는 7 위 (원본 그대로)
 * 2루 35e24: (px − (좌타 ? 0x1b : 5), py − 0x15)  ; 그리기는 py − 0x12
 * 3루 35f38: ((w >> 1) + 3, y0 + 0x18)
 * 35f52  x0 = 상자x − ((0x16 − 상자w) >> 1) ; y = 상자y + 상자h + 8   (2루는 35e4e y = 상자y − 2 — 머리 위)
 * 35f6e  상태 [+0x1c] ≠ 0xe 면 끝
 * 35f74  n = 0xb570d(ctx, 3, 주자 선수, 1, 90, 1) / 0x14d + 1     ; 경기용 칸 3(주력) · 체력 인자 90 → 0..999 면 1..4
 * 35fca  k = 0..n−1: 0xbe905(…, x0 + 6k, y, game_ui, 이미지 0x61, 효과 0)
 * 36004  n ≤ 3 이면 k = n..3: 같은 그림을 **효과 0xa**(인자 0) 로
 * ```
 * 효과 0xa 는 팔레트 픽셀 함수 0x97f01(등록 0x3098)로 **회색**이다: s = R5 + G(위 5비트) + B5 + 3, g = s/4 + s/16 + s/64,
 * 565 = g<<11 | g<<6 | g (0xbb91d 의 종류 4 와 같은 식) — `grayRunPipPixel`.
 */
export const RUN_PIP_IMAGE = './sprites/game_ui/097.png'
const RUN_PIP_SLOTS = 4
const RUN_PIP_STEP = 6
const RUN_ABILITY_PER_PIP = 0x14d
const RUN_PIP_ROW_WIDTH = 0x16
const RUN_PIP_BELOW = 8
const RUN_PIP_ABOVE_SECOND = 2
const SECOND_RUNNER_BOX_RAISE = 0x15

export type BaseKey = 'first' | 'second' | 'third'

export interface RunPipDraw {
  readonly x: number
  readonly y: number
  /** 효과 0xa(회색)로 그리는 빈 칸 */
  readonly isEmpty: boolean
}

/** 주자 애니 상자를 잡는 점 (위 표) — 그리는 점(`baseRunnerDrawsOf`)과 다르다 */
export function runnerBoxAnchorOf(base: BaseKey, side: number): { readonly x: number; readonly y: number } {
  const { pitcherAnchor } = stageLayoutOf(side)
  const boxY = pitcherAnchor.y - WINDOW_RAISE + RUNNER_BELOW_WINDOW
  if (base === 'first') return { x: STAGE_WIDTH - (BASE_WINDOW_WIDTH >> 1) - SCREEN_MARGIN, y: boxY }
  if (base === 'third') return { x: (BASE_WINDOW_WIDTH >> 1) + SCREEN_MARGIN, y: boxY }
  const shift = side === BATTER_SIDE.우타 ? SECOND_RUNNER_SHIFT.right : SECOND_RUNNER_SHIFT.left
  return { x: pitcherAnchor.x - shift, y: pitcherAnchor.y - SECOND_RUNNER_BOX_RAISE }
}

/** 켜진 칸 수 n = 경기용 주력 / 0x14d + 1 (0xca7b5 나눗셈 — 0 쪽으로 자름) */
export function runPipCountOf(runAbility: number): number {
  return Math.trunc(runAbility / RUN_ABILITY_PER_PIP) + 1
}

/** 주루 칸 넷의 자리 — `box` 는 주자 애니 지금 칸의 상자(0x93e7d) */
export function runPipDrawsOf(
  base: BaseKey,
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  runAbility: number,
): RunPipDraw[] {
  const x0 = box.x - ((RUN_PIP_ROW_WIDTH - box.width) >> 1)
  const y = base === 'second' ? box.y - RUN_PIP_ABOVE_SECOND : box.y + box.height + RUN_PIP_BELOW
  const lit = runPipCountOf(runAbility)
  const draws: RunPipDraw[] = []
  for (let index = 0; index < lit; index += 1) draws.push({ x: x0 + RUN_PIP_STEP * index, y, isEmpty: false })
  // 36006: n > 3 이면 빈 칸 고리를 건너뛴다. 빈 칸은 x0 + 6n 부터 4 − n 개
  if (lit <= RUN_PIP_SLOTS - 1) {
    for (let index = lit; index < RUN_PIP_SLOTS; index += 1) {
      draws.push({ x: x0 + RUN_PIP_STEP * index, y, isEmpty: true })
    }
  }
  return draws
}

/** 효과 0xa 한 픽셀 (0x97f01) — 8비트 RGB 를 565 로 보고 회색 g(5비트)를 내 다시 8비트로 편다 */
export function grayRunPipPixel(red: number, green: number, blue: number): { r: number; g: number; b: number } {
  const sum = (red >> 3) + (green >> 3) + (blue >> 3) + 3
  const gray = (sum >> 2) + (sum >> 4) + (sum >> 6)
  const five = gray & 0x1f
  const six = (gray << 1) & 0x3f
  return { r: (five << 3) | (five >> 2), g: (six << 2) | (six >> 4), b: (five << 3) | (five >> 2) }
}


import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { BATTER_SIDE, STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { grayPixel565, halfMixPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import { rgbOf565, rgbTo565 } from '@/shared/lib/screen565/screen565'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * **타석 화면 루상 주자 0x35b94** (직접 떴다, 0x35b94~0x3605e). 타석 공용 묶음(0x50828 · 0x4cb1c · 0x4d2ac …)이 부른다.
 * ```
 * 35ba4  모드 [+0x1104] == 7 이고 주자 수 0xa9598 == 0 이면 끝
 * 35bd2  (px, py) = 투수 앵커 표 0xcfb18[+0x17e1] 투영 + 카메라 ; y0 = py − 0x2f ; 깊이 = 투수판 z(24500) − 1
 * 35c14  w = game_ui 이미지 22(+0x58) 폭 (34)
 * 루 i = 0..2:
 *   35c36  p = 0xa97a1(주자 관리, i + 1) ; p 없거나 경기 st[0x15 + i] ≠ 0 이면 건너뜀(진행도 안 한다)
 *          st[0x14 + 루] = 이번 공에 **도루를 출발한 주자** 표시 — 0xa9bd4(a9c30, 사람 키 0x583 · CPU 0x520de 의 52208)가 세우고
 *          0xf 진입 0x3d954(3d966~3d976, st[0x14..0x17] 넷)와 0xd · 0xf 의 0x35650 → 0xb68bc(st[0x14..0x16])가 지운다 → 공이 나는
 *          동안 뛰기 시작한 주자는 루에 안 그린다 (`HudState.hiddenRunnerBases`)
 *   35c62  애니 i = 0x79e3d(장면 +0xf24 수비수 그림 묶음, i, 마선수 주자(p+0x9c ≠ −1)면 +0x1c 마선수 묶음 · 아니면 +0xc defender.pzx)
 *          를 한 칸 진행(0x93d91) 한 **뒤** 0x93cfd(애니, 1) 로 반복을 켠다(이미 돌면 아무것도 안 한다)
 *   35c9e  상태 [+0x1c] == 0x13 이면 그리지 않는다(진행만)
 *   i = 0: 이미지 22 를 (W − w − 3, y0 + 7) · 애니 0 을 (W − (w >> 1) − 3, y0 + 7 + 0x18)
 *   i = 1: 애니 1 을 (px − (좌타 ? 0x1b : 5), py − 0x12) 에 **효과 0xc · 인자 0** — 반쯤 어둡게(`halfShadeRunnerPixel`)
 *   i = 2: 이미지 22 를 효과 0x11(좌우 뒤집기)로 (3, y0 + 7) · 애니 2 를 ((w >> 1) + 3, y0 + 7 + 0x18)
 *   모두 그리기 목록(+0x234, 0xbe905 · 0xbe8a5)에 깊이 24499 로 넣는다.
 *   35f6e  상태 0xe 면 주자 곁에 주루 칸(game_ui 이미지 0x61) 넷을 더 넣는다 — `runPipDrawsOf`
 * ```
 * 애니는 0x93c45 가 칸의 (dx, dy) 만큼 비켜 그리고, 칸 길이는 max(1, 지연) 그림이다. **애니 시계**(`RunnerAnimationClock`)는 경기 장면
 * 수명이다: defender.pzx 묶음(장면 +0x1068)은 상태 8 의 0x48658(48958 0xbbd0d)이 한 번 싣고 장면 해제 0x332b8(3399a)만 버린다 —
 * 타석 교대 0x47cc8 은 +0xf24 에 같은 묶음을 다시 걸 뿐(0x79cb5)이라 애니 객체가 그대로다. 애니 0~2 를 꺼내는 0x79e3d 는 0x35b94
 * 하나만 부르고 반복으로 켠 애니는 0x93d90 이 멈추지 않는다 → 루 i 의 애니는 **그 루에 (숨김 없이) 주자가 선 채 0x35b94 가 불린
 * 그림 수**만큼 한 칸씩 나아가고 장면이 끝날 때까지 되감기지 않는다(주자가 바뀌어도, 타석 · 이닝을 건너도 이어진다). 첫 부름은 진행(0x93d90:
 * 안 도는 애니는 그대로)이 아무것도 안 하고 켜기(0x93cfd: 칸 틱 [1] = 0, 칸 [0] 은 그대로)만 해 첫 칸 0 을 그린다.
 * 마선수 주자(p+0x9c ≠ −1)는 0x79e3d · 그리기 0x79da9 가 묶음 +0x1c 의 같은 애니 i 를 **팔레트 없이** 그린다 — +0x1c 는 타석 교대
 * 0x483a0 이 실은 한 장뿐이라(타자 마선수 우선, 아니면 가장 앞선 마선수 주자 — `loadedRunnerAceOf`) 다른 마선수 주자도 그 그림이다
 * (원본 그대로). `aceRunnerFramesOf`.
 * ⚠️ 근사: +0x1c 묶음의 애니 객체는 defender 묶음과 따로라 진행 수가 다를 수 있다 — 같은 루 시계를 쓴다(남김 — +0x1c 는 타석 교대
 * 0x79cbd 가 0xbbded(이름, −1, −1) → 0xb9718 로 새로 싣는데(79ce8, r184 직접 떴다) 그 적재기가 애니 객체를 새로 짓는지 이어 주는지는
 * 단말 자원 관리 몫이라 정할 수 없고, 웹 루 시계는 타석 교대 순간을 모른다. 마선수 주자 그림의 칸만 다를 수 있다).
 */

/** game_ui 이미지 22 — 1·3루 쪽 작은 창(34×35) */
export const BASE_WINDOW_IMAGE = assetUrl('./sprites/game_ui/022.png')
const BASE_WINDOW_WIDTH = 34
const SCREEN_MARGIN = 3
const WINDOW_RAISE = 0x2f
const WINDOW_DOWN = 7
const RUNNER_BELOW_WINDOW = 0x18
const SECOND_RUNNER_RAISE = 0x12
const SECOND_RUNNER_SHIFT = { left: 0x1b, right: 5 } as const

/** 주자 그림 = defender.pzx 애니 0 · 1 · 2 (주자 칸 프레임 0 · 1 을 흔든다) */
export const RUNNER_FRAMES = assetUrl('./sprites/defender/frames')

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

/**
 * **루상 주자 애니 시계** — 장면 +0xf24 묶음의 애니 0 · 1 · 2 가 0x35b94 에서 불린 수(`calls`, 루 1 · 2 · 3). 경기 장면 하나 동안
 * 남는다 — 부르는 쪽이 장면 수명의 칸(`useSceneScopedRef`)으로 넘기면 타석 화면이 다시 서도 이어진다.
 */
export interface RunnerAnimationClock {
  readonly calls: [number, number, number]
}

export function createRunnerAnimationClock(): RunnerAnimationClock {
  return { calls: [0, 0, 0] }
}

/**
 * 0x35b94 를 `frames` 번 더 불렀다 — 루에 주자가 있고 숨김(st[0x15 + i])이 아닌 루의 애니만 한 칸씩 나아간다.
 * 돌려주는 값은 루마다 **지금 그릴 진행 수**(첫 부름은 0 — 진행이 켜기보다 앞이다), 안 그리는 루는 null.
 */
export function stepRunnerAnimationClock(
  clock: RunnerAnimationClock,
  bases: BaseRunnerBases,
  hiddenBases: readonly number[],
  frames: number,
): readonly [number | null, number | null, number | null] {
  const steps: (number | null)[] = [null, null, null]
  const occupied = [bases.first, bases.second, bases.third]
  for (let index = 0; index < 3; index += 1) {
    if (occupied[index] !== true || hiddenBases.includes(index + 1)) continue
    clock.calls[index] = (clock.calls[index] ?? 0) + Math.max(0, frames)
    steps[index] = Math.max(0, (clock.calls[index] ?? 0) - 1)
  }
  return [steps[0] ?? null, steps[1] ?? null, steps[2] ?? null]
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
export const RUN_PIP_IMAGE = assetUrl('./sprites/game_ui/097.png')
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

/**
 * **효과 0xc 한 픽셀** — 팔레트 픽셀 함수 0x98351(등록 0x30b2~0x30c0: `0x985ed(0xc, 0x9af71)` · `0x9869d(0xc, 0x98351, 0x983d1)`, 직접 떴다):
 * ```
 * 98394  c = 팔레트[칸]                          ; 565
 * 9839e  out = ((c & 0xf7de) >> 1) + ((인자 & 0xf7de) >> 1)   ; 채널마다 아랫 비트를 떼고 반씩 — 인자 색과 반반 섞기
 * ```
 * 2루 주자는 인자 0 이라 **채널마다 반(내림)** — 검정 실루엣이 아니라 반쯤 어두운 그림이다. 8비트 RGB 를 565 로 보고 섞어 다시 편다.
 * **인자 0 은 색 자리다 — 확정** (2026-10-14 직접 뜸): 0x35de6~0x35df4 가 0x79da9(묶음, 마선수, 애니 1, 목록, x, y, 깊이, **0xc**, **0**, 0, 팔레트)
 * 를 부르고, 0x79da8(79dc8~79de8)이 효과 · 인자를 0xbe8a5 의 [sp+8] · [sp+0xc] 로 넘겨 0xbe810 이 그리기 칸 +0x18(효과) · **+0x1c** 에 적는다.
 * 레이저 반짝임 0x43406~0x4342c 도 0x79b48 → 0xbe8d5 의 같은 [sp+8] · [sp+0xc] 에 효과 12 · 색 RGB(255, 0, 0)(0x1400748 이 만든 565)을 넣어
 * 같은 칸 +0x1c 로 간다 — 그 칸이 픽셀 함수의 색이므로 2루 주자는 색 0(검정)과 반반 = 반 밝기 그림이다.
 */
export function halfShadeRunnerPixel(
  red: number,
  green: number,
  blue: number,
  argument = 0,
): { r: number; g: number; b: number } {
  const [r, g, b] = rgbOf565(halfMixPixel565(rgbTo565(red, green, blue), argument))
  return { r, g, b }
}

/** 효과 0xa 한 픽셀 (0x97f01) — 8비트 RGB 를 565 로 보고 회색 g(5비트)를 내 다시 8비트로 편다 (공용 `grayPixel565`) */
export function grayRunPipPixel(red: number, green: number, blue: number): { r: number; g: number; b: number } {
  const [r, g, b] = rgbOf565(grayPixel565(rgbTo565(red, green, blue)))
  return { r, g, b }
}

/** ace/defender_* — 표 0xd3f0c[번호](0x79cbc, 20바이트 간격): medica · kao · roze · death · tiger */
const ACE_RUNNER_FRAMES: readonly string[] = [
  assetUrl('./sprites/defender_medica/frames'),
  assetUrl('./sprites/defender_kao/frames'),
  assetUrl('./sprites/defender_roze/frames'),
  assetUrl('./sprites/defender_death/frames'),
  assetUrl('./sprites/defender_tiger/frames'),
]

/**
 * 루 주자 그림 폴더 · 팔레트 — 마선수 주자면 실린 마선수 그림(+0x1c, 팔레트 없음), 아니면 defender(+0xc, 팀 팔레트).
 * `loadedAce` 는 타석 교대 0x483a0 이 실은 번호(`loadedRunnerAceOf`), `isAceRunner` 는 그 루 주자의 +0x9c ≠ −1.
 * 실린 그림이 없으면(웹 재료가 비면) 예전처럼 defender 로 그린다.
 */
export function aceRunnerFramesOf(isAceRunner: boolean, loadedAce: number | null): string | null {
  if (!isAceRunner || loadedAce === null) return null
  return ACE_RUNNER_FRAMES[loadedAce] ?? null
}

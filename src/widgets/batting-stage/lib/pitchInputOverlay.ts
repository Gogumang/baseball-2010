import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { noteAssetLoaded } from '@/shared/lib/sprite/assetLoadVersion'
import { fetchSpriteJson } from '@/shared/lib/sprite/spriteJsonBundle'
import { projectToScreen } from '@/entities/pitching/model/pitchCurve'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { drawFrameAt, frameAnimations, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { STAGE_HEIGHT, STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { DRAW_EFFECT, drawImageWithEffect } from '@/shared/lib/pixelEffect/pixelEffect'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * **사람 투구 UI — 장면 위 그림** (구질 목록 0xf · 조준 0x10 · 게이지 0x11). 2026-10-09 직접 떴다.
 *
 * 원본은 이 셋을 장면 그리기 안에서 그린다 — 웹 화면 아래 패널(`PitchSlotPicker` · `AimCursor` · `PitchGradeGauge`)은 키 · 틱을
 * 맡고, 지금 그림 재료를 `PitchInputOverlay` 로 장면(`PitcherSideStage`)에 넘긴다. 그림은 모두 `ui/slt_pitch.pzx`([+0x1010]).
 *
 * ── 0xf 구질 목록 — 타석 공용 그리기 0x4c4bc 의 4c528~4c8de ──────────────────────────────────────────────
 * ```
 * 4c528  상태 == 0xf ∧ 0x33fe4(수비 조작 사람) → 아래. 아니면 존 0x35ae8 (곧 사람이 던지는 0xf 는 존 대신 목록)
 * 4c570  (x0, y0) = 투수 앵커 0xcfb18[+0x17e1] 투영 + 카메라 (= stageLayout.pitcherAnchor)
 * 4c5a6  빛 지도 [+0x1108](ui/slt_pitch.raw 30×30, 0x3ed16 이 싣고 +0x1c = 16):
 *        0x9cb89 = 반 해상도 판을 15 로 채움 · 0x9cba9(x0, y0 − 20) = 원 도장(값 31) ·
 *        0x9ce71 → 0x9cd14 = 화면 점마다 RGB565 각 성분 × 값 / 32 (판 한 칸이 화면 2×2)
 *        → 화면 전체가 15/32 로 어두워지고 투수 둘레 지름 60 원만 31/32 로 밝다
 * 4c5d4  [+0x1074](0xf 진입 0x3d954 가 0x16) ≤ 0x19 이면:
 *          칸 i = 1..4 의 바이트 [+0x1078 + i](진입이 구질 있는 칸만 0x26 + 4(i − 1), 없으면 0) > 0 → 프레임 [바이트] 를 (x0, y0) 에,
 *          [+0x1074] ≤ 0x18 이면 바이트 + 1 ; 그 뒤 프레임 [+0x1074] 를 (x0, y0) 에
 *        [+0x1074] ≤ 0x18 이면 + 1 하고 끝 — 곧 진입 뒤 그림 0 · 1 · 2 는 고리 22 · 23 · 24 와 칸 틀만, 그림 3 부터 고리 25 위에 칸
 * 4c684  칸 i = 1..5 (구질 [+0xfac + 4i]):
 *          구질 == 22(마구): 남은 마구 0xaea11 > 0 일 때만 애니 5 를 (x0, y0) 에, num.pzx 그림 [남은] 을 (x0 + 0x34, y0 + 0x16) 에
 *          구질 ≠ 0: 그림(이미지) 표 0xcfd37[구질] 을 (x0, y0) + 프레임 25 상자 [i − 1] 의 (x, y) 에,
 *                    이름 프레임 (구질 − 1) 을 상자 [i + 3] 의 y 에 — i 1 · 3 은 상자 x 에서 왼쪽 맞춤, 2 · 4 는 상자 오른쪽 끝에 오른쪽 맞춤
 * 4c7d4  반짝임 [+0x1078] == 0 ∧ (상태 틱 == 4 ∨ (틱 ≠ 0 ∧ 틱 mod 70 == 0)) → 켬 · 애니 2 를 첫 칸 · 반복 없이,
 *        켜져 있으면 애니 2 를 (x0, y0) 에 그리고 한 칸 진행, 끝 칸이면 끔 (칸 0 은 0xf 진입 · 0x3e8d6 이 0)
 * ```
 * 칸 0(OK) 은 그리지 않는다 — 고리 프레임 25 에 "OK" 가 그려져 있다.
 *
 * ── 0x10 조준 — 상태 그리기 0x4d780 ──────────────────────────────────────────────────────────────────
 * ```
 * 4d7a0  경로 [+0x1140] = 조준점 [+0x10b8] ; 공 틱 = 0 → 0x35854 = 조준점의 화면 점(투영 0xbe3d8 — `projectToScreen`)
 * 4d7da  애니 0(진입 0x3d954 가 첫 칸 · 반복으로 건다) 을 그 점에, 한 칸 진행
 * 4d824  구질 1..21: 이름 프레임 (구질 − 1) — x = 존.x + (존.w − 폭) >> 1, y6 = 존.y − 높이 (존 = 0xcfb7c[+0x17e1] + 카메라)
 *        0x6a9f1(x − 5, y6 − 5, 폭 + 10, 높이 + 2, 0x28000000) 반투명 검정 판 → 이름을 (x, y6 − 4) 에
 * 4d8fc  구질 == 22(마구): 0x15605d4(0, 0, W, H, 5) — 화면 덮개 단계 5
 * ```
 * 판 · 덮개는 바로 그리고 애니 · 이름은 그리기 목록(0xbe8a5 · 0xbe8d5)에 넣어 0xbe6a1 이 투수 · 타자와 함께 그린다 —
 * 곧 판 · 덮개는 선수 **아래**, 애니 · 이름은 선수 **위**(목록 깊이 [0xcfa8c + 0x14] 는 앞쪽).
 *
 * ── 0x11 게이지 — 상태 그리기 0x4d2ac ──────────────────────────────────────────────────────────────────
 * ```
 * 4d2dc  (x, y) = 조준점의 화면 점 (투수 앵커 + [+0x218] 투영 → 0xb94b5 + 카메라 — `projectToScreen` 과 같은 점)
 * 4d360  모드 ≠ 7 이고 (사람 공격 아님 ∧ 설정 +0x2d(게이지) == 0) 이면 프레임 0x23(35) 을 그 점에 (CPU 투구 난이도 +0x2c 가 기본 2 일 때)
 * 4d3f6  0x3f500(게이지 켬 ∧ 구질 ≠ 22) ∧ 0x33fe4 → 게이지 (`pitchGaugeSprite` 의 규칙):
 *        t == 0: 커서 ≤ 8 이면 0 → 0x3a, 아니면 0x3b 위 min(0x3b + 커서, 0x43) ; 커서 > 8 → 0x3a
 *        t > 0: min(0x3b + 커서, 0x43)(효과 1 · 인자 8) · 애니 1 이 안 끝났으면 min(0x3b + 누른 칸, 0x43) · 애니 1 · t == 5 면 game_effect 애니 0,
 *               애니 1 이 끝났으면 [+0x17c4] ≤ 3 동안 결과 원을 효과 1 · 인자 15 − 3·틱 으로(흐려짐)
 * ```
 * 게이지의 t > 0 덧그림(효과 1 · 인자 8 멈춘 커서 · 애니 1 · t == 5 game_effect 애니 0 · 흐려지는 결과 원)은 `gaugeDrawsOf`.
 * 애니 · 이름 · 게이지의 깊이는 [0xcfa8c + 0x14] = 29705 로 타자(0xd3a70[5] = 29705)와 같아 넣은 차례로 타자 · 투수(24500) 다음이다(r184).
 * 공(0x3b2f4 3b6de)의 깊이 [sp+0x88] 은 경로 점의 월드 z 라(r271 직접 떴다) `renderBattingStage` 의 그리기 목록이 공과의 앞뒤를 가른다 —
 * 공이 타자 깊이에 못 미치면 이 그림들 밑, 닿으면(z = 29705) 넣은 차례가 뒤라 위다.
 */

/** 0xf — 구질 목록 */
export interface PitchMenuOverlay {
  readonly kind: '구질'
  /** 칸 0..5 의 구질 번호 (경기 +0xfac + 4·칸, 0 = 빈 칸) */
  readonly typeNumbers: readonly number[]
  /** 남은 마구 (0xaea11) */
  readonly magicRemaining: number
  /** 0xf 에 든 뒤 그림 수 (상태 틱) */
  readonly tick: number
  /**
   * 빈 칸(구질 0) 키를 누른 차례 표지 — 0x50de8 이 투수 그림 객체(+0xf98)에 0x9dff8(…, 2)를 건다(대기 동작 한 바퀴).
   * 누를 때마다 새 값(0 은 안 누름)이라 장면이 바뀐 것을 보고 그 틱부터 대기 동작을 다시 센다. 안 주면 안 누름
   */
  readonly pitcherIdlePress?: number
}

/** 0x10 — 조준 */
export interface PitchAimOverlay {
  readonly kind: '조준'
  readonly aim: WorldPoint
  /** 투영 원점 칸 (진행기 `stageSide`) */
  readonly aimSide: number
  readonly typeNumber: number
  /** 0x10 에 든 뒤 그림 수 — 애니 0 은 0xf 진입 0x3d954 가 되감고 0x10 그림마다 한 칸 나간다 */
  readonly tick: number
}

/** 0x11 — 게이지 */
export interface PitchGaugeOverlay {
  readonly kind: '게이지'
  readonly aim: WorldPoint
  readonly aimSide: number
  /** 0x3f500 — 게이지 켬 ∧ 마구 아님 */
  readonly showsGauge: boolean
  /** 환경설정 게이지(+0x2d) — 꺼져 있으면 목표점에 프레임 35 */
  readonly gaugeSettingOn: boolean
  /**
   * 목표 표시 프레임 0x23 을 넣는가 — 부르는 쪽이 `showsGaugeTargetFrameOf`(0x4d360) 로 낸 값. 안 주면 예전처럼 게이지 설정이 꺼졌을 때
   */
  readonly showsTargetFrame?: boolean
  /** 커서 +0x17bc */
  readonly cursor: number
  /** 누른 칸 +0x17c8 (0 = 아직) */
  readonly pressed: number
  /** 칸을 정한 뒤 그림 수 */
  readonly decidedTicks: number
  /**
   * 고른 구질이 마구(22)인가 — [경기+0xfc8] 은 0xf 가 적고 0x10 OK(0x50e9c 50ea6~50eaa)가 그 값으로 남은 마구를 줄인 뒤 0x11 을
   * 예약한다. 그래서 0x11 그리기의 공 그림 0x3b2f4(3b4dc~3b4e4)는 놓기(틱 10) 전 와인드업 그림부터 마구 파티클을 쏜다(Q-09). 안 주면 거짓
   */
  readonly isMagicPitch?: boolean
  /**
   * 0x11 상태 틱 [+0x2c] — 게이지가 장면 틱 머리마다 올리는 칸(아직 안 셌으면 −1, 틱 10 에 놓는다). 장면이 놓기 전 그림(틱 0~9)을
   * 셀 때 읽는다(`PitcherSideStage`). 그림 재료가 아니라 칸이라 다시 그리지 않아도 지금 값이다
   */
  readonly stateTickRef?: { readonly current: number }
}

export type PitchInputOverlay = PitchMenuOverlay | PitchAimOverlay | PitchGaugeOverlay

const SLT_FRAMES = assetUrl('./sprites/slt_pitch/frames')
const SLT_IMAGE = (index: number) => assetUrl(`./sprites/slt_pitch/${String(index).padStart(3, '0')}.png`)
const NUM_IMAGE = (index: number) => assetUrl(`./sprites/num/${String(index).padStart(3, '0')}.png`)
const GAME_EFFECT_FRAMES = assetUrl('./sprites/game_effect/frames')

export const MAGIC_TYPE_NUMBER = 22

/* ── 0xf ── */

/** 빛 지도 — 바탕 15 · 원 31 (0x3ed28 +0x1c = 16 → 0x9cb88 이 16 − 1 로 채운다) */
const LIGHT_BASE = 15
const LIGHT_SPOT = 31
const LIGHT_SCALE = 32
/** 원 도장 중심은 투수 앵커에서 20 위 (4c5b8 `subs r2, #0x14`) */
export const SPOTLIGHT_RAISE = 20
/** ui/slt_pitch.raw 30×30 의 줄마다 [시작, 끝) — 값 31 인 칸 */
const SPOT_MASK_SPANS: readonly (readonly [number, number])[] = [
  [11, 19],
  [8, 22],
  [7, 23],
  [5, 25],
  [4, 26],
  [3, 27],
  [3, 27],
  [2, 28],
  [1, 29],
  [1, 29],
  [1, 29],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [0, 30],
  [1, 29],
  [1, 29],
  [1, 29],
  [2, 28],
  [3, 27],
  [3, 27],
  [4, 26],
  [5, 25],
  [7, 23],
  [8, 22],
  [11, 19],
]
const SPOT_MASK_SIZE = 30

/** 빛 지도 한 칸 (반 해상도) 의 밝기 — 화면 점 (x, y) 가 든 칸. 원 도장 왼쪽 위 = ((x0 >> 1) − 15, ((y0 − 20) >> 1) − 15) */
export function spotlightLevelAt(cellX: number, cellY: number, anchor: { readonly x: number; readonly y: number }): number {
  const left = (anchor.x >> 1) - (SPOT_MASK_SIZE >> 1)
  const top = ((anchor.y - SPOTLIGHT_RAISE) >> 1) - (SPOT_MASK_SIZE >> 1)
  const span = SPOT_MASK_SPANS[cellY - top]
  if (span === undefined) return LIGHT_BASE
  const column = cellX - left
  return column >= span[0] && column < span[1] ? LIGHT_SPOT : LIGHT_BASE
}

/** 고리 프레임 — 진입 0x16 에서 그림마다 +1, 0x19 에 멈춘다 */
const RING_FIRST_FRAME = 0x16
const RING_LAST_FRAME = 0x19
/** 칸 틀 첫 프레임 0x26 + 4(칸 − 1) */
const SLOT_FRAME_BASE = 0x26
const SLOT_FRAME_STEP = 4
/** 구질 → 머리글자 그림 (표 0xcfd37, s8) */
const TYPE_ICON_IMAGES: readonly number[] = [15, 12, 22, 23, 24, 24, 24, 26, 33, 26, 26, 21, 24, 24, 24, 26, 24, 26, 34, 24, 24, 25]
/** 마구 판 애니 5 · 남은 수 (x0 + 0x34, y0 + 0x16) */
const MAGIC_BADGE_ANIMATION = 5
const MAGIC_COUNT_OFFSET = { x: 0x34, y: 0x16 } as const
/** 반짝임 애니 2 — 틱 4 · 70 의 배수에서 */
const SHINE_ANIMATION = 2
const SHINE_FIRST_TICK = 4
const SHINE_PERIOD = 70
/** 고리 프레임 25 의 상자 (0x94a65) — 0..3 머리글자, 4..7 이름 */
const RING_BOX_FRAME = RING_LAST_FRAME

export interface PitchMenuFrame {
  /** 고리 프레임 */
  readonly ring: number
  /** 칸 1..4 의 틀 프레임 (구질이 없는 칸은 null) */
  readonly slotFrames: readonly (number | null)[]
  /** 머리글자 · 이름을 그리는가 (그림 3 부터) */
  readonly showsSlots: boolean
}

/** 0xf 에 든 뒤 그림 k 의 고리 · 칸 틀 (4c5d4~4c66a) */
export function pitchMenuFrameOf(tick: number, typeNumbers: readonly number[]): PitchMenuFrame {
  const steps = Math.min(Math.max(0, tick), RING_LAST_FRAME - RING_FIRST_FRAME)
  const slotFrames = [1, 2, 3, 4].map((slot) => ((typeNumbers[slot] ?? 0) === 0 ? null : SLOT_FRAME_BASE + SLOT_FRAME_STEP * (slot - 1) + steps))
  return { ring: RING_FIRST_FRAME + steps, slotFrames, showsSlots: tick >= RING_LAST_FRAME - RING_FIRST_FRAME }
}

/** 반짝임 애니 2 의 칸 번호(0..) — 안 그리면 null. 켜는 검사는 칸을 그리는 그림(틱 ≥ 3)에서만 돈다 */
export function pitchMenuShineStepOf(tick: number, length: number): number | null {
  const start = tick >= SHINE_PERIOD ? Math.floor(tick / SHINE_PERIOD) * SHINE_PERIOD : SHINE_FIRST_TICK
  const step = tick - start
  return step >= 0 && step < length ? step : null
}

/** 칸 i(1..4) 의 이름 프레임 왼쪽 위 x — 1 · 3 왼쪽 맞춤, 2 · 4 오른쪽 맞춤 (4c772~4c7ae) */
export function pitchMenuLabelX(slot: number, anchorX: number, box: readonly number[], labelWidth: number): number {
  if (slot === 2 || slot === 4) return anchorX + box[0] + box[2] - labelWidth
  if (slot === 1 || slot === 3) return anchorX + box[0]
  return anchorX
}

/* ── 공용 ── */

const boxesCache = new Map<string, Readonly<Record<string, readonly (readonly number[])[]>> | null>()
function frameBoxes(folder: string): Readonly<Record<string, readonly (readonly number[])[]>> | null {
  const cached = boxesCache.get(folder)
  if (cached !== undefined) return cached
  boxesCache.set(folder, null)
  // 스프라이트 JSON 묶음에서 꺼낸다(없으면 낱개 파일) — 못 받으면 예전처럼 null (r311 A5)
  void (fetchSpriteJson(`${folder}/boxes.json`) as Promise<Readonly<Record<string, readonly (readonly number[])[]>>>)
    .catch(() => null)
    .then((data) => {
      boxesCache.set(folder, data)
      noteAssetLoaded()
    })
    .catch(() => boxesCache.set(folder, null))
  return null
}

/**
 * 효과 0 으로 그리는 칸 — 고리(slt_pitch 애니 1 · 4d602 0xbe8a5 효과 r5 = 0)와 퍼펙트(game_effect 애니 0 · 4d624 효과 0)의
 * 0x67 파트는 화면에 더한다(0xc9f98 ca198 · `drawFrameAt`)
 */
function drawFrame(context: CanvasRenderingContext2D, folder: string, index: number, x: number, y: number): void {
  drawFrameAt(context, folder, index, Math.round(x), Math.round(y))
}

/** 반복 없는 애니의 칸 — 끝 칸에 멈춘다 */
function onceStepAt(entries: readonly StageAnimationEntry[], update: number): StageAnimationEntry | null {
  let remaining = Math.max(0, update)
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry
    remaining -= length
  }
  return entries[entries.length - 1] ?? null
}

function onceLength(entries: readonly StageAnimationEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)
}

/* ── 그리기 ── */

/**
 * 선수 **아래** — 0x10 의 바로 그리는 것: 마구면 화면 덮개 단계 5, 이름 뒤 반투명 판.
 * 덮개 [0x15605d4] = 0x9b234 는 검정 덮기로 화면을 **단계/16 남긴다**(CORRECTIONS 3절 — 색 덮기 [0x15605d0] = 0x9b3f4 의
 * (단계 + 1)/16 과 다른 몸통) → 단계 5 는 화면 5/16 · 검정 11/16.
 */
export function drawPitchInputUnderlay(context: CanvasRenderingContext2D, overlay: PitchInputOverlay | null, side: number): void {
  if (overlay === null || overlay.kind !== '조준') return
  if (overlay.typeNumber === MAGIC_TYPE_NUMBER) {
    context.fillStyle = `rgba(0, 0, 0, ${1 - 5 / 16})`
    context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    return
  }
  const label = aimLabelPlacement(overlay.typeNumber, side)
  if (label === null) return
  context.fillStyle = `rgba(0, 0, 0, ${0x28 / 0xff})`
  context.fillRect(label.x - 5, label.y6 - 5, label.width + 10, label.height + 2)
}

function aimLabelPlacement(typeNumber: number, side: number): { x: number; y6: number; width: number; height: number } | null {
  if (typeNumber < 1 || typeNumber > 21) return null
  const placed = placedFrame(SLT_FRAMES, typeNumber - 1)
  if (placed === null) return null
  const { zoneLeft, zoneTop } = stageLayoutOf(side)
  const width = placed.image.width
  const height = placed.image.height
  return { x: zoneLeft + ((33 - width) >> 1), y6: zoneTop - height, width, height }
}

/** 선수 **위** — 0x10 의 애니 0 · 이름, 0x11 의 프레임 35 · 게이지 */
export function drawPitchInputSprites(context: CanvasRenderingContext2D, overlay: PitchInputOverlay | null, side: number): void {
  if (overlay === null || overlay.kind === '구질') return
  const point = projectToScreen(overlay.aim, overlay.aimSide)
  if (overlay.kind === '조준') {
    const entries = frameAnimations(SLT_FRAMES)?.[0]
    const step = entries === undefined ? null : animationStepAt(entries, overlay.tick)
    if (step !== null) drawFrame(context, SLT_FRAMES, step.frame, point.x, point.y)
    const label = aimLabelPlacement(overlay.typeNumber, side)
    if (label !== null) drawFrame(context, SLT_FRAMES, overlay.typeNumber - 1, label.x, label.y6 - 4)
    return
  }
  if (overlay.showsTargetFrame ?? !overlay.gaugeSettingOn) drawFrame(context, SLT_FRAMES, 0x23, point.x, point.y)
  if (!overlay.showsGauge) return
  for (const draw of gaugeDrawsOf(overlay)) {
    if (draw.alpha === undefined) {
      drawFrame(context, draw.folder, draw.frame, point.x, point.y + draw.dy)
      continue
    }
    // 효과 1 · 단계 L — 화면 칸을 읽어 원본 표 0xd5e58 · 0xd5de0 식으로 섞는다(공용 `drawImageWithEffect`)
    const placed = placedFrame(draw.folder, draw.frame)
    if (placed === null) continue
    drawImageWithEffect(
      context,
      placed.image,
      Math.round(point.x) + placed.offsetX,
      Math.round(point.y + draw.dy) + placed.offsetY,
      DRAW_EFFECT.TRANSLUCENT,
      Math.round(draw.alpha * EFFECT_LEVELS),
    )
  }
}

export interface GaugeDraw {
  readonly folder: string
  readonly frame: number
  readonly dy: number
  /** 효과 1 · 인자 L — 반투명 겹치기, 그림 무게 L/16 (R6 3a). 없으면 보통 그리기 */
  readonly alpha?: number
}

const GAUGE_OUTLINE = 0x3a
const GAUGE_BASE = 0x3b
const GAUGE_LAST = 0x43
/** 0x4d4c0 — t == 0 이고 커서 ≤ 8 이면 게이지 위에 목표 표시 프레임 0x23 도 넣는다 */
export const GAUGE_TARGET_FRAME = 0x23
const GAUGE_RESULT_ANIMATION = 1
const GAUGE_RESULT_TICKS = 4
const PERFECT_GRADE_CELL = 9
/** 0x4d54c — t 가 선 뒤 멈춘 커서 칸은 효과 1 · 인자 8 (반반) */
const STOPPED_CURSOR_LEVEL = 8
/** 0x4d6c4 — 결과 원 인자 L = max(15 − 3·[+0x17c4], 0) */
const RESULT_RING_LEVEL = 15
const RESULT_RING_LEVEL_STEP = 3
const EFFECT_LEVELS = 16
/** 애니 1 표가 아직 안 왔을 때의 길이 — slt_pitch 애니 1 은 다섯 칸 · 지연 0 */
const DEFAULT_RESULT_ANIMATION_LENGTH = 5

const gaugeFrameOfCell = (cell: number) => Math.min(GAUGE_BASE + cell, GAUGE_LAST)

export interface GaugeAnimationTables {
  /** slt_pitch 애니 1 (누른 칸 고리) */
  readonly result: readonly StageAnimationEntry[]
  /** game_effect 애니 0 (t == 5 덧그림) */
  readonly perfect: readonly StageAnimationEntry[]
}

/** 되감긴(칸 0 · 틱 0) 애니를 k 번 나아간 뒤의 칸 — 마지막 칸을 넘겨 끝났으면 null (0x93d90, 그리기는 목록을 비울 때 0xbe6a1) */
function frameAfterAdvances(entries: readonly StageAnimationEntry[], advances: number): number | null {
  let remaining = advances
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return null
}

/**
 * 게이지 그림 목록 (0x4d412~0x4d708, 2026-10-14 다시 떴다). t = `+0x17c0` = max(누른 칸 − 4, 1) (누름 0x50e2a).
 * ```
 * t == 0:  커서 > 8 → 0x3a | 커서 == 0 → 0x3a · 0x23 | 그 밖 → 0x3b · (커서 > 0 이면 min(0x3b + 커서, 0x43)) · 0x23 ; 커서 +1 (4d708)
 * t > 0 (그림 k 번째, 1 부터):
 *   4d52e  min(0x3b + 커서, 0x43) 를 효과 1 · 인자 8(반투명 반반)
 *   4d586  애니 1(되감기 0x39894) 끝 비트가 아직 없으면 min(0x3b + 누른 칸, 0x43) 보통
 *   4d5ca  애니 1 을 그리기 목록에 넣고 0x93d91 — 목록은 비울 때 그려 **k 칸 나아간 뒤**의 칸이 나온다(끝 칸 72 는 빈 그림)
 *   4d612  t == 5 면 game_effect 애니 0 도 같은 식으로(0x39894 가 되감음)
 *   4d69e  애니 1 끝 비트가 섰고 [+0x17c4] ≤ 3 이면 min(0x3b + 누른 칸, 0x43) 를 효과 1 · 인자 max(15 − 3·[+0x17c4], 0) → +1
 * ```
 * 결과 원은 위로 떠오르는 것이 아니라 **제자리에서 흐려진다**(인자 15 · 12 · 9 · 6 — 그림 무게 L/16). 예전 웹은 인자를 y 로 읽었다.
 * 웹 `decidedTicks` 는 칸을 정한 뒤 게이지가 그린 장면 틱 수다 — 누름은 받은 다음 틀의 키 처리(`sceneKeyLatch`, 0x498d4 → 0x50e08)가
 * 같은 틀 그리기보다 먼저 정하고 그 틀 그리기에서 1 이 되므로 부름 차례 k = decidedTicks 다(누른 틀의 그림이 k = 1 — 원본과 같다).
 */
export function gaugeDrawsOf(
  overlay: Pick<PitchGaugeOverlay, 'cursor' | 'pressed' | 'decidedTicks'>,
  tables: GaugeAnimationTables = {
    result: frameAnimations(SLT_FRAMES)?.[GAUGE_RESULT_ANIMATION] ?? [],
    perfect: frameAnimations(GAME_EFFECT_FRAMES)?.[0] ?? [],
  },
): GaugeDraw[] {
  const { cursor, pressed } = overlay
  if (pressed < 1 || pressed > PERFECT_GRADE_CELL) {
    if (cursor > 8) return [{ folder: SLT_FRAMES, frame: GAUGE_OUTLINE, dy: 0 }]
    const draws: GaugeDraw[] =
      cursor === 0 ? [{ folder: SLT_FRAMES, frame: GAUGE_OUTLINE, dy: 0 }] : [{ folder: SLT_FRAMES, frame: GAUGE_BASE, dy: 0 }]
    if (cursor > 0) draws.push({ folder: SLT_FRAMES, frame: gaugeFrameOfCell(cursor), dy: 0 })
    draws.push({ folder: SLT_FRAMES, frame: GAUGE_TARGET_FRAME, dy: 0 })
    return draws
  }
  const call = Math.max(1, overlay.decidedTicks)
  const draws: GaugeDraw[] = [{ folder: SLT_FRAMES, frame: gaugeFrameOfCell(cursor), dy: 0, alpha: STOPPED_CURSOR_LEVEL / EFFECT_LEVELS }]
  const resultLength = tables.result.length === 0 ? DEFAULT_RESULT_ANIMATION_LENGTH : onceLength(tables.result)
  // 4d586 의 검사는 이번 그림의 진행(4d60a) 앞이라 k − 1 번 나아간 상태를 본다
  if (call - 1 < resultLength) draws.push({ folder: SLT_FRAMES, frame: gaugeFrameOfCell(pressed), dy: 0 })
  const ring = frameAfterAdvances(tables.result, call)
  if (ring !== null) draws.push({ folder: SLT_FRAMES, frame: ring, dy: 0 })
  if (pressed === PERFECT_GRADE_CELL) {
    const perfect = frameAfterAdvances(tables.perfect, call)
    if (perfect !== null) draws.push({ folder: GAME_EFFECT_FRAMES, frame: perfect, dy: 0 })
  }
  const resultTick = call - resultLength
  if (resultTick >= 0 && resultTick < GAUGE_RESULT_TICKS) {
    const level = Math.max(RESULT_RING_LEVEL - RESULT_RING_LEVEL_STEP * resultTick, 0)
    draws.push({ folder: SLT_FRAMES, frame: gaugeFrameOfCell(pressed), dy: 0, alpha: level / EFFECT_LEVELS })
  }
  return draws
}

/**
 * **목표 표시 프레임 0x23 을 0x11 그림이 넣는가** — 0x4d360~0x4d3f4 (2026-10-14 직접 떴다).
 * ```
 * 4d362  모드 [+0x1104] == 7 → 안 넣음
 * 4d366  모드 5 · 6 이 아니고 난이도(설정 +0x2c) == 0 → 넣음
 * 4d380  모드 4, 또는 모드 2 이고 0x33fb8(공격 측 팀 +0x10 == 0) → 이글아이 남은 경기(레코드 [+0xf08]+0x54) > 0 이면 넣음
 * 4d3a8  0x33fb8 거짓이고 게이지 설정(+0x2d) == 0 → 넣음
 * ```
 * 레코드 +0x54 는 이글아이 남은 경기다(G 노트 · P4 — 상점 아이템 "투구 목표점 보기"). 곧 이글아이는 원 그림이 아니라 이 프레임이다.
 * 난이도 +0x2c 는 원본도 늘 기본 2(hard)다 — 바꾸는 화면이 없다(P7 K2) — 그래서 둘째 줄은 안 탄다. 부르는 쪽이 아직 이 값을 다 싣지 않아 그림 쪽 판정만 둔다.
 */
export function showsGaugeTargetFrameOf(input: {
  readonly mode: number
  readonly difficulty: number
  readonly isAttackSideHuman: boolean
  readonly eagleEyeGames: number
  readonly gaugeSettingOn: boolean
}): boolean {
  if (input.mode === 7) return false
  if (input.mode !== 5 && input.mode !== 6 && input.difficulty === 0) return true
  if ((input.mode === 4 || (input.mode === 2 && input.isAttackSideHuman)) && input.eagleEyeGames > 0) return true
  return !input.isAttackSideHuman && !input.gaugeSettingOn
}

/**
 * 0xf 구질 목록 — 존 자리(0x4c53c)에 그린다. `anchor` 는 투수 앵커(`stageLayout.pitcherAnchor`).
 * 빛 지도는 그 앞까지 그린 화면(배경 · 선수 · 공 · HUD)을 어둡게 한다 — 소프트키 글자는 그 뒤라 안 어두워진다.
 */
export function drawPitchMenu(context: CanvasRenderingContext2D, overlay: PitchMenuOverlay, side: number): void {
  const anchor = stageLayoutOf(side).pitcherAnchor
  drawSpotlight(context, anchor)
  const menu = pitchMenuFrameOf(overlay.tick, overlay.typeNumbers)
  for (const frame of menu.slotFrames) if (frame !== null) drawFrame(context, SLT_FRAMES, frame, anchor.x, anchor.y)
  drawFrame(context, SLT_FRAMES, menu.ring, anchor.x, anchor.y)
  if (!menu.showsSlots) return
  const boxes = frameBoxes(SLT_FRAMES)?.[String(RING_BOX_FRAME).padStart(3, '0')] ?? null
  for (let slot = 1; slot <= 5; slot += 1) {
    const typeNumber = overlay.typeNumbers[slot] ?? 0
    if (typeNumber === MAGIC_TYPE_NUMBER) {
      if (overlay.magicRemaining <= 0) continue
      // 애니 5 는 늘 첫 칸 (확인 r112): 4c6ba 0xba759(slt, 5, 종류 2, …, 진행 1)가 0x93c45 로 그리고 0x93d91 로 진행하지만,
      // 애니 객체는 만들 때 0x938d4 가 +2 = 1(멈춤 비트)로 두고 0x93d90 은 비트 0 이 서 있으면 안 나간다(93da8). 비트 0 을 내리는
      // 켜기 0x93cfd 는 +0x1010 을 읽는 곳(0x35afc · 0x398da 애니 1 · 0x3db20 애니 0 · 0x48900 적재 · 0x4c4bc · 0x4ce9c · 0x4d2ac ·
      // 0x4d780 · 0x4dc78) 중 애니 0 · 1 에만 건다 → 애니 5 는 멈춘 첫 칸 그대로다.
      const entries = frameAnimations(SLT_FRAMES)?.[MAGIC_BADGE_ANIMATION]
      if (entries?.[0] !== undefined) drawFrame(context, SLT_FRAMES, entries[0].frame, anchor.x, anchor.y)
      const digit = sprite(NUM_IMAGE(overlay.magicRemaining))
      if (digit !== null) context.drawImage(digit, anchor.x + MAGIC_COUNT_OFFSET.x, anchor.y + MAGIC_COUNT_OFFSET.y)
      continue
    }
    if (typeNumber === 0 || boxes === null) continue
    const iconBox = boxes[slot - 1]
    const icon = sprite(SLT_IMAGE(TYPE_ICON_IMAGES[typeNumber] ?? 0))
    if (iconBox !== undefined && icon !== null) context.drawImage(icon, anchor.x + iconBox[0], anchor.y + iconBox[1])
    const labelBox = boxes[slot + 3]
    const label = placedFrame(SLT_FRAMES, typeNumber - 1)
    if (labelBox !== undefined && label !== null) {
      context.drawImage(
        label.image,
        pitchMenuLabelX(slot, anchor.x, labelBox, label.image.width) + label.offsetX,
        anchor.y + labelBox[1] + label.offsetY,
      )
    }
  }
  const shine = frameAnimations(SLT_FRAMES)?.[SHINE_ANIMATION]
  if (shine !== undefined) {
    const step = pitchMenuShineStepOf(overlay.tick, onceLength(shine))
    const entry = step === null ? null : onceStepAt(shine, step)
    if (entry !== null) drawFrame(context, SLT_FRAMES, entry.frame, anchor.x, anchor.y)
  }
}

/** 빛 지도 0x9ce71 — 칸(2×2) 마다 (1 − 값/32) 만큼 검게 덮는다 */
function drawSpotlight(context: CanvasRenderingContext2D, anchor: { readonly x: number; readonly y: number }): void {
  context.fillStyle = `rgba(0, 0, 0, ${1 - LIGHT_BASE / LIGHT_SCALE})`
  const left = (anchor.x >> 1) - (SPOT_MASK_SIZE >> 1)
  const top = ((anchor.y - SPOTLIGHT_RAISE) >> 1) - (SPOT_MASK_SIZE >> 1)
  const halfWidth = STAGE_WIDTH >> 1
  const halfHeight = STAGE_HEIGHT >> 1
  for (let cellY = 0; cellY < halfHeight; cellY += 1) {
    const span = SPOT_MASK_SPANS[cellY - top]
    if (span === undefined) {
      context.fillRect(0, cellY * 2, STAGE_WIDTH, 2)
      continue
    }
    const start = Math.max(0, left + span[0])
    const end = Math.min(halfWidth, left + span[1])
    if (start > 0) context.fillRect(0, cellY * 2, start * 2, 2)
    if (end < halfWidth) context.fillRect(end * 2, cellY * 2, STAGE_WIDTH - end * 2, 2)
  }
  context.fillStyle = `rgba(0, 0, 0, ${1 - LIGHT_SPOT / LIGHT_SCALE})`
  for (let row = 0; row < SPOT_MASK_SPANS.length; row += 1) {
    const span = SPOT_MASK_SPANS[row]
    context.fillRect((left + span[0]) * 2, (top + row) * 2, (span[1] - span[0]) * 2, 2)
  }
}

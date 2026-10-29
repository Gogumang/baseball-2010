/** 0x11 게이지 그림 목록 (0x4d412~0x4d708) · 목표 표시 프레임 0x23 을 넣는가 (0x4d360) */
import { GAME_EFFECT_FRAMES, SLT_FRAMES } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayAssets'
import { onceLength } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayFrames'
import type { PitchGaugeOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay/overlayTypes'
import { type StageAnimationEntry, frameAnimations } from '@/widgets/batting-stage/lib/spriteLoader'

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
export const EFFECT_LEVELS = 16
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
  tables: GaugeAnimationTables = loadedGaugeTablesOf(),
): GaugeDraw[] {
  const { cursor, pressed } = overlay
  if (pressed < 1 || pressed > PERFECT_GRADE_CELL) return movingGaugeDrawsOf(cursor)
  return decidedGaugeDrawsOf(cursor, pressed, Math.max(1, overlay.decidedTicks), tables)
}

/** t > 0 — 칸을 정한 뒤 그림 k(= `call`) 번째 (4d52e~4d708) */
function decidedGaugeDrawsOf(cursor: number, pressed: number, call: number, tables: GaugeAnimationTables): GaugeDraw[] {
  const draws: GaugeDraw[] = [{ folder: SLT_FRAMES, frame: gaugeFrameOfCell(cursor), dy: 0, alpha: STOPPED_CURSOR_LEVEL / EFFECT_LEVELS }]
  const resultLength = tables.result.length === 0 ? DEFAULT_RESULT_ANIMATION_LENGTH : onceLength(tables.result)
  // 4d586 의 검사는 이번 그림의 진행(4d60a) 앞이라 k − 1 번 나아간 상태를 본다
  if (call - 1 < resultLength) draws.push({ folder: SLT_FRAMES, frame: gaugeFrameOfCell(pressed), dy: 0 })
  const ring = frameAfterAdvances(tables.result, call)
  if (ring !== null) draws.push({ folder: SLT_FRAMES, frame: ring, dy: 0 })
  const perfect = pressed === PERFECT_GRADE_CELL ? frameAfterAdvances(tables.perfect, call) : null
  if (perfect !== null) draws.push({ folder: GAME_EFFECT_FRAMES, frame: perfect, dy: 0 })
  const fading = fadingResultDrawOf(pressed, call - resultLength)
  if (fading !== null) draws.push(fading)
  return draws
}

/** 지금 실린 애니 표 — slt_pitch 애니 1 · game_effect 애니 0 (아직 안 왔으면 빈 표) */
function loadedGaugeTablesOf(): GaugeAnimationTables {
  return {
    result: frameAnimations(SLT_FRAMES)?.[GAUGE_RESULT_ANIMATION] ?? [],
    perfect: frameAnimations(GAME_EFFECT_FRAMES)?.[0] ?? [],
  }
}

/** 0x4d4c0 — t == 0 에서 목표 표시 프레임 0x23 을 함께 넣는 마지막 커서 칸 */
const LAST_TARGET_CURSOR = 8

/** t == 0 — 커서가 움직이는 동안 (4d412~4d4c0) */
function movingGaugeDrawsOf(cursor: number): GaugeDraw[] {
  if (cursor > LAST_TARGET_CURSOR) return [{ folder: SLT_FRAMES, frame: GAUGE_OUTLINE, dy: 0 }]
  const draws: GaugeDraw[] = cursor === 0 ? [{ folder: SLT_FRAMES, frame: GAUGE_OUTLINE, dy: 0 }] : [{ folder: SLT_FRAMES, frame: GAUGE_BASE, dy: 0 }]
  if (cursor > 0) draws.push({ folder: SLT_FRAMES, frame: gaugeFrameOfCell(cursor), dy: 0 })
  draws.push({ folder: SLT_FRAMES, frame: GAUGE_TARGET_FRAME, dy: 0 })
  return draws
}

/** 4d69e — 애니 1 이 끝난 뒤 [+0x17c4] ≤ 3 동안 누른 칸을 흐려지며 (인자 15 − 3·틱) */
function fadingResultDrawOf(pressed: number, resultTick: number): GaugeDraw | null {
  if (resultTick < 0 || resultTick >= GAUGE_RESULT_TICKS) return null
  const level = Math.max(RESULT_RING_LEVEL - RESULT_RING_LEVEL_STEP * resultTick, 0)
  return { folder: SLT_FRAMES, frame: gaugeFrameOfCell(pressed), dy: 0, alpha: level / EFFECT_LEVELS }
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
  if (input.mode === DERBY_MODE) return false
  if (input.mode !== 5 && input.mode !== 6 && input.difficulty === 0) return true
  if (seesEagleEyeTarget(input)) return true
  return !input.isAttackSideHuman && !input.gaugeSettingOn
}

/** 홈런더비 모드 — 목표 표시를 안 넣는다 */
const DERBY_MODE = 7

/** 4d380 — 모드 4, 또는 모드 2 이고 공격 측 팀이 사람이면 이글아이 남은 경기 > 0 */
function seesEagleEyeTarget(input: { readonly mode: number; readonly isAttackSideHuman: boolean; readonly eagleEyeGames: number }): boolean {
  const isEagleEyeMode = input.mode === 4 || (input.mode === 2 && input.isAttackSideHuman)
  return isEagleEyeMode && input.eagleEyeGames > 0
}

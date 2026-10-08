import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  FIREWORK_SLOT_COUNT,
  respawnFireworkSlot,
  tickHomeRunFireworks,
  type FireworksParticlePort,
  type HomeRunFireworks,
} from '@/entities/batting/model/homeRunFireworks'

/**
 * ============================================================================
 * **경기 정산 효과 — 0x4ea0c 가 깔고 결과 그림 0x4a384 가 굴리는 효과 객체 [0x1400064]** (2026-10-08 직접 뜸)
 * ============================================================================
 *
 * ## 깔기 — 경기 정산 진입 0x4ea0c (0x4f41a ~ 0x4f53a)
 * ```
 * 4ea12  [sp+0x50] = 0x4a350() — 사람 팀이 이겼나 (0xb6c21(경기, 0xb6a0d) == 0)
 * 4f41e  이겼으면: +8 = +9 = 0(끔) → 하늘 표 0xcfc98[구장객체+0x10(줄)][+0x14(칸)] > 6 (밤하늘)이면
 * 4f4cc      0x90191(객체, 2, 0) — 종류 2 를 **자리 인자 없이**: 칸 7 개마다 0x8f97c(칸, 0, 0, 0) → x = rand(40, W − 40) ·
 *            y = rand(H + 50, H + 100) · 기다림 50 (칸마다 굴림 2) · 그리고 +8 = +9 = 1
 *          (6 이하면 끈 채로 둔다 — 효과 없음)
 * 4f4e6  졌으면(비겨도): n = |점수 0 − 점수 1| × 30 (u16) · 0x90191(객체, 0, 0) — 종류 0 **비**:
 * 8fe8c      +0x1c = 0 · +0x1d(중력) = rand(1, 3) · +0x18(바람) = rand(−3, 4) · 튐 칸 200 · 빗방울 칸 200 개마다 0x8f63c(굴림 6)
 * 4f51c      +8 = +9 = 1 → 0x8fd28(객체, n): n ≠ 0 이면 빗방울 칸을 n 개로 새로 만들고 칸마다 0x8f63c(굴림 6)
 * ```
 * 0xcfc98 은 하늘 그리기 0x77fe8 의 표 0xd37a4 와 같은 값이고 같은 칸(구장객체 +0x10 · +0x14)을 읽는다 — 하늘 색 번호 > 6 이 밤이다.
 *
 * ## 굴리기 — 결과 그림 0x4a384 의 0x4a452 → 0x901a0 (조건 없이 그림마다), 그 뒤 프레임 끝 파티클 틱
 * - 종류 2: 홈런 효과와 같은 칸 기계(`tickHomeRunFireworks`).
 * - 종류 0 (0x901c8 ~ 0x9036e · 0x9045c ~):
 * ```
 * 901ce  +0x1a += 1 ; ≥ 20 이면 0 · 바람 += +0x19 ; |바람| ≥ 3 이면 +0x19 = −+0x19
 * 9020e  빗방울 칸 i 차례로: 0x8f83c(방울) — 기다림 −1, > 0 이면 그대로 · 땅(+0x14) 에 닿았으면 끝(0) ·
 *          아니면 x += vx + 바람 · y += vy · vy += 중력 · vx += +0x1c · 짙기 += 짙기 걸음(≥ 0x80 이면 0x80) · 기다림 = 0
 *        끝났으면: 튐 칸(첫 빈 칸)에 그 자리 · 수명 4 → 방울 칸을 비우고 첫 빈 칸(= 같은 칸)에 0x8f63c 로 다시 깐다(굴림 6)
 *        살아 있으면 0x8f8ec 로 선(x, y − 길이) → (x + 바람, y), 색 0xc7c7c7 · 짙기 — 기다림 > 0 이면 안 그린다
 * 9045c  +9 · 종류 0 이면 튐 칸마다 0x8faf0: 수명 ≤ 0 이면 비우고, 아니면 −1 뒤 0x8fb08 로 흰 점(수명 3 · 2 · 1 · 0 의 모양표)
 * ```
 * 빗방울 · 튐 칸은 효과 객체 버퍼(new 0x28 · 0xc8 · 0xc84 — 등급 2 · 4 · 11)라 파티클 이미터(등급 3)와 섞이지 않는다.
 */

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 0x8fe6c — 종류 0 의 칸 수 */
const RAIN_SLOT_COUNT = 200
/** 0x8fadc — 튐 수명 */
const SPLASH_LIFE = 4
/** 0x901d8 · 0x901b4 — 바람이 한 걸음 가는 그림 수 · 종류 0 의 바람 끝 */
const WIND_STEP_TICKS = 20
const RAIN_WIND_LIMIT = 3
/** 0x4f510 — 졌을 때 빗방울 수 = 점수 차 × 30 */
const RAIN_PER_RUN = 30
/** 0x4f43c — 하늘 색 번호가 이보다 크면 밤 */
const NIGHT_SKY_COLOR_INDEX = 6

/** s8 로 자른다 */
function signedByte(value: number): number {
  return ((value & 0xff) << 24) >> 24
}

/** 빗방울 칸 (0x18 바이트) */
export interface RainDrop {
  /** +4 · +8 */
  x: number
  y: number
  /** +0xc · +0xd — s8 */
  vx: number
  vy: number
  /** +0xe — 짙기 (0..0x80) */
  alpha: number
  /** +0xf — 짙기 걸음 */
  alphaStep: number
  /** +0x10 — 선 길이 */
  length: number
  /** +0x12 — 기다림 (s8) */
  delay: number
  /** +0x14 — 땅 y (u16) */
  ground: number
  /** 이번 틱 고리에서 0x8f8ec 로 그렸나 — 다시 깐 방울은 그 틱에 안 그린다 */
  isDrawn: boolean
}

/** 튐 칸 (0x10 바이트) */
export interface RainSplash {
  x: number
  y: number
  /** +0xc */
  life: number
}

/** 칸 풀 — 쓰는 표(+4) · 마지막 칸(+8) */
interface SlotPool<T> {
  readonly slots: (T | null)[]
  cursor: number
}

export interface SceneRain {
  /** +0x18 — 바람 (s8) */
  wind: number
  /** +0x19 */
  windStep: number
  /** +0x1a */
  windTicks: number
  /** +0x1c · +0x1d */
  readonly accelerationX: number
  readonly gravity: number
  readonly drops: SlotPool<RainDrop>
  readonly splashes: SlotPool<RainSplash>
}

/** 정산이 켠 효과 — 없으면 null(끔) */
export type SettlementEffect =
  | { readonly kind: 'fireworks'; fireworks: HomeRunFireworks<number> }
  | { readonly kind: 'rain'; readonly rain: SceneRain }

export interface SettlementEffectInput {
  /** 0x4a350 — 사람 팀이 이겼나 */
  readonly isWin: boolean
  /** 하늘 색 번호 0xcfc98[줄][칸] (= `skyColorsOf(…).colorIndex`) */
  readonly skyColorIndex: number
  /** 0xb69b0(st, 0) · (st, 1) */
  readonly side0Score: number
  readonly side1Score: number
}

/** 0x4ea0c 의 효과 깔기 (머리말) — 굴림을 원본 차례대로 쓴다 */
export function enterSettlementEffect(input: SettlementEffectInput, random: RandomPort): SettlementEffect | null {
  if (input.isWin) {
    if (input.skyColorIndex <= NIGHT_SKY_COLOR_INDEX) return null
    // 0x90191(객체, 2, 0) — +0x20 = 0 이라 칸마다 자리를 굴린다
    const slots = Array.from({ length: FIREWORK_SLOT_COUNT }, () => respawnFireworkSlot<number>(random))
    return { kind: 'fireworks', fireworks: { slots } }
  }
  const rain = createRain(random)
  // 0x8fd28(객체, n) — u16 로 자른 n 이 0 이면 그대로 둔다
  const count = ((Math.abs(input.side0Score - input.side1Score) * RAIN_PER_RUN) << 16) >> 16
  if ((count & 0xffff) !== 0) {
    rain.drops.slots.length = 0
    rain.drops.cursor = 0
    for (let index = 0; index < Math.max(0, count); index += 1) rain.drops.slots.push(null)
    for (let index = 0; index < Math.max(0, count); index += 1) placeDrop(rain, random)
  }
  return { kind: 'rain', rain }
}

/** 0x90190(객체, 0, 0) → 0x8fe58 종류 0 — 2 + 200 × 6 번 */
function createRain(random: RandomPort): SceneRain {
  const gravity = random.rand(1, 3)
  const wind = random.rand(-3, 4)
  const rain: SceneRain = {
    wind,
    windStep: 1,
    windTicks: 0,
    accelerationX: 0,
    gravity,
    drops: { slots: Array.from({ length: RAIN_SLOT_COUNT }, () => null), cursor: 0 },
    splashes: { slots: Array.from({ length: RAIN_SLOT_COUNT }, () => null), cursor: 0 },
  }
  for (let index = 0; index < RAIN_SLOT_COUNT; index += 1) placeDrop(rain, random)
  return rain
}

/** 칸 고르기 (0x8ffc0 · 0x902d8 · 0x90240 꼴) — 0 부터 첫 빈 칸, 없으면 마지막 칸(+8) */
function freeSlotOf<T>(pool: SlotPool<T>): number {
  const index = pool.slots.indexOf(null)
  return index >= 0 ? index : pool.cursor
}

/** 빈 칸에 0 채운 본(+0x18)을 옮기고 0x8f63c 로 깐다 */
function placeDrop(rain: SceneRain, random: RandomPort): void {
  const index = freeSlotOf(rain.drops)
  rain.drops.slots[index] = spawnDrop(rain.wind, random)
  rain.drops.cursor = index
}

/** 0x8f63c 종류 0 — 굴림 6 번 (x · y · 길이 · 땅 · 짙기 걸음 · 기다림) */
function spawnDrop(wind: number, random: RandomPort): RainDrop {
  const reach = 30 * Math.abs(wind)
  const x =
    wind < 0
      ? random.rand(0, SCREEN_WIDTH + reach)
      : wind > 0
        ? random.rand(-reach, SCREEN_WIDTH)
        : random.rand(-30, SCREEN_WIDTH + 30)
  const y = random.rand(-60, 20)
  const length = random.rand(20, 40)
  const ground = random.rand(SCREEN_HEIGHT - 50, SCREEN_HEIGHT + 20) & 0xffff
  const alphaStep = random.rand(5, 10)
  const delay = random.rand(0, 20)
  return { x, y, vx: 0, vy: 0, alpha: 0, alphaStep, length, delay, ground, isDrawn: false }
}

/** 0x8f83c 종류 0 — 살아 있으면 참 */
function updateDrop(drop: RainDrop, rain: SceneRain): boolean {
  drop.delay = signedByte(drop.delay - 1)
  if (drop.delay > 0) return true
  if (drop.y >= drop.ground) return false
  drop.x += signedByte(drop.vx) + rain.wind
  drop.y += signedByte(drop.vy)
  drop.vy = signedByte(drop.vy + rain.gravity)
  drop.vx = signedByte(drop.vx + rain.accelerationX)
  const alpha = (drop.alpha + drop.alphaStep) & 0xff
  drop.alpha = alpha & 0x80 ? 0x80 : alpha
  drop.delay = 0
  return true
}

/** 0x901a0 종류 0 한 틱 */
function tickRain(rain: SceneRain, random: RandomPort): void {
  rain.windTicks += 1
  if (rain.windTicks >= WIND_STEP_TICKS) {
    rain.windTicks = 0
    rain.wind = signedByte(rain.wind + rain.windStep)
    if (Math.abs(rain.wind) >= RAIN_WIND_LIMIT) rain.windStep = signedByte(-rain.windStep)
  }
  const { drops, splashes } = rain
  for (let index = 0; index < drops.slots.length; index += 1) {
    const drop = drops.slots[index]
    if (drop === null || drop === undefined) continue
    drop.isDrawn = false
    if (updateDrop(drop, rain)) {
      drop.isDrawn = drop.delay <= 0
      continue
    }
    // 0x90240 — 튐 칸 (첫 빈 칸)
    const splashIndex = freeSlotOf(splashes)
    splashes.slots[splashIndex] = { x: drop.x, y: drop.y, life: SPLASH_LIFE }
    splashes.cursor = splashIndex
    // 0x902b8 — 방울 칸을 비우고 다시 깐다
    drops.slots[index] = null
    placeDrop(rain, random)
  }
  // 0x9045c — 튐 칸
  for (let index = 0; index < splashes.slots.length; index += 1) {
    const splash = splashes.slots[index]
    if (splash === null || splash === undefined) continue
    if (splash.life <= 0) splashes.slots[index] = null
    else splash.life -= 1
  }
}

/** 결과 그림 0x4a384 의 0x901a0 한 번 */
export function tickSettlementEffect(
  effect: SettlementEffect,
  port: FireworksParticlePort<number>,
  random: RandomPort,
): void {
  if (effect.kind === 'fireworks') {
    effect.fireworks = tickHomeRunFireworks(effect.fireworks, port, random)
    return
  }
  tickRain(effect.rain, random)
}

/** 0x8fb08 — 튐 수명(줄인 뒤)별 흰 점 자리. 3 은 가로선 (x − 2, y) ~ (x + 2, y) 도 긋는다 */
export const SPLASH_DOTS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  3: [[-1, -1], [-2, -2], [1, -1], [2, -2]],
  2: [[-4, 0], [-3, 0], [-2, -2], [-3, -3], [4, 0], [3, 0], [2, -2], [3, -3]],
  1: [[-6, 0], [-5, 0], [-4, -2], [-5, -3], [6, 0], [5, 0], [4, -2], [5, -3]],
  0: [[-7, 0], [-8, -2], [-5, -4], [7, 0], [8, -2], [5, -4], [0, 0]],
}

/** 비 그리기 0x8f8ec · 0x8fb08 — 빗방울 선과 튐 점 */
export function rainDrawingOf(rain: SceneRain): {
  readonly lines: readonly { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; readonly alpha: number }[]
  readonly dots: readonly { readonly x: number; readonly y: number }[]
  readonly bars: readonly { readonly x: number; readonly y: number }[]
} {
  const lines = []
  for (const drop of rain.drops.slots) {
    if (drop === null || drop === undefined || !drop.isDrawn) continue
    lines.push({ x0: drop.x, y0: drop.y - signedByte(drop.length), x1: drop.x + rain.wind, y1: drop.y, alpha: drop.alpha })
  }
  const dots = []
  const bars = []
  for (const splash of rain.splashes.slots) {
    if (splash === null || splash === undefined) continue
    if (splash.life === 3) bars.push({ x: splash.x, y: splash.y })
    for (const [dx, dy] of SPLASH_DOTS[splash.life] ?? []) dots.push({ x: splash.x + dx, y: splash.y + dy })
  }
  return { lines, dots, bars }
}

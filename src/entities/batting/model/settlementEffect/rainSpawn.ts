import type { RandomPort } from '@/shared/api/random/randomPort'
import { freeSlotOf, type RainDrop, type SceneRain } from '@/entities/batting/model/settlementEffect/rain'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 0x8fe6c — 종류 0 의 칸 수 */
const RAIN_SLOT_COUNT = 200
/** 0x8f63c — 바람 1 마다 방울 x 범위가 바람 반대쪽으로 늘어나는 폭 · 바람 없을 때 양쪽 여유 */
const WIND_REACH_PER_STEP = 30
const CALM_MARGIN = 30

/** 0x8f63c 의 x — 바람 반대쪽으로 넓힌 범위에서 굴린다 (굴림 1) */
function rollDropX(wind: number, random: RandomPort): number {
  const reach = WIND_REACH_PER_STEP * Math.abs(wind)
  if (wind < 0) return random.rand(0, SCREEN_WIDTH + reach)
  if (wind > 0) return random.rand(-reach, SCREEN_WIDTH)
  return random.rand(-CALM_MARGIN, SCREEN_WIDTH + CALM_MARGIN)
}

/** 0x8f63c 종류 0 — 굴림 6 번 (x · y · 길이 · 땅 · 짙기 걸음 · 기다림) */
function rollDrop(wind: number, random: RandomPort): RainDrop {
  const x = rollDropX(wind, random)
  const y = random.rand(-60, 20)
  const length = random.rand(20, 40)
  const ground = random.rand(SCREEN_HEIGHT - 50, SCREEN_HEIGHT + 20) & 0xffff
  const alphaStep = random.rand(5, 10)
  const delay = random.rand(0, 20)
  return { x, y, vx: 0, vy: 0, alpha: 0, alphaStep, length, delay, ground, isDrawn: false }
}

/** 빈 칸에 0 채운 본(+0x18)을 옮기고 0x8f63c 로 깐다 (굴림 6) */
export function rollPlacedDrop(rain: SceneRain, random: RandomPort): void {
  const index = freeSlotOf(rain.drops)
  rain.drops.slots[index] = rollDrop(rain.wind, random)
  rain.drops.cursor = index
}

/** 0x90190(객체, 0, 0) → 0x8fe58 종류 0 — 2 + 200 × 6 번 */
export function rollRain(random: RandomPort): SceneRain {
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
  for (let index = 0; index < RAIN_SLOT_COUNT; index += 1) rollPlacedDrop(rain, random)
  return rain
}

import type { RandomPort } from '@/shared/api/random/randomPort'
import { freeSlotOf, signedByte, type RainDrop, type RainSplash, type SceneRain, type SlotPool } from '@/entities/batting/model/settlementEffect/rain'
import { rollPlacedDrop } from '@/entities/batting/model/settlementEffect/rainSpawn'

/** 0x8fadc — 튐 수명 */
const SPLASH_LIFE = 4
/** 0x901d8 · 0x901b4 — 바람이 한 걸음 가는 그림 수 · 종류 0 의 바람 끝 */
const WIND_STEP_TICKS = 20
const RAIN_WIND_LIMIT = 3
/** 0x8f83c — 짙기 끝(이 비트가 서면 0x80 으로 멈춘다) */
const ALPHA_LIMIT = 0x80

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
  drop.alpha = alpha & ALPHA_LIMIT ? ALPHA_LIMIT : alpha
  drop.delay = 0
  return true
}

/** 0x901ce — +0x1a 가 20 이 되면 바람이 한 걸음 가고, 끝(|3|)에 닿으면 걸음을 뒤집는다 */
function stepRainWind(rain: SceneRain): void {
  rain.windTicks += 1
  if (rain.windTicks < WIND_STEP_TICKS) return
  rain.windTicks = 0
  rain.wind = signedByte(rain.wind + rain.windStep)
  if (Math.abs(rain.wind) >= RAIN_WIND_LIMIT) rain.windStep = signedByte(-rain.windStep)
}

/** 끝난 방울 — 0x90240 튐 칸(첫 빈 칸)에 그 자리, 0x902b8 방울 칸을 비우고 다시 깐다(굴림 6) */
function rollSplashedDrop(rain: SceneRain, index: number, drop: RainDrop, random: RandomPort): void {
  const { drops, splashes } = rain
  const splashIndex = freeSlotOf(splashes)
  splashes.slots[splashIndex] = { x: drop.x, y: drop.y, life: SPLASH_LIFE }
  splashes.cursor = splashIndex
  drops.slots[index] = null
  rollPlacedDrop(rain, random)
}

/** 0x9020e — 빗방울 칸 i 차례로 */
function rollRainDrops(rain: SceneRain, random: RandomPort): void {
  const { drops } = rain
  for (let index = 0; index < drops.slots.length; index += 1) {
    const drop = drops.slots[index]
    if (drop === null || drop === undefined) continue
    drop.isDrawn = false
    if (updateDrop(drop, rain)) drop.isDrawn = drop.delay <= 0
    else rollSplashedDrop(rain, index, drop, random)
  }
}

/** 0x9045c — 튐 칸마다 0x8faf0: 수명 ≤ 0 이면 비우고, 아니면 −1 */
function tickSplashes(splashes: SlotPool<RainSplash>): void {
  for (let index = 0; index < splashes.slots.length; index += 1) {
    const splash = splashes.slots[index]
    if (splash === null || splash === undefined) continue
    if (splash.life <= 0) splashes.slots[index] = null
    else splash.life -= 1
  }
}

/** 0x901a0 종류 0 한 틱 */
export function rollRainTick(rain: SceneRain, random: RandomPort): void {
  stepRainWind(rain)
  rollRainDrops(rain, random)
  tickSplashes(rain.splashes)
}

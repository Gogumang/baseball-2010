import type { RandomPort } from '@/shared/api/random/randomPort'
import { FIREWORK_SLOT_COUNT, respawnFireworkSlot, tickHomeRunFireworks } from '@/entities/batting/model/homeRunFireworks'
import type { SceneRain, SettlementEffect, SettlementParticlePort } from '@/entities/batting/model/settlementEffect/rain'
import { rollPlacedDrop, rollRain } from '@/entities/batting/model/settlementEffect/rainSpawn'
import { rollRainTick } from '@/entities/batting/model/settlementEffect/rainTick'

/** 0x4f510 — 졌을 때 빗방울 수 = 점수 차 × 30 */
const RAIN_PER_RUN = 30
/** 0x4f43c — 하늘 색 번호가 이보다 크면 밤 */
const NIGHT_SKY_COLOR_INDEX = 6

export interface SettlementEffectInput {
  /** 0x4a350 — 사람 팀이 이겼나 */
  readonly isWin: boolean
  /** 하늘 색 번호 0xcfc98[줄][칸] (= `skyColorsOf(…).colorIndex`) */
  readonly skyColorIndex: number
  /** 0xb69b0(st, 0) · (st, 1) */
  readonly side0Score: number
  readonly side1Score: number
}

/** 이겼을 때 — 밤하늘이면 0x90191(객체, 2, 0): +0x20 = 0 이라 칸마다 자리를 굴린다. 낮이면 끔 */
function rollWinEffect(skyColorIndex: number, random: RandomPort): SettlementEffect | null {
  if (skyColorIndex <= NIGHT_SKY_COLOR_INDEX) return null
  const slots = Array.from({ length: FIREWORK_SLOT_COUNT }, () => respawnFireworkSlot<number>(random))
  return { kind: 'fireworks', fireworks: { slots } }
}

/** 0x8fd28(객체, n) — u16 로 자른 n 이 0 이면 그대로 둔다. 아니면 빗방울 칸을 n 개로 새로 만들고 칸마다 굴림 6 */
function rollRainCount(rain: SceneRain, count: number, random: RandomPort): void {
  if ((count & 0xffff) === 0) return
  rain.drops.slots.length = 0
  rain.drops.cursor = 0
  for (let index = 0; index < Math.max(0, count); index += 1) rain.drops.slots.push(null)
  for (let index = 0; index < Math.max(0, count); index += 1) rollPlacedDrop(rain, random)
}

/** 0x4ea0c 의 효과 깔기 (머리말) — 굴림을 원본 차례대로 쓴다 */
export function enterSettlementEffect(input: SettlementEffectInput, random: RandomPort): SettlementEffect | null {
  if (input.isWin) return rollWinEffect(input.skyColorIndex, random)
  const rain = rollRain(random)
  const count = ((Math.abs(input.side0Score - input.side1Score) * RAIN_PER_RUN) << 16) >> 16
  rollRainCount(rain, count, random)
  return { kind: 'rain', rain }
}

/** 결과 그림 0x4a384 의 0x901a0 한 번 */
export function tickSettlementEffect(effect: SettlementEffect, port: SettlementParticlePort, random: RandomPort): void {
  if (effect.kind === 'fireworks') {
    effect.fireworks = tickHomeRunFireworks(effect.fireworks, port, random)
    return
  }
  rollRainTick(effect.rain, random)
}

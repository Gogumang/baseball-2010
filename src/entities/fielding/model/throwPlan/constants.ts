import { isOutfieldSlot } from '@/entities/fielding/model/fieldGeometry'

/**
 * 송구 설정값 — d_level.dat (cfg = 파일 + 4) 에서 온다. S7 5-2 에서 실측으로 확정된 값들이다.
 */

/** cfg+0x20 = 3 — 내야수가 잡고 던지기까지 / 중계 받고 다시 던지는 지연 */
export const INFIELD_READY_TICKS = 3
/** cfg+0x22 = 6 — 외야수가 잡고 던지기까지 */
export const OUTFIELD_READY_TICKS = 6
/** cfg+0x42 = 17000 — 중계 문턱 (파일 0x3e, 미정렬 u32 로 읽어도 17000) */
export const RELAY_DISTANCE = 17_000
/** cfg+0x1c = 70 — 내야(칸 ≤ 5) 송구 공 **중력** 배율(%) — 0xa1adc · 0xa16f4 가 공+0x44 에 곱한다 */
export const THROW_COEFFICIENT_INFIELD = 70
/** cfg+0x1e = 80 — 외야 송구 공 중력 배율(%) */
export const THROW_COEFFICIENT_OUTFIELD = 80

/** 송구 공 중력 배율 % — 0xa1708: 칸 ≤ 5 면 cfg+0x1c(70), 아니면 cfg+0x1e(80) (`0xa279c`) */
export function throwGravityPercentOf(slot: number): number {
  return isOutfieldSlot(slot) ? THROW_COEFFICIENT_OUTFIELD : THROW_COEFFICIENT_INFIELD
}

/** 잡고 던지기까지의 준비 틱 — 내야 3 · 외야 6 (cfg+0x20 / cfg+0x22) */
export function readyTicksOf(slot: number): number {
  return isOutfieldSlot(slot) ? OUTFIELD_READY_TICKS : INFIELD_READY_TICKS
}

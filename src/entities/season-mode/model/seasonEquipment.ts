import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * **시즌 장비 창 — 장면 0x105 상태 0xdc, 창 종류 3** (아이템 0xd0 → 장착아이템 → 선수 고르기 0xdf 목적 1 → 확인).
 * 직접 떴다: 들어옴 0x5f3c(칸 0 갈래) · 키 0x957c(종류 3 갈래 0x95b2~0x97da) · 창 키 0x819ac · 적용 0x7d90(결과 0x14).
 *
 * ```
 * 0x5f3c  [win+0x1a4] = 3 · 고른 선수 = 0xb5694(팀레코드, ed+0x33f ? 0(투수) : 1(타자), 커서) 의 0x30 바이트 사본 →
 *         this+0x118 · 그림(투수 0x79368 / 타자 0x789f0 — 장비 니블마다 겹 그림) · [win+0x24c] = 타자였는가 · 0x81618
 * 0x957c  종류 3:
 *         [win+0x1a8] == 0 (부위 목록 [win+0x198] 에 있음): 취소(−16) → 0xdf, 그 밖 0x819ac(창, 키)
 *                                                         (확인이면 칸 목록 [win+0x19c] 으로 들어간다)
 *         [win+0x1a8] != 0 (칸 목록): 확인(−5 · '5') 이면 아래 가드, 그 밖 0x819ac — 취소면 부위 목록으로 돌아가고
 *                                    칸 커서를 0 으로, 그림의 장비를 진짜 니블로 되돌린다(0x81a9a~)
 * 가드    t = 부위([win+0x198]), i = 칸(0x8455d, 0..10), 선수 = 팀 레코드의 진짜 줄(0xb5694 — 사본이 아니다)
 *         1 i > 6 이고 0x9f69c(app, 타자?, t, i − 7) == 0           → StrMODE[76]                      (0x95ec · 0x9b1a)
 *         2 니블(t) − 1 == i                                        → StrMODE[78]  (지금 낀 것만 본다) (0x96ac)
 *         3 0xcbd58[i] > 인기도                                     → StrMODE[62] (%d = 필요 인기도)   (0x96c4)
 *         4 p = 0xcbca8[t × 11 + i (+44 타자)] ; p × 10 > SR+2 소지금 → StrMODE[77]                     (0x972a)
 *         5 StrMODE[79] (%s = 0x55cf5(p × 1000) 만원) 예/아니오 — 결과 0x14                               (0x9744)
 * 0x7d90  결과 0x14 · "예": 소지금 = clamp(소지금 − p × 10, 0, 9999) · 니블(t) = i + 1 · 저장(0x1fded · 0x22755) ·
 *         0xb6348(선수)(명예 선수)면 0x2328d 로 명전 기록에도 · StrMODE[142]                               (0x7dd0~0x7f28)
 * ```
 * 니블 자리: 바이트 +0x19 + t/2, 짝수 t 는 윗니블 · 홀수 t 는 아랫니블 (`SeasonPlayer.equipment[t]`).
 *
 * ⚠️ 원본 그대로 옮긴 것:
 *   - **산 기록이 없다** — 나리 장비(보유 플래그 +0x188)와 달리 시즌은 니블 하나뿐이라 바꿔 끼우면 앞의 것은 사라지고,
 *     예전에 샀던 것을 다시 끼우려면 다시 산다(되돌려 받는 돈도 없다). "이미 가지고 있는" 은 지금 낀 칸만이다.
 *   - 소지금은 9999(= 99억 9900만) 위로 자른다 — 빼기만 하는 자리라 실제로 닿지 않는다.
 *   - 인기도는 깎지 않는다(조건일 뿐).
 * ⚠️ 미해결: 0x2328d(명예 선수의 명전 기록 반영)는 웹 명전 기록 칸이 장비를 들지 않아 옮기지 않았다.
 */

export const SEASON_EQUIPMENT_PART_COUNT = 4
export const SEASON_EQUIPMENT_LEVEL_COUNT = 11
/** 히든 칸 첫 번호 — i > 6 */
export const SEASON_FIRST_HIDDEN_LEVEL = 7

/** 0xcbca8 s16[88] — 앞 44칸 투수 · 뒤 44칸 타자 (× 10 = 100만 원 단위) */
const PRICE_TABLE: readonly number[] = [
  4, 8, 12, 18, 24, 32, 40, 80, 110, 150, 200,
  5, 9, 14, 20, 27, 35, 45, 90, 120, 160, 210,
  4, 8, 12, 18, 24, 32, 40, 80, 110, 150, 200,
  3, 6, 10, 15, 21, 28, 36, 70, 100, 140, 190,
  5, 9, 14, 20, 27, 35, 45, 90, 120, 150, 200,
  5, 9, 14, 20, 27, 35, 45, 90, 120, 160, 210,
  3, 6, 10, 15, 21, 28, 36, 70, 100, 140, 190,
  3, 6, 10, 15, 21, 28, 36, 70, 100, 140, 190,
]
const BATTER_PRICE_OFFSET = 44
const PRICE_SCALE = 10
/** 0xcbd58 s16[11] — 필요 인기도 */
const REQUIRED_POPULARITY: readonly number[] = [0, 50, 150, 300, 450, 600, 800, 0, 0, 0, 0]
/** 이름 StrITEM[i + 11t (+44 투수)] — 0x897e8 의 장비 줄과 같은 표 */
const PITCHER_NAME_OFFSET = 44
/** 소지금 상한 0x270f (0x7e9c) */
const MONEY_LIMIT = 9999
/** 전역 해금표 app+0xc0 — (타자? × 4 + t) × 4 + (i − 7). 웹 해금 id 는 19 부터(투수 19~34 · 타자 35~50) */
const HIDDEN_ID_START = 19
const HIDDEN_PER_SIDE = 16
const HIDDEN_PER_PART = 4

/** StrMODE 번호 */
export const SEASON_EQUIPMENT_TEXT = { 미오픈: 76, 이미보유: 78, 인기도부족: 62, 소지금부족: 77, 구매확인: 79, 장착완료: 142 } as const

export type SeasonEquipmentRefusal = '미오픈' | '이미보유' | '인기도부족' | '소지금부족'

export function seasonEquipmentPriceOf(isBatter: boolean, part: number, level: number): number {
  return PRICE_TABLE[part * SEASON_EQUIPMENT_LEVEL_COUNT + level + (isBatter ? BATTER_PRICE_OFFSET : 0)] ?? 0
}

export function seasonEquipmentNameOf(isBatter: boolean, part: number, level: number): string {
  return ORIGINAL_ITEMS[level + part * SEASON_EQUIPMENT_LEVEL_COUNT + (isBatter ? 0 : PITCHER_NAME_OFFSET)] ?? ''
}

export function seasonEquipmentRequiredPopularityOf(level: number): number {
  return REQUIRED_POPULARITY[level] ?? 0
}

/** 해금 id — 0x9f69c(app, 타자?, t, i − 7) 의 칸 */
export function seasonEquipmentHiddenIdOf(isBatter: boolean, part: number, level: number): number {
  return HIDDEN_ID_START + (isBatter ? HIDDEN_PER_SIDE : 0) + part * HIDDEN_PER_PART + level - SEASON_FIRST_HIDDEN_LEVEL
}

export interface SeasonEquipmentTarget {
  readonly isBatter: boolean
  /** 팀 레코드의 진짜 니블 네 칸 */
  readonly equipment: readonly number[]
}

export type SeasonEquipmentCheck =
  | { readonly ok: true; readonly price: number }
  | { readonly ok: false; readonly reason: SeasonEquipmentRefusal; readonly required?: number }

/** 0x957c 가드 — 차례 그대로 */
export function checkSeasonEquipment(
  record: Pick<SeasonRecord, 'popularity' | 'money'>,
  target: SeasonEquipmentTarget,
  part: number,
  level: number,
  isHiddenOpen: (id: number) => boolean,
): SeasonEquipmentCheck {
  if (level >= SEASON_FIRST_HIDDEN_LEVEL && !isHiddenOpen(seasonEquipmentHiddenIdOf(target.isBatter, part, level))) {
    return { ok: false, reason: '미오픈' }
  }
  if ((target.equipment[part] ?? 0) - 1 === level) return { ok: false, reason: '이미보유' }
  const required = seasonEquipmentRequiredPopularityOf(level)
  if (required > record.popularity) return { ok: false, reason: '인기도부족', required }
  const price = seasonEquipmentPriceOf(target.isBatter, part, level)
  if (price * PRICE_SCALE > record.money) return { ok: false, reason: '소지금부족' }
  return { ok: true, price }
}

/** 0x7d90 결과 0x14 — 소지금(100만 원 단위)과 니블 */
export function applySeasonEquipment(
  money: number,
  target: SeasonEquipmentTarget,
  part: number,
  level: number,
): { readonly money: number; readonly equipment: readonly number[] } {
  const price = seasonEquipmentPriceOf(target.isBatter, part, level)
  const equipment = Array.from({ length: SEASON_EQUIPMENT_PART_COUNT }, (_unused, slot) =>
    slot === part ? level + 1 : target.equipment[slot] ?? 0)
  return { money: Math.min(MONEY_LIMIT, Math.max(0, money - price * PRICE_SCALE)), equipment }
}

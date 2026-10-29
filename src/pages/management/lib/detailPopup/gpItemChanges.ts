import type { DetailSlots } from './detailRows'

/**
 * GP 아이템 결과 창 변화량 — 구매 확정 0x14a74 (두 모드 공용, 디스어셈 확정):
 *   0x14f22 `0x5e865` 로 한계(창+0x118)를 채운 뒤 **아이템 0~4 · 6 일 때만** 창을 띄운다(0x14f28·0x15030).
 *   변화량은 0 으로 비운 배열에 (효과 0xa4488 을 부르기 **전에**) 채운다 —
 *     0~3: 그 칸 k 에 `한계 > 0xb6415(기록, k, 0)` 이면 10 · 4(도시락): 네 칸 각각 같은 조건이면 10 ·
 *     6(영지버섯): 사기 칸 40 (0x14f5c~0x14fa4). 보너스 칸은 0.
 *   현재값: 능력치 네 칸은 효과 **뒤에** 다시 읽고(0x1504a 0xb6415(기록,k,1)), **사기 칸은 효과 전 값**이다
 *   (0x14f92 에서 한 번 읽고 다시 안 읽는다 — 영지버섯이면 오르기 전 사기가 보인다. 원본 그대로).
 *   최대값은 한계 · 사기 100. 창을 닫으면 콜백 0x1d649 (닫기 키에 0x742a9 만 — 굴림 없음).
 * `baseBefore` 는 효과 전 `0xb6415(기록,k,0)` (장비·스킬 뺀 값), `limits` 는 그 모드의 한계 네 칸이다.
 * 상점 화면이 `pages/shop/lib/gpDetailView.ts` 로 줄을 세워 띄운다.
 */
const GP_ABILITY_CHANGE = 10
const GP_MORALE_CHANGE = 40

export function gpItemDetailChangesOf(itemIndex: number, baseBefore: readonly number[], limits: readonly number[]): DetailSlots | null {
  if (itemIndex > 4 && itemIndex !== 6) return null
  const raises = (k: number) => (limits[k] ?? 0) > (baseBefore[k] ?? 0)
  return {
    ability: [0, 1, 2, 3].map((k) => ((itemIndex === k || itemIndex === 4) && raises(k) ? GP_ABILITY_CHANGE : 0)),
    morale: itemIndex === 6 ? GP_MORALE_CHANGE : 0,
  }
}

import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { HalfInningPlateAppearance } from '@/entities/game/model/simulateHalfInning/types/result'

/**
 * **간이 엔진 0xc262c 한 번** — 자동진행 0x21 갱신 0x48480 은 틱마다 0xc2198 → 0xc262c 를 **한 번** 부른다. 그 한 번은
 * - `substitution`: 0xc1ba4 가 대타 · 투수 교체를 내 공 없이 돌아간 부름(c266c) — 다음 부름이 같은 타석을 다시 묻는다
 * - `plateAppearance`: 타석 하나(c26be~c271c — 지금 타자 0xae89c ≠ 예약 다음 타자 0xae944 가 될 때까지 공을 던진다)
 * 다. 굴림은 그 부름 안에서만 나간다 — 다음 틱을 안 부르면 남은 타석은 굴리지 않는다.
 */
export type HalfInningTick =
  | ({ readonly kind: 'substitution' } & HalfInningTickState)
  | ({
      readonly kind: 'plateAppearance'
      readonly appearance: HalfInningPlateAppearance
      /** 그 타석이 끝났을 때의 카운트 — 다음 부름 머리 0xc0ee8(c0f7c → 0xb6764)가 새 타자로 넘길 때 st[4] · st[5] 를 지운다 */
      readonly strikes: number
      readonly balls: number
    } & HalfInningTickState)

/**
 * 그 틱이 끝난 자리의 판 — 0x21 그리기(두 팀 판 0x420dc · 0x42364)가 읽는 칸.
 * - `battingOrderIndex`: 타순 커서 팀[+0x32] — 타석 틱이면 **방금 친 타자**(다음 타자로 넘기는 것은 다음 부름 머리 0xc0ee8 →
 *   0xaebe4 의 예약 확정), 교체 틱이면 그 부름 머리에서 넘어온 지금 타자.
 * - `lineup`: 그때 명단(대타 포함) · `pitcherSlot`: 그때 마운드 투수 칸 · `outs`: st[6]
 */
export interface HalfInningTickState {
  readonly battingOrderIndex: number
  readonly lineup?: QuickLineup
  readonly pitcherSlot?: number
  readonly outs: number
}

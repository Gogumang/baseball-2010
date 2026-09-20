import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * 시즌 아이템 하위 메뉴 (장면 0x105 상태 **0xd0**, 갱신 0x4d04 · 키 0x4da4 · 그리기 0x7538).
 *
 * 근거: `docs/re/P4-season-flow.md` 1a 상태표("아이템 하위 메뉴", 키 0x4da4 → **0xdc**) ·
 * 1b(관리 메뉴 칸 4) · **5 절**(공용 선수 고르기 0xdf 의 `this+0x110 == 1` 이 "아이템(0xd0) →
 * 장착아이템" 에서 들어오고 취소하면 0xd0 으로 돌아온다),
 * `docs/re/R13-season-leftovers.md` 표(0xd0 그리기 = 공통 틀 0x9f60),
 * `docs/re/R12-shop-guards.md` 22행·`docs/re/S3-stadium-items.md` 3절(아이템 창 종류 `[win+0x1a4]`).
 *
 * **칸 목록의 근거는 StrHOWTO[18] "[아이템] : 장비, GP아이템"** 이다 — 설명서가 두 가지만 적었다.
 *
 * ⚠️ **0xd0 의 갱신 0x4d04·그리기 0x7538 은 아직 안 풀렸다** — 칸 수·차례를 확정할 수 없어
 * 설명서가 적은 두 칸만 둔다. 시즌 **서브아이템 상점**(창 종류 1, 가격표 `0xcc430` ×10 =
 * 100만 단위, R12 (나)절)도 시즌에 분명히 있지만 **어느 칸으로 들어가는지가 문서에 없다** →
 * 지어내지 않았다. 밝혀지면 이 표에 `{ label: '서브아이템', windowKind: 1, target: 아이템상점 }`
 * 한 줄을 더하면 된다.
 */

/** 아이템 창 종류 `[win+0x1a4]` — 1 서브아이템 · 2 GP · 3 장비 · 4 구장 (R12 · S3) */
export const ITEM_WINDOW_KIND = { 서브아이템: 1, GP아이템: 2, 장비: 3, 구장아이템: 4 } as const
export type ItemWindowKind = (typeof ITEM_WINDOW_KIND)[keyof typeof ITEM_WINDOW_KIND]

export interface SeasonItemMenuEntry {
  readonly label: string
  /** 이 칸이 여는 아이템 창의 종류 */
  readonly windowKind: ItemWindowKind
  /** 이 칸이 가는 장면 상태 */
  readonly target: SeasonSceneState
  readonly description: string
}

/**
 * 아이템 메뉴 칸.
 *
 * - **장비**: 먼저 선수를 고른다(0xdf, `this+0x110 = 1`) → 그 선수의 장비 상점 0xdc.
 *   ⚠️ 나만의리그에서 영입된 선수는 StrMODE[220] 로 거절한다 (P4 5절) — 선수 고르기 쪽 규칙이라
 *   이 화면에는 없다.
 * - **GP아이템**: 곧장 아이템 상점 0xdc(창 종류 2). 효과표는 P4 6절의 `0xa310c` 8칸이다.
 *
 * 구장 아이템(창 종류 4)은 여기가 아니라 **구단관리 → 구장관리(0xea)** 쪽이다 (S3).
 */
export const SEASON_ITEM_MENU: readonly SeasonItemMenuEntry[] = [
  {
    label: '장비',
    windowKind: ITEM_WINDOW_KIND.장비,
    target: SEASON_SCENE_STATE.선수고르기,
    description: '선수를 골라 장비 4부위를 사서 장착한다',
  },
  {
    label: 'GP아이템',
    windowKind: ITEM_WINDOW_KIND.GP아이템,
    target: SEASON_SCENE_STATE.아이템상점,
    description: 'G포인트로 사는 아이템 — 추첨·사기·질병·목표점·트레이드·구내매점',
  },
]

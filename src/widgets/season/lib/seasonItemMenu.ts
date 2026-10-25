import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * 시즌 아이템 하위 메뉴 (장면 0x105 상태 **0xd0**, 갱신 0x4d04 · 키 0x4da4 · 그리기 공통 틀 0x9f60).
 *
 * 직접 떴다:
 * ```
 * 0x4d04 (들어옴) 이전 상태가 0xc9 면 메뉴(this+0x88) 커서를 (0,0) 으로 · 바탕 0x76705(…, 0x23, 0xbe, 0x1e)
 * 0x4da4 (키)    확인: 칸 = 행 × 열수 + 열
 *                  칸 0 → this+0x110 = 1 · 0xdf (선수 고르기 → 그 선수의 장비 창)
 *                  그 밖 → 0xdc (아이템 상점)
 *                취소(−16) → 0xc9
 * 0x5f3c (0xdc 들어옴) 같은 메뉴 칸으로 창 종류 [win+0x1a4] 를 고른다:
 *                  0 → 3 장비 · 1 → 4 구장 (관중석 SR+0x1b8 · 전광판 +0x1b9 · 잔디 +0x1ba 로 구장 그림)
 *                  2 → 1 서브아이템 · 3 → 2 GP아이템 (이전 상태가 0xe8 이면 GP 창 커서를 셋 아래로)
 * ```
 * 그래서 칸은 **넷**이고 차례가 위와 같다. 칸 글은 문자열 표가 아니라 img_text 그림이다 — 커맨드 줄 표 0xd47b8
 * [100 · 288 · 105 · 110](`seasonCommandBar` 머리말) 그림이 차례로 "장착아이템" · "구장아이템" · "서브아이템" · "GP아이템" 이다
 * (img_text 그림을 직접 봤다). 아래 `label` 은 그 그림 글 그대로다.
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
}

/** 아이템 메뉴 칸 — 키 0x4da4 · 0xdc 들어옴 0x5f3c 의 칸 차례 그대로 */
export const SEASON_ITEM_MENU: readonly SeasonItemMenuEntry[] = [
  {
    label: '장착아이템',
    windowKind: ITEM_WINDOW_KIND.장비,
    // 칸 0 만 선수를 먼저 고른다 (this+0x110 = 1 → 0xdf, 취소하면 0xd0 으로 — P4 5절)
    target: SEASON_SCENE_STATE.선수고르기,
  },
  {
    label: '구장아이템',
    windowKind: ITEM_WINDOW_KIND.구장아이템,
    target: SEASON_SCENE_STATE.아이템상점,
  },
  {
    label: '서브아이템',
    windowKind: ITEM_WINDOW_KIND.서브아이템,
    target: SEASON_SCENE_STATE.아이템상점,
  },
  {
    label: 'GP아이템',
    windowKind: ITEM_WINDOW_KIND.GP아이템,
    target: SEASON_SCENE_STATE.아이템상점,
  },
]

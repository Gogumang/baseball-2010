import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { PLAYER_OWN_BIT } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'

/**
 * **공용 선수 고르기 0xdf 의 목적 `this+0x110`** (들어옴 0x5980 · 키 0xc3e8 · 그리기 0xb010 — 직접 떴다).
 *
 * | 목적 | 세우는 곳 | 취소 → | 확인 → |
 * |---|---|---|---|
 * | 1 장착아이템 | 아이템 0xd0 키 0x4da4 칸 0 | 0xd0 | 0xb6388(선수) 이면 StrMODE[220] 알림(그 자리), 아니면 장비 창 0xdc |
 * | 2 선수정보 | 시즌정보 0xcd 키 0x9008 칸 2 | 0xcd | 선수 카드 0xd9 |
 * | 3 선수영입 | 선수영입 0xe2 키 0xe340 (중복이 아닐 때) | 0xe2 | 영입 확정 0xc4ea |
 *
 * 세 목적이 같은 상태·같은 목록 객체 `[this+0xa8]` 를 쓴다. 다른 점은:
 * - 탭: 목적 3 은 영입 후보 종류(투수 1·3 → 1)로 고정, 그 밖은 1(투수) — 단 이전 상태가 0xd9·0xdc 이고
 *   `[this+0xc0]+0x24c`(카드·장비 창에 띄운 선수가 타자)면 0(타자). 들어올 때마다 목록을 다시 채워 커서는 0.
 * - 목록 키 0x6fe0: 목적 3 은 '*'(탭 뒤집기)를 목록에 안 넘긴다 — 영입 자리는 후보 종류의 배열에서만 고른다.
 * - 머리띠 바닥 0xb010: 목적 3 은 7(되돌아가기 + 0상세정보), 그 밖은 탭대로 0xf / 0x17(+ "#타자"/"#투수").
 * - 목적 3 만 들어올 때 StrMODE[179] 알림을 띄운다.
 */
export const PLAYER_PICK_PURPOSE = { 장착아이템: 1, 선수정보: 2, 선수영입: 3 } as const
export type PlayerPickPurpose = (typeof PLAYER_PICK_PURPOSE)[keyof typeof PLAYER_PICK_PURPOSE]

/** 0xc3e8 의 취소 갈래 */
export function playerPickCancelTarget(purpose: PlayerPickPurpose): SeasonSceneState {
  if (purpose === PLAYER_PICK_PURPOSE.장착아이템) return SEASON_SCENE_STATE.아이템
  if (purpose === PLAYER_PICK_PURPOSE.선수정보) return SEASON_SCENE_STATE.시즌정보
  return SEASON_SCENE_STATE.선수영입
}

/** StrMODE[220] 번 — 목적 1 에서 나리 선수를 고르면 (0xc4b8~0xc4d0, `0xbbef9(…, 1, 1, 1)`) */
export const NARI_EQUIP_REFUSAL_TEXT_ID = 220

/**
 * 목적 1 의 거절 — `0xb6388(선수)` = (s8 +0xa) < 0, 곧 +0xa 비트 7. 나리 선수(+0xa 0x80/0xa0)만 걸린다 —
 * 명예의 전당 선수는 등록이 +0xa 를 0 / 0x20 으로 덮어 비트 7 이 없어 장비를 살 수 있다 (P4 5절).
 */
export function refusesEquipment(player: SeasonPlayer): boolean {
  return (player.kindByte & PLAYER_OWN_BIT) !== 0
}

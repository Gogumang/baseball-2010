import { seasonScoreboardRewindXOf } from '@/widgets/batting-stage/lib/renderScenery'

/**
 * **장면 구장** `[장면 0x105 + 0x10c]` 의 칸 가운데 구장관리(0xea)·구장 아이템 상점(0xdc 종류 4) 미리보기가 남겨 두는 것.
 *
 * 구장은 장면 0x105 초기화 0x3b14 가 `0x1239(0x94)`(할당 0x2ac4 가 0 으로 채운다) → 생성자 0x76b24 → 0x76ac8 로 만든다
 * (76ad2 +0x10 = 0 · 76ad4 +0x14 = 0, +0x18 · +0x8c 는 memset 의 0). 장면 전환 0x3874 가 경기 장면 0x104 로 가며 장면을
 * 지우므로 수명은 장면 0x105 와 같다 — 웹은 `SeasonScreens` 가 들고 경기직전(0xe1)에 처음 값으로 되돌린다.
 *
 * 쓰는 곳 (직접 떴다):
 * ```
 * 구장관리 진입 0xe4d0   e558 0x783b0(구장)    ; +0x10 = 하늘 줄(모드 2: SR+0xb2 mod 6) · +0x18 = (s8)[0x1552d0c]+0x6b
 *                        e560 0x76fc5(구장, 0) ; +0x14 = min(+0x18, 12)
 * 상점 진입 0x5f3c       6250 0x76fc5(구장, 0) ; 0x783b0 은 안 부른다 → 하늘 줄 · +0x18 은 앞서 구장관리가 둔 값(없으면 0)
 *                        62ee 0x77edc(구장, 1) ; 전광판 글자 되감기 (`seasonScoreboardRewindXOf`)
 * 상점 그리기 0xb1f8     b24e 0x77fb5(구장, 1) ; 그린 뒤 +0x8c −= 1 (`stepSeasonScoreboardX`) — 구장관리 그리기 0xb158 은 안 부른다
 * 상점 키 0x957c         9c82 칸 목록 취소 — 저장값으로 되돌린 뒤 0x77edc(구장, 1)
 *                        9d70 전광판(종류 1) 칸 미리보기를 갈아 끼운 뒤 0x77edc(구장, 1)
 * ```
 * 0x783b0 을 부르는 시즌 장면 함수는 0xe4d0 하나, +0x8c 를 쓰는 곳은 0x77edc · 0x77fb4 둘뿐이다(xref · `#0x8c` 전수).
 */
export interface StadiumPreviewScene {
  /** 구장 +0x10 — 하늘 표 줄 */
  readonly skyRow: number
  /** 구장 +0x18 — 하늘 칸(자르기 전). 0x76fc5 가 min(·, 12) 로 +0x14 에 넣는다(`skyColorsOf`) */
  readonly skyColumn: number
  /** 구장 +0x8c — 전광판 글자 x 이동 */
  readonly scoreboardX: number
}

/** 장면을 새로 세웠을 때 (생성자 0x76ac8 · memset) */
export const INITIAL_STADIUM_PREVIEW_SCENE: StadiumPreviewScene = { skyRow: 0, skyColumn: 0, scoreboardX: 0 }

/** 0x77edc(구장, 1) — 전광판 칸 0 · 5 면 그대로 */
export function rewoundScoreboardX(x: number, board: number): number {
  return seasonScoreboardRewindXOf(board) ?? x
}

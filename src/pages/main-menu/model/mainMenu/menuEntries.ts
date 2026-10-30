import { GAME_START_MENU } from '@/shared/config/original/mainMenu'
import { TOP_MENU } from '@/shared/config/original/mainMenu'
import type { MainMenuEntry } from '@/shared/config/original/mainMenu'
import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

/**
 * 원작 메인 메뉴는 **두 단**이다. 장면 0x103 의 하위 상태 번호를 그대로 단 번호로 쓴다
 * (갱신 점프표 0xcefa4 = 상태−2 로 점프, H-modes 1절):
 *   4 = 처음 메뉴 (게임시작·스페셜·도움말·환경설정·랭킹·게임문의 — 갱신 0x29454, 진입 0x24a40)
 *   5 = 게임시작 목록 (최근게임~미션모드 — 갱신 0x28cb0, 진입 0x25b88)
 *   9 = 랭킹 모드 목록 (다섯 칸 — 갱신 0x28ad4, 진입 0x23d98, 그리기 0x285dc)
 * 셋 다 같은 판 0x24b1c(반원 바퀴)를 그리고, 5·9 는 그 위에 하위 목록 0x2524c(this, 5|9) 를 더 그린다
 * (F-ui-layout 4-0·4-2 · P6-screens 2d · 9 는 P6 1-2 U-94 정정).
 */
export type MainMenuTier = 4 | 5 | 9

/**
 * 처음 메뉴 6칸. 순서는 StrMAINMENU [0]~[4]·[209] 그대로다.
 * 랭킹 = 하위 9 모드 목록(오프라인, OK 부터 서버 🌐), 게임문의 = 하위 10 도움말 뷰어 장 6.
 */
export const TOP_ENTRIES: readonly MainMenuEntry[] = TOP_MENU

/**
 * **랭킹 모드 목록**(하위 9) 다섯 칸 — 진입 0x23d98 이 항목 글자 표 0xcea00(img_text 9·12·15·18·20)을 `[0x1552d28]` 로,
 * 개수 5 를 `[this+0xe9]` 에 넣는다. 판 안 큰 글자는 0x2524c 의 표 0xceb37 = main_ui 프레임 [7, 8, 9, 10, 13],
 * 설명은 0x2583e 의 `StrMAINMENU[0x18 + 커서]` = [24]~[28] (원문 그대로 — 홈런더비 칸 설명이 "훈련모드" 다).
 * OK 는 `[skin+0xe6]` = 커서 · 하위 37(랭킹 모드별 화면 → 38 서버 🌐) — 웹은 통신이 없다 (`RANKING_SERVER_NOTICE`).
 */
export const RANKING_ENTRIES: readonly MainMenuEntry[] = [
  { id: '랭킹일반모드', labelFrame: 7, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[24] ?? '' }, // [24]
  { id: '랭킹나만의리그', labelFrame: 8, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[25] ?? '' }, // [25]
  { id: '랭킹시즌모드', labelFrame: 9, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[26] ?? '' }, // [26]
  { id: '랭킹대전모드', labelFrame: 10, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[27] ?? '' }, // [27]
  { id: '랭킹홈런더비', labelFrame: 13, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[28] ?? '' }, // [28]
]

/**
 * ⚠️ **웹판 근사**: 랭킹 목록 OK 는 하위 37(모드별 화면 · 아이디 등록) → 38(서버 218.145.70.37:32206 접속 🌐) 이다.
 * 웹은 서버가 없어 그 자리에 이 안내만 띄우고 목록에 남는다 — 원본 글이 아니다.
 */
export const RANKING_SERVER_NOTICE = '!C랭킹은 서버 통신이!N필요해 볼 수 없습니다'

/** 게임시작 목록 7칸. 순서는 StrMAINMENU [6]~[12] 그대로다. */
export const MODE_ENTRIES: readonly MainMenuEntry[] = GAME_START_MENU

export function entriesOf(tier: MainMenuTier): readonly MainMenuEntry[] {
  if (tier === 4) return TOP_ENTRIES
  return tier === 9 ? RANKING_ENTRIES : MODE_ENTRIES
}

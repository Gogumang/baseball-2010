import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'
import { ROW_COUNT } from '@/pages/settings/lib/settingsLayout/settingsRows'

/** 첫 화면 격자 1열×7행(0x259fc `vtbl+0x10(1, 7, 1, 0x20, 0)`) — 줄 여섯 + OK 칸. 플래그 0x20 = 세로만 감긴다 */
export const MAIN_MENU_CURSOR_COUNT = ROW_COUNT + 1

/** 설명 띠 0x55544 자체는 `shared/ui/DescriptionBand` 에 있다 — 환경설정은 0x593c8 머리 0x59462~0x5948c(격자 바뀜)에서 다시 편다 */

/** 첫 화면 줄 설명 StrMAINMENU[0x20 + 커서] (커서 0~5) */
export const SETTINGS_DESCRIPTIONS = [
  ORIGINAL_MAIN_MENU_TEXT[32] ?? '', // [32]
  ORIGINAL_MAIN_MENU_TEXT[33] ?? '', // [33]
  ORIGINAL_MAIN_MENU_TEXT[34] ?? '', // [34]
  ORIGINAL_MAIN_MENU_TEXT[35] ?? '', // [35]
  ORIGINAL_MAIN_MENU_TEXT[36] ?? '', // [36]
  ORIGINAL_MAIN_MENU_TEXT[37] ?? '', // [37]
] as const

/** 상세 설정 줄 설명 StrMAINMENU[0x26 + 커서] (커서 0~3) */
export const DETAIL_DESCRIPTIONS = [
  ORIGINAL_MAIN_MENU_TEXT[38] ?? '', // [38]
  ORIGINAL_MAIN_MENU_TEXT[39] ?? '', // [39]
  ORIGINAL_MAIN_MENU_TEXT[40] ?? '', // [40]
  ORIGINAL_MAIN_MENU_TEXT[41] ?? '', // [41]
] as const

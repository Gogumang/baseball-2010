import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

/**
 * 기록연감 **탭 4(통계)** 의 줄 이름 — 원작 `data/StrMAINMENU.zt1` **[129] ~ [182]** 그대로다
 * (P6 2c "탭 4 통계 … StrMAINMENU[129~182](모드별 판 수·GP 통계)").
 *
 * 대괄호 안 번호가 원본 인덱스다 — `shared/config/original/mainMenu.ts` 관례를 따랐다.
 * (생성기가 만드는 표가 아니라 손으로 옮긴 표다. 원문에 붙은 꼬리 공백은 떼고 적었다.)
 *
 * 줄 묶음은 원본 차례 그대로 세 덩이다:
 *   [129]~[135] 모드별 플레이 시간 · [136]~[140] 우승·추천 횟수 · [141]~[167] GP 아이템 구매 수 · [168]~[182] G포인트 획득·소모
 *
 * 줄 배치는 이 표의 차례가 아니라 칸 번호(쪽 × 8 + 줄)다 — `statCells.ts` (0x7a08c). [159]·[160] 은 칸이 없어 안 보인다.
 */
export const STAT_NAMES: readonly string[] = [
  ORIGINAL_MAIN_MENU_TEXT[129] ?? '', // [129]
  ORIGINAL_MAIN_MENU_TEXT[130] ?? '', // [130]
  ORIGINAL_MAIN_MENU_TEXT[131] ?? '', // [131]
  ORIGINAL_MAIN_MENU_TEXT[132] ?? '', // [132]
  ORIGINAL_MAIN_MENU_TEXT[133] ?? '', // [133]
  ORIGINAL_MAIN_MENU_TEXT[134] ?? '', // [134]
  ORIGINAL_MAIN_MENU_TEXT[135] ?? '', // [135]
  ORIGINAL_MAIN_MENU_TEXT[136] ?? '', // [136]
  ORIGINAL_MAIN_MENU_TEXT[137] ?? '', // [137]
  ORIGINAL_MAIN_MENU_TEXT[138] ?? '', // [138]
  ORIGINAL_MAIN_MENU_TEXT[139] ?? '', // [139]
  ORIGINAL_MAIN_MENU_TEXT[140] ?? '', // [140]
  ORIGINAL_MAIN_MENU_TEXT[141] ?? '', // [141]
  ORIGINAL_MAIN_MENU_TEXT[142] ?? '', // [142]
  ORIGINAL_MAIN_MENU_TEXT[143] ?? '', // [143]
  ORIGINAL_MAIN_MENU_TEXT[144] ?? '', // [144]
  ORIGINAL_MAIN_MENU_TEXT[145] ?? '', // [145]
  ORIGINAL_MAIN_MENU_TEXT[146] ?? '', // [146]
  ORIGINAL_MAIN_MENU_TEXT[147] ?? '', // [147]
  ORIGINAL_MAIN_MENU_TEXT[148] ?? '', // [148]
  ORIGINAL_MAIN_MENU_TEXT[149] ?? '', // [149]
  ORIGINAL_MAIN_MENU_TEXT[150] ?? '', // [150]
  ORIGINAL_MAIN_MENU_TEXT[151] ?? '', // [151]
  ORIGINAL_MAIN_MENU_TEXT[152] ?? '', // [152]
  ORIGINAL_MAIN_MENU_TEXT[153] ?? '', // [153]
  ORIGINAL_MAIN_MENU_TEXT[154] ?? '', // [154]
  ORIGINAL_MAIN_MENU_TEXT[155] ?? '', // [155]
  ORIGINAL_MAIN_MENU_TEXT[156] ?? '', // [156]
  ORIGINAL_MAIN_MENU_TEXT[157] ?? '', // [157]
  ORIGINAL_MAIN_MENU_TEXT[158] ?? '', // [158]
  ORIGINAL_MAIN_MENU_TEXT[159] ?? '', // [159]
  ORIGINAL_MAIN_MENU_TEXT[160] ?? '', // [160]
  ORIGINAL_MAIN_MENU_TEXT[161] ?? '', // [161]
  ORIGINAL_MAIN_MENU_TEXT[162] ?? '', // [162]
  ORIGINAL_MAIN_MENU_TEXT[163] ?? '', // [163]
  ORIGINAL_MAIN_MENU_TEXT[164] ?? '', // [164]
  ORIGINAL_MAIN_MENU_TEXT[165] ?? '', // [165]
  ORIGINAL_MAIN_MENU_TEXT[166] ?? '', // [166]
  ORIGINAL_MAIN_MENU_TEXT[167] ?? '', // [167]
  ORIGINAL_MAIN_MENU_TEXT[168] ?? '', // [168]
  ORIGINAL_MAIN_MENU_TEXT[169] ?? '', // [169]
  ORIGINAL_MAIN_MENU_TEXT[170] ?? '', // [170]
  ORIGINAL_MAIN_MENU_TEXT[171] ?? '', // [171]
  ORIGINAL_MAIN_MENU_TEXT[172] ?? '', // [172]
  ORIGINAL_MAIN_MENU_TEXT[173] ?? '', // [173]
  ORIGINAL_MAIN_MENU_TEXT[174] ?? '', // [174]
  ORIGINAL_MAIN_MENU_TEXT[175] ?? '', // [175]
  ORIGINAL_MAIN_MENU_TEXT[176] ?? '', // [176]
  ORIGINAL_MAIN_MENU_TEXT[177] ?? '', // [177]
  ORIGINAL_MAIN_MENU_TEXT[178] ?? '', // [178]
  ORIGINAL_MAIN_MENU_TEXT[179] ?? '', // [179]
  ORIGINAL_MAIN_MENU_TEXT[180] ?? '', // [180]
  ORIGINAL_MAIN_MENU_TEXT[181] ?? '', // [181]
  ORIGINAL_MAIN_MENU_TEXT[182] ?? '', // [182]
]

/** 원본 첫 줄 번호 — 줄 i 의 원본 인덱스는 `STAT_NAME_FIRST_INDEX + i` 다 */
export const STAT_NAME_FIRST_INDEX = 129

import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import type { CareerResetEdition } from '@/entities/settings/model/modeReset'

export type ModeResetPopup =
  | { readonly kind: '나리고르기' }
  | { readonly kind: '나리막힘'; readonly text: string }
  | { readonly kind: '나리확인'; readonly edition: CareerResetEdition }
  | { readonly kind: '시즌확인' }
  | { readonly kind: '에디트확인' }
  | { readonly kind: '완료' }

/**
 * 세 확인 창의 처음 커서 — 띄운 바로 뒤 `0x749d5(창, 1)` 로 둘째 칸 **"아니오"** 에 둔다
 * (나리 [210]/[211] 0x2c930 · 시즌 0xcf870 0x2c7fa · 에디트 0xcf8d4 0x2c81c).
 */
export const CONFIRM_FIRST_CURSOR = 1

/**
 * 나만의리그 칸 고르기 창 0xcf848 (종류 0x10, 0x2c746~0x2c7e4) — 버튼은 메인 메뉴 [14] 와 같은 그림:
 * 0 타자편 popup 고른 13 / 보통 11 (이미지 표 +0x34/+0x2c) · 1 투수편 14 / 12 (+0x38/+0x30). 2열×1행 · 간격 0x74805(창, 0x3c, 0).
 * 처음 커서 0x749d5 를 안 불러 타자편에서 시작한다. CLR → −1 → 하위 0.
 */
export const CAREER_CHOOSE_BUTTONS = ['타자편', '투수편'] as const
export const CAREER_CHOOSE_FRAMES = [
  { normal: 11, selected: 13 },
  { normal: 12, selected: 14 },
] as const
export const CAREER_CHOOSE_GRID = { columns: 2, gapX: 0x3c, gapY: 0 } as const
export const CAREER_CHOOSE_CANCEL = -1

export const MODE_RESET_NAMES = [SETTINGS_TEXT.careerReset, SETTINGS_TEXT.seasonReset, SETTINGS_TEXT.editReset] as const

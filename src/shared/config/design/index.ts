import colors from '@/shared/config/design/colors.json'

/**
 * 색 토큰. 화면 코드에서 색을 직접 적지 말고 여기서 꺼내 쓴다.
 *
 *   original — 원본(binary.mod)에서 읽은 색. 배치 명세의 값 그대로다.
 *   ui       — 웹판이 정한 색(글자·패널·강조). 원본에 없는 부분에만 쓴다.
 */
export const ORIGINAL_COLORS = colors.original
export const UI_COLORS = colors.ui

export type OriginalColorName = keyof typeof ORIGINAL_COLORS

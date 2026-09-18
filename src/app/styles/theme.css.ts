import { createGlobalTheme } from '@vanilla-extract/css'
import { UI_COLORS } from '@/shared/config/design'

/**
 * 피처폰 화면의 색·치수 토큰.
 *
 * 색 값은 `shared/config/design/colors.json` 에 있다 (원본 색과 웹 색을 나눠 담았다).
 */
export const theme = createGlobalTheme(':root', {
  color: UI_COLORS,
  size: {
    /** 원작 해상도. 도트를 살리려면 화면 전체를 정수배로만 키워야 한다. */
    screenWidth: '240px',
    screenHeight: '320px',
  },
  font: {
    body: "'Galmuri11', 'Galmuri9', 'DungGeunMo', 'Apple SD Gothic Neo', monospace",
  },
})

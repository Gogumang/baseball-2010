import { createGlobalTheme } from '@vanilla-extract/css'
import { UI_COLORS } from '@/shared/config/design'

/**
 * 원본 비트맵 글꼴을 구운 웹폰트의 글꼴 이름.
 *
 * 만드는 법은 `tools/build_webfont.py` 머리 주석에 있다. `@font-face` 선언은
 * `app/styles/global.css.ts` 가 한다 — 여기는 이름만 들고 있다.
 */
export const PIXEL_FONT_FAMILY = 'SynGak9'

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
    /**
     * 원본 synGak9_11(한글 9x11) + synGulimAsc5_11(영문 5x11) 을 구운 웹폰트.
     *
     * 뒤에 오는 대체 글꼴은 **2350자 밖 글자(뷁·갂 …) 몫이다.** 원본은 그런 글자를 아예
     * 안 그리고 전진도 안 하는데, 웹폰트에 없는 글자는 브라우저가 반드시 대체 글꼴로 그린다
     * (빈 글리프 8800개를 더 넣지 않는 한 그 동작은 막을 수 없다). 그래서 **같은 11px 도트
     * 글꼴인 Galmuri** 를 바로 뒤에 둔다 — 줄 높이와 도트 격자가 그대로 유지돼 한 글자만
     * 튀어 보이고, 시스템 고딕으로 떨어져 줄이 통째로 어긋나는 일이 없다. 원본과 다른
     * **근사**지만, 글자가 소리 없이 사라지는 것보다 이식 실수가 눈에 잘 띈다.
     */
    body: `'${PIXEL_FONT_FAMILY}', 'Galmuri11', 'Galmuri9', 'DungGeunMo', monospace`,
  },
})

import { globalStyle, style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 장 넘기기 칸 — 원본은 좌우 키(0x637d0)뿐이라 이 단추는 웹판 편의다 */
export const sectionButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  cursor: 'pointer',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})

/** 바닥띠 되돌아가기 표시 (바닥 비트 0x4) */
export const backButton = style({
  position: 'absolute',
  display: 'block',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})

/** 본문 창 = 공용 판 0x55e61 (기록연감·환경설정과 같은 가운데 192 판) */
export const panel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 쪽 제목 — 흰 글 */
export const bodyTitle = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
})

/** 본문 글 — StrHOWTO 원문 마크업 그대로 */
export const bodyText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  // 줄 높이는 12px — 원본 줄간(11+3=14)보다 2px 좁다. 본문 칸 아래 244px 에 장 넘기기 단추가
  // 있어 12줄짜리 첫 장이 14px(168) · 13px(156) 로는 그 단추를 덮는다. 12px 면 144 라 안 겹친다.
  // **근사다** — 줄 높이는 도트 또렷함과 무관하니 글자 크기는 11px 그대로 둔다.
  lineHeight: '12px',
  overflowY: 'auto',
})

// 본문은 `MarkupText` 가 <p> 로 그린다 — 그쪽 줄 높이(원본 14px)가 이겨서 여기서 다시 눌러 준다
globalStyle(`${bodyText} p`, { lineHeight: '12px' })

/** 쪽 번호 */
export const pagerText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
})

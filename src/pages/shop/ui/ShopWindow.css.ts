import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { SHOP_COLORS } from '@/pages/shop/lib/shopLayout'

/** 원작 좌표에 그대로 놓는 그림 한 장 (GameWindow.layer 와 같은 규칙) */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * img_text 글 그림에 색을 입힌다 — 원본은 효과 11(단색)로 찍는다 (0x81ea2).
 * 그림을 마스크로 쓰고 배경색을 칠하면 같은 결과가 된다.
 */
export const tintedLabel = style({
  position: 'absolute',
  pointerEvents: 'none',
  maskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
})

/** 격자 칸을 고르는 투명 단추 — 그림은 아이콘이 따로 그린다 */
export const slotButton = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: SHOP_COLORS.text,
  fontSize: '11px',
  cursor: 'pointer',
})

/** 이미 가진 칸은 아이콘을 어둡게 한다 (원본 표시 방법은 미확인 — 추정) */
export const ownedIcon = style({
  filter: 'brightness(0.45)',
})

/** 이름 딱지 박스 3 — #12307E 채우기에 위·왼 어두운 선, 아래·오른 빛 (0x8225e~0x82396) */
export const nameTag = style({
  position: 'absolute',
  boxSizing: 'border-box',
  background: SHOP_COLORS.nameFill,
  borderTop: `1px solid ${SHOP_COLORS.nameEdge}`,
  borderLeft: `1px solid ${SHOP_COLORS.nameEdge}`,
  borderBottom: `1px solid ${SHOP_COLORS.nameHighlight}`,
  borderRight: `1px solid ${SHOP_COLORS.nameHighlight}`,
})

export const text = style({
  position: 'absolute',
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
})

/** 이름 글 — 검정 그림자(+1,+1) 뒤 흰 글 */
export const nameShadow = style([text, { color: ORIGINAL_COLORS.black }])
export const nameText = style([text, { color: SHOP_COLORS.text }])

/** 설명 박스 4 — 왼쪽 위 정렬, 줄마다 흰 글 (0x802dd) */
export const description = style({
  position: 'absolute',
  pointerEvents: 'none',
  color: SHOP_COLORS.text,
  fontSize: '11px',
  overflow: 'hidden',
})

export const descriptionLine = style({
  margin: 0,
  whiteSpace: 'pre-wrap',
})

/** 부위 탭 — 장비 상점에만 있다 (웹이 더한 것) */
export const partTab = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: SHOP_COLORS.text,
  fontSize: '10px',
  cursor: 'pointer',
})

export const partTabOn = style({
  color: ORIGINAL_COLORS.highlightYellow,
})

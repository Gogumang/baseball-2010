import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 선수 등록은 원작 240×320 좌표를 그대로 쓴다 — 조각마다 절대 배치다 (0x15f34) */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/**
 * 바탕에 까는 공용 창 0x55e60 (F-8 확정): #335FCD 둥근 판 + #080408 1px 테두리 + 안쪽 흰 테두리.
 * 원본 바탕 0x7f4ed 의 속은 미해독이라, 이 판으로 빈 칸을 메운다.
 */
export const backdrop = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
  pointerEvents: 'none',
})

/** 기본정보 카드 판 — 그림칸(11,53,93,117)·오른쪽 판(122,48,107,84). 원본 0x7ba44 그리기는 박스만 확인 (추정) */
export const cardPanel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.boardEdge}`,
  background: ORIGINAL_COLORS.panelDeep,
  pointerEvents: 'none',
})

/** 정보 판 (21,176,196,83) #335FCD */
export const infoBoard = style({
  position: 'absolute',
  background: ORIGINAL_COLORS.boardFill,
  pointerEvents: 'none',
})

/** 선수 미리보기 묶음 — 좌타면 발 기준을 축으로 좌우를 뒤집는다 */
export const figure = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
})

/** 정보 칸 값 — 시스템 글꼴 가운데 (0x7c450) */
export const infoValue = style([
  layer,
  { fontSize: '11px', lineHeight: '15px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' },
])

/**
 * 이름 칸. 원본은 폰 입력기(모드 A/a/1/가 · 멀티탭)를 쓰지만 웹은 일반 input 으로 대신한다
 * (R11 2-3: 지킬 규칙은 CP949 8바이트와 "빈 이름은 확인 불가" 둘뿐이다).
 */
export const nameInput = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  font: 'inherit',
  fontSize: '11px',
  lineHeight: '15px',
  textAlign: 'center',
  outline: 'none',
  selectors: {
    '&:focus': { background: ORIGINAL_COLORS.panelDeep },
    '&::placeholder': { color: ORIGINAL_COLORS.boardHighlight },
  },
})

/** 노란 깜빡이 커서 (0x16038) — 값 칸을 사방 1px 키운 테두리 */
export const cursor = style({
  position: 'absolute',
  boxSizing: 'border-box',
  pointerEvents: 'none',
})

/** 값 칸 누름 — 그 줄로 커서를 옮긴다 (원본은 위아래 키로 옮긴다) */
export const valueButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.highlightYellow}` },
  },
})

/** 고른 줄 양옆 화살표 (그림은 근사) */
export const arrowButton = style({
  position: 'absolute',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  imageRendering: 'pixelated',
})

export const hint = style([
  layer,
  {
    color: ORIGINAL_COLORS.text,
    fontSize: '10px',
    lineHeight: '12px',
    textAlign: 'center',
  },
])

export const actionButton = style({
  position: 'absolute',
})

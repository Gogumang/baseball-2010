import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEXT } from '@/widgets/season/lib/seasonWindowLayout'

/**
 * 시즌모드 창들이 함께 쓰는 스타일.
 * 공용 창 0x55e60 의 모양(둥근 #335FCD 판 + 검정 테두리 + 안쪽 흰 선)은 선 목록만 확인돼
 * 다른 창들(GameWindow.css)과 같은 방식으로 근사한다.
 */

/** 원작 좌표에 그대로 놓는 그림·글 한 장 */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 공용 판 0x55e60 (24, 54, 192, 212) */
export const window = style({
  position: 'absolute',
  boxSizing: 'border-box',
  border: `1px solid ${ORIGINAL_COLORS.windowBorder}`,
  borderRadius: '6px',
  background: ORIGINAL_COLORS.boardFill,
  boxShadow: `inset 0 0 0 1px ${ORIGINAL_COLORS.text}`,
})

/** 판 안의 작은 칸 (아이템 창 박스와 같은 #1D44A8 채우기) */
export const innerBox = style({
  position: 'absolute',
  boxSizing: 'border-box',
  background: ORIGINAL_COLORS.panelDeep,
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeOuter}`,
})

const baseText = {
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.size}px`,
  lineHeight: `${TEXT.lineHeight}px`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
} as const

/** 제목 줄 — 가운데 흰 글 */
export const title = style({ ...baseText, textAlign: 'center', pointerEvents: 'none' })

/** 판 안의 설명·알림 글 (줄바꿈 허용) */
export const notice = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  whiteSpace: 'pre-line',
  pointerEvents: 'none',
})

/** 목록 한 줄 — 원본 커서는 고른 줄을 노란 글로 바꾼다 (다른 화면들과 같은 방식) */
export const row = style({
  ...baseText,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:disabled': { cursor: 'default', color: ORIGINAL_COLORS.tableDivider },
  },
})

/** 고른 줄 */
export const rowSelected = style({
  color: ORIGINAL_COLORS.highlightYellow,
})

/** 줄 왼쪽 커서 표시 — ▶ 는 대체 글꼴이 그려 11px 에서 10px 을 먹는다 (8px 이면 1px 삐져나왔다) */
export const cursor = style({
  width: '10px',
  flex: '0 0 10px',
  color: ORIGINAL_COLORS.cursorCyan,
})

/** 줄 이름 */
export const rowLabel = style({ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis' })

/** 줄 오른쪽 값 (가격·수치) */
export const rowValue = style({ flex: '0 0 auto', color: 'inherit' })

/** 이미 가진 칸·못 고르는 칸 */
export const rowDisabled = style({ color: ORIGINAL_COLORS.tableDivider })

/** 판 아래 되돌아가기 — 원본은 바닥띠(0x54d94)의 뒤로 표시가 맡는다 */
export const backButton = style({
  position: 'absolute',
  padding: '1px 4px',
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeInner}`,
  borderRadius: '3px',
  background: ORIGINAL_COLORS.panelDeep,
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  cursor: 'pointer',
})

/** 구장 아이템 창 판 (0x83378 — 선 #4A7BDE·#29318C, 칸 #1D44A8, 테두리 #18244A·#4A7DDE) */
export const stadiumPanel = style({
  position: 'absolute',
  boxSizing: 'border-box',
  background: ORIGINAL_COLORS.panelDeep,
  border: '1px solid #18244A',
  boxShadow: 'inset 0 0 0 1px #4A7DDE',
})

/**
 * 칸 막대가 굴러가는 창 — 줄이 13px 이라 넉 줄만 보인다. 나머지 줄은 **지우지 않고** 넘침을 잘라
 * 감춘다 (지우면 읽어 주는 도구도 시험도 그 줄을 못 본다).
 */
export const stadiumSlotList = style({
  position: 'absolute',
  overflow: 'hidden',
})

/** 창 안에서 통째로 밀려 올라가는 줄 묶음 */
export const stadiumSlotTrack = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '100%',
})

/** 구장 아이템 창의 칸 막대 (파란 막대 7개) */
export const stadiumBar = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: '0 1px',
  border: '1px solid #29318C',
  background: '#4A7BDE',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  // 이름 + 값이 70px 을 넘으면 접히면서 윗줄을 덮었다 — 한 줄로 못박고 이름만 줄인다
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  cursor: 'pointer',
})

/** 칸 이름 — 자리가 모자라면 말줄임 */
export const stadiumBarName = style({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

/** 칸 값 (가격·보유 여부) — 절대 줄이지 않는다 */
export const stadiumBarValue = style({ flex: 'none' })

import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS, UI_COLORS } from '@/shared/config/design'

/** 준비 화면 세 장은 모두 원작 240×320 좌표를 그대로 쓴다 — 조각마다 절대 배치다 (0x63b15) */
export const layer = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 잠긴 칸(히든 팀·잠긴 마선수)의 원 (0x63ec4·0x63ef4) — 지름과 색은 원본 값 그대로다 */
export const lockedCircle = style({
  position: 'absolute',
  borderRadius: '50%',
  pointerEvents: 'none',
})

/** 막대 안 가운데 흰 글 — `"!C!cFFFFFF%s"` (0xd24b4) */
export const centeredText = style({
  position: 'absolute',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '13px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
})

/** `fillRect` 로 그리는 판 (0x5461d · 줄 딱지 둥근 판) */
export const fillPanel = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/** 고를 수 있는 칸 — 격자 칸 그리기 0x7a571 이 미해독이라 테두리·바탕은 근사다 */
export const cell = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: 0,
  border: '1px solid transparent',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  font: 'inherit',
  fontSize: '11px',
  cursor: 'pointer',
  imageRendering: 'pixelated',
})

export const cellSelected = style({
  borderColor: ORIGINAL_COLORS.highlightYellow,
})

/** 선공/후공처럼 두 쪽 중 하나를 고르는 자리 — 원본은 팀 엠블럼 옆 꼬리표로 보인다 */
export const sideButton = style({
  position: 'absolute',
  boxSizing: 'border-box',
  padding: 0,
  border: '1px solid transparent',
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  cursor: 'pointer',
})

export const sideButtonSelected = style({
  borderColor: ORIGINAL_COLORS.highlightYellow,
})

/**
 * 원본에 없는 **웹 전용 단추** 자리 — 바닥띠(y 300~320) 왼쪽 빈 칸에 세운다.
 * 오른쪽 182~240 은 바닥띠 그림과 되돌아가기 소프트키(`ScreenFrame`)가 쓰므로 비워 둔다.
 * `left` 는 쓰는 쪽에서 준다.
 */
export const softKey = style({
  position: 'absolute',
  top: '302px',
  zIndex: 2,
  padding: '2px 5px',
  whiteSpace: 'nowrap',
})

/**
 * 원본에 없는 **웹 전용 조작 안내** 줄 — 바닥띠 바로 위 빈 줄에 눕힌다.
 * 원본 좌표를 쓰는 조각 중 가장 아래가 경기정보 다섯째 줄(259+15 = 274)이라 그 밑이다.
 */
export const hintLine = style({
  position: 'absolute',
  left: 0,
  top: '276px',
  width: '240px',
  zIndex: 2,
  pointerEvents: 'none',
})

/**
 * 경기진행 설정 창 (0x6042c).
 * ⚠️ 원본 배치 미해독 — 근사: 창 좌표가 R4 "남은 것" 에 있어 공용 판 크기(192 폭)만 빌려 썼다.
 */
export const settingsWindow = style({
  position: 'absolute',
  left: 24,
  top: 54,
  width: 192,
  height: 212,
  boxSizing: 'border-box',
  padding: 6,
  background: ORIGINAL_COLORS.panelDeep,
  border: `1px solid ${ORIGINAL_COLORS.boxEdgeInner}`,
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '14px',
  overflowY: 'auto',
})

export const settingsHeading = style({
  margin: '0 0 4px',
  fontSize: '11px',
  color: ORIGINAL_COLORS.highlightYellow,
})

export const settingsRow = style({
  display: 'flex',
  gap: '2px',
  alignItems: 'center',
  margin: '2px 0',
  // 상세 설정 줄은 칸이 아홉 개다 — 11px 글꼴에서는 한 줄에 다 못 서므로 접어 내린다
  flexWrap: 'wrap',
})

export const settingsRowLabel = style({
  width: '48px',
  flexShrink: 0,
})

export const settingsOption = style({
  boxSizing: 'border-box',
  padding: '1px 3px',
  border: `1px solid ${ORIGINAL_COLORS.boardEdge}`,
  background: 'transparent',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  // 이름이 줄어 "찬스/플레/이" 처럼 세 줄로 접히지 않게 못박는다 (9px 때는 48px 에 들어갔다)
  flexShrink: 0,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
})

export const settingsOptionSelected = style({
  borderColor: ORIGINAL_COLORS.highlightYellow,
  color: ORIGINAL_COLORS.highlightYellow,
})

export const settingsOptionOn = style({
  background: ORIGINAL_COLORS.boardHighlight,
})

export const settingsDescription = style({
  margin: '4px 0',
  color: UI_COLORS.badgeInk,
})

export const settingsActions = style({
  display: 'flex',
  gap: '4px',
  marginTop: '6px',
})

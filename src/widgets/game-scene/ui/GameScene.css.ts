import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원본 좌표 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 이름 칸 글 — 원본은 `"!C!cffffff%s"`(0xcf2e0) 가운데 맞춤 흰 글씨다 */
export const pitcherName = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 원본에 없는 웹 전용 확인 단추 — 원본은 소프트키·OK 키가 한다 */
export const okButton = style({
  position: 'absolute',
  right: '4px',
  bottom: '4px',
})

/** 화면을 통째로 덮는 판 (경기 화면 위) */
export const cover = style({
  position: 'absolute',
  inset: 0,
  zIndex: 30,
})

/** 원본 판 그림 대신 놓는 웹 전용 글자 — 가운데 */
export const webCaption = style({
  position: 'absolute',
  left: 0,
  right: 0,
  top: '150px',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '13px',
  pointerEvents: 'none',
})

/**
 * 인트로 띠 — 높이 30 (0x6a9f0(g, 0, y, W, 30, …)). ⚠️ y 는 미해결이라 화면 가운데에 둔다(웹 전용 배치).
 */
export const introBand = style({
  position: 'absolute',
  left: 0,
  right: 0,
  top: '145px',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '13px',
  pointerEvents: 'none',
})

/** 공수 교대 판의 두 팀 판 한 벌 — 안쪽은 240×320 원본 절대 좌표 */
export const cardLayer = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  pointerEvents: 'none',
})

/** 둥근 칠 0xba0bd 의 직사각형 한 조각 */
export const block = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/** 두 팀 판 이름 — `"!R!cffffff%s"`(0xd0714) 흰 글 오른쪽 맞춤, 0xba269(글, x, y, 폭, −1, 0) */
export const cardName = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'right',
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
})

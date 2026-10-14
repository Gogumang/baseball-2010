import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 원본 좌표 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 이름 칸 글 — 원본은 0xba269(`"!C!cffffff%s"`(0xcf2e0), x, y, 폭 54, −1) 가운데 맞춤 흰 글씨, 위를 y 에 맞춘다 */
export const pitcherName = style({
  position: 'absolute',
  textAlign: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '11px',
  lineHeight: '11px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  pointerEvents: 'none',
})

/**
 * OK 키를 대신하는 **투명한 눌림 칸** — 화면(240×320) 전체를 덮고 아무것도 그리지 않는다(원본 화면에 단추가 없다).
 * 키보드 OK 는 화면마다 따로 받는다. 글 "확인" 은 보이지 않게 두어 보조 기술 · 시험이 단추를 찾게 한다.
 */
export const okTapArea = style({
  position: 'absolute',
  inset: 0,
  zIndex: 31,
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'transparent',
  fontSize: 0,
  opacity: 0,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
})

/** 화면을 통째로 덮는 판 (경기 화면 위) */
export const cover = style({
  position: 'absolute',
  inset: 0,
  zIndex: 30,
})

/** 인트로 띠 0x6a9f0(g, 0, 0xbaa8c() + 40, W, 30, …) — 자리 · 크기 · 색은 화면이 준다 (`lib/introLayout`) */
export const introBand = style({
  position: 'absolute',
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

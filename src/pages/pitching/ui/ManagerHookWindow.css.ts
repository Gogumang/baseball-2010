import { style } from '@vanilla-extract/css'
import { theme } from '@/app/styles/theme.css'

/**
 * 강판 뒤 감독 대사 창 (경기 상태 0x23, 그리기 0x50828 → 상자 0x7fad0 — R14 3-4).
 * 화면 **폭 전체**에 높이 55 로 아래에서 올라오고, 본체는 검정 알파 0xB4 다.
 */
export const overlay = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
})

/** 윗 띠 12px — 바깥 #12307E · 안쪽 #1D44A8 (0x7fb36) */
export const band = style({
  height: '12px',
  background: '#1D44A8',
  borderTop: '1px solid #12307E',
  borderBottom: '1px solid #12307E',
})

/** 본체 — rect(0, H − h, W, h), 검정 알파 0xB4 ≈ 0.71 */
export const box = style({
  background: 'rgba(0, 0, 0, 0.71)',
  overflow: 'hidden',
  // 높이는 0 → 55 로 틱마다 15px 씩 올라온다 (0x7fae2) — 인라인 스타일로 준다
})

/** 글 — x = 5 · y = 위에서 5 · 폭 W − 20 · 줄높이 14 (0x6ef4c) */
export const text = style({
  padding: '5px',
  paddingRight: '20px',
  lineHeight: '14px',
  fontSize: '12px',
  color: theme.color.ink,
  whiteSpace: 'pre-wrap',
})

/** "[감독님]" 은 #00CC00 이다 (0x861c0) */
export const speaker = style({
  color: '#00CC00',
})

export const key = style({
  display: 'block',
  width: '100%',
  padding: '4px',
  border: 'none',
  background: 'none',
  color: theme.color.accent,
  font: 'inherit',
  fontSize: '11px',
  textAlign: 'right',
  cursor: 'pointer',
})

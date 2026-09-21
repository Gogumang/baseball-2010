import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/** 대진 선분 — 원본은 2px 박스를 통째로 채운다 (0x853fa~0x85474) */
export const segment = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/**
 * 팀 칸 로고. 원본 team_logo 는 77×76 한 장인데 칸 안쪽은 35×34 라 줄여 넣는다 (근사 —
 * 원본 0x66431 이 어떤 크기로 그리는지는 아직 안 읽었다).
 */
export const logo = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  objectFit: 'contain',
  pointerEvents: 'none',
})

/** 로고가 아직 없는 빈 자리 — 팀 이름을 줄여 글자로 둔다 */
export const emptyCell = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '9px',
  lineHeight: '10px',
  textAlign: 'center',
  pointerEvents: 'none',
})

/** 순위 딱지 칸 — 자리만 잡는다. 안의 숫자·"위" 는 그림이다 (numBox + img_text 307) */
export const rankTag = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/** img_text 307 "위" (9×10) — 딱지 칸 오른쪽 끝, 세로 가운데 (정렬 0x24) */
export const rankUnit = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** 대진표에는 없는 웹 전용 단추 — 원본은 소프트키가 한다 */
export const nextButton = style({
  position: 'absolute',
  left: '4px',
  top: '4px',
})

export const statsButton = style({
  position: 'absolute',
  right: '4px',
  top: '4px',
})

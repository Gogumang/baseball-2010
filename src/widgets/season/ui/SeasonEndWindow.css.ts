import { style } from '@vanilla-extract/css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEXT } from '@/widgets/season/lib/seasonWindowLayout'

/**
 * 시즌 끝 화면들(포스트시즌 대진표 0xee·0xef · 정규시즌 순위 0xf0 · 엔딩 0xf5)이 함께 쓰는 스타일.
 * 대진표·엔딩은 배치가 확정이라 좌표를 직접 놓고, 글자 규격만 다른 시즌 창들과 맞춘다.
 */

/** 대진 선분 — 원본은 2px 박스를 통째로 채운다 (0x853fa~0x85474) */
export const segment = style({
  position: 'absolute',
  pointerEvents: 'none',
})

/**
 * 팀 칸 로고. 원본 team_logo 는 77×76 한 장인데 칸 안쪽은 35×34 라 줄여 넣는다
 * (**근사** — 0x66431 이 어떤 크기로 그리는지는 아직 안 읽었다).
 */
export const logo = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  objectFit: 'contain',
  pointerEvents: 'none',
})

/** 로고가 아직 없는 빈 자리 */
export const emptyCell = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  textAlign: 'center',
  pointerEvents: 'none',
})

/** 순위 딱지 글 — ⚠️ 원본은 numBox 숫자 + img_text 307 "위" 다 (컴포넌트 쪽 주석 참고) */
export const rankTag = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ORIGINAL_COLORS.text,
  fontSize: '10px',
  lineHeight: '10px',
  pointerEvents: 'none',
})

/**
 * 화면 위에 한 줄 얹는 설명 글 (**원본 배치 미해독 — 근사**).
 * 원본은 상태판·커맨드 줄이 맡는 자리라 웹에서는 판 바깥 빈 자리에 둔다.
 */
export const caption = style({
  position: 'absolute',
  zIndex: 5,
  color: ORIGINAL_COLORS.text,
  fontSize: `${TEXT.smallSize}px`,
  lineHeight: `${TEXT.smallLineHeight}px`,
  textAlign: 'center',
  whiteSpace: 'pre-line',
  pointerEvents: 'none',
})

/** 원본에 없는 웹 전용 단추 — 원본은 소프트키(확인 −5)가 한다 */
export const cornerButton = style({
  position: 'absolute',
  zIndex: 6,
  left: '4px',
  top: '4px',
})

/** 띠·아이리스처럼 면만 있는 것은 240×320 SVG 한 장에 그린다 */
export const overlay = style({
  position: 'absolute',
  left: 0,
  top: 0,
  pointerEvents: 'none',
})

/** 원작 좌표에 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
  pointerEvents: 'none',
})

/** StrENDING 흰 글 가운데 (0, H/2 + 55, 폭 W) */
export const endingText = style({
  position: 'absolute',
  color: ORIGINAL_COLORS.text,
  textAlign: 'center',
  fontSize: `${TEXT.size}px`,
  lineHeight: `${TEXT.lineHeight}px`,
  pointerEvents: 'none',
})

/** 화면 아무 곳이나 눌러 다음으로 — 원작은 확인 키다 */
export const pressArea = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: '240px',
  height: '320px',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  selectors: { '&:focus-visible': { outline: `1px dashed ${ORIGINAL_COLORS.text}` } },
})

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
 * 팀 칸 로고 (직접 떴다). 0x66431 은 스킨 +0x4c8 + 팀·16 의 **미리 줄여 둔 버퍼**(폭 [+0], 높이 [+4], 픽셀 [+0xc])를
 * 제 크기로 찍고 0 번 색은 건너뛴다(0x664c8~0x664fc). 그 버퍼는 0x663c4 가 15 팀마다 0x662dc(스킨, team_logo 그림, 버퍼,
 * 0, 0, **0x23, 0x22**) 로 만든다 — 가로 배율 (35 << 12) / 그림폭 · 세로 배율 (34 << 12) / 그림높이 를 **따로** 셈
 * (0x66306~0x6631a)이라 77×76 한 장을 비율 무시하고 **35×34** 로 늘려 담는다. 그래서 칸 안쪽(대진표 41×40 − 3·2,
 * 결과판 39×38 − 2·2)이 꼭 35×34 이고 `objectFit` 은 기본(fill)이다.
 * 줄이는 표본 고르기(0x65f64)는 풀지 않았다 — 브라우저 `pixelated` 로 줄인다(⚠️ 픽셀 단위 근사).
 */
export const logo = style({
  position: 'absolute',
  imageRendering: 'pixelated',
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

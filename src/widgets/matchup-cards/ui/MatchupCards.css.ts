import { style } from '@vanilla-extract/css'

/** 타석 캔버스(240×320) 위에 겹치는 판 — 판이 화면 밖에서 밀려 들어오므로 캔버스 밖은 잘라 낸다 */
export const stage = style({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 240,
  height: 320,
  overflow: 'hidden',
  pointerEvents: 'none',
})

/** 원본 좌표 그대로 놓는 그림 한 장 */
export const sprite = style({
  position: 'absolute',
  imageRendering: 'pixelated',
})

/** 0xba0bc 둥근 칠 · 0xb9f74 네모 칠 · 0x6a9f0 점 */
export const fill = style({
  position: 'absolute',
})

/**
 * 이름 칸 — 0xba4c0(박스 3, 이름, 정렬 0x24): 박스 오른끝에 붙이고 세로 가운데, 흰 글.
 * 글꼴은 앱 전역 글꼴이다(r126 확인 — 0xba4c0 → 0xba2e4 가 0x6ecd1 로 [[0x1400070]+0x3c] 를 세운다. 예전에 글꼴로 적은
 * 0x14003f8 은 .data 의 단말 호출 토막이다 — P4 는 글자 수로 읽었다). 높이 11 · 한글 9 · 영문 5 · 자간 1 — 웹은 공용 글과 같은 11px 글꼴로 그린다
 * (⚠️ 글자 폭은 웹 글꼴 몫 — 저장소 공통 근사).
 */
export const name = style({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  fontSize: '11px',
  lineHeight: '13px',
  whiteSpace: 'nowrap',
  overflow: 'visible',
})

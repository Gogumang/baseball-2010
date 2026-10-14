/**
 * **라이벌전 띠 0x3b80c** — 경기 시작 인트로 그리기 0x417ac 의 끝(41a00)이 `+0x194a`(라이벌전) && `[+0x17e6] > 14`(흐려지기 전)일 때
 * 점수판 틀 뒤 맨 위에 그린다. 직접 뜸 + 원본 코드 에뮬레이션(2026-10-14, unicorn 으로 0x3b80c · 0x5f184 를 그대로 돌려 꼭짓점을 받았다):
 * ```
 * 3b812  창 객체 0x75b19(0x9c 바이트) — 채우기 [+0x80] · 테두리 [+0x7c] = 0x80FFFFFF (반투명 흰색)
 * 3b830  n = +0x194c(인트로 진입 0x3b084 의 3b0ee 가 0 으로) ; 1 ≤ n ≤ 9 면 점프표 0xcff44[n − 1]
 *          1 · 2 · 3 (3b848)  흰 줄기 셋 — 꼭짓점 다섯(시작점 · 끝의 둥근 머리 넷, 끝점 = 시작 + 0x6c64c(정수 제곱근) 몫) 을 0x75ba5 · 0x75e31
 *          4      (3b93c)  0x5f185(스킨, 상자, 흰색, 흰색) 넷 — 상자(x, y, w, h, …) 를 기울인 평행사변형(0x6c6a9 sin · 0x6c6dd cos 표 0xd310c)
 *          5 · 6 · 7 (3baa4)  같은 넷을 RGB(176, 1, 30) 로 · 흰 선 셋(0x6a905, 0x80FFFFFF) · 평행사변형 셋(0x64FFFFFF) ·
 *                           로고 0xbb91d([+0x1950], W/2 − w·k, H/2 − h·k, 종류 10(2 크기 | 8 밝게), a, 200) — a = 40 · 30 · 20
 *                           (크기 a/10 배, k = 2 · 3/2 · 1 — 가운데 맞춤), 채널마다 +200
 *          8 · 9   (3be78)  같은 넷을 RGB(176, 1, 30) 로 · 로고 vt14([+0x1950], W/2 − 36, H/2 − 16, 0, 0, 0)
 * 3bfdc  +0x194c += 1 (9 에서 멈춤) ; 창 객체 vt4(지우기)
 * ```
 * 곧 인트로의 그림 0 은 아무것도 안 그리고(0 → 1), 그림 1~9 가 단계 1~9 를 그리고, 그 뒤로는 단계 9(빨간 넷 + "RIVAL BATTLE" 로고)를
 * 흐려지기 전까지 계속 그린다. 로고 그림 [+0x1950] = 적재 상태 8 의 489cc `0x6fd9d("ui/team_logo.pzx", 0, 16, 1)` — team_logo 프레임 16
 * ("RIVAL BATTLE", 73×33).
 *
 * 꼭짓점은 화면 240×320 에서 원본 코드가 낸 값 그대로다(W/2 · H/2 기준으로만 움직인다 — 웹 화면은 늘 240×320).
 * 칠하기는 0x75e31 = 0x75c70 스캔라인 채우기 뒤 0x75dc4 테두리(`features/play-game/model/aceCutIn` 의 `scanlineSpans` · `linePixels`).
 * 색 윗바이트가 0 · 0xff 가 아니면 0x6a9f0 · 0x6a904 가 그 알파를 플랫폼 그리기 속성 0x1400698(gc, 4, 알파)로 건다.
 * ⚠️ 미확인: 섞기 식은 단말(플랫폼) 몫이라 바이너리에 없다 — 웹은 알파/255 로 섞는다.
 * ⚠️ 미확인: 0xbb91d 의 y 에 더하는 [그래픽 0x1221()+0x40](낮은 단계 세로 보정)은 0 으로 둔다(벤치 클리어링 원 닫기와 같은 근사).
 */

export interface RivalryPoint {
  readonly x: number
  readonly y: number
}

/** 색 — 윗바이트 알파 (0 · 0xff 면 불투명) */
export interface RivalryColor {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly alpha: number
}

export type RivalryDraw =
  | { readonly kind: 'polygon'; readonly points: readonly RivalryPoint[]; readonly color: RivalryColor }
  | { readonly kind: 'line'; readonly from: RivalryPoint; readonly to: RivalryPoint; readonly color: RivalryColor }
  /** 로고 — `scale` 배(0xbb91d 의 a/10, 1 이면 vt14 보통 그리기) · 채널마다 `brighten` 더하기 */
  | { readonly kind: 'logo'; readonly x: number; readonly y: number; readonly scale: number; readonly brighten: number }

/** 표 0xd8a90 — 라이벌 짝 (순서 무관, 0xb8f68) */
export const RIVALRY_PAIRS: readonly (readonly [number, number])[] = [[0, 1], [2, 7], [3, 6], [4, 5], [8, 9]]

/** 적재 상태 8 의 489b6 `0xb8f68(팀 A, 팀 B)` — 두 팀이 표 0xd8a90 의 짝이면 라이벌전(+0x194a) */
export function isRivalryMatch(teamA: number, teamB: number): boolean {
  return RIVALRY_PAIRS.some(([a, b]) => (a === teamA && b === teamB) || (a === teamB && b === teamA))
}

/** 로고 = team_logo 프레임 16 ("RIVAL BATTLE") */
export const RIVALRY_LOGO_FRAME = 16
/** team_logo 프레임 16 의 크기 — 로고 그리기의 vt1c(폭) · vt20(높이) */
export const RIVALRY_LOGO_SIZE = { width: 73, height: 33 } as const
/** 마지막 단계 — 3bfe8 `cmp r3, #9` */
export const RIVALRY_LAST_STEP = 9

const SCREEN_CENTER = { x: 120, y: 160 }
const HALF_WHITE: RivalryColor = { r: 255, g: 255, b: 255, alpha: 0x80 }
const FAINT_WHITE: RivalryColor = { r: 255, g: 255, b: 255, alpha: 0x64 }
const WHITE: RivalryColor = { r: 255, g: 255, b: 255, alpha: 0 }
const RED: RivalryColor = { r: 176, g: 1, b: 30, alpha: 0 }

const p = (x: number, y: number): RivalryPoint => ({ x, y })

/** 단계 1~3 의 흰 줄기 셋 (3b848 — 시작점 · 끝 머리 넷) */
const STREAKS: readonly (readonly RivalryPoint[])[][] = [
  [
    [p(34, 74), p(136, 180), p(139, 180), p(140, 179), p(140, 176)],
    [p(34, 88), p(114, 172), p(117, 172), p(118, 171), p(118, 168)],
    [p(34, 102), p(117, 189), p(120, 189), p(121, 188), p(121, 185)],
  ],
  [
    [p(34, 74), p(171, 215), p(174, 215), p(175, 214), p(175, 211)],
    [p(34, 88), p(150, 208), p(153, 208), p(154, 207), p(154, 204)],
    [p(34, 102), p(153, 225), p(156, 225), p(157, 224), p(157, 221)],
  ],
  [
    [p(54, 94), p(191, 235), p(194, 235), p(195, 234), p(195, 231)],
    [p(54, 108), p(170, 228), p(173, 228), p(174, 227), p(174, 224)],
    [p(54, 122), p(173, 245), p(176, 245), p(177, 244), p(177, 241)],
  ],
]

/** 단계 4~9 의 기운 상자 넷 (0x5f185 — 단계 4 는 흰색, 5~9 는 빨강) */
const SLABS: readonly (readonly RivalryPoint[])[] = [
  [p(96, 127), p(125, 163), p(161, 192), p(132, 156)],
  [p(74, 118), p(118, 170), p(170, 214), p(126, 162)],
  [p(82, 139), p(111, 175), p(147, 204), p(118, 168)],
  [p(113, 160), p(96, 188), p(133, 176), p(150, 148)],
]

/** 단계 5~7 의 흰 선 셋 (0x6a905, 0x80FFFFFF) */
const RAYS: readonly (readonly [RivalryPoint, RivalryPoint])[] = [
  [p(56, 87), p(136, 167)],
  [p(24, 68), p(114, 158)],
  [p(42, 99), p(122, 179)],
]

/** 단계 5~7 의 흐린 평행사변형 셋 (0x5f185, 0x64FFFFFF) */
const GLOWS: readonly (readonly RivalryPoint[])[] = [
  [p(136, 167), p(165, 203), p(201, 232), p(172, 196)],
  [p(114, 158), p(158, 210), p(210, 254), p(166, 202)],
  [p(122, 179), p(151, 215), p(187, 244), p(158, 208)],
]

/** 단계 5 · 6 · 7 의 로고 크기 a (0x3bde6~0x3be0a: 5 → 40 · 6 → 30 · 그 밖 20) */
const LOGO_SIZE_BY_STEP: Readonly<Record<number, number>> = { 5: 40, 6: 30, 7: 20 }
/** 0xbb91d 의 b — 채널마다 더하기 */
const LOGO_BRIGHTEN = 200

/** 그림 n(인트로 진입 뒤 0 부터)에서 그리는 단계 — 0 이면 아무것도 안 그린다 (+0x194c 는 그린 뒤 +1, 9 에서 멈춤) */
export function rivalryStepAt(draw: number): number {
  return Math.max(0, Math.min(RIVALRY_LAST_STEP, draw))
}

/** 단계 하나의 그리기 목록 — 그리는 차례대로 */
export function rivalryDrawsOf(step: number): readonly RivalryDraw[] {
  if (step >= 1 && step <= 3) {
    return STREAKS[step - 1].map((points) => ({ kind: 'polygon', points, color: HALF_WHITE }))
  }
  if (step === 4) return SLABS.map((points) => ({ kind: 'polygon', points, color: WHITE }))
  if (step < 5 || step > RIVALRY_LAST_STEP) return []
  const slabs: RivalryDraw[] = SLABS.map((points) => ({ kind: 'polygon', points, color: RED }))
  if (step >= 8) {
    return [...slabs, { kind: 'logo', x: SCREEN_CENTER.x - 36, y: SCREEN_CENTER.y - 16, scale: 1, brighten: 0 }]
  }
  const size = LOGO_SIZE_BY_STEP[step]
  // 3bde6~3be0a — 가운데 맞춤 몫: 5 → 폭 · 높이 × 2, 6 → × 3 / 2 (asr), 7 → × 1
  const half = (value: number) => (step === 5 ? value * 2 : step === 6 ? (value * 3) >> 1 : value)
  return [
    ...slabs,
    ...RAYS.map(([from, to]): RivalryDraw => ({ kind: 'line', from, to, color: HALF_WHITE })),
    ...GLOWS.map((points): RivalryDraw => ({ kind: 'polygon', points, color: FAINT_WHITE })),
    {
      kind: 'logo',
      x: SCREEN_CENTER.x - half(RIVALRY_LOGO_SIZE.width),
      y: SCREEN_CENTER.y - half(RIVALRY_LOGO_SIZE.height),
      scale: size / 10,
      brighten: LOGO_BRIGHTEN,
    },
  ]
}

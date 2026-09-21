/**
 * 타석 화면의 **작은 지도**(148×142) — binary.mod `0x395f4`.
 *
 * 근거: `docs/re/R3-field-view.md` 1-4(유력) · `docs/re/R15-ac758.md` 6절(그리는 방식 확정) ·
 *       `docs/re/S10-asset-reading.md` 6절(그림 번호 확정) · `docs/re/I-controls.md` 1b(배율)·113줄(루 좌표).
 *
 * 원본이 하는 일:
 * ```
 * 0x39644: r = game_ui 프레임 9 를 (x0, y0) 에 그리고 그 상자 r 을 돌려받음
 * 0x3965a: r.x -= 2 ; r.y -= 2 ; r.w += 4 ; r.h += 4
 * 0x39680: setColor(0x18,0x29,0x45) ; fillRect(r)                 ; 바깥 테 짙은 남색
 * 0x396a8: setColor(0x5a,0x6b,0x7d) ; fillRect(r+1) ; fillRect(r+2, 색 인자 0)
 * 0x39728: 투수판(0xcfa8c = 20000, 24500) 을 같은 배율로 투영 — 기준점
 * 0x39746: n = 0xa9598(주자관리) ; i<n: p = 0xa9564(관리, i)
 * 0x39762:   주자 p+0x96(아웃 표시) 이 서 있으면 건너뜀
 * 0x39790:   0xb94cc 로 주자 월드좌표(p+0x20) 를 지도 칸으로 투영
 * 0x39796:   x = x0 + px − 투수판px + 1 ; y = y0 + py − 투수판py + 4
 * 0x397be:   x -= 그림폭/2 ; y -= 그림높이/2       ; **중심 정렬**
 * 0x397f0:   game_ui 이미지 21 (13×11 주황 점) 그리기
 * ```
 *
 * ⚠️ **원본 배치 미해독 — 근사**: `0x395f4(this, x0, y0)` 를 부르는 쪽이 넘기는 (x0, y0) 는
 *    문서에 없다. HUD(5,5~87,55)와 안 겹치는 오른쪽 위에 3px 띄워 놓았다.
 * ⚠️ 세 번째 fillRect 의 "색 인자 0" 이 검정인지 다른 뜻인지 R15 가 못 읽었다. 여기서는
 *    검정으로 깔고 그 위에 지도 그림을 얹는다 — 그림을 먼저 그리면 이 칠이 덮어 버린다.
 * ⚠️ `this+0x1e8` 의 바이트 `+5 == 1` 일 때만 테두리를 그린다고 R15 가 적었는데 그 칸이
 *    무엇인지 모른다 — 웹은 늘 그린다.
 *
 * 웹판 한계: 주자 월드좌표가 없고 루 점유 여부만 있다. 다만 S8 6-2 가 **"루에 선 주자의 좌표는
 * 루 좌표와 비트까지 같다"**(리드 폭이라는 값이 원본에 없다) 고 확정했고, 타석 중에는 주자가
 * 루에 서 있으므로 루 좌표를 그대로 찍는 것이 원본과 같은 그림이 된다.
 */

/** 월드 크기 (I-controls 1b) */
export const WORLD = { width: 40000, height: 32500 } as const

/** this+0x1f8 배율 — 월드 40000×32500 → 148×142 칸 (0x3e432) */
export const MAP_SCALE = { width: 148, height: 142 } as const

/** 루 좌표표 0xd7bdc / 0xd856c 의 (x, z) — 높이 y 는 전부 0 (I-controls 113줄, S7 6-1) */
export const BASE_POINTS = {
  first: { x: 25946, z: 24175 },
  second: { x: 20000, z: 19170 },
  third: { x: 14055, z: 24175 },
  home: { x: 20000, z: 29445 },
} as const

/** 표 0xcfa8c[0] = 투수판 (20000, 24500) — 지도의 기준점 (R3 1-3) */
export const PITCHER_PLATE = { x: 20000, z: 24500 } as const

/** 주자 점을 찍을 때 더하는 보정 (0x39796) */
export const DOT_OFFSET = { x: 1, y: 4 } as const

/** 바탕 = game_ui 합성 프레임 9 (61×59, 원점 (−29,−28)) — 파란 다이아몬드 (S10 6-1) */
export const MAP_FRAMES = './sprites/game_ui/frames'
export const MAP_FRAME = 9

/** 주자 점 = game_ui 이미지 21 (13×11, 가운데 노랑인 주황 불빛) (S10 6-1·6-2) */
export const DOT_IMAGE = './sprites/game_ui/021.png'

/** 테두리 색 (0x39680·0x396a8) */
export const MAP_COLORS = {
  /** RGB(0x18,0x29,0x45) 짙은 남색 */
  outer: '#182945',
  /** RGB(0x5a,0x6b,0x7d) 청회색 */
  inner: '#5A6B7D',
  /** 세 번째 fillRect 의 "색 인자 0" — 검정으로 본다 (⚠️ 미해독) */
  backdrop: '#000000',
} as const

/** 테두리가 프레임 상자 밖으로 나가는 두께 (r 을 사방 2 넓힌다) */
export const MAP_BORDER = 2

/**
 * ⚠️ **원본 배치 미해독 — 근사**. 프레임 9 의 앵커 (x0, y0).
 * 원점이 (−29,−28) 이라 상자는 (x0−29, y0−28, 61, 59), 테까지 하면 (x0−31, y0−30, 65, 63) 이다.
 * 화면 240×320 의 오른쪽 위에 3px 띄웠다 (HUD 는 (5,5)~(87,55) 라 안 겹친다).
 */
export const MAP_ANCHOR = { x: 203, y: 33 } as const

export interface BaseOccupancy {
  readonly first: boolean
  readonly second: boolean
  readonly third: boolean
}

/** 월드 (x, z) → 지도 칸 좌표. 원본 0xb94cc 와 같은 정수 내림 나눗셈이다 */
export function toMapPoint(point: { readonly x: number; readonly z: number }): { x: number; y: number } {
  return {
    x: Math.floor((point.x * MAP_SCALE.width) / WORLD.width),
    y: Math.floor((point.z * MAP_SCALE.height) / WORLD.height),
  }
}

/** 주자 점의 **중심** 화면 좌표 (그림 크기를 빼기 전) — 0x39796 */
export function dotCenterOf(
  base: keyof typeof BASE_POINTS,
  anchor: { readonly x: number; readonly y: number } = MAP_ANCHOR,
): { x: number; y: number } {
  const plate = toMapPoint(PITCHER_PLATE)
  const point = toMapPoint(BASE_POINTS[base])
  return {
    x: anchor.x + point.x - plate.x + DOT_OFFSET.x,
    y: anchor.y + point.y - plate.y + DOT_OFFSET.y,
  }
}

/** 루상 주자 → 찍을 점 목록. 원본은 아웃 표시(+0x96)가 선 주자를 건너뛴다 */
export function runnerDotsOf(bases: BaseOccupancy): readonly (keyof typeof BASE_POINTS)[] {
  const dots: (keyof typeof BASE_POINTS)[] = []
  if (bases.first) dots.push('first')
  if (bases.second) dots.push('second')
  if (bases.third) dots.push('third')
  return dots
}

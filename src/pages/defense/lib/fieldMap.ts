/**
 * 수비 화면의 **작은 지도**(148×142 배율) — binary.mod `0x395f4` (직접 떴다, 0x395f4~0x397fc).
 *
 * 부르는 곳은 **수비 인플레이 그리기 0x46c88 의 0x46e02 하나**다: 그리기 목록(0xbe6a1) → 결과 판 0x46844 → (플레이 종류
 * `[[+0x200]+0x118] ≠ 8` 이면) **0x395f4(장면, 0x1e, 0x1e)** → 0x4403c · 필살 포구 번쩍임 0x441c4 · 0x44398 → 줌 펀치 0xbb84d …
 * 타석 화면(0x4c4bc)은 지도를 그리지 않는다.
 * ```
 * 0x3960e  카메라(+0x1e8) 바이트 +5 == 1 이면 x0 += 2 · y0 += 2
 * 0x39644  r = game_ui 프레임 9 의 상자 (x0, y0) — 원점 (−29, −28), 61 × 59
 * 0x3965a  r.x −= 2 · r.y −= 2 · r.w += 4 · r.h += 4
 * 0x39674  카메라 바이트 +5 == 1 일 때만: 칠 r (0x18,0x29,0x45) · r+1 (0x5a,0x6b,0x7d) · r+2 (색 인자 0)
 * 0x39714  프레임 9 를 (x0, y0) 에 효과 1 · 단계 12 (반투명 12/16 — R6 3a)
 * 0x39728  투수판 0xcfa8c (20000, 24500) 을 같은 배율로 — 기준점
 * 0x39746  주자 i < 0xa9598(주자 관리): p = 0xa9564(관리, i), p+0x96(처리 끝: 아웃 또는 홈 밟음) 이면 건너뜀
 * 0x39790  x = x0 + px − 투수판 px + 1 · y = y0 + py − 투수판 py + 4 (0xb94cc 투영)
 * 0x397be  x −= 폭 / 2 · y −= 높이 / 2 → game_ui 이미지 21(+0x54, 13 × 11) 을 효과 1 · 단계 12 로
 * ```
 * 카메라 바이트 +5 는 데드존형 카메라(0xc07a8)만 1, 따라가기형(0xc0570)은 0 이다. 웹 수비 카메라는 따라가기형만 옮겼으므로
 * (`defenseCamera` — [0x14000bc]+0xc 를 세우는 곳 미발견, U-52) **테두리 칠과 +2 비낌은 없다**.
 */
import { translucentOpacityOf } from '@/shared/lib/pixelEffect/pixelEffect'

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

/** 0x46dfe · 0x46e00 — 0x395f4(장면, 0x1e, 0x1e) */
export const MAP_ANCHOR = { x: 0x1e, y: 0x1e } as const

/** 바탕 = game_ui 합성 프레임 9 — 원점 (−29, −28) · 61 × 59 (origins.json, S10 6-1) */
export const MAP_FRAMES = './sprites/game_ui/frames'
export const MAP_FRAME = 9
export const MAP_FRAME_BOX = { x: -29, y: -28, width: 61, height: 59 } as const

/** 주자 점 = game_ui 이미지 21 (13×11, 가운데 노랑인 주황 불빛) — 그림 칸 +0x54 (S10 6-1·6-2) */
export const DOT_IMAGE = './sprites/game_ui/021.png'
export const DOT_SIZE = { width: 13, height: 11 } as const

/** 효과 1 · 단계 12 — 반투명 겹치기, 그림 무게 12/16 (R6 3a · ⚠️ DOM 근사는 공용 `translucentOpacityOf` 머리) */
export const MAP_OPACITY = translucentOpacityOf(12)

/** 테두리 색 (0x39680·0x396a8) — 데드존형 카메라에서만 쓴다 */
export const MAP_COLORS = {
  /** RGB(0x18,0x29,0x45) 짙은 남색 */
  outer: '#182945',
  /** RGB(0x5a,0x6b,0x7d) 청회색 */
  inner: '#5A6B7D',
  /** 세 번째 칠의 "색 인자 0" — 검정으로 본다 (⚠️ 미해독) */
  backdrop: '#000000',
} as const

export interface MapPoint {
  readonly x: number
  readonly y: number
}

/** 월드 (x, z) → 지도 칸 좌표. 원본 0xb94cc 와 같은 정수 내림 나눗셈이다 */
export function toMapPoint(point: { readonly x: number; readonly z: number }): MapPoint {
  return {
    x: Math.floor((point.x * MAP_SCALE.width) / WORLD.width),
    y: Math.floor((point.z * MAP_SCALE.height) / WORLD.height),
  }
}

/** 월드 점의 지도 위 **중심** 화면 좌표 (그림 크기를 빼기 전) — 0x39796 */
export function dotCenterOf(point: { readonly x: number; readonly z: number }, anchor: MapPoint = MAP_ANCHOR): MapPoint {
  const plate = toMapPoint(PITCHER_PLATE)
  const mapped = toMapPoint(point)
  return {
    x: anchor.x + mapped.x - plate.x + DOT_OFFSET.x,
    y: anchor.y + mapped.y - plate.y + DOT_OFFSET.y,
  }
}

/** 지도에 찍을 주자 — 월드 (x, z) 와 처리 끝(+0x96) 표시 */
export interface MapRunner {
  readonly x: number
  readonly z: number
  /** +0x96 — 아웃이 됐거나 홈을 밟았다. 이 주자는 안 찍는다 (0x39762) */
  readonly isFinished?: boolean
}

/** 주자 점들의 **왼쪽 위** 화면 좌표 — 중심에서 그림 폭·높이의 절반을 당긴다 (0x397be) */
export function runnerDotsOf(runners: readonly MapRunner[], anchor: MapPoint = MAP_ANCHOR): MapPoint[] {
  return runners
    .filter((runner) => runner.isFinished !== true)
    .map((runner) => {
      const center = dotCenterOf(runner, anchor)
      return { x: center.x - (DOT_SIZE.width >> 1), y: center.y - (DOT_SIZE.height >> 1) }
    })
}

/** 지도 바탕(프레임 9) 상자의 왼쪽 위 — 앵커 + 원점 */
export function mapFrameTopLeftOf(anchor: MapPoint = MAP_ANCHOR): MapPoint {
  return { x: anchor.x + MAP_FRAME_BOX.x, y: anchor.y + MAP_FRAME_BOX.y }
}

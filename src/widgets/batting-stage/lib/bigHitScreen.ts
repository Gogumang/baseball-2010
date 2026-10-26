import { HIT_STOP_TICKS } from '@/widgets/batting-stage/lib/hitPause'

/**
 * **큰 타구 0x13 의 화면 연출** — 0x13 그리기 0x4cb1c 의 꼬리(4cb76~4ce0e, 2026-10-24 직접 떴다). 공용 그림(투수 · 주자 · 타자 · 공 ·
 * 그리기 목록 0xbe6a1 · 투구 기계 0x42f2c · HUD 0x4c4bc) **뒤**, 감상 플래그 +0x199a 가 선 타구에서만:
 * ```
 * 4cb8c  점 = 타격점 (+0x10dc, +0x10e0) 투영 0xb94b5 + 카메라 (+0xff4, +0xff8)          ; [sp+0x2c] · [sp+0x30]
 * 4cbb4  공 틱 [+0x1098] ≠ 0 이면 4cdac(뒤 갈래)로
 * ── 멈춤 갈래(공 틱 0) ──
 * 4cbc0  px = trunc(W × 0xcfb54[+0x17e1].x / 480) · py = trunc(H × 0xcfb54[+0x17e1].y / 390)   ; 우타 (242, 326) · 좌타 (237, 326)
 * 4cc18  [+0xfe6] == 0 이면: 0xbb43c(+0xff4, +0xff8, 100 + 2 × (6 − [+0x10a8]), px, py) 화면 확대 → 0xc3469(0, 0, W, H, 2) 흐리기
 * 4cc6c  [+0x10a8] 이 홀수면 번쩍임 — 창 객체 0x75b19 · 표 0xd0244(0x180 바이트 = 세모 16 개)를 베껴 채우기 · 테두리 0x78FFFFFF 로
 *        세모마다 0x75ba5(점 3) · 0x75e31, 끝에 0x75b79
 * 4ccba  옛값 = [+0x10a8], [+0x10a8] −= 1 — 옛값 < 0 이면 막음 +0x10a0 · +0x19a4 를 풀고 애니 3 되감기(0x93cfd) · 016 쏘기(위 점)
 * 4cd18  [+0xfe6] == 0 이면 검은 테두리 4 줄(0x6a9f1, 색 0): (0, 0, W, 4) · (0, 0, 4, H) · (0, H − 4, W, 4) · (W − 4, 0, 4, H)
 * ── 뒤 갈래(공 틱 ≥ 1) ──
 * 4cdd6  0xc3469(0, 0, W, H, 1) 흐리기 → 4cdfa game_effect 애니 3([[+0x102c]+0x10]+8 의 넷째 칸)을 위 점에 0x93c45 → 4ce0c 0x93d91(한 칸)
 * ```
 * [+0x10a8] 은 맞을 때 6(5183c)이고 공 틱이 0 인 그림마다 1 준다 — 공 틱은 멈춤(`hitPause.HIT_STOP_TICKS`) 동안 0 이라 0x13 틱 k(0~7)의
 * 값이 6 − k 다. 틱 7 그림이 막음을 풀고 그 틀 끝(0x3f378)부터 공 틱이 오르니 틱 8 부터가 뒤 갈래다(되감은 애니 3 의 칸 0 이 틱 8).
 *
 * **[+0xfe6]** 은 0x47b2c(경기, 1)이 0xbdea1(화면 효과기 [0x140007c], px, py) 의 되돌림으로 적는다 — 0xbdea0 은 남은 메모리
 * (0x1400508)가 W × H × 2 이상일 때만 화면을 (px, py) 쪽 방사 흐림으로 떠 이미지(0x1400678)로 두고 1 을 돌려준다. 그러면 0x47c68 이
 * +0x19a4 동안 그 이미지(0xbdbcd)를 배경 자리에 덮고, 4cc18 · 4cd18 이 확대 · 흐리기 · 테두리를 건너뛴다. 기기 메모리에 달린 갈래라
 * 바이너리로 정할 수 없다. ⚠️ 미확인: 웹은 [+0xfe6] == 0(메모리 모자람) 갈래 — 확대 · 흐리기 · 테두리 — 로 둔다(남김 — 기기 남은 메모리
 * 0x1400508 은 단말 몫이라 바이너리 밖). 1 갈래(방사 흐림
 * 배경 · 카메라 다시 잡기 0xb9481 · 0x40ff0 배경 다시 그리기, 효과기 +0x29 는 장면 초기화 0x3e340 만 −1 로 되돌려 장면에서 처음 큰 타구만
 * 뜬다)는 옮기지 않았다.
 * 카메라 (+0xff4, +0xff8) 은 0x13 동안 틀 머리 0x3f060(3f1f2~3f2d8)이 공을 따라 옮긴 타석 카메라 [+0x1ec] 다(`hitCamera`, r292). 웹 그림은
 * 고정 오프셋(`projectToScreen` 의 (−120, −70) = 가운데 카메라) 위에 그 차이만큼 캔버스를 옮겨 그린다(`StageScene.camera`). 멈춤 갈래는
 * 막음 [+0x10a0] 동안이라 틀 머리가 카메라를 안 건드려 늘 가운데다 — 뒤 갈래의 애니 3 자리만 카메라를 탄다.
 */

/** 맞을 때 [+0x10a8] 에 적는 값 (5183c) */
export const BIG_HIT_HOLD_COUNTER_START = 6

/** 이 그림의 큰 타구 연출 — 멈춤 갈래(공 틱 0)는 그 그림의 [+0x10a8] 옛값, 뒤 갈래는 애니 3 의 그린 칸 수와 점 */
export type BigHitScreen =
  | { readonly kind: '멈춤'; readonly counter: number; readonly side: number }
  | { readonly kind: '뒤'; readonly drawCall: number; readonly point: { readonly x: number; readonly y: number } | null }

/**
 * **창이 선 첫 그림([창+0x250])의 0x13 그리기** (r175) — 공용 창이 서면 52cc6 이 갱신을 건너뛰지만 창이 선 첫 그림은 52efe 를 지나
 * 그리기 표 0xd05a0 의 0x13 그리기 0x4cb1c 를 한 번 더 돈다(갱신 없이). 그래서 멈춤 갈래(공 틱 0)면 [+0x10a8] 이 한 번 더 줄고(4ccba),
 * 옛값이 음수면 그 그림에서 막음 +0x10a0 을 풀고 016 을 쏜다(4ccc6~4cd14 — 파티클 틱 53048 은 건너뛴다). 뒤 갈래면 애니 3 이 한 칸 더
 * 간다(0x93d91). 공 틱 +1(틀 끝 0x3f378, 53086)은 창이 서 있는 틀에 안 돈다 — 그 그림에서 풀려도 다음 갱신 틀의 그림이 다시 공 틱 0 을
 * 보고 한 번 더 푼다(016 도 한 번 더).
 *
 * `frozenDraws` 는 이 0x13 에서 그런 그림이 든 자리 — 각 값은 그 그림 **앞**에 마지막으로 갱신한 0x13 틱 k(창이 선 뒤 첫 그림은
 * 틱 k + 1 자리의 그림으로 센다). 멈춤 갈래 그림 수가 하나 늘 때마다 [+0x10a8] 이 한 번 더 줄어 막음이 한 틱 일찍 풀린다.
 *
 * 막음을 푸는 갱신 틀의 그림 r = (k + 그 앞 창 그림 수 ≥ 7 인 첫 0x13 틱 k). 창 그림이 없으면 `HIT_STOP_TICKS`(7).
 */
export function bigHitReleaseTickOf(frozenDraws: readonly number[] = []): number {
  for (let tick = 0; ; tick += 1) {
    const extra = frozenDraws.filter((at) => at < tick).length
    if (tick + extra >= HIT_STOP_TICKS) return tick
  }
}

/**
 * 0x13 틱 `stateTick` 의 그림 — 감상 플래그가 꺼진 타구(`watchesBigHit` 거짓)는 4cb7c 에서 끝나 null.
 * `point` 는 타격점의 화면 자리(공 도착점 `platePixelOf` — `BattingStage` 의 `contact`), `side` 는 +0x17e1(타자 손).
 * `frozenDraws` 는 이 그림 앞의 창 첫 그림 자리(`bigHitReleaseTickOf`) — 창이 선 첫 그림은 `stateTick` = 마지막 갱신 틱 + 1 로,
 * 그 그림 앞의 자리만 넘겨 부른다.
 */
export function bigHitScreenOf(
  watchesBigHit: boolean,
  stateTick: number,
  side: number,
  point: { readonly x: number; readonly y: number } | null,
  frozenDraws: readonly number[] = [],
): BigHitScreen | null {
  if (!watchesBigHit || stateTick < 0) return null
  const before = frozenDraws.filter((at) => at < stateTick)
  const releaseTick = bigHitReleaseTickOf(before)
  if (stateTick <= releaseTick) return { kind: '멈춤', counter: BIG_HIT_HOLD_COUNTER_START - stateTick - before.length, side }
  // 애니 3 은 뒤 갈래 그림마다 한 칸(0x93d91) — 막음을 푼 뒤의 창 첫 그림도 센다
  const frozenAfter = before.filter((at) => at >= releaseTick).length
  return { kind: '뒤', drawCall: stateTick - releaseTick - 1 + frozenAfter, point }
}

/**
 * 큰 타구 0x13 이 끝나는 0x13 틱 — 0x406e8 은 `문턱 ≤ 공 틱` 인 첫 갱신에 0x17 을 예약하고, 공 틱은 막음을 푼 그림(r) 뒤 틀 끝마다 오른다
 * (상태 틱 k 의 공 틱 = max(0, k − r)). `pauseTicks` 는 창 그림이 없을 때의 끝(`hitPauseTicksOf` = 문턱 + 7, 문턱 ≤ 0 이면 그 값).
 */
export function bigHitEndTickOf(pauseTicks: number, releaseTick: number): number {
  if (pauseTicks <= HIT_STOP_TICKS) return pauseTicks
  return pauseTicks - HIT_STOP_TICKS + releaseTick
}

/** 4cc2c — 확대 배율 % = 100 + 2 × (6 − [+0x10a8]) */
export function bigHitZoomPercentOf(counter: number): number {
  return 100 + 2 * (BIG_HIT_HOLD_COUNTER_START - counter)
}

/** 4cc6c `lsls r4, r3, #0x1f ; bpl` — 옛값이 홀수(−1 포함)면 번쩍임 */
export function bigHitFlashesAt(counter: number): boolean {
  return (counter & 1) !== 0
}

/** 표 0xcfb54 — 존 한가운데(480 × 390 격자), +0x17e1 칸 */
const ZONE_CENTER_TABLE: readonly (readonly [number, number])[] = [
  [242, 326],
  [237, 326],
]

/** 4cbc0~4cc06 — 확대 중심 (px, py) = (trunc(W × x / 480), trunc(H × y / 390)) */
export function bigHitZoomCenterOf(side: number, width: number, height: number): { readonly x: number; readonly y: number } {
  const [x, y] = ZONE_CENTER_TABLE[side === 1 ? 1 : 0]
  return { x: Math.trunc((width * x) / 480), y: Math.trunc((height * y) / 390) }
}

/** 흐리기 n — 멈춤 갈래 4cc52 `movs r3, #2` · 뒤 갈래 4cdc6 `movs r3, #1` (감사 2026-10-24: 예전 주소 4cc7a 는 번쩍임 표 복사 크기 자리였다) */
export const BIG_HIT_HOLD_BLUR = 2
export const BIG_HIT_FOLLOW_BLUR = 1

/** 번쩍임 색 0x78FFFFFF — 채우기 [창+0x80] · 테두리 [창+0x7c] 같은 색 (4cc8a~4cc92) */
export const BIG_HIT_FLASH_COLOR = { r: 255, g: 255, b: 255, alpha: 0x78 } as const

/** 표 0xd0244 — 세모 16 개(점 셋 × (x, y) s32), 화면 가장자리에서 가운데로 뻗는 집중선 */
export const BIG_HIT_FLASH_TRIANGLES: readonly (readonly { readonly x: number; readonly y: number }[])[] = [
  [[52, 0], [56, 0], [82, 108]],
  [[132, 0], [135, 0], [132, 64]],
  [[226, 0], [230, 0], [194, 66]],
  [[239, 2], [239, 10], [191, 83]],
  [[239, 117], [239, 123], [181, 167]],
  [[239, 263], [239, 266], [211, 261]],
  [[239, 301], [239, 305], [153, 250]],
  [[224, 305], [220, 305], [164, 266]],
  [[109, 305], [107, 305], [110, 269]],
  [[19, 305], [15, 305], [73, 254]],
  [[6, 305], [1, 305], [76, 246]],
  [[0, 224], [0, 227], [39, 226]],
  [[0, 126], [0, 133], [60, 178]],
  [[0, 83], [0, 87], [33, 121]],
  [[0, 75], [0, 79], [36, 115]],
  [[0, 5], [50, 100], [0, 10]],
].map((triangle) => triangle.map(([x, y]) => ({ x, y })))

/** 4cd2c~4cda6 — 검은 테두리 4 줄 (x, y, w, h), 0x6a9f1 색 0 */
export function bigHitBorderRectsOf(width: number, height: number): readonly (readonly [number, number, number, number])[] {
  return [
    [0, 0, width, 4],
    [0, 0, 4, height],
    [0, height - 4, width, 4],
    [width - 4, 0, 4, height],
  ]
}

/** 4cdfa — game_effect 애니 번호 ([[+0x102c]+0x10]+8 의 +0xc) */
export const BIG_HIT_FOLLOW_ANIMATION = 3

/**
 * **0x13 동안 타자 스윙이 멈추고 반 속도로 도는 몫** — 스윙 객체 [+0xf9c] 는 틀 머리 0x3f060 끝(3f320 vt+8)에서만 한 칸 넘어간다
 * (2026-10-24 직접 떴다):
 * ```
 * 3f1dc  상태 0x13 이면: 3f1ea 막음 [+0x10a0] ≠ 0 이면 끝(3f32a) — 스윙도 안 넘어간다
 * 3f2dc  (카메라 뒤) +0x199a ≠ 0 이면 3f2e4 상태 틱 [+0x2c] 이 홀수면 끝, 짝수면 3f320 한 칸 · +0x199a == 0 이면 늘 한 칸
 * ```
 * 막음은 판정 0x51818 이 큰 타구(+0xfd4 ∈ 24~26 && +0x199a)에 세우고 0x13 틱 7 그림이 푼다 — 그래서 큰 타구는 0x13 틱 0~7 에
 * 스윙이 서 있고 틱 8 부터 짝수 틱에만 한 칸 간다. 0x13 이 아닌 상태(3f2f6 갈래)는 늘 한 칸이다.
 *
 * 돌려주는 값은 장면 틱 `sceneTick` 까지 건너뛴 스윙 칸 수 — `hitStartTick` 은 0x13 이 선 장면 틱, `hitEndTick` 은 0x13 다음 상태가 선
 * 장면 틱(아직 0x13 이면 null).
 */
export function bigHitSwingSkipsOf(
  isBigHit: boolean, hitStartTick: number, hitEndTick: number | null, sceneTick: number, releaseTick: number = HIT_STOP_TICKS,
): number {
  if (!isBigHit) return 0
  const lastTick = Math.min(sceneTick, hitEndTick === null ? sceneTick : hitEndTick - 1) - hitStartTick
  let skips = 0
  // 막음은 0x13 틱 r 의 그림이 푼다 — 그 틱의 갱신(3f1ea)까지 막혀 있다(창 첫 그림이 r 을 당긴다 — `bigHitReleaseTickOf`)
  for (let tick = 0; tick <= lastTick; tick += 1) {
    if (tick <= releaseTick || tick % 2 === 1) skips += 1
  }
  return skips
}

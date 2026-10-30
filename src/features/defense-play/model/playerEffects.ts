import { isHeadingBack } from '@/entities/fielding/model/autoAdvance'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { FIELDER_ACTION } from '@/shared/config/original/defenseAnimations'

/**
 * 수비 화면 선수 부착 효과(player_effect.pzx, 게임+0x1030)의 **상태** — 그리기 0x43278(야수) · 0x43a0c(주자)가 보는 칸.
 * 그리는 자리 · 그림 번호는 `pages/defense/lib/playerEffectMarks` 가 정한다. 여기는 그 칸을 진행기 쪽에서 만드는 몫이다.
 */

/** 야수 표시 카운터 초기값 — 펌블 b4280 `+0xb8 = 6` · 악송구 a1908 / 원바운드 a17fc / 송구 예보 두 번째 패스 b188e `+0xc0 = 4` */
export const FUMBLE_MARK_TICKS = 6
export const THROW_ERROR_MARK_TICKS = 4

/**
 * 야수 틱 0xa1284 의 카운터 줄이기 (a12b4~a12f2, 직접 뜬 것): 동작 잠금 +0xb4 > 0 인 틱은 잠금만 −1 하고 끝이라
 * +0xb8 · +0xc0 은 **잠금이 없을 때만** 1 씩 줄어든다(0 아래로 안 감).
 */
export function tickMarkCounter(value: number, isLocked: boolean): number {
  if (isLocked || value <= 0) return Math.max(0, value)
  return value - 1
}

/**
 * **달리기 먼지 자국** — 그리기 0x43546~0x43712 가 야수 효과 칸(+0x58~+0x74, vt6c~vt84)으로 돌리는 작은 상태 기계 (직접 뜬 것).
 * ```
 * 43546  vtdc() = 동작 ∈ {2,3,4}(↑ ← → 달리기, 0xa218c) 가 아니면 vt78 = 0xa0be8(+0x60 = 0, 끄기) — 안 그린다
 * 43562  vt74() = +0x60(켜짐) 이 0 이면:
 *          vt6c(0, …) = 0xa0bf8: +0x5c = 0 · +0x58 = 0 · +0x60 = 1 · +0x74 = 17 · +0x70 = 3 · +0x64 = 야수 위치
 *          435c2 동작 3(←) x += 500 · 2(↑) z += 500 · 4(→) x −= 500 → vt80 = 0xa0bcc(+0x64 = 그 점)   — 안 그린다
 *        켜져 있으면 vt70 = 0xa0c44: 옛 = +0x5c ; +0x5c += 1 ; 옛 > 2 면 +0x5c = 0 · +0x60 = 0 · 참 — 안 그린다
 *          거짓이면 vt7c(+0x64 의 점) → (x, z − y) 투영 · vt84 = 0xa0c6c(+0x58 == 0 ? +0x5c + +0x74 : −1)
 *          0xbe8d5(그리기 목록, 점, 깊이 z, player_effect, **프레임** vt84) — 18 · 19 · 20
 * ```
 * 곧 달리는 동안 5 틱마다 진행 반대쪽 500 뒤에 프레임 18 · 19 · 20 을 한 번씩 찍는다(시작 틱 · 끄는 틱은 빈다).
 * 상태는 그리기가 돌리므로 그림마다 한 걸음이다 — 웹은 스냅샷 한 장마다 한 걸음.
 */
export interface DustTrailState {
  readonly on: boolean
  /** +0x5c */
  readonly elapsed: number
  /** +0x64 (x, y, z) */
  readonly point: WorldPoint
}

export const DUST_TRAIL_OFF: DustTrailState = { on: false, elapsed: 0, point: { x: 0, y: 0, z: 0 } }
/** 0xa0bf8 의 +0x74 — vt84 가 경과에 더하는 첫 프레임 */
const DUST_TRAIL_FIRST_FRAME = 17
/** 435d8 `0xfa << 1` — 진행 반대쪽으로 떨어뜨리는 거리 */
const DUST_TRAIL_BEHIND = 500
/** 0xa0c54 `cmp r2, #2 ; ble` — 경과가 2 를 넘으면 끈다 */
const DUST_TRAIL_LAST_ELAPSED = 2

export function stepDustTrail(
  state: DustTrailState,
  action: number,
  position: WorldPoint,
): { readonly state: DustTrailState; readonly mark: { readonly point: WorldPoint; readonly frame: number } | null } {
  const isRunning = action === FIELDER_ACTION.runUp || action === FIELDER_ACTION.runLeft || action === FIELDER_ACTION.runRight
  if (!isRunning) return { state: { ...state, on: false }, mark: null }
  if (!state.on) {
    const point =
      action === FIELDER_ACTION.runLeft
        ? { ...position, x: position.x + DUST_TRAIL_BEHIND }
        : action === FIELDER_ACTION.runUp
          ? { ...position, z: position.z + DUST_TRAIL_BEHIND }
          : { ...position, x: position.x - DUST_TRAIL_BEHIND }
    return { state: { on: true, elapsed: 0, point }, mark: null }
  }
  if (state.elapsed > DUST_TRAIL_LAST_ELAPSED) return { state: { ...state, on: false, elapsed: 0 }, mark: null }
  const elapsed = state.elapsed + 1
  return {
    state: { ...state, elapsed },
    mark: { point: state.point, frame: elapsed + DUST_TRAIL_FIRST_FRAME },
  }
}

/**
 * 주자 슬라이딩 먼지 방향 **0x9ff40** (직접 뜬 것) — 0 이면 안 그린다. 그리기 0x43b18 이 1 → 애니 5 · 2 → 6 · 3 → 8 · 4 → 7.
 * ```
 * 9ff44  t = +0x7c(달려가는 루) ; g = +0x8c(닿은 루) ; t == 0 && g == 3 → t = 4 ; t == 3 && g == 0 → g = 4
 * 9ff60  0x9fe80(되돌아가는 중) 참:  g == 0 → (t == 1 ? 1 : ↓) ; g == 3 → (t == 2 ? 1 : 0)
 *                                     ↓ g == 1 → (t == 2 ? 2 : 0) ; g == 4 → (t == 3 ? 2 : 0) ; 그 밖 0
 *        거짓:                       g == 3 → (t == 4 ? 3 : ↓) ; g == 2 → (t == 1 ? 3 : t == 3 ? 4 : 0)
 *                                     ↓ g == 1 → (t == 0 ? 4 : 0) ; g == 2 → (t == 3 ? 4 : 0) ; 그 밖 0
 * ```
 * **원본 그대로**: 앞으로 가는 1 → 2루 · 홈 → 1루 슬라이딩은 0 이라 먼지가 없다(갈래 짝이 0x9fe80 의 참 · 거짓과
 * 어긋나 있다). 고치지 않는다.
 */
/** 9ff60 참(되돌아가는 중) 갈래 — `닿은 루>달려가는 루` → 방향, 없으면 0 */
const BACK_SLIDE_DUST: Readonly<Record<string, number>> = { '0>1': 1, '3>2': 1, '1>2': 2, '4>3': 2 }
/** 9ff60 거짓(앞으로) 갈래 */
const FORWARD_SLIDE_DUST: Readonly<Record<string, number>> = { '3>4': 3, '2>1': 3, '2>3': 4, '1>0': 4 }

export function slideDustDirectionOf(runner: RunnerState, previousTarget: number): number {
  const { targetBase, startBase } = runner
  // 9ff44 — 3루 ↔ 홈 사이는 홈을 4 로 본다
  const target = targetBase === 0 && startBase === 3 ? 4 : targetBase
  const touched = targetBase === 3 && startBase === 0 ? 4 : startBase
  const table = isHeadingBack(runner, previousTarget) ? BACK_SLIDE_DUST : FORWARD_SLIDE_DUST
  return table[`${touched}>${target}`] ?? 0
}

/**
 * **격자 열림 애니** — 공용 격자 위젯(만들기 0x79ed5 · 시작 0x7a005 · 한 걸음 0x79fa8 · 그리기 0x7a571)의 들어올 때 연출 (직접 떴다, S9 3-3).
 *
 * 시작 0x7a005(격자, 애니, 커서, 바탕) — 0x7a004~0x7a07e:
 * ```
 * +0x18 = 0 (깜빡임) · 보이는 줄 [g+0x1f4] = 0 · [g+0x1f8] = +0x78(줄 수)
 * 애니 == 0 → +9 = 1 · +0x50 = 0 · +0x48 = 줄 − 1 · +0x4c = 1 · +0x54 = +0x5c          ; 다 연 채
 * 애니 ≠ 0 → +0x50 = 칸 수 − 열 · +9 = 0 · +0x48 = 1 · +0x4c = 1 · +0x54 = 1
 *            (+0x74 ≠ s8 열 또는 +0x78 ≠ s8 줄이면 +0x48 ≥ +0x78 까지 미리 굴린다 — 열·줄이 127 을 넘을 때뿐이라 안 온다)
 * ```
 * 한 걸음 0x79fa8 — 0x79fa8~0x79ffe (줄 걸음 H = 줄높이 + 세로틈, 끝 +0x5c = H·(줄 − 1)):
 * ```
 * +9 이면 1
 * +0x4c <<= 가속(만들기 열한째 인자 +0x64) · +0x54 += +0x4c · +0x60 = H·+0x48
 * +0x54 ≥ +0x60 이면 +0x50 −= 열 · +0x48++ · +0x54 = +0x60 · +0x4c = 1 · +0x60 ≥ +0x5c 이면 +0x54 = +0x5c · +9 = 1
 * 돌려주는 값 = +9
 * ```
 * 그리기 0x7a571 은 칸 자리를 지금 값으로 셈하고(0x7a708~0x7a78e) 칸을 그린 뒤, +9 일 때만 커서(0x7b3a0)를 그리고, 끝에서
 * +0x18++ (0x7b490) · 한 걸음(0x7b4a4)을 굴려 그 +9 를 돌려준다:
 * ```
 * y[i] = 위쪽 y                                       i < +0x50
 *      = 위쪽 y + +0x54 − (줄 − 1 − 줄번호)·H          i ≥ +0x50
 * ```
 * → 칸이 모두 첫 줄 자리에 겹쳐 있다가(뒤 칸이 위에 그려진다) 아랫줄부터 한 줄씩 가속하며 떨어져 나와 자리를 잡는다.
 * 줄번호는 보이는 첫 줄 [g+0x1f4] 에서 센다 — 시작이 0 으로 두므로 애니 동안은 칸 번호 / 열 이다.
 */
export interface GridOpenShape {
  /** 줄 수 (s8 +0xb) */
  readonly rows: number
  /** 열 수 (s8 +0xa) */
  readonly columns: number
  /** 줄높이 (+0x44) */
  readonly rowHeight: number
  /** 세로틈 (s8 +0xd) */
  readonly rowGap: number
  /** 가속 시프트 — 만들기 0x79ed5 의 열한째 인자 (+0x64) */
  readonly shift: number
}

export interface GridOpenState {
  /** +0x50 — 이 칸 번호부터 미끄럼을 탄다 */
  readonly revealFrom: number
  /** +0x54 — 미끄럼 */
  readonly slide: number
  /** +0x4c — 이번 걸음 속도 */
  readonly speed: number
  /** +0x48 — 드러난 줄 수 */
  readonly shown: number
  /** +9 — 다 열었다 */
  readonly isDone: boolean
}

const rowStepOf = (shape: GridOpenShape) => shape.rowHeight + shape.rowGap
const openEndOf = (shape: GridOpenShape) => rowStepOf(shape) * (shape.rows - 1)

/** 시작 0x7a005 — `isAnimated` 가 둘째 인자(+5) */
export function gridOpenStart(shape: GridOpenShape, isAnimated: boolean): GridOpenState {
  if (!isAnimated) {
    return { revealFrom: 0, slide: openEndOf(shape), speed: 1, shown: shape.rows - 1, isDone: true }
  }
  return { revealFrom: shape.rows * shape.columns - shape.columns, slide: 1, speed: 1, shown: 1, isDone: false }
}

/** 한 걸음 0x79fa8 */
export function gridOpenStep(shape: GridOpenShape, state: GridOpenState): GridOpenState {
  if (state.isDone) return state
  const speed = state.speed << shape.shift
  const slide = state.slide + speed
  const target = rowStepOf(shape) * state.shown
  if (slide < target) return { ...state, speed, slide }
  const end = openEndOf(shape)
  const isDone = target >= end
  return {
    revealFrom: state.revealFrom - shape.columns,
    shown: state.shown + 1,
    slide: isDone ? end : target,
    speed: 1,
    isDone,
  }
}

/** 시작한 뒤 `steps` 걸음 굴린 값 */
export function gridOpenAfter(shape: GridOpenShape, steps: number, isAnimated = true): GridOpenState {
  let state = gridOpenStart(shape, isAnimated)
  for (let step = 0; step < steps && !state.isDone; step++) state = gridOpenStep(shape, state)
  return state
}

/** 칸 `index`(보이는 첫 칸에서 센 번호)를 다 연 자리에서 위아래로 얼마나 옮기나 (0x7a75c~0x7a78e) */
export function gridOpenCellDy(shape: GridOpenShape, state: GridOpenState, index: number): number {
  const row = Math.floor(index / shape.columns)
  const step = rowStepOf(shape)
  const y = index < state.revealFrom ? 0 : state.slide - (shape.rows - 1 - row) * step
  return y - row * step
}

export interface GridOpenDraw {
  /** 이 그림이 칸을 놓는 값 (그린 **뒤**에 굴리므로 앞 그림까지 굴린 값) */
  readonly state: GridOpenState
  /** 이 그림의 0x7a571 이 돌려준 값 — 다음 갱신의 키 ([skin+0xe4]) */
  readonly isDoneAfter: boolean
  /** 깜빡임 [격자+0x18] — 시작이 0 으로 두고 그릴 때마다 끝에서 +1 */
  readonly blink: number
}

/** 격자를 만든(시작한) 그림부터 센 `draw`(0 부터) 째 그림 */
export function gridOpenDrawAt(shape: GridOpenShape, draw: number, isAnimated: boolean): GridOpenDraw {
  const state = gridOpenAfter(shape, draw, isAnimated)
  return { state, isDoneAfter: gridOpenStep(shape, state).isDone, blink: draw }
}

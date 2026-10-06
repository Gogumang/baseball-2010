/**
 * **미션 화면의 목표 글 띠** — 원본 그리기 0x36714 (모드 5·6 일 때 0x36cb8 이 부른다, 직접 재역어셈).
 *
 * 원본은 목표 칸(행+0xa0..)의 값도 진행 수도 그리지 않는다. 미션을 열 때 0x3f584(3f706~3f742)가 레코드의
 * **목표 글 +0xe** 를 `0xbb08c(장면+0x180a, 글, 장면+0x1809, '|')` 로 `|` 마다 32바이트 줄로 잘라 두고
 * (줄 수 = `|` 수 + 1), 0x36714 가 그중 **한 줄만** 보인다. 판정 0xaaa6c 가 보는 목표 칸 중 글에 없는 것
 * (투수 9 의 '아웃' 1 · 타자 14 의 타점 1 · 안타 2)은 화면에 나오지 않는다 — 원본 그대로.
 * (0x36714 도 0xa5485 로 행+0xa0 을 꺼내지만(3678e) 결과를 바로 버린다.)
 *
 * 줄 넘김 (장면 칸: +0x1808 지금 줄 · +0x17fa 넘기는 중 · +0x1804 머무른 틱 · +0x17fc/+0x1800 밀린 x/y):
 * - 머무름(+0x17fa == 0, 36950~369b0): 지금 줄을 그리고, 줄이 둘 이상이면 +0x1804 를 올려 **20 을 넘는 틱**(21번째)에
 *   넘기기를 켠다(밀림 0 으로).
 * - 넘기기(3681e~3694e): 지금 줄을 (−x, −y), 다음 줄(끝이면 0번)을 (0x4b − x, 0x32 − y) 에 그린 뒤
 *   x += 5(0x4a 를 넘으면 0x4b) · y += 3(0x31 을 넘으면 0x32). 둘 다 닿은 틱에 넘기기를 끄고 지금 줄 +1(줄 수 이상이면 0)
 *   · +0x1804 = 0. → 넘기기는 그린 틱 기준 17틱(x 는 15틱째에 먼저 닿는다).
 * 시작 값은 모두 0 (0x3f584 3f72e~3f742).
 */

/** 머무는 틱 수 — `+0x1804 > 0x14` 가 서는 21번째 틱까지 (0x3699e) */
export const GOAL_TICKER_HOLD_TICKS = 21
/** 넘기며 x 가 밀리는 끝 (0x4b) · 한 틱 걸음 5 */
export const GOAL_TICKER_SHIFT_X = 0x4b
const STEP_X = 5
/** 넘기며 y 가 밀리는 끝 (0x32) · 한 틱 걸음 3 */
export const GOAL_TICKER_SHIFT_Y = 0x32
const STEP_Y = 3

/** 넘기기 틱 수 — x·y 가 둘 다 끝에 닿을 때까지 (y 쪽 17틱) */
const SLIDE_TICKS = Math.max(Math.ceil(GOAL_TICKER_SHIFT_X / STEP_X), Math.ceil(GOAL_TICKER_SHIFT_Y / STEP_Y))

export interface GoalTickerFrame {
  /** 지금 줄 번호 */
  readonly index: number
  /** 넘기는 중이면 들어오는 줄 번호, 아니면 null */
  readonly nextIndex: number | null
  /** 지금 줄이 밀린 양 (원본 픽셀) — 다음 줄은 (`GOAL_TICKER_SHIFT_X` − x, `GOAL_TICKER_SHIFT_Y` − y) 에 있다 */
  readonly offsetX: number
  readonly offsetY: number
}

/**
 * 띠를 연 뒤 `tick` 번째로 그리는 틱(0부터)의 모습. 줄이 하나 이하면 늘 0번 줄에 머문다.
 */
export function goalTickerFrameAt(tick: number, lineCount: number): GoalTickerFrame {
  if (lineCount <= 1) return { index: 0, nextIndex: null, offsetX: 0, offsetY: 0 }
  const cycle = GOAL_TICKER_HOLD_TICKS + SLIDE_TICKS
  const index = Math.floor(tick / cycle) % lineCount
  const inCycle = tick % cycle
  if (inCycle < GOAL_TICKER_HOLD_TICKS) return { index, nextIndex: null, offsetX: 0, offsetY: 0 }
  const step = inCycle - GOAL_TICKER_HOLD_TICKS
  return {
    index,
    nextIndex: index + 1 >= lineCount ? 0 : index + 1,
    offsetX: Math.min(step * STEP_X, GOAL_TICKER_SHIFT_X),
    offsetY: Math.min(step * STEP_Y, GOAL_TICKER_SHIFT_Y),
  }
}

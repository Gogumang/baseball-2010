import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * **틱 시계** — 시각(ms)을 원본 게임 루프의 정수 틱(한 틱 = `millisecondsPerFrame()`)으로 센다.
 *
 * 원본은 앱 루프가 틀마다 한 번 갱신하고 한 번 그린다 — 그 틀의 수가 곧 틱이다(속도 옵션 0x9f524 가 틀 길이만 정한다).
 * 웹은 여러 부품이 저마다 시각을 들고 있어도 **같은 틱 격자**로 나눠야 한 틱 안에서 그림이 두 번 바뀌지 않는다.
 * 그래서 시계 하나가 시각 → 틱을 정하고, 부품은 "그 일이 선 틱 번호"만 적어 (지금 틱 − 선 틱) 으로 센다.
 *
 * 속도가 바뀌면(환경설정 [속도]) 틀 길이가 달라진다 — 틱이 거꾸로 가거나 건너뛰지 않게, 바뀐 것을 처음 본 때 그 틱의 머리를
 * 새 기준점으로 삼아 거기서부터 새 길이로 센다(이미 센 틱 번호는 그대로 둔다).
 */
export interface TickClock {
  /** 시각 `time`(ms) 이 드는 틱 번호 */
  readonly tickOf: (time: number) => number
  /** 틱 `tick` 이 시작하는 시각(ms) — 지금 틀 길이로 잰다 */
  readonly startTimeOf: (tick: number) => number
  /** 기준점을 처음으로 되돌린다(시험용) */
  readonly reset: () => void
}

export function createTickClock(): TickClock {
  let anchor = { time: 0, tick: 0, length: millisecondsPerFrame() }
  /** 틀 길이가 바뀌었으면 `time` 이 드는 틱의 머리로 기준점을 옮긴다 */
  const sync = (time: number) => {
    const length = millisecondsPerFrame()
    if (length === anchor.length) return
    const tick = anchor.tick + Math.floor((time - anchor.time) / anchor.length)
    anchor = { time: anchor.time + (tick - anchor.tick) * anchor.length, tick, length }
  }
  return {
    tickOf: (time) => {
      sync(time)
      return anchor.tick + Math.floor((time - anchor.time) / anchor.length)
    },
    startTimeOf: (tick) => {
      sync(anchor.time)
      return anchor.time + (tick - anchor.tick) * anchor.length
    },
    reset: () => {
      anchor = { time: 0, tick: 0, length: millisecondsPerFrame() }
    },
  }
}

/**
 * **앱 틱** — 경기 장면 밖 화면(메인 메뉴 · 나리 · 시즌 · 관리 · 기록실 · 설정 …)이 같이 쓰는 틱. 원본 장면 프레임
 * (메인 메뉴 0x32dd8 · 시즌 0xe9ac · 나리 0x1cdec · 미션 고르기 0x1eb0c)은 모두 같은 앱 루프의 한 틀에 한 번 돈다.
 * 시각은 `performance.now()`(requestAnimationFrame 시각과 같은 시계)다.
 */
const appClock = createTickClock()

/** 실제 시각 `raw` 가 드는 앱 틱 */
export function appTickOf(raw: number): number {
  return appClock.tickOf(raw)
}

/** 지금 앱 틱 */
export function appTickNow(): number {
  return appClock.tickOf(performance.now())
}

/** 앱 틱 `tick` 이 시작하는 실제 시각 */
export function appTickStartTime(tick: number): number {
  return appClock.startTimeOf(tick)
}

/** 시험용 — 앱 틱 기준점을 되돌린다 */
export function resetAppTickClockForTest(): void {
  appClock.reset()
}

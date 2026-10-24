import { millisecondsPerFrame, onGameSpeedChange } from '@/shared/config/frameRate'

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
// 속도가 바뀐 그 순간 앱 틱의 기준점을 옮긴다 — 경기 장면 틱(`commonWindow`)은 이 앱 틱에서 셈하므로 기준점이 하나다.
// 늦게(다음에 읽힐 때) 옮기면 공용 창 아래에서 서 있던 장면 시각처럼 늦게 읽히는 쪽이 다른 자리에 기준점을 잡는다
onGameSpeedChange(() => {
  appClock.tickOf(performance.now())
})

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

/**
 * **틱 머리마다 부르는 setInterval** — `setInterval(콜백, millisecondsPerFrame())` 은 건 때부터 재므로 부품마다 틱 안쪽 다른 자리에서
 * 울린다. 이 시계는 시계 `clock` 의 틱 머리에 맞춰 울린다(건 뒤 첫 머리부터, 머리 하나에 한 번). `now` 는 그 시계가 재는 지금 시각,
 * `stands` 가 참이면 시계가 서 있다고 보고 실제 시각 한 틀마다 울린다(경기 장면 시계가 공용 창 아래에서 설 때 — 부르는 쪽이 그때를 거른다).
 * 돌려준 함수로 거둔다.
 */
export function setTickInterval(
  callback: () => void,
  clock: { readonly now: () => number; readonly tickOf: (time: number) => number; readonly startTimeOf: (tick: number) => number },
  stands: () => boolean = () => false,
): () => void {
  let handle: ReturnType<typeof setTimeout> | null = null
  let lastTick = clock.tickOf(clock.now())
  let isCleared = false
  const arm = () => {
    if (isCleared) return
    const now = clock.now()
    let delay: number
    let target: number | null = null
    if (stands()) {
      delay = millisecondsPerFrame()
    } else {
      target = Math.max(lastTick + 1, clock.tickOf(now) + 1)
      delay = Math.max(0, clock.startTimeOf(target) - now)
    }
    handle = setTimeout(() => {
      handle = null
      if (target !== null) {
        // 시계가 섰다 풀린 사이(창 아래)면 머리에 아직 못 닿았다 — 다시 잰다
        if (stands() || clock.tickOf(clock.now()) < target) {
          arm()
          return
        }
        lastTick = target
      }
      callback()
      arm()
    }, delay)
  }
  arm()
  return () => {
    isCleared = true
    if (handle !== null) clearTimeout(handle)
  }
}

/** 앱 틱 머리마다 부르는 setInterval (`setTickInterval`) — 경기 장면 밖 화면 · 공용 창의 틀 셈 */
export function setAppTickInterval(callback: () => void): () => void {
  return setTickInterval(callback, { now: () => performance.now(), tickOf: appTickOf, startTimeOf: appTickStartTime })
}

/**
 * **앱 틱으로 재는 setTimeout** — 지금 앱 틱에서 `ticks` 틱 뒤의 틱 머리에 `callback`. `setTimeout(콜백, n × 틀 길이)` 는 건 때가 틱
 * 안쪽이라 끝도 틱 안쪽에 선다 — 이 시계는 끝을 앱 틱 격자에 맞춘다. 돌려준 함수로 거둔다.
 */
export function setAppTickTimeout(callback: () => void, ticks: number): () => void {
  const now = performance.now()
  const due = appTickStartTime(appTickOf(now) + Math.max(0, ticks))
  const handle = setTimeout(callback, Math.max(0, due - now))
  return () => clearTimeout(handle)
}

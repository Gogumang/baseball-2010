import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'
import { createKeyHold, HOLD_STAGE_MASK, type KeyHold } from '@/shared/lib/sceneKeyLatch/keyHold'

/**
 * 받은 키 줄 — 키마다 받은 장면 틱을 함께 든다. 원본은 키 콜백이 [+0x20] 에 적기만 하고 다음 틀의 0xbca05 → 키 0x498d4(52d9e) →
 * 0x53420 이 그 틀의 갱신보다 먼저 처리한다(`sceneKeyLatch`) — 받은 틱의 갱신에는 먹이지 않고 그 뒤 갱신부터 먹인다.
 * 받은 칸 [+0x20] 은 하나라(누름 0x39f4c 가 덮어쓰기만 한다, r167) 한 틀에 둘이 오면 뒤 키만 남는다 — 같은 틱에 받은 키는 마지막
 * 하나만 먹이고 앞 키는 버린다. 틱이 다른 키는 한 갱신에 하나씩 먹인다.
 */
function takePressFor(presses: DefenseKeyPress[], ticks: number[], sceneTick: number | null, hold: DefenseKeyHold): DefenseKeyPress | null {
  const press = takeArrivedPress(presses, ticks, sceneTick)
  if (sceneTick === null || isFrameCounted(hold, sceneTick)) return press
  const repeat = stepHoldFrames(hold, sceneTick, press)
  hold.lastTick = sceneTick
  return withRepeat(press, repeat)
}

/** 이 틀은 이미 셌다 */
function isFrameCounted(hold: DefenseKeyHold, sceneTick: number): boolean {
  return hold.lastTick !== null && sceneTick <= hold.lastTick
}

/** 틀마다 한 번 — 키 처리가 안 돈 틀(건너뛰기 · 따라잡기)도 0xbca05 는 틀 머리마다 돈다. 이 틀의 되풀이 키를 낸다 */
function stepHoldFrames(hold: DefenseKeyHold, sceneTick: number, press: DefenseKeyPress | null): string | null {
  const from = hold.lastTick === null ? sceneTick : hold.lastTick + 1
  let repeat: string | null = null
  for (let tick = from; tick <= sceneTick; tick += 1) {
    const hasRelease = takeReleaseBefore(hold, tick)
    const out = hold.hold.frame(tick === sceneTick ? (press?.key ?? null) : null, hasRelease)
    // 길게 누른 뒤 뗌(비트 8 만)은 0x536bc 가 상태 0x11 로만 보낸다 — 0x17 에 오는 것은 단계 비트 4~7 이 선 되풀이뿐
    repeat = tick === sceneTick && (out.flags & HOLD_STAGE_MASK) !== 0 ? out.repeat : null
  }
  return repeat
}

/** 이 틀 앞에 받은 뗌이 있으면 꺼내고 참 */
function takeReleaseBefore(hold: DefenseKeyHold, tick: number): boolean {
  const hasRelease = hold.releaseTicks.some((at) => at < tick)
  if (hasRelease) hold.releaseTicks = hold.releaseTicks.filter((at) => at >= tick)
  return hasRelease
}

/** 누름과 되풀이가 한 틀에 오면(앞 키를 누른 채 새 키) 0x498d4 가 누름(49a3a) → 되풀이(49a56) 차례로 둘 다 보낸다 */
function withRepeat(press: DefenseKeyPress | null, repeat: string | null): DefenseKeyPress | null {
  if (repeat === null) return press
  const repeated: DefenseKeyPress = { key: repeat, isRepeat: true }
  return press === null ? repeated : { ...press, thenRepeat: repeated }
}

function takeArrivedPress(presses: DefenseKeyPress[], ticks: number[], sceneTick: number | null): DefenseKeyPress | null {
  const arrived = ticks[0]
  if (arrived === undefined || (sceneTick !== null && arrived >= sceneTick)) return null
  let count = 1
  while (ticks[count] === arrived) count += 1
  ticks.splice(0, count)
  return presses.splice(0, count).at(-1) ?? null
}

/**
 * **누른 채 되풀이** — 0x498d4 는 이 틀의 누름(49a3a, 표시 0) 다음에 되풀이 [장면+0x50](49a5c, 표시 [장면+0x6c])을 조작 객체에 준다.
 * 되풀이는 키 객체 틀 머리 0xbca05 가 누른 틀 뒤 4틀마다 스스로 센다(`keyHold`) — 브라우저 자동 되풀이 keydown 은 버리고, keyup 이
 * 뗌 [+0x24] 이다. 한 틀에 누름과 되풀이가 함께 오면(앞 키를 누른 채 새 키를 누름) 누름 → 되풀이 차례로 둘 다 먹인다
 * (`DefenseKeyPress.thenRepeat` — 진행기가 그 틀의 0x53420 을 키마다 한 번씩 돈다). 뗌 [+0x54] 은 표시에 0x200 이 서 있어
 * 0x536bc(536f8~53702)가 상태 0x11 로만 보낸다 — 0x17 에는 안 온다.
 */
interface DefenseKeyHold {
  readonly hold: KeyHold
  /** 받은 뗌의 장면 틱 */
  releaseTicks: number[]
  /** 마지막으로 센 틀 */
  lastTick: number | null
}

function newDefenseKeyHold(): DefenseKeyHold {
  return { hold: createKeyHold(), releaseTicks: [], lastTick: null }
}

/** 받은 키 줄 — 아직 진행기에 안 먹인 키 · 키마다 받은 장면 틱(`takePressFor`) · 누른 채 되풀이 셈(`DefenseKeyHold`) */
export interface SceneKeyQueue {
  readonly presses: DefenseKeyPress[]
  readonly pressTicks: number[]
  readonly hold: DefenseKeyHold
}

export function newSceneKeyQueue(): SceneKeyQueue {
  return { presses: [], pressTicks: [], hold: newDefenseKeyHold() }
}

/** 키 사건 — 누른 키와 받은 장면 틱을 줄에 담는다 */
export function queueKeyPress(queue: SceneKeyQueue, key: string, tick: number): void {
  queue.presses.push({ key })
  queue.pressTicks.push(tick)
}

/** 키 사건 — 뗀 장면 틱을 누른 채 셈에 담는다 */
export function queueKeyRelease(queue: SceneKeyQueue, tick: number): void {
  queue.hold.releaseTicks.push(tick)
}

/** 이 장면 틱의 갱신이 먹일 키 하나를 줄에서 꺼낸다 (`takePressFor`) */
export function takeQueuedPress(queue: SceneKeyQueue, sceneTick: number | null): DefenseKeyPress | null {
  return takePressFor(queue.presses, queue.pressTicks, sceneTick, queue.hold)
}

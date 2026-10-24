import { useEffect, useState } from 'react'
import { gameSceneTickNow, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **키 사건 칸 — 받은 키는 다음 틀의 키 처리가 읽는다** (2026-10-24 직접 떴다, r160 · r167).
 *
 * 원본은 키 콜백이 장면 키 객체(장면+0x18)의 받은 칸 [+0x20](누름) · [+0x24](뗌)에 적어 두기만 하고, 장면 틀 머리가 그것을 읽는다.
 * 경기 장면 0x52c50 의 한 틀:
 * ```
 * 52cbc  0xbca05(장면+0x18) — bca0a~bca16 이 사건 칸 +0x1c · +0x28 · +0x34 · +0x38 · +0x3c · +0x54 를 지우고, [+0x20] 을 0xbca00 으로
 *        바꿔 +0x28(이번 틀 키)에, [+0x24](뗌)면 bcaf0~bcb02 가 +0x54 |= 0x200 · +0x3c 에 적은 뒤 bcb04~bcb08 이 [+0x20] · [+0x24] 를 비운다
 * 52cc6  공용 창 게이트 0x754f9 — 창이 서 있으면 아래를 다 건너뛴다(그 틀의 키 사건은 다음 틀 0xbca05 머리가 지운다 — 모아 두지 않는다)
 * 52cd4  0xbc9c9 — 예약된 상태가 선다(틱 0 · 진입 깃발) · 52cdc 진입 표 0xd04bc
 * 52d9e  키 0x498d4 — '*'(49918~49948: 상태 0xd~0x15 면 0x741a1 메뉴 창 · 0x3c02c) · '#'(4994a~499f8: 0x38984 참이고 상태 0xe · 0xf 면
 *        모드 3 은 StrGAME[104] 물음 0xbbef9, 그 밖은 0x49598 → 0xb)를 본 뒤 499fa~49ab4 가 사람 조작 객체 둘에 이 틀의 누름(+0x28) →
 *        되풀이(+0x38) → 뗌(+0x3c) 차례로 보낸다(0x53670 · 0x536bc · 0x53420 …)
 * 52da2  [장면+0x34](이 틀에 누름이 있다)면 상태별 키 함수 — 0xb 0x495fc · 0xc 인트로 0x39b54 · 0x19 0x407f0 · 0x1a 0x40a08 ·
 *        0x1e 벤치 클리어링 0x40628 · 0x21 0x3e25c · 0x23 감독 대사 창 0x50794 (52da2~52e10)
 * 52e14  갱신 표 0xd0530 → 그리기
 * ```
 * 곧 틀 T 안쪽에 들어온 키는 **틀 T+1** 의 진입 뒤 · 갱신 앞에서 처리된다. 웹 키 사건(keydown)은 아무 때나 오므로, 받은 키를 그 때의
 * 장면 틱과 함께 이 칸에 넣어 두고 장면 부품의 틀(틱 머리)이 진입 뒤 · 갱신 앞에서 꺼낸다(`take`) — 받은 틱보다 뒤 틱에서만 꺼낸다.
 * 창이 서 있는 틀에 꺼내려 하면 버린다(`clear`, 52cc6).
 *
 * **받은 칸은 하나다** (r167 직접 떴다): 장면 vtable 0xcfa0c 의 누름 칸 [3] 0x39f4c 는 `[장면+0x38](= 키 객체+0x20) = 키`, 뗌 칸 [4]
 * 0x39f68 은 `[장면+0x3c](= +0x24) = 키` 를 덮어쓰기만 한다(쌓는 줄이 없다). 그래서 한 틀 안에 키가 둘 오면 **뒤 키만** 다음 틀에
 * 처리되고, 뗌도 같다(마지막 뗌 하나). 한 틀의 누름 하나 · 뗌 하나는 0x498d4 가 누름 먼저 · 뗌 나중으로 보낸다.
 * 웹은 받은 틱마다 마지막 누름 · 마지막 뗌만 남긴다. 처리 손잡이가 없는 키(원본에서 아무 일 없는 키)도 칸을 덮어야 하므로, 칸이 올라
 * 있는 동안 창 잡기 단계에서 폰 키(`SLOT_KEYS`)마다 빈 칸 하나를 먼저 넣고, 같은 사건의 손잡이들(`push` · `pushSceneKey`)이 그 칸에
 * 붙는다 — 키 하나가 0x498d4 안에서 '*' 가지와 상태 키 함수에 함께 가는 것과 같다.
 *
 * 경기 장면 밖 장면 틀도 같은 차례다(r167 직접 떴다): 시즌 0xe9ac(e9b4 0xbca05 → e9c0 0xbc9c9 → 상태 표 0xcbea0) · 나리 0x1cdec
 * (1cdf4 0xbca05 → 1ce00 0xbc9c9 → 상태 표 0xcc728) · 메인 메뉴 0x32fa0(32fb8 0xbc9c9 → 32fc0 0xbca05 → 진입 → 갱신 0x32634 · 0x32dd8)
 * 모두 틀 머리에서 받은 칸을 이번 틀 키로 옮기고 그 틀의 상태 함수가 읽는다 — 받은 다음 틀에 처리하고 칸은 하나다. 앱 틱으로 세는
 * 칸은 `createSceneKeyLatch(appTickNow)` 로 만든다.
 */
export interface SceneKeyLatch {
  /**
   * 키 하나를 받는다 — 받은 장면 틱을 함께 적는다. `kind` 는 누름 [+0x20] · 뗌 [+0x24] 갈래(기본 누름).
   * `apply` 는 꺼낸 틀의 상태 틱(`runSceneKeys` 의 `stateTick`)을 받는다
   */
  readonly push: (apply: SceneKeyApply, kind?: SceneKeyKind) => void
  /** 장면 틱 `tick` 의 틀 머리 — 그보다 앞 틱에 받은 키를 받은 틱마다 마지막 누름 · 마지막 뗌 차례로 꺼낸다 */
  readonly take: (tick: number) => readonly SceneKeyApply[]
  /** 받은 키를 버린다 — 창이 선 틀(52cc6) · 부품이 내려갈 때 */
  readonly clear: () => void
}

/** 받은 키 갈래 — 누름 [+0x20] · 뗌 [+0x24] */
export type SceneKeyKind = 'press' | 'release'
/** 받은 키 처리 — 꺼낸 틀의 상태 틱을 받는다(안 써도 된다) */
export type SceneKeyApply = (stateTick: number) => void

interface SceneKeyEntry {
  readonly tick: number
  readonly kind: SceneKeyKind
  readonly applies: SceneKeyApply[]
}

/** 칸마다 빈 칸 넣기 — 창 잡기 단계(`armSlot`)만 쓴다 */
const blankPushers = new WeakMap<SceneKeyLatch, (kind: SceneKeyKind) => SceneKeyEntry>()

/** 창 잡기 단계에서 막 넣은 빈 칸 — 같은 키 사건의 손잡이들이 여기에 붙는다 */
let armed: { readonly latch: SceneKeyLatch; readonly entry: SceneKeyEntry } | null = null

export function createSceneKeyLatch(tickNow: () => number = gameSceneTickNow): SceneKeyLatch {
  let pending: SceneKeyEntry[] = []
  const latch: SceneKeyLatch = {
    push: (apply, kind = 'press') => {
      const current = armed
      if (current !== null && current.latch === latch && current.entry.kind === kind && current.entry.tick === tickNow()
        && pending.includes(current.entry)) {
        current.entry.applies.push(apply)
        return
      }
      pending.push({ tick: tickNow(), kind, applies: [apply] })
    },
    take: (tick) => {
      const due = pending.filter((entry) => entry.tick < tick)
      if (due.length === 0) return []
      pending = pending.filter((entry) => entry.tick >= tick)
      const applies: SceneKeyApply[] = []
      const ticks = [...new Set(due.map((entry) => entry.tick))].sort((a, b) => a - b)
      for (const at of ticks) {
        const ofTick = due.filter((entry) => entry.tick === at)
        // 받은 칸 [+0x20] · [+0x24] 는 하나 — 그 틀의 마지막 누름 · 마지막 뗌만 남는다. 0x498d4 는 누름(+0x28) 먼저, 뗌(+0x3c) 나중
        const lastPress = ofTick.filter((entry) => entry.kind === 'press').at(-1)
        const lastRelease = ofTick.filter((entry) => entry.kind === 'release').at(-1)
        if (lastPress !== undefined) applies.push(...lastPress.applies)
        if (lastRelease !== undefined) applies.push(...lastRelease.applies)
      }
      return applies
    },
    clear: () => {
      pending = []
    },
  }
  blankPushers.set(latch, (kind) => {
    const entry: SceneKeyEntry = { tick: tickNow(), kind, applies: [] }
    pending.push(entry)
    return entry
  })
  return latch
}

/** 받은 키를 처리하는 중인 깊이 (`isRunningSceneKeys`) */
let runningDepth = 0

/**
 * 지금 받은 키를 처리하는 중인가 — 키 자리(52d9e)에서 연 창은 그 틀의 갱신(52e14~)이 이미 게이트(52cc6)를 지나 한 번 더 돈다.
 * 키 자리 밖(칸이 없어 바로 처리)에서 열면 웹은 그 한 틀을 여는 자리에서 따로 돌린다(`useInGameMenuState`)
 */
export function isRunningSceneKeys(): boolean {
  return runningDepth > 0
}

/**
 * 장면 틱 `tick` 의 틀 머리에서 받은 키를 처리한다. `stateTick` 은 처리에 넘길 상태 틱(안 주면 `tick`) — 부품이 따로 세는
 * 상태 틱([장면+0x2c])을 보는 키(경기 끝 판의 입력 잠금 따위)가 쓴다
 */
export function runSceneKeys(latch: SceneKeyLatch, tick: number, stateTick: number = tick): void {
  const applies = latch.take(tick)
  if (applies.length === 0) return
  runningDepth += 1
  try {
    for (const apply of applies) apply(stateTick)
  } finally {
    runningDepth -= 1
  }
}

/**
 * **지금 키를 받는 장면 부품의 칸** — 같은 장면 키 객체를 화면(도루 '3'/'2'/'1' · 견제 '3'/'1'/'7' · '*' · '#' · 0xe OK)과 장면 부품
 * (타석 · 구질 고르기 · 인트로 · 경기 끝 판 · 감독 대사 창 …)이 함께 쓴다(원본은 키 0x498d4 한 곳이 상태 키 함수로 보낸다).
 * 장면 부품이 서 있는 동안 제 칸을 올려 두면(`openSceneKeyLatch`) 화면이 받은 키도 같은 칸에 같은 차례로 들어 그 부품의 틀에서
 * 처리된다. 올린 칸이 없으면 바로 처리한다(장면 틀이 없는 자리 — 시험 따위).
 */
const owners: SceneKeyLatch[] = []

/**
 * 받은 칸을 덮는 폰 키 — 숫자 · '*' · '#' · 방향 · OK · CLR(키패드 `phoneKeys`)와 웹이 같은 키로 읽는 스페이스 · Backspace ·
 * Shift(번트 1 '8'). 그 밖의 키보드 키는 폰에 없는 키라 칸을 덮지 않는다
 */
const SLOT_KEYS: ReadonlySet<string> = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'Backspace', 'Shift',
])

/** 받은 칸을 덮는 폰 키인가 (`SLOT_KEYS`) — 앱 키 문(`appKeyGate`)도 같은 키만 칸에 넣는다 */
export function isSlotKey(key: string): boolean {
  return SLOT_KEYS.has(key)
}

/** 장면 부품의 칸이 하나라도 올라 있는가 */
export function hasOpenSceneKeyLatch(): boolean {
  return owners.length > 0
}

let disarmHandle: ReturnType<typeof setTimeout> | null = null

/** 창 잡기 단계 — 폰 키 사건마다 맨 위 칸에 빈 칸을 넣는다(손잡이가 없는 키도 받은 칸을 덮는다) */
function armSlot(event: KeyboardEvent, kind: SceneKeyKind): void {
  armed = null
  const owner = owners[owners.length - 1]
  if (owner === undefined || !SLOT_KEYS.has(event.key)) return
  // 누르고 있는 반복은 폰에 없다(원본은 0xbca05 가 누른 채 4틀마다 되풀이 [+0x38] 을 스스로 센다 — `keyHold`) · 창이 서 있으면
  // 키 사건은 창 몫이다(52cc6)
  if (event.repeat || isGameSceneFrozen()) return
  const pushBlank = blankPushers.get(owner)
  if (pushBlank === undefined) return
  armed = { latch: owner, entry: pushBlank(kind) }
  // 같은 사건의 손잡이들(잡기 단계 뒤 거품 단계까지)만 붙는다 — 사건 처리가 다 끝나면 푼다
  if (disarmHandle !== null) clearTimeout(disarmHandle)
  disarmHandle = setTimeout(() => {
    armed = null
    disarmHandle = null
  }, 0)
}

const onSlotKeyDown = (event: KeyboardEvent) => armSlot(event, 'press')
const onSlotKeyUp = (event: KeyboardEvent) => armSlot(event, 'release')

function listenSlotKeys(isOn: boolean): void {
  if (typeof window === 'undefined') return
  if (isOn) {
    window.addEventListener('keydown', onSlotKeyDown, true)
    window.addEventListener('keyup', onSlotKeyUp, true)
  } else {
    window.removeEventListener('keydown', onSlotKeyDown, true)
    window.removeEventListener('keyup', onSlotKeyUp, true)
  }
}

/** 칸을 올린다 — 돌려준 함수로 내린다(받아 둔 키는 칸에 남는다 — 같은 부품이 루프를 다시 세우면 이어 꺼낸다) */
export function openSceneKeyLatch(latch: SceneKeyLatch): () => void {
  if (owners.length === 0) listenSlotKeys(true)
  owners.push(latch)
  let isClosed = false
  return () => {
    if (isClosed) return
    isClosed = true
    const at = owners.lastIndexOf(latch)
    if (at < 0) return
    owners.splice(at, 1)
    if (armed?.latch === latch) armed = null
    if (owners.length === 0) listenSlotKeys(false)
  }
}

/** 화면이 받은 장면 키 — 지금 올라 있는 장면 부품의 칸에 넣는다(없으면 바로 처리) */
export function pushSceneKey(apply: SceneKeyApply, kind: SceneKeyKind = 'press'): void {
  const owner = owners[owners.length - 1]
  if (owner === undefined) apply(gameSceneTickNow())
  else owner.push(apply, kind)
}

/** 시험용 — 올린 칸을 다 내린다 */
export function resetSceneKeyLatchesForTest(): void {
  owners.length = 0
  armed = null
  listenSlotKeys(false)
}

/** 부품이 서 있는 동안 올려 두는 제 키 칸 — 키 손잡이는 여기에 넣고(`push`) 부품의 틀이 꺼낸다(`runSceneKeys` · `useSceneTick`) */
export function useSceneKeyLatchOwner(): SceneKeyLatch {
  const [latch] = useState(() => createSceneKeyLatch())
  useEffect(() => openSceneKeyLatch(latch), [latch])
  return latch
}

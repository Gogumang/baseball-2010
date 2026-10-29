import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'

export interface SceneKeyLatch {
  /**
   * 키 하나를 받는다 — 받은 장면 틱을 함께 적는다. `kind` 는 누름 [+0x20] · 뗌 [+0x24] 갈래(기본 누름).
   * `apply` 는 꺼낸 틀의 상태 틱(`runSceneKeys` 의 `stateTick`)을 받는다. `inputTime` 은 키 사건이 난 실제 시각(`inputTimeOf`) —
   * 주면 받은 틱을 그때 화면에 있던 그림의 틱으로 센다(`tickAt`), 안 주면 지금 틱
   */
  readonly push: (apply: SceneKeyApply, kind?: SceneKeyKind, inputTime?: number) => void
  /** 실제 시각 `inputTime` 에 키를 받았으면 받은 틱 — 그때 화면에 있던 그림의 틱(칸을 만들 때 준 셈, 없으면 지금 틱) */
  readonly tickAt: (inputTime: number) => number
  /** 장면 틱 `tick` 의 틀 머리 — 그보다 앞 틱에 받은 키를 받은 틱마다 마지막 누름 · 마지막 뗌 차례로 꺼낸다 */
  readonly take: (tick: number) => readonly SceneKeyApply[]
  /** 받은 키를 버린다 — 창이 선 틀(52cc6) · 부품이 내려갈 때 */
  readonly clear: () => void
}

/** 받은 키 갈래 — 누름 [+0x20] · 뗌 [+0x24] */
export type SceneKeyKind = 'press' | 'release'
/** 받은 키 처리 — 꺼낸 틀의 상태 틱을 받는다(안 써도 된다) */
export type SceneKeyApply = (stateTick: number) => void

export interface SceneKeyEntry {
  readonly tick: number
  readonly kind: SceneKeyKind
  readonly applies: SceneKeyApply[]
}

/** 칸마다 빈 칸 넣기 — 창 잡기 단계(`armSlot`)만 쓴다. `inputTime` 은 키 사건이 난 시각 */
export const blankPushers = new WeakMap<SceneKeyLatch, (kind: SceneKeyKind, inputTime: number) => SceneKeyEntry>()

/** 창 잡기 단계에서 막 넣은 빈 칸 — 같은 키 사건의 손잡이들이 여기에 붙는다 (`slotKeys` 가 넣고 푼다) */
export const armedSlot: { current: { readonly latch: SceneKeyLatch; readonly entry: SceneKeyEntry } | null } = { current: null }

/** 이 손잡이가 잡기 단계가 넣은 칸에 붙는가 — 같은 칸 · 같은 갈래 · 같은 틱(시각을 안 준 손잡이도 같은 사건) · 아직 안 꺼낸 칸 */
function joinsArmedEntry(
  latch: SceneKeyLatch,
  pending: readonly SceneKeyEntry[],
  kind: SceneKeyKind,
  tick: number,
  inputTime: number | undefined,
): boolean {
  const current = armedSlot.current
  if (current === null || current.latch !== latch || current.entry.kind !== kind) return false
  return (inputTime === undefined || current.entry.tick === tick) && pending.includes(current.entry)
}

/** 받은 틱 하나의 처리 — 받은 칸 [+0x20] · [+0x24] 는 하나라 마지막 누름 · 마지막 뗌만, 0x498d4 는 누름(+0x28) 먼저 · 뗌(+0x3c) 나중 */
function appliesOfTick(ofTick: readonly SceneKeyEntry[]): SceneKeyApply[] {
  const lastPress = ofTick.filter((entry) => entry.kind === 'press').at(-1)
  const lastRelease = ofTick.filter((entry) => entry.kind === 'release').at(-1)
  return [...(lastPress?.applies ?? []), ...(lastRelease?.applies ?? [])]
}

/** 꺼낼 칸들을 받은 틱 차례로 처리 목록으로 */
function appliesOfDue(due: readonly SceneKeyEntry[]): SceneKeyApply[] {
  const ticks = [...new Set(due.map((entry) => entry.tick))].sort((a, b) => a - b)
  return ticks.flatMap((at) => appliesOfTick(due.filter((entry) => entry.tick === at)))
}

/**
 * 칸을 만든다. `tickNow` 는 지금 틱, `tickAt` 은 실제 시각에 받은 키의 틱 — 장면 부품이 그린 그림을 적어 두면(`shownSceneTicks`) 그때
 * 화면에 있던 그림의 틱을 준다(원본은 키를 받은 틀 = 마지막으로 그린 틀). 안 주면 언제 받았든 지금 틱이다
 */
export function createSceneKeyLatch(
  tickNow: () => number = gameSceneTickNow,
  tickAt: (inputTime: number) => number = () => tickNow(),
): SceneKeyLatch {
  let pending: SceneKeyEntry[] = []
  const latch: SceneKeyLatch = {
    push: (apply, kind = 'press', inputTime) => {
      const tick = inputTime === undefined ? tickNow() : tickAt(inputTime)
      // 같은 키 사건의 손잡이는 잡기 단계가 넣은 칸에 붙는다 — 그 칸은 사건 시각으로 센 틱이다(시각을 안 준 손잡이도 같은 사건이다)
      if (joinsArmedEntry(latch, pending, kind, tick, inputTime)) {
        armedSlot.current?.entry.applies.push(apply)
        return
      }
      pending.push({ tick, kind, applies: [apply] })
    },
    tickAt,
    take: (tick) => {
      const due = pending.filter((entry) => entry.tick < tick)
      if (due.length === 0) return []
      pending = pending.filter((entry) => entry.tick >= tick)
      return appliesOfDue(due)
    },
    clear: () => {
      pending = []
    },
  }
  blankPushers.set(latch, (kind, inputTime) => {
    const entry: SceneKeyEntry = { tick: tickAt(inputTime), kind, applies: [] }
    pending.push(entry)
    return entry
  })
  return latch
}

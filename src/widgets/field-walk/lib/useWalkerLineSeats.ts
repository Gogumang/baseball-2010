import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { type BenchClearingOffenseAces, seatsAfterBenchClearing } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { NEW_WALKER_LINE_SEATS, type WalkerLineSeats, seatsAfterDefensePlay, seatsAfterHalfInningBoard } from '@/widgets/field-walk/lib/walkerAces'

type SeatRecords = readonly { readonly position: number; readonly ace: number | null }[]

export interface WalkerLineSeatsEvents {
  /** 경기 장면 0x104 하나 — 바뀌면 두 줄을 0 으로 (장면을 새로 세웠다) */
  readonly sceneKey: unknown
  /**
   * 지금 서 있는 수비 판(상태 0x17)의 정체 — 바뀌면 판 시작 0xb0fb4 가 한 번 돈 것으로 본다. 재생 갈래 · 실시간 갈래 어느 쪽이든
   * 같은 판이면 같은 값을 줘도 되고(같은 팀 · 같은 니블로 두 번 훑어도 같다) null 이면 판 없음
   */
  readonly playKey: unknown
  /** 판 시작 때의 수비 팀 레코드 차례 — 판을 낸 걸음 **앞** 그림의 값을 쓴다(그 판 뒤로 반 이닝이 바뀌었을 수 있다) */
  readonly playDefenseRecords: SeatRecords | null
  /** 교대 판 0x3fac4 — 판의 정체(serial)와 두 팀 레코드 차례. 판이 없으면 null */
  readonly board: { readonly key: unknown; readonly defense: SeatRecords; readonly offense: SeatRecords } | null
  /** 벤치 클리어링 진입 0x3a5f0 — 정체와 공격 줄 재료. 없으면 null */
  readonly benchClearing: { readonly key: unknown; readonly offense: BenchClearingOffenseAces | null } | null
}

interface WalkerLineSeatsMemory {
  readonly sceneKey: unknown
  readonly seats: WalkerLineSeats
  readonly playKey: unknown
  readonly boardKey: unknown
  readonly boardBefore: WalkerLineSeats
  readonly benchKey: unknown
  readonly benchDefense: WalkerLineSeats['defense']
  readonly previousPlayDefense: SeatRecords | null
}

/** 장면을 세울 때 — 이미 들고 있던 판(옛 판)은 이 장면의 판이 아니다(그대로 둔다) */
function freshMemoryOf(events: WalkerLineSeatsEvents): WalkerLineSeatsMemory {
  return {
    sceneKey: events.sceneKey,
    seats: NEW_WALKER_LINE_SEATS,
    playKey: events.playKey,
    boardKey: null,
    boardBefore: NEW_WALKER_LINE_SEATS,
    benchKey: null,
    benchDefense: NEW_WALKER_LINE_SEATS.defense,
    previousPlayDefense: events.playDefenseRecords,
  }
}

/** 수비 판 시작 0xb0fb4 — 판의 정체가 바뀌면 한 번. 판 시작 때 수비 줄은 판을 낸 걸음 앞 그림의 레코드다 */
function afterDefensePlay(memory: WalkerLineSeatsMemory, events: WalkerLineSeatsEvents): WalkerLineSeatsMemory {
  if (events.playKey === memory.playKey) return memory
  const defense = memory.previousPlayDefense ?? events.playDefenseRecords
  const isPlayStarted = events.playKey != null && defense !== null
  return { ...memory, playKey: events.playKey, seats: isPlayStarted ? seatsAfterDefensePlay(memory.seats, defense) : memory.seats }
}

/** 교대 판 0x3fac4 — 판 그림이 못 찾은 칸에 남는 값(`boardBefore`)을 잡아 두고 두 줄을 고친다 */
function afterHalfInningBoard(memory: WalkerLineSeatsMemory, board: WalkerLineSeatsEvents['board']): WalkerLineSeatsMemory {
  if (board === null || board.key === memory.boardKey) return memory
  return { ...memory, boardKey: board.key, boardBefore: memory.seats, seats: seatsAfterHalfInningBoard(memory.seats, board.defense, board.offense) }
}

/** 벤치 클리어링 진입 0x3a5f0 */
function afterBenchClearing(memory: WalkerLineSeatsMemory, bench: WalkerLineSeatsEvents['benchClearing']): WalkerLineSeatsMemory {
  if (bench === null || bench.key === memory.benchKey) return memory
  return { ...memory, benchKey: bench.key, benchDefense: memory.seats.defense, seats: seatsAfterBenchClearing(memory.seats, bench.offense) }
}

/** 한 그림 — 수비 판 → 교대 판 → 벤치 클리어링 차례 */
function advanceWalkerLineSeats(previous: WalkerLineSeatsMemory | null, events: WalkerLineSeatsEvents): WalkerLineSeatsMemory {
  const start = previous === null || previous.sceneKey !== events.sceneKey ? freshMemoryOf(events) : previous
  const played = afterDefensePlay(start, events)
  const remembered = played.previousPlayDefense === events.playDefenseRecords ? played : { ...played, previousPlayDefense: events.playDefenseRecords }
  return afterBenchClearing(afterHalfInningBoard(remembered, events.board), events.benchClearing)
}

/**
 * **경기 장면 두 줄의 +0xec 를 장면이 사는 동안 따라간다** (`WalkerLineSeats` — 적는 곳은 교대 판 0x3fac4 · 수비 판 시작 0xb0fb4 ·
 * 벤치 클리어링 0x3a5f0 셋뿐). 한 그림 안 차례는 수비 판 → 교대 판 → 벤치 클리어링으로 본다.
 * 돌려주는 값: 지금 판이 서기 **전** 두 줄(`boardBefore` — 판 그림이 못 찾은 칸에 남는 값)과 벤치 클리어링 때 수비 줄(`benchDefense`).
 */
export function useWalkerLineSeats(events: WalkerLineSeatsEvents): {
  readonly boardBefore: WalkerLineSeats
  readonly benchDefense: WalkerLineSeats['defense']
} {
  const memory = useRenderMachine(advanceWalkerLineSeats, events)
  return { boardBefore: memory.boardBefore, benchDefense: memory.benchDefense }
}

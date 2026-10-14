import { useRef } from 'react'
import {
  type BenchClearingOffenseAces,
  seatsAfterBenchClearing,
} from '@/widgets/field-walk/lib/benchClearingFieldInput'
import {
  NEW_WALKER_LINE_SEATS,
  type WalkerLineSeats,
  seatsAfterDefensePlay,
  seatsAfterHalfInningBoard,
} from '@/widgets/field-walk/lib/walkerAces'

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

/**
 * **경기 장면 두 줄의 +0xec 를 장면이 사는 동안 따라간다** (`WalkerLineSeats` — 적는 곳은 교대 판 0x3fac4 · 수비 판 시작 0xb0fb4 ·
 * 벤치 클리어링 0x3a5f0 셋뿐). 한 그림 안 차례는 수비 판 → 교대 판 → 벤치 클리어링으로 본다.
 * 돌려주는 값: 지금 판이 서기 **전** 두 줄(`boardBefore` — 판 그림이 못 찾은 칸에 남는 값)과 벤치 클리어링 때 수비 줄(`benchDefense`).
 */
export function useWalkerLineSeats(events: WalkerLineSeatsEvents): {
  readonly boardBefore: WalkerLineSeats
  readonly benchDefense: WalkerLineSeats['defense']
} {
  const ref = useRef<{
    sceneKey: unknown
    seats: WalkerLineSeats
    playKey: unknown
    boardKey: unknown
    boardBefore: WalkerLineSeats
    benchKey: unknown
    benchDefense: WalkerLineSeats['defense']
    previousPlayDefense: SeatRecords | null
  } | null>(null)
  if (ref.current === null || ref.current.sceneKey !== events.sceneKey) {
    ref.current = {
      sceneKey: events.sceneKey,
      seats: NEW_WALKER_LINE_SEATS,
      playKey: events.playKey,
      boardKey: null,
      boardBefore: NEW_WALKER_LINE_SEATS,
      benchKey: null,
      benchDefense: NEW_WALKER_LINE_SEATS.defense,
      previousPlayDefense: events.playDefenseRecords,
    }
    // 장면을 세울 때 이미 들고 있던 판(옛 판)은 이 장면의 판이 아니다 — 그대로 둔다
  }
  const state = ref.current
  if (events.playKey !== state.playKey) {
    state.playKey = events.playKey
    const defense = state.previousPlayDefense ?? events.playDefenseRecords
    if (events.playKey != null && defense !== null) state.seats = seatsAfterDefensePlay(state.seats, defense)
  }
  state.previousPlayDefense = events.playDefenseRecords
  if (events.board !== null && events.board.key !== state.boardKey) {
    state.boardKey = events.board.key
    state.boardBefore = state.seats
    state.seats = seatsAfterHalfInningBoard(state.seats, events.board.defense, events.board.offense)
  }
  if (events.benchClearing !== null && events.benchClearing.key !== state.benchKey) {
    state.benchKey = events.benchClearing.key
    state.benchDefense = state.seats.defense
    state.seats = seatsAfterBenchClearing(state.seats, events.benchClearing.offense)
  }
  return { boardBefore: state.boardBefore, benchDefense: state.benchDefense }
}

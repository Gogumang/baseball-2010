import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import { type BatterGameRecord, EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { type BatterGameLog, EMPTY_BATTER_GAME_LOG } from '@/entities/game/model/batterGameLog'

/** 대타 확정 뒤의 명단 · 기록 · 나가고 들어온 선수 */
export interface SubstitutedBatter {
  readonly entry: readonly TeamEntryBatter[]
  readonly records: readonly BatterGameRecord[]
  readonly hitBases: readonly (readonly number[])[] | undefined
  readonly logs: readonly BatterGameLog[] | undefined
  readonly outgoing: TeamEntryBatter
  readonly incoming: TeamEntryBatter
}

/**
 * **확정 `0xaebe4` 의 대타 가지 한 덩어리** — 사람 대타(`pinchHit`)와 CPU 대타(`0xac228`)가 같이 쓴다.
 * 타순별 경기 기록 24바이트도 원본처럼 선수를 따라 움직인다 (`aed02~aed16`).
 */
export function substituteBatter(
  entryBefore: readonly TeamEntryBatter[],
  recordsBefore: readonly BatterGameRecord[],
  slot: number,
  benchIndex: number,
  /** 우리 팀일 때만 넘긴다 — 사이클 판정은 사람 팀 타순만 본다 (`0xa7610` 의 `st[0x31+st[9]]`) */
  hitBasesBefore?: readonly (readonly number[])[],
  /** 우리 팀일 때만 넘긴다 — 기록달성이 보는 타석 결과 목록도 같은 24바이트 안이다 */
  logsBefore?: readonly BatterGameLog[],
): SubstitutedBatter | null {
  const outgoing = entryBefore[slot]
  const incoming = entryBefore[benchIndex]
  if (outgoing === undefined || incoming === undefined) return null
  // 1·2. 수비 자리는 자리에 남고 선수만 바뀐다
  const entry = [...entryBefore]
  entry[slot] = { ...incoming, position: outgoing.position }
  entry[benchIndex] = { ...outgoing, position: incoming.position }
  // 3. 빠진 선수를 명단에서 지운다
  entry.splice(benchIndex, 1)
  return {
    entry,
    records: swappedWithBench(recordsBefore, slot, benchIndex, EMPTY_BATTER_GAME_RECORD),
    // 루타 목록 · 타석 결과 목록도 같은 24바이트 안에 있으니 함께 움직인다 (aed02~aed16)
    hitBases: hitBasesBefore === undefined ? undefined : swappedWithBench(hitBasesBefore, slot, benchIndex, NO_HIT_BASES),
    logs: logsBefore === undefined ? undefined : swappedWithBench(logsBefore, slot, benchIndex, EMPTY_BATTER_GAME_LOG),
    outgoing,
    incoming,
  }
}

const NO_HIT_BASES: readonly number[] = []

/** 타순 칸과 벤치 칸의 값을 맞바꾸고 벤치 칸을 지운다 (aed02~aed16) — 빈 칸은 `empty` */
function swappedWithBench<T>(before: readonly T[], slot: number, benchIndex: number, empty: T): T[] {
  const next = [...before]
  next[slot] = before[benchIndex] ?? empty
  next[benchIndex] = before[slot] ?? empty
  next.splice(benchIndex, 1)
  return next
}

import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import { type BatterGameRecord, EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { type BatterGameLog, EMPTY_BATTER_GAME_LOG } from '@/entities/game/model/batterGameLog'

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
): {
  readonly entry: readonly TeamEntryBatter[]
  readonly records: readonly BatterGameRecord[]
  readonly hitBases: readonly (readonly number[])[] | undefined
  readonly logs: readonly BatterGameLog[] | undefined
  readonly outgoing: TeamEntryBatter
  readonly incoming: TeamEntryBatter
} | null {
  const outgoing = entryBefore[slot]
  const incoming = entryBefore[benchIndex]
  if (outgoing === undefined || incoming === undefined) return null

  const entry = [...entryBefore]
  // 1·2. 수비 자리는 자리에 남고 선수만 바뀐다
  entry[slot] = { ...incoming, position: outgoing.position }
  entry[benchIndex] = { ...outgoing, position: incoming.position }
  const records = [...recordsBefore]
  records[slot] = records[benchIndex] ?? EMPTY_BATTER_GAME_RECORD
  records[benchIndex] = recordsBefore[slot] ?? EMPTY_BATTER_GAME_RECORD
  // 루타 목록도 같은 24바이트 안에 있으니 함께 움직인다 (aed02~aed16)
  const hitBases = hitBasesBefore === undefined ? undefined : [...hitBasesBefore]
  if (hitBases !== undefined && hitBasesBefore !== undefined) {
    hitBases[slot] = hitBasesBefore[benchIndex] ?? []
    hitBases[benchIndex] = hitBasesBefore[slot] ?? []
  }
  const logs = logsBefore === undefined ? undefined : [...logsBefore]
  if (logs !== undefined && logsBefore !== undefined) {
    logs[slot] = logsBefore[benchIndex] ?? EMPTY_BATTER_GAME_LOG
    logs[benchIndex] = logsBefore[slot] ?? EMPTY_BATTER_GAME_LOG
  }
  // 3. 빠진 선수를 명단에서 지운다
  entry.splice(benchIndex, 1)
  records.splice(benchIndex, 1)
  hitBases?.splice(benchIndex, 1)
  logs?.splice(benchIndex, 1)

  return { entry, records, hitBases, logs, outgoing, incoming }
}

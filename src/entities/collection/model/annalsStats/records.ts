import { ACHIEVEMENT_MARK_KINDS, RECORD_COUNT_KINDS, U8 } from '@/entities/collection/model/annalsStats/layout'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats/types'

/**
 * `0x22e10(mgr)` — 이번 경기 기록달성 횟수 배열을 `0x22df0(mgr, 횟수, n)` 으로 n = 0..39 차례로 더한다.
 * 칸은 u8 이라 `(누계 + 횟수) & 0xff` 다(0x22e06 `adds` · `strb` — 256 번째에 0 으로 돌아간다, 원본 그대로).
 * `recordIds` 는 경기 중 난 기록 번호를 난 횟수만큼 담은 목록이다(웹 경기 요약). 0~39 밖 번호는 버린다(`cmp r2,#0x27`).
 * 더할 것이 없으면 같은 객체.
 */
export function addRecordCounts(stats: AnnalsStats, recordIds: readonly number[]): AnnalsStats {
  const perGame = Array.from({ length: RECORD_COUNT_KINDS }, () => 0)
  for (const id of recordIds) {
    if (Number.isInteger(id) && id >= 0 && id < RECORD_COUNT_KINDS) perGame[id] = (perGame[id] + 1) % U8
  }
  if (perGame.every((count) => count === 0)) return stats
  return { ...stats, recordCounts: stats.recordCounts.map((total, at) => (total + perGame[at]) % U8) }
}

/** `[+4 + n]` (0x7a0d4 `ldrb`) — 없는 칸은 0 */
export function recordCountOf(stats: AnnalsStats, recordId: number): number {
  return stats.recordCounts[recordId] ?? 0
}

/** `0x22dd4(mgr, k)` — `[+0x106 + k] = 1`. k 가 0~7 밖이면(부호 없는 `bhi`) 아무것도 안 한다. 이미 서 있으면 같은 객체 */
export function markAchievement(stats: AnnalsStats, kind: number): AnnalsStats {
  if (!Number.isInteger(kind) || kind < 0 || kind >= ACHIEVEMENT_MARK_KINDS) return stats
  if (stats.achievementMarks[kind] === 1) return stats
  return { ...stats, achievementMarks: stats.achievementMarks.map((mark, at) => (at === kind ? 1 : mark)) }
}

/** `0x22db4(mgr, k)` — k > 7 이면 0, 아니면 그 바이트 */
export function achievementMarkOf(stats: AnnalsStats, kind: number): number {
  if (kind < 0 || kind >= ACHIEVEMENT_MARK_KINDS) return 0
  return stats.achievementMarks[kind] ?? 0
}

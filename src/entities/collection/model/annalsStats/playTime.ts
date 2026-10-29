import {
  LEAGUE_FIRST_MODE_SLOTS,
  LEAGUE_FIRST_SLOTS,
  PLAY_TIME_MODE_SLOTS,
  PLAY_TIME_SLOTS,
  U16,
} from '@/entities/collection/model/annalsStats/layout'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats/types'

/** 셀 8 + i 의 값 (`+0xfc + 2i`) — 옛 저장은 0 */
export function leagueFirstCountOf(stats: AnnalsStats, slot: number): number {
  return stats.leagueFirstCounts?.[slot] ?? 0
}

/**
 * 하루 끝 `0xb818c` — 정규시즌을 닫으며 내 팀이 1위면(SR+0x7a · S+0x7a 를 올린 바로 뒤) 그 모드 칸 u16 을 +1 하고
 * 통계를 저장한다(0x1f1e1). 1위가 아니면 이 갈래를 안 탄다. 모드 2 · 3 · 4 밖은 무시
 */
export function countLeagueFirst(stats: AnnalsStats, mode: number): AnnalsStats {
  const slot = LEAGUE_FIRST_MODE_SLOTS[mode]
  if (slot === undefined) return stats
  const leagueFirstCounts = Array.from({ length: LEAGUE_FIRST_SLOTS }, (_unused, at) =>
    at === slot ? (leagueFirstCountOf(stats, at) + 1) % U16 : leagueFirstCountOf(stats, at),
  )
  return { ...stats, leagueFirstCounts }
}

/** 칸 i 의 플레이 시간 밀리초 (`+0x2c + 8i`) — 옛 저장은 0 */
export function playTimeOf(stats: AnnalsStats, slot: number): number {
  return stats.playTimes?.[slot] ?? 0
}

/** `0x22efc(mgr, 밀리초, 모드)` — 그 모드 칸에 더한다. 자르지 않는다 */
export function addPlayTime(stats: AnnalsStats, mode: number, elapsed: number): AnnalsStats {
  const slot = PLAY_TIME_MODE_SLOTS[mode]
  if (slot === undefined) return stats
  const playTimes = Array.from({ length: PLAY_TIME_SLOTS }, (_unused, at) => playTimeOf(stats, at) + (at === slot ? elapsed : 0))
  return { ...stats, playTimes }
}

/** 합계 `0x588d1` 의 재료 — 여덟 칸 합 */
export function totalPlayTimeOf(stats: AnnalsStats): number {
  return Array.from({ length: PLAY_TIME_SLOTS }, (_unused, at) => playTimeOf(stats, at)).reduce((sum, time) => sum + time, 0)
}

/** 1시간 밀리초 `0x36ee80` */
const HOUR_MS = 3_600_000
/** `0x4e8b0` 이 여는 히든 — 모드 3(투수편 칸 +0x3c) 31 · 모드 4(타자편 칸 +0x34) 47 */
const PLAY_TIME_HIDDEN_IDS: Readonly<Record<number, number>> = { 3: 31, 4: 47 }

/**
 * `0x4e8b0` 끝 — 모드 3 · 4 면 그 칸 밀리초 / 3600000 > 9(곧 10시간 이상)일 때 열 히든 id. 아니면 null.
 * 열기 `0x62368` 은 누계를 더할 때마다 다시 부른다(이미 열렸는지는 0x62368 이 본다).
 */
export function playTimeHiddenIdOf(stats: AnnalsStats, mode: number): number | null {
  const id = PLAY_TIME_HIDDEN_IDS[mode]
  if (id === undefined) return null
  const slot = PLAY_TIME_MODE_SLOTS[mode] as number
  return Math.trunc(playTimeOf(stats, slot) / HOUR_MS) > 9 ? id : null
}

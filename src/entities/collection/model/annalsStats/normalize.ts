import {
  ACHIEVEMENT_MARK_KINDS,
  EMPTY_ANNALS_STATS,
  GAME_POINT_EARNED_KINDS,
  GAME_POINT_USAGE_KINDS,
  ITEM_SLOTS_PER_MODE,
  LEAGUE_FIRST_SLOTS,
  PLAY_TIME_SLOTS,
  RECORD_COUNT_KINDS,
  U16,
  U8,
} from '@/entities/collection/model/annalsStats/layout'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats/types'

const isCountArray = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((item) => Number.isInteger(item) && item >= 0)
const isBits = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

/** 길이가 맞고 칸마다 0 이상 정수(상한을 주면 그 미만)인 배열이면 그대로, 아니면 빈 칸 */
function countsOr<F extends readonly number[] | undefined>(
  value: unknown,
  length: number,
  fallback: F,
  limit = Number.POSITIVE_INFINITY,
): readonly number[] | F {
  return isCountArray(value, length) && value.every((count) => count < limit) ? value : fallback
}

/** 플레이 시간 — 여덟 칸 모두 0 이상 유한수(밀리초는 정수가 아니어도 받는다) */
function playTimesOr(value: unknown, fallback: readonly number[] | undefined): readonly number[] | undefined {
  if (!Array.isArray(value) || value.length !== PLAY_TIME_SLOTS) return fallback
  return value.every((time) => Number.isFinite(time) && (time as number) >= 0) ? (value as number[]) : fallback
}

/** 저장에서 읽은 값 — 칸마다 따로 믿는다. 없거나 깨진 칸은 0 으로 */
export function normalizeAnnalsStats(raw: unknown): AnnalsStats {
  if (typeof raw !== 'object' || raw === null) return EMPTY_ANNALS_STATS
  const candidate = raw as Record<string, unknown>
  const empty = EMPTY_ANNALS_STATS
  return {
    recordCounts: countsOr(candidate.recordCounts, RECORD_COUNT_KINDS, empty.recordCounts, U8),
    itemPurchaseCounts: countsOr(candidate.itemPurchaseCounts, 3 * ITEM_SLOTS_PER_MODE, empty.itemPurchaseCounts),
    gamePointUsage: countsOr(candidate.gamePointUsage, GAME_POINT_USAGE_KINDS, empty.gamePointUsage),
    gamePointEarned: countsOr(candidate.gamePointEarned, GAME_POINT_EARNED_KINDS, empty.gamePointEarned),
    batterEquippedSkillBits: isBits(candidate.batterEquippedSkillBits) ? candidate.batterEquippedSkillBits : 0,
    pitcherEquippedSkillBits: isBits(candidate.pitcherEquippedSkillBits) ? candidate.pitcherEquippedSkillBits : 0,
    // 0xff 이하 = 정수라 0x100 미만과 같다
    achievementMarks: countsOr(candidate.achievementMarks, ACHIEVEMENT_MARK_KINDS, empty.achievementMarks, U8),
    playTimes: playTimesOr(candidate.playTimes, empty.playTimes),
    leagueFirstCounts: countsOr(candidate.leagueFirstCounts, LEAGUE_FIRST_SLOTS, empty.leagueFirstCounts, U16),
  }
}

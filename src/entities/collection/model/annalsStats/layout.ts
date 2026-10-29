import type { AnnalsStats, StatMode } from '@/entities/collection/model/annalsStats/types'

/** 나리 타자편 = 모드 4 · 나리 투수편 = 모드 3 */
export const BATTER_LEAGUE_MODE = 4
export const PITCHER_LEAGUE_MODE = 3

/** 0x22e35 의 모드 → 칸 (4 → 0 · 3 → 1 · 2 → 2) */
export const ITEM_MODE_SLOTS: Readonly<Record<StatMode, number>> = { 4: 0, 3: 1, 2: 2 }
/** 모드마다 10칸 (`cmp r2,#9`) */
export const ITEM_SLOTS_PER_MODE = 10
/** `+0x6c` u32 여덟 칸 (`cmp r1,#7`) */
export const GAME_POINT_USAGE_KINDS = 8
/** `0x22c29` 의 자름 상한 `0x5f5e0ff` */
export const GAME_POINT_USAGE_LIMIT = 99_999_999

/** `0x22c7d` 의 모드 → `+0x8c` 칸 (점프표 0xcda88) */
export const EARNED_MODE_SLOTS: Readonly<Record<number, number>> = { 1: 0, 4: 1, 3: 2, 2: 3, 8: 4, 9: 4, 5: 5, 6: 5, 7: 6 }
/** `+0x8c` u32 일곱 칸 (StrMAINMENU[168~174]) */
export const GAME_POINT_EARNED_KINDS = 7

/** `+0xfc` u16 다섯 칸 — 셀 8~12 */
export const LEAGUE_FIRST_SLOTS = 5
/** 하루 끝 0xb818c 의 모드 → 칸 (모드 4 · 3 · 2) */
export const LEAGUE_FIRST_MODE_SLOTS: Readonly<Record<number, number>> = { 4: 0, 3: 1, 2: 2 }
export const U16 = 0x10000

/** `+0x2c` u64 여덟 칸 — 합계 `0x588d1` 이 여덟 칸을 다 더한다(칸 7 은 쓰는 모드가 없다) */
export const PLAY_TIME_SLOTS = 8

/**
 * `0x22efc` 의 모드 → 칸 (점프표 0xcdaac, 갈래마다 맨 끝 바이트 `adds r4, #…` 로 확정):
 * 1 → 0(+0x2c) 일반 · 4 → 1(+0x34) 타자편 · 3 → 2(+0x3c) 투수편 · 2 → 3(+0x44) 시즌 · 8 · 9 → 4(+0x4c) 대전 ·
 * 5 · 6 → 5(+0x54) 미션 · 7 → 6(+0x5c) 홈런더비. 그 밖(1~9 밖)은 무시. 기록연감 셀 0~6 · [129]~[135] 차례와 같다.
 */
export const PLAY_TIME_MODE_SLOTS: Readonly<Record<number, number>> = { 1: 0, 4: 1, 3: 2, 2: 3, 8: 4, 9: 4, 5: 5, 6: 5, 7: 6 }

/** `+4` 마흔 칸 (`cmp r2,#0x27`) — 기록달성 40종 (StrGAME[8~47]) */
export const RECORD_COUNT_KINDS = 40
export const U8 = 0x100

/** `+0x106` 여덟 칸 (`cmp r1,#7`) */
export const ACHIEVEMENT_MARK_KINDS = 8

export const EMPTY_ANNALS_STATS: AnnalsStats = {
  recordCounts: Array.from({ length: RECORD_COUNT_KINDS }, () => 0),
  itemPurchaseCounts: Array.from({ length: 3 * ITEM_SLOTS_PER_MODE }, () => 0),
  gamePointUsage: Array.from({ length: GAME_POINT_USAGE_KINDS }, () => 0),
  gamePointEarned: Array.from({ length: GAME_POINT_EARNED_KINDS }, () => 0),
  batterEquippedSkillBits: 0,
  pitcherEquippedSkillBits: 0,
  achievementMarks: Array.from({ length: ACHIEVEMENT_MARK_KINDS }, () => 0),
  playTimes: Array.from({ length: PLAY_TIME_SLOTS }, () => 0),
  leagueFirstCounts: Array.from({ length: LEAGUE_FIRST_SLOTS }, () => 0),
}

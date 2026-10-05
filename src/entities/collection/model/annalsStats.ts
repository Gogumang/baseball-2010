/**
 * 기록연감 **통계 기록** — 원본 `[mgr+0xc8]` 가 가리키는 전역 통계 레코드 중 웹이 지금 채우는 칸.
 *
 * `[mgr+0xc8]` 는 G 지갑(`0x1f1d9` = `[mgr+0xac]`)과 **다른** 레코드다. 쓰는 함수·읽는 곳(전수, 디스어셈 확정):
 *
 * | 칸 | 꼴 | 쓰는 곳 | 읽는 곳 |
 * |---|---|---|---|
 * | `+0x6c + 4k` (k 0~7) | u32 | `0x22c29(mgr, k, 액수)` — 더하고 0~99999999 로 자름 | `0x2322d(mgr, k)` → 기록연감 통계 셀 56~63, 합계 `0x58801(…, 5)` |
 * | `+0x8c + 4j` (j 0~6) | u32 | `0x22c7d(mgr, 액수, 모드)` — 점프표 `0xcda88` 로 모드 → 칸 j, 더하고 0~99999999 로 자름 | `0x2325d(mgr, j)` → 셀 48~54 |
 * | `+0xa8 + 2(10m + i)` (m 0~2, i 0~9) | u16 | `0x22e35(mgr, 모드, i)` — 1 더함(16비트 넘침은 0 으로) | `0x22eb5(mgr, 모드, i)` → 셀 16~46 |
 * | `+0xf4` / `+0xf8` | u32 비트 | 스킬 켜기 `0xb663c` — 모드 4 → +0xf4, 모드 3 → +0xf8 에 `1 << 스킬` OR. `0xb663c` 는 장착 `0xa4b04` 만 부르고, 그건 스킬 창(0x147b0)과 **획득 0xa4bd8**(0x10fb4 · 이벤트 0x8c460, 얻자마자 켠다)이 부른다 | 전부 수집 보상 k=5 "스킬 모두 수집"(`0x28f8a`) 하나뿐 |
 *
 * 모드 → 칸 m: `0x22e35`/`0x22eb5` 둘 다 **4(나리 타자편) → 0 · 3(나리 투수편) → 1 · 2(시즌) → 2**, 그 밖은 무시(0x22e40~0x22e4e).
 * 사용처 k (`0x22c29` 호출지 전수 → 이름 StrMAINMENU[175 + k]):
 *   0 마선수(오픈 0xa41a·0x2a20c·0x2b1ca, 레벨업 0x5fc1a) · 1/2 나리 타자편/투수편(모드 4 면 1 아니면 2 — GP 아이템 0x1501e,
 *   슬롯 확장 0x148d8, 명예의 전당 0x62e22, 이어하기 0x1bdc6, 훈련 비용 0xa3cac·0xa3d76) · 3 시즌(GP 아이템 0x7cd8·0x8058 ·
 *   트레이드 0xd152 · 지옥훈련 0xa2fee · 자동진행 0x3c862→0x3c8d4) · 4 대전(자동진행 모드 8·9, 0x3c8d4) · 6 선물 보낸(0x2aae4).
 *   5(유료 충전)·7(선물 받은)은 부르는 곳이 없다.
 *   ⚠️ 0xa3cac·0xa3d76 은 엔딩이 아니라 **훈련 적용 0xa3bac**(0x17f5c 가 부른다) 안이다 — 종류 4(타자 필살타법·투수 마구,
 *   비용 0xd80e1 × 100) 가 0xa3cac, 종류 5(투수 구질 훈련, 비용 0xd80d8 [300, 600, 1000]) 가 0xa3d76. 둘 다 `|비용|` 을 적는다.
 *
 * 획득 GP `0x22c7d(mgr, 액수, 모드)` 의 모드 → 칸 (점프표 0xcda88, 0x22c92~0x22d66 디스어셈 확정):
 *   1 → 0 일반 · 4 → 1 타자편 · 3 → 2 투수편 · 2 → 3 시즌 · 8·9 → 4 대전 · 5·6 → 5 미션 · 7 → 6 홈런더비, 그 밖은 무시.
 *   호출지: 경기 끝 0x4ec82(기록 달성 G 합 [ctx+0x17f4], 모드 = 장면 모드 [ctx+0x1104] — 미션 5·6 은 이 갈래를 안 탄다) ·
 *   홈런더비 0x4f708(모드 7) · 나리 엔딩 보너스 0x1bc4a · 나리 국가대항전 우승 0x1bb14(1000, 모드 4/3) ·
 *   이벤트 G 보상 0x8c6e2(값, 전역 모드) · 시즌 국가대항전 우승 0x8afa(1000, 2) · 시즌 엔딩 0x8c76(2) ·
 *   전부 수집 보상 0x293e6 · 0x4ee90·0x4eeba(경기 끝 다른 갈래, 뜻 미해결).
 */

/** 원본 모드 번호 — 0x1552d10 */
export type StatMode = 2 | 3 | 4
/** 나리 타자편 = 모드 4 · 나리 투수편 = 모드 3 */
export const BATTER_LEAGUE_MODE = 4
export const PITCHER_LEAGUE_MODE = 3

/** 0x22e35 의 모드 → 칸 (4 → 0 · 3 → 1 · 2 → 2) */
const ITEM_MODE_SLOTS: Readonly<Record<StatMode, number>> = { 4: 0, 3: 1, 2: 2 }
/** 모드마다 10칸 (`cmp r2,#9`) */
export const ITEM_SLOTS_PER_MODE = 10
/** `+0x6c` u32 여덟 칸 (`cmp r1,#7`) */
export const GAME_POINT_USAGE_KINDS = 8
/** `0x22c29` 의 자름 상한 `0x5f5e0ff` */
export const GAME_POINT_USAGE_LIMIT = 99_999_999
const U16 = 0x10000

/** `0x22c29` 의 사용처 번호 — StrMAINMENU[175 + k] 순서 */
export const GAME_POINT_USAGE = {
  ace: 0,
  batterLeague: 1,
  pitcherLeague: 2,
  season: 3,
  versus: 4,
  paidCharge: 5,
  giftSent: 6,
  giftReceived: 7,
} as const

/** 나리 편 사용처 — 호출지가 모두 `모드 == 4 ? 1 : 2` 로 고른다 (0x148c6 · 0x1500c · 0x62e16 …) */
export const leagueUsageOf = (mode: number): number =>
  mode === BATTER_LEAGUE_MODE ? GAME_POINT_USAGE.batterLeague : GAME_POINT_USAGE.pitcherLeague

/** `0x22c7d` 의 모드 → `+0x8c` 칸 (점프표 0xcda88) */
const EARNED_MODE_SLOTS: Readonly<Record<number, number>> = { 1: 0, 4: 1, 3: 2, 2: 3, 8: 4, 9: 4, 5: 5, 6: 5, 7: 6 }
/** `+0x8c` u32 일곱 칸 (StrMAINMENU[168~174]) */
export const GAME_POINT_EARNED_KINDS = 7

export interface AnnalsStats {
  /** `+0xa8` u16 [3][10] — 칸 m·10 + i */
  readonly itemPurchaseCounts: readonly number[]
  /** `+0x6c` u32 [8] */
  readonly gamePointUsage: readonly number[]
  /** `+0x8c` u32 [7] — 모드별 획득 GP (0x22c7d) */
  readonly gamePointEarned: readonly number[]
  /** `+0xf4` (타자편) · `+0xf8` (투수편) — 한 번이라도 켠 스킬 비트 */
  readonly batterEquippedSkillBits: number
  readonly pitcherEquippedSkillBits: number
}

export const EMPTY_ANNALS_STATS: AnnalsStats = {
  itemPurchaseCounts: Array.from({ length: 3 * ITEM_SLOTS_PER_MODE }, () => 0),
  gamePointUsage: Array.from({ length: GAME_POINT_USAGE_KINDS }, () => 0),
  gamePointEarned: Array.from({ length: GAME_POINT_EARNED_KINDS }, () => 0),
  batterEquippedSkillBits: 0,
  pitcherEquippedSkillBits: 0,
}

const isMode = (mode: number): mode is StatMode => mode === 2 || mode === 3 || mode === 4

/**
 * `0x22e35(mgr, 모드, i)` — GP 아이템 구매 수. `i > 9` 이거나 모드가 2·3·4 가 아니면 아무것도 안 한다.
 * 저장은 u16 두 바이트에 `(값 << 16) + 0x10000 >> 16` 이라 65535 다음은 0 이다 (0x22e62~0x22e78).
 */
export function countItemPurchase(stats: AnnalsStats, mode: number, index: number): AnnalsStats {
  if (index > 9 || !isMode(mode)) return stats
  const slot = ITEM_MODE_SLOTS[mode] * ITEM_SLOTS_PER_MODE + index
  if (slot < 0) return stats
  const itemPurchaseCounts = stats.itemPurchaseCounts.map((count, at) => (at === slot ? (count + 1) % U16 : count))
  return { ...stats, itemPurchaseCounts }
}

/** `0x22eb5(mgr, 모드, i)` — 없는 칸은 0 */
export function itemPurchaseCountOf(stats: AnnalsStats, mode: number, index: number): number {
  if (index > 9 || index < 0 || !isMode(mode)) return 0
  return stats.itemPurchaseCounts[ITEM_MODE_SLOTS[mode] * ITEM_SLOTS_PER_MODE + index] ?? 0
}

/** `0x22c29(mgr, k, 액수)` — `k > 7` 은 무시, 더한 값을 0~99999999 로 자른다 (0x22c52~0x22c62) */
export function addGamePointUsage(stats: AnnalsStats, kind: number, amount: number): AnnalsStats {
  if (kind > 7 || kind < 0) return stats
  const gamePointUsage = stats.gamePointUsage.map((total, at) =>
    at === kind ? Math.min(GAME_POINT_USAGE_LIMIT, Math.max(0, total + Math.trunc(amount))) : total)
  return { ...stats, gamePointUsage }
}

/** `0x2322d(mgr, k)` — `k > 7` 이면 원본은 −1 을 돌려준다 (0x23232) */
export function gamePointUsageOf(stats: AnnalsStats, kind: number): number {
  if (kind > 7) return -1
  return stats.gamePointUsage[kind] ?? 0
}

/**
 * `0x22c7d(mgr, 액수, 모드)` — 모드별 획득 GP. 모드가 1~9 가 아니면 아무것도 안 한다(0x22c82 `cmp #8; bls`).
 * 더한 값을 0~99999999 로 자른다 (0x22d84~0x22d94) — 음수 액수(이벤트 G 감소)면 줄어든다.
 */
export function addGamePointEarned(stats: AnnalsStats, amount: number, mode: number): AnnalsStats {
  const slot = EARNED_MODE_SLOTS[mode]
  if (slot === undefined) return stats
  const gamePointEarned = stats.gamePointEarned.map((total, at) =>
    at === slot ? Math.min(GAME_POINT_USAGE_LIMIT, Math.max(0, total + Math.trunc(amount))) : total)
  return { ...stats, gamePointEarned }
}

/** `0x2325d(mgr, j)` — 칸 j 의 획득 GP. 없는 칸은 0 */
export function gamePointEarnedOf(stats: AnnalsStats, slot: number): number {
  return stats.gamePointEarned[slot] ?? 0
}

/**
 * 스킬 켜기 `0xb663c` 의 저장 쪽 — 모드 4 면 `+0xf4`, 3 이면 `+0xf8` 에 `1 << 스킬` 을 OR 한다 (그 밖 모드는 안 쓴다).
 * 원본은 **이미 켜져 있으면 들어오지 않으니** 부르는 쪽이 새로 켤 때만 부른다.
 */
export function markSkillEquipped(stats: AnnalsStats, mode: number, skillId: number): AnnalsStats {
  if (skillId < 0 || skillId > 31) return stats
  const bit = (1 << skillId) >>> 0
  if (mode === 4) return { ...stats, batterEquippedSkillBits: (stats.batterEquippedSkillBits | bit) >>> 0 }
  if (mode === 3) return { ...stats, pitcherEquippedSkillBits: (stats.pitcherEquippedSkillBits | bit) >>> 0 }
  return stats
}

/** 기록연감에 쌓는 통계 한 건 — 세션이 원본 호출 자리에서 낸다 */
export type AnnalsStatEvent =
  /** `0x22e35` + `0x22c29` — 나리 상점 GP 아이템 구매 확정 (0x14ffe · 0x1501e) */
  | { readonly kind: 'GP아이템구매'; readonly mode: number; readonly index: number; readonly price: number }
  /** `0x22c29` 단독 */
  | { readonly kind: 'G사용'; readonly usage: number; readonly amount: number }
  /** `0xb663c` 가 새로 켤 때 */
  | { readonly kind: '스킬장착'; readonly mode: number; readonly skillId: number }
  /** `0x22c7d` — G 를 얻은 자리 */
  | { readonly kind: 'G획득'; readonly mode: number; readonly amount: number }

/**
 * 장착 목록이 바뀐 사이에 **새로 켜진** 스킬마다 `스킬장착` 한 건 — `0xb663c` 는 이미 켜진 스킬엔 들어오지 않으니
 * 앞뒤 장착 목록을 견줘 새로 생긴 번호만 낸다. 켜는 길(창 0x147b0 · 획득 0xa4bd8)이 어디든 같은 칸이다.
 */
export function skillEquipStatEventsOf(
  mode: number,
  before: readonly number[],
  after: readonly number[],
): AnnalsStatEvent[] {
  return after
    .filter((skillId, index) => !before.includes(skillId) && after.indexOf(skillId) === index)
    .map((skillId) => ({ kind: '스킬장착', mode, skillId }))
}

export function applyAnnalsStat(stats: AnnalsStats, event: AnnalsStatEvent): AnnalsStats {
  if (event.kind === 'GP아이템구매') {
    // 0x14ffe 0x22e35(모드, 칸) → 0x1501e 0x22c29(모드 4 ? 1 : 2, 값) 순서
    return addGamePointUsage(countItemPurchase(stats, event.mode, event.index), leagueUsageOf(event.mode), event.price)
  }
  if (event.kind === 'G사용') return addGamePointUsage(stats, event.usage, event.amount)
  if (event.kind === 'G획득') return addGamePointEarned(stats, event.amount, event.mode)
  return markSkillEquipped(stats, event.mode, event.skillId)
}

const isCountArray = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((item) => Number.isInteger(item) && item >= 0)
const isBits = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

/** 저장에서 읽은 값 — 칸마다 따로 믿는다. 없거나 깨진 칸은 0 으로 */
export function normalizeAnnalsStats(raw: unknown): AnnalsStats {
  if (typeof raw !== 'object' || raw === null) return EMPTY_ANNALS_STATS
  const candidate = raw as Record<string, unknown>
  return {
    itemPurchaseCounts: isCountArray(candidate.itemPurchaseCounts, 3 * ITEM_SLOTS_PER_MODE)
      ? candidate.itemPurchaseCounts
      : EMPTY_ANNALS_STATS.itemPurchaseCounts,
    gamePointUsage: isCountArray(candidate.gamePointUsage, GAME_POINT_USAGE_KINDS)
      ? candidate.gamePointUsage
      : EMPTY_ANNALS_STATS.gamePointUsage,
    gamePointEarned: isCountArray(candidate.gamePointEarned, GAME_POINT_EARNED_KINDS)
      ? candidate.gamePointEarned
      : EMPTY_ANNALS_STATS.gamePointEarned,
    batterEquippedSkillBits: isBits(candidate.batterEquippedSkillBits) ? candidate.batterEquippedSkillBits : 0,
    pitcherEquippedSkillBits: isBits(candidate.pitcherEquippedSkillBits) ? candidate.pitcherEquippedSkillBits : 0,
  }
}

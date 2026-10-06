/**
 * 기록연감 **통계 기록** — 원본 `[mgr+0xc8]` 가 가리키는 전역 통계 레코드 중 웹이 지금 채우는 칸.
 *
 * `[mgr+0xc8]` 는 G 지갑(`0x1f1d9` = `[mgr+0xac]`)과 **다른** 레코드다. 쓰는 함수·읽는 곳(전수, 디스어셈 확정):
 *
 * | 칸 | 꼴 | 쓰는 곳 | 읽는 곳 |
 * |---|---|---|---|
 * | `+4 + n` (n 0~39) | u8 | `0x22df0(mgr, 더할 값 u8, n)` — n ≤ 0x27 이면 `strb` 로 더한다(**256 이면 0 으로 넘친다**, 원본 그대로). 부르는 곳은 `0x22e10(mgr)` 하나 — 이번 경기 기록달성 횟수 배열 `0x1fce0(mgr)`(모드별 저장 칸) 40칸을 그대로 더한다 | 기록연감 탭 0 셀 0~39 `"!R!cffff00%d"`(0x7a0d0~0x7a0fc) · 전부 수집 k=4 "기록달성 모두 성공"(0x28f3a~0x28f56, 40칸 모두 ≠ 0) |
 * | `+0x6c + 4k` (k 0~7) | u32 | `0x22c29(mgr, k, 액수)` — 더하고 0~99999999 로 자름 | `0x2322d(mgr, k)` → 기록연감 통계 셀 56~63, 합계 `0x58801(…, 5)` |
 * | `+0x8c + 4j` (j 0~6) | u32 | `0x22c7d(mgr, 액수, 모드)` — 점프표 `0xcda88` 로 모드 → 칸 j, 더하고 0~99999999 로 자름 | `0x2325d(mgr, j)` → 셀 48~54 |
 * | `+0xa8 + 2(10m + i)` (m 0~2, i 0~9) | u16 | `0x22e35(mgr, 모드, i)` — 1 더함(16비트 넘침은 0 으로) | `0x22eb5(mgr, 모드, i)` → 셀 16~46 |
 * | `+0xf4` / `+0xf8` | u32 비트 | 스킬 켜기 `0xb663c` — 모드 4 → +0xf4, 모드 3 → +0xf8 에 `1 << 스킬` OR. `0xb663c` 는 장착 `0xa4b04` 만 부르고, 그건 스킬 창(0x147b0)과 **획득 0xa4bd8**(0x10fb4 · 이벤트 0x8c460, 얻자마자 켠다)이 부른다 | 전부 수집 보상 k=5 "스킬 모두 수집"(`0x28f8a`) 하나뿐 |
 *
 * | `+0x106 + k` (k 0~7) | u8 | `0x22dd4(mgr, k)` — k ≤ 7 이면 1 (0x22dd6 `cmp r1,#7; bhi`) | `0x22db4(mgr, k)` (k > 7 이면 0) → 기록연감 탭 0 셀 40~47 의 달성 표시 |
 *
 * `0x22e10` 을 부르는 곳(전수): 경기 끝 `0x4ea0c` 의 0x4ec8a — 기록 달성 G 합을 G 에 더하고 `0x22c7d`(0x4ec82) 바로 뒤,
 * 이어서 `0x1fd45`(그 배열 비우기) · 통계 저장 `0x1f1e1`. 이 갈래는 미션 5·6 이 안 탄다. 경기 쪽 배열 `0x1fce0(mgr)` 은
 * **`[mgr+0x40]`**(장면 모드가 아니라 저장 관리자의 버퍼 모드)로 점프표 0xcd804 를 탄다(0x1fce4 `subs #1; cmp #8; bhi 0x1fd34`):
 * 1 `[+0xb0]`+0x600 · 2 `[+0xb4]`+0x8f0 · 3 `[+0xb8]`+0xb9c · 4 `[+0xbc]`+0xb9c · 8 `[+0xc0]`+0x600 · 9 `[+0xc4]`+0x600,
 * 5·6·7 과 버퍼가 없을 때는 0. 경기 중 `0xa77f0` 이 기록을 더할 때 같이 센다 — 웹 요약의 `recordIds`(같은 기록이 난 횟수만큼
 * 들어 있다)가 그 배열이다.
 *
 * 홈런더비 결과 `0x4f574` 의 0x4f710 도 `0x22e10` 을 부른다. *(정정 — 예전 "모드 7 이라 널, 주소 0..39 를 더한다" 는 틀렸다)*
 *   - `[mgr+0x40]` 을 쓰는 곳은 `0x213c0(mgr, 모드, 유지)` 하나(0x213ec, 6 → 4 · 5 → 3 으로 바꿔 적는다)이고, 메뉴의 모드 시작
 *     `0x327b8` 의 모드 7 갈래(0x328c8)는 **`0x213c0(mgr, 4, 0)`** 을 부른다 — 장면·전역 모드(+0x3c · 메뉴+0x13c)만 7 이고
 *     `[mgr+0x40]` = 4(나리 타자편). 그래서 0x1fce0 은 널이 아니라 **나리 타자편 버퍼 `[mgr+0xbc]`+0xb9c** 를 돌려준다.
 *     (0x213c0 을 7 로 부르는 곳은 미션 선택 장면 0x1d784 · 메인 메뉴 0x3b14 뿐이라 더비 경기 사이에는 안 지난다.)
 *   - 0x213c0 의 모드 4 갈래(0x218ee)는 버퍼 0xbfc 를 새로 잡아 0 으로 채우고 `0x20ac4` 로 **game_br.sav** 를 읽는다 —
 *     +0xb9c 40바이트도 파일에서 그대로(0x20bc0~0x20bce). 파일이 없으면 0 마흔.
 *   - 더비 중에는 기록이 안 쌓인다: `0xa77f0` 의 a780a 가 state[1](= 장면 +0x1104 = 7, 0x3f5a8) ∈ {5,6,7} 이면 돌아간다.
 *   - 그 파일 칸은 늘 0 으로 저장된다: 나리 경기 끝은 0x4ec92 `0x1fd45` 로 비운 **뒤** 0x4f320·0x4f3c0 에서 저장하고, 새 커리어
 *     0x13cd8 도 비운 뒤 저장, 경기 시작 저장(0x39fdc)은 기록이 나기 전이며 나리 경기에는 중간 저장이 없다(0x4f928 은 모드 1·2·8·9).
 *   → 원본 더비의 0x4f710 은 **0 마흔을 더한다 = 아무것도 안 바뀐다**. 웹이 홈런더비에서 아무것도 안 더하는 것이 원본과 같다.
 *   (0x4f718 `0x1fd45` 가 메모리 칸만 비우고 파일은 안 쓰는 것도 결과에 영향 없음.)
 *
 * `0x22dd4` 를 부르는 곳: 시즌 리그 1위 G 지급 0x6a9e·0x6aa6(결산 0x6900) · 0x88da·0x88e0(0x85ec) — k = 보상 비트 0·1·2,
 * 전역기록 +0x145 비트를 켜고 저장한 바로 뒤 — 와 전부 수집 보상 0x28e98(0x28f10 · 0x28f5e · 0x29066 · 0x2925c · 0x292c2, 웹 아직 없음).
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
  /** `+4 + n` u8 [40] — 기록달성 번호 n 의 누계 (0x22df0). 옛 저장에는 없어 0 으로 */
  readonly recordCounts: readonly number[]
  /** `+0xa8` u16 [3][10] — 칸 m·10 + i */
  readonly itemPurchaseCounts: readonly number[]
  /** `+0x6c` u32 [8] */
  readonly gamePointUsage: readonly number[]
  /** `+0x8c` u32 [7] — 모드별 획득 GP (0x22c7d) */
  readonly gamePointEarned: readonly number[]
  /** `+0xf4` (타자편) · `+0xf8` (투수편) — 한 번이라도 켠 스킬 비트 */
  readonly batterEquippedSkillBits: number
  readonly pitcherEquippedSkillBits: number
  /** `+0x106 + k` u8 [8] — 달성 표시 (0x22dd4). 옛 저장에는 없어 0 으로 */
  readonly achievementMarks: readonly number[]
}

/** `+4` 마흔 칸 (`cmp r2,#0x27`) — 기록달성 40종 (StrGAME[8~47]) */
export const RECORD_COUNT_KINDS = 40
const U8 = 0x100

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
  /** `0x22e10` — 경기 끝(0x4ec8a) 이번 경기 기록달성 횟수를 누계에 더한다. 번호를 난 횟수만큼 */
  | { readonly kind: '기록달성'; readonly recordIds: readonly number[] }
  /** `0x22dd4` — 달성 표시 k (리그 1위 1·5·10회 = 0·1·2, 전부 수집 = 3~7) */
  | { readonly kind: '달성표시'; readonly index: number }

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
  if (event.kind === '달성표시') return markAchievement(stats, event.index)
  if (event.kind === '기록달성') return addRecordCounts(stats, event.recordIds)
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
    recordCounts: isCountArray(candidate.recordCounts, RECORD_COUNT_KINDS)
      && candidate.recordCounts.every((count) => count < U8)
      ? candidate.recordCounts
      : EMPTY_ANNALS_STATS.recordCounts,
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
    achievementMarks: isCountArray(candidate.achievementMarks, ACHIEVEMENT_MARK_KINDS)
      && candidate.achievementMarks.every((mark) => mark <= 0xff)
      ? candidate.achievementMarks
      : EMPTY_ANNALS_STATS.achievementMarks,
  }
}

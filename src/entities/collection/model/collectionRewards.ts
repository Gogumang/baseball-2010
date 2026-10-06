/**
 * **전부 수집 보상 8칸의 지급 비트** — 전역기록 `+0x145` 한 바이트 (Q2 5-0 확정).
 *
 * 전역기록 = `0x1f1d9(mgr)` 가 주는 `[mgr+0xac]` 객체 — 저장 `0x1f1b9(mgr)` 가 크기 `[mgr+0xcc]`(0xe44)로
 * **`game_o.sav`**(문자열 0xcdb68)에 통째로 쓴다(0x1f1b8~0x1f1d0 직접 떴다). G(+0x64)·명예의 전당(+0x880·+0x940)과
 * 같은 레코드라 시즌을 새로 시작해도, 나리 편을 지워도 남는다.
 * ```
 * 9f708: ldr r3,=0x145 ; adds r0,r3 ; ldrb r2,[r0] ; movs r3,#1 ; lsls r3,r1 ; orrs r3,r2 ; strb r3,[r0]   ; 비트 k 켜기
 * 9f71c: (rec[0x145] >> k) & 1                                                                            ; 읽기
 * ```
 * k 0·1·2 = 시즌 리그 1위 1·5·10회 (결산 0x6900 · 0x87e8), k 3~7 = 메인 메뉴 전부 수집 보상(판정 0x28e98 · 팝업 0x292f8 — 아래).
 *
 * 웹은 지갑(`entities/wallet`)처럼 이 한 칸을 저장소 하나에 담는다. 이 칸이 생기기 전 웹은 세션 상태로만 들고 있어
 * 옛 저장에는 남은 값이 없다 — 없으면 0(새 저장 기본, 0x9f26c 초기화)에서 시작한다.
 */
import type { AnnalsStats } from '@/entities/collection/model/annalsStats'
import { RECORD_COUNT_KINDS, recordCountOf } from '@/entities/collection/model/annalsStats'
import { COMMON_TITLE_COUNT, PITCHER_TITLE_OFFSET, TITLE_COUNT, titleNumberOf } from '@/entities/career/model/titles'

export interface CollectionRewardRecord {
  /** 전역기록 +0x145 — 비트 k 가 서 있으면 k 번 보상을 이미 받았다 (u8) */
  readonly awardedBits: number
}

export const EMPTY_COLLECTION_REWARD_RECORD: CollectionRewardRecord = { awardedBits: 0 }

const BYTE_MASK = 0xff

/** 저장에서 읽은 값은 믿지 않는다 — 한 바이트 정수가 아니면 0 */
export function normalizeCollectionRewardRecord(raw: unknown): CollectionRewardRecord {
  const saved = (raw as Partial<CollectionRewardRecord> | null | undefined)?.awardedBits
  if (typeof saved !== 'number' || !Number.isInteger(saved)) return EMPTY_COLLECTION_REWARD_RECORD
  return { awardedBits: saved & BYTE_MASK }
}

/** 비트 k 켜기 `0x9f709(rec, k)` — 이미 서 있으면 같은 객체 */
export function withAwardedBit(record: CollectionRewardRecord, bit: number): CollectionRewardRecord {
  const awardedBits = (record.awardedBits | (1 << bit)) & BYTE_MASK
  return awardedBits === record.awardedBits ? record : { awardedBits }
}

/** 읽기 `0x9f71d(rec, k)` */
export function isRewardAwarded(record: CollectionRewardRecord, bit: number): boolean {
  return ((record.awardedBits >> bit) & 1) !== 0
}

/**
 * 저장 칸을 다시 읽어 비트를 합친다 — 이 바이트는 시즌 세션(k 0~2)과 메인 메뉴(k 3~7) 두 곳이 켠다.
 * 원본은 전역기록 한 벌이라 늘 최신이지만 웹은 두 쪽이 따로 들고 있어, 쓰기 전에 저장된 비트를 OR 해 남의 비트를 안 지운다.
 */
export function withStoredAwardedBits(record: CollectionRewardRecord, raw: unknown): CollectionRewardRecord {
  const stored = normalizeCollectionRewardRecord(raw).awardedBits
  const awardedBits = (record.awardedBits | stored) & BYTE_MASK
  return awardedBits === record.awardedBits ? record : { awardedBits }
}

/** 보상 액수표 s8 0xcebd4 = [3, 10, 20, 30, 40, 50, 60, 90] — × 1000 G (0x2934a `movs #0xfa; lsls #2`) */
const REWARD_THOUSANDS: readonly number[] = [3, 10, 20, 30, 40, 50, 60, 90]
const REWARD_UNIT = 1000
export const collectionRewardGamePointOf = (kind: number): number => (REWARD_THOUSANDS[kind] ?? 0) * REWARD_UNIT

/**
 * 팝업 제목 StrMAINMENU[180 + k] (k 3~7 → [183]~[187]) — `base/extracted/StrMAINMENU.json` 원문 그대로(끝 공백 포함).
 * k 0~2 의 [180]~[182] 는 통계 칸 이름("유료 충전 GP" …)이라 이 팝업에 오지 않는다 — 리그 1위는 StrMODE[223] 로 따로 준다.
 */
const REWARD_TITLES: Readonly<Record<number, string>> = {
  3: '미션모드 모두 성공', // [183]
  4: '기록달성 모두 성공 ', // [184]
  5: '스킬 모두 수집 ', // [185]
  6: '닉네임 모두 수집 ', // [186]
  7: '엔딩 모두 수집 ', // [187]
}
/** StrMAINMENU[188] 원문 그대로 */
const REWARD_BODY = '달성!N[!cFFFF00%d G포인트!cFFFFFF] 지급'

/**
 * 팝업 0x292f8(this, k) 의 글 — 제목 `StrMAINMENU[180 + k]` 를 문자열에 붙이고(0xbc965) 이어서
 * `sprintf([188], 0xcebd4[k] × 1000)` 를 **사이 없이** 붙인다(0x2932a~0x29366). 그래서 "미션모드 모두 성공달성!N…" 처럼
 * 제목과 "달성!" 이 붙어 나온다 — 원본 그대로다(끝 공백이 있는 제목은 한 칸 띄어진다).
 */
export function collectionRewardTextOf(kind: number): string {
  return `${REWARD_TITLES[kind] ?? ''}${REWARD_BODY.replace('%d', String(collectionRewardGamePointOf(kind)))}`
}

/**
 * 팝업이 G 를 준 뒤 `0x22c7d(mgr, 보상, 모드)` 로 획득 GP 통계에 적는 모드 (0x293c0~0x293e4, 직접 떴다):
 * k ≤ 2 → 2(시즌) · k 3·4·7 → 6(미션 칸) · 그 밖(5·6) → 3(나리 투수편 칸). 보상 종류와 칸이 맞지 않지만 원본 그대로다.
 */
export function collectionRewardStatModeOf(kind: number): number {
  if (kind >= 0 && kind <= 2) return 2
  return kind === 3 || kind === 4 || kind === 7 ? 6 : 3
}

/** 판정에 드는 것 — 원본이 읽는 칸과 웹의 짝 */
export interface CollectionRewardJudgeInput {
  /** 전역기록 +0x145 지급 비트 */
  readonly record: CollectionRewardRecord
  /** k 3 — 모드 5·6 저장을 올려(0x213c0) 두 편 미션 객체의 올클리어 0xa5184 가 둘 다 참 (투수 14 + 타자 14 = 28 모두 1회 이상) */
  readonly isEveryMissionCleared: boolean
  /** k 4 `[mgr+0xc8] +4..+43` 기록달성 누계 · k 5 `+0xf4`(타자편) / `+0xf8`(투수편) 켠 스킬 비트 */
  readonly stats: AnnalsStats
  /**
   * k 6 — 기록연감 칭호 비트 타자편 u64 `+0xe4` · 투수편 `+0xec` (0x290c2~0x29246). 웹은 칭호를 이름으로 들고
   * 타자편 32~47 · 투수편 48~63 이 서로 다른 이름이라(`titles.ts`) 이름 목록 하나로 같은 판정이 된다.
   */
  readonly titles: readonly string[]
  /** k 7 — 전역기록 +0xa8..+0xb6 (나리 엔딩 15칸 = 웹 `Collection.endings` 0~14) */
  readonly endings: readonly number[]
  /** k 7 — 전역기록 +0xa0..+0xa4 (시즌 엔딩 5칸 = 웹 `Collection.seasonEndings` 0~4) */
  readonly seasonEndings: readonly number[]
}

/** 공통 스킬 비트 0~7 · 편별 8~23 (0x28f8a~0x2905e) */
const COMMON_SKILL_BITS = 8
const SIDE_SKILL_LAST_BIT = 0x17
const SIDE_SKILL_COUNT = 16
const NARI_ENDING_CELLS = 15
const SEASON_ENDING_CELLS = 5
const ALL_ENDINGS = 20

const bitOf = (bits: number, at: number) => ((bits >>> at) & 1) !== 0

/** k 5 "스킬 모두 수집" — 공통 8(어느 편이든) + 타자 16 + 투수 16 = 40 */
function isEverySkillEquipped(stats: AnnalsStats): boolean {
  let common = 0
  for (let at = 0; at < COMMON_SKILL_BITS; at += 1) {
    if (bitOf(stats.batterEquippedSkillBits, at) || bitOf(stats.pitcherEquippedSkillBits, at)) common += 1
  }
  let batter = 0
  let pitcher = 0
  for (let at = COMMON_SKILL_BITS; at <= SIDE_SKILL_LAST_BIT; at += 1) {
    if (bitOf(stats.batterEquippedSkillBits, at)) batter += 1
    if (bitOf(stats.pitcherEquippedSkillBits, at)) pitcher += 1
  }
  return common === COMMON_SKILL_BITS && batter === SIDE_SKILL_COUNT && pitcher === SIDE_SKILL_COUNT
}

/** k 6 "닉네임 모두 수집" — 공통 0~31 은 어느 편이든 한 칸 · 32~47 타자 16 · 48~63 투수 16 */
function isEveryTitleCollected(titles: readonly string[]): boolean {
  const owned = new Set(titles.map(titleNumberOf).filter((number) => number >= 0 && number < TITLE_COUNT))
  const countIn = (from: number, to: number) => [...owned].filter((number) => number >= from && number < to).length
  const sideCount = PITCHER_TITLE_OFFSET
  return countIn(0, COMMON_TITLE_COUNT) === COMMON_TITLE_COUNT
    && countIn(COMMON_TITLE_COUNT, COMMON_TITLE_COUNT + sideCount) === sideCount
    && countIn(COMMON_TITLE_COUNT + sideCount, TITLE_COUNT) === sideCount
}

/** k 7 "엔딩 모두 수집" — ≠ 0 인 칸이 20 (0x2928e~0x292ba) */
function isEveryEndingSeen(endings: readonly number[], seasonEndings: readonly number[]): boolean {
  const nari = new Set(endings.filter((index) => Number.isInteger(index) && index >= 0 && index < NARI_ENDING_CELLS))
  const season = new Set(seasonEndings.filter((index) => Number.isInteger(index) && index >= 0 && index < SEASON_ENDING_CELLS))
  return nari.size + season.size === ALL_ENDINGS
}

/**
 * **전부 수집 보상 판정 0x28e98** (메인 메뉴 장면 0x103 하위 4 갱신 0x29454 — 직접 떴다).
 * k = 3 → 7 차례로, 이미 받은 비트(0x9f71d)는 건너뛰고 **처음 맞는 k 하나**를 돌려준다. 없으면 −1.
 * 원본은 맞는 그 자리에서 `0x22dd5(mgr, k)`(달성 표시) · 통계 저장 0x1f1e1 까지 한다 — 부르는 쪽 몫이다.
 * ```
 * k 3: 0x213c1(mgr, 5|6, 1) · 0x1fa55 · 0xa5185(미션 객체) 둘 다 참          (0x28ea6~0x28f1e)
 * k 4: [mgr+0xc8] +4+n (n 0..0x27) 이 ≠ 0 인 칸이 0x28                       (0x28f3a~0x28f56)
 * k 5: +0xf4/+0xf8 비트 0..7 둘 중 하나 = 8 · 8..0x17 타자 16 · 투수 16          (0x28f8a~0x2905e)
 * k 6: +0xe4/+0xec 비트 0..0x1f 둘 중 하나 = 0x20 · 0x20..0x2f 타자 16 · 투수 16 (0x290c2~0x29254)
 * k 7: 전역기록 +0xa8..+0xb6 · +0xa0..+0xa4 중 ≠ 0 인 칸이 0x14               (0x2928e~0x292ba)
 * ```
 */
export function judgeCollectionReward(input: CollectionRewardJudgeInput): number {
  const isAwarded = (kind: number) => isRewardAwarded(input.record, kind)
  if (!isAwarded(3) && input.isEveryMissionCleared) return 3
  if (!isAwarded(4)) {
    const achieved = Array.from({ length: RECORD_COUNT_KINDS }, (_, n) => recordCountOf(input.stats, n)).filter((count) => count !== 0)
    if (achieved.length === RECORD_COUNT_KINDS) return 4
  }
  if (!isAwarded(5) && isEverySkillEquipped(input.stats)) return 5
  if (!isAwarded(6) && isEveryTitleCollected(input.titles)) return 6
  if (!isAwarded(7) && isEveryEndingSeen(input.endings, input.seasonEndings)) return 7
  return -1
}

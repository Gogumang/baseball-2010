import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { romanceEndingIndexOf } from '@/entities/career/model/seasonFlow'
import { EMPTY_ANNALS_STATS, normalizeAnnalsStats } from '@/entities/collection/model/annalsStats'
import type { AnnalsStats } from '@/entities/collection/model/annalsStats'

/**
 * 스페셜 메뉴의 기록연감·명예의 전당 (StrHOWTO[28]). 선수 한 명이 아니라 게임 전체에 쌓인다.
 *   기록연감: 닉네임·스킬·엔딩 열람 ("게임 플레이 시간 기록" 은 아직 없다)
 *   명예의 전당: 엔딩 후 등록 (K 4-2 · Q2 4절)
 *
 * 명예의 전당 칸 (전역기록) — 한 명 = 등록 순간의 0x30 바이트 선수 기록 통째 사본:
 *   투수 +0x880 + i·0x30 (i 0~3, 0x1f62c) · 열림 깃발 g+0x80+i
 *   타자 +0x940 + i·0x30 (i 0~7, 0x1f640) · 열림 깃발 g+0x88+i
 * 기본 개방 **투수 2 · 타자 4** 이고 나머지는 현금 슬롯 구매(StrCOMMON 44/45 · 53/54 🌐)로만 열린다 — 오프라인 웹은 늘 기본 개방이다.
 * 찬 칸 판정은 그 기록의 능력치 네 칸 중 하나라도 0 이 아닌가다 (0x1f6ac).
 */
export const HALL_OF_FAME_MAX_PITCHERS = 4
export const HALL_OF_FAME_MAX_BATTERS = 8
export const HALL_OF_FAME_OPEN_PITCHERS = 2
export const HALL_OF_FAME_OPEN_BATTERS = 4
/** 등록 비용 — 0x62e20 `ldr r2,=0x4e20` → G −= 20000, 0x22c29(모드 4 ? 1 : 2, 20000) */
export const HALL_OF_FAME_COST = 20000

/** 선수 생김새 — 레코드 +0xb (타입·손·피부) 와 팀. 명예의 전당 그림(캐릭터·팀 로고)이 쓸 칸이다 */
export interface HallOfFameLook {
  readonly typeIndex: number
  readonly handIndex: number
  readonly skinIndex: number
  readonly teamId: number
}

/** 명예의 전당 타자 (+0x940 칸) */
export interface HallOfFamer {
  readonly name: string
  readonly ability: BatterAbility
  readonly endingIndex: number
  readonly season: number
  readonly titleIds: readonly string[]
  /** 칸 번호 0~7 — 옛 저장에는 없어 목록 순서로 본다 */
  readonly slot?: number
  /** 장비·장착 스킬을 얹은 능력치 `0xb6415(기록, k, 1)` — 능력치 도형이 쓴다. 옛 저장에는 없다 */
  readonly equippedAbility?: BatterAbility
  readonly look?: HallOfFameLook
}

/** 명예의 전당 투수 (+0x880 칸) */
export interface HallOfFamePitcher {
  readonly name: string
  readonly ability: PitcherAbility
  readonly equippedAbility: PitcherAbility
  readonly endingIndex: number
  readonly season: number
  readonly titleIds: readonly string[]
  /** 칸 번호 0~3 */
  readonly slot: number
  readonly look: HallOfFameLook
}

export interface Collection {
  readonly titles: readonly string[]
  readonly skills: readonly number[]
  readonly endings: readonly number[]
  readonly hallOfFame: readonly HallOfFamer[]
  readonly hallOfFamePitchers: readonly HallOfFamePitcher[]
  /** 열린 히든 id (0x62368 — 원본 전역 저장) */
  readonly openedHiddenIds: readonly number[]
  /** 통계 기록 `[mgr+0xc8]` 중 웹이 채우는 칸 — GP 아이템 구매 수·G 사용처·켠 스킬 비트 (`annalsStats.ts`) */
  readonly stats: AnnalsStats
}

export const EMPTY_COLLECTION: Collection = {
  titles: [], skills: [], endings: [], hallOfFame: [], hallOfFamePitchers: [], openedHiddenIds: [], stats: EMPTY_ANNALS_STATS,
}

const union = <T>(left: readonly T[], right: readonly T[]): T[] => [...new Set([...left, ...right])]

export function mergeCareerIntoCollection(collection: Collection, career: PlayerCareer): Collection {
  return {
    ...mergeEndingIntoCollection(collection, career),
    titles: union(collection.titles, career.titleIds),
    skills: union(collection.skills, career.skillIds),
    openedHiddenIds: union(collection.openedHiddenIds, career.openedHiddenIds),
  }
}

/** 엔딩을 본 선수 — 타자편·투수편 커리어 둘 다 이 두 칸을 갖는다 */
export interface EndingViewer {
  readonly endingIndex: number | null
  readonly seenEventIds: readonly string[]
}

/**
 * 엔딩 적재 0x87c7c 가 기록연감 엔딩 칸을 켠다 — 두 편 공용 장면(0x106)이라 투수편 엔딩도 같은 칸이다:
 * 본 엔딩 `+0xa8 + e`(0x87f30) 와, e > 1 이면 연애 엔딩 `+0xb1 + c`(0x87fce) = 9 + c (`romanceEndingIndexOf`).
 * 이미 다 있으면 같은 객체를 돌려준다.
 */
export function mergeEndingIntoCollection(collection: Collection, viewer: EndingViewer): Collection {
  if (viewer.endingIndex === null) return collection
  const romance = romanceEndingIndexOf(viewer.endingIndex, viewer.seenEventIds)
  const seen = romance === null ? [viewer.endingIndex] : [viewer.endingIndex, romance]
  if (seen.every((index) => collection.endings.includes(index))) return collection
  return { ...collection, endings: union(collection.endings, seen) }
}

/** 미션 올 클리어 → 타자 헬멧 레벨 9 (0xa5184 — 모드 6 이면 id 37) */
const MISSION_ALL_CLEAR_HIDDEN_ID = 37

export function openHiddenForMissions(collection: Collection, isAllCleared: boolean): Collection {
  if (!isAllCleared || collection.openedHiddenIds.includes(MISSION_ALL_CLEAR_HIDDEN_ID)) return collection
  return { ...collection, openedHiddenIds: [...collection.openedHiddenIds, MISSION_ALL_CLEAR_HIDDEN_ID] }
}

/** 타자 칸 i 의 선수 (칸 번호를 따라 찾는다) */
export function hallOfFameBatterAt(collection: Collection, slot: number): HallOfFamer | null {
  return collection.hallOfFame.find((famer, index) => (famer.slot ?? index) === slot) ?? null
}

export function hallOfFamePitcherAt(collection: Collection, slot: number): HallOfFamePitcher | null {
  return collection.hallOfFamePitchers.find((famer) => famer.slot === slot) ?? null
}

/** 명예의 전당 편 — 0x62514 의 둘째 인자 (투수 ≠ 0) */
export type HallOfFameSide = '투수' | '타자'

/**
 * 빈 칸 찾기 `0x62514(목록, 투수?)` — 칸 상태 4(열린 빈 칸)인 첫 칸. 없으면 null.
 * 투수 칸 1~4 → 번호 0~3, 타자 칸 6~9·11~14 → 0~7. 열림은 기본 개방(투수 2 · 타자 4)뿐이다.
 */
export function firstEmptyHallOfFameSlot(collection: Collection, side: HallOfFameSide): number | null {
  const open = side === '투수' ? HALL_OF_FAME_OPEN_PITCHERS : HALL_OF_FAME_OPEN_BATTERS
  for (let slot = 0; slot < open; slot += 1) {
    const taken = side === '투수' ? hallOfFamePitcherAt(collection, slot) : hallOfFameBatterAt(collection, slot)
    if (taken === null) return slot
  }
  return null
}

export function isHallOfFameSlotOpen(side: HallOfFameSide, slot: number): boolean {
  return slot >= 0 && slot < (side === '투수' ? HALL_OF_FAME_OPEN_PITCHERS : HALL_OF_FAME_OPEN_BATTERS)
}

export type HallOfFameResult =
  | { readonly kind: '등록'; readonly collection: Collection; readonly slot: number }
  | { readonly kind: '빈칸없음' }
  | { readonly kind: 'G부족' }
  | { readonly kind: '엔딩전' }

/**
 * 등록 확정 (명예의 전당 등록 목록 0x62568 — 팝업 0x16 "예", 0x62cea~0x62e4e):
 * ```
 * G(+0x64) ≤ 19999 → 팝업 0xcc214 "G포인트가 부족합니다. 구매 페이지로 이동하시겠습니까?" (예 → 결과 7 = G 충전 🌐)
 * 칸 = 고른 빈 칸([목록+0x451]) 이 없으면 0x62514 의 첫 빈 칸
 * 투수(모드 3): 0x1f654(저장, 0x1fbd0 지금 투수, 칸) · 0x224ec(저장, 3)
 * 타자(모드 4): 0x1f680(저장, 0x1fc20 지금 타자, 칸) · 0x224ec(저장, 4)      ; 나리 편 초기화
 * G −= 20000 (0~99999) · 저장 · StrCOMMON[52] · 0x22c29(모드 4 ? 1 : 2, 20000)
 * ```
 * G 를 실제로 깎고 통계를 적는 것은 부르는 쪽(지갑)이 한다 — 여기서는 칸만 채운다.
 * 빈 칸이 없으면 '빈칸없음' — 원본은 확인 팝업 전에 StrCOMMON[51] 로 막는다(0x6267a).
 */
export function registerHallOfFame(
  collection: Collection,
  career: PlayerCareer,
  gamePoint: number,
  slot: number | null = null,
): HallOfFameResult {
  if (career.endingIndex === null) return { kind: '엔딩전' }
  const target = slot ?? firstEmptyHallOfFameSlot(collection, '타자')
  if (target === null || !isHallOfFameSlotOpen('타자', target) || hallOfFameBatterAt(collection, target) !== null) {
    return { kind: '빈칸없음' }
  }
  if (gamePoint < HALL_OF_FAME_COST) return { kind: 'G부족' }
  const famer: HallOfFamer = {
    name: career.name,
    ability: career.ability,
    endingIndex: career.endingIndex,
    season: career.season,
    titleIds: career.titleIds,
    slot: target,
    equippedAbility: equippedAbilityOf(career),
    look: { typeIndex: career.battingTypeIndex, handIndex: career.battingSide, skinIndex: career.skinIndex, teamId: career.teamId },
  }
  return { kind: '등록', slot: target, collection: { ...collection, hallOfFame: [...collection.hallOfFame, famer] } }
}

/** 투수편(모드 3) 등록 — `0x1f654(저장, 0x1fbd0, 칸)` 로 +0x880 칸에 넣는다. 나머지는 타자와 같다 */
export function registerHallOfFamePitcher(
  collection: Collection,
  career: PitcherCareer,
  gamePoint: number,
  slot: number | null = null,
): HallOfFameResult {
  if (career.endingIndex === null) return { kind: '엔딩전' }
  const target = slot ?? firstEmptyHallOfFameSlot(collection, '투수')
  if (target === null || !isHallOfFameSlotOpen('투수', target) || hallOfFamePitcherAt(collection, target) !== null) {
    return { kind: '빈칸없음' }
  }
  if (gamePoint < HALL_OF_FAME_COST) return { kind: 'G부족' }
  const famer: HallOfFamePitcher = {
    name: career.name,
    ability: career.ability,
    equippedAbility: equippedPitcherAbilityOf(career),
    endingIndex: career.endingIndex,
    season: career.season,
    titleIds: career.titleIds,
    slot: target,
    look: { typeIndex: career.typeIndex, handIndex: career.handIndex, skinIndex: career.skinIndex, teamId: career.teamId },
  }
  return {
    kind: '등록',
    slot: target,
    collection: { ...collection, hallOfFamePitchers: [...collection.hallOfFamePitchers, famer] },
  }
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')

const ABILITY_KEYS = ['hit', 'power', 'defense', 'run'] as const
const PITCHER_ABILITY_KEYS = ['control', 'velocity', 'breaking', 'stamina'] as const

const hasNumbers = (value: unknown, keys: readonly string[]) =>
  typeof value === 'object' && value !== null && keys.every((key) => typeof (value as Record<string, unknown>)[key] === 'number')

const isLook = (value: unknown) => hasNumbers(value, ['typeIndex', 'handIndex', 'skinIndex', 'teamId'])

function isHallOfFamer(value: unknown): value is HallOfFamer {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.endingIndex === 'number' &&
    typeof candidate.season === 'number' &&
    isStringArray(candidate.titleIds) &&
    hasNumbers(candidate.ability, ABILITY_KEYS) &&
    (candidate.slot === undefined || typeof candidate.slot === 'number') &&
    (candidate.equippedAbility === undefined || hasNumbers(candidate.equippedAbility, ABILITY_KEYS)) &&
    (candidate.look === undefined || isLook(candidate.look))
  )
}

function isHallOfFamePitcher(value: unknown): value is HallOfFamePitcher {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.endingIndex === 'number' &&
    typeof candidate.season === 'number' &&
    typeof candidate.slot === 'number' &&
    isStringArray(candidate.titleIds) &&
    hasNumbers(candidate.ability, PITCHER_ABILITY_KEYS) &&
    hasNumbers(candidate.equippedAbility, PITCHER_ABILITY_KEYS) &&
    isLook(candidate.look)
  )
}

/** 저장소에서 읽은 값은 믿지 않는다 — 하나라도 형식이 틀리면 빈 기록연감으로 시작한다 */
export function normalizeCollection(raw: unknown): Collection {
  if (typeof raw !== 'object' || raw === null) return EMPTY_COLLECTION
  const candidate = raw as Record<string, unknown>
  if (!isStringArray(candidate.titles) || !isNumberArray(candidate.skills) || !isNumberArray(candidate.endings)) {
    return EMPTY_COLLECTION
  }
  // 옛 저장은 칸 번호 없이 앞에서부터 채웠다 — 목록 순서를 칸 번호로 굳혀 둔다
  const hallOfFame = Array.isArray(candidate.hallOfFame)
    ? candidate.hallOfFame.filter(isHallOfFamer).map((famer, index) => ({ ...famer, slot: famer.slot ?? index }))
    : []
  const hallOfFamePitchers = Array.isArray(candidate.hallOfFamePitchers)
    ? candidate.hallOfFamePitchers.filter(isHallOfFamePitcher)
    : []
  const openedHiddenIds = isNumberArray(candidate.openedHiddenIds) ? candidate.openedHiddenIds : []
  return {
    titles: candidate.titles,
    skills: candidate.skills,
    endings: candidate.endings,
    hallOfFame,
    hallOfFamePitchers,
    openedHiddenIds,
    stats: normalizeAnnalsStats(candidate.stats),
  }
}

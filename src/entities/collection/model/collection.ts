import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/**
 * 스페셜 메뉴의 기록연감·명예의 전당 (StrHOWTO[28]). 선수 한 명이 아니라 게임 전체에 쌓인다.
 *   기록연감: 닉네임·스킬·엔딩 열람 ("게임 플레이 시간 기록" 은 아직 없다)
 *   명예의 전당: 엔딩 후 등록, 기본 타자 4명·투수 2명 (슬롯 구매로 8·4 — 구매는 없다)
 */
export const HALL_OF_FAME_BATTER_SLOTS = 4

export interface HallOfFamer {
  readonly name: string
  readonly ability: BatterAbility
  readonly endingIndex: number
  readonly season: number
  readonly titleIds: readonly string[]
}

export interface Collection {
  readonly titles: readonly string[]
  readonly skills: readonly number[]
  readonly endings: readonly number[]
  readonly hallOfFame: readonly HallOfFamer[]
  /** 열린 히든 id (0x62368 — 원본 전역 저장) */
  readonly openedHiddenIds: readonly number[]
}

export const EMPTY_COLLECTION: Collection = { titles: [], skills: [], endings: [], hallOfFame: [], openedHiddenIds: [] }

const union = <T>(left: readonly T[], right: readonly T[]): T[] => [...new Set([...left, ...right])]

export function mergeCareerIntoCollection(collection: Collection, career: PlayerCareer): Collection {
  return {
    ...collection,
    titles: union(collection.titles, career.titleIds),
    skills: union(collection.skills, career.skillIds),
    endings: career.endingIndex === null ? collection.endings : union(collection.endings, [career.endingIndex]),
    openedHiddenIds: union(collection.openedHiddenIds, career.openedHiddenIds),
  }
}

/** 미션 올 클리어 → 타자 헬멧 레벨 9 (0xa5184 — 모드 6 이면 id 37) */
const MISSION_ALL_CLEAR_HIDDEN_ID = 37

export function openHiddenForMissions(collection: Collection, isAllCleared: boolean): Collection {
  if (!isAllCleared || collection.openedHiddenIds.includes(MISSION_ALL_CLEAR_HIDDEN_ID)) return collection
  return { ...collection, openedHiddenIds: [...collection.openedHiddenIds, MISSION_ALL_CLEAR_HIDDEN_ID] }
}

export type HallOfFameResult =
  | { readonly kind: '등록'; readonly collection: Collection }
  | { readonly kind: '빈칸없음' }
  | { readonly kind: '엔딩전' }

export function registerHallOfFame(collection: Collection, career: PlayerCareer): HallOfFameResult {
  if (career.endingIndex === null) return { kind: '엔딩전' }
  if (collection.hallOfFame.length >= HALL_OF_FAME_BATTER_SLOTS) return { kind: '빈칸없음' }
  const famer: HallOfFamer = {
    name: career.name,
    ability: career.ability,
    endingIndex: career.endingIndex,
    season: career.season,
    titleIds: career.titleIds,
  }
  return { kind: '등록', collection: { ...collection, hallOfFame: [...collection.hallOfFame, famer] } }
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')

const ABILITY_KEYS = ['hit', 'power', 'defense', 'run'] as const

function isHallOfFamer(value: unknown): value is HallOfFamer {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const ability = candidate.ability as Record<string, unknown> | null
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.endingIndex === 'number' &&
    typeof candidate.season === 'number' &&
    isStringArray(candidate.titleIds) &&
    typeof ability === 'object' &&
    ability !== null &&
    ABILITY_KEYS.every((key) => typeof ability[key] === 'number')
  )
}

/** 저장소에서 읽은 값은 믿지 않는다 — 하나라도 형식이 틀리면 빈 기록연감으로 시작한다 */
export function normalizeCollection(raw: unknown): Collection {
  if (typeof raw !== 'object' || raw === null) return EMPTY_COLLECTION
  const candidate = raw as Record<string, unknown>
  if (!isStringArray(candidate.titles) || !isNumberArray(candidate.skills) || !isNumberArray(candidate.endings)) {
    return EMPTY_COLLECTION
  }
  const hallOfFame = Array.isArray(candidate.hallOfFame) ? candidate.hallOfFame.filter(isHallOfFamer) : []
  const openedHiddenIds = isNumberArray(candidate.openedHiddenIds) ? candidate.openedHiddenIds : []
  return { titles: candidate.titles, skills: candidate.skills, endings: candidate.endings, hallOfFame, openedHiddenIds }
}

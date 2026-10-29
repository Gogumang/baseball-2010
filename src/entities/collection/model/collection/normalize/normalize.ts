import { normalizeAnnalsStats } from '@/entities/collection/model/annalsStats'
import { FULL_STAMINA } from '@/entities/collection/model/collection/otherSlices'
import { SEASON_REGULAR_WIN_CAP } from '@/entities/collection/model/collection/merge/merges'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection/types'
import type { Collection, HallOfFamePitcher, HallOfFamer } from '@/entities/collection/model/collection/types'

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')
const isNumberArray = (value: unknown): value is number[] => Array.isArray(value) && value.every((item) => typeof item === 'number')

const ABILITY_KEYS = ['hit', 'power', 'defense', 'run'] as const
const PITCHER_ABILITY_KEYS = ['control', 'velocity', 'breaking', 'stamina'] as const

const hasNumbers = (value: unknown, keys: readonly string[]) =>
  typeof value === 'object' && value !== null && keys.every((key) => typeof (value as Record<string, unknown>)[key] === 'number')

const isLook = (value: unknown) => hasNumbers(value, ['typeIndex', 'handIndex', 'skinIndex', 'teamId'])

const isOptionalNumber = (value: unknown) => value === undefined || typeof value === 'number'

/** 기록 칸(장비 니블·장착 비트)은 옛 저장에 없을 수 있다 — 있으면 형식만 본다 */
const hasRecordFields = (candidate: Record<string, unknown>, abilityKeys: readonly string[]) =>
  (candidate.equipmentLevels === undefined || hasNumbers(candidate.equipmentLevels, abilityKeys)) &&
  (candidate.equippedSkillIds === undefined || isNumberArray(candidate.equippedSkillIds)) &&
  (candidate.recordLine === undefined || isNumberArray(candidate.recordLine)) &&
  isOptionalNumber(candidate.salaryGrade) &&
  isOptionalNumber(candidate.recordSlot)

/** 두 편 명전 기록이 함께 드는 칸 — 이름 · 엔딩 · 해 · 칭호 · 능력치 · 기록 칸 */
function hasFamerCore(candidate: Record<string, unknown>, abilityKeys: readonly string[]): boolean {
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.endingIndex === 'number' &&
    typeof candidate.season === 'number' &&
    isStringArray(candidate.titleIds) &&
    hasNumbers(candidate.ability, abilityKeys) &&
    hasRecordFields(candidate, abilityKeys)
  )
}

function isHallOfFamer(value: unknown): value is HallOfFamer {
  const candidate = recordOf(value)
  return candidate !== null && hasFamerCore(candidate, ABILITY_KEYS) && hasBatterFields(candidate)
}

/** 타자 칸 — 옛 저장에 없을 수 있는 칸(칸 번호 · 장비 능력치 · 생김새 · 필살 · 내외야) */
function hasBatterFields(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalNumber(candidate.slot) &&
    (candidate.equippedAbility === undefined || hasNumbers(candidate.equippedAbility, ABILITY_KEYS)) &&
    (candidate.look === undefined || isLook(candidate.look)) &&
    isOptionalNumber(candidate.specialSwingNumber) &&
    isOptionalNumber(candidate.positionIndex)
  )
}

function isHallOfFamePitcher(value: unknown): value is HallOfFamePitcher {
  const candidate = recordOf(value)
  return candidate !== null && hasFamerCore(candidate, PITCHER_ABILITY_KEYS) && hasPitcherFields(candidate)
}

/** 투수 칸 — 칸 번호 · 장비 능력치 · 생김새는 늘 있고, 구질 · 마구 · 스태미나 · 보직은 옛 저장에 없을 수 있다 */
function hasPitcherFields(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate.slot === 'number' &&
    hasNumbers(candidate.equippedAbility, PITCHER_ABILITY_KEYS) &&
    isLook(candidate.look) &&
    isOptionalNumber(candidate.pitchMask) &&
    isOptionalNumber(candidate.selectedMagicNumber) &&
    isOptionalNumber(candidate.stamina) &&
    isPitcherRoleOrNone(candidate.role)
  )
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/** 보직 `+0xb & 3` — 0 · 1 · 2, 옛 저장은 없다 */
function isPitcherRoleOrNone(role: unknown): boolean {
  return role === undefined || role === 0 || role === 1 || role === 2
}

/**
 * **옛 명전 기록 이사** — 원본 기록은 0x30 바이트 통째 사본이라 늘 있는 칸인데 웹 기록이 나중에 든 칸을 채운다. 등록 때 값은
 * 남아 있지 않아 예전 웹이 빈 칸을 읽던 값으로 채운다 — 이사 앞뒤 결과가 같다. 채울 것이 없으면 같은 객체
 * - +0x1b `salaryGrade`(2026-10-16): 0 — 상세 창 0x5b798 이 빈 칸을 연봉 0 으로 찍었다
 * - 투수 +0x2c `stamina`(2026-10-26): 10000 — 미션 투수 스태미나로 늘 10000 을 썼다
 */
export function migrateHallOfFamer(famer: HallOfFamer): HallOfFamer {
  return famer.salaryGrade === undefined ? { ...famer, salaryGrade: 0 } : famer
}

export function migrateHallOfFamePitcher(famer: HallOfFamePitcher): HallOfFamePitcher {
  if (famer.stamina !== undefined && famer.salaryGrade !== undefined) return famer
  return { ...famer, stamina: famer.stamina ?? FULL_STAMINA, salaryGrade: famer.salaryGrade ?? 0 }
}

/** 저장소에서 읽은 값은 믿지 않는다 — 하나라도 형식이 틀리면 빈 기록연감으로 시작한다 */
export function normalizeCollection(raw: unknown): Collection {
  if (typeof raw !== 'object' || raw === null) return EMPTY_COLLECTION
  const candidate = raw as Record<string, unknown>
  if (!isStringArray(candidate.titles) || !isNumberArray(candidate.endings)) {
    return EMPTY_COLLECTION
  }
  return {
    titles: candidate.titles,
    endings: candidate.endings,
    seasonEndings: isNumberArray(candidate.seasonEndings) ? candidate.seasonEndings : [],
    hallOfFame: hallOfFameOf(candidate.hallOfFame),
    hallOfFamePitchers: hallOfFamePitchersOf(candidate.hallOfFamePitchers),
    openedHiddenIds: isNumberArray(candidate.openedHiddenIds) ? candidate.openedHiddenIds : [],
    stats: normalizeAnnalsStats(candidate.stats),
    ...seasonRegularWinCountOf(candidate.seasonRegularWinCount),
  }
}

/** 옛 저장은 칸 번호 없이 앞에서부터 채웠다 — 목록 순서를 칸 번호로 굳혀 둔다 */
function hallOfFameOf(raw: unknown): HallOfFamer[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isHallOfFamer).map((famer, index) => migrateHallOfFamer({ ...famer, slot: famer.slot ?? index }))
}

function hallOfFamePitchersOf(raw: unknown): HallOfFamePitcher[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isHallOfFamePitcher).map(migrateHallOfFamePitcher)
}

/** 전역기록 +0xbf — 0 ~ 100 정수만 (`Collection.seasonRegularWinCount`), 아니면 칸을 비운다 */
function seasonRegularWinCountOf(raw: unknown): { readonly seasonRegularWinCount?: number } {
  const isCount = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= SEASON_REGULAR_WIN_CAP
  return isCount ? { seasonRegularWinCount: raw } : {}
}

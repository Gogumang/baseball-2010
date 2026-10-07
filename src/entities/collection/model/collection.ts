import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { romanceEndingIndexOf } from '@/entities/career/model/seasonFlow'
import { FIRST_HIDDEN_LEVEL, hiddenOpenIdOf, ownsEquipment } from '@/entities/career/model/equipment'
import { ownsPitcherEquipment, pitcherHiddenOpenIdOf } from '@/entities/pitcher-career/model/pitcherEquipment'
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

/**
 * 등록 `0x1f654`(투수) / `0x1f680`(타자) 은 선수 기록 0x30 바이트를 **통째로** 칸에 복사한다
 * (`memcpy(전역기록 + 0x880|0x940 + 칸·0x30, 선수, 0x30)` — 그 앞에 +0xa 를 0(투수)/0x20(타자),
 * +0 을 칸 − 0x4c / 칸 − 0x38 로 바꿔 명예 선수 번호를 단다). 그래서 명전 선수는 미션·홈런더비(0x1fbd0 · 0x1fc20)에서
 * 나리 선수와 같은 칸을 읽힌다 — 능력치 +0xc · 장착 비트 +0x14 · 고른 마구/필살 번호 +0x18 · 구질 마스크 +0x1c(투수) ·
 * 장비 니블 · 생김새 +0xb. 웹 기록은 0x30 바이트가 아니라 그중 경기가 읽는 칸만 이름으로 든다.
 * 이 칸들은 2026-10-06 에 더했다 — 그 전에 등록한 옛 저장에는 없어 `undefined` 다(읽는 쪽이 대체를 정한다).
 */
interface HallOfFameRecordFields<Ability> {
  /** 장비 니블 (0 = 미장착, 1~11 = 레벨+1) — 0xb6414 가 능력치에 얹는다 */
  readonly equipmentLevels?: Ability
  /** 장착 스킬 — 기록 +0x14 비트 (`career.equippedSkillIds` 그대로, 경기 스킬 0xb62b4 가 본다) */
  readonly equippedSkillIds?: readonly number[]
}

/** 명예의 전당 타자 (+0x940 칸) */
export interface HallOfFamer extends HallOfFameRecordFields<BatterAbility> {
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
  /** 고른 필살타법 번호 — 기록 +0x18 (`career.specialSwingNumber`, 0 이면 안 고름) */
  readonly specialSwingNumber?: number
}

/** 명예의 전당 투수 (+0x880 칸) */
export interface HallOfFamePitcher extends HallOfFameRecordFields<PitcherAbility> {
  readonly name: string
  readonly ability: PitcherAbility
  readonly equippedAbility: PitcherAbility
  readonly endingIndex: number
  readonly season: number
  readonly titleIds: readonly string[]
  /** 칸 번호 0~3 */
  readonly slot: number
  readonly look: HallOfFameLook
  /** 보유 구질 마스크 — 기록 +0x1c (비트 t−1 = 구질 t, 경기 구질 칸 0xb6d2c 가 본다) */
  readonly pitchMask?: number
  /** 고른 마구 번호 — 기록 +0x18 (0 없음 · 1~4) */
  readonly selectedMagicNumber?: number
  /**
   * 보직 — 기록 `+0xb & 3` (0xb6dec → 0xb6705). 등록 0x1f654 는 `+0xa`(= 0)·`+0`(칸 − 0x4c)만 덮어쓰고 `+0xb` 는
   * 손대지 않은 채 0x30 바이트를 복사하므로(0x1f656~0x1f674) 투수편 선수의 보직이 그대로 남는다. 시즌 경기가 이 칸을
   * CPU 투수 교체(0xabfcc · 0xac428)·등판 판정(0xa4f60) 등에서 읽는다. 옛 저장에는 없다(받는 쪽이 선발로 본다).
   */
  readonly role?: PitcherRole
}

export interface Collection {
  readonly titles: readonly string[]
  readonly skills: readonly number[]
  readonly endings: readonly number[]
  /**
   * 본 시즌모드 엔딩 e (0~4) — 전역기록 `+0xa0 + e`. 새 해 0x6e0c 가 10년차 엔딩 판정 0xa3084 ≥ 0 이면 1 을 쓴다(P4 1c).
   * 읽는 곳은 "엔딩 모두 수집" 판정 0x28e98(0x292a4~0x292b6) — 엔딩 이름은 StrMAINMENU[204~208] "비인기 … 최강".
   * 옛 저장에는 없어 빈 목록이다.
   */
  readonly seasonEndings: readonly number[]
  readonly hallOfFame: readonly HallOfFamer[]
  readonly hallOfFamePitchers: readonly HallOfFamePitcher[]
  /** 열린 히든 id (0x62368 — 원본 전역 저장) */
  readonly openedHiddenIds: readonly number[]
  /** 통계 기록 `[mgr+0xc8]` 중 웹이 채우는 칸 — GP 아이템 구매 수·G 사용처·켠 스킬 비트 (`annalsStats.ts`) */
  readonly stats: AnnalsStats
}

export const EMPTY_COLLECTION: Collection = {
  titles: [], skills: [], endings: [], seasonEndings: [], hallOfFame: [], hallOfFamePitchers: [], openedHiddenIds: [], stats: EMPTY_ANNALS_STATS,
}

const union = <T>(left: readonly T[], right: readonly T[]): T[] => [...new Set([...left, ...right])]

export function mergeCareerIntoCollection(collection: Collection, career: PlayerCareer): Collection {
  return {
    ...mergeEndingIntoCollection(collection, career),
    titles: union(collection.titles, career.titleIds),
    skills: union(collection.skills, career.skillIds),
    openedHiddenIds: union(collection.openedHiddenIds, union(career.openedHiddenIds, batterCollectorHiddenIdsOf(career))),
  }
}

/** 장비 부위 수 · 컬렉터 칸(레벨 8) */
const COLLECTOR_PART_COUNT = 4
const COLLECTOR_LEVEL = 8

/**
 * **컬렉터 해금 — 언제 전역 표 `app+0xc0` 에 쓰나** (직접 떴다, 0x14a74 0x14bae~0x14c86).
 * 나리 장비 구매 확정(창 종류 3)이 저장 직후 **네 부위 모두** `0xa5020(기록, t)`(레벨 0~6 일곱 칸을 다 가졌나)를 보고, 참인
 * 부위마다 `0x62368(ui, id, 0)` 로 전역 표에 켠다 — 타자편(모드 4) id 36·40·44·48 · 투수편 20·24·28·32. 다른 자리는 없다
 * (0x62368 의 부르는 곳 전수: 0x14a74 넷 · 시즌 0x6900 · 0x7d90 구장 · 그 밖은 이벤트·미션·G 상한).
 * 그래서 일곱 칸을 다 가진 기록이면 전역 표에 그 id 가 이미 서 있다 — 웹 커리어 구매(`purchaseEquipment`)도 같은 때 켜지만
 * 그보다 앞서 산 옛 커리어는 칸이 비어 있을 수 있어, 기록연감에 모을 때 보유에서 다시 센다.
 */
export function batterCollectorHiddenIdsOf(career: PlayerCareer): number[] {
  return collectorIdsOf((part, level) => ownsEquipment(career, part, level), (part) => hiddenOpenIdOf(part, COLLECTOR_LEVEL))
}

/** 투수편 짝 — id 20·24·28·32 (`batterCollectorHiddenIdsOf` 주석) */
export function pitcherCollectorHiddenIdsOf(career: PitcherCareer): number[] {
  return collectorIdsOf(
    (part, level) => ownsPitcherEquipment(career, part, level),
    (part) => pitcherHiddenOpenIdOf(part, COLLECTOR_LEVEL),
  )
}

function collectorIdsOf(owns: (part: number, level: number) => boolean, idOf: (part: number) => number): number[] {
  const ids: number[] = []
  for (let part = 0; part < COLLECTOR_PART_COUNT; part += 1) {
    const isCollector = Array.from({ length: FIRST_HIDDEN_LEVEL }, (_unused, level) => level).every((level) => owns(part, level))
    if (isCollector) ids.push(idOf(part))
  }
  return ids
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

/** 시즌 엔딩 e 를 켠다 (`저장+0xa0+e = 1`, 0x6e0c). 0~4 밖이거나 이미 있으면 같은 객체 */
export function mergeSeasonEndingIntoCollection(collection: Collection, endingIndex: number | null): Collection {
  if (endingIndex === null || !Number.isInteger(endingIndex) || endingIndex < 0 || endingIndex > SEASON_ENDING_LAST) return collection
  if (collection.seasonEndings.includes(endingIndex)) return collection
  return { ...collection, seasonEndings: [...collection.seasonEndings, endingIndex] }
}
const SEASON_ENDING_LAST = 4

/**
 * 투수편이 얻은 칭호 — 원본은 칭호를 얻을 때 0xa40e0 이 **지금 편** 쪽 기록연감 비트(투수편 `+0xec`)에 켠다(P3 10-2).
 * 웹 칭호는 이름이라(공통 0~31 은 두 편 같은 이름 · 투수편 고유는 48~63) 이름 목록에 합치면 같은 뜻이다. 다 있으면 같은 객체.
 */
export function mergeTitlesIntoCollection(collection: Collection, titleIds: readonly string[]): Collection {
  const missing = titleIds.filter((title, index) => !collection.titles.includes(title) && titleIds.indexOf(title) === index)
  return missing.length === 0 ? collection : { ...collection, titles: [...collection.titles, ...missing] }
}

/** 미션 올 클리어 → 타자 헬멧 레벨 9 (0xa5184 — 모드 6 이면 id 37) */
const MISSION_ALL_CLEAR_HIDDEN_ID = 37

export function openHiddenForMissions(collection: Collection, isAllCleared: boolean): Collection {
  if (!isAllCleared || collection.openedHiddenIds.includes(MISSION_ALL_CLEAR_HIDDEN_ID)) return collection
  return { ...collection, openedHiddenIds: [...collection.openedHiddenIds, MISSION_ALL_CLEAR_HIDDEN_ID] }
}

/** 타자 칸 i 의 선수 (칸 번호를 따라 찾는다) */
export function hallOfFameBatterAt(collection: Pick<Collection, 'hallOfFame'>, slot: number): HallOfFamer | null {
  return collection.hallOfFame.find((famer, index) => (famer.slot ?? index) === slot) ?? null
}

export function hallOfFamePitcherAt(collection: Pick<Collection, 'hallOfFamePitchers'>, slot: number): HallOfFamePitcher | null {
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

/**
 * 미션·홈런더비 **선수 고르기** 결과 (메인 메뉴 하위 17 미션 0x29a54 · 16 홈런더비 0x29ac8, 목록 0x62568 → 0x5eae0).
 * 칸 코드 1 나리 투수 · 2 나리 타자 · 3 명예 투수 · 4 명예 타자 를 편과 명전 번호로 든다 —
 * 0x5eae0 이 **전역기록 +0xa5(투수)/+0xa6(타자)** 에 쓰는 s8 그대로다: 나리 선수면 −1(`null`), 명예 선수면 명전 번호 0~.
 * 경기 선수 게터 0x1fbd0 · 0x1fc20 이 모드 5·6·7 에서 이 값이 0 이상이면 명전 기록(0x1f62c · 0x1f640)을 준다.
 */
export interface HallOfFamePlayerPick {
  readonly side: HallOfFameSide
  /** 명전 번호 (투수 0~3 · 타자 0~7) — 나리 선수면 null (+0xa5/+0xa6 = −1) */
  readonly hallOfFameIndex: number | null
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
    equipmentLevels: career.equipmentLevels,
    equippedSkillIds: career.equippedSkillIds,
    specialSwingNumber: career.specialSwingNumber,
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
    equipmentLevels: career.equipmentLevels,
    equippedSkillIds: career.equippedSkillIds,
    pitchMask: career.pitchMask,
    selectedMagicNumber: career.selectedMagicNumber,
    role: career.role,
  }
  return {
    kind: '등록',
    slot: target,
    collection: { ...collection, hallOfFamePitchers: [...collection.hallOfFamePitchers, famer] },
  }
}

/**
 * 명전 기록의 선수 번호 `+0` — 등록이 칸 번호로 덮어쓴다 (0x1f654 투수 `+0 = 칸 − 0x4c` · 0x1f680 타자 `+0 = 칸 − 0x38`,
 * u8 로 칸 + 0xb4 / 칸 + 0xc8). 시즌 영입 중복 검사 0xb50ac 와 삭제 0x221dc 가 이 번호로 시즌 명단을 찾는다.
 */
export const HALL_OF_FAME_PITCHER_FIRST_RECORD_ID = 0xb4
export const HALL_OF_FAME_BATTER_FIRST_RECORD_ID = 0xc8
export function hallOfFameRecordIdOf(side: HallOfFameSide, slot: number): number {
  return (side === '투수' ? HALL_OF_FAME_PITCHER_FIRST_RECORD_ID : HALL_OF_FAME_BATTER_FIRST_RECORD_ID) + slot
}

/** 장비 니블 차례 t → 능력치 칸 (타자 0x897e8 의 부위 차례 · 투수 `PITCHER_ABILITY_ORDER`) */
const BATTER_EQUIPMENT_KEYS: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']

/**
 * 명전 기록의 장비 니블 네 칸 (+0x19 윗·아랫니블 · +0x1a 윗·아랫니블) — 시즌에 영입한 명예 선수의 팀 레코드 줄은 영입 0xc554 가
 * 이 0x30 바이트를 통째로 옮긴 사본이라 처음 니블이 이것이다. 칸이 없거나 옛 기록(니블 칸 없음)이면 null.
 */
export function hallOfFameEquipmentNibblesOf(
  collection: Pick<Collection, 'hallOfFame' | 'hallOfFamePitchers'>,
  side: HallOfFameSide,
  recordId: number,
): readonly number[] | null {
  const slot = recordId - (side === '투수' ? HALL_OF_FAME_PITCHER_FIRST_RECORD_ID : HALL_OF_FAME_BATTER_FIRST_RECORD_ID)
  if (side === '투수') {
    const levels = hallOfFamePitcherAt(collection, slot)?.equipmentLevels
    return levels === undefined ? null : PITCHER_ABILITY_ORDER.map((key) => levels[key])
  }
  const levels = hallOfFameBatterAt(collection, slot)?.equipmentLevels
  return levels === undefined ? null : BATTER_EQUIPMENT_KEYS.map((key) => levels[key])
}

/**
 * **0x2328c(저장, 줄, 투수?)** — 시즌 장비 창 0xdc 의 적용 0x7d90 이 명예 선수(0xb6348)의 장비를 산 뒤 부른다(0x7ef4~0x7f12).
 * ```
 * 투수? ≠ 0: i = 0..3  0x1f62c(저장, i) (명전 투수 칸) 의 +0 == 줄+0 이면 +0x19 · +0x1a 를 줄의 것으로 · 저장 0x1f1b8
 * 투수? = 0: i = 0..7  0x1f640(저장, i) (명전 타자 칸) 같은 식
 * ```
 * 니블 두 바이트를 통째로 옮기므로 네 부위가 모두 줄의 값이 된다. 칸 +0 은 등록이 칸 + 0xb4 / + 0xc8 로 덮어쓴 번호라
 * 번호에서 칸을 되찾는다(빈 칸은 +0 = 0 이라 맞지 않는다). 맞는 칸이 없으면 같은 객체.
 */
export function syncHallOfFameEquipment(
  collection: Collection,
  side: HallOfFameSide,
  recordId: number,
  nibbles: readonly number[],
): Collection {
  const slot = recordId - (side === '투수' ? HALL_OF_FAME_PITCHER_FIRST_RECORD_ID : HALL_OF_FAME_BATTER_FIRST_RECORD_ID)
  const nibbleAt = (part: number) => nibbles[part] ?? 0
  if (side === '투수') {
    if (slot < 0 || slot >= HALL_OF_FAME_MAX_PITCHERS || hallOfFamePitcherAt(collection, slot) === null) return collection
    // 니블 t ↔ `PITCHER_ABILITY_ORDER[t]` (제구·구속·변화·체력)
    const equipmentLevels: PitcherAbility = {
      control: nibbleAt(0), velocity: nibbleAt(1), breaking: nibbleAt(2), stamina: nibbleAt(3),
    }
    return {
      ...collection,
      hallOfFamePitchers: collection.hallOfFamePitchers.map((famer) => (famer.slot === slot ? { ...famer, equipmentLevels } : famer)),
    }
  }
  if (slot < 0 || slot >= HALL_OF_FAME_MAX_BATTERS || hallOfFameBatterAt(collection, slot) === null) return collection
  const equipmentLevels: BatterAbility = { hit: nibbleAt(0), power: nibbleAt(1), defense: nibbleAt(2), run: nibbleAt(3) }
  return {
    ...collection,
    hallOfFame: collection.hallOfFame.map((famer, index) => ((famer.slot ?? index) === slot ? { ...famer, equipmentLevels } : famer)),
  }
}

/**
 * 명전 칸 삭제 — 스페셜 명예의 전당 말풍선 "슬롯에서 삭제" 확인 "예" (0x62994, R11 3-2):
 * 투수 칸 `0x22371(저장, 칸)` · 타자 칸 `0x22339(저장, 칸)` 이 시즌 명단 정리 0x221dc 뒤 칸 0x30 바이트를 0 으로
 * (`memset`, 0x1400428) — 빈 칸(상태 4)이 된다. 시즌 명단 정리는 `removeHallOfFamerFromRoster`(season-mode) 몫이다.
 * 없는 칸이면 같은 객체.
 */
export function deleteHallOfFame(collection: Collection, side: HallOfFameSide, slot: number): Collection {
  if (side === '투수') {
    if (hallOfFamePitcherAt(collection, slot) === null) return collection
    return { ...collection, hallOfFamePitchers: collection.hallOfFamePitchers.filter((famer) => famer.slot !== slot) }
  }
  if (hallOfFameBatterAt(collection, slot) === null) return collection
  return { ...collection, hallOfFame: collection.hallOfFame.filter((famer, index) => (famer.slot ?? index) !== slot) }
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

const isOptionalNumber = (value: unknown) => value === undefined || typeof value === 'number'

/** 기록 칸(장비 니블·장착 비트)은 옛 저장에 없을 수 있다 — 있으면 형식만 본다 */
const hasRecordFields = (candidate: Record<string, unknown>, abilityKeys: readonly string[]) =>
  (candidate.equipmentLevels === undefined || hasNumbers(candidate.equipmentLevels, abilityKeys)) &&
  (candidate.equippedSkillIds === undefined || isNumberArray(candidate.equippedSkillIds))

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
    (candidate.look === undefined || isLook(candidate.look)) &&
    hasRecordFields(candidate, ABILITY_KEYS) &&
    isOptionalNumber(candidate.specialSwingNumber)
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
    isLook(candidate.look) &&
    hasRecordFields(candidate, PITCHER_ABILITY_KEYS) &&
    isOptionalNumber(candidate.pitchMask) &&
    isOptionalNumber(candidate.selectedMagicNumber) &&
    (candidate.role === undefined || candidate.role === 0 || candidate.role === 1 || candidate.role === 2)
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
    seasonEndings: isNumberArray(candidate.seasonEndings) ? candidate.seasonEndings : [],
    hallOfFame,
    hallOfFamePitchers,
    openedHiddenIds,
    stats: normalizeAnnalsStats(candidate.stats),
  }
}

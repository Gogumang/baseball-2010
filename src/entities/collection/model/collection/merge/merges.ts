import {
  FIRST_HIDDEN_LEVEL,
  hiddenOpenIdOf,
  ownsEquipment,
  ownsPitcherEquipment,
  pitcherHiddenOpenIdOf,
  romanceEndingIndexOf,
  type PitcherCareer,
  type PlayerCareer,
} from '@/entities/collection/model/collection/otherSlices'
import type { Collection } from '@/entities/collection/model/collection/types'

/** 0x9f6f0 의 상한 (`cmp r3,#0x64; ble`) */
export const SEASON_REGULAR_WIN_CAP = 100
/** 0x4f204 `cmp r3,#0x63; ble` — 올린 수가 99 를 넘으면 0x62368(ui, 0x2d = 45, 0) */
const SEASON_REGULAR_WIN_HIDDEN_THRESHOLD = 99
export const SEASON_REGULAR_WIN_HIDDEN_ID = 45

/**
 * **정산 0x4ea0c 의 4f1a2~4f212** (직접 떴다) — 모드 2 경기이고 L+0x34(포스트시즌) · L+0xac(국가대항전)가 둘 다 0 이고
 * 사람 팀이 이겼으면([sp+0x50] = 0x4a350, 동점은 선공 승) `0x9f6f0(전역기록)`: `+0xbf = min(+0xbf + 1, 100)`. 이어서
 * `+0xbf > 99` 면 히든 45 를 연다. 올린 기록과 열 id(없으면 null)를 돌려준다
 */
export function countSeasonRegularWin(collection: Collection): { readonly collection: Collection; readonly hiddenId: number | null } {
  const count = Math.min((collection.seasonRegularWinCount ?? 0) + 1, SEASON_REGULAR_WIN_CAP)
  return {
    collection: { ...collection, seasonRegularWinCount: count },
    hiddenId: count > SEASON_REGULAR_WIN_HIDDEN_THRESHOLD ? SEASON_REGULAR_WIN_HIDDEN_ID : null,
  }
}

const union = <T>(left: readonly T[], right: readonly T[]): T[] => [...new Set([...left, ...right])]

export function mergeCareerIntoCollection(collection: Collection, career: PlayerCareer): Collection {
  return {
    ...mergeEndingIntoCollection(collection, career),
    titles: union(collection.titles, career.titleIds),
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
  return collectorIdsOf(
    (part, level) => ownsEquipment(career, part, level),
    (part) => hiddenOpenIdOf(part, COLLECTOR_LEVEL),
  )
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
/** 시즌 엔딩 번호의 끝 — StrMAINMENU[204~208] "비인기 … 최강" 다섯 */
const SEASON_ENDING_LAST = 4

/** 시즌 엔딩 e 를 켠다 (`저장+0xa0+e = 1`, 0x6e0c). 0~4 밖이거나 이미 있으면 같은 객체 */
export function mergeSeasonEndingIntoCollection(collection: Collection, endingIndex: number | null): Collection {
  if (!isSeasonEndingIndex(endingIndex)) return collection
  if (collection.seasonEndings.includes(endingIndex)) return collection
  return { ...collection, seasonEndings: [...collection.seasonEndings, endingIndex] }
}

function isSeasonEndingIndex(endingIndex: number | null): endingIndex is number {
  return endingIndex !== null && Number.isInteger(endingIndex) && endingIndex >= 0 && endingIndex <= SEASON_ENDING_LAST
}

/**
 * 투수편이 얻은 칭호 — 원본은 칭호를 얻을 때 0xa40e0 이 **지금 편** 쪽 기록연감 비트(투수편 `+0xec`)에 켠다(P3 10-2).
 * 웹 칭호는 이름이라(공통 0~31 은 두 편 같은 이름 · 투수편 고유는 48~63) 이름 목록에 합치면 같은 뜻이다. 다 있으면 같은 객체.
 */
export function mergeTitlesIntoCollection(collection: Collection, titleIds: readonly string[]): Collection {
  const missing = titleIds.filter((title, index) => !collection.titles.includes(title) && titleIds.indexOf(title) === index)
  return missing.length === 0 ? collection : { ...collection, titles: [...collection.titles, ...missing] }
}

import { useCallback, useEffect, useState } from 'react'
import {
  mergeCareerIntoCollection,
  mergeEndingIntoCollection,
  normalizeCollection,
  openHiddenForMissions,
  registerHallOfFame,
} from '@/entities/collection/model/collection'
import type { Collection, EndingViewer } from '@/entities/collection/model/collection'
import { applyAnnalsStat } from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

const NO_IDS: readonly number[] = []
const NO_EVENTS: readonly string[] = []

/**
 * 히든 오픈 id 를 전역 표에 더한다 — 이미 다 있으면 같은 객체를 돌려줘 저장·렌더를 되풀이하지 않는다.
 * 원본 해금표는 모드와 상관없는 전역 `app+0xc0`(0x9f69c / 0x62368) 하나다.
 */
export function mergeOpenedHiddenIds(collection: Collection, openedHiddenIds: readonly number[]): Collection {
  const missing = openedHiddenIds.filter(
    (id, index) => !collection.openedHiddenIds.includes(id) && openedHiddenIds.indexOf(id) === index,
  )
  return missing.length === 0 ? collection : { ...collection, openedHiddenIds: [...collection.openedHiddenIds, ...missing] }
}

/**
 * 기록연감·명예의 전당. 선수가 얻는 닉네임·스킬·엔딩을 계속 모은다.
 *
 * `pitcherOpenedHiddenIds` — 나리 **투수편** 커리어가 연 히든 id. 투수 장비 컬렉터(0xa5020 → 0x62368,
 * id 20·24·28·32)는 원본에서 타자편과 같은 전역 표 `app+0xc0` 에 켜진다(d15c14d). 웹 투수 커리어는 제
 * `openedHiddenIds` 에만 남겨 왔으니 여기서 기록연감으로 모은다. 투수편 칭호·스킬은 타자편과 번호가 달라
 * 여기에 섞지 않는다.
 *
 * `pitcherEnding` — 투수편 커리어의 엔딩. 엔딩 적재 0x87c7c 는 두 편 공용이라 투수편 엔딩(연애 엔딩 포함)도
 * 기록연감 엔딩 칸에 켠다.
 */
export function useCollection(
  store: JsonStorePort,
  career: PlayerCareer | null,
  isEveryMissionCleared: boolean,
  pitcherOpenedHiddenIds: readonly number[] = NO_IDS,
  pitcherEnding: EndingViewer | null = null,
) {
  const [collection, setCollection] = useState<Collection>(() => normalizeCollection(store.load()))

  useEffect(() => {
    if (career === null) return
    setCollection((previous) => mergeCareerIntoCollection(previous, career))
  }, [career])

  useEffect(() => {
    setCollection((previous) => mergeOpenedHiddenIds(previous, pitcherOpenedHiddenIds))
  }, [pitcherOpenedHiddenIds])

  const pitcherEndingIndex = pitcherEnding?.endingIndex ?? null
  const pitcherSeenEventIds = pitcherEnding?.seenEventIds ?? NO_EVENTS
  useEffect(() => {
    setCollection((previous) =>
      mergeEndingIntoCollection(previous, { endingIndex: pitcherEndingIndex, seenEventIds: pitcherSeenEventIds }))
  }, [pitcherEndingIndex, pitcherSeenEventIds])

  useEffect(() => {
    setCollection((previous) => openHiddenForMissions(previous, isEveryMissionCleared))
  }, [isEveryMissionCleared])

  useEffect(() => {
    store.save(collection)
  }, [collection, store])

  const register = (target: PlayerCareer) => {
    const result = registerHallOfFame(collection, target)
    if (result.kind === '등록') setCollection(result.collection)
    return result.kind
  }

  /** 통계 기록 `[mgr+0xc8]` 에 한 건 쌓는다 (0x22e35 · 0x22c29 · 0xb663c) — 원본도 곧바로 저장(0x1f1e1)한다 */
  const recordStat = useCallback((event: AnnalsStatEvent) => {
    setCollection((previous) => ({ ...previous, stats: applyAnnalsStat(previous.stats, event) }))
  }, [])

  return { collection, register, recordStat }
}

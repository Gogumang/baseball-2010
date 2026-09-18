import { useEffect, useState } from 'react'
import {
  mergeCareerIntoCollection,
  normalizeCollection,
  openHiddenForMissions,
  registerHallOfFame,
} from '@/entities/collection/model/collection'
import type { Collection } from '@/entities/collection/model/collection'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/** 기록연감·명예의 전당. 선수가 얻는 닉네임·스킬·엔딩을 계속 모은다. */
export function useCollection(store: JsonStorePort, career: PlayerCareer | null, isEveryMissionCleared: boolean) {
  const [collection, setCollection] = useState<Collection>(() => normalizeCollection(store.load()))

  useEffect(() => {
    if (career === null) return
    setCollection((previous) => mergeCareerIntoCollection(previous, career))
  }, [career])

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

  return { collection, register }
}

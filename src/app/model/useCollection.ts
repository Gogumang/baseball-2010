import { useEffect, useRef, useState } from 'react'
import {
  mergeCareerIntoCollection,
  mergeEndingIntoCollection,
  mergeSeasonEndingIntoCollection,
  mergeTitlesIntoCollection,
  normalizeCollection,
} from '@/entities/collection/model/collection'
import type { Collection, EndingViewer } from '@/entities/collection/model/collection'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { mergeOpenedHiddenIds } from '@/app/model/useCollection/collectionTypes'
import { useHallOfFameEdits } from '@/app/model/useCollection/useHallOfFameEdits'
import { useHiddenOpen } from '@/app/model/useCollection/useHiddenOpen'
import { useAnnalsStats } from '@/app/model/useCollection/useAnnalsStats'

export type { CollectionRewardWallet, HallOfFameWallet } from '@/app/model/useCollection/collectionTypes'
export { mergeOpenedHiddenIds } from '@/app/model/useCollection/collectionTypes'
export { nariBatterOf, nariPitcherOf } from '@/app/model/useCollection/nariHallOfFamePlayers'
export type { NariHallOfFamePlayer } from '@/app/model/useCollection/nariHallOfFamePlayers'

const NO_IDS: readonly number[] = []
const NO_ANNOUNCE = () => {}
const NO_EVENTS: readonly string[] = []
const NO_TITLES: readonly string[] = []

/** 투수편 엔딩 칸 — 효과가 값마다 따로 견준다(엔딩 번호 · 본 이벤트) */
function pitcherEndingKeysOf(pitcherEnding: EndingViewer | null): EndingViewer {
  return { endingIndex: pitcherEnding?.endingIndex ?? null, seenEventIds: pitcherEnding?.seenEventIds ?? NO_EVENTS }
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
  pitcherOpenedHiddenIds: readonly number[] = NO_IDS,
  pitcherEnding: EndingViewer | null = null,
  pitcherTitleIds: readonly string[] = NO_TITLES,
  seasonEndingIndex: number | null = null,
  /**
   * 공용 창에 히든 오픈 알림을 띄운다 (0x62368 → 0x74ef5) — 새로 연 k 만 온다. `then` 은 그 창을 닫은 뒤 할 일
   * (원본 장면이 창 꼬리표로 다음 상태를 고르는 자리)
   */
  announceHiddenOpen: (ids: readonly number[], then?: (() => void) | null) => void = NO_ANNOUNCE,
) {
  const [collection, setCollection] = useState<Collection>(() => normalizeCollection(store.load()))
  /** 판정이 읽는 지금 값 — 팝업을 닫고 곧바로 다시 판정할 때 렌더를 기다리지 않는다 */
  const collectionRef = useRef(collection)
  useMirrorRef(collectionRef, collection)
  /** 통계의 지금 값 — 한 틀에 사건이 여럿 와도 문턱을 더한 뒤 값으로 본다 */
  const statsRef = useRef(collection.stats)
  useMirrorRef(statsRef, collection.stats)
  const announceRef = useRef(announceHiddenOpen)
  useMirrorRef(announceRef, announceHiddenOpen)
  /** 이번 렌더 전에 이미 연 k — 같은 틀에 두 번 불려도 창을 한 번만 띄운다 */
  const openingRef = useRef<Set<number>>(new Set())

  // 투수편 칭호 — 0xa40e0 이 투수편 기록연감 비트(+0xec)에 켠다
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 다른 세션 값을 전역기록에 합치는 것은 커밋 뒤(옛 때) — 지난 그림 기록연감을 읽는 곳(미션 명전 · 히든 판정)의 차례가 그대로다
    setCollection((previous) => mergeTitlesIntoCollection(previous, pitcherTitleIds))
  }, [pitcherTitleIds])

  // 시즌 엔딩 — 새 해 0x6e0c 가 엔딩으로 갈 때 전역기록 +0xa0+e = 1
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 다른 세션 값을 전역기록에 합치는 것은 커밋 뒤(옛 때) — 지난 그림 기록연감을 읽는 곳(미션 명전 · 히든 판정)의 차례가 그대로다
    setCollection((previous) => mergeSeasonEndingIntoCollection(previous, seasonEndingIndex))
  }, [seasonEndingIndex])

  useEffect(() => {
    if (career === null) return
    // oxlint-disable-next-line react/set-state-in-effect -- 다른 세션 값을 전역기록에 합치는 것은 커밋 뒤(옛 때) — 지난 그림 기록연감을 읽는 곳(미션 명전 · 히든 판정)의 차례가 그대로다
    setCollection((previous) => mergeCareerIntoCollection(previous, career))
  }, [career])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 다른 세션 값을 전역기록에 합치는 것은 커밋 뒤(옛 때) — 지난 그림 기록연감을 읽는 곳(미션 명전 · 히든 판정)의 차례가 그대로다
    setCollection((previous) => mergeOpenedHiddenIds(previous, pitcherOpenedHiddenIds))
  }, [pitcherOpenedHiddenIds])

  const { endingIndex: pitcherEndingIndex, seenEventIds: pitcherSeenEventIds } = pitcherEndingKeysOf(pitcherEnding)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- 다른 세션 값을 전역기록에 합치는 것은 커밋 뒤(옛 때) — 지난 그림 기록연감을 읽는 곳(미션 명전 · 히든 판정)의 차례가 그대로다
    setCollection((previous) => mergeEndingIntoCollection(previous, { endingIndex: pitcherEndingIndex, seenEventIds: pitcherSeenEventIds }))
  }, [pitcherEndingIndex, pitcherSeenEventIds])

  useEffect(() => {
    store.save(collection)
  }, [collection, store])

  const { register, registerPitcher, deleteHallOfFamer, syncSeasonHallOfFameEquipment, syncSeasonHallOfFameRecruit } = useHallOfFameEdits(
    collection,
    setCollection,
  )
  const { openHiddenQuietly, openHidden, recordSeasonRegularWin } = useHiddenOpen({ collectionRef, openingRef, announceRef, setCollection })
  const { readStats, recordStat, claimCollectionReward } = useAnnalsStats({ statsRef, collectionRef, setCollection, openHidden })

  return {
    collection,
    register,
    registerPitcher,
    deleteHallOfFamer,
    syncSeasonHallOfFameEquipment,
    syncSeasonHallOfFameRecruit,
    recordStat,
    claimCollectionReward,
    openHidden,
    openHiddenQuietly,
    recordSeasonRegularWin,
    /** 기록달성 누계 해금 0x62234 가 문턱에 견주는 지금 통계 (렌더를 기다리지 않는다) */
    readStats,
  }
}

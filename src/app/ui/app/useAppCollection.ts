import { useEffect, useMemo } from 'react'
import { useCollection } from '@/app/model/useCollection'
import { isEveryMissionCleared } from '@/entities/mission/model/missionGoal'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import type { AfterCareerAndMission } from '@/app/ui/app/useAppCareerAndMission'
import { pitcherOpenedHiddenIdsOf, seasonEndingIndexOf, regularSeasonFirstsOf } from '@/app/ui/app/appDerivations'

/** 기록연감 — 두 편 · 시즌이 연 히든 · 엔딩을 모으고, 세션보다 늦게 선 콜백 칸을 채운다 */
export function useAppCollection(
  app: Pick<
    AfterCareerAndMission,
    | 'collectionStore'
    | 'recordStatRef'
    | 'hiddenOpenNotice'
    | 'hallOfFameForMissionRef'
    | 'recordSeasonRegularWinRef'
    | 'openHiddenRef'
    | 'autobotBatInputRef'
    | 'otherModesRef'
    | 'seasonSession'
    | 'pitcherSession'
    | 'careerSession'
    | 'mission'
  >,
) {
  const {
    collectionStore,
    recordStatRef,
    hiddenOpenNotice,
    hallOfFameForMissionRef,
    recordSeasonRegularWinRef,
    openHiddenRef,
    autobotBatInputRef,
    otherModesRef,
    seasonSession,
    pitcherSession,
    careerSession,
    mission,
  } = app
  // 투수편이 연 히든(장비 컬렉터 20·24·28·32)도 같은 전역 표 `app+0xc0` 에 모은다 (0x62368)
  // 시즌 결산이 연 전역 해금(0x29)도 같은 전역 표에 모은다
  // 컬렉터는 0x14a74 구매가 쓴 칸 — 옛 투수편 커리어는 비어 있을 수 있어 보유에서 다시 센다 (`pitcherCollectorHiddenIdsOf`)
  const pitcherCareerForHidden = pitcherSession.career
  const seasonOpenedHiddenIds = seasonSession.openedHiddenIds
  const sharedOpenedHiddenIds = useMemo(
    () => [...pitcherOpenedHiddenIdsOf(pitcherCareerForHidden), ...seasonOpenedHiddenIds],
    [pitcherCareerForHidden, seasonOpenedHiddenIds],
  )
  // 시즌 엔딩 — 새 해 0x6e0c 가 판정 0xa3084 ≥ 0 으로 phase 6(엔딩)을 세우는 그 자리에서 전역기록 +0xa0+e = 1
  const seasonEndingIndex = seasonEndingIndexOf(seasonSession.state)
  const everyMissionCleared = isEveryMissionCleared(mission.clearedKeys)
  const collection = useCollection(
    collectionStore,
    careerSession.career,
    sharedOpenedHiddenIds,
    // 엔딩 적재 0x87c7c 는 두 편 공용 — 투수편 엔딩·연애 엔딩도 기록연감 칸에 켠다
    pitcherSession.career,
    // 투수편 칭호도 기록연감 칭호 칸(투수편 비트 +0xec)에 켠다 (0xa40e0)
    pitcherSession.career?.titleIds,
    seasonEndingIndex,
    // 0x62368 의 알림 창 — 플레이 시간 히든 31 · 47 (0x4e8b0)
    hiddenOpenNotice.announce,
  )
  const { recordStat: recordCollectionStat, openHidden: openCollectionHidden } = collection
  useMirrorRef(hallOfFameForMissionRef, collection.collection)
  const { pitcherEditionFirsts, batterEditionFirsts, seasonModeFirstCount } = regularSeasonFirstsOf(pitcherSession, careerSession, seasonSession)
  useMirrorRef(autobotBatInputRef, {
    pitcherEditionFirsts,
    batterEditionFirsts,
    globalOpenedHiddenIds: collection.collection.openedHiddenIds,
  })
  useMirrorRef(otherModesRef, {
    batter: {
      otherLeagueFirstCount: pitcherEditionFirsts,
      seasonModeFirstCount,
      globalOpenedHiddenIds: collection.collection.openedHiddenIds,
    },
    pitcher: {
      otherLeagueFirstCount: batterEditionFirsts,
      seasonModeFirstCount,
      globalOpenedHiddenIds: collection.collection.openedHiddenIds,
    },
  })
  useEffect(() => {
    recordStatRef.current = recordCollectionStat
    openHiddenRef.current = openCollectionHidden
    recordSeasonRegularWinRef.current = collection.recordSeasonRegularWin
    // ref 상자는 앞 훅이 만든 같은 상자다 — 바뀌지 않는다
  }, [recordCollectionStat, openCollectionHidden, collection.recordSeasonRegularWin, recordStatRef, openHiddenRef, recordSeasonRegularWinRef])
  // 히든 오픈은 원본에서 전역 저장이라 선수에게도 알려 준다 (상점이 선수 기록으로 판정한다)
  const { syncOpenedHidden } = careerSession.actions
  const openedHiddenIds = collection.collection.openedHiddenIds
  useEffect(() => syncOpenedHidden(openedHiddenIds), [syncOpenedHidden, openedHiddenIds])
  return {
    pitcherCareerForHidden,
    seasonOpenedHiddenIds,
    sharedOpenedHiddenIds,
    seasonEndingIndex,
    everyMissionCleared,
    collection,
    pitcherEditionFirsts,
    batterEditionFirsts,
    seasonModeFirstCount,
    openedHiddenIds,
    recordCollectionStat,
    openCollectionHidden,
    syncOpenedHidden,
  }
}

/** 이 훅까지 선 앱 칸 */
export type AfterCollection = AfterCareerAndMission & ReturnType<typeof useAppCollection>

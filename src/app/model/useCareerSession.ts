import { useMemo } from 'react'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { useStorySchedule } from '@/app/model/useStorySchedule'
import { type CareerSessionInput, careerSessionArgsOf } from '@/app/model/careerSession/hook/sessionInput'
import { useCareerAtoms, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { storySetUpMirrorAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { useCareerMirrors } from '@/app/model/careerSession/state/useCareerMirrors'
import { useSceneSetUpOutings } from '@/app/model/careerSession/state/useSceneSetUp'
import { useEquippedSkillStat, useRunningModeSync } from '@/app/model/careerSession/state/useCareerStateEffects'
import { useCareerSaveEffect } from '@/app/model/careerSession/save/useCareerSaveEffect'
import { useWalletBridge } from '@/app/model/careerSession/state/useWalletBridge'
import { usePitchResolved } from '@/app/model/careerSession/game/usePitchResolved'
import { useGameEndHeldByBurst } from '@/app/model/careerSession/game/useGameEndHeldByBurst'
import { useOutingSlots } from '@/app/model/careerSession/outing/useOutingSlots'
import { useManagementEntry } from '@/app/model/careerSession/management/useManagementEntry'
import { useManagementEntryEffects } from '@/app/model/careerSession/management/useManagementEntryEffects'
import { useAceMatchResultEffect } from '@/app/model/careerSession/events/useAceMatchResultEffect'
import { useCareerView } from '@/app/model/careerSession/hook/useCareerView'
import { useCareerActions } from '@/app/model/careerSession/hook/useCareerActions'

export { isEvaluatedGame, shownGameEvaluationOf, applyGameEvaluation } from '@/app/model/careerSession/settlement/gameEvaluation'

/**
 * 육성 모드 한 판 — 커리어·경기 진행·관리 커맨드를 한데 묶는다.
 *
 * 세션 상태는 이 세션의 atom store 에 있다(`careerSession/atoms`) — 하위 훅은 store 와 매개변수만 받아 필요한 atom 을 직접
 * 읽고 쓴다. effect 차례(장면 셋업 외출 칸 → 주루 설정 → 켠 스킬 통계 → 저장 → 지갑 다리 → 돌발 뒤 정산 → 이벤트 본문 →
 * 반복 이벤트 지움 → 105 진입 → 140 대결 결과)는 옛 훅 차례 그대로다.
 */
export function useCareerSession(input: CareerSessionInput) {
  // 통로를 안 받으면 조용한 포트로 — 하위 훅이 `sound` 가 있는지 매번 보지 않게 한다
  const silent = useMemo(() => createSilentSound(), [])
  const args = careerSessionArgsOf(input, silent)
  const scope = { ...args, atoms: useCareerAtoms(args) }
  const career = useShownCareer(scope)
  useCareerMirrors(scope, career)
  useSceneSetUpOutings(scope)
  useRunningModeSync(scope)
  useEquippedSkillStat(scope)
  useCareerSaveEffect(scope)
  useWalletBridge(scope)
  const { handlePitchResolved, preRollContact } = usePitchResolved(scope)
  useGameEndHeldByBurst(scope)
  // 이벤트 일정은 세션에 하나 — 장면 셋업(커서 0 · mgr+0x304 = 1)을 상자로 이어 `setUpNariScene` 이 부른다
  const story = useStorySchedule(career)
  useMirrorRef(useCareerValue(scope.atoms, storySetUpMirrorAtom), story.setUpScene)
  const storyScope = { ...scope, story }
  const outing = useOutingSlots(storyScope)
  const entry = useManagementEntry(storyScope)
  useManagementEntryEffects(storyScope, entry)
  useAceMatchResultEffect(storyScope)
  const actions = useCareerActions(storyScope, outing, entry)
  const { savedCareer, ...view } = useCareerView(scope)
  const { progress, shopNotice, isYearCoverHeld, shopGpDetail, outingNotice, outingResult, outingPresentation, managementNotice, managementDetail } =
    view
  return {
    savedCareer,
    career,
    progress,
    shopNotice,
    isYearCoverHeld,
    shopGpDetail,
    outingNotice,
    outingResult,
    outingPresentation,
    managementNotice,
    managementDetail,
    pendingTitle: entry.pendingTitle,
    loadingTip: view.loadingTip,
    stadiumSkyRow: view.stadiumSkyRow,
    sceneStadium: view.sceneStadium,
    matchInfoStage: view.matchInfoStage,
    matchAces: view.matchAces,
    entryView: view.entryView,
    storyEvents: outing.storyEvents,
    eventPlaceIds: outing.eventPlaceIds,
    handlePitchResolved,
    preRollContact,
    actions,
  }
}

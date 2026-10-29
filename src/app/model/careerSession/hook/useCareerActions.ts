import type { CareerStoryScope } from '@/app/model/careerSession/atoms/careerScope'
import type { ManagementEntry } from '@/app/model/careerSession/management/useManagementEntry'
import type { useOutingSlots } from '@/app/model/careerSession/outing/useOutingSlots'
import { useHitByPitchActions } from '@/app/model/careerSession/game/useHitByPitchActions'
import { useFinishDefensePlay } from '@/app/model/careerSession/game/useFinishDefensePlay'
import { gameEndHostActionsOf } from '@/app/model/careerSession/game/gameEndHostActions'
import { useRunnerPlayActions } from '@/app/model/careerSession/game/useRunnerPlayActions'
import { gameExitActionsOf } from '@/app/model/careerSession/game/gameExitActions'
import { useCareerLifecycleActions } from '@/app/model/careerSession/save/useCareerLifecycleActions'
import { useContinueActions } from '@/app/model/careerSession/save/useContinueActions'
import { useRunCommand } from '@/app/model/careerSession/management/useRunCommand'
import { useShopActions } from '@/app/model/careerSession/management/useShopActions'
import { useCareerEditActions } from '@/app/model/careerSession/management/useCareerEditActions'
import { useTrainingActions } from '@/app/model/careerSession/management/useTrainingActions'
import { useGameResultActions } from '@/app/model/careerSession/settlement/useGameResultActions'
import { useNextGameActions } from '@/app/model/careerSession/nextGame/useNextGameActions'
import { useOutingActions } from '@/app/model/careerSession/outing/useOutingActions'
import { useEventActions } from '@/app/model/careerSession/events/useEventActions'
import { useCompleteScene } from '@/app/model/careerSession/events/useCompleteScene'
import { usePostseasonActions } from '@/app/model/careerSession/seasonEnd/usePostseasonActions'
import { useNationalCupActions } from '@/app/model/careerSession/nationalCup/useNationalCupActions'
import { useEndingActions } from '@/app/model/careerSession/seasonEnd/useEndingActions'

/**
 * 세션 액션 묶음 — 의미 단위 하위 훅을 모은다. 상태는 atom 에 있으니 하위 훅이 같은 작은 훅(`useEndGame` 따위)을 따로 불러도
 * 칸은 하나다. 이 훅들은 effect 를 두지 않는다(effect 는 세션 훅 머리에서 옛 차례대로 한 번씩).
 */
export function useCareerActions(
  scope: CareerStoryScope,
  outing: Pick<ReturnType<typeof useOutingSlots>, 'outingSlots' | 'storyEvents'>,
  entry: ManagementEntry,
) {
  const finishDefensePlay = useFinishDefensePlay(scope)
  const { closeBurstResult, ...gameExit } = gameExitActionsOf(scope)
  const { syncOpenedHidden, ...events } = useEventActions(scope, outing)
  return {
    syncOpenedHidden,
    ...useHitByPitchActions(scope),
    /** 수비 화면이 끝났다 — 주자 처리를 이제 먹인다 */
    finishDefensePlay,
    ...gameEndHostActionsOf(scope.atoms),
    ...useRunnerPlayActions(scope),
    closeBurstResult,
    ...useCareerLifecycleActions(scope),
    ...useContinueActions(scope),
    runCommand: useRunCommand(scope),
    ...useShopActions(scope),
    ...useCareerEditActions(scope, entry),
    ...useGameResultActions(scope),
    ...useNextGameActions(scope),
    ...useTrainingActions(scope),
    ...useOutingActions(scope, outing),
    ...events,
    completeScene: useCompleteScene(scope),
    ...gameExit,
    ...usePostseasonActions(scope),
    ...useNationalCupActions(scope),
    ...useEndingActions(scope),
  }
}

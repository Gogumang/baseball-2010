import type { OutingPlaceSlots } from '@/pages/outing-map/lib/outingPlaceSlots'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import type { PitcherLeagueActions } from '@/app/model/pitcherLeagueSession/types/actions'
import { useLifecycleActions } from '@/app/model/pitcherLeagueSession/save/useLifecycleActions'
import { useManagementActions } from '@/app/model/pitcherLeagueSession/management/useManagementActions'
import { useShopActions } from '@/app/model/pitcherLeagueSession/management/useShopActions'
import { useBeginGame } from '@/app/model/pitcherLeagueSession/game/useBeginGame'
import { useResumeInterruptedGame } from '@/app/model/pitcherLeagueSession/game/useResumeInterruptedGame'
import { useNextGameActions } from '@/app/model/pitcherLeagueSession/nextGame/useNextGameActions'
import { useFinishGame } from '@/app/model/pitcherLeagueSession/settlement/useFinishGame'
import { useGameResultActions } from '@/app/model/pitcherLeagueSession/settlement/useGameResultActions'
import { useEndingActions } from '@/app/model/pitcherLeagueSession/seasonEnd/useEndingActions'
import { useEnterHeldYearCover } from '@/app/model/pitcherLeagueSession/seasonEnd/useStartNewSeason'
import { usePostseasonActions } from '@/app/model/pitcherLeagueSession/seasonEnd/usePostseasonActions'
import { useNationalCupActions } from '@/app/model/pitcherLeagueSession/nationalCup/useNationalCupActions'
import { useOutingActions } from '@/app/model/pitcherLeagueSession/outing/useOutingActions'
import { useStoryRewardActions } from '@/app/model/pitcherLeagueSession/events/useStoryRewardActions'
import { useCompleteStory } from '@/app/model/pitcherLeagueSession/events/useCompleteStory'
import { useAceMatchActions } from '@/app/model/pitcherLeagueSession/events/useAceMatchActions'

/**
 * 세션 액션 묶음 — 의미 단위 하위 훅을 모은다. 상태는 atom 에 있으니 하위 훅이 같은 작은 훅(`useStartNewSeason` 따위)을 따로
 * 불러도 칸은 하나다. 이 훅들은 effect 를 두지 않는다(effect 는 세션 훅 머리에서 옛 차례대로 한 번씩).
 */
export function usePitcherActions(scope: PitcherScope, outingSlots: OutingPlaceSlots): PitcherLeagueActions {
  const beginGame = useBeginGame(scope)
  return {
    ...useLifecycleActions(scope),
    ...useManagementActions(scope),
    ...useAceMatchActions(scope),
    beginGame: () => beginGame(),
    resumeInterruptedGame: useResumeInterruptedGame(scope),
    ...useNextGameActions(scope),
    finishGame: useFinishGame(scope),
    ...useGameResultActions(scope),
    ...useEndingActions(scope),
    enterHeldYearCover: useEnterHeldYearCover(scope),
    ...useShopActions(scope),
    ...useOutingActions(scope, outingSlots),
    ...useStoryRewardActions(scope),
    completeStory: useCompleteStory(scope),
    ...usePostseasonActions(scope),
    ...useNationalCupActions(scope),
  }
}

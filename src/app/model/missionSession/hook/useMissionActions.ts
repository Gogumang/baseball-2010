import type { HallOfFamePlayerPick } from '@/entities/collection/model/collection'
import type { MissionPlayScope } from '@/app/model/missionSession/atoms/missionScope'
import { lastSideAtom, playerAtom } from '@/app/model/missionSession/atoms/recordAtoms'
import { pickoffReplayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { batterSpecialSwingStoredAtom } from '@/app/model/missionSession/atoms/pitcherAtoms'
import { useSceneFlowActions } from '@/app/model/missionSession/scene/useSceneFlowActions'
import { useFinishDefensePlay } from '@/app/model/missionSession/defense/useFinishDefensePlay'
import { finishRunnerPlayOf } from '@/app/model/missionSession/defense/finishRunnerPlay'
import { useBenchClearingActions } from '@/app/model/missionSession/held/useBenchClearingActions'
import { useBeginActions } from '@/app/model/missionSession/lifecycle/useBeginActions'
import { useEndActions } from '@/app/model/missionSession/lifecycle/useEndActions'
import { useBatterKeyActions } from '@/app/model/missionSession/batter/useBatterKeyActions'
import { usePitcherKeyActions } from '@/app/model/missionSession/pitcher/usePitcherKeyActions'

/**
 * 세션 액션 묶음 — 의미 단위 하위 훅을 모은다(키 차례는 옛 `actions` 그대로). 상태는 atom 에 있으니 하위 훅이 같은 작은 훅
 * (`useAskPitchSelection` 따위)을 따로 불러도 칸은 하나다. 이 훅들은 effect 를 두지 않는다(effect 는 세션 훅 머리에서 옛 차례대로).
 */
export function useMissionActions(scope: MissionPlayScope) {
  const { atoms, pick } = scope
  const { finishLoading, confirmHalfInningBoard } = useSceneFlowActions(scope)
  const benchClearing = useBenchClearingActions(scope)
  const { begin, beginAceMatch, beginPitcherAceMatch } = useBeginActions(scope)
  const { finishPitcherAceMatch, finishAceMatch, ...ends } = useEndActions(scope, begin)
  const { cpuPickoff, steal } = useBatterKeyActions(scope)
  const { pickoff } = usePitcherKeyActions(scope)
  return {
    finishLoading,
    /** 수비 화면이 끝났다 — 진루·아웃·실점을 이제 먹인다 */
    finishDefensePlay: useFinishDefensePlay(scope),
    confirmHalfInningBoard,
    /** 타자 미션의 필살 스윙이 나갔다 (0x4e136) — `BattingStage` 의 `onSpecialSwingUsed`, 인자는 줄인 뒤 남은 횟수 */
    specialSwingUsed: (remaining: number) => atoms.set(batterSpecialSwingStoredAtom, remaining),
    ...benchClearing,
    /**
     * 선수 고르기 결과 1~4 (0x29a54 → 표 0xcec00): 투수(1·3)면 모드 5, 타자(2·4)면 모드 6 — 그 편의 미션 목록으로 간다.
     */
    choosePlayer: (choice: HallOfFamePlayerPick) => {
      atoms.set(playerAtom, { pick: choice, epoch: pick.epoch })
      atoms.set(lastSideAtom, choice.side)
    },
    /**
     * 미션 목록(장면 0x107)의 CLR 0x1e8d0 — `[0x140006c] = 0x11` · 장면 0x103 → 생성자 0x234d4 가 하위 17(선수 고르기)을 다시 연다.
     * 고른 선수를 내려 고르기 창부터 다시 띄운다
     */
    returnToPlayerPick: () => atoms.set(playerAtom, null),
    begin,
    beginAceMatch,
    beginPitcherAceMatch,
    finishPitcherAceMatch,
    finishAceMatch,
    cpuPickoff,
    finishRunnerPlay: finishRunnerPlayOf(scope),
    pickoff,
    /** 견제 판 재생이 끝났다 */
    finishPickoffReplay: () => atoms.set(pickoffReplayAtom, null),
    steal,
    ...ends,
  }
}

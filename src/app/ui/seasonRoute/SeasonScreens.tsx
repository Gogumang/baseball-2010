import { MessageBox, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { FRESH_SEASON_INFO_RECORD, seasonNameInfoRowsOf } from '@/pages/season'
import { SeasonTeamSelectScreen } from '@/pages/season/ui/SeasonTeamSelectScreen'
import { seasonTeamRankOf } from '@/app/model/useSeasonSession'
import type { SeasonRouteProps } from '@/app/ui/seasonRoute/seasonRouteProps'
import { useSeasonRouteState } from '@/app/ui/seasonRoute/useSeasonRouteState'
import { useSeasonSceneEntry } from '@/app/ui/seasonRoute/useSeasonSceneEntry'
import { seasonBranchInputOf } from '@/app/ui/seasonRoute/branchInput'
import { seasonBranchScreenOf } from '@/app/ui/seasonRoute/seasonBranches'

/**
 * 시즌 모드 라우팅 (원본 장면 0x105).
 *
 * 어느 화면 다음에 무엇이 오는지는 `entities/season-mode` 의 상태 기계가 정하고,
 * 여기서는 그 장면 번호에 맞는 화면을 고르기만 한다 (`seasonBranches`).
 *
 * 시즌 상태는 모두 갈래가 있다 — 갈래가 기다리는 재료가 아직 없는 틀만 아무것도 안 그린다(맨 끝).
 */
export function SeasonScreens(props: SeasonRouteProps) {
  const { session, onExit, hallOfFame } = props
  const { state, scene, league, series, notice, actions } = session
  const routeState = useSeasonRouteState(session)
  const isEnteringGame = useSeasonSceneEntry(session)
  if (isEnteringGame) return null

  if (notice !== '') {
    return (
      <RawScreen>
        <MessageBox text={notice} buttons={['OK']} onAnswer={actions.clearNotice} />
      </RawScreen>
    )
  }

  // 저장이 없으면 팀 고르기부터다 (0xca, 키 0x8da4) → 이름 입력 0xc8 → [2] 예 → 새 시즌(0xcc).
  // 열린 히든 팀(전역 +0x70)은 그림만 서고 힌트 팝업을 띄운다.
  // 취소는 관리 메뉴 취소와 같이 [0x140006c] = 5 로 메인 메뉴에 나간다 (0x8ec8)
  if (state === null || scene === SEASON_SCENE_STATE.팀고르기) {
    return (
      <SeasonTeamSelectScreen
        openedHiddenIds={hallOfFame?.openedHiddenIds ?? []}
        gamePoint={session.gamePoints}
        onChoose={actions.chooseTeam}
        onExit={() => onExit(5)}
        // 0xc8 정보 칸 — SR 은 0xcc 초기화 전 버퍼(시즌 저장이 있으면 그 레코드, 없으면 막 만든 SR), 타입은 고른 팀 마스터 레코드,
        // 순위는 SR[1] = 고른 팀(b9ee)의 0xb7aa1(SR+0x80, 팀, 0) — 경기 수 0 이면 안 쓴다
        nameInfoRowsOf={(teamId) =>
          seasonNameInfoRowsOf({
            record: state?.record ?? FRESH_SEASON_INFO_RECORD,
            teamAbilities: TEAMS[teamId]?.values.slice(2) ?? [],
            rank: state === null ? 0 : seasonTeamRankOf({ state, league, series }, teamId),
          })
        }
      />
    )
  }

  return seasonBranchScreenOf(seasonBranchInputOf(props, routeState, state))
}

import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonGoalInputOf } from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import type { SeasonRouteProps } from '@/app/ui/seasonRoute/seasonRouteProps'
import type { SeasonRouteState } from '@/app/ui/seasonRoute/useSeasonRouteState'

type SeasonState = NonNullable<SeasonSession['state']>
type GoalSource = Parameters<typeof seasonGoalInputOf>[0]

/** 장면 갈래 하나가 그리는 데 쓰는 재료 — 라우트 props · 세션 · 라우트 칸 · 갈래들이 함께 쓰는 계산 */
export interface SeasonBranchInput extends Omit<SeasonRouteProps, 'session'>, SeasonRouteState {
  readonly session: SeasonSession
  readonly scene: SeasonSession['scene']
  /** 저장이 있는 시즌 — 없으면 팀 고르기가 먼저 받는다 */
  readonly state: SeasonState
  readonly actions: SeasonSession['actions']
  readonly league: SeasonSession['league']
  readonly roster: SeasonSession['roster']
  readonly playerStats: SeasonSession['playerStats']
  readonly series: SeasonSession['series']
  readonly cup: SeasonSession['cup']
  readonly gameOptions: SeasonSession['gameOptions']
  readonly backToManagement: () => void
  readonly backToTeamMenu: () => void
  readonly goalSource: GoalSource
  readonly goalInput: ReturnType<typeof seasonGoalInputOf>
  /** 시상 순위표의 재료 — 시상 화면에서만 만든다(명전 기록을 그때 읽는다) */
  readonly leagueRecordSourceOf: () => {
    readonly league: SeasonSession['league']
    readonly myTeamId: number
    readonly roster: SeasonSession['roster']
    readonly cpuRosterOf: SeasonSession['cpuRosterOf']
    readonly playerStats: SeasonSession['playerStats']
    readonly recordOf?: NonNullable<ReturnType<SeasonSession['recordSource']>>
  }
}

/**
 * 갈래 재료를 모은다 — 목표 판정 0xa37bc 의 다섯 칸은 팀정보 순위와 목표 창(SYS sub 1)이 같은 재료를 본다.
 * 영입한 명전 선수의 기록(recordSource)도 세션 판정(392)과 같이 넘긴다 — 그 칸의 줄을 같은 열쇠로 센다
 */
export function seasonBranchInputOf(props: SeasonRouteProps, routeState: SeasonRouteState, state: SeasonState): SeasonBranchInput {
  const { session } = props
  const { scene, league, roster, playerStats, series, cup, gameOptions, actions } = session
  const goalRecordOf = session.recordSource()
  const goalSource = {
    state,
    league,
    roster,
    playerStats,
    series,
    ...(goalRecordOf === undefined ? {} : { recordOf: goalRecordOf }),
    // 레코드에 남은 마투수 — 목표 ④ 0xa3764 가 거르지 않고 센다 (U-105 r163)
    recordAces: session.myRecordAces,
  }
  const goalInput = seasonGoalInputOf(goalSource)
  const leagueRecordSourceOf = () => {
    const recordOf = session.recordSource()
    return {
      league,
      myTeamId: state.record.teamId,
      roster,
      cpuRosterOf: session.cpuRosterOf,
      playerStats,
      ...(recordOf === undefined ? {} : { recordOf }),
    }
  }
  return {
    ...props,
    ...routeState,
    scene,
    state,
    actions,
    league,
    roster,
    playerStats,
    series,
    cup,
    gameOptions,
    backToManagement: () => actions.goto(SEASON_SCENE_STATE.관리메뉴),
    backToTeamMenu: () => actions.goto(SEASON_SCENE_STATE.구단관리),
    goalSource,
    goalInput,
    leagueRecordSourceOf,
  }
}

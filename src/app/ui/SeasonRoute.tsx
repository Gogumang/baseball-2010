import { useMemo } from 'react'
import {
  GameIncomeScreen, PlayerRecruitScreen, SeasonGoalsScreen, SeasonManagementScreen,
  SeasonTeamMenuScreen, StadiumShopScreen,
} from '@/pages/season'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { MessageBox, RawScreen } from '@/shared/ui'
import { SEASON_SCENE_STATE, seasonOpponentOf } from '@/entities/season-mode/model/seasonStateMachine'
import { TEAMS } from '@/shared/config/original/teams'
import { seasonRanksOf } from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'

interface SeasonRouteProps {
  readonly session: SeasonSession
  /** 시즌모드에서 나간다 — 메인 메뉴로 (원본은 `0xbc290(앱, 0x103)`) */
  readonly onExit: () => void
}

/**
 * 시즌 모드 라우팅 (원본 장면 0x105).
 *
 * 어느 화면 다음에 무엇이 오는지는 `entities/season-mode` 의 상태 기계가 정하고,
 * 여기서는 그 장면 번호에 맞는 화면을 고르기만 한다.
 *
 * **아직 화면이 없는 장면**(트레이닝 0xcf · 외출 0xd1 · 아이템 0xd0 · 트레이드 0xe4 ·
 * 선수단/코치채용 0xd7 · 포스트시즌·시상·결산·엔딩)은 알림을 띄우고 관리 메뉴로 되돌린다 —
 * 조용히 아무것도 안 하는 것보다 낫다.
 */
export function SeasonRoute({ session, onExit }: SeasonRouteProps) {
  const { state, scene, league, roster, notice, actions } = session

  const ranks = useMemo(
    () => (state === null ? { myRank: 0, opponentRank: 0 } : seasonRanksOf(league, state.record)),
    [league, state],
  )

  if (notice !== '') {
    return (
      <RawScreen>
        <MessageBox text={notice} buttons={['OK']} onAnswer={actions.clearNotice} />
      </RawScreen>
    )
  }

  // 저장이 없으면 팀 고르기부터다 (0xca). 팀 고르기 화면은 선수 등록 쪽 것을 그대로 쓴다
  if (state === null || scene === SEASON_SCENE_STATE.팀고르기) {
    return <TeamSelectScreen onSelect={actions.chooseTeam} onCancel={onExit} />
  }

  const backToManagement = () => actions.goto(SEASON_SCENE_STATE.관리메뉴)
  const backToTeamMenu = () => actions.goto(SEASON_SCENE_STATE.구단관리)

  if (scene === SEASON_SCENE_STATE.관리메뉴) {
    return (
      <SeasonManagementScreen
        state={state}
        onSelect={(item, target) => {
          if (item === '다음경기') return actions.playNextGame()
          actions.goto(target)
        }}
        onExit={onExit}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.구단관리) {
    return <SeasonTeamMenuScreen state={state} onSelect={(_item, target) => actions.goto(target)} onBack={backToManagement} />
  }

  if (scene === SEASON_SCENE_STATE.구장관리 || scene === SEASON_SCENE_STATE.아이템상점) {
    return (
      <StadiumShopScreen
        record={state.record}
        teamMorale={state.teamMorale}
        mode={scene === SEASON_SCENE_STATE.구장관리 ? '구장관리' : '상점'}
        onChange={actions.updateRecord}
        onBack={scene === SEASON_SCENE_STATE.구장관리 ? backToTeamMenu : backToManagement}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.선수영입 || scene === SEASON_SCENE_STATE.선수고르기) {
    return (
      <PlayerRecruitScreen
        roster={roster}
        // 영입 후보는 나만의리그 선수·명예의 전당에서 온다. 웹은 아직 그 둘을 시즌모드로
        // 넘기지 않아 빈 목록이다 — 후보가 생기면 여기만 채우면 된다
        list={{ careerPitcher: null, careerBatter: null, hallOfFamePitchers: [], hallOfFameBatters: [] }}
        onRecruit={(result) => {
          // 원본은 밀려난 선수를 빼지 않고 **끼워넣는다** — 그 규칙은 recruitPlayer 안에 있다
          actions.updateRoster(result.roster)
          backToTeamMenu()
        }}
        onBack={backToTeamMenu}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.시즌정보) {
    const wins = league.wins[state.record.teamId] ?? 0
    const losses = league.losses[state.record.teamId] ?? 0
    return (
      <SeasonGoalsScreen
        yearIndex={state.record.yearIndex}
        input={{
          rank: ranks.myRank,
          wins,
          losses,
          // 팀 타율·방어율은 웹이 아직 팀 단위로 세지 않는다 — 0 으로 두면 목표 ③④ 는 늘 미달이다
          teamBattingAverage: 0,
          teamEarnedRunAverage: 0,
          popularityGain: state.record.popularity - state.record.popularityAtSeasonStart,
        }}
        onBack={backToManagement}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.관중수입) {
    return (
      <GameIncomeScreen
        record={state.record}
        teamMorale={state.teamMorale}
        input={ranks}
        onConfirm={(settlement) => actions.confirmIncome(settlement.record)}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.다음경기) {
    // ⚠️ 다음경기 화면(0xd8 — 상대·선발 소개)은 웹에 아직 없다. 확인 한 번으로 경기를 치른다
    const opponent = TEAMS[seasonOpponentOf(state.record)]?.name ?? ''
    return (
      <RawScreen>
        <MessageBox
          text={`${state.record.games + 1}번째 경기!N상대: ${opponent}`}
          buttons={['OK']}
          onAnswer={actions.playNextGame}
        />
      </RawScreen>
    )
  }

  return (
    <RawScreen>
      <MessageBox
        text={`이 화면은 아직 없습니다 (장면 0x${scene.toString(16)})`}
        buttons={['OK']}
        onAnswer={backToManagement}
      />
    </RawScreen>
  )
}

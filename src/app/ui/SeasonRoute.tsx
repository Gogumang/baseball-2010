import { useMemo } from 'react'
import {
  GameIncomeScreen, PlayerRecruitScreen, PostseasonStartScreen, RegularSeasonRankScreen,
  SeasonGoalsScreen, SeasonItemMenuScreen, SeasonManagementScreen, SeasonMvpScreen,
  SeasonOutingScreen, SeasonSummaryScreen, SeasonTeamMenuScreen, SeasonTitleAwardScreen,
  SeasonTrainingScreen, StadiumShopScreen, SEASON_MVP_LEADER_KINDS,
} from '@/pages/season'
import { judgeTitles, leagueRecordsOf } from '@/entities/awards/model/seasonAwards'
import { leaderOf } from '@/entities/awards/model/leaderboard'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { MessageBox, RawScreen } from '@/shared/ui'
import { SEASON_SCENE_STATE, seasonOpponentOf } from '@/entities/season-mode/model/seasonStateMachine'
import { applySeasonReward } from '@/entities/season-mode/model/seasonRewards'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { TEAMS } from '@/shared/config/original/teams'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { seasonRanksOf } from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'

interface SeasonRouteProps {
  readonly session: SeasonSession
  readonly random: RandomPort
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
export function SeasonRoute({ session, random, onExit }: SeasonRouteProps) {
  const { state, scene, league, roster, playerStats, series, cup, gameOptions, notice, actions } = session

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

  if (scene === SEASON_SCENE_STATE.트레이닝) {
    return (
      <SeasonTrainingScreen
        state={state}
        // G 포인트는 전역 저장(+0x64) 칸이라 시즌 레코드에 없다 — 웹은 아직 시즌 쪽 G 를 안 들고 있어 0 이다
        gamePoints={0}
        onTrain={(_slot, index) => actions.runTraining(index)}
        onBack={backToManagement}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.외출지도) {
    return (
      <SeasonOutingScreen
        state={state}
        outingSubItems={state.record.outingSubItems}
        onRun={(_place, index) => actions.runOuting(index)}
        onBack={backToManagement}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.아이템) {
    return (
      <SeasonItemMenuScreen
        state={state}
        onSelect={(_item, target) => actions.goto(target)}
        onBack={backToManagement}
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

  if (scene === SEASON_SCENE_STATE.국가대항전 && cup !== null) {
    return (
      <NationalCupScreen
        mode="시즌모드"
        cup={cup}
        yearIndex={state.record.yearIndex}
        random={random}
        // ⚠️ 웹판 임시 — 원본은 여기서 사람이 대표팀을 조작해 경기를 친다 (시즌 221)
        onStartGame={(matchup) => actions.playCupGame(matchup.myTeam, matchup.opponent)}
        onFinish={(finish) => actions.finishCup(finish)}
      />
    )
  }

  // ── 시즌 끝 사슬 (0xee → 0xeb → 0xec → 0xed → 0xf0 → 0xef) ──────────────────
  if (scene === SEASON_SCENE_STATE.포스트시즌시작) {
    return <PostseasonStartScreen series={series} onNext={actions.nextSeasonEndStep} />
  }

  if (scene === SEASON_SCENE_STATE.타자시상 || scene === SEASON_SCENE_STATE.투수시상) {
    const isBatter = scene === SEASON_SCENE_STATE.타자시상
    // ⚠️ 시즌모드는 `isMine` 을 "1위 팀 == 내 팀" 으로 본다 (B 4절 2번) — 여기서 그렇게 채운다
    const records = leagueRecordsOf(playerStats).map((record) => ({
      ...record,
      isMine: record.teamId === state.record.teamId,
    }))
    return (
      <SeasonTitleAwardScreen
        role={isBatter ? '타자' : '투수'}
        // 시즌모드 투수는 네 칸이라 역할 이름이 다르다 (다승·삼진·방어·세이브)
        titles={judgeTitles(records, isBatter ? '타자' : '시즌투수')}
        onNext={actions.nextSeasonEndStep}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.최우수선수) {
    const records = leagueRecordsOf(playerStats)
    // 시즌 MVP 는 표 0xd4f34 에서 rand(0..6) 으로 종류 하나를 골라 그 1위를 발표한다 (B-3)
    const kind = SEASON_MVP_LEADER_KINDS[randomIntegerBelow(random, 0, SEASON_MVP_LEADER_KINDS.length)]
    const leader = kind === undefined ? null : leaderOf(records, kind)
    return (
      <SeasonMvpScreen
        winner={leader === null ? null : { name: leader.record.name, teamId: leader.record.teamId }}
        isMine={leader?.record.teamId === state.record.teamId}
        onNext={actions.nextSeasonEndStep}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.정규시즌순위) {
    return (
      <RegularSeasonRankScreen league={league} teamId={state.record.teamId} onNext={actions.nextSeasonEndStep} />
    )
  }

  if (scene === SEASON_SCENE_STATE.시즌결산) {
    return (
      <SeasonSummaryScreen
        record={state.record}
        series={series}
        // 0xb7aa0(리그, 팀, 0) — 0 우승 · 1 준우승(한국시리즈에서 진 팀) · 그 밖은 보상 없음.
        // 웹 entities/league 에 이 함수가 없어 시리즈 결과에서 바로 읽는다
        postseasonRank={postseasonRankOf(series, state.record.teamId)}
        leagueFirstAwardedBits={0}
        onApplyKoreanSeriesReward={(reward) => actions.updateRecord(applySeasonReward(state.record, reward))}
        onLeagueFirstAward={() => undefined}
        onContinuePostseason={actions.continuePostseason}
        onFinish={actions.finishSeason}
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

  // 경기 — 사람이 팀을 조작한다 (모드 2)
  if (scene === SEASON_SCENE_STATE.경기직전 && gameOptions !== null) {
    return (
      <TeamGameScreen
        options={gameOptions}
        random={random}
        onFinish={actions.finishGame}
        onQuit={backToManagement}
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

/**
 * 내 팀의 포스트시즌 순위 — 원본 `0xb7aa0(리그, 팀, 0)` 자리다.
 * **0 우승 · 1 준우승(한국시리즈에서 진 팀)** 이고, 그 밖에는 보상이 붙지 않는다.
 * `entities/league` 에 같은 함수가 없어 시리즈 결과에서 읽는다.
 */
function postseasonRankOf(series: PostseasonSeries | null, teamId: number): number {
  if (series === null || series.round !== '종료') return NO_POSTSEASON_REWARD
  if (series.champion === teamId) return 0
  return series.teams.includes(teamId) ? 1 : NO_POSTSEASON_REWARD
}

/** 우승도 준우승도 아닐 때 넘기는 값 — 결산 화면이 보상을 붙이지 않는다 */
const NO_POSTSEASON_REWARD = 2

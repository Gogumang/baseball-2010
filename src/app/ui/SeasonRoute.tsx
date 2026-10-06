import { useMemo, useState } from 'react'
import { ITEM_WINDOW_KIND } from '@/widgets/season/lib/seasonItemMenu'
import type { ItemWindowKind } from '@/widgets/season/lib/seasonItemMenu'
import {
  GameIncomeScreen, NextGameScreen, PlayerRecruitScreen,
  SeasonEndingScreen, SeasonGoalsScreen, SeasonItemMenuScreen, SeasonManagementScreen, SeasonMvpScreen,
  SeasonOutingScreen, SeasonSummaryScreen, SeasonTeamMenuScreen, SeasonTitleAwardScreen,
  SeasonTrainingScreen, StadiumShopScreen, TradeScreen, CoachHireScreen, SEASON_MVP_LEADER_KINDS,
  seasonAwardRewardOf, seasonMvpResultEventId, seasonTitleResultEventId,
  SeasonMatchInfoScreen, seasonMatchInfoLines,
} from '@/pages/season'
import { AceSelectScreen } from '@/pages/general-mode'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { TEAMS } from '@/shared/config/original/teams'
import {
  DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS,
} from '@/pages/general-mode/lib/generalModeSetup'
import { MatchSettingsWindow } from '@/pages/match-settings'
import { SQUAD_PURPOSE } from '@/entities/season-mode/model/preGameFlow'
import { judgeTitles, leagueRecordsOf } from '@/entities/awards/model/seasonAwards'
import { leaderOf } from '@/entities/awards/model/leaderboard'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { MessageBox, RawScreen, ScreenOverlay } from '@/shared/ui'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { SEASON_GOAL_WINDOW_SUB, SEASON_PLAYABLE_EVENTS } from '@/entities/season-mode/model/seasonEventFlow'
import { seasonGoalWindowText } from '@/pages/season/lib/seasonGoalLines'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { applySeasonReward, judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'
import { seasonGoalInputOf, seasonRanksOf } from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import { seasonStadiumOf } from '@/entities/season-mode/model/stadiumItems'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { HALL_OF_FAME_MAX_BATTERS, HALL_OF_FAME_MAX_PITCHERS } from '@/entities/collection/model/collection'
import type { Collection } from '@/entities/collection/model/collection'
import { HALL_OF_FAME_FIRST_ID } from '@/entities/season-mode/model/playerRecruit'
import type { RecruitCandidate, RecruitListInput } from '@/pages/season'

interface SeasonRouteProps {
  readonly session: SeasonSession
  readonly random: RandomPort
  /** 경기 중 메뉴 "설정" 칸과 자동진행 G 검사에 쓴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /** 시즌모드에서 나간다 — 메인 메뉴로 (원본은 `0xbc290(앱, 0x103)`) */
  readonly onExit: () => void
  /**
   * 마선수 오픈 플래그(`mgr[0x30..0x39]`)·레벨(`mgr[0x13a..]`)과 오픈·레벨업 처리 — 경기 전 마선수 고르기
   * 0xd7 이 일반모드 상태 21 과 **같은 전역 칸**을 본다(0xa248 의 `저장[0x30 + 칸]`). 앱의 `aceSelect` 를
   * 그대로 넘기면 된다. 안 넘기면 새 저장 기본 개방분(싸이커·메디카)만 열려 있고 오픈·레벨업이 안 된다.
   */
  readonly aceSelect?: {
    readonly openedAcePitcherIds: readonly number[]
    readonly openedAceBatterIds: readonly number[]
    readonly levels: Readonly<Record<number, number>>
    readonly onOpenAce: (cell: number) => void
    readonly onLevelUp: (cell: number, cost: number) => void
  }
  /**
   * 기록연감의 명예의 전당 — 선수영입(0xe2 → 0xdf) 후보 칸 1~4(투수 +0x880)·6~(타자 +0x940). 안 넘기면 빈 칸이다.
   * 앱의 `collection.collection` 을 그대로 넘기면 된다.
   */
  readonly hallOfFame?: Pick<Collection, 'hallOfFame' | 'hallOfFamePitchers'>
}

/** 명예의 전당 등록 `0x1f654`(투수: `+0xa = 0` · `+0 = i + 0xb4`) · `0x1f680`(타자: `+0xa = 0x20` · `+0 = i + 0xc8`) */
const HALL_OF_FAME_BATTER_FIRST_ID = 0xc8
const HALL_OF_FAME_PITCHER_KIND = 0x00
const HALL_OF_FAME_BATTER_KIND = 0x20

/**
 * 선수영입 후보 목록의 명예의 전당 칸 — `0x1f62c(저장, i)`·`0x1f640(저장, i)` 가 주는 0x30 바이트 사본을 시즌 선수로.
 *
 * 등록(0x1f654·0x1f680, 직접 떴다)이 사본의 `+0x0a`(종류·칸 바이트)와 `+0`(선수 번호 = 칸 + 0xb4 / 0xc8)을 덮어쓴 뒤
 * 전역 기록에 복사하므로 그 둘은 칸 번호로 정해진다 — 중복 검사 `0xb50ac` 가 이 번호를 견준다.
 * ⚠️ 나머지 칸(+0x1c 수비 위치·+0x2c 스태미나)은 기록연감에 남아 있지 않다 — 0 으로 둔다. 영입이 투수 스태미나를
 * 10000 으로, 타자 수비 위치를 밀려난 선수의 자리로 덮으므로(S6 4-2·4-3) 영입 결과에는 닿지 않는다.
 * ⚠️ 미해결: id ≥ 0xb4 선수의 경기 출전(능력치·이름을 기록에서 읽기)은 아직 없다 — 명단 편집·경기에서 빠진다.
 */
function hallOfFameRecruitsOf(hallOfFame: SeasonRouteProps['hallOfFame']): Pick<RecruitListInput, 'hallOfFamePitchers' | 'hallOfFameBatters'> {
  if (hallOfFame === undefined) return { hallOfFamePitchers: [], hallOfFameBatters: [] }
  const pitchers = Array.from({ length: HALL_OF_FAME_MAX_PITCHERS }, (_, slot): RecruitCandidate | null => {
    const famer = hallOfFame.hallOfFamePitchers.find((candidate) => candidate.slot === slot)
    return famer === undefined ? null : {
      name: famer.name,
      player: { id: HALL_OF_FAME_FIRST_ID + slot, kindByte: HALL_OF_FAME_PITCHER_KIND, fieldPosition: 0, stamina: 0 },
    }
  })
  const batters = Array.from({ length: HALL_OF_FAME_MAX_BATTERS }, (_, slot): RecruitCandidate | null => {
    // 옛 저장은 칸 번호가 없어 목록 순서가 칸이다 (`normalizeCollection` 과 같다)
    const famer = hallOfFame.hallOfFame.find((candidate, index) => (candidate.slot ?? index) === slot)
    return famer === undefined ? null : {
      name: famer.name,
      player: { id: HALL_OF_FAME_BATTER_FIRST_ID + slot, kindByte: HALL_OF_FAME_BATTER_KIND, fieldPosition: 0, stamina: 0 },
    }
  })
  return { hallOfFamePitchers: pitchers, hallOfFameBatters: batters }
}

/**
 * 시즌 모드 라우팅 (원본 장면 0x105).
 *
 * 어느 화면 다음에 무엇이 오는지는 `entities/season-mode` 의 상태 기계가 정하고,
 * 여기서는 그 장면 번호에 맞는 화면을 고르기만 한다.
 *
 * **아직 화면이 없는 장면**(연초 목표 0xd4 등)은
 * 알림을 띄우고 관리 메뉴로 되돌린다 — 조용히 아무것도 안 하는 것보다 낫다.
 */
export function SeasonRoute({ session, random, gameSettings, onExit, aceSelect, hallOfFame }: SeasonRouteProps) {
  const { state, scene, league, roster, playerStats, series, cup, gameOptions, notice, actions } = session

  /** 아이템 메뉴에서 고른, 웹에 아직 없는 창 종류 (`[win+0x1a4]`) */
  const [missingWindow, setMissingWindow] = useState<ItemWindowKind | null>(null)
  const ranks = useMemo(
    () => (state === null ? { myRank: 0, opponentRank: 0 } : seasonRanksOf(league, state.record)),
    [league, state],
  )

  if (missingWindow !== null) {
    return (
      <RawScreen>
        <MessageBox
          text={`이 화면은 아직 없습니다 (장면 0xdc 창 종류 ${missingWindow})`}
          buttons={['OK']}
          onAnswer={() => setMissingWindow(null)}
        />
      </RawScreen>
    )
  }

  if (notice !== '') {
    return (
      <RawScreen>
        <MessageBox text={notice} buttons={['OK']} onAnswer={actions.clearNotice} />
      </RawScreen>
    )
  }

  // 저장이 없으면 팀 고르기부터다 (0xca). 팀 고르기 화면은 선수 등록 쪽 것을 그대로 쓴다
  if (state === null || scene === SEASON_SCENE_STATE.팀고르기) {
    return <TeamSelectScreen title="시즌모드" onSelect={actions.chooseTeam} onCancel={onExit} />
  }

  const backToManagement = () => actions.goto(SEASON_SCENE_STATE.관리메뉴)
  const backToTeamMenu = () => actions.goto(SEASON_SCENE_STATE.구단관리)
  // 목표 판정 0xa37bc 의 다섯 칸 — 시즌정보 화면과 목표 창(SYS sub 1)이 같은 값을 본다
  const goalInput = seasonGoalInputOf({ state, league, roster, playerStats, series })

  // 이벤트 재생 0xd3 (갱신 0x5110 · 키 0x90ec · 그리기 0xa09c → 대화창 0x8b5ac).
  // ⚠️ 근사: 원본은 대화창 아래에 공통 틀(0x9f60, 이전 상태가 외출 지도면 지도)을 그린다 — 웹은 대화창만 얹는다.
  if (scene === SEASON_SCENE_STATE.이벤트재생 && session.eventPlayback !== null) {
    const playback = session.eventPlayback
    const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
    if (event !== undefined) {
      return (
        <RawScreen>
          <ScreenOverlay>
            <StoryScreen
              // 명령 5 의 500ms 진동(0x3a44)은 환경설정 진동(옵션 +0x3b)이 켜졌을 때만
              isVibrationOn={gameSettings.settings.isVibrationOn}
              key={playback.serial}
              events={SEASON_PLAYABLE_EVENTS}
              event={event}
              // 화자 1(플레이어)은 s_event 에 없다. fmt 9 의 %s 는 구단 이름(SR+0x17c)이다
              playerName={state.record.name}
              teamName={state.record.name}
              onComplete={actions.finishSeasonEvent}
              // s_event 에는 경기(match) 명령이 없다
              onMatch={() => undefined}
              systemWindowTextOf={(command) =>
                command.sub === SEASON_GOAL_WINDOW_SUB ? seasonGoalWindowText(state.record.yearIndex, goalInput) : null}
            />
          </ScreenOverlay>
        </RawScreen>
      )
    }
  }

  if (scene === SEASON_SCENE_STATE.관리메뉴) {
    return (
      <SeasonManagementScreen
        state={state}
        onSelect={(item, target) => {
          // 관리 메뉴 칸 5 → 0xd8 다음경기 (점프표 0xcbe40). 경기는 그 화면의 확인에서 시작한다
          if (item === '다음경기') return actions.openNextGame()
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
        // 히든 칸 해금 플래그 `app[0xe0 + 종류×4 + (칸−4)]` (S3 7절) — 전역 저장 칸이라
        // 시즌 레코드가 아니라 세션이 들고 있다. 안 넘기면 히든이 영영 안 열린다
        isHiddenOpen={(unlockId) => session.openedStadiumIds.includes(unlockId)}
        onUnlock={actions.openStadiumItems}
        onChange={actions.updateRecord}
        onBack={scene === SEASON_SCENE_STATE.구장관리 ? backToTeamMenu : backToManagement}
      />
    )
  }

  // 트레이드 한 바퀴 (0xe4 팀 고르기 → 0xe5 영입 선수 → 0xe6 보상 선수 → 0xe7 확인·진행).
  // 원본도 한 장면 객체가 네 칸을 이어 들고 있어(this+0x154·0x158·0x15c) 화면 하나가 단계를 든다
  if (scene === SEASON_SCENE_STATE.트레이드) {
    return (
      <TradeScreen
        state={state}
        roster={roster}
        gamePoints={session.gamePoints}
        random={random}
        onTrade={actions.finishTrade}
        onBack={backToTeamMenu}
      />
    )
  }

  // 선수단 0xd7, this+0x11c = 1 — **경기 전 마선수 고르기**. 그림 0xaa24 가 공용 목록 k 2 + 0x5f395 +
  // 머리띠(4 "마선수선택", 바닥 0x205)로 일반모드 상태 21 과 같은 화면이라 그 화면을 그대로 쓴다
  if (scene === SEASON_SCENE_STATE.선수단 && session.squadPurpose === SQUAD_PURPOSE.경기전) {
    return (
      <AceSelectScreen
        phase={session.preGameAces.phase}
        openedAcePitcherIds={aceSelect?.openedAcePitcherIds ?? DEFAULT_OPENED_ACE_PITCHER_IDS}
        openedAceBatterIds={aceSelect?.openedAceBatterIds ?? DEFAULT_OPENED_ACE_BATTER_IDS}
        {...(aceSelect === undefined ? {} : {
          levels: aceSelect.levels, onOpenAce: aceSelect.onOpenAce, onLevelUp: aceSelect.onLevelUp,
        })}
        gamePoint={session.gamePoints}
        onSelect={actions.choosePreGameAce}
        onCancel={actions.cancelPreGameAce}
      />
    )
  }

  // 경기 직전 경기정보 0xdd — 목록 k 4 + 경기진행 설정 창 0x6042c (그림 0xb398)
  if (scene === SEASON_SCENE_STATE.경기정보 && session.pendingGame !== null) {
    const { options, kind } = session.pendingGame
    const isCup = kind === '국가대항전'
    return (
      <>
        <SeasonMatchInfoScreen
          lines={seasonMatchInfoLines({
            league, series, cup, inPostseason: state.record.inPostseason,
            myTeamId: options.ourTeamId,
            opponentTeamId: options.opponentTeamId,
            dayCounter: options.dayCounter ?? 0,
            ...(options.opponentDayCounter === undefined ? {} : { opponentDayCounter: options.opponentDayCounter }),
            ...(options.opponentPitcherOrder === undefined ? {} : { opponentPitcherOrder: options.opponentPitcherOrder }),
            acePitcherId: isCup ? -1 : session.preGameAces.pitcher,
            aceBatterId: isCup ? -1 : session.preGameAces.batter,
            opponentAces: options.opponentAces ?? null,
            myStarterName: session.matchInfoStarterName,
          })}
          myTeamId={options.ourTeamId}
          opponentTeamId={options.opponentTeamId}
          playerSide={options.playerSide}
          gamePoint={session.gamePoints}
          onStart={() => {
            // 설정 창이 열려 있으면 키가 모두 창으로 간다 (0x83f2 메뉴+0x2ba)
            if (!session.isMatchSettingsOpen) actions.startPendingGame()
          }}
          onOpenSettings={() => {
            if (!session.isMatchSettingsOpen) actions.toggleMatchSettings()
          }}
          onCancel={() => {
            if (!session.isMatchSettingsOpen) actions.cancelMatchInfo()
          }}
          onOpenEntry={(isUserTeam) => {
            if (!session.isMatchSettingsOpen) actions.openEntryEdit(isUserTeam)
          }}
        />
        {session.isMatchSettingsOpen && (
          <MatchSettingsWindow
            settings={session.matchSettings}
            onConfirm={actions.applyMatchSettings}
            onClose={actions.toggleMatchSettings}
          />
        )}
      </>
    )
  }

  // 엔트리 편집 0xe0 — 엔트리 목록 창 0x5cfec + 머리띠 (그림 0xb074), 키 0x7044 → 편집기 0x55864
  if (scene === SEASON_SCENE_STATE.엔트리편집 && session.entryEdit !== null) {
    const { entryEdit } = session
    return (
      <EntryEditorScreen
        editor={entryEdit.editor}
        lists={entryEdit.lists}
        teamName={`${TEAMS[entryEdit.teamId]?.name ?? ''} ${entryEdit.isUserTeam ? '(PLAYER)' : '(COM)'}`}
        isAceLocked={entryEdit.isAceLocked}
        gamePoint={session.gamePoints}
        onKey={actions.pressEntryKey}
        onMoveCursor={actions.pointEntryCursor}
        onCloseAceLocked={actions.closeEntryAceLocked}
      />
    )
  }

  // 코치채용 — 선수단 화면 0xd7 을 `this+0x11c = 2` 로 띄운 것 (P4 1b, 구단관리 칸 3)
  if (scene === SEASON_SCENE_STATE.선수단) {
    return (
      <CoachHireScreen
        state={state}
        gamePoints={session.gamePoints}
        onHire={actions.updateRecord}
        onBack={backToTeamMenu}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.선수영입 || scene === SEASON_SCENE_STATE.선수고르기) {
    return (
      <PlayerRecruitScreen
        roster={roster}
        // 영입 후보는 나만의리그 선수·명예의 전당에서 온다. 명예의 전당은 기록연감 칸(c3e66c1)에서 싣는다.
        // ⚠️ 나리 두 칸(0x22168·0x220ec — 투수편·타자편 저장)은 아직 넘기지 않아 빈 칸이다
        list={{ careerPitcher: null, careerBatter: null, ...hallOfFameRecruitsOf(hallOfFame) }}
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
        // G 포인트는 전역 저장(+0x64) 칸이라 시즌 레코드에 없다 — 그 칸이 곧 지갑이다
        gamePoints={session.gamePoints}
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
        // 0xdc 는 칸마다 다른 창(0x5f3c)을 연다 — 웹엔 구장 창(종류 4)만 있다. 나머지 셋(장비 창·서브아이템·
        // GP아이템)은 아직 화면이 없어 지어내지 않고 "아직 없음" 으로 막는다
        onSelect={(_item, target, windowKind) =>
          windowKind === ITEM_WINDOW_KIND.구장아이템 ? actions.goto(target) : setMissingWindow(windowKind)}
        onBack={backToManagement}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.시즌정보) {
    return (
      <SeasonGoalsScreen
        yearIndex={state.record.yearIndex}
        // 팀 타율 0xa3700 · 팀 방어율 0xa3764 는 리그 선수 기록표에서 센다 (`seasonGoalInputOf`)
        input={goalInput}
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
  // 0xee 포스트시즌 시작 · 0xf0 정규시즌 순위 — 그리기는 공통 틀(0xa008 · 0x9ff0 → 0x9f60)뿐이고 진입 함수가
  // phase 를 세우고 이벤트(392 · 401~403)를 튼다. 세션이 들어온 틀에 곧장 0xd3 으로 넘긴다
  if (scene === SEASON_SCENE_STATE.포스트시즌시작 || scene === SEASON_SCENE_STATE.정규시즌순위) {
    return <RawScreen>{null}</RawScreen>
  }

  if (scene === SEASON_SCENE_STATE.타자시상 || scene === SEASON_SCENE_STATE.투수시상) {
    const isBatter = scene === SEASON_SCENE_STATE.타자시상
    // ⚠️ 시즌모드는 `isMine` 을 "1위 팀 == 내 팀" 으로 본다 (B 4절 2번) — 여기서 그렇게 채운다
    const records = leagueRecordsOf(playerStats).map((record) => ({
      ...record,
      isMine: record.teamId === state.record.teamId,
    }))
    const titles = judgeTitles(records, isBatter ? '타자' : '시즌투수')
    return (
      <SeasonTitleAwardScreen
        role={isBatter ? '타자' : '투수'}
        // 시즌모드 투수는 네 칸이라 역할 이름이 다르다 (다승·삼진·방어·세이브)
        titles={titles}
        // 시상 보상 (P4 2a) — 수상자가 내 팀이면 373·375 가 평판 +10 · 소지금 +5 를 준다
        onNext={() => actions.nextSeasonEndStep(seasonAwardRewardOf(
          seasonTitleResultEventId(isBatter ? '타자' : '투수', titles.some((slot) => slot.isMine)),
        ))}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.최우수선수) {
    const records = leagueRecordsOf(playerStats)
    // 시즌 MVP 는 표 0xd4f34 에서 rand(0..6) 으로 종류 하나를 골라 그 1위를 발표한다 (B-3)
    const kind = SEASON_MVP_LEADER_KINDS[randomIntegerBelow(random, 0, SEASON_MVP_LEADER_KINDS.length)]
    const leader = kind === undefined ? null : leaderOf(records, kind)
    const isMine = leader?.record.teamId === state.record.teamId
    return (
      <SeasonMvpScreen
        winner={leader === null ? null : { name: leader.record.name, teamId: leader.record.teamId }}
        isMine={isMine}
        // MVP 보상 — 379(내 팀)면 인기도 +10 · 평판 +20 · 소지금 +10
        onNext={() => actions.nextSeasonEndStep(seasonAwardRewardOf(seasonMvpResultEventId(isMine)))}
      />
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
        leagueFirstAwardedBits={session.leagueFirstAwardedBits}
        skipsLeagueFirstAward={session.skipsLeagueFirstAward}
        onApplyKoreanSeriesReward={(reward) => actions.updateRecord(applySeasonReward(state.record, reward))}
        onLeagueFirstAward={actions.awardLeagueFirst}
        onContinuePostseason={actions.continuePostseason}
        onFinish={actions.finishSeason}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.엔딩) {
    return (
      <SeasonEndingScreen
        // 엔딩 번호는 레코드에서 다시 판정한다 (0xa3084). 여기 올 때 레코드가 그대로라 값이 같다.
        // ⚠️ 원본은 판정값 e 를 `저장+0xa0+e` 에 남기지만 그 전역 저장 칸이 웹에 없다 — **근사다**.
        // 손댄 세이브 등으로 10년차가 아닌 채 phase 6 이면 0(비 인기 구단)으로 둔다
        endingIndex={judgeSeasonEnding(state.record) ?? 0}
        onEndingSeen={actions.markEndingSeen}
        // 엔딩·보너스까지 보고 나면 **메인 메뉴로 나간다**. 0xf5 의 키 처리 `0x6b3c` 가
        // 보너스를 준 뒤 어디로 가는지는 문서(P4 1a·J 4-8 · P6 4b)에 없어 확인하지 못했다 —
        // 시즌은 여기서 끝이고 SR+0x1bc 가 섰으니 다시 들어와도 관리 메뉴다. **근사다**
        onFinish={onExit}
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
        // 자동진행 비용은 전역 저장 +0x64 에서 나간다 (시즌 사용내역 종류 3, 0x22c29)
        gamePoint={session.gamePoints}
        onSpendGamePoint={actions.spendGamePoint}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
        // 장착한 관중석·전광판 — **홈경기일 때만** 넘긴다 (원본 0x40ff0: 모드 2 이고
        // `0xb6bdc(경기, 1) == SR[1]`, 곧 내 팀이 side 1 = 홈일 때만 시즌 구장 0x77494).
        // 웹에서 그 side 를 정하는 것은 `0xb7844` 의 세 가지(정규 `leagueSideOf` ·
        // 포스트시즌 `postseasonSideOf` · 국가대항전 `nationalCupSideOf`) 고, 그 값이 그대로
        // `playerSide` 다 — side 1 = 후공 = 홈. 원정이면 undefined 라 일반 구장으로 그려진다.
        //
        // ⚠️ **국가대항전은 홈이어도 일반 구장이다.** 경기 준비 0x6650 이 `경기[0x28+side]` 에
        // 넣는 값이 대표팀 번호(10 대한민국 ~ 13 미국)인데, 비교 상대인 `SR[1]`(내 구단)은
        // 시즌모드에서 0~9 뿐이라(히든 팀은 일반모드에서만 고른다 — J-1) 절대 같아지지 않는다.
        seasonStadium={
          gameOptions.playerSide === PLAYER_SIDE_LAST_BAT && session.gameKind !== '국가대항전'
            ? seasonStadiumOf(state.record)
            : undefined
        }
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.다음경기) {
    // 0xd8 — 리그 순위표 한 장 (그림 0xae24 → 0x7f070). 확인은 경기로, 취소는 관리 메뉴에서 왔을 때만
    return <NextGameScreen league={league} onConfirm={actions.confirmNextGame} onCancel={actions.cancelNextGame} />
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

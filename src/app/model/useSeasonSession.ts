import { useCallback, useRef, useState } from 'react'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_GAME_COUNT, startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import {
  SEASON_PHASE,
  SEASON_SCENE_STATE,
  afterGameNext,
  enterSeasonScene,
  seasonOpponentOf,
} from '@/entities/season-mode/model/seasonStateMachine'
import {
  applySeasonGameEvaluation,
  evaluateSeasonGame,
} from '@/entities/season-mode/model/seasonEvaluation'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { EMPTY_LEAGUE, LEAGUE_SIDE_HOME, leagueSideOf, rankingOf } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { recordLeagueResult } from '@/entities/league/model/league'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import { runCpuPostseason } from '@/entities/league/model/postseasonPlay'
import { advancePostseason } from '@/entities/league/model/league'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS, recordLeaguePlateAppearances } from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { startNextYear } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_END_CHAIN } from '@/entities/season-mode/model/seasonStateMachine'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { TEAMS } from '@/shared/config/original/teams'
import type { TeamGameOptions, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { FULL_PLAY_SETTINGS } from '@/features/play-team-game/model/matchSettings'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { advanceNationalCupDay } from '@/entities/national-cup/model/nationalCupPlay'
import { isSeasonNationalCupYear } from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import { applySeasonReward, GAME_POINT_LIMIT } from '@/entities/season-mode/model/seasonRewards'
import type { LeagueFirstAward } from '@/entities/season-mode/model/seasonRewards'
import type { SeasonAwardReward } from '@/widgets/season/lib/seasonAwardEvents'
import {
  HELL_TRAINING_GAIN_RANGE, HELL_TRAINING_INDEX, HELL_TRAINING_MORALE_LOSS_RANGE,
  MASSAGER_MORALE_RELIEF, TRAINING_APPLY_LIMIT, TRAINING_GAIN_RANGE,
  TRAINING_MORALE_LOSS_RANGE, TRAINING_SUB_ITEM_GAIN,
} from '@/widgets/season/lib/seasonTraining'
import { SEASON_OUTING_EFFECTS, SEASON_OUTING_PLACES } from '@/widgets/season/lib/seasonOuting'
import { cureIllnessAtHospital } from '@/entities/season-mode/model/seasonEventFlow'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { MORALE_LIMIT, POPULARITY_LIMIT, REPUTATION_LIMIT, MONEY_LIMIT, clampTo } from '@/entities/season-mode/model/seasonRecord'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 시즌 모드 한 판 (원본 게임 모드 2, 장면 0x105).
 *
 * 화면(`pages/season`)은 상태를 하나도 안 들고 있고, 어느 화면 다음에 무엇이 오는지는
 * `entities/season-mode` 의 상태 기계가 전부 안다. 이 훅은 그 둘을 잇고 **저장**만 맡는다.
 *
 * ⚠️ **웹판 임시**: 원본 시즌모드는 사람이 팀을 조작해 경기를 치른다. 웹에는 아직 팀 경기
 *    화면이 없어 `playNextGame` 이 리그 시뮬레이터(0xc11f0 과 같은 간이 엔진)로 **자동 진행**한다.
 *    승패·수입·평가는 원본 식을 그대로 쓰지만 **경기 자체를 사람이 못 친다** — 화면이 생기면
 *    이 함수만 갈아 끼우면 된다.
 */

export interface SeasonSession {
  readonly state: SeasonState | null
  readonly scene: SeasonSceneState
  readonly league: League
  readonly roster: SeasonTeamRoster
  /** 리그 선수별 성적 — 타이틀·MVP 판정의 유일한 재료다 (B-2) */
  readonly playerStats: LeaguePlayerStats
  /** 포스트시즌 시리즈 (준PO → PO → 한국시리즈). 정규시즌 중에는 null */
  readonly series: PostseasonSeries | null
  /** 정규시즌 순위 (1위부터 팀 번호). 시즌이 끝나야 채워진다 */
  readonly ranking: readonly number[]
  /** 지금 치를 팀 경기의 옵션. 경기 화면이 아니면 null */
  readonly gameOptions: TeamGameOptions | null
  /** 그 경기가 정규·포스트시즌·국가대항전 중 무엇인가 */
  readonly gameKind: SeasonGameKind
  /** 전역 저장 +0x145 — 리그 1위 G 를 이미 받은 문턱 비트 */
  readonly leagueFirstAwardedBits: number
  /** 전역 저장 +0x64 — 시즌 쪽 G포인트 */
  readonly gamePoints: number
  /** 진행 중인 국가대항전. 없으면 null (원본 L+0xa8~ 칸) */
  readonly cup: NationalCup | null
  readonly notice: string
  readonly actions: SeasonActions
}

export interface SeasonActions {
  readonly chooseTeam: (teamId: number) => void
  readonly goto: (scene: SeasonSceneState) => void
  readonly updateRecord: (record: SeasonRecord) => void
  readonly updateRoster: (roster: SeasonTeamRoster) => void
  readonly playNextGame: () => void
  readonly confirmIncome: (record: SeasonRecord) => void
  /** 국가대항전 한 경기 — 사람이 대표팀을 조작한다 */
  readonly playCupGame: (myTeam: number, opponent: number) => void
  readonly finishCup: (finish: NationalCupFinish) => void
  /** 팀 트레이닝 한 번 — 굴리고 적용한다 (연출 0xde → 굴림 0xc074 → 적용 0xa2f24) */
  readonly runTraining: (slot: number) => void
  /** 시즌 외출 한 번 — 굴리고 적용한다 (연출 0xe3 → 결과 0xc81c) */
  readonly runOuting: (place: number) => void
  /** 팀 경기가 끝났다 — 종류에 맞게 정산한다 (정규는 관중수입 0xe9 으로) */
  readonly finishGame: (summary: TeamGameSummary) => void
  /** 결산 화면에서 포스트시즌을 한 걸음 진행시킨다 (0xef — 내 차례면 경기, 아니면 CPU 구간) */
  readonly continuePostseason: () => void
  /**
   * 시즌 끝 사슬의 다음 칸으로 (포스트시즌시작 → 시상 셋 → 정규시즌순위 → 결산).
   * 그 칸의 **보상**(P4 2a)을 레코드에 얹고 넘어간다 — 화면은 문구만 보여 준다.
   */
  readonly nextSeasonEndStep: (reward?: SeasonAwardReward) => void
  /** 리그 1위 G 를 지급하고 받은 비트를 남긴다 (0x6900 · 0x87e8) */
  readonly awardLeagueFirst: (award: LeagueFirstAward) => void
  /** 경기 중 자동진행 값 등 G 를 쓴다 (모자라면 화면이 먼저 막는다) */
  readonly spendGamePoint: (cost: number) => void
  /** 결산을 닫았다 — 국가대항전 연차면 대회, 아니면 새 해 (afterKoreanSeries) */
  readonly finishSeason: () => void
  readonly clearNotice: () => void
  readonly quit: () => void
}

/** 저장 칸 하나에 시즌 상태·리그 전적·로스터를 함께 담는다 (원본 저장 0x22755 에 해당) */
interface SeasonSave {
  readonly state: SeasonState
  readonly league: League
  readonly roster: SeasonTeamRoster
  readonly playerStats?: LeaguePlayerStats
  readonly series?: PostseasonSeries | null
  readonly ranking?: readonly number[]
  /** 진행 중인 국가대항전 (L+0xa8~0xc3). 대회 밖이면 null */
  readonly cup?: NationalCup | null
}

/**
 * 시즌 로스터를 팀 명단 표에서 만든다 — 원본 선수 레코드 구조가 안 풀려 **근사**다.
 * 칸 번호(`+0xa & 0x1f`)만 순서대로 채우고 종류 비트는 0(기본 선수)으로 둔다.
 */
function rosterOf(teamId: number): SeasonTeamRoster {
  return {
    pitchers: teamPitchers(teamId).map((_player, slot) => ({
      id: slot,
      kindByte: slot,
      fieldPosition: 0,
      // 원본 +0x2c. 웹 팀 명단 표에 스태미나 칸이 없어 0 으로 둔다 — 영입 화면은 이 칸을 안 본다
      stamina: 0,
    })),
    batters: teamBatters(teamId).map((_player, slot) => ({
      id: slot,
      kindByte: slot,
      fieldPosition: 0,
      stamina: 0,
    })),
  }
}

const EMPTY_ROSTER: SeasonTeamRoster = { pitchers: [], batters: [] }

/** SR+0xb7 = 0xf 는 "우승팀 미정" 이다 (P4 1a) */
const NO_CHAMPION = 0xf
/** 시즌모드 = 원본 게임 모드 2 (능력치 보정 마스크 0x306 에 든다) */
const SEASON_GAME_MODE = 2
/** 코치 칸 SR+0x185 가 시즌 레코드에 아직 없다 — 없음(−1)으로 둔다 */
const NO_COACH = -1

/** 같은 경기 화면을 쓰는 세 갈래 — 끝났을 때 정산하는 곳이 다르다 */
export type SeasonGameKind = '정규' | '포스트시즌' | '국가대항전'

/** 시즌 외출 장소 표에서 **병원** 칸 (StrMODE[54+p] = 친선경기·회식·입원·야구교실·구단CF) */
const HOSPITAL_PLACE = SEASON_OUTING_PLACES.indexOf('병원')

export function useSeasonSession(store: JsonStorePort, random: RandomPort): SeasonSession {
  const loaded = useRef<SeasonSave | null>(null)
  if (loaded.current === null) loaded.current = (store.load() as SeasonSave | null) ?? null

  const [save, setSave] = useState<SeasonSave | null>(loaded.current)
  const [scene, setScene] = useState<SeasonSceneState>(() =>
    save === null
      ? SEASON_SCENE_STATE.팀고르기
      : enterSeasonScene(save.state.record, { hasSeasonSave: true }),
  )
  const [notice, setNotice] = useState('')
  const [gameOptions, setGameOptions] = useState<TeamGameOptions | null>(null)
  /** 지금 치르는 경기가 무엇인가 — 끝났을 때 어디로 정산할지 갈린다 */
  const [gameKind, setGameKind] = useState<SeasonGameKind>('정규')
  /** 전역 저장 +0x145 — 리그 1위 G 를 이미 받은 문턱 비트 (시즌을 새로 해도 남는다) */
  const [leagueFirstAwardedBits, setLeagueFirstAwardedBits] = useState(0)
  /** 전역 저장 +0x64 — 시즌 쪽 G포인트 */
  const [gamePoints, setGamePoints] = useState(0)

  const commit = useCallback(
    (next: SeasonSave) => {
      setSave(next)
      store.save(next)
    },
    [store],
  )

  const chooseTeam = useCallback(
    (teamId: number) => {
      const next: SeasonSave = {
        // 구단 이름은 원본 팀 이름을 그대로 쓴다 — 이름 입력 화면(0xc8)은 아직 없다
        state: startNewSeason(teamId, TEAMS[teamId]?.name ?? ''),
        league: EMPTY_LEAGUE,
        roster: rosterOf(teamId),
        playerStats: EMPTY_LEAGUE_PLAYER_STATS,
        series: null,
        ranking: [],
        cup: null,
      }
      commit(next)
      setScene(SEASON_SCENE_STATE.관리메뉴)
    },
    [commit],
  )

  const updateRecord = useCallback(
    (record: SeasonRecord) => {
      if (save === null) return
      commit({ ...save, state: { ...save.state, record } })
    },
    [commit, save],
  )

  const updateRoster = useCallback(
    (roster: SeasonTeamRoster) => {
      if (save === null) return
      commit({ ...save, roster })
    },
    [commit, save],
  )

  /**
   * 다음 경기 — ⚠️ **웹판 임시 자동 진행**. 파일 머리 주석 참고.
   *
   * 원본 순서를 지킨다: 내 경기를 치르고(0xc2dac 과 같은 간이 엔진) 전적에 넣은 뒤,
   * 같은 날 나머지 네 경기를 돌리고(0xc2a48 — 승패 뒤집힘 버그 포함), 평가(0xa719c)를
   * 얹고 phase 를 "경기끝" 으로 두어 관중수입(0xe9)으로 넘어간다.
   */
  /** 커리어·팀 상태에서 팀 경기 옵션을 만든다 (세 종류가 같은 화면을 쓴다) */
  const optionsFor = useCallback(
    (opponent: number): TeamGameOptions | null => {
      if (save === null) return null
      const { record } = save.state
      return {
        mode: SEASON_GAME_MODE,
        ourTeamId: record.teamId,
        opponentTeamId: opponent,
        // 홈/원정은 원본 0xb7844 가 정한다 — 홈(side 1)이면 말 공격(후공)이다.
        // ⚠️ 포스트시즌·국가대항전은 일정표가 없어 이 식이 안 맞는다. 그쪽은 늘 후공이다
        playerSide: leagueSideOf(record.games, record.teamId) === LEAGUE_SIDE_HOME
          ? PLAYER_SIDE_LAST_BAT
          : PLAYER_SIDE_FIRST_BAT,
        settings: FULL_PLAY_SETTINGS,
        season: { illness: record.illness, morale: save.state.teamMorale, coach: NO_COACH },
        teamAbilities: save.state.teamAbilities,
      }
    },
    [save],
  )

  const playNextGame = useCallback(() => {
    if (save === null) return
    const options = optionsFor(seasonOpponentOf(save.state.record))
    if (options === null) return
    setGameKind('정규')
    setGameOptions(options)
    setScene(SEASON_SCENE_STATE.경기직전)
  }, [optionsFor, save])

  /**
   * 경기가 끝났다 — 원본 차례 그대로 정산한다:
   * 내 경기를 전적에 넣고, 같은 날 나머지 네 경기를 돌리고(0xc2a48 — 승패 뒤집힘 버그 포함),
   * 선수 기록표에 **양 팀 타석**을 쌓고(0xa8024), 평가(0xa719c)를 얹은 뒤 관중수입(0xe9)으로 간다.
   */
  const finishGame = useCallback(
    (summary: TeamGameSummary) => {
      if (save === null) return
      const { record } = save.state
      const opponent = summary.opponentTeamId

      // 포스트시즌·국가대항전은 리그 전적·수입 정산을 타지 않는다
      if (gameKind === '포스트시즌') {
        const series = save.series ?? null
        if (series === null) return
        const winner = summary.won ? record.teamId : opponent
        const advanced = runCpuPostseason(advancePostseason(series, winner), record.teamId, random)
        commit({
          ...save,
          series: advanced,
          state: {
            ...save.state,
            record: { ...record, postseasonChampion: advanced.champion ?? NO_CHAMPION },
          },
        })
        setGameOptions(null)
        return setScene(SEASON_SCENE_STATE.시즌결산)
      }
      if (gameKind === '국가대항전') {
        const cup = save.cup ?? null
        if (cup === null) return
        const winner = summary.won ? record.teamId : opponent
        const loser = summary.won ? opponent : record.teamId
        commit({ ...save, cup: advanceNationalCupDay(cup, winner, loser, random) })
        setGameOptions(null)
        return setScene(SEASON_SCENE_STATE.국가대항전)
      }

      const afterMyGame = summary.won
        ? recordLeagueResult(save.league, record.teamId, opponent)
        : recordLeagueResult(save.league, opponent, record.teamId)
      const day = playLeagueDay(
        afterMyGame,
        record.games,
        record.teamId,
        random,
        recordLeaguePlateAppearances(
          save.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
          summary.leaguePlateAppearances,
        ),
      )

      const evaluation = evaluateSeasonGame(record, {
        myRuns: summary.ourScore,
        opponentRuns: summary.opponentScore,
        won: summary.won,
        // 완투 두 칸이 이제 실제로 채워진다 — 인기도와 평판이 서로 다른 이닝 칸을 본다
        popularityCompleteGame: summary.popularityCompleteGame,
        reputationCompleteGame: summary.reputationCompleteGame,
        opponentTeamId: opponent,
      })
      const evaluated = applySeasonGameEvaluation(save.state, evaluation)

      commit({
        ...save,
        league: day.league,
        playerStats: day.playerStats,
        state: {
          ...evaluated,
          record: {
            ...evaluated.record,
            games: evaluated.record.games + 1,
            // 경기를 치르면 이번 주기의 트레이닝·외출 표시를 지운다 (0x4f158)
            acted: false,
            aimVisionGames: Math.max(0, evaluated.record.aimVisionGames - 1),
            phase: SEASON_PHASE.경기끝,
          },
        },
      })
      setGameOptions(null)
      setScene(SEASON_SCENE_STATE.관중수입)
    },
    [commit, random, save],
  )

  /** 관중수입 창에서 확인 — 정산된 레코드를 받아 경기 뒤 마무리로 간다 (0xf1) */
  const confirmIncome = useCallback(
    (record: SeasonRecord) => {
      if (save === null) return
      const settled: SeasonRecord = { ...record, phase: SEASON_PHASE.기본 }
      commit({ ...save, state: { ...save.state, record: settled } })
      if (settled.games >= SEASON_GAME_COUNT) {
        /*
         * 정규시즌 종료 (0xb818c → 0xb80a8): 1위면 `+0x7a` 를 늘리고 대진을 짠다.
         * 국가대항전은 여기가 아니라 **결산을 닫은 뒤**(`finishSeason` → `afterKoreanSeries`)다.
         *
         * 포스트시즌 경기는 여기서 치르지 않는다 — 원본도 **결산 화면(0xef)** 이
         * 라운드를 하나씩 진행시킨다 (내 팀 차례면 사람이 치고, 아니면 0xc2760 으로 돌린다).
         */
        const end = finishRegularSeason(save.league, settled.teamId)
        commit({
          ...save,
          series: end.postseason,
          ranking: end.ranking,
          state: {
            ...save.state,
            record: {
              ...settled,
              regularSeasonFirsts: settled.regularSeasonFirsts + (end.isRegularSeasonFirst ? 1 : 0),
              inPostseason: true,
              postseasonChampion: NO_CHAMPION,
            },
          },
        })
        // 원본 시즌 끝 사슬의 첫 칸 (0xee → 시상 셋 → 정규시즌순위 → 결산)
        return setScene(SEASON_END_CHAIN[0].state)
      }
      setScene(afterGameNext(settled))
    },
    [commit, gameKind, random, save],
  )

  /**
   * 결산 화면(0xef)이 포스트시즌을 한 걸음 진행시킨다.
   * 내 팀이 지금 시리즈에 있으면 **사람이 친다**(원본 0xd7 선수단 → 경기),
   * 없으면 내 차례가 오거나 우승이 정해질 때까지 CPU 끼리 돌린다 (0x13da0 → 0xc2760).
   */
  const continuePostseason = useCallback(() => {
    const series = save?.series ?? null
    if (save === null || series === null) return
    const myTeam = save.state.record.teamId
    if (isMyTurn(series, myTeam)) {
      const options = optionsFor(series.teams[0] === myTeam ? series.teams[1] : series.teams[0])
      if (options === null) return
      setGameKind('포스트시즌')
      setGameOptions(options)
      return setScene(SEASON_SCENE_STATE.경기직전)
    }
    const advanced = runCpuPostseason(series, myTeam, random)
    commit({
      ...save,
      series: advanced,
      state: {
        ...save.state,
        record: { ...save.state.record, postseasonChampion: advanced.champion ?? NO_CHAMPION },
      },
    })
  }, [commit, optionsFor, random, save])

  /**
   * 국가대항전 한 경기 — 원본대로 **사람이 대표팀을 조작한다** (시즌 221).
   * 대진은 대회 화면이 골라 주고, 끝나면 `finishGame` 이 `advanceNationalCupDay` 로 하루를 넘긴다.
   */
  const playCupGame = useCallback(
    (_myTeam: number, opponent: number) => {
      const options = optionsFor(opponent)
      if (options === null) return
      setGameKind('국가대항전')
      setGameOptions(options)
      setScene(SEASON_SCENE_STATE.경기직전)
    },
    [optionsFor],
  )

  /** 대회 끝 — 보상을 넣고 히든 팀을 연 뒤 관리 메뉴로 돌아간다 */
  const finishCup = useCallback(
    (finish: NationalCupFinish) => {
      if (save === null) return
      const record = applySeasonReward(save.state.record, finish.reward)
      commit({
        ...save,
        // ⚠️ **사용자 판단 대기**: 원본은 여기서도 `nationalCup` 을 내리지 않는다.
        //    그대로 두면 다음 정규 경기마다 다시 대회 화면으로 샌다 (S6 1절).
        state: { ...save.state, record: { ...record, nationalCupChampion: finish.champion } },
        cup: null,
      })
      setNotice(
        finish.openedTeams.length === 0
          ? '국가대항전이 끝났습니다.'
          : `국가대항전이 끝났습니다.!N히든 팀이 열렸습니다: ${finish.openedTeams.join(', ')}`,
      )
      setScene(SEASON_SCENE_STATE.관리메뉴)
    },
    [commit, save],
  )

  /**
   * 팀 트레이닝 (굴림 `0xc074` → 적용 `0xa2f24`, J 4-6).
   * 칸 0~3 은 그 칸만, 지옥훈련(4)은 **네 칸을 따로 굴린다**. 서브 아이템은 해당 칸 +2,
   * 자동안마기는 사기 감소 −1 이다. 상승은 999 로 자른다.
   */
  const runTraining = useCallback(
    (slot: number) => {
      if (save === null) return
      const { record, teamAbilities, teamMorale } = save.state
      const myTeam = record.teamId
      const isHell = slot === HELL_TRAINING_INDEX
      const gainRange = isHell ? HELL_TRAINING_GAIN_RANGE : TRAINING_GAIN_RANGE
      const lossRange = isHell ? HELL_TRAINING_MORALE_LOSS_RANGE : TRAINING_MORALE_LOSS_RANGE

      const mine = [...(teamAbilities[myTeam] ?? [])]
      const raise = (index: number) => {
        const bonus = record.trainingSubItems[index] === true ? TRAINING_SUB_ITEM_GAIN : 0
        const gain = randomIntegerBelow(random, gainRange[0], gainRange[1]) + bonus
        mine[index] = Math.min(TRAINING_APPLY_LIMIT, (mine[index] ?? 0) + gain)
      }
      if (isHell) mine.forEach((_value, index) => raise(index))
      else raise(slot)

      const relief = record.massager ? MASSAGER_MORALE_RELIEF : 0
      const loss = Math.max(0, randomIntegerBelow(random, lossRange[0], lossRange[1]) - relief)

      commit({
        ...save,
        state: {
          ...save.state,
          teamAbilities: teamAbilities.map((row, team) => (team === myTeam ? mine : row)),
          teamMorale: clampTo(teamMorale - loss, MORALE_LIMIT),
          // ⚠️ 트레이닝이 SR+4 를 세우는 자리는 문서에 없다. 외출(0xc81c)과 같은 규칙으로 둔다 (추정)
          record: { ...record, acted: true },
        },
      })
      setScene(SEASON_SCENE_STATE.관리메뉴)
    },
    [commit, random, save],
  )

  /**
   * 시즌 외출 (결과 `0xc81c`, P4 3절 표).
   * 사기 난수는 [a, b) 이고 **친선경기(0)·야구교실(3)은 부호를 뒤집는다**(0xc8b0).
   * 소지금은 정액이지만 친선경기만 `rand(8,11)` 을 굴린다.
   */
  const runOuting = useCallback(
    (place: number) => {
      if (save === null) return
      const effect = SEASON_OUTING_EFFECTS[place]
      if (effect === undefined) return
      const { record, teamMorale } = save.state

      const rolled = randomIntegerBelow(random, effect.moraleRange[0], effect.moraleRange[1])
      const moraleChange = effect.negatesMorale ? -rolled : rolled
      const money = effect.moneyRange === undefined
        ? effect.money
        : randomIntegerBelow(random, effect.moneyRange[0], effect.moneyRange[1])
      const popularity = effect.popularityRange === undefined
        ? 0
        : randomIntegerBelow(random, effect.popularityRange[0], effect.popularityRange[1])
      const reputation = effect.reputationRange === undefined
        ? 0
        : randomIntegerBelow(random, effect.reputationRange[0], effect.reputationRange[1])

      // 입원(장소 2)이면 치료를 굴린다 — `rand(0,101) ≤ 89` 이거나 여유 칸이 0 이면 낫는다 (0xcc6a)
      const cured = place === HOSPITAL_PLACE ? cureIllnessAtHospital(record, random).record : record

      commit({
        ...save,
        state: {
          ...save.state,
          teamMorale: clampTo(teamMorale + moraleChange, MORALE_LIMIT),
          record: {
            ...cured,
            // 비용은 가드가 본 것과 같은 표를 쓴다 — 효과의 money 가 이미 음수라 따로 빼지 않는다
            money: clampTo(record.money + money, MONEY_LIMIT),
            popularity: clampTo(record.popularity + popularity, POPULARITY_LIMIT),
            reputation: clampTo(record.reputation + reputation, REPUTATION_LIMIT),
            acted: true,
          },
        },
      })
      setScene(SEASON_SCENE_STATE.관리메뉴)
    },
    [commit, random, save],
  )

  /**
   * 시즌 끝 사슬 한 칸 (SEASON_END_CHAIN). 사슬 밖이면 결산으로 보낸다.
   *
   * 시상·목표·순위 이벤트의 **보상을 실제로 얹는다** (P4 2a) — 예전에는 화면이 문구만
   * 띄우고 인기도·평판·소지금이 하나도 안 움직였다.
   */
  const nextSeasonEndStep = useCallback(
    (reward?: SeasonAwardReward) => {
      if (save !== null && reward !== undefined) {
        const { record } = save.state
        commit({
          ...save,
          state: {
            ...save.state,
            record: {
              ...record,
              popularity: clampTo(record.popularity + reward.popularity, POPULARITY_LIMIT),
              reputation: clampTo(record.reputation + reward.reputation, REPUTATION_LIMIT),
              money: clampTo(record.money + reward.money, MONEY_LIMIT),
            },
          },
        })
      }
      setScene((current) => {
        const step = SEASON_END_CHAIN.find((candidate) => candidate.state === current)
        return step?.next ?? SEASON_SCENE_STATE.시즌결산
      })
    },
    [commit, save],
  )

  /**
   * 리그 1위 G 지급 (`0x6900` → `0x87e8`). 받은 칸은 **전역 저장 +0x145 비트**라
   * 시즌을 새로 시작해도 남는다 — 그래서 시즌 저장이 아니라 따로 둔다.
   */
  const awardLeagueFirst = useCallback(
    (award: LeagueFirstAward) => {
      setLeagueFirstAwardedBits((bits) => bits | (1 << award.bit))
      setGamePoints((points) => Math.min(GAME_POINT_LIMIT, points + award.gamePoint))
    },
    [],
  )

  /**
   * 결산을 닫았다 (`0x87b4`) — 연차 idx 가 **짝수**면 국가대항전, 홀수면 곧장 새 해다.
   * 새 해는 `startNextYear`(0x6e0c)가 연차를 올리고 CPU 9팀 능력치를 +30 한다.
   */
  const finishSeason = useCallback(() => {
    if (save === null) return
    const { record } = save.state
    if (isSeasonNationalCupYear(record.yearIndex)) {
      commit({
        ...save,
        state: { ...save.state, record: { ...record, nationalCup: true } },
        cup: createNationalCup(),
      })
      return setScene(SEASON_SCENE_STATE.국가대항전)
    }
    // 새 해로 넘어가며 리그 전적·선수 성적을 비운다 (정규시즌 표는 해마다 새로 센다)
    commit({
      ...save,
      state: startNextYear(save.state),
      league: EMPTY_LEAGUE,
      playerStats: EMPTY_LEAGUE_PLAYER_STATS,
      series: null,
      ranking: [],
    })
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [commit, save])

  const spendGamePoint = useCallback((cost: number) => {
    setGamePoints((points) => Math.max(0, points - cost))
  }, [])

  const goto = useCallback((next: SeasonSceneState) => setScene(next), [])
  const clearNotice = useCallback(() => setNotice(''), [])
  const quit = useCallback(() => setScene(SEASON_SCENE_STATE.팀고르기), [])

  return {
    state: save?.state ?? null,
    scene,
    league: save?.league ?? EMPTY_LEAGUE,
    roster: save?.roster ?? EMPTY_ROSTER,
    playerStats: save?.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
    series: save?.series ?? null,
    ranking: save?.ranking ?? [],
    gameOptions,
    gameKind,
    leagueFirstAwardedBits,
    // ⚠️ **테스트용** — `?무한G` 면 보여 주는 값만 최대로 올린다 (저장은 그대로다)
    gamePoints: isInfiniteGamePointOn() ? GAME_POINT_LIMIT : gamePoints,
    cup: save?.cup ?? null,
    notice,
    actions: {
      chooseTeam, goto, updateRecord, updateRoster, playNextGame, confirmIncome,
      playCupGame, finishCup, finishGame, continuePostseason,
      runTraining, runOuting, nextSeasonEndStep, awardLeagueFirst, spendGamePoint, finishSeason,
      clearNotice, quit,
    },
  }
}

/** 내 팀·상대 팀의 지금 순위 (0부터) — 관중 수 계산의 입력 (0xb7aa1) */
export function seasonRanksOf(league: League, record: SeasonRecord) {
  const ranking = rankingOf(league)
  const rankOf = (team: number) => Math.max(0, ranking.indexOf(team))
  return { myRank: rankOf(record.teamId), opponentRank: rankOf(seasonOpponentOf(record)) }
}

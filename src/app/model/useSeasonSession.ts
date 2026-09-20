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
import { EMPTY_LEAGUE, rankingOf } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'
import { recordLeagueResult } from '@/entities/league/model/league'
import { playLeagueDay, simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { TEAMS } from '@/shared/config/original/teams'
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
  readonly clearNotice: () => void
  readonly quit: () => void
}

/** 저장 칸 하나에 시즌 상태·리그 전적·로스터를 함께 담는다 (원본 저장 0x22755 에 해당) */
interface SeasonSave {
  readonly state: SeasonState
  readonly league: League
  readonly roster: SeasonTeamRoster
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
  const playNextGame = useCallback(() => {
    if (save === null) return
    const { record } = save.state
    const opponent = seasonOpponentOf(record)
    // 홈/원정은 원본이 0xb7844 로 정하는데 어느 쪽이 홈인지 문서에 없다 — 번호가 작은 쪽을 먼저 공격시킨다 (추정)
    const matchup = record.teamId < opponent
      ? { away: record.teamId, home: opponent }
      : { away: opponent, home: record.teamId }
    const score = simulateLeagueGame(matchup, random)
    const myRuns = matchup.away === record.teamId ? score.awayRuns : score.homeRuns
    const opponentRuns = matchup.away === record.teamId ? score.homeRuns : score.awayRuns
    // ⚠️ 0xb69c8 — 동점이면 먼저 공격한 쪽이 이긴 것으로 본다 (원본 그대로)
    const won = myRuns > opponentRuns || (myRuns === opponentRuns && matchup.away === record.teamId)

    const afterMyGame = won
      ? recordLeagueResult(save.league, record.teamId, opponent)
      : recordLeagueResult(save.league, opponent, record.teamId)
    // 같은 날 나머지 네 경기 (내 경기는 건너뛴다)
    const day = playLeagueDay(afterMyGame, record.games, record.teamId, random)

    const evaluation = evaluateSeasonGame(save.state.record, {
      myRuns,
      opponentRuns,
      won,
      // 웹판 자동 경기에는 내 투수가 없어 완투 등급을 매길 수 없다 — 늘 null(없음)이다
      popularityCompleteGame: null,
      reputationCompleteGame: null,
      opponentTeamId: opponent,
    })
    const evaluated = applySeasonGameEvaluation(save.state, evaluation)

    commit({
      ...save,
      league: day.league,
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
    setScene(SEASON_SCENE_STATE.관중수입)
  }, [commit, random, save])

  /** 관중수입 창에서 확인 — 정산된 레코드를 받아 경기 뒤 마무리로 간다 (0xf1) */
  const confirmIncome = useCallback(
    (record: SeasonRecord) => {
      if (save === null) return
      const settled: SeasonRecord = { ...record, phase: SEASON_PHASE.기본 }
      commit({ ...save, state: { ...save.state, record: settled } })
      if (settled.games >= SEASON_GAME_COUNT) {
        // 정규시즌 끝 — 포스트시즌·시상·결산 화면은 웹에 아직 없다
        setNotice('정규시즌이 끝났습니다. 포스트시즌 화면은 아직 없습니다.')
        return setScene(SEASON_SCENE_STATE.관리메뉴)
      }
      setScene(afterGameNext(settled))
    },
    [commit, save],
  )

  const goto = useCallback((next: SeasonSceneState) => setScene(next), [])
  const clearNotice = useCallback(() => setNotice(''), [])
  const quit = useCallback(() => setScene(SEASON_SCENE_STATE.팀고르기), [])

  return {
    state: save?.state ?? null,
    scene,
    league: save?.league ?? EMPTY_LEAGUE,
    roster: save?.roster ?? EMPTY_ROSTER,
    notice,
    actions: { chooseTeam, goto, updateRecord, updateRoster, playNextGame, confirmIncome, clearNotice, quit },
  }
}

/** 내 팀·상대 팀의 지금 순위 (0부터) — 관중 수 계산의 입력 (0xb7aa1) */
export function seasonRanksOf(league: League, record: SeasonRecord) {
  const ranking = rankingOf(league)
  const rankOf = (team: number) => Math.max(0, ranking.indexOf(team))
  return { myRank: rankOf(record.teamId), opponentRank: rankOf(seasonOpponentOf(record)) }
}

// @vitest-environment jsdom
/**
 * **시즌모드 장기 진행 점검 (soak)** — 화면 없이 `useSeasonSession` 을 팀 고르기부터 10년차 엔딩까지 돌린다.
 *
 * 사람 입력은 단순한 정책으로 대신한다 (`SeasonRoute` 가 화면 대신 부르는 액션을 그대로 부른다):
 * - 관리 메뉴: 아직 안 했으면 트레이닝(칸 0~3 차례), 했으면 [다음경기]. 트레이드 요청은 거절.
 * - 경기 전 마선수: 마투수 칸 0 · 마타자 칸 5. 경기정보: 경기진행 설정을 "전부 자동"(상세 · 값 0)으로 두고 시작.
 * - 경기(0xe1): `TeamGameScreen` 대신 로딩 팁 굴림 → `startTeamGame`(전부 자동이라 한 번에 끝난다) → 정산 진입 → 끝.
 * - 이벤트는 보상 명령을 모아 끝에 한 번에 준다 (`useSeasonSession.test` 의 `이벤트넘기기` 와 같다).
 * - 결산·국가대항전·엔딩은 그 화면(`SeasonSummaryScreen` · `NationalCupScreen` · `SeasonEndingScreen`)의 판정 함수를 그대로 부른다.
 *
 * 걸음마다 불가능한 값(NaN · 음수 · 상한 넘김), 리그 전적 합, 순위 차례, 경기 기록 → 리그 기록표 반영, 날짜(경기 수) 진행,
 * 저장 → 불러오기 왕복(JSON · 새 세션 마운트)을 본다. 문제는 모아 두었다가 판 끝에 한꺼번에 보인다.
 *
 * 길어서 기본은 짧은 판(첫 해 앞 몇 경기)만 돈다 — 긴 판은 `SOAK=1` 로 켠다:
 * `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/seasonSoak.test.tsx --maxWorkers=2`
 */
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import { SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_PLAYABLE_EVENTS, clearRepeatableSeen } from '@/entities/season-mode/model/seasonEventFlow'
import { PRE_GAME_ACE_PHASE } from '@/entities/season-mode/model/preGameFlow'
import {
  FINAL_YEAR_INDEX, MONEY_LIMIT, MORALE_LIMIT, POPULARITY_LIMIT, REPUTATION_LIMIT, SEASON_GAME_COUNT, TEAM_ABILITY_LIMIT,
} from '@/entities/season-mode/model/seasonRecord'
import { koreanSeriesRewardOf, nextLeagueFirstAward } from '@/entities/season-mode/model/seasonRewards'
import { seasonPostseasonRankOf } from '@/app/model/useSeasonSession'
import { confirmNationalCupStandings, finishNationalCup } from '@/entities/national-cup/model/nationalCupFlow'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { startTeamGame, summaryOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { leagueSideOf, opponentOf, rankingOf } from '@/entities/league/model/league'
import {
  EMPTY_LEAGUE_PLAYER_STATS, leagueBatterIdOf, recordLeaguePlateAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import {
  SoakProblems, batterLineProblemsOf, firstDiffOf, isSoakEnabled, jsonRoundTripDiffOf, leagueTallyProblemsOf,
  outOfRangeOf, rankingOrderProblemsOf, soakNumber, soakSeeds, unserializablePathsOf,
} from '@/app/model/soak/soakInvariants'

setActiveSound(createSilentSound())

/** 사람이 한 타석도 안 잡는 설정 — 상세 · 값 0 (`teamAutoRelay.test` 와 같다) */
const ALL_AUTO_SETTINGS = { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 } as const

function memoryStore(): JsonStorePort & { readonly held: () => unknown } {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
    held: () => held,
  }
}

interface SeasonSoakResult {
  readonly problems: SoakProblems
  readonly steps: number
  readonly games: { 정규: number; 포스트시즌: number; 국가대항전: number }
  readonly years: number
  readonly reachedEnding: boolean
  readonly yearLog: readonly string[]
  readonly stoppedAt: string | null
}

interface SeasonSoakOptions {
  readonly seed: number
  readonly teamId: number
  /** 이만큼 정규시즌 경기를 치르면 멈춘다 (짧은 판) — 없으면 엔딩까지 */
  readonly maxRegularGames?: number
  /** 저장 왕복을 몇 번째 관리 메뉴마다 볼지 (새 세션 마운트는 무겁다) */
  readonly roundTripEvery?: number
  /**
   * 관리 메뉴 정책 — `사람` 은 병이면 입원 · 사기가 낮으면 회식 · 그 밖은 트레이닝, `훈련만` 은 늘 트레이닝(사기 0 · 질병 · 연패 길을 오래 탄다)
   */
  readonly policy?: '사람' | '훈련만'
}

type Rendered = { readonly current: SeasonSession }

/** 같은 날 두 팀(내 팀 · 상대)의 타자 줄만 뽑는다 — 그날 다른 경기에 안 나온다 */
function battersOfTeams(stats: LeaguePlayerStats, teams: readonly number[]) {
  const out: Record<number, { atBats: number; hits: number; homeRuns: number; runsBattedIn: number }> = {}
  for (const [id, line] of Object.entries(stats.batters)) {
    const team = Math.floor(Number(id) / 12)
    if (!teams.includes(team)) continue
    out[Number(id)] = { atBats: line.atBats, hits: line.hits, homeRuns: line.homeRuns, runsBattedIn: line.runsBattedIn }
  }
  return out
}

function runSeasonSoak(options: SeasonSoakOptions): SeasonSoakResult {
  const { seed, teamId, maxRegularGames, roundTripEvery = 5, policy = '사람' } = options
  const store = memoryStore()
  const random = createSeededRandom(seed)
  const rendered = renderHook(() => useSeasonSession(store, random))
  const result: Rendered = rendered.result
  const problems = new SoakProblems()
  const games = { 정규: 0, 포스트시즌: 0, 국가대항전: 0 }
  let steps = 0
  let trainingSlot = 0
  let managementVisits = 0
  let handledSummaryEntry: number | null = null
  let reachedEnding = false
  const yearLog: string[] = []
  let stoppedAt: string | null = null
  const startYear = { value: 0 }
  // 장면 0x105 를 세운다 — 라우트가 들어올 때 한 번 (`SeasonRoute` 의 useLayoutEffect)
  act(() => result.current.actions.constructScene())

  const where = () => {
    const record = result.current.state?.record
    return `씨앗 ${seed} · ${record === undefined ? '-' : `${record.yearIndex + 1}년차 g${record.games}${record.inPostseason ? '(PS)' : ''}`}`
      + ` · 장면 0x${result.current.scene.toString(16)} · 걸음 ${steps}`
  }

  /** 걸음마다 보는 값 — 불가능한 값 · 리그 전적 · 순위 */
  const checkState = () => {
    const session = result.current
    const state = session.state
    if (state === null) return
    const { record } = state
    const at = where()
    problems.add(at, outOfRangeOf('record', {
      money: record.money, popularity: record.popularity, reputation: record.reputation, games: record.games,
      yearIndex: record.yearIndex, storeGames: record.storeGames, aimVisionGames: record.aimVisionGames,
      illness: record.illness, crowdLevel: record.crowdLevel, regularSeasonFirsts: record.regularSeasonFirsts,
      tradeRequestCount: record.tradeRequestCount, popularityAtSeasonStart: record.popularityAtSeasonStart,
    }, 0))
    problems.add(at, outOfRangeOf('record(상한)', { money: record.money }, 0, MONEY_LIMIT))
    problems.add(at, outOfRangeOf('record(상한)', { popularity: record.popularity }, 0, POPULARITY_LIMIT))
    problems.add(at, outOfRangeOf('record(상한)', { reputation: record.reputation }, 0, REPUTATION_LIMIT))
    problems.add(at, outOfRangeOf('record(상한)', { yearIndex: record.yearIndex }, 0, FINAL_YEAR_INDEX))
    problems.add(at, outOfRangeOf('state', { teamMorale: state.teamMorale }, 0, MORALE_LIMIT))
    state.teamAbilities.forEach((row, team) =>
      problems.add(at, outOfRangeOf(`teamAbilities[${team}]`, Object.fromEntries(row.map((v, i) => [i, v])), 0, TEAM_ABILITY_LIMIT)))
    if (!record.inPostseason && !record.nationalCup) {
      problems.add(at, outOfRangeOf('record(정규)', { games: record.games }, 0, SEASON_GAME_COUNT))
      // 정규시즌은 열 팀이 매일 한 경기씩 — 팀마다 승 + 패 = 경기 수 (무승부 없음)
      problems.add(at, leagueTallyProblemsOf('league', session.league, record.games))
    } else {
      problems.add(at, leagueTallyProblemsOf('league', session.league, null))
      // 정규시즌이 끝난 리그 — 일정표 0xd89cb 아홉 날 × 5 바퀴라 두 팀은 꼭 다섯 번 만났다
      if (record.inPostseason) {
        for (let a = 0; a < 10; a += 1) {
          for (let b = a + 1; b < 10; b += 1) {
            const met = (session.league.headToHead[a]?.[b] ?? 0) + (session.league.headToHead[b]?.[a] ?? 0)
            if (met !== SEASON_GAME_COUNT / 9) problems.add(at, [`정규시즌 끝 리그: 팀 ${a}·${b} 맞대결 ${met} ≠ 5`])
          }
        }
      }
    }
    const series = session.series
    if (series !== null) {
      problems.add(at, outOfRangeOf('series.wins', { a: series.wins[0], b: series.wins[1] }, 0, series.winsNeeded))
      if (series.round === '종료' && (series.champion === null || !series.qualifiers.includes(series.champion))) {
        problems.add(at, [`포스트시즌이 끝났는데 우승 팀이 대진 밖이다: ${series.champion}`])
      }
      if (series.teams[0] === series.teams[1]) problems.add(at, [`시리즈 두 칸이 같은 팀 ${series.teams[0]}`])
    }
    if (session.cup !== null) problems.add(at, outOfRangeOf('cup', { day: session.cup.day }, 0, 10))
    problems.add(at, rankingOrderProblemsOf('rankingOf', rankingOf(session.league), session.league.wins, session.league.losses))
    for (const [id, line] of Object.entries(session.playerStats.batters)) problems.add(at, batterLineProblemsOf(`batters[${id}]`, line))
    for (const [id, line] of Object.entries(session.playerStats.pitchers ?? {})) {
      problems.add(at, outOfRangeOf(`pitchers[${id}]`, {
        outs: line.outs, runsAllowed: line.runsAllowed, strikeouts: line.strikeouts, wins: line.wins, losses: line.losses, saves: line.saves,
      }, 0))
    }
  }

  /** 저장 왕복 — 담긴 값이 JSON 을 지나도 같고, 그 저장으로 새로 띄운 세션이 같은 상태를 본다 */
  const checkRoundTrip = () => {
    const held = store.held()
    if (held === null) return
    const at = where()
    problems.add(at, unserializablePathsOf(held, '저장').slice(0, 5))
    const diff = jsonRoundTripDiffOf(held)
    if (diff !== null) problems.add(at, [`저장 JSON 왕복이 다르다: ${diff}`])
    const reloadStore: JsonStorePort = { load: () => JSON.parse(JSON.stringify(held)), save: () => {} }
    const reloaded = renderHook(() => useSeasonSession(reloadStore, createSeededRandom(1)))
    try {
      const now = result.current
      const again = reloaded.result.current
      const pairs: readonly [string, unknown, unknown][] = [
        
        // 다시 띄우면 장면 0x105 가 새로 서며(0x3b14 → 0x8ce94 → 0xacf60) 반복 이벤트(490) 본 비트를 지운다 — 원본 그대로라 같은 지움을 얹어 견준다
        ['state', now.state === null ? null : { ...now.state, record: clearRepeatableSeen(now.state.record) }, again.state], ['league', now.league, again.league], ['roster', now.roster, again.roster],
        ['playerStats', now.playerStats, again.playerStats], ['series', now.series, again.series], ['cup', now.cup, again.cup],
      ]
      for (const [name, a, b] of pairs) {
        const d = firstDiffOf(a, b, name)
        if (d !== null) problems.add(at, [`다시 띄운 세션이 다르다: ${d}`])
      }
    } finally {
      reloaded.unmount()
    }
  }

  /** 경기 한 판 — `TeamGameScreen` 대신 */
  const playGame = () => {
    const session = result.current
    const options = session.gameOptions
    if (options === null) {
      problems.add(where(), ['경기직전인데 경기 옵션이 없다'])
      return false
    }
    const kind = session.gameKind
    const before = session.playerStats
    const recordBefore = session.state?.record
    rollSceneLoadingTip(random)
    const progress = startTeamGame({ ...options, settings: ALL_AUTO_SETTINGS }, random)
    if (!progress.game.isFinished) {
      problems.add(where(), ['전부 자동 경기가 한 번에 끝나지 않았다'])
      return false
    }
    const summary: TeamGameSummary = summaryOf(progress)
    if (process.env.SOAK_DEBUG === '1') console.info(`[경기] ${where()} ${kind} ${summary.ourTeamId}:${summary.opponentTeamId} ${summary.ourScore}-${summary.opponentScore} 이닝 ${summary.inningsPlayed} side ${options.playerSide} 결과 ${summary.result} 사기 ${session.state?.teamMorale} 질병 ${session.state?.record.illness} 스태미나 ${(options.ourPitcherStaminas ?? []).join(',')}`)
    problems.add(where(), outOfRangeOf('summary', {
      ourScore: summary.ourScore, opponentScore: summary.opponentScore, inningsPlayed: summary.inningsPlayed,
      hitsAllowed: summary.pitching.hitsAllowed, outsRecorded: summary.pitching.outsRecorded,
    }, 0))
    act(() => result.current.actions.enterGameSettlement(summary))
    act(() => result.current.actions.finishGame(summary))
    games[kind] += 1
    // 정규시즌이면 그날 두 팀(내 팀 · 상대)의 타자 기록 증가분이 이 경기 타석과 같아야 한다 — 그날 다른 경기에 안 나온다
    if (kind === '정규' && recordBefore !== undefined) {
      // 일정표 0xd89cb · 홈/원정 0xb7844 대로 — 그날(경기 수 g) 상대와 측
      if (summary.opponentTeamId !== opponentOf(recordBefore.games, recordBefore.teamId)) {
        problems.add(where(), [`정규 g${recordBefore.games} 상대 ${summary.opponentTeamId} ≠ 일정표 ${opponentOf(recordBefore.games, recordBefore.teamId)}`])
      }
      if (options.playerSide !== leagueSideOf(recordBefore.games, recordBefore.teamId)) {
        problems.add(where(), [`정규 g${recordBefore.games} 측 ${options.playerSide} ≠ 일정표 ${leagueSideOf(recordBefore.games, recordBefore.teamId)}`])
      }
      const teams = [summary.ourTeamId, summary.opponentTeamId]
      const after = battersOfTeams(result.current.playerStats, teams)
      const prior = battersOfTeams(before, teams)
      const expectedDelta = recordLeaguePlateAppearances(EMPTY_LEAGUE_PLAYER_STATS, summary.leaguePlateAppearances)
      const ids = new Set([...Object.keys(after), ...Object.keys(expectedDelta.batters)].map(Number))
      for (const id of ids) {
        const team = Math.floor(id / 12)
        if (!teams.includes(team)) continue
        const a = after[id] ?? { atBats: 0, hits: 0, homeRuns: 0, runsBattedIn: 0 }
        const p = prior[id] ?? { atBats: 0, hits: 0, homeRuns: 0, runsBattedIn: 0 }
        const e = expectedDelta.batters[id] ?? { atBats: 0, hits: 0, homeRuns: 0, runsBattedIn: 0 }
        for (const key of ['atBats', 'hits', 'homeRuns', 'runsBattedIn'] as const) {
          if (a[key] - p[key] !== e[key]) {
            problems.add(where(), [`경기 기록 → 리그 기록표: 타자 ${id}(팀 ${team}) ${key} 증가 ${a[key] - p[key]} ≠ 경기 타석 ${e[key]}`])
          }
        }
      }
      // 경기 수는 한 경기에 하나 — 날짜(L+0x32 = SR+0xb2)가 일정표대로 하루씩 간다
      const recordAfter = result.current.state?.record
      if (recordAfter !== undefined && !recordAfter.inPostseason && recordAfter.games !== recordBefore.games + 1) {
        problems.add(where(), [`정규 경기 뒤 경기 수 ${recordBefore.games} → ${recordAfter.games} (하루 한 칸이어야)`])
      }
      if (leagueBatterIdOf(summary.ourTeamId, 0) !== summary.ourTeamId * 12) problems.add(where(), ['타자 열쇠 꼴이 바뀌었다'])
    }
    return true
  }

  const maxSteps = soakNumber('SOAK_MAX_STEPS', 60000)
  let lastProgressKey = ''
  let sameKeySteps = 0
  try {
    for (; steps < maxSteps; steps += 1) {
      const session = result.current
      const { state, scene, actions } = session
      // 멈춤 감지 — 걸음이 바뀌어도 장면 · 경기 수 · 연차가 수천 걸음 그대로면 고리다
      const progressKey = `${scene}:${state?.record.games}:${state?.record.yearIndex}:${state?.record.phase}:${session.eventPlayback?.serial}`
        + `:${games.정규 + games.포스트시즌 + games.국가대항전}:${session.series?.wins.join(',')}:${session.cup?.day}`
      if (progressKey === lastProgressKey) sameKeySteps += 1
      else sameKeySteps = 0
      lastProgressKey = progressKey
      if (sameKeySteps > 50) {
        stoppedAt = `멈춤: ${where()}`
        break
      }

      if (session.notice !== '') {
        act(() => actions.clearNotice())
        continue
      }
      if (session.trainingResult !== null) {
        act(() => actions.closeTrainingResult())
        continue
      }
      if (state === null || scene === SEASON_SCENE_STATE.팀고르기) {
        act(() => actions.chooseTeam(teamId, '소크'))
        startYear.value = result.current.state?.record.yearIndex ?? 0
        continue
      }
      if (maxRegularGames !== undefined && games.정규 >= maxRegularGames) break

      switch (scene) {
        case SEASON_SCENE_STATE.이벤트재생: {
          const playback = session.eventPlayback
          if (playback === null) {
            stoppedAt = `이벤트재생인데 재생할 이벤트가 없다: ${where()}`
            break
          }
          const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
          const rewards = (event?.commands ?? []).flatMap((command) => (command.op === 'reward' ? command.items : []))
          act(() => result.current.actions.finishSeasonEvent(rewards, [playback.eventId]))
          break
        }
        case SEASON_SCENE_STATE.관리메뉴: {
          if (session.isTradeRequestAlertOpen) {
            act(() => actions.answerTradeRequest(false))
            break
          }
          if (state.record.phase === SEASON_PHASE.엔딩 || state.record.endingSeen) {
            reachedEnding = true
            break
          }
          managementVisits += 1
          if (managementVisits % roundTripEvery === 0) checkRoundTrip()
          if (!state.record.acted) {
            // 사람 흉내 — 병이 들면 입원(외출 2, 비용 5) · 사기가 낮으면 회식(외출 1, 비용 4) · 그 밖은 트레이닝 칸 0~3 차례.
            // 트레이닝만 하면 사기가 0 까지 내려가 내 팀이 끝없이 져 포스트시즌을 한 번도 못 본다
            const outing = policy === '훈련만' ? null : state.record.illness > 0 && state.record.money >= 5 ? 2
              : state.teamMorale < 70 && state.record.money >= 4 ? 1 : null
            if (outing !== null) {
              act(() => actions.enterOuting(outing))
            } else {
              act(() => actions.runTraining(trainingSlot % 4))
              trainingSlot += 1
            }
          } else {
            act(() => actions.openNextGame())
          }
          break
        }
        case SEASON_SCENE_STATE.외출연출:
          // 연출이 끝난 틀에 결과 0xc81c → 결과 팝업 0x17 을 닫으면 0xc9
          if (session.outingResultText === null && session.outingPlace !== null) {
            const place = session.outingPlace
            act(() => actions.runOuting(place))
          } else {
            act(() => actions.closeOutingResult())
          }
          break
        case SEASON_SCENE_STATE.다음경기:
          act(() => actions.confirmNextGame())
          break
        case SEASON_SCENE_STATE.선수단:
          act(() => actions.choosePreGameAce(session.preGameAces.phase === PRE_GAME_ACE_PHASE.마투수 ? 0 : 5))
          break
        case SEASON_SCENE_STATE.경기정보:
          if (session.isMatchSettingsOpen) act(() => actions.applyMatchSettings(ALL_AUTO_SETTINGS))
          if (result.current.isMatchSettingsOpen) act(() => result.current.actions.toggleMatchSettings())
          act(() => result.current.actions.startPendingGame())
          break
        case SEASON_SCENE_STATE.경기직전:
          if (!playGame()) stoppedAt = `경기를 못 끝냈다: ${where()}`
          break
        case SEASON_SCENE_STATE.관중수입:
          act(() => actions.confirmIncome(state.record))
          break
        case SEASON_SCENE_STATE.경기뒤마무리:
          act(() => actions.confirmDayResults())
          break
        case SEASON_SCENE_STATE.시즌결산: {
          // `SeasonSummaryScreen` — 진입마다 리그 1위 G 검사 한 번, 시리즈가 안 끝났으면 [경기], 끝났으면 우승 문구 → 보상
          const entry = session.summaryEntry
          if (entry !== null && handledSummaryEntry !== entry.serial) {
            handledSummaryEntry = entry.serial
            if (session.series !== null && session.series.round === '준플레이오프' && session.series.wins[0] + session.series.wins[1] === 0) {
              yearLog.push(`${state.record.yearIndex + 1}년차 ${session.series.qualifiers.indexOf(state.record.teamId) + 1}시드 (${session.league.wins[state.record.teamId]}승)`)
            }
            const award = nextLeagueFirstAward(state.record, session.leagueFirstAwardedBits)
            if (award !== null) act(() => actions.awardLeagueFirst(award))
            break
          }
          const series = session.series
          if (series !== null && series.round !== '종료') {
            act(() => actions.continuePostseason())
            break
          }
          const reward = koreanSeriesRewardOf(seasonPostseasonRankOf(state.record, session.league, series))
          act(() => actions.finishSeason(reward.messageId === 0 ? null : reward))
          break
        }
        case SEASON_SCENE_STATE.국가대항전: {
          const cup = session.cup
          if (cup === null) {
            stoppedAt = `국가대항전인데 대회가 없다: ${where()}`
            break
          }
          // `NationalCupScreen` — 대진 확인(0xe6f8)이 다음 경기면 순위 → 경기, 끝났으면 결과 → 보상 → 끝
          const next = confirmNationalCupStandings(cup, random)
          if (next.kind === '다음경기') {
            const matchup = nationalCupMatchupOf(cup)
            if (matchup === null) {
              stoppedAt = `대회 다음 경기인데 대진이 없다: ${where()}`
              break
            }
            act(() => actions.playCupGame(matchup.myTeam, matchup.opponent))
          } else {
            act(() => actions.finishCup(finishNationalCup('시즌모드', next.cup)))
          }
          break
        }
        case SEASON_SCENE_STATE.엔딩:
          reachedEnding = true
          act(() => actions.receiveEndingBonus())
          act(() => result.current.actions.finishEnding())
          break
        default:
          stoppedAt = `다룰 줄 모르는 장면: ${where()}`
      }
      if (stoppedAt !== null) break
      checkState()
      if (reachedEnding && result.current.scene === SEASON_SCENE_STATE.관리메뉴) break
    }
    if (steps >= maxSteps) stoppedAt = `걸음 한도 ${maxSteps}: ${where()}`
    checkRoundTrip()
  } finally {
    rendered.unmount()
  }
  const years = (result.current.state?.record.yearIndex ?? 0) - startYear.value + 1
  return { problems, steps, games, years, reachedEnding, stoppedAt, yearLog }
}

function report(result: SeasonSoakResult): string {
  return `걸음 ${result.steps} · 경기 정규 ${result.games.정규} · PS ${result.games.포스트시즌} · 대회 ${result.games.국가대항전}`
    + ` · 연차 ${result.years} · 엔딩 ${result.reachedEnding} · [${result.yearLog.join(' / ')}]${result.stoppedAt === null ? '' : `\n멈춘 곳: ${result.stoppedAt}`}`
    + (result.problems.size === 0 ? '' : `\n문제 ${result.problems.size}가지:\n${result.problems.report()}`)
}

describe('시즌모드 장기 진행 점검 (soak)', () => {
  it('짧은 판 — 첫 해 6경기를 정책대로 치러도 값이 맞고 저장 왕복이 같다', () => {
    const result = runSeasonSoak({ seed: 2010, teamId: 0, maxRegularGames: 6, roundTripEvery: 1 })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.정규).toBe(6)
  }, 60_000)

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed} · 훈련만: 사기 0 · 질병 길로 10년차 엔딩까지`, () => {
      const result = runSeasonSoak({ seed, teamId: (seed + 5) % 10, policy: '훈련만', roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.reachedEnding, report(result)).toBe(true)
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed}: 팀 고르기부터 10년차 엔딩까지`, () => {
      const started = Date.now()
      const result = runSeasonSoak({ seed, teamId: seed % 10, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
      console.info(`[시즌 soak] 씨앗 ${seed} · ${(Date.now() - started) / 1000}s · ${report(result)}`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.reachedEnding, report(result)).toBe(true)
      expect(result.years, report(result)).toBe(FINAL_YEAR_INDEX + 1)
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
  }
})

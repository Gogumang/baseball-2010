// @vitest-environment jsdom
/**
 * **나만의리그 투수편 장기 진행 점검 (soak)** — 화면 없이 `usePitcherLeagueSession` 을 새 투수 등록부터 은퇴 · 엔딩까지 돌린다.
 *
 * 사람 입력은 단순한 정책으로 대신한다 (`PitcherLeagueRoute` 와 그 화면들이 부르는 액션 · 모델 함수를 그대로 부른다):
 * - 관리(105): 이번 주기에 아직 안 했으면 — 사기가 낮거나 아프거나 다쳤으면 [휴식](`runPitcherRest` → 결과 창 닫힘 `recoverAfterPitcherRest`),
 *   아니면 [트레이닝] 칸 0~3 차례(`runPitcherTraining` → 상세 창 닫힘 `rollTrainingInjury`). 했으면 [다음경기]. 화면
 *   `usePitcherManagementMenu` 의 차례 그대로다. 칭호 · 알림 팝업은 확인.
 * - 109 순위표 · 142 경기 준비는 확인. 경기(144)는 `PitcherGameScreen`/`usePitcherGame` 대신 로딩 팁 굴림 → `startPitcherGame` →
 *   사람 차례마다 구질 칸을 차례로 · 게이지 칸을 돌려 던지고(`startPitch` 붙듦), 수비 판 · 주자 판은 키 없이 끝까지 돌려 푼다
 *   (`runDefensePlay` · `runLiveRunnerPlayWithoutKeys` — 화면이 결과를 못 넘긴 갈래와 같다), 벤치 클리어링은 목표 틱까지 본 것으로,
 *   감독 창 · 돌발 창 · 0xe 확인은 닫는다.
 * - 이벤트는 재생기처럼 명령을 따라가 보상을 모으고, 선택지는 첫 칸(380 은 383 수락 · 502/496 은 연봉 협상 = 은퇴 안 함),
 *   경기 명령(마선수 대결)은 `beginAceMatch` → `finishAceMatch`(번갈아 이김/짐).
 * - 포스트시즌 · 국가대항전(`NationalCupScreen` 판정) · 연차표지 · 엔딩도 그 화면의 길대로.
 *
 * 걸음마다 불가능한 값, 리그 전적 합 · 순위, 내 투수 기록(경기 요약 → 시즌 · 통산 누계), 날짜(일정표) · 로테이션, 저장 왕복을 본다.
 *
 * 기본은 짧은 판(몇 경기)만 — 긴 판은 `SOAK=1`:
 * `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/pitcherLeagueSoak.test.tsx --maxWorkers=2`
 */
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { enterPitcherGameEvaluation, pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_TRAINING_MENUS, pitcherTrainingBlockReasonOf, runPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement'
import { pitcherRestBlockReasonOf, recoverAfterPitcherRest, runPitcherRest } from '@/pages/pitcher-league/model/pitcherRest'
import { rollTrainingInjury } from '@/entities/career/model/condition'
import {
  closeBurstWindow, closeManagerHookWindow, confirmScene, isPitchTurn, pitchSlotsFor, resolveBenchClearing, resolveDefensePlay,
  resolveRunnerPlay, startPitch, startPitcherGame, startsToday, summaryOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { opponentOf, rankingOf } from '@/entities/league/model/league'
import { confirmNationalCupStandings, finishNationalCup } from '@/entities/national-cup/model/nationalCupFlow'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { forgetRepeatableEvents } from '@/entities/story/model/storyScene'
import { rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import {
  SoakProblems, batterLineProblemsOf, firstDiffOf, isSoakEnabled, jsonRoundTripDiffOf, leagueTallyProblemsOf, outOfRangeOf,
  rankingOrderProblemsOf, soakNumber, soakSeeds, unserializablePathsOf,
} from '@/app/model/soak/soakInvariants'

setActiveSound(createSilentSound())

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

/** 화면 쪽 훈련 결과 창 · 휴식 결과 창이 105 로 돌아갈 때 넘기는 앞 상태 (`usePitcherManagementMenu` 의 125 · 127) */
const TRAINING_RESULT_STATE = 0x7d
const REST_STATE = 0x7f

/** 경기 한 판 — `usePitcherGame` + `PitcherGameScreen` 대신. 사람 차례마다 구질 칸을 차례로 던진다 */
function playPitcherGameHeadless(options: PitcherGameOptions, random: RandomPort): { readonly summary: PitcherGameSummary; readonly pitches: number } {
  // 상태 7 진입 0x39f88 → 0x53dbc 의 로딩 팁 rand(0, 73) — `usePitcherGame` 의 첫 useState
  rollSceneLoadingTip(random)
  let progress = startPitcherGame(options, random)
  let pitches = 0
  for (let step = 0; step < 20_000; step += 1) {
    if (progress.game.isFinished) return { summary: summaryOf(progress), pitches }
    if (progress.managerHookText !== null) {
      progress = closeManagerHookWindow(progress, random)
      continue
    }
    if (progress.lastBurstResolution !== null && progress.lastBurstResolution !== undefined) {
      progress = closeBurstWindow(progress)
      continue
    }
    if (progress.pendingBenchClearing !== null) {
      progress = resolveBenchClearing(progress, { reachedTargetTick: true }, random)
      continue
    }
    const defense = progress.pendingDefensePlay
    if (defense !== null) {
      progress = resolveDefensePlay(progress, runDefensePlay(defense), random)
      continue
    }
    const runner = progress.pendingRunnerPlay
    if (runner != null) {
      progress = resolveRunnerPlay(progress, runLiveRunnerPlayWithoutKeys(runner), random)
      continue
    }
    if (progress.sceneConfirmPending === true) {
      progress = confirmScene(progress, random)
      continue
    }
    if (!isPitchTurn(progress)) throw new Error(`사람 차례도 붙든 판도 아닌데 경기가 안 끝났다 (${progress.game.inning}회 ${progress.game.half})`)
    const slots = pitchSlotsFor(progress).filter((slot) => slot.typeNumber > 0 && !slot.isMagic)
    const slot = slots[pitches % Math.max(1, slots.length)]
    progress = startPitch(progress, { typeNumber: slot?.typeNumber ?? 1, gaugeCell: (pitches * 3) % 10 }, random, true)
    pitches += 1
  }
  throw new Error('경기가 2만 걸음 안에 안 끝났다')
}

/** 이벤트 하나를 재생기처럼 따라간다 — 선택지는 고른 칸으로 이어 가고, 경기 명령에서 멈춘다 */
function walkEvent(events: readonly OriginalEvent[], eventId: number, pick: (event: OriginalEvent, choices: readonly number[]) => number) {
  const viewed: number[] = []
  const rewards: EventReward[] = []
  let current: number | null = eventId
  for (let guard = 0; current !== null && guard < 20; guard += 1) {
    const event = events.find((candidate) => candidate.id === current)
    viewed.push(current)
    current = null
    if (event === undefined) break
    for (const command of event.commands) {
      if (command.op === 'reward') rewards.push(...rewardsIn([command]))
      if (command.op === 'match') return { viewed, rewards, match: command }
      if (command.op === 'choice' && command.choices.length > 0) {
        current = pick(event, command.choices.map((choice) => choice.gotoEvent))
        break
      }
    }
  }
  return { viewed, rewards, match: null }
}

interface PitcherSoakOptions {
  readonly seed: number
  readonly role: number
  readonly teamId: number
  /** 이만큼 경기를 치르면 멈춘다 (짧은 판) — 없으면 엔딩까지 */
  readonly maxGames?: number
  /**
   * 능력치를 보직 상한으로 올려 시작한다 — 이 정책(가운데 공 · 칸 차례)으로는 인기도가 오르지 않아 7년차 방출(501, 인기도 ≤ 499)로
   * 끝나므로, 포스트시즌 · 국가대항전 · 13년차 은퇴 길을 밟으려면 센 투수가 있어야 한다. 원본에도 있는 꼴(상한 안의 값)이다
   */
  readonly boostAbility?: boolean
  readonly roundTripEvery?: number
}

interface PitcherSoakResult {
  readonly problems: SoakProblems
  readonly steps: number
  readonly games: { 리그: number; 포스트시즌: number; 대회: number; 등판: number; 대결: number }
  readonly seasons: number
  readonly endingIndex: number | null
  readonly stoppedAt: string | null
  readonly yearLog: readonly string[]
}

type Rendered = { readonly current: PitcherLeagueSession }

async function runPitcherSoak(options: PitcherSoakOptions): Promise<PitcherSoakResult> {
  const { seed, role, teamId, maxGames, roundTripEvery = 5, boostAbility = false } = options
  const store = memoryStore()
  const random = createSeededRandom(seed)
  const rendered = renderHook(() => usePitcherLeagueSession(store, random, false))
  const result: Rendered = rendered.result
  const problems = new SoakProblems()
  const games = { 리그: 0, 포스트시즌: 0, 대회: 0, 등판: 0, 대결: 0 }
  const yearLog: string[] = []
  let steps = 0
  let trainingSlot = 0
  let managementVisits = 0
  let aceMatches = 0
  let stoppedAt: string | null = null
  let endingIndex: number | null = null
  let cupEntrySerial: object | null = null

  const where = () => {
    const career = result.current.career
    return `씨앗 ${seed} · ${career === null ? '-' : `${career.season}년차 g${career.gamesPlayed}${career.postseason !== null ? '(PS)' : ''}`}`
      + ` · ${result.current.scene} · 걸음 ${steps}`
  }

  const checkCareer = () => {
    const career = result.current.career
    if (career === null) return
    const at = where()
    problems.add(at, outOfRangeOf('career', {
      gamePoint: career.gamePoint, season: career.season, gamesPlayed: career.gamesPlayed, popularity: career.popularity,
      reputation: career.reputation, morale: career.morale, money: career.money, salary: career.salary, stamina: career.stamina,
      magicLevel: career.magicLevel, injuryRemaining: career.injuryRemaining, illnessRemaining: career.illnessRemaining,
      illnessCooldown: career.illnessCooldown, positionCode: career.positionCode, regularSeasonFirstCount: career.regularSeasonFirstCount,
      wins: (career as { wins?: number }).wins, losses: (career as { losses?: number }).losses,
    }, 0))
    problems.add(at, outOfRangeOf('career.ability', { ...career.ability }, 0))
    problems.add(at, outOfRangeOf('career.equipmentLevels', { ...career.equipmentLevels }, 0))
    problems.add(at, outOfRangeOf('career(상한)', { morale: career.morale }, 0, 100))
    for (const [name, stats] of [['stats', career.stats], ['careerStats', career.careerStats]] as const) {
      problems.add(at, outOfRangeOf(`career.${name}`, {
        games: stats.games, outs: stats.outs, runsAllowed: stats.runsAllowed, saves: stats.saves, strikeouts: stats.strikeouts,
        pitches: stats.pitches, wins: stats.wins, losses: stats.losses, walks: stats.walks,
      }, 0))
    }
    if (career.careerStats.outs < career.stats.outs) problems.add(at, [`통산 아웃 ${career.careerStats.outs} < 시즌 아웃 ${career.stats.outs}`])
    const { league } = career
    if (career.postseason === null && career.nationalCup === undefined && career.seasonEndState === null) {
      problems.add(at, leagueTallyProblemsOf('league', league, career.gamesPlayed))
    } else {
      problems.add(at, leagueTallyProblemsOf('league', league, null))
    }
    problems.add(at, rankingOrderProblemsOf('rankingOf', rankingOf(league), league.wins, league.losses))
    for (const [id, line] of Object.entries(career.leaguePlayerStats.batters)) problems.add(at, batterLineProblemsOf(`batters[${id}]`, line))
    for (const [id, line] of Object.entries(career.leaguePlayerStats.pitchers ?? {})) {
      problems.add(at, outOfRangeOf(`pitchers[${id}]`, {
        outs: line.outs, runsAllowed: line.runsAllowed, strikeouts: line.strikeouts, wins: line.wins, losses: line.losses, saves: line.saves,
      }, 0))
    }
    const series = career.postseason
    if (series !== null) {
      problems.add(at, outOfRangeOf('series.wins', { a: series.wins[0], b: series.wins[1] }, 0, series.winsNeeded))
      if (series.teams[0] === series.teams[1]) problems.add(at, [`시리즈 두 칸이 같은 팀 ${series.teams[0]}`])
    }
    for (const [team, staminas] of Object.entries(career.leaguePitcherStaminas ?? {})) {
      problems.add(at, outOfRangeOf(`leaguePitcherStaminas[${team}]`, Object.fromEntries((staminas as readonly number[]).map((v, i) => [i, v])), 0, 10_000))
    }
  }

  const checkRoundTrip = async () => {
    const held = store.held()
    if (held === null) return
    const at = where()
    problems.add(at, unserializablePathsOf(held, '저장').slice(0, 5))
    const diff = jsonRoundTripDiffOf(held)
    if (diff !== null) problems.add(at, [`저장 JSON 왕복이 다르다: ${diff}`])
    const reloadStore: JsonStorePort = { load: () => JSON.parse(JSON.stringify(held)), save: () => {} }
    const reloaded = renderHook(() => usePitcherLeagueSession(reloadStore, createSeededRandom(1), false))
    try {
      // 다시 선 장면의 셋업(0xf684 → 0xacf60 반복 이벤트 본 표시 지움)은 r_event 본문이 온 뒤에 돈다 — 그때까지 기다린다
      await waitFor(() => expect(reloaded.result.current.storyEvents).not.toBeNull())
      const now = result.current.career
      // 116(경기결과)에서 끊고 이어하면 진입 0x1278c 가 다시 돌아 경기 뒤 카운터(12bc2~12c3c: 이번 시즌 인기도 합 +0x1c2 · 평판 0 연속 +0x184 ·
      // 무력감 · 먹튀)가 한 번 더 쌓인다 — 원본 그대로(`enterPitcherGameEvaluation` 머리말). 같은 재진입을 얹어 견준다
      const reentered = now !== null && result.current.scene === '경기결과' && now.seasonEndState === 116 ? enterPitcherGameEvaluation(now) : now
      // 다시 띄우면 나리 장면 0x106 이 새로 서며 셋업 0xf684 → 0x8ce94 → 0xacf60 이 반복 이벤트(452~454 · 490 …) 본 표시를 지운다 —
      // 메모리에서만 지우는 원본 그대로라(저장에는 다음 저장 때 같이 간다) 같은 지움을 얹어 견준다
      const events = result.current.storyEvents
      const expected = reentered === null || events === null ? reentered : forgetRepeatableEvents(reentered, events)
      const d = firstDiffOf(expected, reloaded.result.current.career, 'career')
      if (d !== null) problems.add(at, [`다시 띄운 세션이 다르다: ${d}`])
    } finally {
      reloaded.unmount()
    }
  }

  /** 경기 한 판 — 요약을 세션에 넘기고 기록 누계를 본다 */
  const playGame = () => {
    const session = result.current
    const options = session.gameOptions
    const before = session.career
    if (options === null || before === null) {
      problems.add(where(), ['경기인데 옵션이 없다'])
      return false
    }
    const isCup = session.cupMatch !== null || options.isNationalCup === true
    const isPostseason = before.postseason !== null && !isCup
    let played: ReturnType<typeof playPitcherGameHeadless>
    try {
      played = playPitcherGameHeadless(options, random)
    } catch (error) {
      problems.add(where(), [`경기 진행 예외: ${(error as Error).message}`])
      return false
    }
    const { summary } = played
    problems.add(where(), outOfRangeOf('summary', {
      ourScore: summary.ourScore, opponentScore: summary.opponentScore, pitchCount: summary.pitchCount, stamina: summary.stamina,
      outs: summary.seasonDelta.outs, runsAllowed: summary.seasonDelta.runsAllowed, strikeouts: summary.seasonDelta.strikeouts,
    }, 0))
    if (summary.ourScore === summary.opponentScore) problems.add(where(), [`무승부로 끝났다 ${summary.ourScore}-${summary.opponentScore}`])
    // 로테이션 — 선발 보직의 정규시즌 경기는 내 선발 날(0xa4f60)이면 등판한다
    if (!isCup && !isPostseason && role === PITCHER_ROLE.starter && startsToday(options) && !summary.hasEntered) {
      problems.add(where(), [`선발 날(g${options.dayCounter})인데 등판하지 않았다`])
    }
    // 일정표 0xd89cb — 정규시즌 상대는 그날(g = 치른 경기 수)의 표 칸
    if (!isCup && !isPostseason && options.opponentTeamId !== opponentOf(before.gamesPlayed, before.teamId)) {
      problems.add(where(), [`정규 g${before.gamesPlayed} 상대 ${options.opponentTeamId} ≠ 일정표 ${opponentOf(before.gamesPlayed, before.teamId)}`])
    }
    act(() => result.current.actions.finishGame(summary))
    if (isCup) games.대회 += 1
    else if (isPostseason) games.포스트시즌 += 1
    else games.리그 += 1
    if (summary.hasEntered) games.등판 += 1
    const after = result.current.career
    if (after !== null && !isCup) {
      // 경기 요약 → 시즌 · 통산 누계 (`applyPitcherGameResult` 의 mergeStats). 사사구는 상한이 있어 뺀다
      for (const name of ['stats', 'careerStats'] as const) {
        for (const key of ['outs', 'runsAllowed', 'strikeouts', 'pitches', 'wins', 'losses', 'saves'] as const) {
          const delta = after[name][key] - before[name][key]
          // 새 시즌 처리가 같은 걸음에 끼면(시즌 누계가 0 으로) 비교하지 않는다
          if (name === 'stats' && after.season !== before.season) continue
          if (delta !== summary.seasonDelta[key]) {
            problems.add(where(), [`${name}.${key} 증가 ${delta} ≠ 경기 요약 ${summary.seasonDelta[key]} (${isPostseason ? '포스트시즌' : '정규'})`])
          }
        }
        const gamesDelta = after[name].games - before[name].games
        if (!(name === 'stats' && after.season !== before.season) && gamesDelta !== (summary.hasEntered ? 1 : 0)) {
          problems.add(where(), [`${name}.games 증가 ${gamesDelta} ≠ 등판 ${summary.hasEntered}`])
        }
      }
      if (!isPostseason && after.season === before.season && after.gamesPlayed !== before.gamesPlayed + 1 && after.postseason === null) {
        problems.add(where(), [`정규 경기 뒤 경기 수 ${before.gamesPlayed} → ${after.gamesPlayed}`])
      }
    }
    return true
  }

  const pickChoice = (event: OriginalEvent, choices: readonly number[]): number => {
    // 380 연봉: 383 수락 · 그 밖은 첫 칸(502/496 → 380 연봉 협상 = 은퇴 안 함 · 461 → 463 출전)
    if (event.id === 380 && choices.includes(383)) return 383
    return choices[0] ?? 0
  }

  const maxSteps = soakNumber('SOAK_MAX_STEPS', 80_000)
  let lastKey = ''
  let sameKeySteps = 0
  try {
    await waitFor(() => expect(result.current.career).toBeNull())
    act(() => result.current.actions.create('소크', {
      role: role as PitcherCareer['role'], typeIndex: seed % 3, handIndex: seed % 2, skinIndex: seed % 3, breakingPitchSlots: [0, 1], teamId,
    }))
    await waitFor(() => expect(result.current.storyEvents).not.toBeNull())
    if (boostAbility && result.current.career !== null) {
      const created = result.current.career
      act(() => result.current.actions.save({ ...created, ability: pitcherAbilityLimitsOf(created) }))
    }
    for (; steps < maxSteps; steps += 1) {
      const session = result.current
      const { career, scene, actions } = session
      const key = `${scene}:${career?.season}:${career?.gamesPlayed}:${session.story?.eventId}:${session.story?.context}`
        + `:${games.리그 + games.포스트시즌 + games.대회}:${career?.postseason?.wins.join(',')}:${career?.nationalCup?.day}`
        + `:${session.postseasonPopup?.kind ?? ''}:${career?.hasActedThisCycle}:${session.pendingTitle}:${session.storyNotice}`
      if (key === lastKey) sameKeySteps += 1
      else sameKeySteps = 0
      lastKey = key
      if (sameKeySteps > 30) {
        stoppedAt = `멈춤: ${where()}`
        break
      }
      if (career === null) {
        stoppedAt = `커리어가 사라졌다: ${where()}`
        break
      }
      if (maxGames !== undefined && games.리그 + games.포스트시즌 + games.대회 >= maxGames) break

      switch (scene) {
        case '관리': {
          if (session.outingRecoveryNotice !== '') {
            act(() => actions.dismissOutingRecoveryNotice())
            break
          }
          if (session.storyNotice !== '') {
            act(() => actions.dismissStoryNotice())
            break
          }
          if (session.pendingTitle !== null) {
            act(() => actions.confirmTitle())
            break
          }
          managementVisits += 1
          if (managementVisits % roundTripEvery === 0) await checkRoundTrip()
          if (!career.hasActedThisCycle) {
            const needsRest = career.morale < 40 || career.isInjured || career.isSick
            if (needsRest && pitcherRestBlockReasonOf(career) === null) {
              act(() => actions.setResultWindowOpen(true))
              act(() => actions.pressManagementConfirm())
              const rest = runPitcherRest(career, random)
              act(() => actions.save(rest.career))
              const recovered = recoverAfterPitcherRest(rest.career, random)
              act(() => actions.save(recovered.career))
              act(() => actions.setResultWindowOpen(false))
              act(() => actions.reenterManagement(REST_STATE))
              break
            }
            const menu = PITCHER_TRAINING_MENUS[trainingSlot % 4]!
            trainingSlot += 1
            if (career.morale > 0 && pitcherTrainingBlockReasonOf(career, menu) === null) {
              act(() => actions.setResultWindowOpen(true))
              act(() => actions.pressManagementConfirm())
              const outcome = runPitcherTraining(career, menu, random)
              act(() => actions.save(outcome.career))
              const injury = rollTrainingInjury(outcome.career, false, random)
              if (injury.career !== outcome.career) act(() => actions.save(injury.career))
              act(() => actions.setResultWindowOpen(false))
              act(() => actions.reenterManagement(TRAINING_RESULT_STATE))
              break
            }
          }
          act(() => actions.pressManagementConfirm())
          act(() => actions.openNextGameStandings())
          break
        }
        case '다음경기순위':
          act(() => actions.confirmNextGameStandings())
          break
        case '경기준비':
          act(() => actions.confirmMatchPrepare())
          break
        case '경기':
          if (!playGame()) stoppedAt = `경기를 못 끝냈다: ${where()}`
          break
        case '경기결과':
          if (games.리그 % roundTripEvery === 0) await checkRoundTrip()
          act(() => actions.confirmGameResult())
          break
        case '이벤트': {
          const story = session.story
          const events = session.storyEvents
          if (story === null || events === null) {
            stoppedAt = `이벤트인데 재생할 것이 없다: ${where()}`
            break
          }
          const walked = walkEvent(events, story.eventId, pickChoice)
          const carried = story.carried
          const rewards = [...(carried?.rewards ?? []), ...walked.rewards]
          const viewed = [...(carried?.viewedEventIds ?? []), ...walked.viewed]
          if (walked.match !== null) {
            aceMatches += 1
            act(() => actions.beginAceMatch(walked.match!, { rewards, viewedEventIds: viewed }))
            break
          }
          const last = viewed[viewed.length - 1]
          const lastEvent = events.find((event) => event.id === last)
          const ending = (lastEvent?.commands ?? []).some((command) => command.op === 'reward' && command.items[0]?.kind === 21) ? last! : null
          act(() => actions.completeStory(rewards, viewed, ending))
          break
        }
        case '마선수대결':
          games.대결 += 1
          act(() => actions.finishAceMatch(aceMatches % 2 === 1))
          break
        case '포스트시즌':
          if (session.postseasonPopup !== null) act(() => actions.closePostseasonPopup())
          else act(() => actions.pressPostseason())
          break
        case '국가대항전': {
          const entry = session.cup
          if (entry === null) {
            stoppedAt = `국가대항전인데 대회가 없다: ${where()}`
            break
          }
          // 134 진입 첫 틀 — 칭호 8 팝업(0x1b92c 머리)을 확인한다. 대회 객체가 바뀌면 새 진입이다
          if (!entry.atStandings && cupEntrySerial !== entry.cup && nationalCupStandingsTitleOf(career.titleIds) !== null) {
            cupEntrySerial = entry.cup
            act(() => actions.confirmCupTitle())
            break
          }
          cupEntrySerial = entry.cup
          const next = confirmNationalCupStandings(entry.cup, random)
          if (next.kind === '다음경기') {
            const matchup = nationalCupMatchupOf(entry.cup)
            if (matchup === null) {
              stoppedAt = `대회 다음 경기인데 대진이 없다: ${where()}`
              break
            }
            act(() => actions.startCupGame(matchup, entry.cup))
          } else {
            act(() => actions.finishCup(finishNationalCup('나만의리그', next.cup)))
          }
          break
        }
        case '연차표지':
          { const last = career.yearlyStats?.[career.yearlyStats.length - 1]; yearLog.push(`${career.season}년차 앞해(${last?.wins}승${last?.losses}패 ${last?.games}등판 아웃${last?.outs} 실점${last?.runsAllowed}) 인기${career.popularity} 능력${Object.values(career.ability).join('/')}`) }
          act(() => actions.goto('관리'))
          break
        case '엔딩':
          endingIndex = career.endingIndex
          if (career.endingBonusReceived !== true) act(() => actions.receiveEndingBonus())
          break
        default:
          stoppedAt = `다룰 줄 모르는 장면: ${where()}`
      }
      if (stoppedAt !== null || endingIndex !== null) break
      checkCareer()
    }
    if (steps >= maxSteps) stoppedAt = `걸음 한도 ${maxSteps}: ${where()}`
    await checkRoundTrip()
  } catch (error) {
    stoppedAt = `예외: ${(error as Error).stack ?? String(error)} @ ${where()}`
  } finally {
    rendered.unmount()
  }
  return { problems, steps, games, seasons: result.current.career?.season ?? 0, endingIndex, stoppedAt, yearLog }
}

function report(result: PitcherSoakResult): string {
  const { games } = result
  return `걸음 ${result.steps} · 경기 리그 ${games.리그} · PS ${games.포스트시즌} · 대회 ${games.대회} · 등판 ${games.등판} · 대결 ${games.대결}`
    + ` · ${result.seasons}년차 · 엔딩 ${result.endingIndex} · [${result.yearLog.join(' / ')}]`
    + (result.stoppedAt === null ? '' : `\n멈춘 곳: ${result.stoppedAt}`)
    + (result.problems.size === 0 ? '' : `\n문제 ${result.problems.size}가지:\n${result.problems.report()}`)
}

describe('나만의리그 투수편 장기 진행 점검 (soak)', () => {
  it('짧은 판 — 새 선발 투수로 한 해(45경기)와 연말 사슬을 넘겨 2년차 경기까지 치러도 값이 맞고 저장 왕복이 같다', async () => {
    const result = await runPitcherSoak({ seed: 2010, role: PITCHER_ROLE.starter, teamId: 3, maxGames: 50, roundTripEvery: 3 })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.리그).toBe(50)
    expect(result.seasons).toBe(2)
  }, 120_000)

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed}: 등록부터 은퇴 · 엔딩까지`, async () => {
      const started = Date.now()
      const role = seed % 2 === 0 ? PITCHER_ROLE.starter : 2
      const boostAbility = Math.floor(seed / 2) % 2 === 1
      const result = await runPitcherSoak({ seed, role, boostAbility, teamId: seed % 10, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
      console.info(`[투수편 soak] 씨앗 ${seed} · 보직 ${role}${boostAbility ? '(상한)' : ''} · ${(Date.now() - started) / 1000}s · ${report(result)}`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.endingIndex, report(result)).not.toBeNull()
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
  }
})

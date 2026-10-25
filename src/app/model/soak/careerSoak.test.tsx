// @vitest-environment jsdom
/**
 * **나리 타자편 장기 진행 점검 (soak)** — 화면 없이 `useCareerSession` 을 새 선수 등록부터 여러 해, 은퇴 · 엔딩까지 돌린다.
 *
 * 사람 입력은 단순한 정책으로 대신한다 (`CareerRoutes` · `GameRoute` 가 화면 대신 부르는 액션을 그대로 부른다):
 * - 관리(105): 이번 주기에 아직 안 했으면 사기 < 60 이면 휴식, 아니면 트레이닝 칸 히트 · 파워 · 수비 · 주루 차례(막힌 칸은 건너뜀).
 *   했으면 [다음경기] → 109 순위 확인 → 142 경기 준비 확인 → 로딩 끝.
 * - 타석(경기): 정책 난수(세션 난수와 따로)로 볼 · 스트라이크 · 헛스윙 · 파울 · 페어 타구(원본 타구 패턴 표에서 페어 각 하나)를
 *   `handlePitchResolved` 에 넣는다. 붙든 판(타구 판 · 주자 판 · 벤치 클리어링 · 돌발 결과)은 화면이 하던 끝 액션으로 푼다.
 *   타석 끝 배너 시계(`pauseWithBanner`)는 가짜 시계를 앞으로 돌려 넘긴다.
 * - 이벤트(114)는 지나온 보상 명령을 모아 끝에 한 번에 준다(첫 종류 21 이면 그 자리에서 엔딩). match 명령(마선수 대결)은 치르지 않고 끝낸다.
 * - 포스트시즌(128)은 팝업을 닫고 [확인], 국가대항전(134)은 화면의 판정(`confirmNationalCupStandings` · `finishNationalCup`)을 그대로 부른다.
 * - 엔딩(141)은 보너스를 받고 등록 없이 끝낸다.
 *
 * 걸음마다 불가능한 값, 리그 전적 합 · 순위 차례, 경기 요약 → 시즌 누계, 경기 수(일정표 하루씩), 저장 JSON 왕복과 새 세션으로 다시
 * 띄운 상태, 멈춤을 본다. 긴 판은 `SOAK=1` 로 켠다:
 * `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/careerSoak.test.tsx --maxWorkers=2`
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { DEFAULT_ROOKIE_PROFILE, GAMES_PER_SEASON, nextOpponentOf } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import { EVENT_REWARD_KIND } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { confirmNationalCupStandings, finishNationalCup } from '@/entities/national-cup/model/nationalCupFlow'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { rankingOf } from '@/entities/league/model/league'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { provisionalOutcomeOf, registerContact } from '@/entities/batting/model/battedContact'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import {
  SoakProblems, batterLineProblemsOf, firstDiffOf, isSoakEnabled, jsonRoundTripDiffOf, leagueTallyProblemsOf,
  outOfRangeOf, rankingOrderProblemsOf, soakNumber, soakSeeds, unserializablePathsOf,
} from '@/app/model/soak/soakInvariants'

setActiveSound(createSilentSound())

function memorySave(): SaveGamePort & { readonly held: () => PlayerCareer | null } {
  let saved: PlayerCareer | null = null
  return {
    load: () => saved,
    save: (career) => {
      saved = career
    },
    clear: () => {
      saved = null
    },
    held: () => saved,
  }
}

/** 원본 타구 패턴 표의 페어 각 패턴 — (결과 코드, 패턴) */
const FAIR_CONTACTS: readonly { readonly resultCode: number; readonly pattern: BattedBallPattern }[] = Object.entries(BATTED_BALL_PATTERNS)
  .flatMap(([code, patterns]) => patterns.filter((pattern) => isFairAngle(pattern[0])).map((pattern) => ({ resultCode: Number(code), pattern })))

/** 정책 난수 — 세션 난수와 따로 굴린다(사람 손가락 자리) */
function policyRandom(seed: number) {
  let state = (seed * 2654435761) >>> 0
  return () => {
    state = (state * 1103515245 + 12345) >>> 0
    return state / 0x100000000
  }
}

/** 공 하나 — 사람이 친 결과를 흉내 낸다. 구질 번호 1 을 실어 상대 투수 투구 수 · 스태미나가 깎이게 한다 */
function pitchDetailOf(roll: number, pick: number, batterHand: number): PitchOutcomeDetail {
  const base = { hasSwung: false, isBunt: false, resultCode: null, contactSoundId: null, pitchTypeNumber: 1 } as const
  if (roll < 0.33) return { ...base, resolution: { kind: '볼' } }
  if (roll < 0.53) return { ...base, resolution: { kind: '스트라이크', isSwinging: false } }
  if (roll < 0.66) return { ...base, hasSwung: true, resolution: { kind: '스트라이크', isSwinging: true } }
  if (roll < 0.76) return { ...base, hasSwung: true, resolution: { kind: '파울' } }
  if (roll < 0.765) return { ...base, resolution: { kind: '사구' } }
  const contact = FAIR_CONTACTS[Math.floor(pick * FAIR_CONTACTS.length)]!
  return {
    ...base,
    hasSwung: true,
    resultCode: contact.resultCode,
    pattern: contact.pattern,
    batterHand,
    resolution: {
      kind: '타구',
      outcome: registerContact(provisionalOutcomeOf(contact.pattern), { pattern: contact.pattern, resultCode: contact.resultCode, batterHand }),
    },
  }
}

interface CareerSoakResult {
  readonly problems: SoakProblems
  readonly steps: number
  readonly games: { 정규: number; 포스트시즌: number; 국가대항전: number }
  readonly seasons: number
  readonly endingIndex: number | null
  readonly stoppedAt: string | null
  readonly log: readonly string[]
}

interface CareerSoakOptions {
  readonly seed: number
  /** 이만큼 정규 경기를 치르면 멈춘다 (짧은 판) — 없으면 엔딩까지 */
  readonly maxRegularGames?: number
  /** 저장 왕복을 몇 번째 관리 화면마다 볼지 */
  readonly roundTripEvery?: number
}

/**
 * 이벤트 재생을 흉내 낸다 (`useEventPlayback`) — 지나온 보상 명령을 모으고, 선택지는 첫 칸 · 예아니오(창 있는 sub 0)는 "예"로
 * 건너간다(떠나온 이벤트는 `onChoice` 로 알린다). 첫 종류 21(엔딩 진입)을 만나면 거기서 멈추고 그 이벤트를 엔딩으로 넘긴다(0x8d4ce).
 * match 명령(마선수 대결)은 치르지 않고 거기서 끝낸다.
 */
function eventPlaybackOf(
  events: readonly OriginalEvent[],
  firstEventId: number,
  onChoice: (eventId: number, leftEventIds: readonly number[]) => void,
) {
  const rewards: EventReward[] = []
  const viewed: number[] = []
  let endingEventId: number | null = null
  let eventId = firstEventId
  for (let hop = 0; hop < 20; hop += 1) {
    const event = events.find((candidate) => candidate.id === eventId)
    if (!viewed.includes(eventId)) viewed.push(eventId)
    let jumpTo: number | null = null
    let stopped = false
    for (const command of event?.commands ?? []) {
      if (command.op === 'match') {
        stopped = true
        break
      }
      if (command.op === 'reward') {
        if (command.items[0]?.kind === EVENT_REWARD_KIND.엔딩진입) {
          endingEventId = eventId
          stopped = true
          break
        }
        rewards.push(...(command.items as readonly EventReward[]))
      }
      if (command.op === 'choice' && command.choices[0] !== undefined) {
        jumpTo = command.choices[0].gotoEvent
        break
      }
      if (command.op === 'yesno' && command.sub === 0) {
        jumpTo = command.yesEvent
        break
      }
    }
    if (stopped || jumpTo === null || jumpTo <= 0) break
    onChoice(eventId, [eventId])
    eventId = jumpTo
  }
  return { rewards, viewed, endingEventId }
}

async function runCareerSoak(options: CareerSoakOptions): Promise<CareerSoakResult> {
  const { seed, maxRegularGames, roundTripEvery = 5 } = options
  const saveGame = memorySave()
  const random = createSeededRandom(seed)
  const policy = policyRandom(seed)
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    return { screen, setScreen, runner, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
  })
  const result = rendered.result
  const problems = new SoakProblems()
  const games = { 정규: 0, 포스트시즌: 0, 국가대항전: 0 }
  const log: string[] = []
  let steps = 0
  let trainingSlot = 0
  let managementVisits = 0
  let stoppedAt: string | null = null
  let started = false
  let endingIndex: number | null = null
  let firstSeason = 1
  /** 이 경기를 시작할 때의 커리어 — 결과 화면에서 누계 증가분을 본다 */
  let beforeGame: { career: PlayerCareer; kind: '정규' | '포스트시즌' | '국가대항전' } | null = null
  let checkedSummary: unknown = null
  /** 붙든 판을 푼 횟수 — 정책이 경기 갈래를 실제로 밟았는지 본다 */
  const heldPlays = { 타구판: 0, 주자판: 0, 벤치클리어링: 0, 돌발결과: 0, 공: 0 }

  const where = () => {
    const career = result.current.session.career
    return `씨앗 ${seed} · ${career === null ? '-' : `${career.season}년차 g${career.gamesPlayed}${career.postseason !== null ? '(PS)' : ''}`}`
      + ` · 화면 ${result.current.screen.kind} · 걸음 ${steps}`
  }

  const checkCareer = () => {
    const career = result.current.session.career
    if (career === null) return
    const at = where()
    problems.add(at, unserializablePathsOf(career, 'career').slice(0, 5))
    problems.add(at, outOfRangeOf('career', {
      gamePoint: career.gamePoint, season: career.season, gamesPlayed: career.gamesPlayed, popularity: career.popularity,
      reputation: career.reputation, money: career.money, salary: career.salary, outingsThisSeason: career.outingsThisSeason,
      injuryRemaining: career.injuryRemaining, illnessRemaining: career.illnessRemaining, illnessCooldown: career.illnessCooldown,
      eagleEyeGamesRemaining: career.eagleEyeGamesRemaining, battingOrder: career.battingOrder,
    }, 0))
    problems.add(at, outOfRangeOf('career.morale', { morale: career.morale }, 0, 100))
    problems.add(at, outOfRangeOf('career.ability', { ...career.ability }, 0, 999))
    problems.add(at, batterLineProblemsOf('career.stats', career.stats))
    problems.add(at, batterLineProblemsOf('career.careerStats', career.careerStats))
    problems.add(at, outOfRangeOf('career.stats', {
      games: career.stats.games, plateAppearances: career.stats.plateAppearances, walks: career.stats.walks, strikeouts: career.stats.strikeouts,
    }, 0))
    if (career.stats.plateAppearances < career.stats.atBats) problems.add(at, [`타석 ${career.stats.plateAppearances} < 타수 ${career.stats.atBats}`])
    // 정규시즌(대회 · 포스트시즌 밖)은 열 팀이 매일 한 경기씩 — 팀마다 승 + 패 = 경기 수
    const isRegular = career.postseason === null && career.nationalCup === undefined
    problems.add(at, leagueTallyProblemsOf('league', career.league, isRegular && career.gamesPlayed <= GAMES_PER_SEASON ? career.gamesPlayed : null))
    problems.add(at, rankingOrderProblemsOf('rankingOf', rankingOf(career.league), career.league.wins, career.league.losses))
    for (const [id, line] of Object.entries(career.leaguePlayerStats.batters)) problems.add(at, batterLineProblemsOf(`leagueBatters[${id}]`, line))
    const series = career.postseason
    if (series !== null) {
      problems.add(at, outOfRangeOf('series.wins', { a: series.wins[0], b: series.wins[1] }, 0, series.winsNeeded))
      if (series.round === '종료' && (series.champion === null || !series.qualifiers.includes(series.champion))) {
        problems.add(at, [`포스트시즌이 끝났는데 우승 팀이 대진 밖이다: ${series.champion}`])
      }
    }
  }

  /** 저장 왕복 — 저장이 JSON 을 지나도 같고, 그 저장으로 새로 띄운 세션의 커리어가 지금과 같다 */
  const checkRoundTrip = () => {
    const held = saveGame.held()
    if (held === null) return
    const at = where()
    problems.add(at, unserializablePathsOf(held, '저장').slice(0, 5))
    const diff = jsonRoundTripDiffOf(held)
    if (diff !== null) problems.add(at, [`저장 JSON 왕복이 다르다: ${diff}`])
    const now = result.current.session.career
    if (now !== null) {
      const persisted = firstDiffOf(now, held, 'career')
      if (persisted !== null) problems.add(at, [`저장이 지금 커리어와 다르다: ${persisted}`])
    }
    const clone = JSON.parse(JSON.stringify(held)) as PlayerCareer
    const reloadSave: SaveGamePort = { load: () => clone, save: () => {}, clear: () => {} }
    const reloaded = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, session: useCareerSession({ runner, random: createSeededRandom(1), saveGame: reloadSave, screen, setScreen }) }
    })
    try {
      const d = firstDiffOf(held, reloaded.result.current.session.savedCareer, '다시 띄운 savedCareer')
      if (d !== null) problems.add(at, [d])
    } finally {
      reloaded.unmount()
    }
  }

  /** 경기 한 걸음 — 붙든 판을 풀거나 공 하나 */
  const gameStep = () => {
    const { session, runner } = result.current
    const progress = session.progress
    if (session.loadingTip !== null) {
      act(() => session.actions.finishLoading())
      return
    }
    if (progress === null) {
      stoppedAt = `경기 화면인데 진행이 없다: ${where()}`
      return
    }
    if (progress.pendingDefensePlay !== null) {
      heldPlays.타구판 += 1
      act(() => session.actions.finishDefensePlay())
    } else if (progress.pendingRunnerPlay != null) {
      heldPlays.주자판 += 1
      act(() => session.actions.finishRunnerPlay())
    } else if (progress.pendingBenchClearing !== null) {
      heldPlays.벤치클리어링 += 1
      act(() => session.actions.finishBenchClearing(false))
    } else if (progress.lastBurstResolution != null) {
      heldPlays.돌발결과 += 1
      act(() => session.actions.closeBurstResult())
    } else if (!runner.isPaused && !progress.game.isFinished) {
      const career = session.career
      heldPlays.공 += 1
      const detail = pitchDetailOf(policy(), policy(), career?.battingSide ?? 0)
      act(() => {
        session.handlePitchResolved(detail)
      })
    }
    // 타석 끝 배너(`pauseWithBanner`) · 판 끝 대기 — 장면 시계를 돌린다
    act(() => {
      vi.advanceTimersByTime(2000)
    })
  }

  const maxSteps = soakNumber('SOAK_MAX_STEPS', 400000)
  let lastKey = ''
  let sameKeySteps = 0
  try {
    // 이벤트 본문(535KB)은 커리어가 선 뒤 따로 받는다 — 먼저 받아 두고 세션이 싣게 한다
    await import('@/shared/config/original/events')
    for (; steps < maxSteps; steps += 1) {
      const { screen, session } = result.current
      const { actions } = session
      const career = session.career
      const key = `${screen.kind}:${career?.season}:${career?.gamesPlayed}:${session.progress?.game.inning}:${session.progress?.game.half}`
        + `:${session.progress?.game.outs}:${result.current.runner.atBat.balls}:${result.current.runner.atBat.strikes}`
        + `:${career?.postseason?.wins.join(',')}:${screen.kind === '국가대항전' ? screen.cup.day : ''}`
        + `:${screen.kind === '이벤트' ? screen.eventId : ''}:${session.managementNotice}:${session.managementDetail === null}`
        + `:${career?.hasActedThisCycle}:${session.pendingTitle}:${screen.kind === '포스트시즌' ? screen.popup?.kind : ''}`
      if (key === lastKey) sameKeySteps += 1
      else sameKeySteps = 0
      lastKey = key
      if (process.env.SOAK_TRACE !== undefined && steps >= Number(process.env.SOAK_TRACE) && steps < Number(process.env.SOAK_TRACE) + 60 && screen.kind !== '경기') console.info(`[흐름] ${steps} ${JSON.stringify(screen).slice(0, 120)} 끝상태 ${career?.seasonEndState} PS ${career?.postseason?.round}`)
      if (sameKeySteps > 30) {
        stoppedAt = `멈춤: ${where()}`
        break
      }
      if (maxRegularGames !== undefined && games.정규 >= maxRegularGames && screen.kind === '관리') break

      // 이벤트 본문이 아직이면(첫 커리어 직후) 한 틈 쉰다
      if (career !== null && session.storyEvents === null) {
        await act(async () => {
          await Promise.resolve()
        })
        continue
      }

      if (session.managementNotice !== '') {
        act(() => actions.dismissManagementNotice())
        continue
      }
      if (session.managementDetail !== null) {
        act(() => actions.closeManagementDetail())
        continue
      }
      if (screen.kind === '관리' && session.pendingTitle !== null) {
        act(() => actions.confirmTitle())
        continue
      }

      switch (screen.kind) {
        case '메인메뉴':
          if (started) {
            stoppedAt = null
            steps = maxSteps
            break
          }
          started = true
          act(() => actions.startNewCareer('소크', { ...DEFAULT_ROOKIE_PROFILE, teamId: seed % 10 }))
          firstSeason = result.current.session.career?.season ?? 1
          break
        case '관리': {
          if (career === null) {
            stoppedAt = `관리 화면인데 커리어가 없다: ${where()}`
            break
          }
          managementVisits += 1
          if (managementVisits % roundTripEvery === 0) checkRoundTrip()
          act(() => actions.pressManagementConfirm())
          if (!career.hasActedThisCycle) {
            if (career.morale < 60 && !actions.isRestBlocked()) {
              act(() => result.current.session.actions.runCommand('휴식'))
              break
            }
            const menus = TRAINING_MENUS.slice(0, 4)
            const open = menus.map((_, offset) => menus[(trainingSlot + offset) % menus.length]!)
              .find((menu) => !result.current.session.actions.isTrainingBlocked(menu.id))
            trainingSlot += 1
            if (open !== undefined) {
              act(() => result.current.session.actions.runTrainingMenu(open.id))
              break
            }
          }
          act(() => result.current.session.actions.runCommand('다음경기'))
          break
        }
        case '다음경기순위':
          act(() => actions.confirmNextGameStandings())
          break
        case '경기준비':
          if (career !== null) {
            beforeGame = {
              career,
              kind: screen.cup !== undefined ? '국가대항전' : career.postseason !== null ? '포스트시즌' : '정규',
            }
          }
          act(() => actions.confirmMatchPrepare())
          break
        case '경기':
          gameStep()
          break
        case '경기결과':
        case '대회경기결과': {
          const summary = screen.summary
          if (checkedSummary !== summary && beforeGame !== null && career !== null) {
            checkedSummary = summary
            games[beforeGame.kind] += 1
            if (process.env.SOAK_DEBUG === '1' && beforeGame.kind !== '정규' && games[beforeGame.kind] < 25) console.info(`[PS] ${where()} ${summary.ourTeamId}:${summary.opponentTeamId} ${summary.ourScore}-${summary.opponentScore} ${summary.result} 앞 ${JSON.stringify(beforeGame.career.postseason)} 뒤 ${JSON.stringify(career.postseason)}`)
            const s = summary.stats
            problems.add(where(), batterLineProblemsOf('summary.stats', s))
            if (s.plateAppearances < s.atBats) problems.add(where(), [`경기 타석 ${s.plateAppearances} < 타수 ${s.atBats}`])
            problems.add(where(), outOfRangeOf('summary', { ourScore: summary.ourScore, opponentScore: summary.opponentScore }, 0))
            if (beforeGame.kind === '정규') {
              // 일정표 0xd89cb 대로 — 정규 경기 상대는 그날(g) 일정표 상대다
              const expected = nextOpponentOf(beforeGame.career)
              if (summary.opponentTeamId !== expected) problems.add(where(), [`g${beforeGame.career.gamesPlayed} 상대 ${summary.opponentTeamId} ≠ 일정표 ${expected}`])
              // 경기 요약 → 시즌 · 통산 누계 (0xa8024 — 정규시즌만)
              for (const field of ['atBats', 'hits', 'homeRuns', 'runsBattedIn', 'plateAppearances'] as const) {
                const delta = career.stats[field] - beforeGame.career.stats[field]
                const careerDelta = career.careerStats[field] - beforeGame.career.careerStats[field]
                if (delta !== s[field] && career.season === beforeGame.career.season) {
                  problems.add(where(), [`시즌 누계 ${field} 증가 ${delta} ≠ 경기 ${s[field]}`])
                }
                if (careerDelta !== s[field]) problems.add(where(), [`통산 누계 ${field} 증가 ${careerDelta} ≠ 경기 ${s[field]}`])
              }
              if (career.gamesPlayed !== beforeGame.career.gamesPlayed + 1 && career.postseason === null) {
                problems.add(where(), [`정규 경기 뒤 경기 수 ${beforeGame.career.gamesPlayed} → ${career.gamesPlayed}`])
              }
            }
            beforeGame = null
          }
          if (screen.kind === '대회경기결과') {
            act(() => actions.confirmCupGameResult())
            break
          }
          const title = screen.newTitles[0]
          if (title !== undefined && career !== null && !career.titleIds.includes(title)) {
            act(() => actions.confirmGameResultTitle())
          }
          act(() => result.current.session.actions.confirmGameResult())
          break
        }
        case '이벤트': {
          const playback = eventPlaybackOf(session.storyEvents ?? [], screen.eventId, (eventId, left) => {
            act(() => result.current.session.actions.confirmEventChoice(eventId, left))
          })
          act(() => result.current.session.actions.completeScene(playback.rewards, playback.viewed, playback.endingEventId))
          break
        }
        case '연차표지':
          log.push(`${career?.season}년차 표지(통산 ${career?.careerStats.atBats}타수 ${career?.careerStats.hits}안타 ${career?.careerStats.homeRuns}홈런)`)
          act(() => result.current.setScreen({ kind: '관리' }))
          break
        case '포스트시즌':
          if (screen.popup !== null) act(() => actions.closePostseasonPopup())
          else act(() => actions.pressPostseason())
          break
        case '국가대항전': {
          // 134 첫 틀 — 칭호 8 팝업이 뜨면 확인(0x1b1e4)
          act(() => actions.confirmCupTitle())
          const cup = screen.cup
          const next = confirmNationalCupStandings(cup, random)
          if (next.kind === '다음경기') {
            const matchup = nationalCupMatchupOf(cup)
            if (matchup === null) {
              stoppedAt = `대회 다음 경기인데 대진이 없다: ${where()}`
              break
            }
            act(() => result.current.session.actions.startCupGame(matchup, cup))
          } else {
            log.push(`${career?.season}년차 국가대항전 우승 ${next.cup.champion}`)
            act(() => result.current.session.actions.finishCup(finishNationalCup('나만의리그', next.cup)))
          }
          break
        }
        case '엔딩':
          endingIndex = screen.endingIndex
          log.push(`${career?.season}년차 엔딩 ${screen.endingIndex}`)
          act(() => actions.receiveEndingBonus())
          act(() => result.current.session.actions.finishEnding(false))
          break
        default:
          stoppedAt = `다룰 줄 모르는 화면: ${where()}`
      }
      if (stoppedAt !== null) break
      checkCareer()
    }
    if (steps === maxSteps && !started) stoppedAt = `걸음 한도 ${maxSteps}: ${where()}`
    if (steps >= maxSteps && endingIndex === null && maxRegularGames === undefined) stoppedAt ??= `걸음 한도 ${maxSteps}: ${where()}`
  } catch (error) {
    stoppedAt = `예외: ${where()} — ${error instanceof Error ? `${error.message}\n${error.stack?.split('\n').slice(0, 6).join('\n')}` : String(error)}`
  } finally {
    rendered.unmount()
  }
  const lastSeason = saveGame.held()?.season ?? result.current.session.career?.season ?? firstSeason
  log.push(`판 ${JSON.stringify(heldPlays)}`)
  return { problems, steps, games, seasons: lastSeason - firstSeason + 1, endingIndex, stoppedAt, log }
}

function report(result: CareerSoakResult): string {
  return `걸음 ${result.steps} · 경기 정규 ${result.games.정규} · PS ${result.games.포스트시즌} · 대회 ${result.games.국가대항전}`
    + ` · 시즌 ${result.seasons} · 엔딩 ${result.endingIndex} · [${result.log.join(' / ')}]`
    + `${result.stoppedAt === null ? '' : `\n멈춘 곳: ${result.stoppedAt}`}`
    + (result.problems.size === 0 ? '' : `\n문제 ${result.problems.size}가지:\n${result.problems.report()}`)
}

describe('나리 타자편 장기 진행 점검 (soak)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] })
    resetCommonWindowShownForTest()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('짧은 판 — 새 선수로 6경기를 정책대로 치러도 값이 맞고 저장 왕복이 같다', async () => {
    const result = await runCareerSoak({ seed: 2010, maxRegularGames: 6, roundTripEvery: 1 })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.정규, report(result)).toBe(6)
  }, 120_000)

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed}: 새 선수 등록부터 은퇴 · 엔딩까지`, async () => {
      const startedAt = Date.now()
      const result = await runCareerSoak({ seed, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
      console.info(`[타자편 soak] 씨앗 ${seed} · ${(Date.now() - startedAt) / 1000}s · ${report(result)}`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.endingIndex, report(result)).not.toBeNull()
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
  }
})

// @vitest-environment jsdom
/**
 * **soak 로 e2e 픽스처 뜨기** (r236) — 브라우저로 몇 시간 쳐야 닿는 자리(시즌 10년차 엔딩 · 나리 포스트시즌 128 · 국가대항전 134 ·
 * 은퇴 엔딩 141 · 명예의 전당 등록 앞)를 화면 없이 세션 훅으로 돌려 닿고, 그 순간의 localStorage `compus-baseball/` 칸을
 * `e2e/fixtures/<이름>.json` 으로 쓴다. 장면 바로가기(`src/app/dev/scenes.ts`)가 이 픽스처로 그 자리에 들어간다.
 *
 * - 저장 꼴은 앱의 **실제 저장 모듈** 그대로다 — 세션 훅에 `createLocalStorageSaveGame()` · `createLocalStorageJsonStore(키)` 를
 *   넘겨 jsdom localStorage 에 쓰게 하고 그 칸을 그대로 뜬다(손으로 짜지 않는다). 열쇠 글자는 `App.tsx` 의 그것과 같다.
 * - 진행 정책은 r233 soak 하네스(`seasonSoak` · `careerSoak` · `pitcherLeagueSoak`)의 사람 흉내를 줄여 옮겼다(값 검사는 뺐다 —
 *   검사는 그쪽 몫). 난수 차례 · 게임 동작은 건드리지 않는다.
 * - 뜬 뒤 **다시 띄워 본다** — 픽스처 칸만 깐 새 localStorage 로 세션 훅을 새로 세워, 이어하기가 기대한 자리(장면 · 이어할 자리)로
 *   가는지 본다. 저장 꼴이 바뀌어 다른 자리로 가면 이 시험이 먼저 깨진다.
 *
 * 기본은 건너뛴다. 다시 뜨려면 (저장 꼴이 바뀌었을 때):
 * `SOAK_FIXTURE=1 yarn vitest run src/app/model/soak/soakFixtures.test.tsx`
 * `SOAK_FIXTURE_DRY=1` 이면 파일을 안 쓰고 닿는지만 본다. 쓴 뒤 `yarn node e2e/smoke.mjs <장면>` 으로 브라우저에서 확인한다.
 */
import { useState } from 'react'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import { seasonPostseasonRankOf } from '@/app/model/useSeasonSession'
import { useCareerSession } from '@/app/model/useCareerSession'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_PLAYABLE_EVENTS } from '@/entities/season-mode/model/seasonEventFlow'
import { PRE_GAME_ACE_PHASE } from '@/entities/season-mode/model/preGameFlow'
import { koreanSeriesRewardOf, nextLeagueFirstAward } from '@/entities/season-mode/model/seasonRewards'
import { confirmNationalCupStandings, finishNationalCup } from '@/entities/national-cup/model/nationalCupFlow'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { KOREA_TEAM_ID, isKoreaInFinal, isNationalCupFinalDay, isNationalCupOver, nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { startTeamGame, summaryOf as teamSummaryOf } from '@/features/play-team-game/model/teamGameFlow'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { DEFAULT_ROOKIE_PROFILE } from '@/entities/career/model/playerCareer'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import { EVENT_REWARD_KIND, rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { provisionalOutcomeOf, registerContact } from '@/entities/batting/model/battedContact'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_TRAINING_MENUS, pitcherTrainingBlockReasonOf, runPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement'
import { pitcherRestBlockReasonOf, recoverAfterPitcherRest, runPitcherRest } from '@/pages/pitcher-league/model/pitcherRest'
import { rollTrainingInjury } from '@/entities/career/model/condition'
import {
  closeBurstWindow, closeManagerHookWindow, confirmScene, isPitchTurn, pitchSlotsFor, resolveBenchClearing, resolveDefensePlay,
  resolveRunnerPlay, startPitch, startPitcherGame, summaryOf as pitcherSummaryOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'
import { createLocalStorageSaveGame } from '@/shared/api/save/localStorageSaveGame'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'

setActiveSound(createSilentSound())

const isEnabled = process.env.SOAK_FIXTURE === '1'
const isDryRun = process.env.SOAK_FIXTURE_DRY === '1'

/** `App.tsx` 의 열쇠와 같은 글자 — 앱이 이 칸을 읽는다 (나리 타자편 칸은 `localStorageSaveGame` 안) */
const STORAGE_PREFIX = 'compus-baseball/'
const SEASON_KEY = 'compus-baseball/season'
const PITCHER_KEY = 'compus-baseball/pitcher-league'
/** jsdom 의 `URL` 은 node fs 가 못 받는다 — 글 경로로 */
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../e2e/fixtures')

/** localStorage 의 `compus-baseball/` 칸 — 장면 진행기 `applyFixture` 가 거꾸로 까는 꼴(JSON 은 풀어 두고, 아니면 `$raw`) */
function snapshotStorage(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key !== null && key.startsWith(STORAGE_PREFIX)) keys.push(key)
  }
  for (const key of keys.sort()) {
    const raw = window.localStorage.getItem(key) ?? ''
    try {
      out[key] = JSON.parse(raw) as unknown
    } catch {
      out[key] = { $raw: raw }
    }
  }
  return out
}

function loadSnapshot(storage: Record<string, unknown>): void {
  window.localStorage.clear()
  for (const [key, value] of Object.entries(storage)) {
    const raw = value !== null && typeof value === 'object' && '$raw' in value ? String((value as { $raw: unknown }).$raw) : JSON.stringify(value)
    window.localStorage.setItem(key, raw)
  }
}

interface Capture {
  readonly name: string
  readonly note: string
  readonly storage: Record<string, unknown>
}

function writeFixture(capture: Capture): void {
  if (isDryRun) return
  const body = { note: capture.note, localStorage: capture.storage }
  writeFileSync(join(FIXTURES_DIR, `${capture.name}.json`), `${JSON.stringify(body, null, 2)}\n`)
}

/* ───────────────────────────── 시즌모드 ───────────────────────────── */

/** 사람이 한 타석도 안 잡는 설정 — 상세 · 값 0 (`seasonSoak` 과 같다) */
const ALL_AUTO_SETTINGS = { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 } as const

/**
 * 시즌모드를 팀 고르기부터 10년차 엔딩 0xf5 까지 — `seasonSoak` 의 `사람` 정책. 엔딩 장면이 선 순간의 저장을 뜬다
 */
function captureSeasonEnding(seed: number, teamId: number): Capture {
  const store = createLocalStorageJsonStore(SEASON_KEY)
  const random = createSeededRandom(seed)
  const rendered = renderHook(() => useSeasonSession(store, random))
  const result: { readonly current: SeasonSession } = rendered.result
  let trainingSlot = 0
  let handledSummaryEntry: number | null = null
  let capture: Capture | null = null
  act(() => result.current.actions.constructScene())
  try {
    for (let steps = 0; steps < 80_000 && capture === null; steps += 1) {
      const session = result.current
      const { state, scene, actions } = session
      if (session.notice !== '') {
        act(() => actions.clearNotice())
        continue
      }
      if (session.trainingResult !== null) {
        act(() => actions.closeTrainingResult())
        continue
      }
      if (state === null || scene === SEASON_SCENE_STATE.팀고르기) {
        act(() => actions.chooseTeam(teamId, 'SOAK'))
        continue
      }
      switch (scene) {
        case SEASON_SCENE_STATE.이벤트재생: {
          const playback = session.eventPlayback
          if (playback === null) throw new Error('이벤트재생인데 이벤트가 없다')
          const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
          const rewards = (event?.commands ?? []).flatMap((command) => (command.op === 'reward' ? command.items : []))
          act(() => result.current.actions.finishSeasonEvent(rewards, [playback.eventId]))
          break
        }
        case SEASON_SCENE_STATE.관리메뉴:
          if (session.isTradeRequestAlertOpen) {
            act(() => actions.answerTradeRequest(false))
            break
          }
          if (!state.record.acted) {
            const outing = state.record.illness > 0 && state.record.money >= 5 ? 2 : state.teamMorale < 70 && state.record.money >= 4 ? 1 : null
            if (outing !== null) act(() => actions.enterOuting(outing))
            else {
              act(() => actions.runTraining(trainingSlot % 4))
              trainingSlot += 1
            }
          } else {
            act(() => actions.openNextGame())
          }
          break
        case SEASON_SCENE_STATE.외출연출:
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
        case SEASON_SCENE_STATE.경기직전: {
          const options = session.gameOptions
          if (options === null) throw new Error('경기직전인데 경기 옵션이 없다')
          rollSceneLoadingTip(random)
          const progress = startTeamGame({ ...options, settings: ALL_AUTO_SETTINGS }, random)
          const summary = teamSummaryOf(progress)
          act(() => result.current.actions.enterGameSettlement(summary))
          act(() => result.current.actions.finishGame(summary))
          break
        }
        case SEASON_SCENE_STATE.관중수입:
          act(() => actions.confirmIncome(state.record))
          break
        case SEASON_SCENE_STATE.경기뒤마무리:
          act(() => actions.confirmDayResults())
          break
        case SEASON_SCENE_STATE.시즌결산: {
          const entry = session.summaryEntry
          if (entry !== null && handledSummaryEntry !== entry.serial) {
            handledSummaryEntry = entry.serial
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
          if (cup === null) throw new Error('국가대항전인데 대회가 없다')
          const next = confirmNationalCupStandings(cup, random)
          if (next.kind === '다음경기') {
            const matchup = nationalCupMatchupOf(cup)
            if (matchup === null) throw new Error('대회 다음 경기인데 대진이 없다')
            act(() => actions.playCupGame(matchup.myTeam, matchup.opponent))
          } else {
            act(() => actions.finishCup(finishNationalCup('시즌모드', next.cup)))
          }
          break
        }
        case SEASON_SCENE_STATE.엔딩: {
          const record = state.record
          capture = {
            name: 'season-ending',
            note: `시즌모드 ${record.yearIndex + 1}년차 엔딩 0xf5 직전 — 저장 phase ${record.phase}(엔딩)라 시즌모드에 들어서면 진입 분기 0xcb 가 곧장 엔딩으로 보낸다.`
              + ` r236 soak(src/app/model/soak/soakFixtures.test.tsx, 씨앗 ${seed} · 팀 ${teamId} · seasonSoak 의 사람 정책)이 팀 고르기부터 10년을 화면 없이 돌려`
              + ` 엔딩 장면이 선 순간 실제 저장 모듈(createLocalStorageJsonStore)이 쓴 칸을 떴다(보너스 칸 SR+0x7b ${record.endingBonusReceived === true ? '참 — 키가 팝업 없이 넘긴다' : '거짓'}). 돈 ${record.money}`,
            storage: snapshotStorage(),
          }
          break
        }
        default:
          throw new Error(`다룰 줄 모르는 시즌 장면 0x${scene.toString(16)}`)
      }
    }
  } finally {
    rendered.unmount()
  }
  if (capture === null) throw new Error('시즌 엔딩에 못 닿았다')
  return capture
}

/* ───────────────────────────── 나리 타자편 ───────────────────────────── */

const FAIR_CONTACTS: readonly { readonly resultCode: number; readonly pattern: BattedBallPattern }[] = Object.entries(BATTED_BALL_PATTERNS)
  .flatMap(([code, patterns]) => patterns.filter((pattern) => isFairAngle(pattern[0])).map((pattern) => ({ resultCode: Number(code), pattern })))

/** 정책 난수 — 세션 난수와 따로 굴린다(사람 손가락 자리, `careerSoak` 과 같다) */
function policyRandom(seed: number) {
  let state = (seed * 2654435761) >>> 0
  return () => {
    state = (state * 1103515245 + 12345) >>> 0
    return state / 0x100000000
  }
}

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

/** `careerSoak` 의 이벤트 재생 흉내 — 첫 선택지 · 예아니오는 예, 첫 종류 21(엔딩 진입)에서 멈춘다 */
function careerEventPlaybackOf(
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

/**
 * 나리 타자편을 새 선수부터 은퇴 · 엔딩까지 — `careerSoak` 의 정책. 첫 포스트시즌 128 · 첫 국가대항전 134 · 엔딩 141 이 선 순간(보너스 전) ·
 * 보너스를 받은 뒤(명예의 전당 등록 팝업 앞)의 저장을 뜬다
 */
async function captureNari(seed: number): Promise<Capture[]> {
  const saveGame = createLocalStorageSaveGame()
  const random = createSeededRandom(seed)
  const policy = policyRandom(seed)
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    return { screen, setScreen, runner, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
  })
  const result = rendered.result
  const captures: Capture[] = []
  const has = (name: string) => captures.some((capture) => capture.name === name)
  const where = () => {
    const career = result.current.session.career
    return career === null ? '-' : `${career.season}년차 ${career.gamesPlayed}경기`
  }
  let started = false
  let trainingSlot = 0
  let done = false
  /** 내 포스트시즌 경기를 치른 라운드 — 128 에 돌아와 라운드가 바뀌었으면 내 시리즈가 끝난 것 (r254) */
  const myPostseason = { round: null as string | null }
  /** 마지막으로 이벤트(114)가 선 순간의 저장 — 134 로 곧장 이어하는 저장이 웹에 없어 그 앞 이벤트 저장을 쓴다(아래 '국가대항전') */
  try {
    await import('@/shared/config/original/events')
    for (let steps = 0; steps < 600_000 && !done; steps += 1) {
      const { screen, session } = result.current
      const { actions } = session
      const career = session.career
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
          if (started) throw new Error(`나리 타자편이 엔딩 없이 메인 메뉴로 나왔다 (${where()})`)
          started = true
          act(() => actions.startNewCareer('SOAK', { ...DEFAULT_ROOKIE_PROFILE, teamId: seed % 10 }))
          break
        case '관리': {
          if (career === null) throw new Error('관리 화면인데 커리어가 없다')
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
          noteMyPostseasonGame(myPostseason, career?.postseason ?? null, career?.teamId ?? -1, career?.season ?? 0)
          act(() => actions.confirmMatchPrepare())
          break
        case '경기': {
          const { runner } = result.current
          const progress = session.progress
          if (session.loadingTip !== null) {
            act(() => session.actions.finishLoading())
            break
          }
          if (progress === null) throw new Error('경기 화면인데 진행이 없다')
          if (progress.pendingDefensePlay !== null) act(() => session.actions.finishDefensePlay())
          else if (progress.pendingRunnerPlay != null) act(() => session.actions.finishRunnerPlay())
          else if (progress.pendingBenchClearing !== null) act(() => session.actions.finishBenchClearing(false))
          else if (progress.lastBurstResolution != null) act(() => session.actions.closeBurstResult())
          else if (!runner.isPaused && !progress.game.isFinished) {
            const detail = pitchDetailOf(policy(), policy(), career?.battingSide ?? 0)
            act(() => {
              session.handlePitchResolved(detail)
            })
          }
          act(() => {
            vi.advanceTimersByTime(2000)
          })
          break
        }
        case '경기결과':
        case '대회경기결과': {
          if (screen.kind === '대회경기결과') {
            act(() => actions.confirmCupGameResult())
            break
          }
          const title = screen.newTitles[0]
          if (title !== undefined && career !== null && !career.titleIds.includes(title)) act(() => actions.confirmGameResultTitle())
          act(() => result.current.session.actions.confirmGameResult())
          break
        }
        case '이벤트': {
          const playback = careerEventPlaybackOf(session.storyEvents ?? [], screen.eventId, (eventId, left) => {
            act(() => result.current.session.actions.confirmEventChoice(eventId, left))
          })
          act(() => result.current.session.actions.completeScene(playback.rewards, playback.viewed, playback.endingEventId))
          break
        }
        case '연차표지':
          act(() => result.current.setScreen({ kind: '관리' }))
          break
        case '포스트시즌':
          if (!has('nari-postseason')) {
            captures.push({
              name: 'nari-postseason',
              note: `나리 타자편 ${where()} 포스트시즌 128 시작 — 저장 S+0x50 = 128 · 시리즈 ${career?.postseason?.round}(${career?.postseason?.wins.join(':')})라`
                + ' 이어하기(continueSaved)가 128 진입 0x120a4 를 다시 밟는다. r236 soak(src/app/model/soak/soakFixtures.test.tsx, 씨앗'
                + ` ${seed} · careerSoak 의 정책)이 새 선수 등록부터 화면 없이 돌려 128 이 처음 선 순간 실제 저장 모듈(createLocalStorageSaveGame)이 쓴 칸을 떴다`,
              storage: snapshotStorage(),
            })
          }
          if (screen.popup === null && career !== null && career.postseason !== null) {
            for (const kind of postseasonSpotsOf(myPostseason, career.postseason, career.teamId, career.season)) {
              const name = `nari-postseason-${kind}`
              if (has(name)) continue
              captures.push({
                name,
                note: `나리 타자편 ${where()} 포스트시즌 128 — ${POSTSEASON_SPOT_NOTE[kind]} (시리즈 ${seriesLineOf(career.postseason, career.teamId)}).`
                  + ' 저장 S+0x50 = 128 이라 이어하기(continueSaved)가 128 진입 0x120a4 를 다시 밟는다.'
                  + ` r254 soak(src/app/model/soak/soakFixtures.test.tsx, 씨앗 ${seed} · careerSoak 의 정책)이 그 자리의 실제 저장 모듈(createLocalStorageSaveGame)이 쓴 칸을 떴다`,
                storage: snapshotStorage(),
              })
            }
          }
          if (screen.popup !== null) act(() => actions.closePostseasonPopup())
          else act(() => actions.pressPostseason())
          break
        case '국가대항전': {
          // 134 에 선 순간 — 463 끝 0x8cd44 저장(S+0x50 = 3 · S+0x12c = 1 · 대회 칸). 이어하기 0x1c154 의 그 밖 갈래는 S+0x12c 를
          // S+0xb4(끝난 포스트시즌)보다 먼저 봐 134 로 돌아온다(1c346~1c364 — r241 이 고침, 전엔 392 로 갔다)
          if (!has('nari-cup')) {
            captures.push({
              name: 'nari-cup',
              note: `나리 타자편 ${where()} 국가대항전 134 진입 — 463 끝 저장(S+0x50 = 3 · S+0x12c = 1 · 대회 칸)이라 이어하기(continueSaved)의`
                + ' 그 밖 갈래가 S+0x12c 를 S+0xb4 보다 먼저 봐(0x1c154 1c346~1c364) 134 대진판(히든 팀 · 칭호 8 팝업)으로 돌아온다.'
                + ` r236 soak(src/app/model/soak/soakFixtures.test.tsx, 씨앗 ${seed} · careerSoak 의 정책)이 134 가 처음 선 순간 실제 저장 모듈(createLocalStorageSaveGame)이 쓴 칸을 떴다 (r241 다시 뜸)`,
              storage: snapshotStorage(),
            })
          }
          if (!has('nari-cup-result') && isCupDecided(screen.cup)) {
            captures.push({
              name: 'nari-cup-result',
              note: `나리 타자편 ${where()} 국가대항전 134 — 대회가 끝난 대진판(마지막 경기 뒤 재진입). 저장의 대회 칸으로 이어하기가 134 대진판에 돌아와`
                + ` 대진판 확인(OK)이 결과 팝업 0x25 를 띄운다 (한국 ${screen.cup.champion === KOREA_TEAM_ID ? '우승' : '탈락'}).`
                + ` r241 soak(soakFixtures.test.tsx, 씨앗 ${seed})이 실제 저장 모듈이 쓴 칸을 떴다`,
              storage: snapshotStorage(),
            })
          }
          if (!has('nari-cup-win') && isCupDecided(screen.cup) && screen.cup.champion === KOREA_TEAM_ID) {
            captures.push({
              name: 'nari-cup-win',
              note: `나리 타자편 ${where()} 국가대항전 134 — 한국이 우승한 대회가 끝난 대진판(마지막 경기 뒤 재진입). 저장의 대회 칸으로 이어하기가 134 대진판에`
                + ' 돌아와 대진판 확인(OK)이 결과 팝업 0x25(한국 우승)를 띄운다.'
                + ` r254 soak(soakFixtures.test.tsx, 씨앗 ${seed})이 실제 저장 모듈이 쓴 칸을 떴다`,
              storage: snapshotStorage(),
            })
          }
          act(() => actions.confirmCupTitle())
          const cup = screen.cup
          const next = confirmNationalCupStandings(cup, random)
          if (next.kind === '다음경기') {
            const matchup = nationalCupMatchupOf(cup)
            if (matchup === null) throw new Error('대회 다음 경기인데 대진이 없다')
            act(() => result.current.session.actions.startCupGame(matchup, cup))
          } else {
            act(() => result.current.session.actions.finishCup(finishNationalCup('나만의리그', next.cup)))
          }
          break
        }
        case '엔딩':
          captures.push({
            name: 'nari-ending',
            note: `나리 타자편 ${where()} 엔딩 141 직전 — 엔딩 ${screen.endingIndex} 판정이 선 순간(보너스 팝업 전)의 저장. 원본처럼 저장에 엔딩 칸이 아직 없어`
              + ' 이어하기는 그 앞 114(연말 · 은퇴 이벤트)로 가고, 이벤트를 넘기면 141 이 다시 선다.'
              + ` r236 soak(soakFixtures.test.tsx, 씨앗 ${seed})이 실제 저장 모듈이 쓴 칸을 떴다`,
            storage: snapshotStorage(),
          })
          act(() => actions.receiveEndingBonus())
          captures.push({
            name: 'nari-hall-of-fame',
            note: `나리 타자편 ${where()} 엔딩 ${screen.endingIndex} 보너스를 받은 뒤 — 명예의 전당 등록 직전. 보너스 뒤 저장(S+0x50 = 6 · S+0x7b)이라 이어하기가`
              + ` 141 로 곧장 들어가 키 0x1220c 가 등록 팝업 0x2d 를 띄운다. r236 soak(soakFixtures.test.tsx, 씨앗 ${seed})이 실제 저장 모듈이 쓴 칸을 떴다`,
            storage: snapshotStorage(),
          })
          done = true
          break
        default:
          throw new Error(`다룰 줄 모르는 화면 ${screen.kind}`)
      }
    }
  } finally {
    rendered.unmount()
  }
  if (!done) throw new Error(`나리 타자편 엔딩에 못 닿았다 (${where()})`)
  return captures
}

/* ─────────────── 내 팀 포스트시즌 시리즈 (r254) ─────────────── */

/** 128 에서 뜰 자리 — 내 시리즈 경기 앞 · 내 시리즈가 끝나고 다음 라운드에 선 대진 · 내 팀이 한국시리즈를 이겨 끝난 대진 */
type PostseasonSpot = 'game' | 'next' | 'champion'

const POSTSEASON_SPOT_NOTE: Readonly<Record<PostseasonSpot, string>> = {
  game: '내 팀 시리즈 차례(대진 [다음]이 142 경기 준비로 간다)인 대진판, 그해 내 포스트시즌 경기를 아직 안 친 자리',
  next: '내 시리즈를 이겨 다음 라운드 대진에 선 자리(내 경기를 치르고 116 → 114 → 128 로 돌아온 대진판, [다음]이 다음 라운드 142)',
  champion: '내 팀이 한국시리즈를 이겨 포스트시즌이 끝난 대진판([다음]이 StrMODE[137] 우승 팀 발표 팝업 7, 닫으면 StrMODE[190] 팝업 8)',
}

/** 142 에 선 순간 — 그것이 내 포스트시즌 경기면 라운드를 적는다 */
function noteMyPostseasonGame(mine: { round: string | null }, series: PostseasonSeries | null, myTeamId: number, season: number): void {
  if (series !== null && isMyTurn(series, myTeamId)) mine.round = `${season}/${series.round}`
}

/** 팝업 없는 128 이 어느 자리인가 */
function postseasonSpotsOf(mine: { round: string | null }, series: PostseasonSeries, myTeamId: number, season: number): readonly PostseasonSpot[] {
  if (series.round === '종료') return series.champion === myTeamId ? ['champion'] : []
  if (!isMyTurn(series, myTeamId)) return []
  // 그해 내 경기를 아직 안 쳤다 — 시리즈 경기 앞
  if (mine.round === null || !mine.round.startsWith(`${season}/`)) return ['game']
  return mine.round !== `${season}/${series.round}` ? ['next'] : []
}

function seriesLineOf(series: PostseasonSeries, myTeamId: number): string {
  if (series.round === '종료') return `종료 · 우승 팀 ${series.champion}${series.champion === myTeamId ? '(내 팀)' : ''}`
  return `${series.round} ${series.teams.join(' 대 ')} ${series.wins.join(':')} · 내 팀 ${myTeamId}`
}

/** 대진판 확인이 결과 팝업으로 가는 대회 (`confirmNationalCupStandings` 의 두 '결과' 갈래 — 난수를 안 쓰고 본다) */
function isCupDecided(cup: NationalCup): boolean {
  return isNationalCupOver(cup) || (isNationalCupFinalDay(cup) && !isKoreaInFinal(cup))
}

/* ───────────────────────────── 나리 투수편 ───────────────────────────── */

const TRAINING_RESULT_STATE = 0x7d
const REST_STATE = 0x7f

function playPitcherGameHeadless(options: PitcherGameOptions, random: RandomPort): PitcherGameSummary {
  rollSceneLoadingTip(random)
  let progress = startPitcherGame(options, random)
  let pitches = 0
  for (let step = 0; step < 20_000; step += 1) {
    if (progress.game.isFinished) return pitcherSummaryOf(progress)
    if (progress.managerHookText !== null) progress = closeManagerHookWindow(progress, random)
    else if (progress.lastBurstResolution !== null && progress.lastBurstResolution !== undefined) progress = closeBurstWindow(progress)
    else if (progress.pendingBenchClearing !== null) progress = resolveBenchClearing(progress, { reachedTargetTick: true }, random)
    else if (progress.pendingDefensePlay !== null) progress = resolveDefensePlay(progress, runDefensePlay(progress.pendingDefensePlay), random)
    else if (progress.pendingRunnerPlay != null) progress = resolveRunnerPlay(progress, runLiveRunnerPlayWithoutKeys(progress.pendingRunnerPlay), random)
    else if (progress.sceneConfirmPending === true) progress = confirmScene(progress, random)
    else {
      if (!isPitchTurn(progress)) throw new Error('사람 차례도 붙든 판도 아닌데 경기가 안 끝났다')
      const slots = pitchSlotsFor(progress).filter((slot) => slot.typeNumber > 0 && !slot.isMagic)
      const slot = slots[pitches % Math.max(1, slots.length)]
      progress = startPitch(progress, { typeNumber: slot?.typeNumber ?? 1, gaugeCell: (pitches * 3) % 10 }, random, true)
      pitches += 1
    }
  }
  throw new Error('경기가 2만 걸음 안에 안 끝났다')
}

function walkPitcherEvent(events: readonly OriginalEvent[], eventId: number) {
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
        const choices = command.choices.map((choice) => choice.gotoEvent)
        // 380 연봉: 383 수락 · 그 밖은 첫 칸 (`pitcherLeagueSoak` 과 같다)
        current = event.id === 380 && choices.includes(383) ? 383 : choices[0] ?? 0
        break
      }
    }
  }
  return { viewed, rewards, match: null }
}

/**
 * 나리 투수편을 새 투수부터 은퇴 · 엔딩까지 — `pitcherLeagueSoak` 의 정책(보직 · 능력 상한 시작도 그쪽 긴 판과 같다).
 * 첫 포스트시즌 · 엔딩이 선 순간(보너스 전) · 보너스 뒤를 뜬다
 */
async function captureNariPitcher(seed: number, role: number, boostAbility: boolean): Promise<Capture[]> {
  const store = createLocalStorageJsonStore(PITCHER_KEY)
  const random = createSeededRandom(seed)
  const rendered = renderHook(() => usePitcherLeagueSession(store, random, false))
  const result: { readonly current: PitcherLeagueSession } = rendered.result
  const captures: Capture[] = []
  const has = (name: string) => captures.some((capture) => capture.name === name)
  const where = () => {
    const career = result.current.career
    return career === null ? '-' : `${career.season}년차 ${career.gamesPlayed}경기`
  }
  const how = `r236 soak(src/app/model/soak/soakFixtures.test.tsx, 씨앗 ${seed} · 보직 ${role}${boostAbility ? ' · 능력 보직 상한으로 시작' : ''} · pitcherLeagueSoak 의 정책)`
  let trainingSlot = 0
  let aceMatches = 0
  let cupEntry: object | null = null
  let done = false
  const myPostseason = { round: null as string | null }
  try {
    await waitFor(() => expect(result.current.career).toBeNull())
    act(() => result.current.actions.create('SOAK', {
      role: role as PitcherCareer['role'], typeIndex: seed % 3, handIndex: seed % 2, skinIndex: seed % 3, breakingPitchSlots: [0, 1], teamId: seed % 10,
    }))
    await waitFor(() => expect(result.current.storyEvents).not.toBeNull())
    if (boostAbility && result.current.career !== null) {
      const created = result.current.career
      act(() => result.current.actions.save({ ...created, ability: pitcherAbilityLimitsOf(created) }))
    }
    for (let steps = 0; steps < 120_000 && !done; steps += 1) {
      const session = result.current
      const { career, scene, actions } = session
      if (career === null) throw new Error('커리어가 사라졌다')
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
          noteMyPostseasonGame(myPostseason, career.postseason, career.teamId, career.season)
          act(() => actions.confirmMatchPrepare())
          break
        case '경기': {
          const options = session.gameOptions
          if (options === null) throw new Error('경기인데 옵션이 없다')
          const summary = playPitcherGameHeadless(options, random)
          act(() => result.current.actions.finishGame(summary))
          break
        }
        case '경기결과':
          act(() => actions.confirmGameResult())
          break
        case '이벤트': {
          const story = session.story
          const events = session.storyEvents
          if (story === null || events === null) throw new Error('이벤트인데 재생할 것이 없다')
          const walked = walkPitcherEvent(events, story.eventId)
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
          act(() => actions.finishAceMatch(aceMatches % 2 === 1))
          break
        case '포스트시즌':
          if (!has('pitcher-postseason')) {
            captures.push({
              name: 'pitcher-postseason',
              note: `나리 투수편 ${where()} 포스트시즌 128 시작 — 저장의 이어할 자리가 포스트시즌이라 투수편에 들어서면 128 진입 0x120a4 를 다시 밟는다`
                + ` (시리즈 ${career.postseason?.round} ${career.postseason?.wins.join(':')}). ${how}이 128 이 처음 선 순간 실제 저장 모듈(createLocalStorageJsonStore)이 쓴 칸을 떴다`,
              storage: snapshotStorage(),
            })
          }
          if (session.postseasonPopup === null && career.postseason !== null) {
            for (const kind of postseasonSpotsOf(myPostseason, career.postseason, career.teamId, career.season)) {
              const name = `pitcher-postseason-${kind}`
              if (has(name)) continue
              captures.push({
                name,
                note: `나리 투수편 ${where()} 포스트시즌 128 — ${POSTSEASON_SPOT_NOTE[kind]} (시리즈 ${seriesLineOf(career.postseason, career.teamId)}).`
                  + ` 저장의 이어할 자리가 포스트시즌이라 투수편에 들어서면 128 진입 0x120a4 를 다시 밟는다. ${how.replace('r236', 'r254')}이 그 자리의 실제 저장 모듈이 쓴 칸을 떴다`,
                storage: snapshotStorage(),
              })
            }
          }
          if (session.postseasonPopup !== null) act(() => actions.closePostseasonPopup())
          else act(() => actions.pressPostseason())
          break
        case '국가대항전': {
          const entry = session.cup
          if (entry === null) throw new Error('국가대항전인데 대회가 없다')
          if (!has('pitcher-cup')) {
            captures.push({
              name: 'pitcher-cup',
              note: `나리 투수편 ${where()} 국가대항전 134 진입 — 저장의 대회 칸으로 투수편에 들어서면 134 대진판부터. ${how}이 134 가 처음 선 순간 실제 저장 모듈이 쓴 칸을 떴다`,
              storage: snapshotStorage(),
            })
          }
          if (!has('pitcher-cup-result') && !entry.atStandings && isCupDecided(entry.cup)) {
            captures.push({
              name: 'pitcher-cup-result',
              note: `나리 투수편 ${where()} 국가대항전 134 — 대회가 끝난 대진판(마지막 경기 뒤 재진입). 저장의 대회 칸으로 투수편에 들어서면 134 대진판부터라`
                + ` 대진판 확인(OK)이 결과 팝업 0x25 를 띄운다 (한국 ${entry.cup.champion === KOREA_TEAM_ID ? '우승' : '탈락'}). ${how}이 실제 저장 모듈이 쓴 칸을 떴다`,
              storage: snapshotStorage(),
            })
          }
          if (!has('pitcher-cup-win') && !entry.atStandings && isCupDecided(entry.cup) && entry.cup.champion === KOREA_TEAM_ID) {
            captures.push({
              name: 'pitcher-cup-win',
              note: `나리 투수편 ${where()} 국가대항전 134 — 한국이 우승한 대회가 끝난 대진판(마지막 경기 뒤 재진입). 저장의 대회 칸으로 투수편에 들어서면 134 대진판부터라`
                + ` 대진판 확인(OK)이 결과 팝업 0x25(한국 우승)를 띄운다. ${how.replace('r236', 'r254')}이 실제 저장 모듈이 쓴 칸을 떴다`,
              storage: snapshotStorage(),
            })
          }
          if (!entry.atStandings && cupEntry !== entry.cup && nationalCupStandingsTitleOf(career.titleIds) !== null) {
            cupEntry = entry.cup
            act(() => actions.confirmCupTitle())
            break
          }
          cupEntry = entry.cup
          const next = confirmNationalCupStandings(entry.cup, random)
          if (next.kind === '다음경기') {
            const matchup = nationalCupMatchupOf(entry.cup)
            if (matchup === null) throw new Error('대회 다음 경기인데 대진이 없다')
            act(() => actions.startCupGame(matchup, entry.cup))
          } else {
            act(() => actions.finishCup(finishNationalCup('나만의리그', next.cup)))
          }
          break
        }
        case '연차표지':
          act(() => actions.goto('관리'))
          break
        case '엔딩':
          captures.push({
            name: 'pitcher-ending',
            note: `나리 투수편 ${where()} 엔딩 141 직전 — 엔딩 ${career.endingIndex} 판정이 선 순간(보너스 팝업 전)의 저장. 진입 0x12300 은 엔딩 칸을 저장하지 않아`
              + ` 이어하기는 그 앞 114(연말 · 은퇴 이벤트)로 가고, 이벤트를 넘기면 141 이 다시 선다. ${how}이 실제 저장 모듈이 쓴 칸을 떴다`,
            storage: snapshotStorage(),
          })
          act(() => actions.receiveEndingBonus())
          captures.push({
            name: 'pitcher-hall-of-fame',
            note: `나리 투수편 ${where()} 엔딩 ${career.endingIndex} 보너스를 받은 뒤 — 명예의 전당 등록 직전. 보너스 뒤 저장(S+0x50 = 6 · S+0x7b)이라 투수편에 들어서면`
              + ` 141 로 곧장 들어가 키 0x1220c 가 등록 팝업 0x2d 를 띄운다. ${how}이 실제 저장 모듈이 쓴 칸을 떴다`,
            storage: snapshotStorage(),
          })
          done = true
          break
        default:
          throw new Error(`다룰 줄 모르는 투수편 장면 ${scene}`)
      }
    }
  } finally {
    rendered.unmount()
  }
  if (!done) throw new Error(`나리 투수편 엔딩에 못 닿았다 (${where()})`)
  return captures
}

/* ───────────────────────────── 다시 띄워 보기 ───────────────────────────── */

/** 픽스처 칸만 깐 새 localStorage 로 세션을 새로 세웠을 때 어디로 가는가 — 장면 바로가기가 기다리는 자리와 같아야 한다 */
async function resumedPlaceOf(capture: Capture): Promise<string> {
  loadSnapshot(capture.storage)
  if (capture.name.startsWith('season-')) {
    const rendered = renderHook(() => useSeasonSession(createLocalStorageJsonStore(SEASON_KEY), createSeededRandom(1)))
    try {
      act(() => rendered.result.current.actions.constructScene())
      return `시즌 0x${rendered.result.current.scene.toString(16)}`
    } finally {
      rendered.unmount()
    }
  }
  if (capture.name.startsWith('pitcher-')) {
    const rendered = renderHook(() => usePitcherLeagueSession(createLocalStorageJsonStore(PITCHER_KEY), createSeededRandom(1), false))
    try {
      return `투수편 ${rendered.result.current.scene}`
    } finally {
      rendered.unmount()
    }
  }
  // 장면 바로가기와 같은 길 — 저장을 읽은 새 세션의 이어하기(`continueSaved` 0x1c154). 이벤트 본문이 온 뒤의 화면까지 본다
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    return { screen, session: useCareerSession({ runner, random: createSeededRandom(1), saveGame: createLocalStorageSaveGame(), screen, setScreen }) }
  })
  try {
    if (rendered.result.current.session.savedCareer === null) return '타자편 저장 없음'
    act(() => rendered.result.current.session.actions.continueSaved())
    await waitFor(() => expect(rendered.result.current.session.storyEvents).not.toBeNull())
    await act(async () => {
      await Promise.resolve()
    })
    const { screen } = rendered.result.current
    if (screen.kind === '국가대항전') return `타자편 국가대항전${isCupDecided(screen.cup) ? ' 끝남' : ''}`
    return `타자편 ${screen.kind}${screen.kind === '이벤트' ? ` ${screen.eventId}` : ''}`
  } finally {
    rendered.unmount()
  }
}

/** 뜬 자리마다 다시 띄우면 가야 할 곳 */
const EXPECTED_RESUME: Readonly<Record<string, string | RegExp>> = {
  'season-ending': `시즌 0x${SEASON_SCENE_STATE.엔딩.toString(16)}`,
  'nari-postseason': '타자편 포스트시즌',
  'nari-cup': '타자편 국가대항전',
  'nari-cup-result': '타자편 국가대항전 끝남',
  'nari-ending': /^타자편 이벤트 \d+$/,
  'nari-hall-of-fame': '타자편 엔딩',
  'pitcher-postseason': '투수편 포스트시즌',
  'pitcher-cup': '투수편 국가대항전',
  'pitcher-cup-result': '투수편 국가대항전',
  'pitcher-ending': '투수편 이벤트',
  'pitcher-hall-of-fame': '투수편 엔딩',
  'nari-postseason-game': '타자편 포스트시즌',
  'nari-postseason-next': '타자편 포스트시즌',
  'nari-postseason-champion': '타자편 포스트시즌',
  'nari-cup-win': '타자편 국가대항전 끝남',
  'pitcher-postseason-game': '투수편 포스트시즌',
  'pitcher-postseason-next': '투수편 포스트시즌',
  'pitcher-postseason-champion': '투수편 포스트시즌',
  'pitcher-cup-win': '투수편 국가대항전',
}

async function checkAndWrite(captures: readonly Capture[]): Promise<void> {
  for (const capture of captures) {
    const place = await resumedPlaceOf(capture)
    const expected = EXPECTED_RESUME[capture.name]
    if (expected instanceof RegExp) expect(place, `${capture.name} 를 다시 띄운 자리`).toMatch(expected)
    else expect(place, `${capture.name} 를 다시 띄운 자리`).toBe(expected)
    writeFixture(capture)
    process.stdout.write(`[soak 픽스처] ${capture.name}: ${place} · ${JSON.stringify(capture.storage).length}B${isDryRun ? ' (안 씀)' : ''}\n`)
  }
}

/** 씨앗 — 포스트시즌(정규시즌 1위 진입 팝업) · 국가대항전을 둘 다 지나 보너스 엔딩(4)까지 가는 판. r249 에 엔진 변경(r244 정산 따위)으로 씨앗 1 이 4년차 부상 엔딩 0 · 1위 아님으로 갈라져 4 로 옮겼다 (`SOAK_FIXTURE_NARI_SEED` · `SOAK_FIXTURE_PITCHER_SEED` 로 바꿔 찾는다) */
const NARI_SEED = Number(process.env.SOAK_FIXTURE_NARI_SEED ?? 4)
/** 투수편 — r259 에 r257(투수편 이벤트 보상) 이후 씨앗 2 가 국가대항전 한국 우승에 못 닿아 1 로 옮겼다(1 · 4 · 5 · 6 · 7 은 아홉 자리 다 닿는다) */
const PITCHER_SEED = Number(process.env.SOAK_FIXTURE_PITCHER_SEED ?? 1)
/**
 * 타자편 `nari-cup-win` 만 뜨는 씨앗 (r254) — 씨앗 4 는 13년 내내 국가대항전에서 한국이 못 이겨, 한국 우승 대진판은 따로 돌려 뜬다.
 * r254 에 1 · 2 · 3 · 5 · 6 · 7 을 훑어 2 · 3 · 5 에서 닿았다 (`SOAK_FIXTURE_NARI_CUP_WIN_SEED` 로 바꾼다)
 */
const NARI_CUP_WIN_SEED = Number(process.env.SOAK_FIXTURE_NARI_CUP_WIN_SEED ?? 5)

describe.runIf(isEnabled)('soak 로 e2e 픽스처 뜨기 (SOAK_FIXTURE=1)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetCommonWindowShownForTest()
  })
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('시즌모드 10년차 엔딩 직전', async () => {
    const capture = captureSeasonEnding(1, 1)
    expect(capture.storage[SEASON_KEY], '시즌 저장 칸').toBeDefined()
    expect((capture.storage[SEASON_KEY] as { state?: { record?: { phase?: number } } }).state?.record?.phase).toBe(SEASON_PHASE.엔딩)
    await checkAndWrite([capture])
  }, 600_000)

  it('나리 타자편 포스트시즌 128 · 국가대항전 134(진입 · 끝난 대진판) · 엔딩 141 · 명예의 전당 등록 앞', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] })
    // r259 — 판이 갈려 씨앗 4 도 한국 우승 대진판에 닿지만, `nari-cup-win` 은 아래 씨앗 따로 판이 뜬다
    const captures = (await captureNari(NARI_SEED)).filter((capture) => capture.name !== 'nari-cup-win')
    vi.useRealTimers()
    process.stdout.write(`[soak 픽스처] 타자편 뜬 것: ${captures.map((capture) => capture.name).join(' ')}\n`)
    expect(captures.map((capture) => capture.name).sort()).toEqual([
      'nari-cup', 'nari-cup-result', 'nari-ending', 'nari-hall-of-fame', 'nari-postseason',
      'nari-postseason-champion', 'nari-postseason-game', 'nari-postseason-next',
    ])
    await checkAndWrite(captures)
  }, 1_200_000)

  it('나리 타자편 국가대항전 한국 우승 대진판 (씨앗 따로 — 기본 씨앗은 13년 동안 한국이 못 이긴다)', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] })
    const captures = (await captureNari(NARI_CUP_WIN_SEED)).filter((capture) => capture.name === 'nari-cup-win')
    vi.useRealTimers()
    expect(captures.map((capture) => capture.name)).toEqual(['nari-cup-win'])
    await checkAndWrite(captures)
  }, 1_200_000)

  it('나리 투수편 포스트시즌 · 국가대항전(진입 · 끝난 대진판) · 엔딩 · 명예의 전당 등록 앞', async () => {
    const captures = await captureNariPitcher(PITCHER_SEED, PITCHER_ROLE.starter, true)
    process.stdout.write(`[soak 픽스처] 투수편 뜬 것: ${captures.map((capture) => capture.name).join(' ')}\n`)
    expect(captures.map((capture) => capture.name)).toEqual(expect.arrayContaining([
      'pitcher-postseason', 'pitcher-cup', 'pitcher-cup-result', 'pitcher-ending', 'pitcher-hall-of-fame',
      'pitcher-postseason-game', 'pitcher-postseason-next', 'pitcher-postseason-champion', 'pitcher-cup-win',
    ]))
    await checkAndWrite(captures)
  }, 1_200_000)
})

describe.skipIf(isEnabled)('soak 픽스처 뜨기 — 꺼짐', () => {
  it('SOAK_FIXTURE=1 이 아니면 건너뛴다', () => {
    expect(isEnabled).toBe(false)
  })
})

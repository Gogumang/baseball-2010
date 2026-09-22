import { useCallback, useEffect, useRef, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'
import { resolveDefensePlay, startGame, startPlayerOutcome, stealBase, summaryOf } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import {
  applyGameResult,
  applyLeagueDay,
  applyPostseasonProgress,
  nextOpponentOf,
  applySeasonEnd,
  createCareer,
  gainMorale,
  gainPopularity,
  gainReputation,
  gamePointRewardOf,
  spendCycleAction,
  isManagementCycleOpen,
  isSeasonFinished,
  startNextSeason,
  gainGamePoint,
  countGameForSkills,
  MAXIMUM_GAME_POINT,
} from '@/entities/career/model/playerCareer'
import { applyBurstRewards } from '@/entities/career/model/burstReward'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { awardTitles, equipTitle, evaluateNewTitles } from '@/entities/career/model/titles'
import { blockReasonOf, runTraining } from '@/entities/career/model/training'
import { trainingBlockTextOf, trainingOutcomeLinesOf } from '@/entities/career/model/trainingText'
import { recoverAfterRest, restBlockReasonOf, runOuting, runRest } from '@/entities/career/model/outing'
import { EVENT_TRIGGER, finishEvent, placeTriggerOf } from '@/entities/story/model/storyScene'
import { selectShopItem } from '@/features/shop/model/shopSelection'
import { hiddenOpenTextOf } from '@/entities/career/model/equipment'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { useStorySchedule } from '@/app/model/useStorySchedule'
import { nextSeasonStep } from '@/app/model/seasonEvents'
import {
  achievedGoalCount,
  applyEndingBonus,
  canContinueAfterEnding,
  continueAfterEnding,
  GOAL_INTRO_EVENT_ID,
  MID_SEASON_GAME,
  midSeasonEventId,
  midSeasonTitlesOf,
} from '@/entities/career/model/seasonFlow'
import { forgetRepeatableEvents } from '@/entities/story/model/storyScene'
import { battingOrderEventId, emptyPlaceEventId, isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { applyEventRewards } from '@/entities/story/model/eventReward'
import { rollTrainingInjury } from '@/entities/career/model/condition'
import type { ManagementDetail } from '@/app/model/managementDetail'
import { evaluateGame, updateStreaks } from '@/entities/career/model/gameEvaluation'
import { recordSeasonMvp } from '@/entities/awards/model/seasonAwards'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { ManagementCommand } from '@/pages/management/ui/ManagementScreen'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { pickLoadingTip } from '@/shared/config/loadingTips'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { advanceNationalCupDay } from '@/entities/national-cup/model/nationalCupPlay'
import {
  careerNationalCupRewardItems,
  careerNationalTeamEventId,
  isCareerNationalCupYear,
  NATIONAL_CUP_EVENT,
} from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'

interface CareerSessionInput {
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly saveGame: SaveGamePort
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
}

/** 육성 모드 한 판 — 커리어·경기 진행·관리 커맨드를 한데 묶는다. */
export function useCareerSession({
  runner,
  random,
  saveGame,
  screen,
  setScreen,
}: CareerSessionInput) {
  const [savedCareer, setSavedCareer] = useState<PlayerCareer | null>(() => saveGame.load())
  const [rawCareer, setCareer] = useState<PlayerCareer | null>(null)
  /**
   * ⚠️ **테스트용** — `?무한G` 가 켜져 있으면 G 를 최대로 올린다 (`devOptions.ts`).
   *
   * ⚠️ 예전에는 **보여 주는 값만** 올리고 저장은 그대로 뒀는데, 그러면 화면과 판정이 어긋난다:
   *    상점이 99999 를 보여 주면서 1000 G 짜리 엄마의도시락을 "G포인트 부족" 으로 막았다
   *    (구매 가드 `shopSelection.ts` 는 진짜 값을 본다). 거짓말하는 스위치가 더 나빠서,
   *    지금은 **상태 자체를** 올린다 — 그래서 켠 채로 무언가를 하면 저장에도 99999 가 남는다.
   */
  const career = isInfiniteGamePointOn() && rawCareer !== null
    ? { ...rawCareer, gamePoint: MAXIMUM_GAME_POINT }
    : rawCareer

  const [progress, setProgress] = useState<GameProgress | null>(null)

  const [shopNotice, setShopNotice] = useState('')
  const [outingNotice, setOutingNotice] = useState('')
  const [managementNotice, setManagementNotice] = useState('')
  /** 상세정보 결과 창 (0x8a0a4) — 닫을 때 훈련은 부상, 휴식은 회복을 굴린다 */
  const [managementDetail, setManagementDetail] = useState<ManagementDetail | null>(null)
  /** 경기 전 원작 로딩 화면에 띄울 팁. null 이면 로딩 중이 아니다. */
  const [loadingTip, setLoadingTip] = useState<string | null>(null)

  // 캔버스 루프에서 최신 값을 읽어야 한다 — useAtBatRunner의 atBatRef와 같은 이유다.
  const progressRef = useRef(progress)
  progressRef.current = progress
  const careerRef = useRef(career)
  careerRef.current = career

  // 커리어가 바뀔 때마다 저장한다. 저장 실패는 게임 진행을 막지 않는다.
  useEffect(() => {
    if (career === null) return
    saveGame.save(career)
    setSavedCareer(career)
  }, [career, saveGame])

  /**
   * 사람이 치르고 있는 국가대항전 경기 (상태 142 `0x1c46c`) — 경기가 끝나면 이 대회로 하루를 넘긴다.
   * 정규 경기일 때는 늘 null 이다.
   */
  const cupGameRef = useRef<NationalCup | null>(null)

  /** 경기 한 판을 세운다 — 로딩 화면(StrTIP)이 끝나야 첫 투구가 나간다 */
  const startMatch = useCallback(
    (
      ourTeamId: number,
      battingOrder: number | undefined,
      opponentTeamId: number | undefined,
      /** 리그 날짜 카운터 g — 4인 로테이션이 본다 (`시즌+0xb2` 자리, 커리어는 `gamesPlayed`) */
      dayCounter = 0,
    ) => {
      const started = startGame(random, ourTeamId, battingOrder, opponentTeamId, undefined, dayCounter)
      progressRef.current = started
      setProgress(started)
      runner.resetAtBat()
      runner.setBannerText('')
      runner.setIsPaused(true)
      setLoadingTip(pickLoadingTip(random))
      setScreen({ kind: '경기' })
    },
    [random, runner, setScreen],
  )

  const beginGame = useCallback(() => {
    const current = careerRef.current
    cupGameRef.current = null
    startMatch(
      current?.teamId ?? 0,
      current?.battingOrder,
      // 상대는 일정표(정규시즌)나 지금 시리즈(포스트시즌)가 정한다 — 무작위가 아니다
      current === null || current === undefined ? undefined : nextOpponentOf(current),
      // 오늘까지 치른 경기 수가 곧 날짜 카운터 g 다 — 양 팀 선발이 네 경기마다 한 바퀴 돈다
      current?.gamesPlayed ?? 0,
    )
  }, [startMatch])

  /** 경기가 끝났을 때 보상·칭호를 정산하고 결과 화면으로 넘어간다. */
  const finishGame = useCallback(
    (finished: GameProgress, currentCareer: PlayerCareer) => {
      const summary = summaryOf(finished)
      // 경기 후 평가 — 인기도 → 평판 → 사기 (0xa719c), 이어서 연속 기록 (0x8a6fc)
      const evaluation = evaluateGame(currentCareer, summary)
      const evaluated = gainMorale(
        gainReputation(
          gainPopularity(
            // 같은 날 나머지 네 경기도 원본대로 치러 순위표에 넣는다 (0xc2a48)
            // 45경기째면 정규시즌을 닫고, 포스트시즌은 내 차례가 올 때까지 CPU 끼리 돌린다 (0x13da0)
            applyPostseasonProgress(
              applySeasonEnd(applyLeagueDay(applyGameResult(currentCareer, summary), summary.ourTeamId, random)),
              random,
            ),
            evaluation.popularityChange,
          ),
          evaluation.reputationChange,
        ),
        evaluation.moraleChange,
      )
      // 스킬 조건용 경기 뒤 카운터 — 사기까지 반영된 뒤에 센다 (A-4)
      const counted = countGameForSkills(evaluated, evaluation.popularityChange)
      const streak = updateStreaks(counted, summary.stats)
      const streakReputation = streak.notices.reduce((total, notice) => total + notice.reputationChange, 0)
      // 부상은 경기 뒤가 아니라 훈련 결과 창을 닫을 때 굴린다 (0x1b4c4)
      const rolled = gainReputation(streak.career, streakReputation)
      const newTitles = evaluateNewTitles(rolled)
      setCareer(awardTitles(rolled, newTitles))
      setScreen({
        kind: '경기결과',
        summary,
        gamePointReward: gamePointRewardOf(summary),
        newTitles,
        evaluation,
        streakNotices: streak.notices,
      })
    },
    [random, setScreen],
  )

  /**
   * 국가대항전 사람 경기가 끝났다 — 결과 장면 `0x4ea0c` 차례(내 경기 승패 기록 → 같은 라운드
   * CPU 경기 `0xc2dac` → 하루 끝 `0xb818c`)를 `advanceNationalCupDay` 가 그대로 한다.
   * 그 뒤 상태 101 재진입(`0x1c154`)이 `S+0x12c` 를 보고 순위 화면 134 로 돌려보낸다 (P5 1a·5절).
   *
   * ⚠️ **웹판 임시**: 원본은 대회 경기 뒤에도 경기 결과 화면을 한 번 보여 주는데, 웹 `경기결과`
   * 화면의 [확인]은 정규시즌 정산(`confirmGameResult`)에 묶여 있어 대회 경기에는 쓸 수 없다 —
   * 곧장 순위 화면으로 돌아간다.
   * 대회 경기는 커리어 기록(리그 승패·연속 기록·칭호·G포인트)을 건드리지 않는다. 원본도 국가대항전
   * 승패는 4국 칸(`L+0xb0`/`L+0xb4`)에만 넣고 "정규 기록은 건드리지 않는다"(P5 1a).
   */
  const finishCupGame = useCallback(
    (finished: GameProgress, cup: NationalCup) => {
      const summary = summaryOf(finished)
      // 무승부는 대한민국의 패로 친다 — 원본 CPU 경기(`0xc2f12`)도 동점이면 뒷 칸이 이긴다. **근사다**
      const won = summary.result === '승'
      const winner = won ? summary.ourTeamId : summary.opponentTeamId
      const loser = won ? summary.opponentTeamId : summary.ourTeamId
      cupGameRef.current = null
      setScreen({ kind: '국가대항전', cup: advanceNationalCupDay(cup, winner, loser, random) })
    },
    [random, setScreen],
  )

  /**
   * 타석 하나가 경기 상태에 다 먹은 뒤 — 결과 배너를 띄우고, 경기가 끝났으면 정산으로 넘긴다.
   * 인플레이 타구는 **수비 화면이 끝난 뒤에야** 여기까지 온다.
   */
  const finishAtBat = useCallback(
    (advanced: GameProgress, outcome: AtBatOutcome, runnersOnBase: number) => {
      runner.pauseWithBanner(describeOutcomeBanner(outcome, runnersOnBase), () => {
        if (!advanced.game.isFinished) {
          runner.setIsPaused(false)
          return
        }
        // 국가대항전 경기는 커리어 정산을 타지 않고 대회 하루를 넘긴다 (상태 142 → 101 → 134)
        const cup = cupGameRef.current
        if (cup !== null) return finishCupGame(advanced, cup)
        const currentCareer = careerRef.current
        if (currentCareer !== null) finishGame(advanced, currentCareer)
      })
    },
    [finishCupGame, finishGame, runner],
  )

  const handlePitchResolved = useCallback(
    (detail: PitchOutcomeDetail, _pitch?: unknown, isUncatchable?: boolean) => {
      const nextAtBat = runner.applyPitch(detail.resolution)
      if (!isAtBatFinished(nextAtBat) || nextAtBat.outcome === null) return

      const currentProgress = progressRef.current
      if (currentProgress === null) return

      const { bases } = currentProgress.game
      const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
      // 타석 결과(안타/아웃 코드)만 먼저 정한다 — 인플레이 타구면 주자 처리는 화면 뒤로 미뤄진다.
      // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
      const advanced = startPlayerOutcome(currentProgress, nextAtBat.outcome, random, { isUncatchable })
      progressRef.current = advanced
      setProgress(advanced)

      // 수비 진행 중 — 화면이 틱을 돌리는 동안 타석을 멈춰 둔다. 원본도 상태 0x17 이 도는 동안
      // 0xf(타석 준비)로 돌아가지 않아 다음 투구가 나가지 않는다
      if (advanced.pendingDefensePlay !== null) {
        runner.setIsPaused(true)
        return
      }
      finishAtBat(advanced, nextAtBat.outcome, runnersOnBase)
    },
    [finishAtBat, random, runner],
  )

  const story = useStorySchedule(career)
  /**
   * 관리 화면에 들어설 때 trigger 0 이벤트를 본다. 경기를 마치고 들어올 때만 무작위 조건(질병)을 굴리고,
   * 이벤트 뒤 이어서 볼 때는 굴리지 않는다 — 반복 이벤트가 연달아 나오지 않게.
   */
  const [managementCheck, setManagementCheck] = useState<'무작위포함' | '고정' | null>(null)
  // 저장을 불러오면 반복 이벤트를 다시 볼 수 있게 한다 (0xacf60) — 이벤트 본문이 도착한 뒤에
  const [shouldForgetRepeatable, setShouldForgetRepeatable] = useState(false)
  useEffect(() => {
    if (!shouldForgetRepeatable || career === null || story.events === null) return
    setShouldForgetRepeatable(false)
    setCareer(forgetRepeatableEvents(career, story.events))
  }, [shouldForgetRepeatable, career, story.events])
  useEffect(() => {
    if (managementCheck === null || screen.kind !== '관리' || career === null || story.events === null) return
    setManagementCheck(null)
    // 경기 뒤에는 타순 이벤트가 먼저다 (0x11910 → 상태 138)
    const orderEventId = managementCheck === '무작위포함' ? battingOrderEventId(career) : null
    if (orderEventId !== null) return setScreen({ kind: '이벤트', eventId: orderEventId, context: '관리' })
    const event = story.eventFor(career, EVENT_TRIGGER.관리, managementCheck === '무작위포함' ? random : undefined)
    if (event !== null) setScreen({ kind: '이벤트', eventId: event.id, context: '관리' })
  }, [managementCheck, screen.kind, career, story, random, setScreen])

  /**
   * 새 시즌 처리 `0x1b768` → 137 "N년차" → 105 관리 화면.
   * 시즌이 끝나면 시상을 하고 **MVP 비트를 남긴다** (0x8dd60 → career+0x1ca).
   * 새 시즌으로 넘어가도 지우지 않는다 — 통산 MVP 를 보는 칭호가 이것을 읽는다.
   */
  const startNewSeason = (finished: PlayerCareer) => {
    const next = startNextSeason(recordSeasonMvp(finished))
    setCareer(awardTitles(next, evaluateNewTitles(next)))
    setScreen({ kind: '관리' })
    setManagementCheck('고정')
  }

  const continueSeason = (viewed: PlayerCareer, viewedEventIds: readonly number[]) => {
    // ── 국가대표 이벤트(461~464)는 연말 사슬 밖이다. 상태 133 이 따로 예약한 것이라 먼저 가른다 ──
    if (viewedEventIds.includes(NATIONAL_CUP_EVENT.출전)) {
      // 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 대회를 세우고 순위 화면 134 를 줄에 넣는다
      setCareer(awardTitles(viewed, evaluateNewTitles(viewed)))
      return setScreen({ kind: '국가대항전', cup: createNationalCup() })
    }
    if (viewedEventIds.includes(NATIONAL_CUP_EVENT.거절) || viewedEventIds.includes(NATIONAL_CUP_EVENT.탈락)) {
      // 464 거절은 `S+0x12c = 0` 으로 바로 새 시즌이다 (P5 요약, 확정).
      // 462 탈락은 원본이 상태 105(관리 화면)로만 적혀 있고 새 시즌 처리(`0x1b768`)가 안 보이는데,
      // 그러면 연말 사슬이 안 닫혀 웹에서는 그 해에 갇힌다. 대회 끝(`0x1b92c`)이 우승·탈락 두 갈래
      // **모두** `0x1b768` 로 가는 것과 짝을 맞춰 여기서도 새 시즌으로 넘긴다 — **근사다**.
      return startNewSeason(viewed)
    }

    const step = nextSeasonStep(viewed, viewedEventIds)
    if (step.kind === '이벤트') {
      setCareer(viewed)
      return setScreen({ kind: '이벤트', eventId: step.eventId, context: '시즌' })
    }
    if (step.kind === '엔딩') {
      // 엔딩 보너스는 엔딩을 띄울 때 준다 (0x1220c). 부상·방출은 0 이다
      setCareer(applyEndingBonus({ ...viewed, endingIndex: step.endingIndex }, step.endingIndex))
      return setScreen({ kind: '엔딩', endingIndex: step.endingIndex })
    }
    if (step.kind === '새시즌') {
      // 연말 상태 132 → 133 국가대표 선발 판정 (`0x1a090`). 연차 idx 는 **끝난 해**의 것이라
      // 새 시즌을 올리기 전에 본다. 방출·13년차 은퇴는 위 '엔딩' 가지에서 이미 빠졌다.
      if (isCareerNationalCupYear(viewed.season - 1)) {
        setCareer(viewed)
        return setScreen({
          kind: '이벤트',
          eventId: careerNationalTeamEventId(achievedGoalCount(viewed, '연말')),
          context: '시즌',
        })
      }
      return startNewSeason(viewed)
    }
    setCareer(awardTitles(viewed, evaluateNewTitles(viewed)))
    setScreen({ kind: '관리' })
    setManagementCheck('무작위포함')
  }

  /** 전역 기록의 히든 오픈 id 를 선수에게 옮긴다 — 더할 것이 없으면 그대로 둔다 */
  const syncOpenedHidden = useCallback((ids: readonly number[]) => {
    setCareer((previous) => {
      if (previous === null) return previous
      const missing = ids.filter((id) => !previous.openedHiddenIds.includes(id))
      return missing.length === 0 ? previous : { ...previous, openedHiddenIds: [...previous.openedHiddenIds, ...missing] }
    })
  }, [])

  /**
   * 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`).
   * **여기서야** 진루·아웃·득점이 경기 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다.
   *
   * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
   * 붙들어 둔 상태를 푼다 — 안 그러면 다음 타석이 영영 시작되지 않는다.
   */
  const finishDefensePlay = useCallback(
    (result?: DefensePlayResult) => {
      const current = progressRef.current
      const pending = current?.pendingDefensePlay ?? null
      if (current === null || pending === null) return

      const { bases } = current.game
      const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
      const resolved = resolveDefensePlay(current, result ?? runDefensePlay(pending), random)
      progressRef.current = resolved
      setProgress(resolved)
      finishAtBat(resolved, pending.outcome, runnersOnBase)
    },
    [finishAtBat, random],
  )

  const actions = {
    syncOpenedHidden,

    /** 수비 화면이 끝났다 — 주자 처리를 이제 먹인다 */
    finishDefensePlay,

    /**
     * 도루 (원본 키 '3' 1루 주자 · '2' 2루 주자 → `0x53610`).
     * 성공하면 한 루 나가고 실패하면 아웃 하나가 는다 — 판정은 진행기가 한다.
     */
    stealBase: (base: 1 | 2) => {
      const current = progressRef.current
      if (current === null) return
      const next = stealBase(current, base, random)
      if (next === current) return
      progressRef.current = next
      setProgress(next)
    },

    /**
     * 돌발미션 결과 창을 닫았다 — 보상·페널티를 내 선수에게 얹고 판정을 치운다 (0x8e34c).
     * 나만의리그는 붙을 곳이 내 선수 레코드(0x1fa2d)라 커리어에 바로 얹는다.
     */
    closeBurstResult: () => {
      const current = progressRef.current
      const resolution = current?.lastBurstResolution ?? null
      if (current === null || resolution === null) return
      const cleared = { ...current, lastBurstResolution: null }
      progressRef.current = cleared
      setProgress(cleared)
      setCareer((player) => (player === null ? player : applyBurstRewards(player, resolution.deltas)))
    },
    /**
     * 미션 클리어 보상 G (0xa52b0). 원본은 전역 저장 +0x64 에 쌓지만 웹은 커리어에 둔다 —
     * 육성 선수가 없으면 받아 갈 곳이 없어 그냥 버린다.
     */
    gainGamePoint: (amount: number) => {
      setCareer((current) => (current === null ? current : gainGamePoint(current, amount)))
    },
    startNewCareer: (name: string, profile: RookieProfile) => {
      saveGame.clear()
      setCareer(createCareer(name, profile))
      setScreen({ kind: '관리' })
      setManagementCheck('고정')
    },

    /** 환경설정 [나만의리그 초기화] — 저장을 지운다 */
    resetCareer: () => {
      saveGame.clear()
      setSavedCareer(null)
      setCareer(null)
    },

    continueSaved: () => {
      if (savedCareer === null) return
      setCareer(savedCareer)
      setScreen({ kind: '관리' })
      setManagementCheck('고정')
      setShouldForgetRepeatable(true)
    },

    runCommand: (command: ManagementCommand) => {
      if (career === null) return
      // 알림은 [확인] 을 눌러야 지워진다 — "다음경기 때까지 남긴다" 는 원본 근거가 없어 없앴다
      if (command === '다음경기') return beginGame()
      if (command === '휴식') {
        // 원작 [휴식] 커맨드 — 사기를 회복한다. 관리 주기마다 한 가지만 할 수 있다.
        const blockReason = restBlockReasonOf(career)
        if (blockReason !== null) {
          return setManagementNotice(
            blockReason === '사기최고'
              ? '사기 최고 상태입니다' // StrMODE[91]
              : '트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다',
          )
        }
        const rest = runRest(career, random)
        setCareer(rest.career)
        // StrMODE[24] "사기" + " " + 수치 + [83] (0x18e3c)
        return setManagementDetail({
          before: career,
          after: rest.career,
          messages: [`사기 ${rest.moraleGain} 상승하였습니다`],
          afterClose: { kind: '휴식' },
        })
      }
      if (command === '외출') {
        setOutingNotice('')
        // trigger 1 — 외출 지도에 들어설 때 먼저 보는 이벤트
        const event = story.eventFor(career, EVENT_TRIGGER.외출)
        if (event !== null) return setScreen({ kind: '이벤트', eventId: event.id, context: '외출진입' })
        return setScreen({ kind: '외출' })
      }
    },

    /** [아이템] 하위 메뉴 → 그 탭의 상점 */
    openShop: (tab: string) => {
      setShopNotice('')
      setScreen({ kind: '아이템', tab })
    },

    /**
     * [선수정보] 하위 메뉴. 원본 기본정보(레이더 차트)·아이템/스킬·필살타법 화면은 아직 없어
     * 장비착용은 장착 상점으로, 나머지는 성적 화면으로 보낸다 (임시)
     */
    openPlayerInfo: (itemId: string) => {
      if (itemId === '장비착용') {
        setShopNotice('')
        return setScreen({ kind: '아이템', tab: '착용' })
      }
      setScreen({ kind: '성적' })
    },

    /**
     * 칭호 목록(하위 상태 129)에서 하나를 골랐다 — 키 처리 0x11f78 의 확인 갈래.
     * 원본은 선수 +0x1c4 를 바꾸고 팝업(이름 + StrMODE[138])을 띄운 뒤 곧바로 저장한다(0x1fdec).
     * 웹은 커리어가 바뀌면 `useEffect` 가 저장하므로 여기서는 값만 쓴다.
     */
    equipTitle: (title: string) => {
      setCareer((current) => (current === null ? current : equipTitle(current, title)))
    },

    confirmGameResult: () => {
      if (career === null) return
      if (isSeasonFinished(career)) return setScreen({ kind: '시즌종료' })
      // 22경기 뒤 중간평가 (0x11910 → 0x11e84)
      if (career.gamesPlayed === MID_SEASON_GAME) {
        const achieved = achievedGoalCount(career, '중간')
        const evaluated = awardTitles(career, midSeasonTitlesOf(career, achieved).filter((title) => !career.titleIds.includes(title)))
        setCareer({ ...evaluated, lastMidSeasonGoalCount: achieved })
        return setScreen({ kind: '이벤트', eventId: midSeasonEventId(achieved), context: '시즌' })
      }
      if (isManagementCycleOpen(career)) {
        setScreen({ kind: '관리' })
        return setManagementCheck('무작위포함')
      }
      beginGame()
    },

    /** [트레이닝] 하위 메뉴 — 연출이 끝난 뒤 불린다. 결과는 관리 화면 알림으로 보인다 */
    runTrainingMenu: (menuId: string) => {
      const menu = TRAINING_MENUS.find((candidate) => candidate.id === menuId)
      if (career === null || menu === undefined) return

      const outcome = runTraining(career, menu, random)
      const trained = awardTitles(outcome.career, evaluateNewTitles(outcome.career))
      setCareer(trained)
      setManagementDetail({
        before: career,
        after: trained,
        messages: trainingOutcomeLinesOf(outcome),
        afterClose: { kind: '훈련', isSpecialSwing: outcome.specialSwing !== null },
      })
    },

    /** 결과 창을 닫는다 — 훈련은 부상(0x1b4c4), 휴식은 회복(0x1b308)을 이때 굴린다 */
    closeManagementDetail: () => {
      if (career === null || managementDetail === null) return
      const { afterClose } = managementDetail
      setManagementDetail(null)
      if (afterClose.kind === '훈련') {
        const injury = rollTrainingInjury(career, afterClose.isSpecialSwing, random)
        setCareer(injury.career)
        return setManagementNotice(injury.notice ?? '')
      }
      const recovery = recoverAfterRest(career, random)
      setCareer(recovery.career)
      setManagementNotice(recovery.recoveries.join(' · '))
    },

    /** 관리 화면 알림 상자 [확인] — 알림은 여기서만 지운다 (화면이 기억하면 같은 문구가 다시 안 뜬다) */
    dismissManagementNotice: () => setManagementNotice(''),

    isRestBlocked: () => career === null || restBlockReasonOf(career) !== null,

    showTrainingBlocked: (menuId: string) => {
      const menu = TRAINING_MENUS.find((candidate) => candidate.id === menuId)
      if (career === null || menu === undefined) return
      const reason = blockReasonOf(career, menu)
      if (reason !== null) setManagementNotice(trainingBlockTextOf(reason, menu.name))
    },

    isTrainingBlocked: (menuId: string) => {
      const menu = TRAINING_MENUS.find((candidate) => candidate.id === menuId)
      return career === null || menu === undefined || blockReasonOf(career, menu) !== null
    },

    runOutingFunction: (functionId: string) => {
      const outingFunction = OUTING_PLACES.flatMap((place) => place.functions).find(
        (candidate) => candidate.id === functionId,
      )
      if (career === null || outingFunction === undefined) return

      const updated = runOuting(career, outingFunction, random)
      setOutingNotice(`${outingFunction.name} — ${outingFunction.description}`)
      setCareer(awardTitles(updated, evaluateNewTitles(updated)))
    },

    /** 상점에서 한 칸을 고른다 (장착·서브·GP — shopSelection) */
    purchase: (itemId: string) => {
      if (career === null) return
      const selection = selectShopItem(career, itemId, random)
      setShopNotice(selection.notice)
      setCareer(awardTitles(selection.career, evaluateNewTitles(selection.career)))
    },

    /** [!] 장소에서 [들어가기] — 그 장소(trigger 2~6)의 이벤트를 본다 */
    enterPlace: (place: OutingPlace) => {
      if (career === null || career.hasActedThisCycle) return
      // 이벤트가 없는 장소는 "특별한 일이 없다" (0x16ccc)
      const event = story.eventFor(career, placeTriggerOf(place.frame))
      const eventId = event?.id ?? emptyPlaceEventId(place.frame)
      setScreen({ kind: '이벤트', eventId, context: '장소' })
    },

    completeScene: (rewards: readonly EventReward[], viewedEventIds: readonly number[]) => {
      if (career === null || screen.kind !== '이벤트') return
      const viewed = applyEventRewards(finishEvent(career, viewedEventIds), rewards, random, screen.eventId)
      // 보상 7 로 열린 히든 장비 알림 (StrCOMMON[139]+[143])
      const openTexts = viewed.openedHiddenIds
        .filter((id) => !career.openedHiddenIds.includes(id))
        .map(hiddenOpenTextOf)
        .filter((text): text is string => text !== null)
      if (openTexts.length > 0) setManagementNotice(openTexts.join(' · '))

      if (screen.context === '장소') {
        // 빈 장소(440~444)는 **행동·외출 횟수를 쓰지 않고** 장소 화면으로 돌아간다 (0x1c014, G-4).
        // 앞서 웹은 빈 장소에서도 행동을 썼다 — 원본과 반대였다.
        if (isEmptyPlaceEventId(screen.eventId)) {
          setCareer(viewed)
          return setScreen({ kind: '외출' })
        }
        // 장소 이벤트도 외출이다 — 행동을 쓰고 외출 횟수(칭호 "1년간 외출")에 센다
        const visited = spendCycleAction({ ...viewed, outingsThisSeason: viewed.outingsThisSeason + 1 })
        setCareer(awardTitles(visited, evaluateNewTitles(visited)))
        return setScreen({ kind: '관리' })
      }
      if (screen.context === '시즌') return continueSeason(viewed, viewedEventIds)
      setCareer(awardTitles(viewed, evaluateNewTitles(viewed)))
      if (screen.context === '외출진입') return setScreen({ kind: '외출' })
      setScreen({ kind: '관리' })
      setManagementCheck('고정')
    },

    /** 경기 중 [메뉴] → 나가기. StrGAME[0] "현재 이닝의 기록과 획득한 G포인트가 사라집니다" */
    quitGame: () => {
      progressRef.current = null
      setProgress(null)
      runner.resetAtBat()
      runner.setIsPaused(true)
      setScreen({ kind: '메인메뉴' })
    },

    finishLoading: () => {
      setLoadingTip(null)
      runner.setIsPaused(false)
    },

    /** 시즌 성적 화면 뒤 — 올해의 목표 결과(392)부터 연말 이벤트를 잇는다 */
    beginYearEnd: () => {
      if (career === null) return
      setScreen({ kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID, context: '시즌' })
    },

    /**
     * 매치업 화면(135) [확인] → 경기 준비 142 → 사람 경기.
     * `0x1c46c` 가 내 팀을 `0xb7614(L,n,0)`(= 대한민국)로 바꿔 끼우므로 팀 10 으로 친다.
     *
     * ⚠️ **웹판 임시**: 원본은 여기서 **내 선수가 낀 대표팀 명단**(P5 2절, `0xb53f1`/`0xb521d`)으로
     * 치르는데, 웹은 팀 로스터가 붙박이 표(`entities/team`)라 내 선수를 끼워 넣을 자리가 없다 —
     * 대한민국 기본 명단으로 친다.
     */
    startCupGame: (matchup: NationalCupMatchup, cup: NationalCup) => {
      if (career === null) return
      cupGameRef.current = cup
      startMatch(matchup.myTeam, career.battingOrder, matchup.opponent)
    },

    /**
     * 대회 끝 — 결과 팝업(`0x25`)과 보상 팝업(`0x26`)을 모두 닫았을 때 (`0x1b92c`).
     * 보상은 커리어에 얹고, 열린 히든 팀은 `openedHiddenIds` 에 넣는다 (웹은 이 칸 하나가
     * 전역 기록 `+0x70` 히든 팀 목록으로 흘러간다 — `App.tsx` 가 그렇게 넘긴다).
     * 그 뒤 원본대로 새 시즌 처리(`0x1b768`)다.
     *
     * 국가대항전 플래그(`S+0x12c`)는 커리어 저장에 자리가 없고 대회 레코드를 화면이 들고 있어,
     * 화면을 떠나면 그대로 없어진다 — 시즌모드의 "플래그가 안 내려가 다음 시즌이 막힌다" 는
     * 원본 버그와는 **무관하다** (그쪽 동작은 건드리지 않았다).
     */
    finishCup: (finish: NationalCupFinish) => {
      if (career === null) return
      const rewarded = applyEventRewards(career, careerNationalCupRewardItems(finish.reward), random)
      const missing = finish.openedTeams.filter((id) => !rewarded.openedHiddenIds.includes(id))
      startNewSeason({ ...rewarded, openedHiddenIds: [...rewarded.openedHiddenIds, ...missing] })
    },

    /** 부상·방출 엔딩 뒤 5000 G포인트로 이어한다 (StrMODE[221]). 모자라면 false */
    continueAfterEnding: () => {
      if (career === null || career.endingIndex === null) return false
      if (!canContinueAfterEnding(career, career.endingIndex)) return false
      const continued = continueAfterEnding(career)
      setCareer(continued)
      setScreen({ kind: '관리' })
      setManagementCheck(continued.season === career.season ? '무작위포함' : '고정')
      return true
    },

    /** 엔딩을 본 뒤 — 선수를 지우고 메인 메뉴로 (등록한 선수는 수집 기록에 남는다) */
    finishEnding: () => {
      saveGame.clear()
      setSavedCareer(null)
      setCareer(null)
      setScreen({ kind: '메인메뉴' })
    },
  }


  return {
    savedCareer,
    career,
    progress,
    shopNotice,
    outingNotice,
    managementNotice,
    managementDetail,
    loadingTip,
    storyEvents: story.events,
    eventPlaceIds: story.eventPlaceIds,
    handlePitchResolved,
    actions,
  }
}

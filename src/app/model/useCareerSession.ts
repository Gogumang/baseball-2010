import { useCallback, useEffect, useRef, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'
import { applyPlayerOutcome, startGame, summaryOf } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
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
} from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { awardTitles, evaluateNewTitles } from '@/entities/career/model/titles'
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
import { battingOrderEventId, emptyPlaceEventId } from '@/entities/career/model/battingOrder'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { applyEventRewards } from '@/entities/story/model/eventReward'
import { rollTrainingInjury } from '@/entities/career/model/condition'
import type { ManagementDetail } from '@/app/model/managementDetail'
import { evaluateGame, updateStreaks } from '@/entities/career/model/gameEvaluation'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { ManagementCommand } from '@/pages/management/ui/ManagementScreen'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { pickLoadingTip } from '@/shared/config/loadingTips'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'

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
  const [career, setCareer] = useState<PlayerCareer | null>(null)
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

  const beginGame = useCallback(() => {
    const current = careerRef.current
    const started = startGame(
      random,
      current?.teamId ?? 0,
      current?.battingOrder,
      // 상대는 일정표(정규시즌)나 지금 시리즈(포스트시즌)가 정한다 — 무작위가 아니다
      current === null || current === undefined ? undefined : nextOpponentOf(current),
    )
    progressRef.current = started
    setProgress(started)
    runner.resetAtBat()
    runner.setBannerText('')
    // 로딩 화면(StrTIP)이 끝나야 첫 투구가 시작된다.
    runner.setIsPaused(true)
    setLoadingTip(pickLoadingTip(random))
    setScreen({ kind: '경기' })
  }, [random, runner, setScreen])

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
      const streak = updateStreaks(evaluated, summary.stats)
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

  const handlePitchResolved = useCallback(
    (detail: PitchOutcomeDetail) => {
      const nextAtBat = runner.applyPitch(detail.resolution)
      if (!isAtBatFinished(nextAtBat) || nextAtBat.outcome === null) return

      const currentProgress = progressRef.current
      if (currentProgress === null) return

      const { bases } = currentProgress.game
      const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
      const advanced = applyPlayerOutcome(currentProgress, nextAtBat.outcome, random)
      progressRef.current = advanced
      setProgress(advanced)

      runner.pauseWithBanner(describeOutcomeBanner(nextAtBat.outcome, runnersOnBase), () => {
        if (!advanced.game.isFinished) {
          runner.setIsPaused(false)
          return
        }
        const currentCareer = careerRef.current
        if (currentCareer !== null) finishGame(advanced, currentCareer)
      })
    },
    [finishGame, random, runner],
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

  const continueSeason = (viewed: PlayerCareer, viewedEventIds: readonly number[]) => {
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
    const next = step.kind === '새시즌' ? startNextSeason(viewed) : viewed
    setCareer(awardTitles(next, evaluateNewTitles(next)))
    setScreen({ kind: '관리' })
    setManagementCheck(step.kind === '새시즌' ? '고정' : '무작위포함')
  }

  /** 전역 기록의 히든 오픈 id 를 선수에게 옮긴다 — 더할 것이 없으면 그대로 둔다 */
  const syncOpenedHidden = useCallback((ids: readonly number[]) => {
    setCareer((previous) => {
      if (previous === null) return previous
      const missing = ids.filter((id) => !previous.openedHiddenIds.includes(id))
      return missing.length === 0 ? previous : { ...previous, openedHiddenIds: [...previous.openedHiddenIds, ...missing] }
    })
  }, [])

  const actions = {
    syncOpenedHidden,
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

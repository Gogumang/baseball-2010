// @vitest-environment jsdom
/**
 * **나만의리그 투수편 장기 진행 점검 (soak)** — 화면 없이 `usePitcherLeagueSession` 을 새 투수 등록부터 은퇴 · 엔딩까지 돌린다.
 *
 * 앱처럼 세운다 (`App`): 투수편 세션 옆에 G 지갑(`useGamePointWallet`) · 미션 세션(`useMissionSession` — 마선수 대결) ·
 * 경기 중간 저장(+0x4f) · 대결 대기 칸 · 환경설정(`useGameSettings`)을 같은 난수로 함께 띄운다(전역 칸은 훅 밖 — 다시 세워도 남는다).
 *
 * 사람 입력은 단순한 정책으로 대신한다 (`PitcherLeagueRoute` 와 그 화면들이 부르는 액션 · 모델 함수를 그대로 부른다):
 * - 관리(105): 이번 주기에 아직 안 했으면 — 사기가 낮거나 아프거나 다쳤으면 [휴식](`runPitcherRest` → 결과 창 닫힘 `recoverAfterPitcherRest`),
 *   아니면 [트레이닝] 칸 0~3 차례(`runPitcherTraining` → 상세 창 닫힘 `rollTrainingInjury`). 했으면 [다음경기]. 화면
 *   `usePitcherManagementMenu` 의 차례 그대로다. 칭호 · 알림 팝업은 확인.
 * - 109 순위표 · 142 경기 준비는 확인. 경기(144)는 `PitcherGameScreen`/`usePitcherGame` 대신 로딩 팁 굴림 → `startPitcherGame` →
 *   사람 차례마다 구질 칸을 차례로 · 게이지 칸을 돌려 던지고(`startPitch` 붙듦), 수비 판 · 주자 판은 키 없이 끝까지 돌려 푼다
 *   (`runDefensePlay` · `runLiveRunnerPlayWithoutKeys` — 화면이 결과를 못 넘긴 갈래와 같다), 벤치 클리어링은 목표 틱까지 본 것으로,
 *   감독 창 · 돌발 창 · 0xe 확인은 닫는다.
 * - **이벤트(114)와 마선수 대결은 앱의 그 화면을 그대로 띄워 키로 친다 (r245)** — `PitcherLeagueRoute` 가 이벤트를 `StoryScreen` 으로
 *   (보상 명령마다 `giveStoryReward` — 알림 글 굴림 `rewardNoticeContextOf` 까지 앱 차례), 마선수 대결을 `PitcherAceMatchRoute` →
 *   `PitchingScreen` 으로 띄우고, 그림 틀을 한 틱씩 돌리며 사람처럼 누른다: 구질 칸 키(정책 난수로 고른 칸) → 조준(`AimCursor` —
 *   틱마다 `aimTick` 흔들림 굴림) 몇 틱 뒤 OK → 게이지 OK, 0xe · 판 · 결과 판(정산 효과 굴림) · 대사창은 몇 틱 뒤 OK.
 *   선택지는 첫 칸(기본 커서)이다.
 * - 포스트시즌 · 국가대항전(`NationalCupScreen` 판정) · 연차표지 · 엔딩도 그 화면의 길대로.
 *
 * 걸음마다 불가능한 값, 리그 전적 합 · 순위, 내 투수 기록(경기 요약 → 시즌 · 통산 누계), 날짜(일정표) · 로테이션, 저장 왕복,
 * **G 전체 장부**(처음 G + 기록연감 G획득 · G사용 · GP 아이템 − 명전 등록 = 지갑, r245), MVP 사슬(375 · 376/377 이 같은 시즌 · 같은
 * 포스트시즌 자리에서 두 번 끝나면 문제 — r243 의 타자편 검사와 같다)을 본다.
 *
 * **새 길 정책(`extras`, r235 · r245)** — 정책이 안 밟던 길을 밟는다:
 * - 관리: 마구 훈련(108 창 0x17828 가드 → 125 → `runPitcherTraining` 칸 4, 레벨이 오르면 +0x18 이 저절로 선다), 구질 훈련(108 탭 2 —
 *   가드 `pitchTrainingGateOf` 를 지나는 칸 → 125 → `runPitchTypeTraining` 0x1836a, r245), 상점(111 장비 · 서브 · GP — 복권
 *   또또상품권 포함 · 121 장비착용, `selectPitcherShopItem` 그대로), 외출(112 지도 → [!] 장소면 [들어가기] 0x8ce58, 아니면 장소 기능
 *   0x16cf0 → 126 효과 0x15234).
 * - 마선수 대결: 장소 이벤트의 match(SYS 8) → 위 화면 그대로.
 * - 마구 투구: 사람 차례마다 가끔 마구 칸(22)을 던진다(남은 횟수가 있을 때만 — 0 이면 `startPitch` 가 안 받는다).
 * - 이어하기: 관리 · 경기(142 확인 뒤 +0x4f) · 116 · 이벤트 앞에서 훅을 내리고 같은 저장소로 새로 세워(메인 메뉴 → 투수편 진입)
 *   이어 간다. +0x4f 가 서 있으면 [14] 의 곧장 경기(`resumeInterruptedGame`).
 * - 엔딩: 보너스 → 이어할 수 있는 엔딩(부상 0 · 방출 1)이면 5000 G 로 이어하고(r245 — 한 번, `continueEndings` 면 늘) →
 *   명예의 전당 등록(`registerHallOfFamePitcher` · G − 20000 · `eraseSaveForHallOfFame`) → `finishEnding(true)`.
 * 걸음마다 G · 소지금 수지(각 구매 · 외출 · 복권 · 마구 · 구질 훈련 앞뒤 차이), 장비 니블 · 보유 · 장비 능력치 합, 마구 남은 횟수,
 * 명전 기록, 이어하기 앞뒤 커리어를 더 본다.
 *
 * **화면 경기(`gameScreen`, r245)** — 나만의리그 경기(144)도 `PitcherLeagueRoute` → `PitcherGameScreen` 을 띄워 대결과 같은 손가락으로
 * 던진다(조준 흔들림 · 파티클 · 결과 판 정산 효과 굴림까지 앱 차례). 긴 판은 켜고(`SOAK_GAME_SCREEN=0` 이면 끈다), 짧은 판은 한 판만
 * 켜고 나머지는 진행기를 바로 돌린다(`playPitcherGameHeadless` — 빠르지만 그 굴림이 빠진다).
 *
 * ⚠️ 앱과 다른 것(남김): 관리 · 외출 · 상점 · 포스트시즌 · 국가대항전 · 엔딩은 화면 없이 그 화면이 부르는 액션 · 모델 함수를 부른다.
 *
 * 기본은 짧은 판(몇 경기)만 — 긴 판은 `SOAK=1`:
 * `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/pitcherLeagueSoak.test.tsx --maxWorkers=2`
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { PitcherLeagueRoute } from '@/app/ui/PitcherLeagueRoute'
import { PitcherAceMatchRoute } from '@/app/ui/MissionRoutes'
import { useGameSettings } from '@/app/model/useGameSettings'
import type { PitcherLeagueSession, PitcherScene } from '@/app/model/usePitcherLeagueSession'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { useMissionSession } from '@/app/model/useMissionSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { modePitcherOf } from '@/app/model/modePitcher'
import type { Screen } from '@/app/model/screen'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import { createMemoryAceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { NariGameMatch, NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  MAXIMUM_ABILITY, enterPitcherGameEvaluation, equippedPitcherAbilityOf, isPitcherSkillEquipped, pitcherAbilityLimitsOf,
  pitcherRecordLineOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { magicTrainingCellBlockOf, magicTrainingCellCostOf } from '@/entities/pitcher-career/model/pitcherManagement'
import { PITCHER_EQUIPMENT_PARTS, pitcherEquipmentItemOf, ownsPitcherEquipment } from '@/entities/pitcher-career/model/pitcherEquipment'
import { PITCHER_GP_ITEMS, PITCHER_SUB_ITEMS } from '@/entities/pitcher-career/model/pitcherItems'
import { pitcherEquipmentBlockNoticeOf, pitcherItemBlockNoticeOf } from '@/features/shop/model/pitcherShopSelection'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { outingBlockReasonOf } from '@/entities/career/model/outing'
import { applyOutingSubItems } from '@/entities/career/model/subItems'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { EMPTY_COLLECTION, HALL_OF_FAME_COST, registerHallOfFamePitcher } from '@/entities/collection/model/collection'
import type { Collection } from '@/entities/collection/model/collection'
import {
  PITCH_TRAINING_ROW_COUNT, HIDDEN_PITCH_COLUMN, pitchTrainingCountOf, pitchTrainingGateOf, pitchTrainingProgressCellOf,
} from '@/entities/pitcher-career/model/pitchTraining'
import { runPitchTypeTraining } from '@/entities/pitcher-career/model/pitcherManagement'
import {
  PITCHER_CONTINUE_COST_GAME_POINT, isContinuablePitcherEnding, pitcherEndingBonusOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { GAME_POINT_LIMIT } from '@/entities/wallet/model/gamePointWallet'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { resetSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'
import { resetSceneBallPath } from '@/widgets/batting-stage/model/sceneBallPath'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_TRAINING_MENUS, pitcherTrainingBlockReasonOf, runPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement'
import { pitcherRestBlockReasonOf, recoverAfterPitcherRest, runPitcherRest } from '@/pages/pitcher-league/model/pitcherRest'
import { rollTrainingInjury } from '@/entities/career/model/condition'
import {
  closeBurstWindow, closeManagerHookWindow, confirmScene, isPitchTurn, pitchSlotsFor, resolveBenchClearing, resolveDefensePlay,
  recordDrawnPitcherFieldingErrors, resolveRunnerPlay, startPitch, startPitcherGame, startsToday, summaryOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { drawnReplayFieldingErrorsOf } from '@/features/defense-play/model/fieldingErrors'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { opponentOf, rankingOf } from '@/entities/league/model/league'
import { confirmNationalCupStandings, finishNationalCup } from '@/entities/national-cup/model/nationalCupFlow'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { forgetRepeatableEvents } from '@/entities/story/model/storyScene'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import {
  SoakProblems, batterLineProblemsOf, firstDiffOf, isSoakEnabled, jsonRoundTripDiffOf, leagueTallyProblemsOf, outOfRangeOf,
  rankingOrderProblemsOf, soakNumber, soakSeeds, unserializablePathsOf,
} from '@/app/model/soak/soakInvariants'

// 그림 붓 — 타석 · 결과 그림은 아무 일도 안 한다(굴림 · 상태는 그대로 돈다)
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return { ...actual, renderBattingStage: () => {}, renderSettlementLayer: () => {} }
})
// 파티클 설정 — 앱은 첫 그림 무렵 받아 둔다. 받은 꼴 그대로 싣는다(없으면 파티클이 안 나 그 틱 굴림이 빠진다)
vi.mock('@/widgets/particles/lib/particleCatalog', async () => {
  const { readFileSync } = await import('node:fs')
  const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
    emitters: { callId: number; callable: boolean }[]
  }
  return {
    particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
  }
})
// 로딩 판 — 그리자마자 끝낸다(팁은 세션이 굴렸고 판 자체는 굴림이 없다. 그림 적재를 기다리면 jsdom 에선 안 끝난다)
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/loading-tip/ui/LoadingTip')>()
  const { useEffect } = await import('react')
  return {
    ...actual,
    LoadingTip: ({ onDone }: { readonly onDone: () => void }) => {
      useEffect(() => {
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    },
  }
})

setActiveSound(createSilentSound())

/** MVP 발표 375 · 결과 376/377 (0x8b370) */
const MVP_EVENT_IDS = [375, 376, 377]

/* ── 그림 틀 — 앱처럼 requestAnimationFrame · performance.now · setTimeout 을 한 틀씩 돌린다 ─────────────── */

let frameCallbacks = new Map<number, FrameRequestCallback>()
let nextFrameHandle = 1
let clock = 1_000
let originals: { now: () => number; raf: typeof window.requestAnimationFrame; caf: typeof window.cancelAnimationFrame } | null = null

function resetStageStores() {
  resetSceneParticlesForTest()
  resetSceneResultCode()
  resetCommonWindowShownForTest()
  resetSceneCloudClock()
  resetSceneBallPath()
  resetSceneStateEntries()
}

/** 한 틀 — 시계를 틀 길이만큼 · 미룬 일 · 그림 콜백 */
function frame() {
  act(() => {
    clock += millisecondsPerFrame()
    vi.advanceTimersByTime(millisecondsPerFrame())
    const pending = [...frameCallbacks.values()]
    frameCallbacks = new Map()
    for (const callback of pending) callback(clock)
  })
}

function pressKey(key: string) {
  fireEvent.keyDown(window, { key })
  fireEvent.keyUp(window, { key })
}

/**
 * 조건이 설 때까지 기다린다 — `waitFor` 는 가짜 setTimeout 위에서 안 돈다. 이벤트 본문(동적 import)은 진짜 시간이 걸리므로
 * 가짜로 만들지 않은 setImmediate 로 한 바퀴씩 쉰다
 */
async function waitUntil(condition: () => boolean, label: string): Promise<void> {
  for (let turn = 0; turn < 20_000; turn += 1) {
    if (condition()) return
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve))
    })
  }
  throw new Error(`기다림이 안 끝났다: ${label}`)
}

/** 화면에 그 누름 칸이 섰나 — 사람이 보는 단계(구질 · 조준 · 게이지 · 0xe 확인) */
const isShown = (testId: string) => document.querySelector(`[data-testid="${testId}"]`) !== null

/** 정책 난수 — 세션 난수와 따로 굴린다(사람 손가락 자리) */
function policyRandom(seed: number) {
  let state = (seed * 2654435761 + 0x9e37) >>> 0
  return () => {
    state = (state * 1103515245 + 12345) >>> 0
    return state / 0x100000000
  }
}

/** 구질 칸 0~4 키 · 마구 칸 5 키 (`pitchSlotOfKey` 의 거꾸로 — '5' · '2' · '4' · '6' · '8' · '0') */
const PITCH_SLOT_KEYS = ['5', '2', '4', '6', '8', '0'] as const

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

/** 헤드리스 경기 한 판의 결과 — 마구는 이 판에서 던진 수 · 남은 횟수가 범위를 벗어난 적이 있는지도 든다 */
interface HeadlessPitcherGame {
  readonly summary: PitcherGameSummary
  readonly pitches: number
  readonly magicThrown: number
  readonly magicCount: number
  readonly magicRemaining: number
  readonly magicProblems: readonly string[]
  /** 정산 실책 ≠ 그린 실책 합 (r248) */
  readonly errorProblems: readonly string[]
}

/**
 * 경기 한 판 — `usePitcherGame` + `PitcherGameScreen` 대신. 사람 차례마다 구질 칸을 차례로 던진다.
 * `magicEvery` 를 주면 그 공마다(남은 횟수가 있을 때만) 마구 칸(22)을 던진다 — 화면도 남은 횟수 0 이면 마구 칸을 못 고른다.
 */
function playPitcherGameHeadless(options: PitcherGameOptions, random: RandomPort, magicEvery = 0): HeadlessPitcherGame {
  // 상태 7 진입 0x39f88 → 0x53dbc 의 로딩 팁 rand(0, 73) — `usePitcherGame` 의 첫 useState
  rollSceneLoadingTip(random)
  let progress = startPitcherGame(options, random)
  let pitches = 0
  let magicThrown = 0
  const magicProblems: string[] = []
  /**
   * 재생 화면(`PitcherGameScreen` 재생 갈래) 대신 — 재생 칸에 새로 든 판을 다 그린 실책(0x43278 +0x2e)을 얹는다. 경기를 끝낸 재생 판도
   * 정산 앞에 그린다(`useShownReplay`, r248). 타구 · 주자 판은 화면 없이 돌아 실책을 안 그린다
   */
  let drawnPlay: DefensePlayResult | null = null
  const drawnErrors: unknown[] = []
  const drawReplay = () => {
    const play = progress.lastDefensePlay
    if (play === drawnPlay) return
    drawnPlay = play
    if (play === null || play.ticks.length === 0) return
    const before = progress.leagueErrors?.length ?? 0
    progress = recordDrawnPitcherFieldingErrors(progress, drawnReplayFieldingErrorsOf(play.ticks))
    drawnErrors.push(...(progress.leagueErrors ?? []).slice(before))
  }
  const done = (): HeadlessPitcherGame => {
    const summary = summaryOf(progress)
    // 정산 실책 = 그린 실책 합
    const settled = JSON.stringify(summary.leagueErrors)
    const errorProblems = settled === JSON.stringify(drawnErrors) ? [] : [`정산 실책 ${settled} ≠ 그린 실책 ${JSON.stringify(drawnErrors)}`]
    return {
      summary, pitches, magicThrown, magicCount: options.magicCount, magicRemaining: progress.magicRemaining, magicProblems, errorProblems,
    }
  }
  for (let step = 0; step < 20_000; step += 1) {
    drawReplay()
    if (progress.magicRemaining < 0 || progress.magicRemaining > options.magicCount) {
      magicProblems.push(`마구 남은 횟수 ${progress.magicRemaining} 가 0..${options.magicCount} 밖`)
    }
    if (progress.game.isFinished) return done()
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
    const magicSlot = pitchSlotsFor(progress).find((slot) => slot.isMagic && slot.typeNumber === MAGIC_PITCH_TYPE_NUMBER)
    if (magicEvery > 0 && magicSlot !== undefined && progress.magicRemaining > 0 && pitches % magicEvery === magicEvery - 1) {
      const before = progress.magicRemaining
      progress = startPitch(progress, { typeNumber: MAGIC_PITCH_TYPE_NUMBER, gaugeCell: (pitches * 3) % 10 }, random, true)
      // 마구 한 개 = 남은 횟수 −1 (0x34894 소모 — `startPitch` 의 magicRemaining)
      if (progress.magicRemaining !== before - 1) magicProblems.push(`마구를 던졌는데 남은 횟수 ${before} → ${progress.magicRemaining}`)
      magicThrown += 1
      pitches += 1
      continue
    }
    const slots = pitchSlotsFor(progress).filter((slot) => slot.typeNumber > 0 && !slot.isMagic)
    const slot = slots[pitches % Math.max(1, slots.length)]
    const before = progress.magicRemaining
    progress = startPitch(progress, { typeNumber: slot?.typeNumber ?? 1, gaugeCell: (pitches * 3) % 10 }, random, true)
    if (progress.magicRemaining !== before) magicProblems.push(`보통 공에 마구 남은 횟수가 ${before} → ${progress.magicRemaining}`)
    pitches += 1
  }
  throw new Error('경기가 2만 걸음 안에 안 끝났다')
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
  /** 새 길 정책(r235) — 머리말 "새 길 정책" */
  readonly extras?: boolean
  /** 새 길: 이만큼 관리 화면을 지날 때마다 다음 이어하기 지점(관리 → 경기 → 116 → 이벤트 차례)에서 끊고 이어 간다. 0 이면 안 끊는다 */
  readonly resumeEvery?: number
  /**
   * 새 길: 처음 커리어를 이 값으로 고쳐 시작한다(원본에 있는 꼴 — 그 연차 첫날 · 범위 안 인기도 · 소지금). 짧은 판이 마구(인기도 100~) ·
   * 장비 · 장소 대결 이벤트(연차 4~)를 몇 초 안에 밟게 한다
   */
  readonly startPatch?: {
    readonly season?: number; readonly popularity?: number; readonly money?: number; readonly seenEventIds?: readonly string[]
    /** 부상 경기 수 · 부상 — 20 이면 다음 105 진입이 부상 엔딩(0xa3a84 첫 줄)이다 */
    readonly injuredGamesPlayed?: number; readonly isInjured?: boolean; readonly injuryRemaining?: number
  }
  /** 이어할 수 있는 엔딩을 만날 때마다 5000 G 로 이어한다 — 없으면 새 길에서 한 번만 */
  readonly continueEndings?: boolean
  /** 이만큼 엔딩을 이어하고 관리 화면에 서면 멈춘다 */
  readonly stopAfterContinues?: number
  /**
   * 나만의리그 경기(144)도 앱 화면(`PitcherGameScreen`)을 띄워 키로 던진다 (r245) — 조준 흔들림 · 파티클 · 결과 판 정산 효과 굴림까지
   * 앱 차례다. 거짓이면 진행기를 바로 돌린다(`playPitcherGameHeadless` — 빠르지만 그 굴림이 빠진다)
   */
  readonly gameScreen?: boolean
  /** 새 길: 몇 번째 관리 주기마다 외출하나 (기본 3) */
  readonly outingEvery?: number
  /** 새 길: 지갑 처음 G (기본 60000) */
  readonly startGamePoint?: number
}

interface PitcherSoakResult {
  readonly problems: SoakProblems
  readonly steps: number
  readonly games: { 리그: number; 포스트시즌: number; 대회: number; 등판: number; 대결: number }
  readonly seasons: number
  readonly endingIndex: number | null
  readonly stoppedAt: string | null
  readonly yearLog: readonly string[]
  /** 새 길을 실제로 밟은 횟수 */
  readonly paths: PathCounts
  /** G 장부 — 출처별 합 */
  readonly ledger: Readonly<Record<string, number>>
  /** 돌린 그림 틀 수 */
  readonly frames: number
}

interface PathCounts {
  외출기능: number
  장소: number
  대결: number
  대결이김: number
  장비: number
  착용: number
  서브: number
  GP: number
  복권: number
  마구훈련: number
  구질훈련: number
  마구공: number
  엔딩이어하기: number
  보상명령: number
  이어하기: Record<string, number>
  명전: number
}

const emptyPaths = (): PathCounts => ({
  외출기능: 0, 장소: 0, 대결: 0, 대결이김: 0, 장비: 0, 착용: 0, 서브: 0, GP: 0, 복권: 0, 마구훈련: 0, 구질훈련: 0, 마구공: 0, 엔딩이어하기: 0,
  보상명령: 0, 이어하기: {}, 명전: 0,
})

type Rendered = { readonly current: PitcherLeagueSession }

/** 하네스 훅 한 벌 — 세션과 앱이 같이 세우는 지갑 · 미션 세션 · 환경설정 */
interface HarnessHooks {
  readonly session: PitcherLeagueSession
  readonly wallet: GamePointWalletSession
  readonly mission: ReturnType<typeof useMissionSession>
  readonly runner: ReturnType<typeof useAtBatRunner>
  readonly gameSettings: ReturnType<typeof useGameSettings>
}

/** 메모리 경기 중간 저장 칸(+0x4f) — 앱 `modeSave` 의 투수편 칸 대신. 훅을 다시 세워도 남는다 */
function memoryNariGameSave(): NariGameSavePort & { readonly held: () => { inProgress: boolean; match: NariGameMatch | null } } {
  let inProgress = false
  let match: NariGameMatch | null = null
  return {
    start: (next) => {
      inProgress = true
      match = next
    },
    clear: () => {
      inProgress = false
    },
    held: () => ({ inProgress, match }),
  }
}

/** 앱이 투수편을 띄울 때의 화면 — 미션 세션은 대결을 투수편 라우트 안에서 그린다(화면을 안 바꾼다) */
const PITCHER_EDITION_SCREEN: Screen = { kind: '투수편' }
const NO_SET_SCREEN = () => {}
/** 앱의 화면을 띄워 그림 틀 · 키로 치는 장면 */
const FRAME_SCENES: ReadonlySet<PitcherScene> = new Set<PitcherScene>(['이벤트', '마선수대결'])
/** 겉보기가 그대로면 OK 를 누르기까지 · 멈춤으로 보는 틀 */
const STUCK_FRAMES = 6_000

async function runPitcherSoak(options: PitcherSoakOptions): Promise<PitcherSoakResult> {
  const {
    seed, role, teamId, maxGames, roundTripEvery = 5, boostAbility = false, extras = false, resumeEvery = 0, continueEndings = false,
    stopAfterContinues, gameScreen = false,
  } = options
  const frameScenes: ReadonlySet<PitcherScene> = gameScreen ? new Set<PitcherScene>([...FRAME_SCENES, '경기']) : FRAME_SCENES
  const store = memoryStore()
  const random = createSeededRandom(seed)
  // 새 길 — 앱(App.tsx)처럼 전역 칸(지갑 · +0x4f · 대결 대기 · 미션 기록)을 세션 밖에 두어 훅을 다시 세워도 남게 한다
  const walletStore = memoryStore()
  walletStore.save({ gamePoint: options.startGamePoint ?? 60_000 })
  const nariGameSave = memoryNariGameSave()
  const aceMatchPending = createMemoryAceMatchPendingPort()
  let missionCounts: Readonly<Record<string, number>> = {}
  const missionRecord = { load: () => missionCounts, save: (counts: Readonly<Record<string, number>>) => { missionCounts = counts } }
  /** 장면 0x106 이 서 있나 — 다시 세울 때는 메인 메뉴(거짓)로 띄우고 투수편으로 들어선다(참) */
  const onScreen = { value: true }
  const settingsStore = memoryStore()
  const policy = policyRandom(seed)

  /* ── G 전체 장부 — 처음 G + 기록연감 G획득 − G사용 − GP 아이템 − 명전 등록 (한 줄마다 0..99999 로 자른다) ── */
  const ledgerSums: Record<string, number> = {}
  const ledger = {
    balance: null as number | null,
    add(source: string, delta: number) {
      ledgerSums[source] = (ledgerSums[source] ?? 0) + delta
      if (ledger.balance !== null) ledger.balance = Math.min(GAME_POINT_LIMIT, Math.max(0, ledger.balance + delta))
    },
  }
  const recordStat = (event: AnnalsStatEvent) => {
    if (event.kind === 'G획득') ledger.add('G획득', event.amount)
    else if (event.kind === 'G사용') ledger.add('G사용', -event.amount)
    else if (event.kind === 'GP아이템구매') ledger.add('GP아이템', -event.price)
  }
  /** 이벤트 재생 끝 — 본 이벤트를 MVP 검사에 넘긴다 */
  const storyDoneRef: { current: (viewed: readonly number[]) => void } = { current: () => {} }
  /** 마선수 대결 끝 — 이겼나 */
  const aceMatchDoneRef: { current: (isWin: boolean) => void } = { current: () => {} }

  /** 화면에 넘기는 세션 — 액션을 감싸 보상 명령 · 재생 끝 · 대결 끝을 센다(부르는 길은 그대로) */
  const observedSession = (session: PitcherLeagueSession): PitcherLeagueSession => ({
    ...session,
    actions: {
      ...session.actions,
      giveStoryReward: (...args: Parameters<PitcherLeagueSession['actions']['giveStoryReward']>) => {
        paths.보상명령 += 1
        return session.actions.giveStoryReward(...args)
      },
      completeStory: (...args: Parameters<PitcherLeagueSession['actions']['completeStory']>) => {
        storyDoneRef.current(args[1])
        return session.actions.completeStory(...args)
      },
      finishAceMatch: (isWin: boolean) => {
        aceMatchDoneRef.current(isWin)
        return session.actions.finishAceMatch(isWin)
      },
      finishGame: (summary: PitcherGameSummary) => {
        const start = gameStart.current
        gameStart.current = null
        if (start !== null) finishedGame.current = { ...start, summary }
        return session.actions.finishGame(summary)
      },
    },
  })
  /** 화면 경기(`gameScreen`) — 경기를 세운 때의 커리어 · 옵션, 끝난 요약 */
  const gameStart: { current: { readonly before: PitcherCareer; readonly options: PitcherGameOptions; readonly isCup: boolean } | null } = { current: null }
  const finishedGame: { current: Parameters<typeof checkFinishedGame>[0] | null } = { current: null }

  const holder: { current: HarnessHooks | null } = { current: null }
  /** 앱(App.tsx)처럼 — 전역 칸(지갑 · +0x4f · 대결 대기 · 미션 기록)은 훅 밖에 두어 다시 세워도 남게 한다 */
  function Harness(): ReactNode {
    const wallet = useGamePointWallet(walletStore)
    const runner = useAtBatRunner()
    const gameSettings = useGameSettings(settingsStore)
    const session = usePitcherLeagueSession(
      store, random, gameSettings.settings.pitchControl === '게이지', wallet, null, gameSettings.settings.throwMode === '수동', recordStat,
      undefined, undefined, undefined, nariGameSave, aceMatchPending, onScreen.value,
    )
    // App 353 — 미션 세션의 투수는 투수편 커리어(`modePitcherOf`)
    const pitcher = useMemo(() => modePitcherOf(session.career), [session.career])
    const mission = useMissionSession({
      runner, random, missionRecord, screen: PITCHER_EDITION_SCREEN, setScreen: NO_SET_SCREEN, pitcher, recordStat,
      throwModeManual: gameSettings.settings.throwMode === '수동',
      runningModeManual: gameSettings.settings.runningMode === '수동',
      isVibrationOn: gameSettings.settings.isVibrationOn,
      ...(session.career === null ? {} : { nariTeamIds: { pitcher: session.career.teamId } }),
      aceMatchHold: undefined,
    })
    holder.current = { session, wallet, mission, runner, gameSettings }
    if (!frameScenes.has(session.scene) || session.career === null) return null
    return (
      <PitcherLeagueRoute
        session={observedSession(session)}
        random={random}
        gameSettings={gameSettings}
        onExit={() => {}}
        renderAceMatch={(match, onFinish) => (
          <PitcherAceMatchRoute
            mission={match.mission}
            session={mission}
            runner={runner}
            pitchControl={gameSettings.settings.pitchControl}
            gameSettings={gameSettings}
            onFinish={onFinish}
            onQuit={session.actions.quitAceMatch}
            pitcherName={session.career?.name ?? null}
          />
        )}
      />
    )
  }
  const mount = () => render(<Harness />)
  let rendered = mount()
  const result: Rendered = { get current() { return holder.current!.session } }
  const hooks = () => holder.current!
  ledger.balance = hooks().wallet.balance
  const problems = new SoakProblems()
  const games = { 리그: 0, 포스트시즌: 0, 대회: 0, 등판: 0, 대결: 0 }
  const paths = emptyPaths()
  const yearLog: string[] = []
  let steps = 0
  let trainingSlot = 0
  let managementVisits = 0
  let frames = 0
  let continuedAfterEnding = 0
  let stoppedAt: string | null = null
  let endingIndex: number | null = null
  let cupEntrySerial: object | null = null
  /** 명전 등록으로 저장을 지운 뒤 — 지갑 다리가 저장 없이 G 만 옮긴다(`eraseSaveForHallOfFame` 머리말) */
  let isEndingErased = false
  let lastSeason = 0
  let collection: Collection = EMPTY_COLLECTION

  const where = () => {
    const career = result.current.career
    return `씨앗 ${seed} · ${career === null ? '-' : `${career.season}년차 g${career.gamesPlayed}${career.postseason !== null ? '(PS)' : ''}`}`
      + ` · ${result.current.scene} · 걸음 ${steps}`
  }

  /**
   * 끝낸 MVP 발표(375) · 결과(376/377) 장면 수 — (시즌 · 포스트시즌 자리)마다. 원본은 정규시즌 끝에 한 번, 그리고 내 시리즈가 끝난
   * 경기마다 116 끝(0x12b74)이 사슬을 다시 돌아 375 → 376/377 이 또 나온다(r243 — 투수편도 같은 0x12b74 · 0x19774). 그래서 한 해
   * 여러 번은 원본이고 **같은 자리에서 두 번**만 문제다
   */
  const mvpScenes = new Map<string, number>()
  storyDoneRef.current = (viewedIds) => {
    const career = result.current.career
    for (const id of viewedIds.filter((viewedId) => MVP_EVENT_IDS.includes(viewedId))) {
      const series = career?.postseason
      const spot = series === null || series === undefined ? '정규' : `${series.round}:${series.teams.join(',')}:${series.wins.join(',')}`
      const mvpKey = `${career?.season}:${spot}:${id}`
      const count = (mvpScenes.get(mvpKey) ?? 0) + 1
      mvpScenes.set(mvpKey, count)
      if (count > 1) problems.add(where(), [`${career?.season}년차 ${spot} 자리에서 MVP 이벤트 ${id} 를 ${count}번째 끝냈다`])
      if (id === 375 && process.env.SOAK_DEBUG === '1') yearLog.push(`${career?.season}년차 MVP 발표(${spot})`)
    }
  }
  aceMatchDoneRef.current = (isWin) => {
    paths.대결 += 1
    games.대결 += 1
    if (isWin) paths.대결이김 += 1
  }

  /** G 장부 = 지갑 — 어긋나면 그 걸음을 적고 장부를 지갑에 맞춘다(같은 어긋남이 걸음마다 쌓이지 않게) */
  const checkLedger = () => {
    const balance = hooks().wallet.balance
    if (ledger.balance !== null && ledger.balance !== balance) {
      problems.add(where(), [`G 장부 ${ledger.balance} ≠ 지갑 ${balance} (차이 ${balance - ledger.balance})`])
      ledger.balance = balance
    }
  }

  let lastCheckedCareer: PitcherCareer | null = null
  const checkCareer = () => {
    checkLedger()
    const career = result.current.career
    if (career === null || career === lastCheckedCareer) return
    lastCheckedCareer = career
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
    if (extras) checkExtras(career, at)
  }

  /**
   * 새 길 검사 — 장비 니블(레벨 + 1, 0 은 맨몸)이 가진 장비를 가리키는지 · 보유 · 서브 아이템이 겹치지 않는지, 장비 능력치 합 0xb6414
   * (스킬 5 · 7 · 22 를 안 끼었으면 칸마다 min(999, 능력치 + 0xd8890[니블 − 1])), 마구 레벨 0..4, 지갑 G = 커리어 G
   */
  function checkExtras(career: PitcherCareer, at: string) {
    for (const part of PITCHER_EQUIPMENT_PARTS) {
      const nibble = career.equipmentLevels[part.ability]
      problems.add(at, outOfRangeOf('equipmentLevels', { [part.ability]: nibble }, 0, 11))
      if (nibble > 0 && !ownsPitcherEquipment(career, part.index, nibble - 1)) {
        problems.add(at, [`${part.name} 니블 ${nibble} 인데 그 장비(레벨 ${nibble - 1})가 보유에 없다`])
      }
    }
    if (new Set(career.ownedEquipment).size !== career.ownedEquipment.length) problems.add(at, [`보유 장비가 겹친다 ${career.ownedEquipment.join(',')}`])
    if (new Set(career.subItemIds).size !== career.subItemIds.length) problems.add(at, [`서브 아이템이 겹친다 ${career.subItemIds.join(',')}`])
    problems.add(at, abilitySumProblemsOf(career))
    problems.add(at, outOfRangeOf('career(마구)', { magicLevel: career.magicLevel }, 0, 4))
    problems.add(at, outOfRangeOf('career(복권)', { lotteryPurchases: career.lotteryPurchases }, 0, 200))
    const wallet = hooks().wallet
    if (!isEndingErased && wallet.balance !== career.gamePoint) {
      problems.add(at, [`지갑 G ${wallet.balance} ≠ 커리어 G ${career.gamePoint}`])
    }
  }

  /** 장비 능력치 합 0xb6414 — 스킬 5(−100) · 7(+50) · 22(제구 +1/10)를 안 끼었을 때만 단순 합으로 본다 */
  function abilitySumProblemsOf(career: PitcherCareer): string[] {
    if ([5, 7, 22].some((skillId) => isPitcherSkillEquipped(career, skillId))) return []
    const equipped = equippedPitcherAbilityOf(career)
    return PITCHER_EQUIPMENT_PARTS.flatMap((part) => {
      const expected = Math.min(MAXIMUM_ABILITY, career.ability[part.ability] + equipmentBonusOf(career.equipmentLevels[part.ability]))
      return equipped[part.ability] === expected ? [] : [`장비 능력치 ${part.ability} ${equipped[part.ability]} ≠ 능력치 + 장비 ${expected}`]
    })
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
      // 명전 등록이 지운 저장(이름 없는 덩어리, 0x224ec) — 다시 띄우면 선수가 없어 등록(104)이다. 이벤트 본문은 커리어가 서야 오므로 기다리지 않는다
      if ((held as { name?: unknown }).name === undefined) {
        if (reloaded.result.current.career !== null) problems.add(at, ['지운 저장으로 다시 띄웠는데 커리어가 있다'])
        return
      }
      // 다시 선 장면의 셋업(0xf684 → 0xacf60 반복 이벤트 본 표시 지움)은 r_event 본문이 온 뒤에 돈다 — 그때까지 기다린다
      await waitUntil(() => reloaded.result.current.storyEvents !== null, '다시 띄운 이벤트 본문')
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
    let played: ReturnType<typeof playPitcherGameHeadless>
    try {
      played = playPitcherGameHeadless(options, random, extras ? 5 : 0)
    } catch (error) {
      problems.add(where(), [`경기 진행 예외: ${(error as Error).message}`])
      return false
    }
    const { summary } = played
    if (extras) {
      problems.add(where(), played.magicProblems)
      problems.add(where(), played.errorProblems)
      paths.마구공 += played.magicThrown
      // 남은 횟수 = 경기 처음 횟수 − 던진 마구 (사람 차례에서만 깎는다)
      if (played.magicCount - played.magicRemaining !== played.magicThrown) {
        problems.add(where(), [`마구 ${played.magicThrown}개를 던졌는데 횟수 ${played.magicCount} → ${played.magicRemaining}`])
      }
      // 고른 마구가 없으면 횟수 0 (+0x18 == 0 — 0xb6d6a 칸 5 가 빈다). 국가대항전은 대표팀 칸이라 뺀다
      if (!isCup && before.selectedMagicNumber === 0 && played.magicCount !== 0) problems.add(where(), [`고른 마구가 없는데 횟수 ${played.magicCount}`])
      // 경기에 실린 체력 칸(용량 X 바탕 0xb6415(P, 3, 1))이 장비 니블을 탄 값인가
      if (![5, 7, 22].some((skillId) => isPitcherSkillEquipped(before, skillId))) {
        const expected = Math.min(MAXIMUM_ABILITY, before.ability.stamina + equipmentBonusOf(before.equipmentLevels.stamina))
        if (!isCup && options.staminaAbility !== expected) problems.add(where(), [`경기 체력 칸 ${options.staminaAbility} ≠ 능력치 + 장비 ${expected}`])
      }
    }
    act(() => result.current.actions.finishGame(summary))
    checkFinishedGame({ before, options, summary, isCup })
    return true
  }

  /** 경기 요약 검사 — 끝난 경기의 요약 · 그 앞 커리어 · 지금(정산 뒤) 커리어 */
  const checkFinishedGame = ({ before, options, summary, isCup }: {
    readonly before: PitcherCareer; readonly options: PitcherGameOptions; readonly summary: PitcherGameSummary; readonly isCup: boolean
  }) => {
    const isPostseason = before.postseason !== null && !isCup
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
  }

  /* ── 새 길 정책 ─────────────────────────────────────────────────────────── */

  const walletBalance = () => hooks().wallet.balance
  /** G · 소지금 앞뒤 차이를 본다 — 기대 값과 다르면 문제 줄 */
  const expectDelta = (label: string, name: string, before: number, after: number, expected: number) => {
    if (after - before !== expected) problems.add(where(), [`${label}: ${name} ${before} → ${after} (차이 ${after - before} ≠ ${expected})`])
  }
  /** 상점 한 칸 — 111/121 을 열고 그 칸을 산다(확인을 마친 뒤 `purchase`). GP 상세 창이 뜨면 닫는다 */
  const buy = (tab: PitcherShopTab, itemId: string) => {
    if (result.current.scene !== '상점' || result.current.shopTab !== tab) act(() => result.current.actions.openShop(tab))
    act(() => result.current.actions.purchase(itemId))
    if (result.current.shopGpDetail !== null) act(() => result.current.actions.closeShopGpDetail())
  }
  /** 복권 상금 표 0xd80a7 × 100 (만원) — 1~6등 */
  const LOTTERY_MONEY = [10_000, 5_000, 2_000, 1_000, 500, 200]
  /** 명전 등록 G 를 남겨 둔다 */
  const G_RESERVE = HALL_OF_FAME_COST + 2_000
  let gpTurn = 0
  /** 상점 · 외출을 한 관리 주기(시즌:경기 수:시리즈:대회 날) — 한 주기에 한 번씩 */
  let shopCycle = ''
  /** 마구 · 구질 훈련 차례 */
  let specialTrainingTurn = 0
  let cycleCount = 0
  let outingCycle = ''

  /** 111 · 121 상점 — 이번 주기에 한 번. 산 것이 있으면 참 */
  const runShop = (): boolean => {
    let did = false
    const now = () => result.current.career!
    // 장비 — 살 수 있는(가드 0x13460 kind 3 를 지나는) 가장 싼 칸, 소지금 반은 남긴다
    const equipment = PITCHER_EQUIPMENT_PARTS.flatMap((part) => Array.from({ length: 7 }, (_unused, level) => pitcherEquipmentItemOf(part.index, level)))
      .filter((item) => pitcherEquipmentBlockNoticeOf(now(), item.part, item.level) === null && item.price * 2 <= now().money)
      .sort((a, b) => a.price - b.price)[0]
    if (equipment !== undefined) {
      const before = now()
      buy('장착', `장착:${equipment.part}:${equipment.level}`)
      const after = now()
      const ability = PITCHER_EQUIPMENT_PARTS[equipment.part]!.ability
      expectDelta(`장비 ${equipment.name}`, '소지금', before.money, after.money, -equipment.price)
      if (after.equipmentLevels[ability] !== equipment.level + 1) problems.add(where(), [`장비 ${equipment.name} 를 샀는데 니블 ${after.equipmentLevels[ability]}`])
      if (!ownsPitcherEquipment(after, equipment.part, equipment.level)) problems.add(where(), [`장비 ${equipment.name} 를 샀는데 보유에 없다`])
      expectDelta(`장비 ${equipment.name}`, 'G', before.gamePoint, after.gamePoint, 0)
      paths.장비 += 1
      did = true
    }
    // 장비착용 121 — 한 부위에 두 레벨 이상 가졌으면 낮은 것으로 바꿔 끼었다가 높은 것으로 되돌린다 (0x17ad0, 소지금 · G 그대로)
    const swap = PITCHER_EQUIPMENT_PARTS.map((part) => ({
      part, levels: Array.from({ length: 11 }, (_unused, level) => level).filter((level) => ownsPitcherEquipment(now(), part.index, level)),
    })).find((entry) => entry.levels.length >= 2)
    if (swap !== undefined && paths.착용 < 50) {
      const before = now()
      const top = before.equipmentLevels[swap.part.ability] - 1
      const low = swap.levels.find((level) => level !== top)!
      buy('착용', `착용:${swap.part.index}:${low}`)
      if (now().equipmentLevels[swap.part.ability] !== low + 1) problems.add(where(), [`장비착용 ${swap.part.name} ${low} 인데 니블 ${now().equipmentLevels[swap.part.ability]}`])
      if (top >= 0) buy('착용', `착용:${swap.part.index}:${top}`)
      expectDelta('장비착용', '소지금', before.money, now().money, 0)
      expectDelta('장비착용', 'G', before.gamePoint, now().gamePoint, 0)
      paths.착용 += 1
      did = true
    }
    // 서브 아이템 — 못 가진 가장 싼 칸(소지금 반은 남긴다)
    const sub = PITCHER_SUB_ITEMS.filter((item) => pitcherItemBlockNoticeOf(now(), '서브', item.id) === null && item.price * 2 <= now().money)
      .sort((a, b) => a.price - b.price)[0]
    if (sub !== undefined) {
      const before = now()
      buy('서브', `서브:${sub.id}`)
      expectDelta(`서브 ${sub.name}`, '소지금', before.money, now().money, -sub.price)
      if (!now().subItemIds.includes(sub.id)) problems.add(where(), [`서브 ${sub.name} 를 샀는데 보유에 없다`])
      paths.서브 += 1
      did = true
    }
    // GP — 복권(칸 5)은 늘, 그 밖은 차례로 한 칸(능력치 0~4 · 영지버섯 6 · 진단 7 · 최면 8 · 십전대보탕 9). 명전 G 는 남긴다
    const gpIds = [5, gpTurn % 10]
    gpTurn += 1
    for (const id of new Set(gpIds)) {
      const item = PITCHER_GP_ITEMS[id]!
      if (pitcherItemBlockNoticeOf(now(), 'GP', id) !== null || walletBalance() - item.price < G_RESERVE) continue
      const before = now()
      const gBefore = walletBalance()
      buy('GP', `GP:${id}`)
      const after = now()
      expectDelta(`GP ${item.name}`, 'G', gBefore, walletBalance(), -item.price)
      if (id === 5) {
        // 또또상품권 0xa4604 — 구매 수 +1(상한 200) · 1~6등이면 상금(0xd80a7 × 100, 소지금 상한 999900), 그 밖은 아이템 효과
        const moneyGain = after.money - before.money
        if (moneyGain !== 0 && !LOTTERY_MONEY.includes(moneyGain) && after.money !== 999_900) problems.add(where(), [`복권 상금 ${moneyGain} 가 표 밖`])
        expectDelta('복권', '구매 수', before.lotteryPurchases, after.lotteryPurchases, before.lotteryPurchases >= 200 ? 0 : 1)
        paths.복권 += 1
      } else {
        expectDelta(`GP ${item.name}`, '소지금', before.money, after.money, 0)
      }
      paths.GP += 1
      did = true
    }
    // 111 취소 → 110 / 121 취소 → 106 — 관리 화면으로 (`PitcherLeagueRoute` 의 onBack)
    if (result.current.scene === '상점') act(() => result.current.actions.goto('관리'))
    return did
  }

  /** 108 마구 창 칸 `magicLevel` 확인 0x17828 → [66] 예 → 125 → 0x17f5c 칸 4 갈래 → 알림 → 105. 했으면 참 */
  const runMagicTraining = (career: PitcherCareer): boolean => {
    const cell = career.magicLevel
    const menu = PITCHER_TRAINING_MENUS[PITCHER_TRAINING_MENUS.length - 1]!
    if (cell >= 4 || career.morale <= 0 || magicTrainingCellBlockOf(career, cell) !== null || pitcherTrainingBlockReasonOf(career, menu) !== null) return false
    const gBefore = walletBalance()
    act(() => result.current.actions.pressManagementConfirm())
    act(() => result.current.actions.setResultWindowOpen(true))
    const outcome = runPitcherTraining(career, menu, random)
    act(() => result.current.actions.save(outcome.career))
    act(() => result.current.actions.setResultWindowOpen(false))
    act(() => result.current.actions.reenterManagement(TRAINING_RESULT_STATE))
    expectDelta(`마구 훈련 칸 ${cell}`, 'G', gBefore, walletBalance(), -magicTrainingCellCostOf(cell))
    const after = result.current.career
    if (after !== null && outcome.magic?.isLevelUp === true && after.selectedMagicNumber !== cell + 1) {
      problems.add(where(), [`마구 ${cell + 1} 훈련 완료인데 +0x18 = ${after.selectedMagicNumber}`])
    }
    paths.마구훈련 += 1
    return true
  }

  /**
   * 108 탭 2 구질 훈련 (r245) — 창 가드 0x17912~0x17a46(`pitchTrainingGateOf` 가 '확인'인 칸, G 가 명전 몫을 남길 때) → [예] → 125 →
   * 0x17f5c 탭 2 갈래 0x1836a(`runPitchTypeTraining` — 사기 굴림 bfa55(6,10)) → 알림 → 105. 했으면 참.
   * 화면(`usePitcherManagementMenu.runPitchTraining`)처럼 계산한 커리어를 `actions.save` 로 넘긴다(그 길이 G 사용을 적는다).
   * 차례는 행 · 열을 정책 난수로 돌린 첫 칸이다
   */
  const runPitchTraining = (career: PitcherCareer): boolean => {
    if (career.morale <= 0) return false
    const rowStart = Math.floor(policy() * PITCH_TRAINING_ROW_COUNT)
    let chosen: { readonly row: number; readonly column: number; readonly cost: number } | null = null
    for (let offset = 0; offset < PITCH_TRAINING_ROW_COUNT && chosen === null; offset += 1) {
      const row = (rowStart + offset) % PITCH_TRAINING_ROW_COUNT
      for (let column = 0; column <= HIDDEN_PITCH_COLUMN; column += 1) {
        const gate = pitchTrainingGateOf(career, row, column)
        if (gate.kind === '확인' && walletBalance() - gate.cost >= G_RESERVE) {
          chosen = { row, column, cost: gate.cost }
          break
        }
      }
    }
    if (chosen === null) return false
    const { row, column, cost } = chosen
    const gBefore = walletBalance()
    const cell = pitchTrainingProgressCellOf(career, row, column)
    const countBefore = pitchTrainingCountOf(career, cell)
    const stageBefore = career.pitchTrainingStages[cell] ?? 0
    act(() => result.current.actions.pressManagementConfirm())
    act(() => result.current.actions.setResultWindowOpen(true))
    const outcome = runPitchTypeTraining(career, row, column, random)
    act(() => result.current.actions.save(outcome.career))
    act(() => result.current.actions.setResultWindowOpen(false))
    act(() => result.current.actions.reenterManagement(TRAINING_RESULT_STATE))
    const at = `구질 훈련 행 ${row} 열 ${column}`
    expectDelta(at, 'G', gBefore, walletBalance(), -cost)
    const after = result.current.career
    if (after !== null) {
      // 0xa3cdc~0xa3d42 — 칸 횟수 +1, 다 차면 0 으로 · 단계 +1 (필요 횟수 0xd80de[열/2])
      const countAfter = pitchTrainingCountOf(after, cell)
      const stageAfter = after.pitchTrainingStages[cell] ?? 0
      const filled = stageAfter === stageBefore + 1 && countAfter === 0
      const counted = stageAfter === stageBefore && countAfter === countBefore + 1
      if (!filled && !counted) problems.add(where(), [`${at}: 칸 ${cell} 횟수 ${countBefore} → ${countAfter} · 단계 ${stageBefore} → ${stageAfter}`])
      if (!after.hasActedThisCycle) problems.add(where(), [`${at} 뒤 행동함이 안 섰다`])
      expectDelta(at, '사기', career.morale, after.morale, Math.max(0, career.morale - outcome.moraleLoss) - career.morale)
      if (filled) yearLog.push(`${career.season}년차 구질 ${row}:${column} 단계 ${stageAfter}`)
    }
    paths.구질훈련 += 1
    return true
  }

  /** 외출 지도 한 번(관리 한 주기) 동안 한 일 — 같은 지도에서 맴돌지 않게 */
  let outingVisit = { entered: false, ran: false }
  let outingVisitCount = 0
  const placeEnteredAt = new Map<string, number>()
  /** 장소 기능 고르기 — 아프면 입원, 사기가 낮으면 외식, 소지금이 적으면 CF, 그 밖은 팬미팅 · 야구교실 (0x16cf0 가드를 지나는 것) */
  const outingFunctionFor = (career: PitcherCareer) => {
    const all = OUTING_PLACES.flatMap((place) => place.functions)
    const order = [
      career.isInjured || career.isSick ? '입원' : null, career.morale < 70 ? '외식' : null, career.money < 3_000 ? 'CF촬영' : null,
      '팬미팅', '야구교실', 'CF촬영',
    ].filter((id): id is string => id !== null)
    return order.map((id) => all.find((fn) => fn.id === id)).find((fn) => fn !== undefined && outingBlockReasonOf(career, fn) === null) ?? null
  }
  let outingBefore: PitcherCareer | null = null

  /** 외출 장면(112 지도 · 113 장소 · 126 효과) 한 걸음 */
  const outingStep = () => {
    const session = result.current
    const career = session.career!
    const { actions } = session
    if (session.outingResult !== null) {
      act(() => actions.closeOutingResult())
      return
    }
    if (session.outingPresentation !== null) {
      const fn = OUTING_PLACES.flatMap((place) => place.functions).find((candidate) => candidate.id === session.outingPresentation!.functionId)
      const before = outingBefore ?? career
      act(() => actions.finishOutingPresentation())
      const after = result.current.career!
      if (fn !== undefined) {
        // 효과 0x15234 — 소지금은 굴리지 않는 표 값 0xcc344 에 서브 아이템 보정(보험증서 입원 0 · 명품정장 CF −400, 점프표 0xcc6c4),
        // 행동함 · 외출 수 +1
        const cost = applyOutingSubItems(before, fn.id, {
          moneyCost: fn.effect.moneyCost, moraleGain: 0, popularityGain: 0, reputationGain: 0, healsInjury: fn.effect.healsInjury,
        }).moneyCost
        expectDelta(`외출 ${fn.name}`, '소지금', before.money, after.money, Math.max(0, before.money - cost) - before.money)
        expectDelta(`외출 ${fn.name}`, 'G', before.gamePoint, after.gamePoint, 0)
        expectDelta(`외출 ${fn.name}`, '외출 수', before.outingsThisSeason, after.outingsThisSeason, 1)
        if (!after.hasActedThisCycle) problems.add(where(), [`외출 ${fn.name} 뒤 행동함이 안 섰다`])
      }
      paths.외출기능 += 1
      return
    }
    if (session.outingNotice !== '') {
      act(() => actions.closeOutingNotice())
      return
    }
    // [!] 장소가 여럿이면 돌아가며 들어간다 — 짝수 번째 지도는 장소 기능을 먼저 해 본다(장소 이벤트가 늘 있어 기능을 못 밟지 않게)
    const eventPlaces = OUTING_PLACES.filter((place) => session.eventPlaceIds.has(place.id))
    // 가장 오래 안 들어간 장소부터 (처음 [!] 가 선 장소가 먼저)
    const eventPlace = [...eventPlaces].sort((a, b) => (placeEnteredAt.get(a.id) ?? -1) - (placeEnteredAt.get(b.id) ?? -1))[0]
    const functionFirst = outingVisitCount % 2 === 1 && !outingVisit.ran && !career.hasActedThisCycle && outingFunctionFor(career) !== null
    if (eventPlace !== undefined && !outingVisit.entered && !functionFirst) {
      outingVisit.entered = true
      placeEnteredAt.set(eventPlace.id, outingVisitCount)
      paths.장소 += 1
      act(() => actions.enterOutingPlace(eventPlace))
      if (process.env.SOAK_DEBUG === '1') yearLog.push(`장소 ${eventPlace.id} → 이벤트 ${result.current.story?.eventId} (${career.season}년차 g${career.gamesPlayed}) 본적 ${career.seenEventIds.includes(String(result.current.story?.eventId))}`)
      return
    }
    if (!outingVisit.ran && !career.hasActedThisCycle) {
      outingVisit.ran = true
      const fn = outingFunctionFor(career)
      if (fn !== null) {
        outingBefore = career
        act(() => actions.runOutingFunction(fn.id))
        return
      }
    }
    // 112 취소 → 105 (키 0x13ba4 — 13bc0~13bca 가 행동함을 0 으로 내린다, 원본 그대로 · `PitcherLeagueRoute` onBack)
    if (career.hasActedThisCycle) act(() => actions.save({ ...career, hasActedThisCycle: false }))
    act(() => result.current.actions.goto('관리'))
  }

  /** 엔딩 141 → 명예의 전당 145 등록 (`PitcherLeagueRoute` 의 hallOfFame.onRegister → App `collection.registerPitcher`) → 0x1bfd4 */
  const registerHallOfFame = () => {
    const career = result.current.career
    const wallet = hooks().wallet
    if (career === null) return
    const gBefore = wallet.balance
    const registered = registerHallOfFamePitcher(collection, career, gBefore)
    if (registered.kind !== '등록') {
      yearLog.push(`명전 ${registered.kind}(G ${gBefore})`)
      return
    }
    collection = registered.collection
    act(() => hooks().wallet.spend(HALL_OF_FAME_COST))
    ledger.add('명전등록', -HALL_OF_FAME_COST)
    act(() => result.current.actions.eraseSaveForHallOfFame())
    isEndingErased = true
    expectDelta('명전 등록', 'G', gBefore, walletBalance(), -HALL_OF_FAME_COST)
    const famer = collection.hallOfFamePitchers.at(-1)
    // 0x1f654 — 그때 선수 레코드를 통째로: 이름 · 능력치 · 장비 능력치 0xb6415 · 장비 니블 · 시즌 줄(+0x20~) · 엔딩 · 연차
    const expected = {
      name: career.name, ability: career.ability, equippedAbility: equippedPitcherAbilityOf(career), equipmentLevels: career.equipmentLevels,
      recordLine: pitcherRecordLineOf(career.stats), endingIndex: career.endingIndex, season: career.season,
      selectedMagicNumber: career.selectedMagicNumber, pitchMask: career.pitchMask,
    }
    for (const [key, value] of Object.entries(expected)) {
      const diff = firstDiffOf(value, (famer as unknown as Record<string, unknown> | undefined)?.[key], `명전.${key}`)
      if (diff !== null) problems.add(where(), [diff])
    }
    // 0x224ec — 모드 저장이 비고(이름 없는 덩어리) +0x4f 도 내렸다
    if ((store.held() as { name?: unknown } | null)?.name !== undefined) problems.add(where(), ['명전 등록 뒤에도 투수편 저장이 남았다'])
    if (nariGameSave.held().inProgress) problems.add(where(), ['명전 등록 뒤에도 +0x4f 가 서 있다'])
    act(() => result.current.actions.finishEnding(true))
    if (result.current.career !== null || result.current.scene !== '등록') problems.add(where(), [`등록 뒤 엔딩을 떠났는데 ${result.current.scene}`])
    if ((store.held() as { name?: unknown } | null)?.name !== undefined) problems.add(where(), ['엔딩을 떠난 뒤 투수편 저장이 되살아났다'])
    paths.명전 += 1
  }

  /* ── 이어하기 — 훅을 내리고 같은 저장소로 새로 세운다 ─────────────────────── */

  const RESUME_POINTS: readonly PitcherScene[] = ['관리', '경기', '경기결과', '이벤트']
  let resumeTurn = 0
  let pendingResume: PitcherScene | null = null

  /**
   * 앱을 다시 켠 꼴 — 세션 · 지갑 · 미션 세션을 내리고(전역 칸 · 저장소는 남는다) 메인 메뉴(장면 0x106 없음)로 새로 세운 뒤 투수편에
   * 들어선다. +0x4f 가 서 있으면 [14] 의 0x327b8 모드 3 갈래가 곧장 경기(`resumeInterruptedGame`)로, 아니면 100 진입 0x1c154 의 이어할 자리.
   * 다시 선 커리어는 끊기 전과 같아야 한다 — 원본이 일부러 다시 도는 진입(116 의 0x1278c 재누적 · 0xf684 의 반복 이벤트 지움)은 얹어 견준다
   */
  const resumeHere = async () => {
    const now = result.current.career
    const scene = result.current.scene
    const events = result.current.storyEvents
    const at = where()
    rendered.unmount()
    resetStageStores()
    onScreen.value = false
    rendered = mount()
    await waitUntil(() => result.current.storyEvents !== null, '이벤트 본문')
    // 116 재진입 0x1278c · 반복 이벤트 지움 — `checkRoundTrip` 과 같은 근거
    const reentered = now !== null && scene === '경기결과' && now.seasonEndState === 116 ? enterPitcherGameEvaluation(now) : now
    const expected = reentered === null || events === null ? reentered : forgetRepeatableEvents(reentered, events)
    const d = firstDiffOf(expected, result.current.career, 'career')
    if (d !== null) problems.add(at, [`이어하기(${scene}) 뒤 커리어가 다르다: ${d}`])
    const save = nariGameSave.held()
    if (save.inProgress && result.current.career !== null) {
      act(() => result.current.actions.resumeInterruptedGame(save.match))
      if (result.current.scene !== '경기') problems.add(at, [`+0x4f 이어하기가 경기로 안 갔다: ${result.current.scene}`])
    }
    onScreen.value = true
    rendered.rerender(<Harness />)
    await act(async () => {
      await Promise.resolve()
    })
    paths.이어하기[scene] = (paths.이어하기[scene] ?? 0) + 1
  }

  /* ── 그림 틀 장면(이벤트 · 마선수 대결) — 사람 손가락 ────────────────────────────────────────────────── */

  let idleFrames = 0
  let lastSignature = ''
  let lastStage = ''
  let planned: { readonly frame: number; readonly key: string } | null = null
  let lastSlotKey = ''
  /** 그림 틀 한 걸음 — 틀을 돌리고, 지금 보이는 단계에 맞춰 키를 누른다 */
  const frameStep = () => {
    frame()
    frames += 1
    const session = result.current
    const { mission, runner } = hooks()
    const run = mission.pitcherRun
    // 사람이 보는 단계 — 대결은 누름 칸으로(0xe 확인 · 0xf 구질 · 0x10 조준 · 0x11 게이지), 그 밖(판 · 결과 판 · 대사창)은 '판'
    // 화면 경기 — 처음 선 틀에 경기 앞 커리어 · 옵션을 잡는다(요약 검사 재료)
    if (session.scene === '경기' && gameStart.current === null && session.gameOptions !== null && session.career !== null) {
      gameStart.current = {
        before: session.career, options: session.gameOptions, isCup: session.cupMatch !== null || session.gameOptions.isNationalCup === true,
      }
    }
    const stage = session.scene !== '마선수대결' && session.scene !== '경기' ? '판'
      : isShown('확인 누름 칸') ? '확인'
        : isShown('구질 누름 칸') ? '구질'
          : isShown('조준 영역') ? '조준'
            : isShown('게이지 누름 칸') ? '게이지' : '판'
    if (stage !== lastStage) {
      // 마구 칸(5 — '0')을 골라 조준으로 넘어갔으면 마구 공 하나 (0x50db8 — 남은 횟수가 0 이면 키를 버린다)
      if (lastStage === '구질' && stage === '조준' && lastSlotKey === '0') paths.마구공 += 1
      lastStage = stage
      planned = null
      // 구질 — 정책 난수로 칸 0~4(가끔 마구 칸 5). 빈 칸이면 키가 안 먹어 아래 OK(칸 0)로 넘어간다
      if (stage === '구질') planned = { frame: frames + 1 + Math.floor(policy() * 4), key: PITCH_SLOT_KEYS[policy() < 0.1 ? 5 : Math.floor(policy() * 5)]! }
      // 조준 — 흔들림(0x39c5c `aimTick`)이 도는 동안 몇 틱 뒤 OK. 가끔 한 칸 옮긴다
      else if (stage === '조준') {
        if (policy() < 0.5) pressKey(['2', '4', '6', '8'][Math.floor(policy() * 4)]!)
        planned = { frame: frames + 2 + Math.floor(policy() * 10), key: '5' }
      } else if (stage === '게이지') planned = { frame: frames + 1 + Math.floor(policy() * 9), key: '5' }
      else if (stage === '확인') planned = { frame: frames + 2 + Math.floor(policy() * 8), key: 'Enter' }
    }
    if (planned !== null && frames >= planned.frame) {
      const { key } = planned
      planned = null
      if (stage === '구질') lastSlotKey = key
      pressKey(key)
    }
    const signature = `${session.scene}:${session.story?.eventId}:${session.story?.context}:${stage}:${run?.status}:${run?.outs}`
      + `:${run?.game.inning}:${run?.game.offenseSide}:${runner.atBat.balls}:${runner.atBat.strikes}:${mission.halfInningBoard === null}`
      + `:${mission.loadingTip === null}:${mission.pendingDefensePlay === null}:${mission.pendingRunnerPlay == null}`
    if (signature === lastSignature) idleFrames += 1
    else {
      idleFrames = 0
      lastSignature = signature
    }
    // 판 · 창 · 대사 — 겉보기가 한참 그대로면 OK (대결 단계에서 키가 안 먹었으면 칸 0 · OK 로 넘어간다)
    if (planned === null && idleFrames >= (stage === '판' ? 4 + Math.floor(policy() * 8) : 30)) {
      idleFrames = 0
      pressKey('Enter')
    }
    if (process.env.SOAK_DEBUG === '1' && frames % 500 === 0) process.stderr.write(`[틀 ${frames}] ${where()} ${signature} idle ${idleFrames}\n`)
    if (idleFrames > STUCK_FRAMES) stoppedAt = `멈춤(그림 ${STUCK_FRAMES}틀 그대로): ${where()} · ${signature}`
  }

  const maxSteps = soakNumber('SOAK_MAX_STEPS', 2_000_000)
  let lastKey = ''
  let sameKeySteps = 0
  try {
    await waitUntil(() => result.current.career === null, '빈 커리어')
    act(() => result.current.actions.create('소크', {
      role: role as PitcherCareer['role'], typeIndex: seed % 3, handIndex: seed % 2, skinIndex: seed % 3, breakingPitchSlots: [0, 1], teamId,
    }))
    await waitUntil(() => result.current.storyEvents !== null, '이벤트 본문')
    if (boostAbility && result.current.career !== null) {
      const created = result.current.career
      act(() => result.current.actions.save({ ...created, ability: pitcherAbilityLimitsOf(created) }))
    }
    if (options.startPatch !== undefined && result.current.career !== null) {
      const created = result.current.career
      act(() => result.current.actions.save({ ...created, ...options.startPatch }))
    }
    for (; steps < maxSteps; steps += 1) {
      // '이벤트' 는 연말 사슬(이어하기 100 진입 0x1c154 가 그 이벤트로 다시 서는 자리)에서만 끊는다 — 장소 · 관리 이벤트에서 끊으면
      // 원본도 105 로 이어 그 이벤트를 다시 고른다(본 표시는 재생 끝 0x1c014 에서야 선다)
      const resumeMatches = pendingResume !== null && result.current.scene === pendingResume
        && (pendingResume !== '이벤트' || result.current.story?.context === '연말')
      if (resumeMatches && result.current.career !== null) {
        if (process.env.SOAK_DEBUG === '1') yearLog.push(`이어하기 ${pendingResume} ${result.current.story?.eventId ?? ''}`)
        pendingResume = null
        await resumeHere()
        continue
      }
      if (frameScenes.has(result.current.scene) && result.current.career !== null) {
        frameStep()
        // 화면이 경기를 끝냈다(`finishGame`) — 정산이 든 뒤 요약 검사
        const finished = finishedGame.current
        if (finished !== null) {
          finishedGame.current = null
          checkFinishedGame(finished)
        }
        if (stoppedAt !== null) break
        checkCareer()
        continue
      }
      if (stopAfterContinues !== undefined && continuedAfterEnding >= stopAfterContinues && result.current.scene === '관리') break
      const session = result.current
      const { career, scene, actions } = session
      const key = `${scene}:${career?.season}:${career?.gamesPlayed}:${session.story?.eventId}:${session.story?.context}`
        + `:${games.리그 + games.포스트시즌 + games.대회}:${career?.postseason?.wins.join(',')}:${career?.nationalCup?.day}`
        + `:${session.postseasonPopup?.kind ?? ''}:${career?.hasActedThisCycle}:${session.pendingTitle}`
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
          if (session.pendingTitle !== null) {
            act(() => actions.confirmTitle())
            break
          }
          managementVisits += 1
          if (managementVisits % roundTripEvery === 0) await checkRoundTrip()
          if (extras && resumeEvery > 0 && pendingResume === null && managementVisits % resumeEvery === 0) {
            pendingResume = RESUME_POINTS[resumeTurn % RESUME_POINTS.length]!
            resumeTurn += 1
          }
          // 새 길 — 상점은 행동을 안 쓴다(주기마다 한 번). 쓰는 길은 마구 훈련 · 외출(셋째 관리마다)
          if (extras) {
            const cycle = `${career.season}:${career.gamesPlayed}:${career.postseason?.wins.join(',')}:${career.nationalCup?.day}`
            if (shopCycle !== cycle) {
              shopCycle = cycle
              cycleCount += 1
              if (runShop()) break
            }
            const now = result.current.career!
            // 외출은 셋째 주기마다(아프면 입원하러 늘), 그 밖 주기는 마구 훈련을 먼저 해 본다
            const wantsOuting = cycleCount % (options.outingEvery ?? 3) === 0 || now.isInjured || now.isSick
            if (!now.hasActedThisCycle && outingCycle !== cycle && wantsOuting) {
              outingCycle = cycle
              outingVisit = { entered: false, ran: false }
              outingVisitCount += 1
              act(() => result.current.actions.pressManagementConfirm())
              act(() => result.current.actions.openOuting())
              break
            }
            // 마구 훈련 · 구질 훈련을 주기마다 번갈아 먼저 해 본다 (108 탭 1 · 2)
            if (!now.hasActedThisCycle && !(now.morale < 40 || now.isInjured || now.isSick)) {
              specialTrainingTurn += 1
              const order = specialTrainingTurn % 2 === 0 ? [runPitchTraining, runMagicTraining] : [runMagicTraining, runPitchTraining]
              if (order.some((run) => run(result.current.career!))) break
            }
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
          act(() => actions.confirmMatchPrepare())
          break
        case '경기':
          if (!playGame()) stoppedAt = `경기를 못 끝냈다: ${where()}`
          break
        case '경기결과':
          if (games.리그 % roundTripEvery === 0) await checkRoundTrip()
          act(() => actions.confirmGameResult())
          break
        case '외출':
          outingStep()
          break
        case '상점':
          // 상점은 관리 한 걸음 안에서 열고 닫는다 — 여기 머물면 닫는다(111 · 121 취소)
          act(() => actions.goto('관리'))
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
        case '엔딩': {
          lastSeason = career.season
          const ended = career.endingIndex
          if (career.endingBonusReceived !== true) {
            const gBefore = walletBalance()
            act(() => actions.receiveEndingBonus())
            if (ended !== null) expectDelta(`엔딩 ${ended} 보너스`, 'G', gBefore, walletBalance(), Math.min(GAME_POINT_LIMIT, gBefore + pitcherEndingBonusOf(ended)) - gBefore)
          }
          // 이어할 수 있는 엔딩(부상 0 · 방출 1)이면 5000 G 로 이어한다 (팝업 0x32 예 → 0x1bd36)
          const wantsContinue = continueEndings || (extras && continuedAfterEnding === 0)
          if (wantsContinue && ended !== null && isContinuablePitcherEnding(ended) && walletBalance() >= PITCHER_CONTINUE_COST_GAME_POINT) {
            const gBefore = walletBalance()
            const seasonBefore = career.season
            let continued = false
            act(() => {
              continued = result.current.actions.continueAfterEnding()
            })
            if (!continued) problems.add(where(), [`G ${gBefore} 인데 엔딩 ${ended} 을 이어하지 못했다`])
            else {
              continuedAfterEnding += 1
              paths.엔딩이어하기 += 1
              yearLog.push(`${seasonBefore}년차 엔딩 ${ended} 이어하기`)
              expectDelta(`엔딩 ${ended} 이어하기`, 'G', gBefore, walletBalance(), -PITCHER_CONTINUE_COST_GAME_POINT)
              const after = result.current.career
              if (after === null || after.endingIndex !== null) problems.add(where(), [`엔딩 이어하기 뒤 엔딩 칸 ${after?.endingIndex}`])
              // 부상 엔딩은 부상만 풀고 같은 시즌, 방출 엔딩은 새 시즌(0x1bddc · 0x1b768)
              if (after !== null && ended === 0 && (after.isInjured || after.injuredGamesPlayed !== 0 || after.season !== seasonBefore)) {
                problems.add(where(), [`부상 엔딩 이어하기 뒤 부상 ${after.isInjured} · 부상 경기 ${after.injuredGamesPlayed} · ${seasonBefore} → ${after.season}년차`])
              }
              if (after !== null && ended === 1 && after.season !== seasonBefore + 1) problems.add(where(), [`방출 엔딩 이어하기 뒤 연차 ${seasonBefore} → ${after.season}`])
              break
            }
          }
          endingIndex = ended
          if (extras) registerHallOfFame()
          break
        }
        default:
          stoppedAt = `다룰 줄 모르는 장면: ${where()}`
      }
      if (stoppedAt !== null || endingIndex !== null) break
      lastSeason = result.current.career?.season ?? lastSeason
      checkCareer()
    }
    if (steps >= maxSteps) stoppedAt = `걸음 한도 ${maxSteps}: ${where()}`
    await checkRoundTrip()
  } catch (error) {
    stoppedAt = `예외: ${(error as Error).stack ?? String(error)} @ ${where()}`
  } finally {
    rendered.unmount()
  }
  return {
    problems, steps, games, seasons: holder.current?.session.career?.season ?? lastSeason, endingIndex, stoppedAt, yearLog, paths,
    ledger: ledgerSums, frames,
  }
}

function report(result: PitcherSoakResult): string {
  const { games } = result
  return `걸음 ${result.steps} · 경기 리그 ${games.리그} · PS ${games.포스트시즌} · 대회 ${games.대회} · 등판 ${games.등판} · 대결 ${games.대결}`
    + ` · ${result.seasons}년차 · 엔딩 ${result.endingIndex} · [${result.yearLog.join(' / ')}]`
    + ` · 새 길 ${JSON.stringify(result.paths)} · G 장부 ${JSON.stringify(result.ledger)} · 틀 ${result.frames}`
    + (result.stoppedAt === null ? '' : `\n멈춘 곳: ${result.stoppedAt}`)
    + (result.problems.size === 0 ? '' : `\n문제 ${result.problems.size}가지:\n${result.problems.report()}`)
}

describe('나만의리그 투수편 장기 진행 점검 (soak)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    // 손으로 갈아 끼운다 — `vi.spyOn` 은 부른 기록을 다 들고 있어 긴 판(수백만 틀)에서 메모리가 넘친다
    originals = { now: performance.now, raf: window.requestAnimationFrame, caf: window.cancelAnimationFrame }
    performance.now = () => clock
    window.requestAnimationFrame = (callback) => {
      const handle = nextFrameHandle
      nextFrameHandle += 1
      frameCallbacks.set(handle, callback)
      return handle
    }
    window.cancelAnimationFrame = (handle) => void frameCallbacks.delete(handle)
    // 아무 일도 안 하는 붓 — 그라디언트 같은 돌려받는 붓 객체도
    const noopBrush = (target: object): object => new Proxy(target, {
      get: (held, key) => (key in held ? (held as Record<string | symbol, unknown>)[key] : () => noopBrush({})),
      set: () => true,
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      return noopBrush({ canvas: this }) as never
    })
    resetStageStores()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    if (originals !== null) {
      performance.now = originals.now
      window.requestAnimationFrame = originals.raf
      window.cancelAnimationFrame = originals.caf
      originals = null
    }
    vi.useRealTimers()
    frameCallbacks = new Map()
  })

  it('짧은 판 — 새 선발 투수로 한 해(45경기)와 연말 사슬을 넘겨 2년차 경기까지 치러도 값이 맞고 저장 왕복이 같다', async () => {
    const result = await runPitcherSoak({ seed: 2010, role: PITCHER_ROLE.starter, teamId: 3, maxGames: 50, roundTripEvery: 3 })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.리그).toBe(50)
    expect(result.seasons).toBe(2)
  }, 120_000)

  it('짧은 판 (새 길) — 4년차 첫날에서 상점 · 복권 · 마구 훈련 · 마구 공 · 외출 · 장소 대결 · 이어하기를 밟아도 값 · 수지가 맞는다', async () => {
    const result = await runPitcherSoak({
      seed: 2010, role: PITCHER_ROLE.starter, teamId: 3, maxGames: 50, roundTripEvery: 4, extras: true, resumeEvery: 3, outingEvery: 2,
      // 방송국(trigger 6) 앞 이벤트 200~205(공통 · 1~4년차)를 이미 본 저장 — 4년차 g29 부터 [!] 가 투수 대결 207(팀 20)이 된다
      startPatch: { season: 4, popularity: 1_600, money: 40_000, seenEventIds: ['200', '201', '202', '203', '204', '205'] },
    })
    if (process.env.SOAK_DEBUG === '1') process.stderr.write(`${report(result)}\n`)
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    const { paths } = result
    expect(paths.장비, report(result)).toBeGreaterThan(0)
    expect(paths.서브, report(result)).toBeGreaterThan(0)
    expect(paths.복권, report(result)).toBeGreaterThan(0)
    expect(paths.마구훈련, report(result)).toBeGreaterThan(0)
    expect(paths.구질훈련, report(result)).toBeGreaterThan(0)
    expect(paths.보상명령, report(result)).toBeGreaterThan(0)
    expect(paths.마구공, report(result)).toBeGreaterThan(0)
    expect(paths.외출기능, report(result)).toBeGreaterThan(0)
    expect(paths.대결, report(result)).toBeGreaterThan(0)
    expect(Object.keys(paths.이어하기).length, report(result)).toBeGreaterThanOrEqual(3)
  }, 120_000)

  it('짧은 판 (화면 경기) — 나만의리그 경기를 앱 화면(`PitcherGameScreen`)으로 키를 눌러 던져도 값 · 수지가 맞는다 (조준 흔들림 · 파티클 · 정산 효과)', async () => {
    const result = await runPitcherSoak({
      seed: 2014, role: PITCHER_ROLE.starter, teamId: 6, maxGames: 6, roundTripEvery: 2, extras: true, gameScreen: true, resumeEvery: 2,
      startPatch: { season: 4, popularity: 1_600, money: 40_000 },
    })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.리그, report(result)).toBe(6)
    expect(result.games.등판, report(result)).toBeGreaterThan(0)
  }, 180_000)

  it('짧은 판 (엔딩 이어하기) — 부상 엔딩(0)을 5000 G 로 이어하고 같은 시즌 경기를 이어 던진다 (0x1bd36 → 0x1bddc)', async () => {
    // 부상 경기 수 20 (0xa3a84 첫 줄) — 105 진입 판정 0 → 부상 엔딩 500
    const result = await runPitcherSoak({
      seed: 2012, role: PITCHER_ROLE.starter, teamId: 4, maxGames: 6, roundTripEvery: 3, continueEndings: true, startGamePoint: 30_000,
      startPatch: { injuredGamesPlayed: 20, isInjured: true, injuryRemaining: 5 },
    })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.paths.엔딩이어하기, report(result)).toBe(1)
    expect(result.games.리그, report(result)).toBeGreaterThan(0)
  }, 120_000)

  it.runIf(isSoakEnabled())('긴 판 (엔딩 이어하기) — 7년차 인기도 ≤ 499 방출 엔딩(1)을 5000 G 로 이어해 8년차로 간다 (0x1b768)', async () => {
    const result = await runPitcherSoak({
      seed: 2013, role: PITCHER_ROLE.starter, teamId: 5, roundTripEvery: 10, continueEndings: true, stopAfterContinues: 1,
      startGamePoint: 30_000, startPatch: { season: 7, popularity: 100 },
    })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.paths.엔딩이어하기, report(result)).toBe(1)
  }, 3_600_000)

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 (새 길) — 씨앗 ${seed}: 상점 · 외출 · 대결 · 마구 · 이어하기를 밟으며 엔딩 · 명예의 전당까지`, async () => {
      const started = Date.now()
      const role = seed % 2 === 0 ? PITCHER_ROLE.starter : 2
      const result = await runPitcherSoak({
        seed, role, boostAbility: true, teamId: seed % 10, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10), extras: true,
        gameScreen: soakNumber('SOAK_GAME_SCREEN', 1) === 1,
        resumeEvery: soakNumber('SOAK_RESUME_EVERY', 7),
      })
      const line = `[투수편 soak 새 길] 씨앗 ${seed} · 보직 ${role} · ${(Date.now() - started) / 1000}s · ${report(result)}`
      process.stderr.write(`${line}\n`)
      if (process.env.SOAK_REPORT !== undefined) (await import('node:fs')).appendFileSync(process.env.SOAK_REPORT, `${line}\n`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.endingIndex, report(result)).not.toBeNull()
      expect(result.problems.size, report(result)).toBe(0)
      expect(result.paths.대결, report(result)).toBeGreaterThan(0)
    }, 3_600_000)
  }

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed}: 등록부터 은퇴 · 엔딩까지`, async () => {
      const started = Date.now()
      const role = seed % 2 === 0 ? PITCHER_ROLE.starter : 2
      const boostAbility = Math.floor(seed / 2) % 2 === 1
      const result = await runPitcherSoak({
        seed, role, boostAbility, teamId: seed % 10, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10),
        gameScreen: soakNumber('SOAK_GAME_SCREEN', 1) === 1,
      })
      const line = `[투수편 soak] 씨앗 ${seed} · 보직 ${role}${boostAbility ? '(상한)' : ''} · ${(Date.now() - started) / 1000}s · ${report(result)}`
      console.info(line)
      if (process.env.SOAK_REPORT !== undefined) (await import('node:fs')).appendFileSync(process.env.SOAK_REPORT, `${line}\n`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.endingIndex, report(result)).not.toBeNull()
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
  }
})

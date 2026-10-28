// @vitest-environment jsdom
/**
 * **나리 타자편 장기 진행 점검 (soak)** — 화면 없이 `useCareerSession` 을 새 선수 등록부터 여러 해, 은퇴 · 엔딩까지 돌린다.
 *
 * 앱처럼 세운다 (`App`): 커리어 세션 옆에 G 지갑(`useGamePointWallet`) · 모드 저장(`useModeSave` — 경기 중간 저장 +0x4c ·
 * 마선수 대결 대기) · 기록연감(`useCollection` — 명예의 전당) · 미션 세션(`useMissionSession` — 이벤트 마선수 대결) · 환경설정
 * (`useGameSettings`)을 같은 난수 · 같은 화면 상태로 함께 띄운다. 저장소는 모두 메모리다.
 *
 * **경기 · 결과 · 이벤트 · 마선수 대결은 앱의 그 화면을 그대로 띄워 키로 친다 (r245)** — 경기(`GameRoute` → `GameScreen` →
 * `BattingStage`), 경기 결과(`GameResultScreen` — 결과 그림 0x4a384 의 정산 효과), 이벤트(`StoryScreen` — 보상 명령마다
 * `giveEventReward`), 마선수 대결(`MissionRoutes` → `MissionPlayScreen`)을 `CareerRoutes` · `MissionRoutes` 로 띄우고, 그림 틀을
 * 한 틱씩(`millisecondsPerFrame()`) 돌리며 사람처럼 키만 누른다:
 * - 공이 나는 동안(상태 0x11 — `sceneStateEntryAt`) 정책 난수로 휘두를지 · 몇 틱 뒤에 '5' 를 누를지 고른다. 타구 판정(패턴 덱
 *   0x51490 · 발사 패턴 굴림) · 파티클 틱(마구 공 · 판정 글자 · 홈런 효과) · CPU 투구 · 견제 · 도루 출발은 화면이 앱 차례 그대로 굴린다.
 * - 새 길(`extras`)이면 공이 나는 동안 가끔 도루 키('3' · '2' · '1' — 앞 루가 빈 가장 앞 주자).
 * - 0xe 확인 · 판 · 결과 판 · 대사창은 사람이 몇 틱 뒤에 OK(Enter) 를 누른 것으로 넘긴다(그동안 도는 효과 틱도 앱 차례다).
 * - 로딩 판(`LoadingTip`)은 그리자마자 끝낸다(굴림 없음 — 팁은 세션이 굴렸다). 그림 붓은 아무 일도 안 하는 붓이고, 파티클 설정은
 *   앱이 받아 둔 `particles.json` 을 그대로 싣는다(받기 전 null 이면 파티클이 안 나 굴림이 빠진다).
 *
 * 그 밖의 화면은 그 화면이 부르는 액션을 그대로 부른다 (`CareerRoutes` 가 화면 대신):
 * - 관리(105): 이번 주기에 아직 안 했으면 사기 < 60 이면 휴식, 아니면 트레이닝 칸 히트 · 파워 · 수비 · 주루 차례(막힌 칸은 건너뜀).
 *   했으면 [다음경기] → 109 순위 확인 → 142 경기 준비 확인.
 * - 포스트시즌(128)은 팝업을 닫고 [확인], 국가대항전(134)은 화면의 판정(`confirmNationalCupStandings` · `finishNationalCup`)을 그대로 부른다.
 * - 엔딩(141)은 보너스를 받고, 이어할 수 있는 엔딩(부상 · 방출)이면 5000 G 로 이어하고(새 길이면 한 번, `continueEndings` 면 늘),
 *   새 길이면 명예의 전당에 등록(`collection.register` → `eraseSaveForHallOfFame` → `finishEnding(true)`).
 *
 * **새 길 (`extras`, r235)** — 도루 · 상점(장비 · 끼기 · 서브 · GP — 칸 5 복권 · 칸 9 이글아이) · 외출(병원 · 외식 · [!] 장소 →
 * 장소 이벤트 → 마선수 대결) · 엔딩 이어하기 · 명전 등록 · 이어하기(`resumeEvery` — 훅을 내리고 같은 저장소로 새로 띄워 메인 메뉴의
 * 길: 경기 중간 저장(+0x4c)이면 `resumeInterruptedGame`, 아니면 `continueSaved`).
 *
 * 걸음마다 불가능한 값, 리그 전적 합 · 순위 차례, 경기 요약 → 시즌 누계, 경기 수(일정표 하루씩), 저장 JSON 왕복과 새 세션으로 다시
 * 띄운 상태, 멈춤, **G 전체 장부**(처음 G + 기록연감 G획득 · G사용 · GP 아이템 + 미션 보상 − 명전 등록 = 지갑, r245)를 본다. 새 길에는
 * 돈 · G 수지(구매 · 외출 · 복권 · GP 아이템 · 명전 등록 앞뒤 차이), 장비, 명전 기록 줄, 이어하기 앞뒤 커리어를 더 본다.
 * MVP 사슬(375 · 376/377)은 (시즌 · 포스트시즌 자리)마다 두 번 끝나면 문제다(r243 — 시리즈가 끝난 경기마다 다시 뜨는 것은 원본).
 * 긴 판은 `SOAK=1` 로 켠다:
 * `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/careerSoak.test.tsx --maxWorkers=2`
 * (`SOAK_RESUME_EVERY` 끊는 간격 · `SOAK_REPORT=파일` 통과한 판 요약을 파일에 덧붙인다)
 *
 * ⚠️ 앱과 다른 것(남김 — 화면 없는 자리): 관리 · 외출 · 상점 · 포스트시즌 · 국가대항전 · 엔딩 화면은 띄우지 않고 액션을 부른다
 * (그 화면들은 굴림이 없거나 세션이 굴린다). 이어하기는 같은 난수 객체로 잇는다(앱은 새로 켜면 새 난수다).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useMissionSession } from '@/app/model/useMissionSession'
import { nariBatterOf, useCollection } from '@/app/model/useCollection'
import { useGameSettings } from '@/app/model/useGameSettings'
import { modeBatterOf } from '@/app/model/modeBatter'
import { CareerRoutes } from '@/app/ui/CareerRoutes'
import { MissionRoutes } from '@/app/ui/MissionRoutes'
import type { Screen } from '@/app/model/screen'
import { DEFAULT_ROOKIE_PROFILE, GAMES_PER_SEASON, nextOpponentOf } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import { confirmNationalCupStandings, finishNationalCup } from '@/entities/national-cup/model/nationalCupFlow'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { rankingOf } from '@/entities/league/model/league'
import { purchaseQuestionOf, shopItemId } from '@/features/shop/model/shopSelection'
import {
  EQUIPMENT_LEVEL_COUNT,
  EQUIPMENT_PARTS,
  equipmentBlockReasonOf,
  equipmentBonusOf,
  equipmentItemOf,
  ownsEquipment,
} from '@/entities/career/model/equipment'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { SUB_ITEMS, subItemBlockReasonOf } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { outingBlockReasonOf } from '@/entities/career/model/outing'
import { CONTINUE_COST_GAME_POINT, endingBonusOf, isContinuableEnding } from '@/entities/career/model/seasonFlow'
import { batterRecordLineOf } from '@/entities/career/model/seasonStats'
import { HALL_OF_FAME_COST } from '@/entities/collection/model/collection'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { aceMatchMissionOf, matchResultEventOf } from '@/entities/story/model/aceMatch'
import { aceMatchClearCountAfterWin, aceMatchClearKeyOf } from '@/entities/mission/model/aceMatchClear'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { MatchCommand } from '@/pages/story/model/useEventPlayback'
import type { StoryContext } from '@/app/model/useStorySchedule'
import { nariGameMatchOfSave } from '@/pages/management/lib/nariMatchPrepare'
import type { NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'
import { myBatterIndexOf, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { GAME_POINT_LIMIT } from '@/entities/wallet/model/gamePointWallet'
import { useModeSave } from '@/entities/mode-save/model/useModeSave'
import { STEAL_KEY_OF_BASE } from '@/features/defense-play/model/pitchArrivalPlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { MissionClearCounts, MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { ACE_BATTER_ROSTER_SLOT } from '@/entities/league/model/leagueDay'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { gameSceneTickNow, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { SCENE_STATE, resetSceneStateEntries, sceneStateEntryAt } from '@/shared/lib/commonWindow/sceneStateEntries'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'
import { resetSceneBallPath, sceneBallPathPitch } from '@/widgets/batting-stage/model/sceneBallPath'
import {
  SoakProblems,
  batterLineProblemsOf,
  firstDiffOf,
  isSoakEnabled,
  jsonRoundTripDiffOf,
  leagueTallyProblemsOf,
  outOfRangeOf,
  rankingOrderProblemsOf,
  soakNumber,
  soakSeeds,
  unserializablePathsOf,
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

/** 나리 타자편 모드 번호 (`App` 의 NARI_BATTER_MODE) */
const NARI_BATTER_MODE = 4

/** 휘두르는 비율 · 누르는 틱 흔들림(맞는 틱에서 앞으로 `SWING_TICK_EARLY` · 폭 `SWING_TICK_SPAN`) (정책) */
const SWING_RATE = 0.55
const SWING_TICK_SPAN = 5
const SWING_TICK_EARLY = 3

/* ── 그림 틀 — 앱처럼 requestAnimationFrame · performance.now · setTimeout 을 한 틀씩 돌린다 ─────────────── */

let frameCallbacks = new Map<number, FrameRequestCallback>()
let nextFrameHandle = 1
let clock = 1_000
let originals: {
  now: () => number
  raf: typeof window.requestAnimationFrame
  caf: typeof window.cancelAnimationFrame
  queueMicrotask: typeof globalThis.queueMicrotask
} | null = null

/**
 * `queueMicrotask` 로 건 일 — 걸음이 끝날 때마다 비운다(`runQueuedMicrotasks`). 브라우저는 일(그림 틀 · 키 하나)이 끝날 때마다
 * 마이크로태스크를 비우는데, 이 판은 걸음 수십만 개를 await 없이 한 덩이로 돌아 진짜 마이크로태스크가 판 내내 안 돈다.
 * 그러면 그 일이 쥔 것이 판 내내 남는다 — 앞 화면 판(`leftFrame` 의 `leaveFrame` 은 마이크로태스크 하나가 지나면 맡긴 판을
 * 잊는데, 안 지나 내려간 화면 판 DOM 이 몽땅 쌓여 긴 판이 기본 힙 4GB 를 넘겼다, r336). 약속(Promise) 차례는 그대로 둔다
 * (이벤트 본문 받기 따위는 지금처럼 판의 await 에서 돈다)
 */
let queuedMicrotasks: VoidFunction[] = []

function runQueuedMicrotasks() {
  while (queuedMicrotasks.length > 0) {
    const pending = queuedMicrotasks
    queuedMicrotasks = []
    for (const callback of pending) callback()
  }
}

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

function memoryJson(initial: unknown = null): JsonStorePort & { readonly held: () => unknown } {
  let held: unknown = initial
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
    held: () => held,
  }
}

function memoryMissionRecord(): MissionRecordPort {
  let counts: MissionClearCounts = {}
  return {
    load: () => counts,
    save: (next) => {
      counts = next
    },
  }
}

/** 정책 난수 — 세션 난수와 따로 굴린다(사람 손가락 자리) */
function policyRandom(seed: number) {
  let state = (seed * 2654435761) >>> 0
  return () => {
    state = (state * 1103515245 + 12345) >>> 0
    return state / 0x100000000
  }
}

/** 도루할 루 — 앞 루가 빈 가장 앞 주자 (없으면 null) */
function stealBaseOf(bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean }): 1 | 2 | 3 | null {
  if (bases.third) return null
  if (bases.second) return 2
  if (bases.first) return 1
  return null
}

interface CareerSoakResult {
  readonly problems: SoakProblems
  readonly steps: number
  /** 돌린 그림 틀 수 */
  readonly frames: number
  readonly games: { 정규: number; 포스트시즌: number; 국가대항전: number; 대결: number }
  readonly seasons: number
  readonly endingIndex: number | null
  readonly stoppedAt: string | null
  readonly log: readonly string[]
  /** 새 길을 실제로 밟은 횟수 */
  readonly paths: Readonly<Record<string, number>>
  /** G 장부 — 출처별 합 */
  readonly ledger: Readonly<Record<string, number>>
  /** 재생한 이벤트 번호마다 거친 횟수(선택지로 이어 본 것 포함) — 한 번도 안 걸리는 이벤트 찾기 (r253 — `StoryScreen` 이 알린 본 이벤트로 센다) */
  readonly eventsViewed: Readonly<Record<number, number>>
}

interface CareerSoakOptions {
  readonly seed: number
  /** 이만큼 정규 경기를 치르면 멈춘다 (짧은 판) — 없으면 엔딩까지 */
  readonly maxRegularGames?: number
  /** 저장 왕복을 몇 번째 관리 화면마다 볼지 */
  readonly roundTripEvery?: number
  /** 새 길 정책(도루 · 상점 · 장비 · GP · 복권 · 외출 · 엔딩 이어하기 · 명전 등록) */
  readonly extras?: boolean
  /** 이 걸음 수마다 훅을 내리고 같은 저장으로 새로 띄워 이어 간다 — 없거나 0 이면 안 한다 */
  readonly resumeEvery?: number
  /** 지갑 첫 G */
  readonly startGamePoint?: number
  /**
   * 첫 커리어를 이 값으로 고친 저장에서 [이어하기]로 시작한다(원본에 있는 꼴 — 그 연차 첫날 · 범위 안 인기도 · 부상 경기 수).
   * 짧은 판이 엔딩 이어하기 길(부상 0 · 방출 1)을 몇 초 안에 밟게 한다
   */
  readonly startPatch?: Partial<Pick<PlayerCareer, 'season' | 'popularity' | 'injuredGamesPlayed' | 'isInjured' | 'injuryRemaining' | 'seenEventIds'>>
  /** 이어할 수 있는 엔딩을 만날 때마다 이어한다(5000 G 가 있으면) — 없으면 새 길에서 한 번만 */
  readonly continueEndings?: boolean
  /** 이만큼 엔딩을 이어하면 멈춘다 */
  readonly stopAfterContinues?: number
}

/** 끊어 볼 화면 — 차례로 돈다. 엔딩 · 메인 메뉴 · 마선수 대결(미션 장면 — 나가면 결과 이벤트가 105 진입에서 뜬다)은 뺀다 */
const RESUMABLE_SCREENS: readonly Screen['kind'][] = [
  '관리',
  '경기',
  '이벤트',
  '경기결과',
  '다음경기순위',
  '경기준비',
  '외출',
  '포스트시즌',
  '국가대항전',
  '연차표지',
  '대회경기결과',
]

/** 앱의 화면을 띄워 그림 틀 · 키로 치는 화면 */
const FRAME_SCREENS: ReadonlySet<Screen['kind']> = new Set(['경기', '경기결과', '경기평가', '대회경기결과', '이벤트', '마선수대결'])

/** 이어하기 앞뒤로 같아야 하는 커리어 칸 — 이어하기 진입(장면 셋업 · 116 재진입)이 고치는 칸(본 이벤트 · 외출 수 · 카운터)은 뺀다 */
const RESUME_STABLE_KEYS = [
  'season',
  'gamesPlayed',
  'money',
  'salary',
  'ability',
  'equipmentLevels',
  'ownedEquipment',
  'subItemIds',
  'stats',
  'careerStats',
  'league',
  'leaguePlayerStats',
  'titleIds',
  'teamId',
  'postseason',
  'nationalCup',
  'endingIndex',
] as const

/** 한 틀 안에 변화가 없으면 OK 를 누르기까지 기다리는 틀 · 멈춤으로 보는 틀 */
const IDLE_OK_FRAMES = 24
const STUCK_FRAMES = 6_000

async function runCareerSoak(options: CareerSoakOptions): Promise<CareerSoakResult> {
  const {
    seed,
    maxRegularGames,
    roundTripEvery = 5,
    extras = false,
    resumeEvery = 0,
    startGamePoint,
    startPatch,
    continueEndings = false,
    stopAfterContinues,
  } = options
  const saveGame = memorySave()
  const walletStore = memoryJson(startGamePoint === undefined ? null : { gamePoint: startGamePoint })
  const modeStore = memoryJson()
  const collectionStore = memoryJson()
  const settingsStore = memoryJson()
  const missionRecord = memoryMissionRecord()
  const random = createSeededRandom(seed)
  const policy = policyRandom(seed)

  /* ── G 전체 장부 — 처음 G + 기록연감 G획득 − G사용 − GP 아이템 + 미션 보상 − 명전 등록 (한 줄마다 0..99999 로 자른다) ── */
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

  /** 지금 띄운 훅 · 화면 묶음 (그림마다 새로 적는다) */
  const holder: { current: HarnessBundle | null } = { current: null }
  /** 이벤트 마선수 대결 시작 — 화면(`StoryScreen.onMatch`)이 부른다. 앱 `startAceMatch` 그대로 */
  const startAceMatchRef: { current: (command: MatchCommand, carried: StoryCarry, context: StoryContext) => void } = {
    current: () => {},
  }
  /** 이벤트 재생 끝 — 본 이벤트를 MVP 검사에 넘긴다 */
  const sceneDoneRef: { current: (viewed: readonly number[]) => void } = { current: () => {} }
  /** 공 결과 갈래 수 — 타석 화면이 낸 판정(휘두른 공의 패턴 덱까지) */
  const pitchOutcomes: Record<string, number> = {}
  const heldPlays = { 타구판: 0, 주자판: 0, 벤치클리어링: 0, 돌발결과: 0, 공: 0, 견제: 0, 도루: 0, 보상명령: 0 }

  type Session = ReturnType<typeof useCareerSession>
  interface HarnessBundle {
    readonly screen: Screen
    readonly setScreen: (screen: Screen) => void
    readonly runner: ReturnType<typeof useAtBatRunner>
    readonly wallet: ReturnType<typeof useGamePointWallet>
    readonly modeSave: ReturnType<typeof useModeSave>
    readonly session: Session
    readonly collection: ReturnType<typeof useCollection>
    readonly mission: ReturnType<typeof useMissionSession>
    readonly gameSettings: ReturnType<typeof useGameSettings>
  }

  /**
   * **마선수 대결 대조 (r264)** — SYS 8(0x8d782~0x8d7ce) 에서 연 대결이 결과 판을 닫으면(0x407f0 → 0x4b100 → 0x106 → 105 진입
   * 0x11b46 → 140 0x10df8) 결과 이벤트 · 대기 칸 · G · 클리어 칸이 원본대로인지 본다.
   */
  const aceWatch: {
    opened: {
      readonly team: number
      readonly resultEvents: readonly number[]
      readonly gamePoint: number
      readonly counts: MissionClearCounts
    } | null
    finished: { readonly isWin: boolean } | null
  } = { opened: null, finished: null }
  /** 대결 화면에 넘기는 미션 세션 — 결과 판을 닫는 `finishAceMatch` 때의 이겼나를 적는다 */
  const observedMission = (mission: ReturnType<typeof useMissionSession>): ReturnType<typeof useMissionSession> => ({
    ...mission,
    actions: {
      ...mission.actions,
      finishAceMatch: () => {
        const status = mission.missionRun?.status
        if (status === '성공' || status === '실패') aceWatch.finished = { isWin: status === '성공' }
        return mission.actions.finishAceMatch()
      },
    },
  })

  /** 화면에 넘기는 세션 — 액션을 감싸 판 · 보상 명령을 센다(부르는 길은 그대로) */
  const observedSession = (session: Session): Session => ({
    ...session,
    handlePitchResolved: (...args: Parameters<Session['handlePitchResolved']>) => {
      heldPlays.공 += 1
      const [detail] = args
      const kind = detail.resolution.kind === '스트라이크' && detail.resolution.isSwinging ? '헛스윙' : detail.resolution.kind
      pitchOutcomes[kind] = (pitchOutcomes[kind] ?? 0) + 1
      return session.handlePitchResolved(...args)
    },
    actions: {
      ...session.actions,
      finishDefensePlay: (...args: Parameters<Session['actions']['finishDefensePlay']>) => {
        heldPlays.타구판 += 1
        return session.actions.finishDefensePlay(...args)
      },
      finishRunnerPlay: (...args: Parameters<Session['actions']['finishRunnerPlay']>) => {
        heldPlays.주자판 += 1
        return session.actions.finishRunnerPlay(...args)
      },
      finishBenchClearing: (...args: Parameters<Session['actions']['finishBenchClearing']>) => {
        heldPlays.벤치클리어링 += 1
        return session.actions.finishBenchClearing(...args)
      },
      closeBurstResult: (...args: Parameters<Session['actions']['closeBurstResult']>) => {
        heldPlays.돌발결과 += 1
        return session.actions.closeBurstResult(...args)
      },
      cpuPickoff: (...args: Parameters<Session['actions']['cpuPickoff']>) => {
        heldPlays.견제 += 1
        return session.actions.cpuPickoff(...args)
      },
      stealBase: (...args: Parameters<Session['actions']['stealBase']>) => {
        heldPlays.도루 += 1
        return session.actions.stealBase(...args)
      },
      giveEventReward: (...args: Parameters<Session['actions']['giveEventReward']>) => {
        heldPlays.보상명령 += 1
        return session.actions.giveEventReward(...args)
      },
      completeScene: (...args: Parameters<Session['actions']['completeScene']>) => {
        sceneDoneRef.current(args[1] ?? [])
        return session.actions.completeScene(...args)
      },
    },
  })

  function HarnessScreens({ bundle }: { readonly bundle: HarnessBundle }): ReactNode {
    const { screen, setScreen, runner, session, collection, mission, gameSettings, wallet } = bundle
    const career = session.career
    if (screen.kind === '마선수대결') {
      const missionBatter = session.career ?? session.savedCareer
      return (
        <MissionRoutes
          screen={screen}
          setScreen={setScreen}
          session={observedMission(mission)}
          runner={runner}
          random={random}
          batter={modeBatterOf(missionBatter)}
          hallOfFame={collection.collection}
          nari={{ 투수: null, 타자: nariBatterOf(missionBatter) }}
          pitchControl={gameSettings.settings.pitchControl}
          gameSettings={gameSettings}
          gamePoint={wallet.balance}
        />
      )
    }
    if (!FRAME_SCREENS.has(screen.kind) || career === null) return null
    // 경기 진행이 아직 없으면(로딩 전) 관리 화면을 그리는 갈래라 띄우지 않는다
    if (screen.kind === '경기' && session.progress === null) return null
    return (
      <CareerRoutes
        screen={screen}
        setScreen={setScreen}
        session={observedSession(session)}
        runner={runner}
        random={random}
        career={career}
        hallOfFame={{ collection: collection.collection, nariPitcher: null, register: () => '취소' as never, gamePoint: wallet.balance }}
        onAceMatch={(command, carried, context) => startAceMatchRef.current(command, carried, context)}
        gameSettings={gameSettings}
      />
    )
  }

  /** 앱(`App`)처럼 세션들을 한 그림에 — 같은 화면 상태 · 같은 난수 · 같은 타석 진행기 */
  function Harness(): ReactNode {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    const wallet = useGamePointWallet(walletStore)
    const modeSave = useModeSave(modeStore)
    const gameSettings = useGameSettings(settingsStore)
    const nariGameSave: NariGameSavePort = {
      start: (match) => modeSave.startNariGame(NARI_BATTER_MODE, match),
      clear: () => modeSave.clearNariGame(NARI_BATTER_MODE),
    }
    const session = useCareerSession({
      runner,
      random,
      saveGame,
      screen,
      setScreen,
      wallet,
      nariGameSave,
      recordStat,
      runningModeManual: gameSettings.settings.runningMode === '수동',
      aceMatchPending: modeSave.aceMatchPendingPorts[NARI_BATTER_MODE],
    })
    const collection = useCollection(collectionStore, session.career)
    const missionBatterCareer = session.career ?? session.savedCareer
    const missionBatterRecordSlot =
      missionBatterCareer === null ? -1 : myBatterIndexOf(nariTeamRecordOf(nariTeamsOf(missionBatterCareer), missionBatterCareer.teamId))
    const mission = useMissionSession({
      runner,
      random,
      missionRecord,
      screen,
      setScreen,
      onGamePointReward: (amount: number) => {
        ledger.add('미션보상', amount)
        session.actions.gainGamePoint(amount)
      },
      recordStat,
      throwModeManual: gameSettings.settings.throwMode === '수동',
      runningModeManual: gameSettings.settings.runningMode === '수동',
      isVibrationOn: gameSettings.settings.isVibrationOn,
      batterRunAbility: modeBatterOf(missionBatterCareer).ability.run,
      ...(missionBatterCareer === null ? {} : { batterSkillIds: missionBatterCareer.equippedSkillIds }),
      nariTeamIds: missionBatterCareer === null ? {} : { batter: missionBatterCareer.teamId },
      ...(missionBatterRecordSlot < 0 ? {} : { nariBatterRecordSlot: missionBatterRecordSlot }),
      aceMatchHold: modeSave.aceMatchHoldPort,
      onReturnToNari: () => {
        if (session.savedCareer !== null) session.actions.continueSaved()
      },
    })
    const bundle: HarnessBundle = { screen, setScreen, runner, wallet, modeSave, session, collection, mission, gameSettings }
    holder.current = bundle
    return <HarnessScreens bundle={bundle} />
  }

  let rendered = render(<Harness />)
  /** 지금 띄운 훅 — 이어하기가 훅을 새로 띄워도 같은 이름으로 읽는다 */
  const result = {
    get current(): HarnessBundle {
      return holder.current!
    },
  }
  ledger.balance = result.current.wallet.balance
  const problems = new SoakProblems()
  const games = { 정규: 0, 포스트시즌: 0, 국가대항전: 0, 대결: 0 }
  const paths: Record<string, number> = {}
  const eventsViewed: Record<number, number> = {}
  const walked = (path: string) => {
    paths[path] = (paths[path] ?? 0) + 1
  }
  const log: string[] = []
  /**
   * 끝낸 MVP 발표(375) · 결과(376/377) 장면 수 — (시즌 · 포스트시즌 자리)마다. 원본은 정규시즌 끝에 한 번, 그리고 **내 시리즈가
   * 끝난 경기마다** 116 끝(0x12b74)이 L+0x32 == 0 을 보고 136 부터 사슬을 다시 돌아 375 → 376/377 이 보상째 또 나온다
   * (0xb7724 b777a L+0x32 = −1 → 하루 끝 0xb818c +1 → 0). 그래서 한 해 두 번 이상은 원본이고, **같은 자리에서 두 번**만 문제다
   */
  const mvpScenes = new Map<string, number>()
  let steps = 0
  let frames = 0
  let trainingSlot = 0
  let managementVisits = 0
  let gpSlot = 0
  let stoppedAt: string | null = null
  let started = false
  let endingIndex: number | null = null
  let firstSeason = 1
  let continuedAfterEnding = 0
  let lastCutStep = 0
  let resumeTarget = 0
  let lastSeenSeason = 1
  /** 이 경기를 시작할 때의 커리어 — 결과 화면에서 누계 증가분을 본다 */
  let beforeGame: { career: PlayerCareer; kind: '정규' | '포스트시즌' | '국가대항전' } | null = null
  let checkedSummary: unknown = null
  /**
   * 이 경기에서 화면(수비 판 · 재생 판 — `DefensePlayback` 의 0x43278 +0x2e)이 그려 올린 실책(마타자 칸 뺌 — 요약과 같은 거르기). 정산 요약의
   * 실책과 같아야 한다 (r248 — 경기를 끝낸 재생 판의 실책도 정산 앞에 든다). 진행의 실책 칸이 늘어난 만큼을 틀마다 모은다
   */
  let drawnErrorsThisGame: unknown[] = []
  let seenErrors: { progress: unknown; count: number } = { progress: null, count: 0 }
  const collectDrawnErrors = () => {
    const progress = result.current.session.progress
    if (progress === null) return
    const errors = progress.leagueErrors ?? []
    if (seenErrors.progress === null || errors.length < seenErrors.count) seenErrors = { progress, count: 0 }
    const added = errors.slice(seenErrors.count)
    drawnErrorsThisGame.push(...added.filter((error) => error.battingOrderIndex !== ACE_BATTER_ROSTER_SLOT))
    seenErrors = { progress, count: errors.length }
  }
  /** 끝난 대결 — 같은 판을 두 번 안 센다 */
  let countedAceRun: unknown = null

  const where = () => {
    const career = result.current.session.career
    return (
      `씨앗 ${seed} · ${career === null ? '-' : `${career.season}년차 g${career.gamesPlayed}${career.postseason !== null ? '(PS)' : ''}`}` +
      ` · 화면 ${result.current.screen.kind} · 걸음 ${steps}`
    )
  }

  /** 이벤트 화면이 알린 본 이벤트를 센다 — 이어 온(대결 결과) 이벤트가 들고 온 앞 이벤트는 이미 셌으므로 뺀다 */
  const countViewed = (viewedIds: readonly number[]) => {
    const screen = result.current.screen
    const carried = screen.kind === '이벤트' ? (screen.carried?.viewedEventIds ?? []) : []
    const ids = new Set(viewedIds)
    if (screen.kind === '이벤트') ids.add(screen.eventId)
    for (const id of ids) if (!carried.includes(id)) eventsViewed[id] = (eventsViewed[id] ?? 0) + 1
  }
  sceneDoneRef.current = (viewedIds) => {
    countViewed(viewedIds)
    const career = result.current.session.career
    for (const id of viewedIds.filter((viewedId) => MVP_EVENT_IDS.includes(viewedId))) {
      const series = career?.postseason
      const spot = series === null || series === undefined ? '정규' : `${series.round}:${series.teams.join(',')}:${series.wins.join(',')}`
      const mvpKey = `${career?.season}:${spot}:${id}`
      const count = (mvpScenes.get(mvpKey) ?? 0) + 1
      mvpScenes.set(mvpKey, count)
      if (count > 1) problems.add(where(), [`${career?.season}년차 ${spot} 자리에서 MVP 이벤트 ${id} 를 ${count}번째 끝냈다`])
      if (id === 375) log.push(`${career?.season}년차 MVP 발표(${spot})`)
    }
  }

  /** 앱 `startAceMatch` 그대로 — 화면 콜백 안에서 불리므로 act 를 따로 걸지 않는다 */
  startAceMatchRef.current = (command, carried, context) => {
    const { session, mission, setScreen } = result.current
    countViewed(carried.viewedEventIds)
    walked('마선수대결')
    if (context === '장소') session.actions.settlePlaceForAceMatch()
    const target = aceMatchMissionOf(command.team)
    if (target === null) {
      setScreen({ kind: '이벤트', eventId: matchResultEventOf(command.resultEvents, false), context: '대결결과', carried })
      return
    }
    session.actions.holdAceMatch(command.resultEvents, carried.viewedEventIds)
    aceWatch.opened = {
      team: command.team,
      resultEvents: command.resultEvents,
      gamePoint: result.current.wallet.balance,
      counts: missionRecord.load(),
    }
    aceWatch.finished = null
    mission.actions.beginAceMatch(target, { resultEvents: command.resultEvents, context: '대결결과', carried })
  }

  /**
   * 대결을 마친 뒤의 결과 이벤트 — 140 진입 0x10df8: 결과 바이트 g[0x144](= [미션+0xbc] 성공 여부, 0x4ea0c 4efc6)로
   * resultEvents[이김 ? 0 : 1] 을 틀고 대기 칸(g[0x11f] …)을 지운다. 정산 0x4ef3e 는 g[0x11f] 로 G 를 건너뛰고, 0xa5368 은
   * +0xbd = team − 1 ≤ 15(team 16)일 때만 타자 15번 칸을 −1 에서 하나 올린다.
   */
  const checkAceMatchResult = () => {
    const { opened, finished } = aceWatch
    if (opened === null || finished === null) return
    const { screen, modeSave, wallet } = result.current
    if (screen.kind !== '이벤트' || screen.context !== '대결결과') return
    aceWatch.opened = null
    aceWatch.finished = null
    walked(finished.isWin ? '대결이김' : '대결짐')
    const at = where()
    const lines: string[] = []
    const expectedEvent = matchResultEventOf(opened.resultEvents, finished.isWin)
    if (screen.eventId !== expectedEvent) lines.push(`결과 이벤트 ${screen.eventId} ≠ ${expectedEvent}`)
    if (modeSave.aceMatchPendingPorts[NARI_BATTER_MODE].read() !== null) lines.push('140 뒤에도 타자편 대기가 남았다')
    if (wallet.balance !== opened.gamePoint) lines.push(`대결 G ${opened.gamePoint} → ${wallet.balance} (0x4ef3e 는 건너뛴다)`)
    const target = aceMatchMissionOf(opened.team)
    const key = target === null ? null : aceMatchClearKeyOf(target)
    const expectedCounts =
      finished.isWin && key !== null ? { ...opened.counts, [key]: aceMatchClearCountAfterWin(opened.counts[key]) } : opened.counts
    const firstDiff = firstDiffOf(expectedCounts, missionRecord.load())
    if (firstDiff !== null) lines.push(`클리어 칸 ${firstDiff}`)
    problems.add(
      at,
      lines.map((line) => `마선수 대결 team ${opened.team}: ${line}`),
    )
    if (process.env.SOAK_DEBUG === '1')
      process.stderr.write(`[대결 대조] team ${opened.team} ${finished.isWin ? '이김' : '짐'} 문제 ${lines.length}\n`)
  }

  let lastCheckedCareer: PlayerCareer | null = null
  const checkCareer = () => {
    const career = result.current.session.career
    if (career === null || career === lastCheckedCareer) return
    lastCheckedCareer = career
    const at = where()
    problems.add(at, unserializablePathsOf(career, 'career').slice(0, 5))
    problems.add(
      at,
      outOfRangeOf(
        'career',
        {
          gamePoint: career.gamePoint,
          season: career.season,
          gamesPlayed: career.gamesPlayed,
          popularity: career.popularity,
          reputation: career.reputation,
          money: career.money,
          salary: career.salary,
          outingsThisSeason: career.outingsThisSeason,
          injuryRemaining: career.injuryRemaining,
          illnessRemaining: career.illnessRemaining,
          illnessCooldown: career.illnessCooldown,
          eagleEyeGamesRemaining: career.eagleEyeGamesRemaining,
          battingOrder: career.battingOrder,
        },
        0,
      ),
    )
    problems.add(at, outOfRangeOf('career.morale', { morale: career.morale }, 0, 100))
    problems.add(at, outOfRangeOf('career.ability', { ...career.ability }, 0, 999))
    problems.add(at, batterLineProblemsOf('career.stats', career.stats))
    problems.add(at, batterLineProblemsOf('career.careerStats', career.careerStats))
    problems.add(
      at,
      outOfRangeOf(
        'career.stats',
        {
          games: career.stats.games,
          plateAppearances: career.stats.plateAppearances,
          walks: career.stats.walks,
          strikeouts: career.stats.strikeouts,
        },
        0,
      ),
    )
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
    // 장비 — 낀 장비(니블 1~11)는 가진 장비이고, 장비 능력치 = 능력치 + 레벨 보너스(스킬 보정이 없을 때)
    for (const part of EQUIPMENT_PARTS) {
      const nibble = career.equipmentLevels[part.ability]
      problems.add(at, outOfRangeOf('career.equipmentLevels', { [part.ability]: nibble }, 0, EQUIPMENT_LEVEL_COUNT))
      if (nibble > 0 && !ownsEquipment(career, part.index, nibble - 1)) problems.add(at, [`안 가진 장비를 꼈다: ${part.name} 레벨 ${nibble - 1}`])
    }
    if (career.equippedSkillIds.length === 0) {
      const equipped = equippedAbilityOf(career)
      for (const part of EQUIPMENT_PARTS) {
        const expected = Math.min(999, career.ability[part.ability] + equipmentBonusOf(career.equipmentLevels[part.ability]))
        if (equipped[part.ability] !== expected)
          problems.add(at, [`장비 능력치 ${part.ability} ${equipped[part.ability]} ≠ 능력치 + 보너스 ${expected}`])
      }
    }
    // G 는 지갑 한 칸 — 커리어 칸은 그림자다(지갑 다리가 맞춘다)
    if (career.gamePoint !== result.current.wallet.balance) problems.add(at, [`커리어 G ${career.gamePoint} ≠ 지갑 ${result.current.wallet.balance}`])
    for (const owned of career.ownedEquipment) {
      const [part, level] = owned.split('-').map(Number)
      if (part === undefined || level === undefined || part < 0 || part > 3 || level < 0 || level >= EQUIPMENT_LEVEL_COUNT) {
        problems.add(at, [`가진 장비 열쇠가 이상하다: ${owned}`])
      }
    }
    if (new Set(career.ownedEquipment).size !== career.ownedEquipment.length) problems.add(at, ['가진 장비가 겹친다'])
    if (new Set(career.subItemIds).size !== career.subItemIds.length) problems.add(at, ['서브 아이템이 겹친다'])
  }

  /** G 장부 = 지갑 — 어긋나면 그 걸음을 적고 장부를 지갑에 맞춘다(같은 어긋남이 걸음마다 쌓이지 않게) */
  const checkLedger = () => {
    const balance = result.current.wallet.balance
    if (ledger.balance !== null && ledger.balance !== balance) {
      problems.add(where(), [`G 장부 ${ledger.balance} ≠ 지갑 ${balance} (차이 ${balance - ledger.balance})`])
      ledger.balance = balance
    }
  }

  /** 경기 진행 값 — 도루 · 견제 뒤 아웃 · 루 · 점수 */
  let lastCheckedProgress: unknown = null
  const checkProgress = () => {
    const progress = result.current.session.progress
    if (progress === null || progress === lastCheckedProgress) return
    lastCheckedProgress = progress
    const { game } = progress
    problems.add(where(), outOfRangeOf('progress.game', { outs: game.outs, ourScore: game.ourScore, opponentScore: game.opponentScore }, 0))
    // 아웃은 3 까지 — 다만 9회 이후 말 공격 내 타석 앞의 끝내기 판 0xc22b4 는 `아웃 + 주자 = t` 를 n = rand(d, t + 1) 로 다시 나눠
    // st[6] = max(0, t − n) 을 그대로 쓴다(0xc2318~0xc232e, 직접 떴다 — 위 넘침 검사 없음). 2아웃 주자 둘 · 동점에서 n = 0 이면 아웃 4,
    // 만루면 5 다 — 원본 버그 그대로(`withAutoStopLateInningSetup`). 그 판에서만 5 까지 둔다
    const lateInningSetupOuts = game.inning >= 9 && game.half === '말' ? 5 : 3
    if (game.outs > lateInningSetupOuts) problems.add(where(), [`progress: 아웃 ${game.outs} > ${lateInningSetupOuts}`])
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

  /** 앱을 다시 켠 꼴 — 그림을 내리고 장면 칸(모듈 상태)을 비운 뒤 같은 저장소로 새로 띄운다 */
  const remount = () => {
    rendered.unmount()
    resetStageStores()
    rendered = render(<Harness />)
  }

  /**
   * **끊고 이어 가기** — 훅을 내리고(앱을 끈다) 같은 저장소로 새로 띄워, 메인 메뉴의 길로 들어간다: 경기 중간 저장(+0x4c)이
   * 서 있으면 [14] 곧장 경기(`resumeInterruptedGame`), 아니면 [이어하기](`continueSaved`). 이어하기 앞뒤 커리어의 안 바뀌어야 할
   * 칸이 같은지 본다
   */
  const cutAndResume = () => {
    const before = saveGame.held()
    if (before === null) return
    const fromScreen = result.current.screen.kind
    const balance = result.current.wallet.balance
    remount()
    const { session, modeSave } = result.current
    if (result.current.wallet.balance !== balance) problems.add(where(), [`다시 띄운 G ${result.current.wallet.balance} ≠ 내리기 전 ${balance}`])
    const inProgress = modeSave.save.nariGames[NARI_BATTER_MODE].isInProgress
    if (inProgress) {
      walked('이어하기:경기')
      act(() => session.actions.resumeInterruptedGame(nariGameMatchOfSave(modeSave.save.nariGames[NARI_BATTER_MODE].match)))
    } else {
      walked(`이어하기:${fromScreen}`)
      act(() => session.actions.continueSaved())
    }
    const after = result.current.session.career
    if (after === null) {
      problems.add(where(), [`이어하기(${fromScreen}) 뒤 커리어가 없다`])
      return
    }
    const pick = (career: PlayerCareer) => Object.fromEntries(RESUME_STABLE_KEYS.map((key) => [key, career[key]]))
    const d = firstDiffOf(pick(before), pick(after), `이어하기(${fromScreen}${inProgress ? ' · 경기 중' : ''})`)
    if (d !== null) problems.add(where(), [d])
  }

  /* ── 그림 틀 화면 — 사람 손가락 ─────────────────────────────────────────────────────────────────── */

  /** 지금 공이 나기 시작한 틱(상태 0x11 진입) — 같은 공에 한 번만 고른다 */
  let flightSeenAt = -1
  /** 마지막으로 본 놓은 공 — 새 공이면 휘두를지 고른다 */
  let releasedPitch: unknown = null
  let swingAtTick = -1
  let stealAt: { readonly tick: number; readonly key: string } | null = null
  let confirmSeenAt = -1
  let okAtFrame = -1
  let idleFrames = 0
  let lastSignature = ''

  /** 그림 틀 화면의 겉보기 — 바뀌지 않으면 사람이 OK 를 누른다 */
  const signatureOf = (tickEntry: ReturnType<typeof sceneStateEntryAt>) => {
    const { screen, session, runner, mission } = result.current
    const progress = session.progress
    const run = mission.missionRun
    return (
      `${screen.kind}:${screen.kind === '이벤트' ? screen.eventId : ''}:${progress?.game.inning}:${progress?.game.half}:${progress?.game.outs}` +
      `:${progress?.game.ourScore}:${progress?.game.opponentScore}:${runner.atBat.balls}:${runner.atBat.strikes}:${runner.isPaused}` +
      `:${progress?.pendingDefensePlay === null}:${progress?.pendingRunnerPlay == null}:${progress?.lastDefensePlay === null}` +
      `:${tickEntry?.state}:${tickEntry?.tick}:${run?.status}:${run?.outs}:${run?.game.inning}:${mission.halfInningBoard === null}` +
      `:${mission.loadingTip === null}:${session.loadingTip === null}:${session.career?.gamePoint}`
    )
  }

  /** 그림 틀 한 걸음 — 틀을 돌리고, 지금 보이는 자리에 맞춰 키를 누른다 */
  const frameStep = () => {
    frame()
    frames += 1
    const { screen, session, mission } = result.current
    const isPlaying = screen.kind === '경기' || screen.kind === '마선수대결'
    const tick = gameSceneTickNow()
    const entry = isPlaying ? sceneStateEntryAt(tick) : null
    if (isPlaying && entry !== null) {
      // 공이 손을 떠났다(놓기 0x4dc78 — 경로 칸이 새 공) — 사람이 보는 공 길이(frameCount)를 보고 휘두를지 · 언제 누를지 고른다.
      // 판정 틱의 공 프레임이 frameCount − 2 에 가까울수록 맞는다(`timingOf`) — 키 틱 = 보이는 프레임 + 1 이라 frameCount − 3 언저리
      const released = sceneBallPathPitch()
      if (entry.state === SCENE_STATE.투구 && released !== null && released !== releasedPitch) {
        releasedPitch = released
        swingAtTick =
          policy() < SWING_RATE ? tick + Math.max(0, released.frameCount - 3 + Math.floor(policy() * SWING_TICK_SPAN) - SWING_TICK_EARLY) : -1
      }
      // 공이 나기 시작했다(0x11) — 새 길이면 도루 키
      if (entry.state === SCENE_STATE.투구 && entry.tick !== flightSeenAt) {
        flightSeenAt = entry.tick
        stealAt = null
        if (extras) {
          const bases = screen.kind === '경기' ? session.progress?.game.bases : mission.missionRun?.bases
          const from = bases === undefined ? null : stealBaseOf(bases)
          if (from !== null && policy() < 0.2) stealAt = { tick: entry.tick + 1 + Math.floor(policy() * 3), key: STEAL_KEY_OF_BASE[from] }
        }
      }
      if (stealAt !== null && tick >= stealAt.tick) {
        const { key } = stealAt
        stealAt = null
        pressKey(key)
      }
      if (swingAtTick >= 0 && tick >= swingAtTick) {
        swingAtTick = -1
        pressKey('5')
      }
      // 0xe 확인 대기 — 몇 틱 뒤 OK
      if (entry.state === SCENE_STATE.확인 && entry.tick !== confirmSeenAt) {
        confirmSeenAt = entry.tick
        okAtFrame = frames + 2 + Math.floor(policy() * 8)
      }
    }
    const signature = signatureOf(entry)
    if (signature === lastSignature) idleFrames += 1
    else {
      idleFrames = 0
      lastSignature = signature
    }
    // 판 · 창 · 대사 — 겉보기가 한참 그대로면 OK (공이 나는 동안은 누르지 않는다 — OK 는 스윙 키다)
    const isFlying = entry?.state === SCENE_STATE.투구
    if (okAtFrame < 0 && idleFrames >= (isPlaying ? IDLE_OK_FRAMES : 4 + Math.floor(policy() * 8)) && !isFlying) {
      okAtFrame = frames
    }
    if (okAtFrame >= 0 && frames >= okAtFrame && !isFlying) {
      okAtFrame = -1
      idleFrames = 0
      pressKey('Enter')
    }
    if (screen.kind === '경기') collectDrawnErrors()
    if (idleFrames > STUCK_FRAMES) stoppedAt = `멈춤(그림 ${STUCK_FRAMES}틀 그대로): ${where()} · ${signature}`
    checkProgress()
  }

  /** 경기 결과 화면에 처음 들어선 틀 — 요약 → 누계 검사 */
  const checkGameResult = () => {
    const { screen, session } = result.current
    const career = session.career
    if (screen.kind !== '경기결과' && screen.kind !== '대회경기결과') return
    const summary = screen.summary
    if (checkedSummary === summary || beforeGame === null || career === null) return
    checkedSummary = summary
    games[beforeGame.kind] += 1
    const s = summary.stats
    problems.add(where(), batterLineProblemsOf('summary.stats', s))
    if (s.plateAppearances < s.atBats) problems.add(where(), [`경기 타석 ${s.plateAppearances} < 타수 ${s.atBats}`])
    problems.add(where(), outOfRangeOf('summary', { ourScore: summary.ourScore, opponentScore: summary.opponentScore }, 0))
    // 정산 실책 = 화면이 그린 실책 합 (r248)
    collectDrawnErrors()
    const settledErrors = JSON.stringify(summary.leagueErrors ?? [])
    if (settledErrors !== JSON.stringify(drawnErrorsThisGame)) {
      problems.add(where(), [`정산 실책 ${settledErrors} ≠ 그린 실책 ${JSON.stringify(drawnErrorsThisGame)}`])
    }
    drawnErrorsThisGame = []
    seenErrors = { progress: null, count: 0 }
    if (beforeGame.kind === '정규') {
      // 일정표 0xd89cb 대로 — 정규 경기 상대는 그날(g) 일정표 상대다
      const expected = nextOpponentOf(beforeGame.career)
      if (summary.opponentTeamId !== expected)
        problems.add(where(), [`g${beforeGame.career.gamesPlayed} 상대 ${summary.opponentTeamId} ≠ 일정표 ${expected}`])
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

  /** 마선수 대결이 끝난 틀 — 한 번 센다 */
  const countAceMatch = () => {
    const run = result.current.mission.missionRun
    if (run === null || run.status === '진행중' || countedAceRun === run.mission) return
    countedAceRun = run.mission
    games.대결 += 1
    log.push(`대결 ${run.mission.id} ${run.status}`)
  }

  /** 상점 한 바퀴 — 장비 · 끼기 · 서브 · GP (막힌 칸은 화면처럼 묻지 않는다). 사면 돈 · G 차이를 본다 */
  const shopRound = () => {
    const purchase = (
      label: string,
      itemId: string,
      expect: (before: PlayerCareer, after: PlayerCareer, gBefore: number, gAfter: number) => string[],
    ) => {
      const before = result.current.session.career
      if (before === null || purchaseQuestionOf(before, itemId) === null) return false
      const gBefore = result.current.wallet.balance
      act(() => result.current.session.actions.purchase(itemId))
      if (result.current.session.shopGpDetail !== null) act(() => result.current.session.actions.closeShopGpDetail())
      const after = result.current.session.career
      if (after === null) return false
      walked(label)
      problems.add(
        where(),
        expect(before, after, gBefore, result.current.wallet.balance).map((line) => `${label}: ${line}`),
      )
      return true
    }
    // 장비 — 부위마다 살 수 있는 가장 낮은 레벨 하나
    act(() => result.current.session.actions.openShop('장착'))
    for (const part of EQUIPMENT_PARTS) {
      const career = result.current.session.career!
      const level = Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, index) => index).find(
        (candidate) => equipmentBlockReasonOf(career, part.index, candidate) === null,
      )
      if (level === undefined) continue
      const item = equipmentItemOf(part.index, level)
      purchase('장비', shopItemId('장착', part.index, level), (before, after, gBefore, gAfter) => {
        const out: string[] = []
        if (before.money - after.money !== item.price) out.push(`소지금 ${before.money} → ${after.money} (값 ${item.price})`)
        if (gBefore !== gAfter) out.push(`G 가 바뀌었다 ${gBefore} → ${gAfter}`)
        if (after.equipmentLevels[part.ability] !== level + 1) out.push(`${part.name} 니블 ${after.equipmentLevels[part.ability]} ≠ ${level + 1}`)
        if (!ownsEquipment(after, part.index, level)) out.push('산 장비를 안 가졌다')
        const gain = equippedAbilityOf(after)[part.ability] - equippedAbilityOf(before)[part.ability]
        const bonus = equipmentBonusOf(level + 1) - equipmentBonusOf(before.equipmentLevels[part.ability])
        if (after.equippedSkillIds.length === 0 && equippedAbilityOf(before)[part.ability] + bonus <= 999 && gain !== bonus) {
          out.push(`장비 능력치 ${part.ability} 증가 ${gain} ≠ 보너스 차 ${bonus}`)
        }
        return out
      })
    }
    // 끼기 — 가진 장비 중 지금 것이 아닌 가장 낮은 레벨로 바꿔 낀다(121 장비착용)
    act(() => result.current.session.actions.openPlayerInfo('장비착용'))
    {
      const career = result.current.session.career!
      for (const part of EQUIPMENT_PARTS) {
        const now = career.equipmentLevels[part.ability]
        const level = Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, index) => index).find(
          (candidate) => candidate + 1 !== now && ownsEquipment(career, part.index, candidate),
        )
        if (level === undefined || policy() < 0.5) continue
        purchase('끼기', shopItemId('착용', part.index, level), (before, after, gBefore, gAfter) => {
          const out: string[] = []
          if (before.money !== after.money) out.push(`소지금이 바뀌었다 ${before.money} → ${after.money}`)
          if (gBefore !== gAfter) out.push(`G 가 바뀌었다 ${gBefore} → ${gAfter}`)
          if (after.equipmentLevels[part.ability] !== level + 1) out.push(`${part.name} 니블 ${after.equipmentLevels[part.ability]} ≠ ${level + 1}`)
          return out
        })
        break
      }
    }
    // 서브 아이템 — 막히지 않은 첫 칸
    act(() => result.current.session.actions.openShop('서브'))
    {
      const career = result.current.session.career!
      const index = SUB_ITEMS.findIndex((item) => subItemBlockReasonOf(career, item.id) === null)
      if (index >= 0) {
        purchase('서브', shopItemId('서브', index), (before, after) => {
          const out: string[] = []
          if (before.money - after.money !== SUB_ITEMS[index]!.price)
            out.push(`소지금 ${before.money} → ${after.money} (값 ${SUB_ITEMS[index]!.price})`)
          if (!after.subItemIds.includes(index)) out.push('산 서브 아이템이 없다')
          return out
        })
      }
    }
    // GP 아이템 — 칸 차례로 한 번에 하나 (5 복권 · 9 이글아이). 명전 등록 G 는 남긴다
    act(() => result.current.session.actions.openShop('GP'))
    for (let tries = 0; tries < BATTER_GP_ITEMS.length; tries += 1) {
      const index = gpSlot % BATTER_GP_ITEMS.length
      gpSlot += 1
      const price = BATTER_GP_ITEMS[index]!.price
      if (result.current.wallet.balance - price < HALL_OF_FAME_COST + CONTINUE_COST_GAME_POINT) continue
      const bought = purchase(index === 5 ? '복권' : `GP${index}`, shopItemId('GP', index), (before, after, gBefore, gAfter) => {
        const out: string[] = []
        if (gBefore - gAfter !== price) out.push(`G ${gBefore} → ${gAfter} (값 ${price})`)
        if (after.gamePoint !== gAfter) out.push(`커리어 G ${after.gamePoint} ≠ 지갑 ${gAfter}`)
        // 복권 상은 소지금 · 아이템이다 — 돈이 줄지 않는다. 그 밖 칸은 돈을 안 건드린다
        if (index === 5 ? after.money < before.money : after.money !== before.money) out.push(`소지금 ${before.money} → ${after.money}`)
        if (index === 5 && after.lotteryPurchases < before.lotteryPurchases) out.push('복권 구매 수가 줄었다')
        return out
      })
      if (bought) break
    }
    act(() => result.current.setScreen({ kind: '관리' }))
  }

  /** 외출 지도(112)에서 한 가지 — 아프면 병원, 사기 낮으면 외식, [!] 장소면 들어가기, 그 밖은 막히지 않은 첫 기능 */
  const outingStep = () => {
    const { session } = result.current
    const career = session.career
    if (career === null) return
    if (session.outingResult !== null) {
      act(() => session.actions.closeOutingResult())
      return
    }
    if (session.outingPresentation !== null) {
      const before = career
      act(() => session.actions.finishOutingPresentation())
      const after = result.current.session.career
      const fn = OUTING_PLACES.flatMap((place) => place.functions).find((candidate) => candidate.id === session.outingPresentation?.functionId)
      if (after !== null && fn !== undefined) {
        walked(`외출:${fn.id}`)
        const spent = before.money - after.money
        // 보험증서 · 할인 서브아이템이면 덜 낸다 — 더 내거나 돈이 늘면 안 된다
        if (spent < 0 || spent > fn.effect.moneyCost)
          problems.add(where(), [`외출 ${fn.id}: 소지금 ${before.money} → ${after.money} (값 ${fn.effect.moneyCost})`])
        if (after.gamePoint !== before.gamePoint) problems.add(where(), [`외출 ${fn.id}: G 가 바뀌었다`])
        if (!after.hasActedThisCycle) problems.add(where(), [`외출 ${fn.id}: 행동함이 안 섰다`])
      }
      return
    }
    if (session.outingNotice !== '') {
      act(() => session.actions.closeOutingNotice())
      act(() => result.current.session.actions.leaveOutingMap())
      return
    }
    const functions = OUTING_PLACES.flatMap((place) => place.functions)
    const pick = (id: string) => functions.find((candidate) => candidate.id === id && outingBlockReasonOf(career, candidate) === null)
    const sick =
      career.isInjured || career.isSick
        ? functions.find((candidate) => candidate.effect.healsInjury && outingBlockReasonOf(career, candidate) === null)
        : undefined
    const chosen = sick ?? (career.morale < 70 ? pick('외식') : undefined)
    const eventPlace = OUTING_PLACES.find((place) => session.eventPlaceIds.has(place.id))
    if (chosen === undefined && eventPlace !== undefined) {
      walked('외출:장소')
      act(() => session.actions.enterPlace(eventPlace))
      return
    }
    const fallback = chosen ?? functions.find((candidate) => outingBlockReasonOf(career, candidate) === null)
    if (fallback === undefined) {
      act(() => session.actions.leaveOutingMap())
      return
    }
    act(() => session.actions.runOutingFunction(fallback.id))
  }

  /** 엔딩 141 — 보너스 · 이어하기(부상 0 · 방출 1) · 명전 등록 */
  const endingStep = (screen: Extract<Screen, { kind: '엔딩' }>) => {
    log.push(`${result.current.session.career?.season}년차 엔딩 ${screen.endingIndex}`)
    const gBeforeBonus = result.current.wallet.balance
    const bonusReceived = result.current.session.career?.endingBonusReceived === true
    act(() => result.current.session.actions.receiveEndingBonus())
    if (!bonusReceived) {
      const expected = Math.min(GAME_POINT_LIMIT, gBeforeBonus + endingBonusOf(screen.endingIndex))
      if (result.current.wallet.balance !== expected)
        problems.add(where(), [`엔딩 ${screen.endingIndex} 보너스 G ${gBeforeBonus} → ${result.current.wallet.balance} ≠ ${expected}`])
    }
    const ended = result.current.session.career
    // 이어할 수 있는 엔딩(부상 · 방출)이면 5000 G 로 이어한다 (팝업 0x32 예 → 0x1bd36)
    const wantsContinue = continueEndings || (extras && continuedAfterEnding === 0)
    if (wantsContinue && ended !== null && isContinuableEnding(screen.endingIndex)) {
      const gBefore = result.current.wallet.balance
      const seasonBefore = ended.season
      let continued = false
      act(() => {
        continued = result.current.session.actions.continueAfterEnding()
      })
      if (continued) {
        continuedAfterEnding += 1
        walked(`엔딩이어하기${screen.endingIndex}`)
        if (gBefore - result.current.wallet.balance !== CONTINUE_COST_GAME_POINT)
          problems.add(where(), [`엔딩 이어하기 G ${gBefore} → ${result.current.wallet.balance}`])
        const after = result.current.session.career
        if (after === null || after.endingIndex !== null) problems.add(where(), [`엔딩 이어하기 뒤 엔딩 칸 ${after?.endingIndex}`])
        // 부상 엔딩은 부상만 풀고 같은 시즌, 방출 엔딩은 새 시즌(0x1bddc · 0x1b768)
        if (after !== null && screen.endingIndex === 0 && (after.isInjured || after.injuredGamesPlayed !== 0 || after.season !== seasonBefore)) {
          problems.add(where(), [
            `부상 엔딩 이어하기 뒤 부상 ${after.isInjured} · 부상 경기 ${after.injuredGamesPlayed} · ${seasonBefore} → ${after.season}년차`,
          ])
        }
        if (after !== null && screen.endingIndex === 1 && after.season !== seasonBefore + 1) {
          problems.add(where(), [`방출 엔딩 이어하기 뒤 연차 ${seasonBefore} → ${after.season}`])
        }
        // 방출(새 시즌 0x1b768)은 141 이 엔딩 판을 그리며 효과기 끝을 기다린 아홉 틀 뒤 137(1beb4~1beea) — 표지 뒤 105
        if (screen.endingIndex !== 0) {
          if (!result.current.session.isYearCoverHeld || result.current.screen.kind !== '엔딩') {
            problems.add(where(), [`방출 엔딩 이어하기 뒤 141 이 서 있지 않다 — ${result.current.screen.kind}`])
          }
          act(() => result.current.session.actions.enterHeldYearCover())
          if (result.current.screen.kind !== '연차표지') problems.add(where(), [`방출 엔딩 이어하기 뒤 화면 ${result.current.screen.kind}`])
          act(() => result.current.setScreen({ kind: '관리' }))
        }
        // 105 로 간다 — 그 진입이 곧바로 연 이벤트(연초 115 · 관리 훑기)면 이벤트다
        if (result.current.screen.kind !== '관리' && result.current.screen.kind !== '이벤트') {
          problems.add(where(), [`엔딩 이어하기 뒤 화면 ${result.current.screen.kind}`])
        }
        return
      }
      if (result.current.wallet.balance >= CONTINUE_COST_GAME_POINT)
        problems.add(where(), [`G ${result.current.wallet.balance} 인데 엔딩 ${screen.endingIndex} 을 이어하지 못했다`])
    }
    endingIndex = screen.endingIndex
    if (extras && ended !== null) {
      // 명예의 전당 등록 (145 목록 → 0x62cea): G −20000 · 칸 · 모드 저장 지우기 · 메인 메뉴
      const gBefore = result.current.wallet.balance
      const famersBefore = result.current.collection.collection.hallOfFame.length
      let outcome = ''
      act(() => {
        outcome = result.current.collection.register(ended, result.current.wallet, null)
        if (outcome === '등록') result.current.session.actions.eraseSaveForHallOfFame()
      })
      log.push(`명전 ${outcome}`)
      if (outcome === '등록') {
        ledger.add('명전등록', -HALL_OF_FAME_COST)
        walked('명전등록')
        const famers = result.current.collection.collection.hallOfFame
        const famer = famers[famers.length - 1]
        if (famers.length !== famersBefore + 1 || famer === undefined) problems.add(where(), ['명전 칸이 하나 늘지 않았다'])
        else {
          const d = firstDiffOf(
            {
              name: famer.name,
              endingIndex: famer.endingIndex,
              season: famer.season,
              ability: famer.ability,
              recordLine: famer.recordLine,
              equipmentLevels: famer.equipmentLevels,
            },
            {
              name: ended.name,
              endingIndex: screen.endingIndex,
              season: ended.season,
              ability: ended.ability,
              recordLine: batterRecordLineOf(ended.stats),
              equipmentLevels: ended.equipmentLevels,
            },
            '명전 기록',
          )
          if (d !== null) problems.add(where(), [d])
        }
        if (gBefore - result.current.wallet.balance !== HALL_OF_FAME_COST)
          problems.add(where(), [`명전 등록 G ${gBefore} → ${result.current.wallet.balance}`])
        if (saveGame.held() !== null) problems.add(where(), ['명전 등록 뒤 커리어 저장이 남았다'])
        act(() => result.current.session.actions.finishEnding(true))
        return
      }
    }
    act(() => result.current.session.actions.finishEnding(false))
  }

  const maxSteps = soakNumber('SOAK_MAX_STEPS', 4_000_000)
  let lastKey = ''
  let sameKeySteps = 0
  try {
    // 이벤트 본문(535KB)은 커리어가 선 뒤 따로 받는다 — 먼저 받아 두고 세션이 싣게 한다
    await import('@/shared/config/original/events')
    for (; steps < maxSteps; steps += 1) {
      // 앞 걸음(브라우저의 일 하나)이 건 마이크로태스크
      runQueuedMicrotasks()
      const { screen, session } = result.current
      const { actions } = session
      const career = session.career
      if (maxRegularGames !== undefined && games.정규 >= maxRegularGames && screen.kind === '관리') break
      if (stopAfterContinues !== undefined && continuedAfterEnding >= stopAfterContinues && screen.kind === '관리' && games.정규 > 0) break

      // 이벤트 본문이 아직이면(첫 커리어 직후 · 이어하기 직후) 한 틈 쉰다
      if (career !== null && session.storyEvents === null) {
        await act(async () => {
          await Promise.resolve()
        })
        continue
      }

      // 경기 결과 화면에 들어선 틀 — 끊기 전에 센다(경기 장면의 결과 판에서 끊으면 이어하기는 116 평가로 돌아와 요약이 없다, r287)
      if (career !== null && (screen.kind === '경기결과' || screen.kind === '대회경기결과')) checkGameResult()

      // 이어하기 — 몇 걸음마다 앱을 끄고 다시 켠다(엔딩 · 메인 메뉴 · 대결 중은 빼고)
      // 끊는 화면을 차례로 바꾼다(관리 · 경기 중 · 이벤트 · 경기 결과 …) — 그 화면이 한참 안 오면 아무 데서나 끊는다
      if (
        resumeEvery > 0 &&
        steps - lastCutStep >= resumeEvery &&
        career !== null &&
        RESUMABLE_SCREENS.includes(screen.kind) &&
        (screen.kind === RESUMABLE_SCREENS[resumeTarget % RESUMABLE_SCREENS.length] || steps - lastCutStep >= resumeEvery * 4)
      ) {
        lastCutStep = steps
        resumeTarget += 1
        cutAndResume()
        continue
      }
      if (career !== null) lastSeenSeason = Math.max(lastSeenSeason, career.season)

      if (FRAME_SCREENS.has(screen.kind) && career !== null) {
        frameStep()
        if (result.current.screen.kind === '마선수대결') countAceMatch()
        checkAceMatchResult()
        if (stoppedAt !== null) break
        checkCareer()
        checkLedger()
        continue
      }

      // 액션 화면 — 같은 자리를 30 걸음 넘게 돌면 멈춤
      const key =
        `${screen.kind}:${career?.season}:${career?.gamesPlayed}:${career?.postseason?.wins.join(',')}` +
        `:${screen.kind === '국가대항전' ? screen.cup.day : ''}:${session.managementNotice}:${session.managementDetail === null}` +
        `:${career?.hasActedThisCycle}:${session.pendingTitle}:${screen.kind === '포스트시즌' ? screen.popup?.kind : ''}` +
        `:${session.outingPresentation?.functionId}:${session.outingResult === null}:${session.outingNotice}`
      if (key === lastKey) sameKeySteps += 1
      else sameKeySteps = 0
      lastKey = key
      if (sameKeySteps > 30) {
        stoppedAt = `멈춤: ${where()}`
        break
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
          if (startPatch !== undefined) {
            // 고친 저장으로 메인 메뉴 [이어하기] — 앱을 다시 켠 꼴
            const created = saveGame.held()
            if (created !== null) saveGame.save({ ...created, ...startPatch })
            remount()
            act(() => result.current.session.actions.continueSaved())
          }
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
          if (extras && !career.hasActedThisCycle && managementVisits % 3 === 0) shopRound()
          const now = result.current.session.career!
          if (!now.hasActedThisCycle) {
            if (now.morale < 60 && !result.current.session.actions.isRestBlocked() && !(extras && policy() < 0.5)) {
              act(() => result.current.session.actions.runCommand('휴식'))
              break
            }
            // 외출 — 아프거나 사기가 낮거나 가끔 (외출 진입 이벤트 · 장소 [!] 이벤트 · 마선수 대결 길)
            if (extras && (now.isInjured || now.isSick || now.morale < 60 || managementVisits % 4 === 1 || policy() < 0.15)) {
              walked('외출')
              act(() => result.current.session.actions.runCommand('외출'))
              break
            }
            const menus = TRAINING_MENUS.slice(0, 4)
            const open = menus
              .map((_, offset) => menus[(trainingSlot + offset) % menus.length]!)
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
        case '외출':
          outingStep()
          break
        case '아이템':
          act(() => result.current.setScreen({ kind: '관리' }))
          break
        case '다음경기순위':
          act(() => actions.confirmNextGameStandings())
          break
        case '경기준비':
          if (career !== null) {
            drawnErrorsThisGame = []
            seenErrors = { progress: null, count: 0 }
            beforeGame = {
              career,
              kind: screen.cup !== undefined ? '국가대항전' : career.postseason !== null ? '포스트시즌' : '정규',
            }
          }
          act(() => actions.confirmMatchPrepare())
          break
        case '연차표지':
          log.push(
            `${career?.season}년차 표지(통산 ${career?.careerStats.atBats}타수 ${career?.careerStats.hits}안타 ${career?.careerStats.homeRuns}홈런)`,
          )
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
            // 134 가 대진판을 그리며 효과기 끝을 기다린 아홉 틀 뒤 137 (`YearCoverHoldLayer`)
            if (result.current.session.isYearCoverHeld) act(() => result.current.session.actions.enterHeldYearCover())
          }
          break
        }
        case '엔딩':
          endingStep(screen)
          break
        default:
          stoppedAt = `다룰 줄 모르는 화면: ${where()}`
      }
      if (stoppedAt !== null) break
      checkCareer()
      checkLedger()
    }
    if (steps === maxSteps && !started) stoppedAt = `걸음 한도 ${maxSteps}: ${where()}`
    if (steps >= maxSteps && endingIndex === null && maxRegularGames === undefined && stopAfterContinues === undefined) {
      stoppedAt ??= `걸음 한도 ${maxSteps}: ${where()}`
    }
  } catch (error) {
    stoppedAt = `예외: ${where()} — ${error instanceof Error ? `${error.message}\n${error.stack?.split('\n').slice(0, 6).join('\n')}` : String(error)}`
  } finally {
    rendered.unmount()
  }
  const lastSeason = Math.max(lastSeenSeason, saveGame.held()?.season ?? result.current.session.career?.season ?? firstSeason)
  log.push(`판 ${JSON.stringify(heldPlays)} · 공 ${JSON.stringify(pitchOutcomes)}`)
  return {
    problems,
    steps,
    frames,
    games,
    seasons: lastSeason - firstSeason + 1,
    endingIndex,
    stoppedAt,
    log,
    paths,
    ledger: ledgerSums,
    eventsViewed,
  }
}

function report(result: CareerSoakResult): string {
  return (
    `걸음 ${result.steps} · 틀 ${result.frames} · 경기 정규 ${result.games.정규} · PS ${result.games.포스트시즌} · 대회 ${result.games.국가대항전}` +
    ` · 대결 ${result.games.대결} · 시즌 ${result.seasons} · 엔딩 ${result.endingIndex} · [${result.log.join(' / ')}]` +
    ` · 길 ${JSON.stringify(result.paths)} · G 장부 ${JSON.stringify(result.ledger)} · 이벤트 ${JSON.stringify(result.eventsViewed)}` +
    `${result.stoppedAt === null ? '' : `\n멈춘 곳: ${result.stoppedAt}`}` +
    (result.problems.size === 0 ? '' : `\n문제 ${result.problems.size}가지:\n${result.problems.report()}`)
  )
}

describe('나리 타자편 장기 진행 점검 (soak)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    // 손으로 갈아 끼운다 — `vi.spyOn` 은 부른 기록을 다 들고 있어 긴 판(수백만 틀)에서 메모리가 넘친다
    originals = {
      now: performance.now,
      raf: window.requestAnimationFrame,
      caf: window.cancelAnimationFrame,
      queueMicrotask: globalThis.queueMicrotask,
    }
    globalThis.queueMicrotask = (callback) => void queuedMicrotasks.push(callback)
    performance.now = () => clock
    window.requestAnimationFrame = (callback) => {
      const handle = nextFrameHandle
      nextFrameHandle += 1
      frameCallbacks.set(handle, callback)
      return handle
    }
    window.cancelAnimationFrame = (handle) => void frameCallbacks.delete(handle)
    // 아무 일도 안 하는 붓 — 그라디언트 같은 돌려받는 붓 객체도
    const noopBrush = (target: object): object =>
      new Proxy(target, {
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
      runQueuedMicrotasks()
      globalThis.queueMicrotask = originals.queueMicrotask
      originals = null
    }
    vi.useRealTimers()
    frameCallbacks = new Map()
  })

  it('짧은 판 — 새 선수로 6경기를 타석 화면 그대로 쳐도 값이 맞고 저장 왕복 · G 장부가 같다', async () => {
    const result = await runCareerSoak({ seed: 2010, maxRegularGames: 6, roundTripEvery: 1 })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.정규, report(result)).toBe(6)
    // 공을 실제로 쳤다(타석 화면의 판정 — 휘두른 공의 패턴 덱)
    expect(
      result.log.some((line) => line.includes('"공":0')),
      report(result),
    ).toBe(false)
  }, 120_000)

  it('짧은 판(새 길) — 도루 · 상점 · 장비 · GP · 복권 · 외출 · 이어하기를 섞어 8경기를 치러도 값 · 수지가 맞는다', async () => {
    const result = await runCareerSoak({
      seed: 2011,
      maxRegularGames: 8,
      roundTripEvery: 2,
      extras: true,
      resumeEvery: 997,
      startGamePoint: 60_000,
    })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.정규, report(result)).toBe(8)
    // 새 길을 실제로 밟았다
    for (const path of ['장비', '외출']) expect(result.paths[path] ?? 0, `${path} — ${report(result)}`).toBeGreaterThan(0)
    expect(
      Object.keys(result.paths).some((path) => path.startsWith('이어하기')),
      report(result),
    ).toBe(true)
  }, 180_000)

  it('짧은 판(마선수 대결) — 4년차 방송국 [!] 206(team 16 싸이커)을 앱 화면으로 치르면 결과 이벤트 · 대기 · G · 클리어 칸이 원본대로', async () => {
    // 방송국(trigger 6) 앞 이벤트 200~205 와 다른 장소의 1회짜리 이벤트를 본 4년차 첫날 — 지도의 [!] 가 방송국 하나라
    // g29 부터 타자 대결 206(team 16)이 서고, 지면 210 으로 다시 붙는다
    const seenPlaceEvents = ORIGINAL_EVENTS.filter(
      (event) => event.trigger >= 1 && event.trigger !== 6 && !event.repeatable && (event.audience === 1 || event.audience === 2),
    ).map((event) => String(event.id))
    const result = await runCareerSoak({
      seed: 2015,
      maxRegularGames: 44,
      roundTripEvery: 4,
      extras: true,
      startGamePoint: 60_000,
      startPatch: { season: 4, popularity: 1_600, seenEventIds: [...seenPlaceEvents, '200', '201', '202', '203', '204', '205'] },
    })
    if (process.env.SOAK_DEBUG === '1') process.stderr.write(`${report(result)}\n`)
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    // 대결을 실제로 치르고 결과 이벤트까지 대조했다 — 소크 손가락은 마투수 공을 못 맞혀 늘 진다(이긴 길은 `useMissionSession.test` 의 team 16 칸)
    expect(result.paths.대결짐 ?? 0, report(result)).toBeGreaterThan(0)
  }, 600_000)

  it('짧은 판(엔딩 이어하기) — 부상 엔딩(0)을 5000 G 로 이어하고 같은 시즌 경기를 이어 친다 (0x1bd36 → 0x1bddc)', async () => {
    // 부상 경기 수 20 (0xa3a84 첫 줄) — 105 진입 판정 0 → 부상 엔딩 500
    const result = await runCareerSoak({
      seed: 2012,
      maxRegularGames: 3,
      roundTripEvery: 3,
      startGamePoint: 30_000,
      continueEndings: true,
      startPatch: { injuredGamesPlayed: 20, isInjured: true, injuryRemaining: 5 },
    })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.paths.엔딩이어하기0 ?? 0, report(result)).toBe(1)
    expect(result.games.정규, report(result)).toBeGreaterThanOrEqual(3)
  }, 180_000)

  it.runIf(isSoakEnabled())(
    '긴 판(엔딩 이어하기) — 7년차 인기도 ≤ 499 방출 엔딩(1)을 5000 G 로 이어해 8년차로 간다 (0x1b768)',
    async () => {
      const result = await runCareerSoak({
        seed: 2013,
        roundTripEvery: 10,
        startGamePoint: 30_000,
        continueEndings: true,
        stopAfterContinues: 1,
        startPatch: { season: 7, popularity: 100 },
      })
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.problems.size, report(result)).toBe(0)
      expect(result.paths.엔딩이어하기1 ?? 0, report(result)).toBe(1)
    },
    3_600_000,
  )

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(
      `긴 판 — 씨앗 ${seed}: 새 선수 등록부터 은퇴 · 엔딩까지`,
      async () => {
        const startedAt = Date.now()
        const result = await runCareerSoak({ seed, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
        const line = `[타자편 soak] 씨앗 ${seed} · ${(Date.now() - startedAt) / 1000}s · ${report(result)}`
        console.info(line)
        if (process.env.SOAK_REPORT !== undefined) (await import('node:fs')).appendFileSync(process.env.SOAK_REPORT, `${line}\n`)
        expect(result.stoppedAt, report(result)).toBeNull()
        expect(result.endingIndex, report(result)).not.toBeNull()
        expect(result.problems.size, report(result)).toBe(0)
      },
      3_600_000,
    )
    it.runIf(isSoakEnabled())(
      `긴 판(새 길) — 씨앗 ${seed}: 상점 · 외출 · 도루 · 마선수 대결 · 이어하기를 섞어 엔딩 · 명전 등록까지`,
      async () => {
        const startedAt = Date.now()
        const result = await runCareerSoak({
          seed,
          extras: true,
          startGamePoint: 60_000,
          resumeEvery: soakNumber('SOAK_RESUME_EVERY', 30_011),
          roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10),
        })
        const line = `[타자편 soak 새 길] 씨앗 ${seed} · ${(Date.now() - startedAt) / 1000}s · ${report(result)}`
        console.info(line)
        // 통과한 판의 요약을 파일로 남긴다(`SOAK_REPORT=경로`) — 통과한 시험의 console 은 보고기에서 안 보일 때가 있다
        if (process.env.SOAK_REPORT !== undefined) (await import('node:fs')).appendFileSync(process.env.SOAK_REPORT, `${line}\n`)
        expect(result.stoppedAt, report(result)).toBeNull()
        expect(result.endingIndex, report(result)).not.toBeNull()
        expect(result.problems.size, report(result)).toBe(0)
      },
      3_600_000,
    )
  }
})

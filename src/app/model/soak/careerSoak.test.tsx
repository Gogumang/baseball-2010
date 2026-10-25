// @vitest-environment jsdom
/**
 * **나리 타자편 장기 진행 점검 (soak)** — 화면 없이 `useCareerSession` 을 새 선수 등록부터 여러 해, 은퇴 · 엔딩까지 돌린다.
 *
 * 앱처럼 세운다 (`App`): 커리어 세션 옆에 G 지갑(`useGamePointWallet`) · 모드 저장(`useModeSave` — 경기 중간 저장 +0x4c ·
 * 마선수 대결 대기) · 기록연감(`useCollection` — 명예의 전당) · 미션 세션(`useMissionSession` — 이벤트 마선수 대결)을 같은
 * 난수 · 같은 화면 상태로 함께 띄운다. 저장소는 모두 메모리다.
 *
 * 사람 입력은 단순한 정책으로 대신한다 (`CareerRoutes` · `GameRoute` 가 화면 대신 부르는 액션을 그대로 부른다):
 * - 관리(105): 이번 주기에 아직 안 했으면 사기 < 60 이면 휴식, 아니면 트레이닝 칸 히트 · 파워 · 수비 · 주루 차례(막힌 칸은 건너뜀).
 *   했으면 [다음경기] → 109 순위 확인 → 142 경기 준비 확인 → 로딩 끝.
 * - 타석(경기): **CPU 투구 굴림은 타석 화면과 같은 차례로 세션 난수에서** 굴린다(`useStageAnimation` — 구질 0x344dc ×9 →
 *   목표 0x345fc(종류 4 면 견제 루 0x34848 → `cpuPickoff`) → 놓기 0x4dc78). 공 결과는 정책 난수(세션 난수와 따로)로 볼 ·
 *   스트라이크 · 헛스윙 · 파울 · 페어 타구(원본 타구 패턴 표에서 페어 각 하나)를 골라 굴린 구질 번호와 함께 `handlePitchResolved`
 *   에 넣는다. 붙든 판(타구 판 · 주자 판 · 벤치 클리어링 · 돌발 결과)은 화면이 하던 끝 액션으로 푼다.
 *   타석 끝 배너 시계(`pauseWithBanner`)는 가짜 시계를 앞으로 돌려 넘긴다.
 * - 이벤트(114)는 지나온 보상 명령을 모아 끝에 한 번에 준다(첫 종류 21 이면 그 자리에서 엔딩).
 * - 포스트시즌(128)은 팝업을 닫고 [확인], 국가대항전(134)은 화면의 판정(`confirmNationalCupStandings` · `finishNationalCup`)을 그대로 부른다.
 * - 엔딩(141)은 보너스를 받고 등록 없이 끝낸다.
 *
 * **새 길 (`extras`, r235)** — 위 정책이 안 밟던 곳:
 * - 도루: 주자가 있으면 가끔 공이 나는 동안(0x11, 놓기 굴림 뒤) `stealBase` (원본은 0x11 에만 키를 받는다 — `startSteal` 머리말).
 * - 상점(111 · 121): 장비 사기(부위마다 살 수 있는 가장 낮은 레벨) · 산 장비 바꿔 끼기 · 서브 아이템 · GP 아이템(칸 차례 —
 *   칸 5 복권 · 칸 9 이글아이 포함). 막힌 칸은 화면처럼 `purchaseQuestionOf` 가 null 이라 묻지 않는다.
 * - 외출(112 · 113 · 126): 아프면 병원, 사기 < 70 이면 외식, [!] 장소가 있으면 들어가기(장소 이벤트 → 마선수 대결), 그 밖은 막히지 않은
 *   첫 기능. 결과 창을 닫는다.
 * - 마선수 대결: 이벤트 match 를 앱 길(`App.startAceMatch` → `holdAceMatch` → 미션 `beginAceMatch`)로 실제로 치르고
 *   (`MissionRoutes` 의 타석 — 같은 투구 굴림 차례), `finishAceMatch` 가 띄운 결과 이벤트(140)를 이어 간다.
 * - 엔딩: 이어할 수 있는 엔딩(부상 · 방출)이면 한 번은 5000 G 로 이어하고, 아니면 명예의 전당에 등록(`collection.register` →
 *   `eraseSaveForHallOfFame` → `finishEnding(true)`).
 * - 이어하기(`resumeEvery`): 몇 걸음마다 훅을 내리고 같은 저장소로 새로 띄워 메인 메뉴의 길로 들어간다 — 경기 중간 저장(+0x4c)이
 *   서 있으면 `resumeInterruptedGame`, 아니면 `continueSaved`.
 *
 * 걸음마다 불가능한 값, 리그 전적 합 · 순위 차례, 경기 요약 → 시즌 누계, 경기 수(일정표 하루씩), 저장 JSON 왕복과 새 세션으로 다시
 * 띄운 상태, 멈춤을 본다. 새 길에는 돈 · G 수지(구매 · 외출 · 복권 · GP 아이템 · 명전 등록 앞뒤 차이), 장비(낀 장비는 가진 장비 ·
 * 장비 능력치 = 능력치 + 레벨 보너스), 도루 · 견제 뒤 아웃 · 주자, 명전 기록 줄, 이어하기 앞뒤 커리어 값을 더 본다.
 * 긴 판은 `SOAK=1` 로 켠다:
 * `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/careerSoak.test.tsx --maxWorkers=2`
 * (`SOAK_RESUME_EVERY` 끊는 간격 · `SOAK_REPORT=파일` 통과한 판 요약을 파일에 덧붙인다)
 *
 * ⚠️ 타석 화면과 아직 다른 난수 차례(남김 — 화면 없는 하네스): 휘두른 공의 타구 판정(`BattingStage` → `resolvePitch` 의 패턴 덱 ·
 * 발사 패턴 굴림)은 정책 결과로 갈음하고, 파티클 틱(마구 공 · 삼진 판정 글자 · 홈런 효과)과 결과 판 정산 효과(0x4a384)의 경기 난수
 * 굴림은 돌지 않는다. CPU 투구 · 견제 · 도루 출발(0xafa60)은 앱 차례 그대로다.
 */
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import {
  missionCpuMagicStateOf, missionMoundPitcherAbility, missionStageBatterOf, useMissionSession,
} from '@/app/model/useMissionSession'
import { useCollection } from '@/app/model/useCollection'
import { modeBatterOf } from '@/app/model/modeBatter'
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
import {
  opponentCpuMagicStateOf, opponentStaminaPercentAfterPitchOf, stageOpponentPitcherAbilityOf,
} from '@/features/play-game/model/gameFlow'
import { CPU_PITCH_TYPE_TICKS, cpuPitchAimOf, cpuPitchTypeTickOf, releaseCpuPitch } from '@/entities/pitching/model/selectPitch'
import type { CpuPitchArgs } from '@/entities/pitching/model/selectPitch'
import { pitchSituationOf } from '@/widgets/batting-stage/lib/stageText'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { purchaseQuestionOf, shopItemId } from '@/features/shop/model/shopSelection'
import {
  EQUIPMENT_LEVEL_COUNT, EQUIPMENT_PARTS, equipmentBlockReasonOf, equipmentBonusOf, equipmentItemOf, ownsEquipment,
} from '@/entities/career/model/equipment'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { SUB_ITEMS, subItemBlockReasonOf } from '@/entities/career/model/subItems'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { outingBlockReasonOf } from '@/entities/career/model/outing'
import { isContinuableEnding } from '@/entities/career/model/seasonFlow'
import { batterRecordLineOf } from '@/entities/career/model/seasonStats'
import { HALL_OF_FAME_COST } from '@/entities/collection/model/collection'
import { aceMatchMissionOf, matchResultEventOf } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { MatchCommand } from '@/pages/story/model/useEventPlayback'
import { nariGameMatchOfSave } from '@/pages/management/lib/nariMatchPrepare'
import type { NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'
import { myBatterIndexOf, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { useModeSave } from '@/entities/mode-save/model/useModeSave'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { MissionClearCounts, MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import {
  SoakProblems, batterLineProblemsOf, firstDiffOf, isSoakEnabled, jsonRoundTripDiffOf, leagueTallyProblemsOf,
  outOfRangeOf, rankingOrderProblemsOf, soakNumber, soakSeeds, unserializablePathsOf,
} from '@/app/model/soak/soakInvariants'

setActiveSound(createSilentSound())

/** MVP 발표 375 · 결과 376/377 (0x8b370) */
const MVP_EVENT_IDS = [375, 376, 377]

/** 나리 타자편 모드 번호 (`App` 의 NARI_BATTER_MODE) */
const NARI_BATTER_MODE = 4
/** 타석 화면의 압도 스킬 번호 (`GameRoute` 의 INTIMIDATE_SKILL_ID) */
const INTIMIDATE_SKILL_ID = 22

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

/** 공 하나 — 사람이 친 결과를 흉내 낸다. 구질 번호는 타석 화면이 굴린 CPU 구질(놓기 0x4dc78 의 결과)을 싣는다 */
function pitchDetailOf(roll: number, pick: number, batterHand: number, pitchTypeNumber: number): PitchOutcomeDetail {
  const base = { hasSwung: false, isBunt: false, resultCode: null, contactSoundId: null, pitchTypeNumber } as const
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

/** 타석 화면 HUD 의 그 틱 값 — `pitchSituationOf` 가 읽는 칸만 */
interface StageHud {
  readonly balls: number
  readonly strikes: number
  readonly outs: number
  readonly bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean }
}

/**
 * 타석 화면(`useStageAnimation.cpuPitchArgsNow`)이 그 틱에 넘기는 CPU 투구 재료 — 마구 상태는 부르는 쪽이 든 값의 사본
 * (`magicStateOf` 의 `held` 갈래), 견제는 받아 줄 쪽(`onPickoff`)이 있어 늘 켠다
 */
function stageCpuPitchArgsOf(input: {
  readonly pitcher: CpuPitchArgs['pitcher']
  /** 없으면(CPU 가 던지는 반이 아님 — `missionCpuMagicStateOf` 의 null 갈래) 남은 횟수 0 */
  readonly cpuMagic: { readonly remaining: number; readonly ballMagicNumber: number } | undefined
  readonly hud: StageHud
  readonly batterForm: number
  readonly batterHand?: number
  readonly batterSkillIds: readonly number[]
}): CpuPitchArgs {
  const { hud } = input
  const situationHud = hud as unknown as Parameters<typeof pitchSituationOf>[0]
  return {
    pitcher: input.pitcher,
    situation: pitchSituationOf(situationHud, input.batterForm, input.batterHand),
    difficulty: 'hard',
    magic: { remaining: input.cpuMagic?.remaining ?? 0, ballMagicNumber: input.cpuMagic?.ballMagicNumber ?? 0 },
    cpuPickoff: {
      hasRunnerOnBase: (base) => (base === 1 ? hud.bases.first : base === 2 ? hud.bases.second : base === 3 ? hud.bases.third : false),
    },
    batterIntimidates: input.batterSkillIds.includes(INTIMIDATE_SKILL_ID),
    derbyPitchType: undefined,
  }
}

/**
 * CPU 공 하나의 굴림을 타석 화면 차례대로 — 상태 0xf 틱 0~8 구질 0x344dc(틱마다) → 0x10 틱 6 목표 0x345fc(또는 견제) →
 * 0x11 틱 10 놓기 0x4dc78. 재료는 틱마다 다시 읽는다(`cpuPitchArgsNow`). 견제면 그 루, 공이면 구질 번호
 */
function rollStagePitch(argsNow: () => CpuPitchArgs, random: RandomPort):
  { readonly kind: '견제'; readonly base: 1 | 2 | 3 } | { readonly kind: '투구'; readonly pitchTypeNumber: number } {
  let typeNumber = 0
  for (let tick = 0; tick < CPU_PITCH_TYPE_TICKS; tick += 1) typeNumber = cpuPitchTypeTickOf(argsNow(), random)
  const aim = cpuPitchAimOf(argsNow(), random)
  if (aim.kind === '견제') return { kind: '견제', base: aim.base }
  const released = releaseCpuPitch(argsNow(), typeNumber, aim.target, random)
  return { kind: '투구', pitchTypeNumber: released.pitchTypeNumber }
}

/** 도루할 루 — 앞 루가 빈 가장 앞 주자 (없으면 null) */
function stealBaseOf(bases: StageHud['bases']): 1 | 2 | 3 | null {
  if (bases.third) return null
  if (bases.second) return 2
  if (bases.first) return 1
  return null
}

interface CareerSoakResult {
  readonly problems: SoakProblems
  readonly steps: number
  readonly games: { 정규: number; 포스트시즌: number; 국가대항전: number; 대결: number }
  readonly seasons: number
  readonly endingIndex: number | null
  readonly stoppedAt: string | null
  readonly log: readonly string[]
  /** 새 길을 실제로 밟은 횟수 */
  readonly paths: Readonly<Record<string, number>>
}

interface CareerSoakOptions {
  readonly seed: number
  /** 이만큼 정규 경기를 치르면 멈춘다 (짧은 판) — 없으면 엔딩까지 */
  readonly maxRegularGames?: number
  /** 저장 왕복을 몇 번째 관리 화면마다 볼지 */
  readonly roundTripEvery?: number
  /** 새 길 정책(도루 · 상점 · 장비 · GP · 복권 · 외출 · 마선수 대결 · 엔딩 이어하기 · 명전 등록) */
  readonly extras?: boolean
  /** 이 걸음 수마다 훅을 내리고 같은 저장으로 새로 띄워 이어 간다 — 없거나 0 이면 안 한다 */
  readonly resumeEvery?: number
  /** 지갑 첫 G */
  readonly startGamePoint?: number
}

/** 이벤트 재생 결과 — match 에 닿았으면 그 명령과 모은 것 */
interface EventWalk {
  readonly rewards: readonly EventReward[]
  readonly viewed: readonly number[]
  readonly endingEventId: number | null
  readonly match: MatchCommand | null
}

/**
 * 이벤트 재생을 흉내 낸다 (`useEventPlayback`) — 지나온 보상 명령을 모으고, 선택지는 첫 칸 · 예아니오(창 있는 sub 0)는 "예"로
 * 건너간다(떠나온 이벤트는 `onChoice` 로 알린다). 첫 종류 21(엔딩 진입)을 만나면 거기서 멈추고 그 이벤트를 엔딩으로 넘긴다(0x8d4ce).
 * match 명령(마선수 대결)에서 멈추고 그 명령을 돌려준다 — 치를지는 부르는 쪽이 정한다.
 */
function eventPlaybackOf(
  events: readonly OriginalEvent[],
  firstEventId: number,
  onChoice: (eventId: number, leftEventIds: readonly number[]) => void,
): EventWalk {
  const rewards: EventReward[] = []
  const viewed: number[] = []
  let endingEventId: number | null = null
  let match: MatchCommand | null = null
  let eventId = firstEventId
  for (let hop = 0; hop < 20; hop += 1) {
    const event = events.find((candidate) => candidate.id === eventId)
    if (!viewed.includes(eventId)) viewed.push(eventId)
    let jumpTo: number | null = null
    let stopped = false
    for (const command of event?.commands ?? []) {
      if (command.op === 'match') {
        match = command
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
  return { rewards, viewed, endingEventId, match }
}

/** 끊어 볼 화면 — 차례로 돈다. 엔딩 · 메인 메뉴 · 마선수 대결(미션 장면 — 나가면 결과 이벤트가 105 진입에서 뜬다)은 뺀다 */
const RESUMABLE_SCREENS: readonly Screen['kind'][] = [
  '관리', '경기', '이벤트', '경기결과', '다음경기순위', '경기준비', '외출', '포스트시즌', '국가대항전', '연차표지', '대회경기결과',
]

/** 이어하기 앞뒤로 같아야 하는 커리어 칸 — 이어하기 진입(장면 셋업 · 116 재진입)이 고치는 칸(본 이벤트 · 외출 수 · 카운터)은 뺀다 */
const RESUME_STABLE_KEYS = [
  'season', 'gamesPlayed', 'money', 'salary', 'ability', 'equipmentLevels', 'ownedEquipment', 'subItemIds', 'stats', 'careerStats',
  'league', 'leaguePlayerStats', 'titleIds', 'teamId', 'postseason', 'nationalCup', 'endingIndex',
] as const

async function runCareerSoak(options: CareerSoakOptions): Promise<CareerSoakResult> {
  const { seed, maxRegularGames, roundTripEvery = 5, extras = false, resumeEvery = 0, startGamePoint } = options
  const saveGame = memorySave()
  const walletStore = memoryJson(startGamePoint === undefined ? null : { gamePoint: startGamePoint })
  const modeStore = memoryJson()
  const collectionStore = memoryJson()
  const missionRecord = memoryMissionRecord()
  const random = createSeededRandom(seed)
  const policy = policyRandom(seed)

  /** 앱(`App`)처럼 세션들을 한 훅에 — 같은 화면 상태 · 같은 난수 · 같은 타석 진행기 */
  const mount = () => renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    const wallet = useGamePointWallet(walletStore)
    const modeSave = useModeSave(modeStore)
    const nariGameSave: NariGameSavePort = {
      start: (match) => modeSave.startNariGame(NARI_BATTER_MODE, match),
      clear: () => modeSave.clearNariGame(NARI_BATTER_MODE),
    }
    const session = useCareerSession({
      runner, random, saveGame, screen, setScreen, wallet, nariGameSave,
      aceMatchPending: modeSave.aceMatchPendingPorts[NARI_BATTER_MODE],
    })
    const collection = useCollection(collectionStore, session.career)
    const missionBatterCareer = session.career ?? session.savedCareer
    const missionBatterRecordSlot = missionBatterCareer === null
      ? -1
      : myBatterIndexOf(nariTeamRecordOf(nariTeamsOf(missionBatterCareer), missionBatterCareer.teamId))
    const mission = useMissionSession({
      runner, random, missionRecord, screen, setScreen,
      onGamePointReward: session.actions.gainGamePoint,
      batterRunAbility: modeBatterOf(missionBatterCareer).ability.run,
      ...(missionBatterCareer === null ? {} : { batterSkillIds: missionBatterCareer.equippedSkillIds }),
      nariTeamIds: missionBatterCareer === null ? {} : { batter: missionBatterCareer.teamId },
      ...(missionBatterRecordSlot < 0 ? {} : { nariBatterRecordSlot: missionBatterRecordSlot }),
      aceMatchHold: modeSave.aceMatchHoldPort,
      onReturnToNari: () => {
        if (session.savedCareer !== null) session.actions.continueSaved()
      },
    })
    return { screen, setScreen, runner, wallet, modeSave, session, collection, mission }
  })
  let rendered = mount()
  /** 지금 띄운 훅 — 이어하기가 훅을 새로 띄워도 같은 이름으로 읽는다 */
  const result = { get current() { return rendered.result.current } }
  const problems = new SoakProblems()
  const games = { 정규: 0, 포스트시즌: 0, 국가대항전: 0, 대결: 0 }
  const paths: Record<string, number> = {}
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
  let trainingSlot = 0
  let managementVisits = 0
  let gpSlot = 0
  let stoppedAt: string | null = null
  let started = false
  let endingIndex: number | null = null
  let firstSeason = 1
  let continuedAfterEnding = false
  let lastCutStep = 0
  let resumeTarget = 0
  let lastSeenSeason = 1
  /** 이 경기를 시작할 때의 커리어 — 결과 화면에서 누계 증가분을 본다 */
  let beforeGame: { career: PlayerCareer; kind: '정규' | '포스트시즌' | '국가대항전' } | null = null
  let checkedSummary: unknown = null
  /** 붙든 판을 푼 횟수 — 정책이 경기 갈래를 실제로 밟았는지 본다 */
  const heldPlays = { 타구판: 0, 주자판: 0, 벤치클리어링: 0, 돌발결과: 0, 공: 0, 견제: 0, 도루: 0 }

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
        if (equipped[part.ability] !== expected) problems.add(at, [`장비 능력치 ${part.ability} ${equipped[part.ability]} ≠ 능력치 + 보너스 ${expected}`])
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

  /** 경기 진행 값 — 도루 · 견제 뒤 아웃 · 루 · 점수 */
  const checkProgress = (label: string) => {
    const progress = result.current.session.progress
    if (progress === null) return
    const { game } = progress
    problems.add(where(), outOfRangeOf(`${label}.game`, { outs: game.outs, ourScore: game.ourScore, opponentScore: game.opponentScore }, 0))
    // 아웃은 3 까지 — 다만 9회 이후 말 공격 내 타석 앞의 끝내기 판 0xc22b4 는 `아웃 + 주자 = t` 를 n = rand(d, t + 1) 로 다시 나눠
    // st[6] = max(0, t − n) 을 그대로 쓴다(0xc2318~0xc232e, 직접 떴다 — 위 넘침 검사 없음). 2아웃 주자 둘 · 동점에서 n = 0 이면 아웃 4,
    // 만루면 5 다 — 원본 버그 그대로(`withAutoStopLateInningSetup`). 그 판에서만 5 까지 둔다
    const lateInningSetupOuts = game.inning >= 9 && game.half === '말' ? 5 : 3
    if (game.outs > lateInningSetupOuts) problems.add(where(), [`${label}: 아웃 ${game.outs} > ${lateInningSetupOuts}`])
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

  /**
   * **끊고 이어 가기** — 훅을 내리고(앱을 끈다) 같은 저장소로 새로 띄워, 메인 메뉴의 길로 들어간다: 경기 중간 저장(+0x4c)이
   * 서 있으면 [14] 곧장 경기(`resumeInterruptedGame`), 아니면 [이어하기](`continueSaved`). 이어하기 앞뒤 커리어의 안 바뀌어야 할
   * 칸이 같은지 본다
   */
  const cutAndResume = () => {
    const before = saveGame.held()
    if (before === null) return
    const fromScreen = result.current.screen.kind
    rendered.unmount()
    rendered = mount()
    const { session, modeSave } = result.current
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

  /** 타석 화면 대신 — 나리 경기의 CPU 투구 재료(`GameRoute` → `GameScreen` → `BattingStage`) */
  const careerPitchArgsNow = (): CpuPitchArgs => {
    const { session, runner } = result.current
    const progress = session.progress!
    const career = session.career!
    const moundPitcher = stageOpponentPitcherAbilityOf(progress, undefined)
    return stageCpuPitchArgsOf({
      pitcher: {
        ...moundPitcher,
        staminaPercentAfterPitch: opponentStaminaPercentAfterPitchOf(progress, {
          batterIntimidates: career.equippedSkillIds.includes(INTIMIDATE_SKILL_ID),
        }),
      },
      cpuMagic: opponentCpuMagicStateOf(progress, moundPitcher, undefined),
      hud: { balls: runner.atBat.balls, strikes: runner.atBat.strikes, outs: progress.game.outs, bases: progress.game.bases },
      batterForm: career.battingTypeIndex * 2 + career.battingSide,
      batterSkillIds: career.equippedSkillIds,
    })
  }

  /**
   * 재생 화면(`GameRoute`) 대신 (r244) — 경기 화면 동안 세션에 붙어(`attachReplayHost`) 재생 칸의 새 판을 다 그린 것으로 알린다
   * (`finishReplay`). 재생 판으로 끝난 경기는 세션이 정산을 그 알림 뒤로 미루므로 이 길이 멈추지 않는지도 함께 본다
   */
  let replayHosted: typeof rendered | null = null
  let replayedPlay: unknown = null
  const replayStep = () => {
    if (replayHosted !== rendered) {
      replayHosted = rendered
      act(() => {
        result.current.session.actions.attachReplayHost()
      })
    }
    const play = result.current.session.progress?.lastDefensePlay ?? null
    if (play === null || play.ticks.length === 0 || play === replayedPlay) return
    replayedPlay = play
    act(() => result.current.session.actions.finishReplay(play))
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
      checkProgress('주자판 뒤')
    } else if (progress.pendingBenchClearing !== null) {
      heldPlays.벤치클리어링 += 1
      act(() => session.actions.finishBenchClearing(false))
    } else if (progress.lastBurstResolution != null) {
      heldPlays.돌발결과 += 1
      act(() => session.actions.closeBurstResult())
    } else if (!runner.isPaused && !progress.game.isFinished) {
      const career = session.career
      // 타석 화면의 CPU 공 굴림 — 견제면 공을 안 던지고 견제 판(0x17)이 선다
      const thrown = rollStagePitch(careerPitchArgsNow, random)
      if (thrown.kind === '견제') {
        heldPlays.견제 += 1
        act(() => result.current.session.actions.cpuPickoff(thrown.base))
        checkProgress('견제 뒤')
      } else {
        // 공이 나는 동안(0x11) 도루 키 — 앞 루가 빈 주자
        const stealFrom = extras ? stealBaseOf(progress.game.bases) : null
        if (stealFrom !== null && policy() < 0.2) {
          heldPlays.도루 += 1
          act(() => result.current.session.actions.stealBase(stealFrom))
        }
        heldPlays.공 += 1
        const detail = pitchDetailOf(policy(), policy(), career?.battingSide ?? 0, thrown.pitchTypeNumber)
        act(() => {
          result.current.session.handlePitchResolved(detail)
        })
        checkProgress('공 뒤')
      }
    }
    // 타석 끝 배너(`pauseWithBanner`) · 판 끝 대기 — 장면 시계를 돌린다
    act(() => {
      vi.advanceTimersByTime(2000)
    })
  }

  /** 마선수 대결(미션 장면 모드 6) 한 걸음 — `MissionRoutes` 의 타석 화면 대신 */
  const aceMatchStep = () => {
    const { mission, runner } = result.current
    const run = mission.missionRun
    if (mission.loadingTip !== null) return act(() => mission.actions.finishLoading())
    if (run === null) {
      stoppedAt = `마선수 대결인데 미션 판이 없다: ${where()}`
      return
    }
    if (mission.halfInningBoard !== null) return act(() => mission.actions.confirmHalfInningBoard())
    if (mission.substitutionScene !== null) {
      act(() => mission.finishSubstitutionScene())
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      return
    }
    if (mission.pendingDefensePlay !== null) return act(() => mission.actions.finishDefensePlay())
    if (mission.pendingRunnerPlay !== null) return act(() => mission.actions.finishRunnerPlay())
    if (mission.pendingBenchClearing !== null) return act(() => mission.actions.finishBenchClearing(true))
    if (mission.pickoffReplay !== null) return act(() => mission.actions.finishPickoffReplay())
    if (run.status !== '진행중') {
      games.대결 += 1
      log.push(`대결 ${run.mission.id} ${run.status}`)
      return act(() => mission.actions.finishAceMatch())
    }
    // 상태 0xe — 새 타석 OK (0xf 진입이 CPU 교체를 묻는다)
    if (mission.sceneConfirm !== null) act(() => result.current.mission.confirmScene())
    if (!runner.isPaused) {
      const argsNow = (): CpuPitchArgs => {
        const now = result.current.mission
        const current = now.missionRun!
        const career = result.current.session.career ?? result.current.session.savedCareer
        const stageBatter = missionStageBatterOf(current, modeBatterOf(career))
        const form = stageBatter.look?.form ?? 0
        return stageCpuPitchArgsOf({
          pitcher: {
            ...missionMoundPitcherAbility(current, now.aceLevels, now.opponentStaminaPercent),
            staminaPercentAfterPitch: (pitchTypeNumber: number) => now.opponentStaminaPercentAfterPitch(current, pitchTypeNumber),
          },
          cpuMagic: missionCpuMagicStateOf(current, now.aceLevels),
          hud: { balls: result.current.runner.atBat.balls, strikes: result.current.runner.atBat.strikes, outs: current.outs, bases: current.bases },
          batterForm: form,
          batterHand: batterSideOfForm(form),
          batterSkillIds: stageBatter.skillIds,
        })
      }
      const thrown = rollStagePitch(argsNow, random)
      if (thrown.kind === '견제') {
        act(() => result.current.mission.actions.cpuPickoff(thrown.base))
      } else {
        const stealable = result.current.mission.stealableBases
        if (stealable.length > 0 && policy() < 0.2) act(() => result.current.mission.actions.steal(stealable[0]!))
        const form = missionStageBatterOf(run, modeBatterOf(result.current.session.career)).look?.form ?? 0
        const detail = pitchDetailOf(policy(), policy(), batterSideOfForm(form), thrown.pitchTypeNumber)
        act(() => {
          result.current.mission.handleMissionPitch(detail)
        })
      }
    }
    act(() => {
      vi.advanceTimersByTime(2000)
    })
  }

  /** 이벤트 match → 앱 `startAceMatch` 그대로 */
  const startAceMatch = (command: MatchCommand, carried: StoryCarry, context: string) => {
    const { session, mission } = result.current
    walked('마선수대결')
    if (context === '장소') act(() => session.actions.settlePlaceForAceMatch())
    const target = aceMatchMissionOf(command.team)
    if (target === null) {
      act(() => result.current.setScreen({ kind: '이벤트', eventId: matchResultEventOf(command.resultEvents, false), context: '대결결과', carried }))
      return
    }
    act(() => result.current.session.actions.holdAceMatch(command.resultEvents, carried.viewedEventIds))
    act(() => mission.actions.beginAceMatch(target, { resultEvents: command.resultEvents, context: '대결결과', carried }))
  }

  /** 상점 한 바퀴 — 장비 · 끼기 · 서브 · GP (막힌 칸은 화면처럼 묻지 않는다). 사면 돈 · G 차이를 본다 */
  const shopRound = () => {
    const purchase = (label: string, itemId: string, expect: (before: PlayerCareer, after: PlayerCareer, gBefore: number, gAfter: number) => string[]) => {
      const before = result.current.session.career
      if (before === null || purchaseQuestionOf(before, itemId) === null) return false
      const gBefore = result.current.wallet.balance
      act(() => result.current.session.actions.purchase(itemId))
      if (result.current.session.shopGpDetail !== null) act(() => result.current.session.actions.closeShopGpDetail())
      const after = result.current.session.career
      if (after === null) return false
      walked(label)
      problems.add(where(), expect(before, after, gBefore, result.current.wallet.balance).map((line) => `${label}: ${line}`))
      return true
    }
    // 장비 — 부위마다 살 수 있는 가장 낮은 레벨 하나
    act(() => result.current.session.actions.openShop('장착'))
    for (const part of EQUIPMENT_PARTS) {
      const career = result.current.session.career!
      const level = Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, index) => index)
        .find((candidate) => equipmentBlockReasonOf(career, part.index, candidate) === null)
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
        const level = Array.from({ length: EQUIPMENT_LEVEL_COUNT }, (_unused, index) => index)
          .find((candidate) => candidate + 1 !== now && ownsEquipment(career, part.index, candidate))
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
          if (before.money - after.money !== SUB_ITEMS[index]!.price) out.push(`소지금 ${before.money} → ${after.money} (값 ${SUB_ITEMS[index]!.price})`)
          if (!after.subItemIds.includes(index)) out.push('산 서브 아이템이 없다')
          return out
        })
      }
    }
    // GP 아이템 — 칸 차례로 한 번에 하나 (5 복권 · 9 이글아이)
    act(() => result.current.session.actions.openShop('GP'))
    for (let tries = 0; tries < BATTER_GP_ITEMS.length; tries += 1) {
      const index = gpSlot % BATTER_GP_ITEMS.length
      gpSlot += 1
      const price = BATTER_GP_ITEMS[index]!.price
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
        if (spent < 0 || spent > fn.effect.moneyCost) problems.add(where(), [`외출 ${fn.id}: 소지금 ${before.money} → ${after.money} (값 ${fn.effect.moneyCost})`])
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
    const sick = career.isInjured || career.isSick ? functions.find((candidate) => candidate.effect.healsInjury && outingBlockReasonOf(career, candidate) === null) : undefined
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

  const maxSteps = soakNumber('SOAK_MAX_STEPS', 400000)
  let lastKey = ''
  let sameKeySteps = 0
  try {
    // 이벤트 본문(535KB)은 커리어가 선 뒤 따로 받는다 — 먼저 받아 두고 세션이 싣게 한다
    await import('@/shared/config/original/events')
    for (; steps < maxSteps; steps += 1) {
      const { screen, session, mission } = result.current
      const { actions } = session
      const career = session.career
      const run = mission.missionRun
      const key = `${screen.kind}:${career?.season}:${career?.gamesPlayed}:${session.progress?.game.inning}:${session.progress?.game.half}`
        + `:${session.progress?.game.outs}:${result.current.runner.atBat.balls}:${result.current.runner.atBat.strikes}`
        + `:${career?.postseason?.wins.join(',')}:${screen.kind === '국가대항전' ? screen.cup.day : ''}`
        + `:${screen.kind === '이벤트' ? screen.eventId : ''}:${session.managementNotice}:${session.managementDetail === null}`
        + `:${career?.hasActedThisCycle}:${session.pendingTitle}:${screen.kind === '포스트시즌' ? screen.popup?.kind : ''}`
        + `:${session.outingPresentation?.functionId}:${session.outingResult === null}:${session.outingNotice}`
        + `:${run?.status}:${run?.outs}:${run?.game.inning}:${run?.game.offenseSide}:${mission.loadingTip}`
      if (key === lastKey) sameKeySteps += 1
      else sameKeySteps = 0
      lastKey = key
      if (process.env.SOAK_TRACE !== undefined && steps >= Number(process.env.SOAK_TRACE) && steps < Number(process.env.SOAK_TRACE) + 60 && screen.kind !== '경기') console.info(`[흐름] ${steps} ${JSON.stringify(screen).slice(0, 120)} 끝상태 ${career?.seasonEndState} PS ${career?.postseason?.round}`)
      if (sameKeySteps > 30) {
        stoppedAt = `멈춤: ${where()}`
        break
      }
      if (maxRegularGames !== undefined && games.정규 >= maxRegularGames && screen.kind === '관리') break

      // 이벤트 본문이 아직이면(첫 커리어 직후 · 이어하기 직후) 한 틈 쉰다
      if (career !== null && session.storyEvents === null) {
        await act(async () => {
          await Promise.resolve()
        })
        continue
      }

      // 이어하기 — 몇 걸음마다 앱을 끄고 다시 켠다(엔딩 · 메인 메뉴 · 대결 중은 빼고)
      // 끊는 화면을 차례로 바꾼다(관리 · 경기 중 · 이벤트 · 경기 결과 …) — 그 화면이 한참 안 오면 아무 데서나 끊는다
      if (resumeEvery > 0 && steps - lastCutStep >= resumeEvery && career !== null && RESUMABLE_SCREENS.includes(screen.kind)
        && (screen.kind === RESUMABLE_SCREENS[resumeTarget % RESUMABLE_SCREENS.length] || steps - lastCutStep >= resumeEvery * 4)) {
        lastCutStep = steps
        resumeTarget += 1
        cutAndResume()
        continue
      }
      if (career !== null) lastSeenSeason = Math.max(lastSeenSeason, career.season)

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
            beforeGame = {
              career,
              kind: screen.cup !== undefined ? '국가대항전' : career.postseason !== null ? '포스트시즌' : '정규',
            }
          }
          act(() => actions.confirmMatchPrepare())
          break
        case '경기':
          replayStep()
          gameStep()
          break
        case '마선수대결':
          aceMatchStep()
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
          const carried = screen.carried
          const context = screen.context
          const playback = eventPlaybackOf(session.storyEvents ?? [], screen.eventId, (eventId, left) => {
            act(() => result.current.session.actions.confirmEventChoice(eventId, left))
          })
          const rewards = [...(carried?.rewards ?? []), ...playback.rewards]
          const viewed = [...(carried?.viewedEventIds ?? []), ...playback.viewed.filter((id) => !(carried?.viewedEventIds ?? []).includes(id))]
          if (playback.match !== null && extras) {
            startAceMatch(playback.match, { rewards, viewedEventIds: viewed }, context)
            break
          }
          for (const id of playback.viewed.filter((viewedId) => MVP_EVENT_IDS.includes(viewedId))) {
            const series = career?.postseason
            const spot = series === null || series === undefined ? '정규' : `${series.round}:${series.teams.join(',')}:${series.wins.join(',')}`
            const mvpKey = `${career?.season}:${spot}:${id}`
            const count = (mvpScenes.get(mvpKey) ?? 0) + 1
            mvpScenes.set(mvpKey, count)
            if (count > 1) problems.add(where(), [`${career?.season}년차 ${spot} 자리에서 MVP 이벤트 ${id} 를 ${count}번째 끝냈다`])
            if (id === 375) log.push(`${career?.season}년차 MVP 발표(${spot})`)
          }
          act(() => result.current.session.actions.completeScene(rewards, viewed, playback.endingEventId))
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
        case '엔딩': {
          log.push(`${career?.season}년차 엔딩 ${screen.endingIndex}`)
          act(() => actions.receiveEndingBonus())
          const ended = result.current.session.career
          // 이어할 수 있는 엔딩(부상 · 방출)이면 한 번은 5000 G 로 이어한다 (팝업 0x32 예 → 0x1bd36)
          if (extras && !continuedAfterEnding && ended !== null && isContinuableEnding(screen.endingIndex)) {
            const gBefore = result.current.wallet.balance
            let continued = false
            act(() => {
              continued = result.current.session.actions.continueAfterEnding()
            })
            if (continued) {
              continuedAfterEnding = true
              walked('엔딩이어하기')
              if (gBefore - result.current.wallet.balance !== 5000) problems.add(where(), [`엔딩 이어하기 G ${gBefore} → ${result.current.wallet.balance}`])
              break
            }
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
              walked('명전등록')
              const famers = result.current.collection.collection.hallOfFame
              const famer = famers[famers.length - 1]
              if (famers.length !== famersBefore + 1 || famer === undefined) problems.add(where(), ['명전 칸이 하나 늘지 않았다'])
              else {
                const d = firstDiffOf(
                  { name: famer.name, endingIndex: famer.endingIndex, season: famer.season, ability: famer.ability, recordLine: famer.recordLine, equipmentLevels: famer.equipmentLevels },
                  { name: ended.name, endingIndex: screen.endingIndex, season: ended.season, ability: ended.ability, recordLine: batterRecordLineOf(ended.stats), equipmentLevels: ended.equipmentLevels },
                  '명전 기록',
                )
                if (d !== null) problems.add(where(), [d])
              }
              if (gBefore - result.current.wallet.balance !== HALL_OF_FAME_COST) problems.add(where(), [`명전 등록 G ${gBefore} → ${result.current.wallet.balance}`])
              if (saveGame.held() !== null) problems.add(where(), ['명전 등록 뒤 커리어 저장이 남았다'])
              act(() => result.current.session.actions.finishEnding(true))
              break
            }
          }
          act(() => result.current.session.actions.finishEnding(false))
          break
        }
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
  const lastSeason = Math.max(lastSeenSeason, saveGame.held()?.season ?? result.current.session.career?.season ?? firstSeason)
  log.push(`판 ${JSON.stringify(heldPlays)}`)
  return { problems, steps, games, seasons: lastSeason - firstSeason + 1, endingIndex, stoppedAt, log, paths }
}

function report(result: CareerSoakResult): string {
  return `걸음 ${result.steps} · 경기 정규 ${result.games.정규} · PS ${result.games.포스트시즌} · 대회 ${result.games.국가대항전} · 대결 ${result.games.대결}`
    + ` · 시즌 ${result.seasons} · 엔딩 ${result.endingIndex} · [${result.log.join(' / ')}] · 길 ${JSON.stringify(result.paths)}`
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

  it('짧은 판(새 길) — 도루 · 상점 · 장비 · GP · 복권 · 외출 · 이어하기를 섞어 8경기를 치러도 값 · 수지가 맞는다', async () => {
    const result = await runCareerSoak({
      seed: 2011, maxRegularGames: 8, roundTripEvery: 2, extras: true, resumeEvery: 97, startGamePoint: 60_000,
    })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.정규, report(result)).toBe(8)
    // 새 길을 실제로 밟았다
    for (const path of ['장비', '외출']) expect(result.paths[path] ?? 0, `${path} — ${report(result)}`).toBeGreaterThan(0)
    expect(Object.keys(result.paths).some((path) => path.startsWith('이어하기')), report(result)).toBe(true)
  }, 120_000)

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed}: 새 선수 등록부터 은퇴 · 엔딩까지`, async () => {
      const startedAt = Date.now()
      const result = await runCareerSoak({ seed, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
      const line = `[타자편 soak] 씨앗 ${seed} · ${(Date.now() - startedAt) / 1000}s · ${report(result)}`
      console.info(line)
      if (process.env.SOAK_REPORT !== undefined) (await import('node:fs')).appendFileSync(process.env.SOAK_REPORT, `${line}\n`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.endingIndex, report(result)).not.toBeNull()
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
    it.runIf(isSoakEnabled())(`긴 판(새 길) — 씨앗 ${seed}: 상점 · 외출 · 도루 · 마선수 대결 · 이어하기를 섞어 엔딩 · 명전 등록까지`, async () => {
      const startedAt = Date.now()
      const result = await runCareerSoak({
        seed, extras: true, startGamePoint: 60_000, resumeEvery: soakNumber('SOAK_RESUME_EVERY', 307),
        roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10),
      })
      const line = `[타자편 soak 새 길] 씨앗 ${seed} · ${(Date.now() - startedAt) / 1000}s · ${report(result)}`
      console.info(line)
      // 통과한 판의 요약을 파일로 남긴다(`SOAK_REPORT=경로`) — 통과한 시험의 console 은 보고기에서 안 보일 때가 있다
      if (process.env.SOAK_REPORT !== undefined) (await import('node:fs')).appendFileSync(process.env.SOAK_REPORT, `${line}\n`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.endingIndex, report(result)).not.toBeNull()
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
  }
})

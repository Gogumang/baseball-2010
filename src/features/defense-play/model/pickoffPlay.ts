import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  gateRunnerViewsOf,
  liveRunnerCountOf,
  passPlayGateBetweenTicks,
  someRunnerStillActive,
} from '@/entities/fielding/model/playGate'
import type { HolderPlate } from '@/features/defense-play/model/defensePlayView'
import { loadedRunnerAceOf, runnerAceIndexesOf, type RunnerAces } from '@/features/defense-play/model/runnerAces'
import { PICKOFF_PLAY_KIND, type PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { autoAdvanceDecisions } from '@/entities/fielding/model/autoAdvance'
import { rollFumble } from '@/entities/fielding/model/fieldingErrors'
import {
  basePosition,
  FIELDER_START_POSITIONS,
  horizontalDistance,
  isSamePoint,
  runnerSpeedOf,
  stepToward,
  ticksToReach,
} from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  fielderAbilityOf,
  recordPlayerAbilityOf,
  fielderArrivalTicks,
  createRunner,
  initialPlayView,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { baseUnderFoot, judgeOut, OUT_KIND, releaseForcesAfterOut } from '@/entities/fielding/model/outJudgement'
import { startPickoff } from '@/entities/fielding/model/pickoff'
import { applyRunnerLead, previousTargetAfterLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { applyBaserunningKey } from '@/entities/fielding/model/baserunningKey'
import { slideOnKey, SLIDING_SOUND_EFFECT, SLIDING_SPEED_BONUS } from '@/entities/defense-controls/model/sliding'
import {
  runnerPlayCallSoundIdOf,
  slidingRunnerOf,
  type RunnerPlayTickSound,
} from '@/features/defense-play/model/runnerPlayEngine'
import { planThrow, readyTicksOf, thrownWith, throwTicksTo } from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import {
  holderMarkOf,
  viewStateOf,
  type ActionMemory,
  type DefensePlayView,
} from '@/features/defense-play/model/defensePlayView'
import {
  FUMBLE_MARK_TICKS,
  THROW_ERROR_MARK_TICKS,
  tickMarkCounter,
} from '@/features/defense-play/model/playerEffects'
import { drawDefenseScene, enterDefenseScene, type DefenseScene } from '@/features/defense-play/model/defenseScene'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'
import {
  cpuSpecialThrowOf,
  type DefenseKeyPress,
  type DefensePlayControls,
  type DefensePlayResult,
} from '@/features/defense-play/model/runDefensePlay'
import { inPlayCommandOf } from '@/entities/defense-controls/model/defenseKeys'
import { runnerFateOf } from '@/features/defense-play/model/runnerFates'
import {
  bounceOffFielder,
  chaseLooseBall,
  type LooseBallChase,
} from '@/features/defense-play/model/looseBallChase'
import { forecastOptionsOf, launchThrow } from '@/features/defense-play/model/throwLaunch'
import {
  PITCHER_BALL_POINT,
  runCoverTick,
  runnerPlayBallInput,
  type CurrentBallPath,
} from '@/features/defense-play/model/coverTick'

/**
 * **견제 한 판** — 플레이 종류 4 를 틱 단위로 돌린다 (0x50f28 → 상태 0x17 → 0xb28be · 0xb47da · 0xb4292).
 *
 * 타구 진행기 `runDefensePlay` 와 따로 둔 까닭: 그쪽은 "목록 0번 = 타자주자 · 타구 궤적 · 포구 예보" 를
 * 전제로 짜여 있는데 견제에는 셋 다 없다. 원본도 같은 플레이 객체를 쓰되 **종류별 시작(vt0x18)** 이 갈라져
 * 종류 4 는 타자주자를 만들지 않고(0x46418 의 0xa93ac 는 종류 1 전용 길) 투수가 공을 쥔 채 시작한다.
 *
 * ## 원본 흐름 (전부 문서 근거 — S8 3절·6절 · I-controls 4a·2b)
 * 1. **시작 0xb28be**: 공 쥔 야수 = 투수(P+0x130 = 0) · 쥠(P+0x12c = 1) · state[0x1e] = 1 ·
 *    야수 1~4 를 루 0~3 좌표(0xd86b0 = 0xd78f0)에 놓고(0xbef58) 커버 = 루번호+1 · 투수 AI 상태 0xe.
 *    → `entities/fielding/model/pickoff.startPickoff` 가 그대로 만든다.
 * 2. **상태 0x17 진입 0x46418**: 주자 고리 0x4657e 가 주자마다 `0x3d7b8` — 다음 루로 5 틱(1% 로 10 틱) 몰아
 *    돌리고 목표를 닿은 루로 되돌린다(9976cb7, `runnerLead`). 이어 0x4677a 가 살아 있는 주자를 모두
 *    `vt0x48(+0x8c)` = 마지막으로 닿은 루로. 정정: S8 6-3 의 "리드 폭이 없다" 는 이 고리를 놓친 것 — 판이 열리면
 *    주자는 루를 떠나 돌아오는 중이라 **태그될 수 있다**.
 * 3. **AI 상태 0xe 0xb47da**: `플레이.vt0x58(state[0x27])` = 0xb2c90 → 커버가 있고 그 커버의 목표 루가
 *    대상 루면 던진다. 던지기는 야수 vt0xac = 0xa1620 이고 그 안에서 **악송구 굴림 0xa1828** · 긴 송구 흔들림 a198c 가 돈다.
 *    공은 세계 0xbfed0 으로 깔리고 받는 점이 끼워 넣어지며(b2f9c, `launchThrow`) 예보 vt24(0) · 고르기 vt34 가 받을(주울)
 *    야수 · 포구 틱을 정한다(`chaseLooseBall`) — 타구 진행기 송구와 같은 길이다.
 * 4. **아웃 판정 0xb36d0** 이 틱마다 그대로 돈다 — 거르개 0x58d 에 4 가 없다(I 3c). 루에 닿은 주자는
 *    "아직 움직이는 중" 이 아니라 안 죽지만, 리드에서 돌아오는 중에 공이 오면 태그(≤499)로 죽는다.
 * 5. **포구 틱 갈래 0xb401c**: 펌블 굴림 b4224(늘 먹는다 — 움직이는 공이면 펌블 0xbc2 → 틱 끝 0xb3148 튕김) →
 *    **b4292**: 받은 야수가 루 b 위(vt0x58, 좌표 완전일치)에 서 있고 `0xa97a0`(b 에 마지막으로
 *    닿은 산 주자)가 제 목표점에 서 있으면(vt0x18) **결과 코드 9 = 세이프** → 0x51c14 → 소리 17 · 쥐기 0xb2710 · vt90.
 *
 * ## 난수 — 이 판이 굴리는 것
 * 판이 열릴 때 주자마다 리드 덧틱 `rand(0,100)` 한 번(0x3d7b8, 목록 차례) → **악송구 굴림 한 번**(`rand(0,10000)`),
 * 악송구면 넷 더(수평·수직 속도 · 방향 크기 · 부호, `errantThrowFlight`), 아니면 8200 넘는 송구면 흔들림 굴림 하나(a198c) ·
 * 세계 안 폴 충돌(드묾) → 받는(줍는) 포구 틱마다 펌블 굴림 하나 · 펌블이면 튕김 rand(−20, 20). 이어 던지기도 같다.
 *
 * ## 근사·미해결 (지어내지 않은 자리)
 * - ⚠️ 야수 이동이 슬롯 2 뒤라(타구 진행기와 같은 다리) 고른 야수는 포구 틱에 포구 지점(x, 0, z)으로 옮겨 쥔다.
 * - ⚠️ 중계 이어 던지기(b4616)는 이 판에 없다 — 중계맨이 받으면 쥐기의 +0x128 로 CPU 송구 결정이 다시 고른다.
 * - **커버 야수의 AI 상태**: 0xb28be 는 커버를 루 위에 놓기만 하고(0xbef58, b2908~b2930) AI 상태를 따로 쓰지 않는다.
 *   (예전 웹은 "보내고" 를 목표점 걷기로 읽었다 — 0xbef58 은 기반 캐릭터의 위치 · 기준점 · 목표를 함께 놓는 함수다)
 *   그 뒤 첫 틱부터 vt4c 끝(b4c72)의 0xb1c90 이 매 틱 커버를 다시 골라 b2564 가 AI 루 + 2 를 주고, 2루 커버가 아닌 유격수는
 *   0xb203a 로 기본 자리 0xd8764 에 간다(`coverTick.runCoverTick`, r162). 견제 시작은 vt30 을 부르지 않는다(b2942 → b29ec)
 * - ⚠️ **레이저 굴림(0x66a8c)을 안 굴린다**: 창 0xb2648 이 보는 포구 틱(P+0x174)을 견제 시작이
 *   세우지 않아 그 값이 무엇인지 문서에 없다. 굴림 차례를 지어 넣지 않는다 — **미해결**.
 * - 메시지 처리기 0x509a0 앞머리는 CPU 송구 결정이 아니라 경기 로직의 빈 함수 0xae5f8 을 부른다(S8 4-3 정정,
 *   `runDefensePlay` 의 `throwMode` 주석). 0xafa60 을 부르는 곳은 둘이다 — 견제 아웃(결과 13) 뒤 결과 메시지 0xbba 의
 *   한 번(사람·CPU 모두)과 슬롯 2 의 매 틱(`0xae6c8` = 수비 CPU || 송구 설정 자동, `defenseIsCpu` · `throwMode`).
 *   받은 야수는 쥐기 0xb2710 이 +0x128 = 1 · 준비 틱 3 을 넣어, 준비가 끝난 틱에 점수식이 루를 고르면 0xb2c90 →
 *   0xb2e38(AI 9 미루기 · 악송구 굴림 · 던진 야수 AI 0)로 이어 던진다. ⚠️ 부르는 쪽(경기 흐름들)이 아직 수비 CPU·송구
 *   설정을 안 넘긴다 — 안 넘기면 슬롯 2 갈래는 안 돈다. 표본에서는 그 갈래가 돌아도 점수식이 던질 루를 못 찾는다.
 * - **사람 조작**: 견제 중 사람 키(송구 0x588)는 받지 않는다. 공은 처음부터 대상 루로 가고 있고 포구 틱에
 *   판정이 끝나므로(결과 9) 바꿀 것이 없어서, 이 판은 **미리 끝까지 돌려** 재생만 한다.
 */

/** 진행기가 이 틱을 넘기면 끊는다 — 우리 쪽 안전망 (타구 진행기 240 과 같다) */
const MAXIMUM_TICKS = 240
/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
const DEFAULT_ABILITY = 500
/** 투수 칸 */
const PITCHER_SLOT = 0
/** 결과 코드 — 9 세이프(0xb4292) · 13 아웃(0xb4556) */
export const PICKOFF_RESULT = { SAFE: 9, OUT: 13 } as const
export type PickoffResultCode = (typeof PICKOFF_RESULT)[keyof typeof PICKOFF_RESULT]

/** 판정 콜 — 0x51c14 머리 세 줄이 종류 4·5 를 따로 빼 **다른 검사 없이** `movs r1,#0x11` 로 간다 */
const SAFE_CALL = 17
/** 아웃 콜 — 0x51b36: state[0x1f](뜬공 포구)·state[0x87](마지막 판정이 태그) 중 하나면 62, 아니면 20 */
const CAUGHT_OUT_CALL = 62
const FORCE_OUT_CALL = 20

export interface PickoffPlayInput {
  /** state[0x27] — 견제 대상 루 */
  readonly targetBase: PickoffBase
  /** 견제 때 루 상황 */
  readonly bases: BaseState
  readonly outs: number
  /** 수비 9명 능력치 (칸 순서). 칸 0(투수)은 원본 그대로 레코드 칸 2 를 읽는다(`defenseAbilitiesOf`) */
  readonly defenseAbilities?: readonly number[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /**
   * **주자 속도의 팀 등급** (주자 만들기 0xa93ac a9488 — `runnerTeamGradeOf`): 모드 1·2·8 에서 공격 팀 '근성' 등급.
   * 모든 주자(타자주자 포함) 속도에 더한다. 안 주면 0(그 밖의 모드와 같다)
   */
  readonly runnerTeamGrade?: number
  /** 주자들의 주루 능력치 */
  readonly runAbility?: number
  /** 루별 주자 주루 (1~3). 없는 루는 `runAbility` — 루에 선 주자는 제 타석 0xa93ac 가 적은 주자+0xa4 를 들고 있다 */
  readonly runAbilities?: Partial<Record<1 | 2 | 3, number>>
  /** 주면 악송구 굴림(0xa1828)이 돈다 */
  readonly random?: RandomPort
  /** `0xae690` 앞 항 — 공격이 CPU 인가 (자동 진루 제어기 0xaf918 을 켜는 조건) */
  readonly offenseIsCpu?: boolean
  /** 주루 설정 +0xbd. 안 주면 자동 */
  readonly runningMode?: ManualAutoMode
  /**
   * `0xae6c8` 앞 항 — 수비가 CPU 인가. 송구 설정(`throwMode`)과 함께 슬롯 2 의 매 틱 CPU 송구 결정 0xafa60 을 켠다.
   * 안 주면 사람 수비(그 갈래가 안 돈다 — 지금까지와 같다).
   */
  readonly defenseIsCpu?: boolean
  /** 송구 설정 +0xf4 (원본 기본 수동) — `0xae6c8` 뒤 항 */
  readonly throwMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`) */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (`DefensePlayInput.runnerAces`) */
  readonly runnerAces?: RunnerAces
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
  /**
   * 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`). 견제는 투구(0x10 · 0x11)를 안 지나 +0x1997 · 판정 애니를
   * 되감지 않는 것으로 본다(유력 — 견제 키 0xf → 0x17 길을 다 뜨지 않았다)
   */
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  readonly scene?: DefenseScene
  /**
   * 사람 조작 — 이 판 동안 틱마다 눌린 키. 상태 0x17 키 0x53420 은 판 종류를 안 가린다 — 사람이 수비면 0x533c8 이
   * 메시지 0x588 → 플레이 vt60 → +0x160, 종류 4 는 vt4c 가 도니 b4660 이 준비된 쥔 야수를 그 루로 보낸다.
   * 사람이 공격(`side: '공격'`)이면 같은 키가 주루 0x5331c(0x582 진루 · 0x584 귀루 → 0xa9b04, 종류 4 는 마스크 0x232 안이라
   * 먹는다) · OK 슬라이딩 0x585(0x518da — 종류 2 · 3 만 막는다)다(`entities/fielding/model/baserunningKey`).
   */
  readonly controls?: DefensePlayControls
}

export interface PickoffPlayResult extends DefensePlayResult {
  readonly targetBase: PickoffBase
  /** 9 세이프 · 13 아웃 · null(포구 판정 없이 끝남 — 악송구) */
  readonly resultCode: PickoffResultCode | null
}

interface PickoffRunner {
  state: RunnerState
  counted: boolean
  /** 주자 +0x3b — 마지막 목록 틱(이동)에서 목표 루에 막 닿았다. 득점 0xaa0a8(aa12a)이 본다 */
  arrivedThisListTick: boolean
  /** 주자 +0x84 — 직전 목표 루 (`runnerPlayEngine` 의 같은 칸). 사람 진루 키의 앞길 검사가 본다 */
  previousTarget: number
}

/**
 * 견제 한 판을 끝까지 돌린다. 경기 상태는 건드리지 않고 결과(`advance`)만 돌려준다.
 */
/** 견제 판을 한 틱씩 돌리는 손잡이 (`runnerPlayEngine.RunnerPlayStepper` 와 같은 꼴) */
export interface PickoffPlayStepper {
  readonly tick: number
  readonly finished: boolean
  readonly ticks: readonly DefensePlayView[]
  /** 방금 돈 틱에서 슬라이딩 효과음 10 을 낸다 — 사람 슬라이딩 키 0x518da → 0x5199c(+0x31c 잠금, 한 판 한 번) */
  readonly slidingSoundThisTick: boolean
  /** 방금 돈 틱에 낸 소리 — 낸 차례대로 (슬라이딩 키 → 결과 메시지 0xbba 의 판정 콜, `runnerPlayEngine.RunnerPlayStepper` 와 같다) */
  readonly soundsThisTick: readonly number[]
  step(press: DefenseKeyPress | null): void
  result(): PickoffPlayResult
}

export function startPickoffPlay(input: PickoffPlayInput): PickoffPlayStepper {
  const ticks: DefensePlayView[] = []
  const sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] }
  const steps = pickoffPlaySteps(input, ticks, sound)
  let current = steps.next(null)
  return {
    get slidingSoundThisTick() {
      return sound.slidingThisTick
    },
    get soundsThisTick() {
      return sound.thisTick
    },
    get tick() {
      return current.done === true ? ticks.length : current.value
    },
    get finished() {
      return current.done === true
    },
    ticks,
    step(press) {
      if (current.done === true) return
      current = steps.next(press)
    },
    result() {
      if (current.done !== true) throw new Error('견제 판이 아직 안 끝났다')
      return current.value
    },
  }
}

export function runPickoffPlay(input: PickoffPlayInput): PickoffPlayResult {
  const stepper = startPickoffPlay(input)
  while (!stepper.finished) stepper.step(input.controls?.keyAt(stepper.tick) ?? null)
  return stepper.result()
}

function* pickoffPlaySteps(
  input: PickoffPlayInput,
  ticks: DefensePlayView[],
  sound: RunnerPlayTickSound = { slidingThisTick: false, thisTick: [] },
): Generator<number, PickoffPlayResult, DefenseKeyPress | null> {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const speedOf = (base: 1 | 2 | 3) =>
    runnerSpeedOf(input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY, input.runnerTeamGrade ?? 0)
  const autoBaserunningEnabled = input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동'
  const targetBase = input.targetBase
  const log: string[] = []
  const previousActions: ActionMemory = new Map<string, { action: number; since: number }>()

  // ── 1. 시작 0xb28be ──
  const start = startPickoff(targetBase)
  let fielders: readonly FielderState[] = createFielders(abilities, input.defenseTeamBonus ?? 0).map((fielder) => {
    if (fielder.slot === PITCHER_SLOT) {
      return { ...fielder, holdingBall: true, aiState: start.pitcherAiState }
    }
    const goal = start.coverTargets.get(fielder.slot)
    if (goal === undefined) return fielder
    // b2908~b2930: 야수(b + 1) 에 0xbef58(야수, 0xd86b0[b]) — 기반 캐릭터 "놓기"(위치 · 기준점 · 목표 +0x2c 를 그 점으로)라
    // 커버는 판이 열리는 순간 **루 위에 서 있다**(걸어가는 것이 아니다)
    return { ...fielder, position: goal, target: goal, targetBase: start.play.coverOfBase.indexOf(fielder.slot) }
  })
  // `manualThrowBase` 는 다리다(startPickoff 주석) — 웹 수비 판단 함수들이 사람 목표로 읽지 않게 지운다.
  // 대상 루는 이 함수의 `targetBase`(= state[0x27]) 가 들고 있다.
  let play: PlayView = { ...initialPlayView(start.play.kind), ...start.play, manualThrowBase: NONE }

  // ── 2. 상태 0x17 진입 0x46418 — 주자 고리 0x4657e 의 0x3d7b8: 주자마다 다음 루로 `0xcffac`[루] = 5 틱
  //    (+5 if rand(0,100) == 0) 몰아 돌린 뒤 목표를 닿은 루(+0x8c)로 되돌린다 → 판이 열리면 제 루로 돌아오는 중.
  //    그 뒤 0x4677a 가 살아 있는 주자를 모두 vt0x48(+0x8c) — 같은 목표다.
  // 목록은 루 순서(1·2·3) — 원본 0xa9a10 이 3·2·1 순으로 맨 앞에 끼워 넣어 같은 순서가 된다.
  // 번호는 1 부터 센다 — 0 은 타자주자 자리라 그림(`viewStateOf`)이 타자로 그리지 않게 비워 둔다.
  // 굴림: 주자마다 rand(0,100) 한 번(목록 차례) — 송구의 악송구 굴림(첫 틱)보다 앞이다.
  const runners: PickoffRunner[] = []
  ;([1, 2, 3] as const).forEach((base) => {
    const occupied = base === 1 ? input.bases.first : base === 2 ? input.bases.second : input.bases.third
    if (!occupied) return
    const runner = createRunner(runners.length + 1, base, speedOf(base), { isBatterRunner: false })
    const lead = runnerLeadOf(runner, { playKind: PICKOFF_PLAY_KIND, stealing: false, random: input.random })
    const led = applyRunnerLead(runner, lead)
    runners.push({ state: led, counted: false, arrivedThisListTick: false, previousTarget: previousTargetAfterLead(led) })
  })

  let outs = input.outs
  let outsAdded = 0
  let runsScored = 0
  /** 주자관리+0x31c — 사람 슬라이딩 키의 효과음 잠금(한 판 한 번). 0x17 진입 0xa9fd0 이 지운다 */
  let slidingSoundPlayed = false
  let tagOut = false
  let throwArrivalTick = -1
  let errantThrow = false
  let fumbled = false
  let resultCode: PickoffResultCode | null = null
  /** 날아가는 송구 — 견제 송구와 그 뒤 받은 야수의 이어 던지기 (0xb2e38). 그림 · 던지는 동작만 본다
   *  (닫힘 안에서 바뀌어 흐름 좁히기가 못 따라간다 — 넓은 꼴로 둔다) */
  let flight = null as { from: number; base: number; releaseTick: number } | null
  /** 이번 틱에 공을 던진 야수 — 던지기 0xa1620 끝(a1a3a)의 +0xb1 잠금 (U-78) */
  let thrownThisTick: number = NONE
  /** 쫓는 공 — 송구공(b307c) · 튕긴 공(0xb3148). 받을(주울) 야수 · 포구 틱. 쥐면 null */
  let chase = null as LooseBallChase | null
  /** 공 객체 칸 — 다음 쏘기가 이어 받는다 */
  let ballBody: LooseBallChase['body'] = undefined
  /** 지금 공 궤적(공.vt68(0) · 공.vt60) — 송구 · 튕김이 새로 깐다. 그 전에는 0xa276c 의 점 하나(투수판 0xd7c24 · 각 0) */
  let ballPath: CurrentBallPath | null = null
  /** 플레이 +0x126 — 판 시작 vt20(b28cc → b11fe)이 1. 0xb203a 가 중계 자리를 잡으면 0 */
  let relayFlag = true
  /** 처음 공을 쥔 틱 */
  let catchTick = -1
  /** sp+0x24 — 이번 틱 포구 틱의 사건(펌블 0xbc2). 서면 틱 끝 b45a4 가 0xb3148 */
  let ballEventThisTick = false
  /** 플레이 +0x120 — 판 진행 관문 0xb0d28 의 판 끝 세기 */
  let endCounter = 0
  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 결과 메시지 0xbba */
  let outJudgedThisTick = false
  /** 이번 틱 플레이 틱이 보낼 결과 메시지 0xbba 의 코드 — 포구 b4292 의 9 를 b4540 의 13 이 덮는다(b4562 에서 한 번) */
  let tickMessageCode = 0
  /** 수비 장면 연출 칸 — 0x17 진입 0x46418 이 결과 판 타이머를 −1 로 (`defenseScene`) */
  let scene = enterDefenseScene(input.scene, false)
  /** 플레이+0x160 — 판을 넘어 남는 사람 송구 목표 (`DefenseScene.throwTarget`). 키 메시지 0x588 이 쓰고 b46a8 이 −1 */
  let manualThrowBase = scene.throwTarget
  /** state[0x8b] — 결과 판 큰 OUT 이 +0x1999 를 보고 세운다 */
  let laserOutFlag = false
  /** +0x15c · +0x158 — 0xb2e38 이 미룬 송구(AI 9)의 받을 야수 · 목표 루 */
  let deferredThrowReceiver = NONE
  let deferredThrowBase = NONE
  /**
   * **그림 전용** 경기+0x19ac — 쥐기 0xb2710 의 메시지 0x15 가 세우고 0x17 진입 0x467de 가 내린다. 판 시작에 투수가 쥔 공
   * (0xb28be)은 0x46418 안에서 0x467de 보다 앞이라 지워진다 — 견제 송구를 받은(주운) 야수가 쥘 때 선다
   */
  let grabbed = false
  /** **그림 전용** 야수 +0xb8(펌블 표시) · +0xc0(송구 실수 표시) — `runDefensePlay` 와 같은 칸 */
  let fumbleMarks: number[] = Array.from({ length: fielders.length }, () => 0)
  let throwErrorMarks: number[] = Array.from({ length: fielders.length }, () => 0)
  const markSlot = (marks: number[], slot: number, value: number) =>
    marks.map((current, index) => (index === slot ? value : current))
  const runnerAceIndexes = runnerAceIndexesOf(input.runnerAces, input.bases)
  const runnerAceSprite = loadedRunnerAceOf(input.runnerAces, input.bases)
  // `0xae6c8`([장면+0x214], 설정+0xf4) — 수비가 CPU 거나 송구 설정이 자동이면 슬롯 2 의 0xafa60 이 매 틱 돈다
  const cpuThrowEnabled = input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동'

  const runnerStates = () => runners.map((runner) => runner.state)
  const contextAt = (tick: number): DefenseContext => ({
    play,
    fielders,
    runners: runnerStates(),
    currentTick: tick,
    // 공은 처음부터 쥐어져 있다 — 낙구 틱은 0 으로 둔다 (자동 진루의 "잡힐 뜬공" 갈래가 안 서게)
    landingTick: 0,
  })
  /**
   * 플레이 vt30 = 0xb1c90 한 번 (`coverTick.runCoverTick`) — vt4c 끝 b4c72(매 틱) · 송구 꼬리 b3094. 견제 시작 0xb28be 는 부르지 않는다.
   * 0xb203a 의 자동 고리가 보는 +0x160 은 이 진행기의 `manualThrowBase` 다(`play.manualThrowBase` 는 다리라 비워 둔다 — 머리말)
   */
  const coverTick = (tick: number): void => {
    const context = contextAt(tick)
    const covered = runCoverTick({
      context: { ...context, play: { ...context.play, manualThrowBase } },
      ...runnerPlayBallInput(ballPath, PITCHER_BALL_POINT, tick),
      relayFlag,
    })
    play = { ...covered.play, manualThrowBase: NONE }
    fielders = covered.fielders
    relayFlag = covered.relayFlag
  }

  /** 0xb36d0 한 번 — 타구 진행기의 `runOutJudgement` 와 같은 자리, 다만 타자주자 제외가 없다 */
  /** 바로 앞 0xb36d0 한 번의 결과 — 같은 플레이 틱의 두 번째 판정이 state[0x87] 을 다시 적는다(타구 진행기 `grabOutThisTick`) */
  let lastJudgedKind: number = OUT_KIND.NONE
  const runOutJudgement = (tick: number): void => {
    if (play.finished) return
    const judged = judgeOut(contextAt(tick))
    lastJudgedKind = judged.kind
    if (judged.kind === OUT_KIND.NONE) return
    const victim = runners[judged.runnerIndex]
    if (victim === undefined || victim.state.isOut) return
    victim.state = { ...victim.state, isOut: true, settled: true }
    outs += 1
    outsAdded += 1
    outJudgedThisTick = true
    tagOut = judged.kind === OUT_KIND.TAG
    resultCode = PICKOFF_RESULT.OUT
    log.push(`${tick}틱 ${victim.state.index}번 주자 견제사 (0xb36d0 결과 ${judged.kind})`)
    const relaxed = releaseForcesAfterOut(runnerStates())
    runners.forEach((runner, index) => {
      runner.state = relaxed[index] ?? runner.state
    })
  }

  /** 공 가진 야수 vtC4 — 쥐었고 준비 틱(+0xc8)이 다 줄었나 */
  const isHolderReady = (): boolean => {
    const holder = fielders[play.ballHolderSlot]
    return play.held && holder !== undefined && holder.holdingBall && holder.actionRemainingTicks <= 0
  }

  /**
   * 받은 야수의 이어 던지기 — 루로 보내기 0xb2c90 · 송구 0xb2e38 (`runDefensePlay` 의 sendToBase · throwBall 과 같은 갈래).
   * 커버 없음 → 공 든 채 그 루로(0) · 커버의 목표 루 ≠ 루(0) · 직접 밟는 게 빠름(1) · 600 이하 · 자기 자신(0) ·
   * 받는 야수가 1구간 틱 안에 못 닿음 → AI 9 로 미룸(1) · 그 밖 던진다(악송구 굴림 0xa1828)(1), 던진 야수는 AI 0.
   */
  const sendToBase = (tick: number, base: number, chooser: string, cpuSpecial: boolean): boolean => {
    const holderSlot = play.ballHolderSlot
    const holder = fielders[holderSlot]
    if (holder === undefined) return false
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    const basePoint = basePosition(base)
    if (coverSlot === NONE) {
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot ? { ...fielder, target: basePoint, targetBase: base } : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루로 공을 들고 뛴다 (커버 없음)`)
      return false
    }
    const cover = fielders[coverSlot]
    if (cover === undefined || cover.targetBase !== base) return false
    const runTicks = ticksToReach(holder.position, basePoint, holder.speed)
    if (runTicks <= Math.max(throwTicksTo(holder, cover.target), fielderArrivalTicks(cover))) {
      // 0xb2a48(P, f, 루) — 옛 커버 C(f 가 아니면) AI 0 · +0xf0[루] = f · f.vt48(루) · f AI 루 + 2
      if (coverSlot !== holderSlot) {
        const coverOfBase = [...play.coverOfBase]
        coverOfBase[wrapBase(base)] = holderSlot
        play = { ...play, coverOfBase }
      }
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot
          ? { ...fielder, target: basePoint, targetBase: base, aiState: AI_STATE.COVER_HOME + wrapBase(base) }
          : fielder.slot === coverSlot && coverSlot !== holderSlot
            ? { ...fielder, aiState: AI_STATE.IDLE, target: FIELDER_START_POSITIONS[fielder.slot] ?? fielder.target, targetBase: NONE }
            : fielder,
      )
      if (runTicks > 0) log.push(`${tick}틱 ${holderSlot}번 야수가 ${base}루를 직접 밟으러 간다`)
      return true
    }
    if (coverSlot === holderSlot || horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE) {
      return false
    }
    // ── 0xb2e38 ──
    if (!holder.holdingBall || holder.actionRemainingTicks > 0) return false
    const plan = planThrow({ fielders, fromSlot: holderSlot, finalSlot: coverSlot, base, special: cpuSpecial })
    const receiver = fielders[plan.toSlot]
    if (
      receiver !== undefined &&
      !isSamePoint(receiver.position, receiver.target) &&
      fielderArrivalTicks(receiver) > plan.firstLegTicks
    ) {
      if (holder.aiState === AI_STATE.RECEIVE) return false
      deferredThrowReceiver = plan.toSlot
      deferredThrowBase = plan.base
      fielders = fielders.map((fielder) =>
        fielder.slot === holderSlot
          ? { ...fielder, aiState: AI_STATE.RECEIVE, target: basePosition(plan.base), targetBase: wrapBase(plan.base) }
          : fielder,
      )
      log.push(`${tick}틱 ${holderSlot}번 야수가 ${plan.base}루 송구를 미룬다 — ${plan.toSlot}번 야수가 늦다 (AI 9)`)
      return true
    }
    const special = cpuSpecial ? cpuSpecialThrowOf(fielders, holderSlot, coverSlot) : null
    const isSpecial = special !== null && special.special
    // a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4
    fielders = fielders.map((fielder) => (fielder.slot === holderSlot ? thrownWith(fielder, isSpecial) : fielder))
    // 0xa1620 · 세계 · 받는 점 끼워 넣기 — 공은 계획 [3](중계면 중계맨)의 목표점으로 (b2f52)
    const thrown = launchThrow({
      thrower: fielders[holderSlot],
      target: fielders[plan.toSlot]?.target ?? basePosition(base),
      special: isSpecial,
      bounce: isSpecial && special.bounce,
      ability: fielderAbilityOf(abilities, holderSlot, DEFAULT_ABILITY),
      random: input.random,
      body: ballBody,
    })
    if (thrown.errant) errantThrow = true
    // a1908(악송구) · a17fc(원바운드) — 던진 야수 +0xc0 = 4 (그림 0x438c4 의 "!")
    if (thrown.errant || thrown.bounce) throwErrorMarks = markSlot(throwErrorMarks, holderSlot, THROW_ERROR_MARK_TICKS)
    // b307c vt24(0) · vt34 — 받을(주울) 야수 · 포구 틱
    takeLooseBall(chaseLooseBall(thrown.ball, tick, fielders, forecastOptionsOf(thrown, holderSlot, coverSlot), MAXIMUM_TICKS))
    // b188a — 송구 예보가 두 번째 패스로 가면 그때의 +0x130(던진 야수 — b307c 앞)의 +0xc0 = 4
    if (chase?.secondPassStarted === true) throwErrorMarks = markSlot(throwErrorMarks, holderSlot, THROW_ERROR_MARK_TICKS)
    flight = { from: holderSlot, base, releaseTick: tick }
    thrownThisTick = holderSlot
    // b2f80 · b3070 손을 떠난다
    fielders = fielders.map((fielder) =>
      fielder.slot === holderSlot ? { ...fielder, holdingBall: false, actionRemainingTicks: 0 } : fielder,
    )
    // b3094 vt30 = 0xb1c90 한 번 — 고르기 vt34 뒤의 공 가진 야수(받을 야수)로 커버를 다시 고른다(`coverTick.runCoverTick`)
    coverTick(tick)
    // b2df8~b2e14 — 던진 야수가 커버(0xa0ff4 — AI 2~5)도 AI 9 도 아니면 AI 0 (시작 자리로)
    fielders = fielders.map((fielder) => {
      if (fielder.slot !== holderSlot) return fielder
      const keeps =
        (fielder.aiState >= AI_STATE.COVER_HOME && fielder.aiState <= AI_STATE.COVER_THIRD) ||
        fielder.aiState === AI_STATE.RECEIVE
      return keeps
        ? fielder
        : { ...fielder, aiState: AI_STATE.IDLE, target: FIELDER_START_POSITIONS[holderSlot] ?? fielder.target, targetBase: NONE }
    })
    log.push(
      (chooser === PICKOFF_THROW
        ? `${tick}틱 ${base}루 견제 송구 — ${chase?.catchTick ?? tick}틱 도착`
        : `${tick}틱 ${holderSlot}번 야수가 ${base}루로 송구 — ${chase?.catchTick ?? tick}틱 도착`) +
        (cpuSpecial ? ' (특수)' : '') +
        (thrown.bounce ? ' (원바운드)' : '') +
        (thrown.errant ? ' (악송구)' : thrown.wobbled ? ' (흔들린 긴 송구)' : '') +
        (chase !== null && chase.slot !== coverSlot ? ` (${chase.slot}번 야수가 줍는다)` : '') +
        (chooser === PICKOFF_THROW ? '' : chooser),
    )
    return true
  }

  /**
   * 새로 깐 공을 쫓게 한다 — 고르기 0xb3b38: AI 1 · 0xc 인 야수는 AI 0 으로, 고른 야수(+0x130)는 AI 1 · 목표 = 포구 지점(x, 0, z).
   * 공은 아무도 안 쥔다(b2f80 · b3070 · 0xb3148).
   */
  const takeLooseBall = (next: LooseBallChase): void => {
    chase = next
    ballBody = next.body
    ballPath = { trajectory: next.trajectory, startTick: next.startTick }
    fielders = fielders.map((fielder) =>
      fielder.slot === next.slot
        ? { ...fielder, target: next.catchPoint, aiState: AI_STATE.CHASE, holdingBall: false }
        : fielder.aiState === AI_STATE.CHASE || fielder.aiState === AI_STATE.BACKUP
          ? { ...fielder, aiState: AI_STATE.IDLE, holdingBall: false }
          : fielder.holdingBall
            ? { ...fielder, holdingBall: false }
            : fielder,
    )
    play = { ...play, held: false, ballHolderSlot: next.slot, catchFielderSlot: next.slot, catchTick: next.catchTick }
  }

  /** CPU 송구 결정 0xafa60 — +0x128 && 준비 && AI ∉ {8, 9} 일 때 점수식 0xafb24, 홈이면 특수 굴림, 0xb2c90 이 성공하면 +0x128 = 0 */
  const cpuThrowDecision = (tick: number): void => {
    if (!play.wantsThrow || !isHolderReady()) return
    if (fielders[play.ballHolderSlot]?.aiState === AI_STATE.RECEIVE) return
    const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
    const base = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
    if (base === NONE) return
    const cpuSpecial =
      base === 0 && input.random !== undefined && isSpecialThrow(base, input.random.rand(0, 100))
    if (sendToBase(tick, base, ' (CPU 결정)', cpuSpecial)) play = { ...play, wantsThrow: false }
  }

  // ── 0x46766 — 0x17 진입 0x46418 끝: 관문 0xb0d28 이 열려 있으면 `0xaf8c0(제어기, 1)` 한 번(주루 설정 갈림 없음).
  //    결정마다 +0x128 = 1(afa0e). 목표는 바로 뒤 4677a~467a4 가 종류 4 면 산 주자 넷 모두 vt48(+0x8c) 로 되돌리므로
  //    (위 2 절 "제 루로 돌아오는 중") 견제 판에서는 남지 않는다 — 여기서도 목표를 안 바꾼다. 굴림 없음.
  if (autoAdvanceDecisions({ ...contextAt(0), force: true }).length > 0) play = { ...play, wantsThrow: true }

  for (let tick = 0; tick <= MAXIMUM_TICKS && !play.finished; tick += 1) {
    const press = yield tick
    sound.slidingThisTick = false
    sound.thisTick = []
    outJudgedThisTick = false
    thrownThisTick = NONE
    tickMessageCode = 0
    // ── 야수 틱 0xa1284 — 공 쥔 야수의 준비 틱 +0xc8 −= 1 (공용 갱신 0x3f060 이 슬롯 2 보다 먼저, 타구 진행기 0' 절) ──
    // a12da · a12e6 — 동작 잠금(+0xb4)이 없는 틱에만 +0xb8 · +0xc0 을 −1 (그림의 "!" 만 본다)
    fumbleMarks = fumbleMarks.map((value, slot) => tickMarkCounter(value, (fielders[slot]?.actionLockTicks ?? 0) > 0))
    throwErrorMarks = throwErrorMarks.map((value, slot) => tickMarkCounter(value, (fielders[slot]?.actionLockTicks ?? 0) > 0))
    fielders = fielders.map((fielder) =>
      fielder.holdingBall && fielder.actionRemainingTicks > 0
        ? { ...fielder, actionRemainingTicks: fielder.actionRemainingTicks - 1 }
        : fielder,
    )
    ballEventThisTick = false
    // ── 2b. 사람 조작 — 수비면 0x533c8 → 메시지 0x588 → 0x51890 → 플레이 vt60 0xb3118 → +0x160 (판 종류를 안 가린다) ──
    if (press !== null && input.controls?.side === '수비' && !play.finished) {
      const command = inPlayCommandOf(press.key, '수비', { isHoldRepeat: press.isRepeat === true })
      if (command !== null && command.kind === '송구') {
        manualThrowBase = command.target
        log.push(`${tick}틱 사람이 ${command.target}루로 송구 지시`)
      }
    }
    // ── 2c'. 사람 조작 — 공격이면 0x53420 이 주루 0x5331c(0x582 진루 · 0x584 귀루) · OK 0x585(슬라이딩) ──
    if (press !== null && input.controls?.side === '공격' && !play.finished) {
      const command = inPlayCommandOf(press.key, '공격', { isHoldRepeat: press.isRepeat === true })
      if (command?.kind === '슬라이딩') {
        // 0x518da — 종류 4 는 막히지 않는다. 0xa96ec 로 슬라이딩이 걸린 뒤에야 소리 재생 중 · +0x31c 잠금을 본다
        const decision = slideOnKey({
          playKind: PICKOFF_PLAY_KIND,
          isFoulBattedBall: false,
          runners: runners.map((runner) => slidingRunnerOf(runner.state)),
          isSoundPlaying: false,
          hasPlayedSoundThisPlay: slidingSoundPlayed,
        })
        if (decision.playsSound) {
          slidingSoundPlayed = true
          sound.slidingThisTick = true
          sound.thisTick.push(SLIDING_SOUND_EFFECT)
        }
        for (const index of decision.slidRunnerIndexes) {
          const runner = runners[index]
          if (runner === undefined || runner.state.sliding) continue
          // 0xa04d0: +0xb8 = 1 · vt44(6) — 0xa0164 가 속도 = vt64() + 40
          runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
        }
        if (decision.slidRunnerIndexes.length > 0) log.push(`${tick}틱 슬라이딩 — 주자 ${decision.slidRunnerIndexes.join('·')}`)
      } else if (command?.kind === '진루' || command?.kind === '귀루') {
        // 0x5209e / 0x5222a → 0xa9b04 — 성공하면 플레이+0x128 = 1
        const keyed = applyBaserunningKey(
          {
            playKind: PICKOFF_PLAY_KIND,
            homeRunFlag: false,
            runners: runnerStates(),
            previousTargets: runners.map((runner) => runner.previousTarget),
          },
          command.kind,
          command.runner,
        )
        runners.forEach((runner, index) => {
          runner.state = keyed.runners[index] ?? runner.state
          runner.previousTarget = keyed.previousTargets[index] ?? runner.previousTarget
        })
        if (keyed.succeeded) {
          play = { ...play, wantsThrow: true }
          log.push(`${tick}틱 ${command.kind} 키 — 주자 ${keyed.retargeted.map((index) => runners[index]?.state.index).join('·')}`)
        }
      }
    }
    // ── 5. 포구 틱 갈래 0xb401c — 받는(줍는) 야수가 포구 틱(+0x174)에 ──
    // ```
    // b4224  r4 = 펌블표[등급] > rand(0, 10000)       ; 늘 먹는다
    // b4236  멈춤 = 공.vt18() ; r4 && !멈춤 → 메시지 0xbc2 · 사건 sp+0x24 = 1 (쥐지 않음)
    // b4292  아니면 b = 야수.vt58()(발밑 루) ; b ≠ −1 && 0xa97a0(b).vt18() → 결과 코드 9
    // b42c8  쥐기 0xb2710(P, f, 1) — +0x128 · 준비 틱(내야 3) · vt90
    // ```
    const current = chase
    if (current !== null && !play.held && tick === current.catchTick) {
      const ballIsMoving =
        current.trajectory.isStoppedAt === undefined
          ? tick < current.trajectory.length - 1
          : !current.trajectory.isStoppedAt(tick)
      if (input.random !== undefined && rollFumble(recordPlayerAbilityOf(abilities, current.slot, DEFAULT_ABILITY), ballIsMoving, input.random)) {
        fumbled = true
        ballEventThisTick = true
        // b4280 — 야수 +0xb8 = 6
        fumbleMarks = markSlot(fumbleMarks, current.slot, FUMBLE_MARK_TICKS)
        log.push(`${tick}틱 ${current.slot}번 야수 펌블 (0xbc2)`)
      } else {
        chase = null
        flight = null
        if (catchTick < 0) catchTick = tick
        const receiver = current.slot
        // 웹 다리: 야수 이동이 슬롯 2 뒤라 포구 틱에 포구 지점(AI 1 목표)으로 옮겨 쥔다
        fielders = fielders.map((fielder) =>
          fielder.slot === receiver
            ? {
                ...fielder,
                position: current.catchPoint,
                target: current.catchPoint,
                holdingBall: true,
                actionRemainingTicks: readyTicksOf(receiver),
              }
            : fielder.holdingBall
              ? { ...fielder, holdingBall: false }
              : fielder,
        )
        const footBase = baseUnderFoot(fielders[receiver])
        const onBase =
          footBase === NONE
            ? undefined
            : runners.find((runner) => !runner.state.isOut && wrapBase(runner.state.startBase) === footBase)
        play = { ...play, ballHolderSlot: receiver, catchFielderSlot: receiver, held: true, wantsThrow: true }
        // 쥐기 0xb2710 의 메시지 0x15 → 경기+0x19ac = 1
        grabbed = true
        log.push(`${tick}틱 ${receiver}번 야수가 공을 쥐었다`)
        runOutJudgement(tick)
        // b4292 — 발밑 루에 산 주자가 서 있는 포구는 결과 코드 9 (판 결과 칸은 첫 번째만 적지만 메시지는 포구마다 간다)
        if (onBase !== undefined && isAtTarget(onBase.state)) tickMessageCode = 9
        if (resultCode === null && onBase !== undefined && isAtTarget(onBase.state)) {
          resultCode = PICKOFF_RESULT.SAFE
          log.push(`${tick}틱 ${footBase}루 세이프 (결과 9)`)
        }
      }
    }

    // ── 아웃 판정 0xb36d0 — 플레이 틱 b43cc~b43ea (포구 갈래 뒤 · 같은 그림의 슬롯 2 — 이동 앞, 타구 진행기 6b 절) ──
    // 쥐기 판정(0xb2758)이 이 틱에 아웃을 냈으면 같은 플레이 틱의 두 번째 판정(b42f2 · b43de)이 머리 b36dc 에서 state[0x87] 을
    // 지우고 태그(3)일 때만 다시 세운다 — 결과 코드 13 은 b4540 에서 그 값을 읽는다(타구 진행기 6b 절)
    const grabbedOut = outJudgedThisTick
    lastJudgedKind = OUT_KIND.NONE
    runOutJudgement(tick)
    if (grabbedOut) tagOut = lastJudgedKind === OUT_KIND.TAG

    // ── 결과 메시지 0xbba(b4562) → 51a56 결과 판 칸 — 포구 b4292 의 9 를 b4540 의 13 이 덮는다. 0x51d40 송구보다 먼저 ──
    if (outJudgedThisTick) tickMessageCode = 13
    if (tickMessageCode !== 0) {
      scene = { ...scene, popup: postJudgeMessage(scene.popup, tickMessageCode, play.ballHolderSlot) }
      // 같은 메시지의 판정 스위치가 그 자리에서 콜을 낸다 — 종류 4 는 9 면 늘 17(0x51c14 51c1e), 13 이면 62/20(0x51b36)
      const call = runnerPlayCallSoundIdOf(tickMessageCode, tagOut)
      if (call !== null) sound.thisTick.push(call)
    }

    // ── 결과 메시지 0xbba — 견제사(결과 13) 뒤 0x51d40 이 `아웃 ≤ 2` 면 +0x128 = 1 · 0xafa60 한 번 (사람·CPU 모두) ──
    // 0xafa60 은 공 쥔 야수가 준비(+0xc8 ≤ 0)돼야 고른다. 견제사는 송구를 받는 틱(쥐기가 준비 틱 3 을 막 넣은 틱)이나
    // 돌아오는 주자가 닿는 한두 틱 뒤에 나서 준비가 안 끝나 있다 — 견제 3000판에서 한 번도 고르지 않는다.
    // 준비된 뒤 아웃이 나 점수식이 루를 고르면 위 0xb2c90 · 0xb2e38 로 이어 던진다.
    if (outJudgedThisTick && outs <= 2 && !play.finished) {
      play = { ...play, wantsThrow: true }
      cpuThrowDecision(tick)
    }

    // ── 플레이 틱 꼬리 b45a0(이 그림 그리기보다 먼저 — 깐 그림은 공+0x68 = 0 이라 공을 안 그린다) — 사건(펌블)이 있었으면 플레이.vt70 = 0xb3148: 공을 그 야수에게서 튕겨 다시 쏘고 vt24(1) · vt34 ──
    const fumbledBall = chase
    if (ballEventThisTick && fumbledBall !== null && !play.finished) {
      const bounced = bounceOffFielder(fumbledBall, tick, fielders[fumbledBall.slot].position, input.random)
      if (bounced !== null) {
        takeLooseBall(chaseLooseBall(bounced.ball, tick, fielders, { initialChaserSlot: fumbledBall.slot }, MAXIMUM_TICKS))
        flight = null
        log.push(
          `${tick}틱 공 튕김 (0xb3148) — 속도 ${bounced.speed} · v0 ${bounced.verticalSpeed} · 각 ${bounced.angle} · ` +
            `${chase?.slot ?? NONE}번 야수가 ${chase?.catchTick ?? tick}틱에 줍는다`,
        )
      }
    }

    // ── 득점 0xaa0a8 (슬롯 2 525fc — 플레이 틱 뒤 · vt4c 앞): 내림차순으로 +0x3b(목록 틱에 막 닿음) && +0x8c == 4 인 주자 ──
    // +0x3b 는 그림 N 의 목록 틱(앞 판 틱의 이동)에서만 선다 — 관문 G2 가 닫힌 그림은 0xaa0a8 을 안 부른다(타구 진행기 6f 절)
    for (let index = runners.length - 1; index >= 0; index -= 1) {
      const runner = runners[index]!
      if (runner.state.isOut || runner.state.scored || runner.counted || !runner.arrivedThisListTick) continue
      const touched = runner.state.startBase
      if (wrapBase(touched) !== 0 || touched === 0) continue
      // ⚠️ 2아웃 득점 보류(state[0])는 타구 진행기 몫이다 — 견제 중 홈인은 자동 진루가 3루 주자를
      // 보낸 경우뿐이라 여기서는 그대로 센다 (근사)
      runner.counted = true
      runner.state = { ...runner.state, scored: true }
      runsScored += 1
      log.push(`${tick}틱 ${runner.state.index}번 주자 홈인`)
    }

    // 2c · 3 · AI 9 는 플레이 vt4c 0xb45dc 다 — 슬롯 2 52612 라 플레이 틱(vt48) · 득점 0xaa0a8 뒤에 돈다
    // ── 2c. 사람 목표 +0x160 — 플레이 vt4c 0xb45dc 의 b4660~b46a8 (야수 고리의 AI 0xe b47da 보다 앞): 쥠 && 준비(vtC4)면
    //        발밑 루가 아닐 때 0xb2c90, 그리고 −1. 판 시작에 투수가 쥔 공(b29da vt88(0) — 준비 틱 0)도 이 갈래가 먼저 본다 ──
    if (!play.finished && manualThrowBase !== NONE && isHolderReady()) {
      const target = manualThrowBase
      manualThrowBase = NONE
      if (!isSamePoint(fielders[play.ballHolderSlot].position, basePosition(target))) {
        sendToBase(tick, target, ' (사람 송구 키)', false)
      }
    }
    // ── 3. AI 상태 0xe 0xb47da — 투수가 0xe 인 동안 매 틱 플레이.vt58(state[0x27], 0) = 0xb2c90 (직접 뜬 것, S8 3절) ──
    // 0xb2c90 → 0xb2e38: 커버(루 번호 + 1)가 1구간 틱 안에 루에 못 닿으면 AI 9 로 미루고(b30a2), 던지면 0xa1620(악송구 ·
    // 긴 송구 흔들림 굴림) · 세계 0xbfed0 · 받는 점(커버 목표 = 대상 루) 끼워 넣기 · 예보 vt24(0) · vt34, 던진 투수는 AI 0(b2df8)
    if (play.held && play.ballHolderSlot === PITCHER_SLOT && fielders[PITCHER_SLOT]?.aiState === AI_STATE.PICKOFF) {
      if (sendToBase(tick, targetBase, PICKOFF_THROW, false) && flight !== null && throwArrivalTick < 0) {
        throwArrivalTick = chase?.catchTick ?? tick
      }
    }

    // ── AI 9 — 미룬 송구 (b4838): 받을 야수.vtc0() ≤ 공 가진 야수.vtb8(루 좌표) 가 되면 0xb2c90(루, 0), 참이면 AI 0 ──
    if (!play.finished && deferredThrowReceiver !== NONE) {
      for (let slot = 0; slot < fielders.length; slot += 1) {
        if (fielders[slot]?.aiState !== AI_STATE.RECEIVE) continue
        const receiver = fielders[deferredThrowReceiver]
        const holder = fielders[play.ballHolderSlot]
        if (receiver === undefined || holder === undefined) continue
        if (fielderArrivalTicks(receiver) > throwTicksTo(holder, basePosition(deferredThrowBase))) continue
        if (sendToBase(tick, deferredThrowBase, ' (AI 9 미룬 송구)', false)) {
          fielders = fielders.map((fielder) =>
            fielder.slot === slot
              ? { ...fielder, aiState: AI_STATE.IDLE, target: FIELDER_START_POSITIONS[slot] ?? fielder.target, targetBase: NONE }
              : fielder,
          )
        }
      }
    }

    // ── vt4c 의 끝 b4c72 — 플레이 vt30 = 0xb1c90: 커버(+0xf0) 다시 고르기 · 키스톤 자리 잡기 0xb203a (`runCoverTick`) ──
    // 야수 AI 고리(b46ae~b4c6a — 위 AI 0xe · AI 9) 뒤 조건 없이 부른다. 종류 4 는 vt4c 가 도는 판이라 매 틱
    if (!play.finished) coverTick(tick)

    // ── 자동 추가 진루 0xaf918 — 경기 장면 슬롯 2 가 매 틱 부른다 (종류 4 는 거르개 2·3·8 밖이다) ──
    // 결과 코드(9·13)가 선 뒤에도 돈다 — 슬롯 2 의 52660 은 판 진행 관문 0xb0d28 이 열려 있으면 매 틱 부르고, 결과 코드를
    // 안 본다(예전 "결과가 선 뒤 주자가 더 뛰는지 모름" 근사는 +0x111 을 끝 표시로 읽은 탓 — +0x111 은 홈런 코드 8 이다)
    if (!play.finished && autoBaserunningEnabled) {
      // 52660 `0xaf8c0(제어기, 0)` — force = 0: 멈춘 주자(제 목표 루에 선 주자)만 본다. force = 1 은 판 시작 0x46766 한 번
      const decisions = autoAdvanceDecisions({ ...contextAt(tick), force: false })
      for (const decision of decisions) {
        const runner = runners.find((candidate) => candidate.state.index === decision.runnerIndex)
        if (runner === undefined) continue
        // afa0e 는 죽은 주자(+0x96 — 아웃·득점)에게도 +0x128 = 1 을 세운다. 죽은 주자는 주자 틱이 안 옮기므로 목표만 그대로 둔다
        if (runner.state.isOut || runner.state.scored) {
          play = { ...play, wantsThrow: true }
          continue
        }
        if (decision.toBase > HOME_BASE) continue
        // a07b0 vt48 — 새 목표가 지금 +0x7c 와 다르면 +0x84 = 옛 +0x7c
        if (runner.state.targetBase !== decision.toBase) runner.previousTarget = runner.state.targetBase
        runner.state = {
          ...runner.state,
          legStart: runner.state.position,
          startBase: runner.state.targetBase,
          targetBase: decision.toBase,
          settled: false,
        }
        // afa0e: 한 루 더 보내면 플레이+0x128 = 1
        play = { ...play, wantsThrow: true }
        log.push(`${tick}틱 ${runner.state.index}번 주자 자동 진루 → ${decision.toBase}루`)
      }
    }

    // ── CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 매 틱 — `0xae6c8` = 수비 CPU || 송구 자동) ──
    // 견제를 받은 야수도 쥐기 0xb2710 이 +0x128 = 1 을 세우므로, 준비 틱(내야 3)이 지난 틱에 점수식이 루를 고른다
    if (!play.finished && cpuThrowEnabled) cpuThrowDecision(tick)

    // ── 화면 스냅샷 ──
    /** 판 틱 `at` 의 그림 — 판이 G2 에서만 닫힌 그림(`closingListFrame`)은 다음 틱 자리로 한 번 더 찍는다 */
    const snapshotAt = (at: number, fieldersNow: readonly FielderState[]): DefensePlayView =>
      viewStateOf({
        tick: at,
        // 슬라이딩 먼지 방향 0x9ff40 의 0x9fe80 이 보는 +0x84
        previousTargetOf: (index) => runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
        ball: chase !== null ? chase.trajectory.pointAt(at) : (fielders[play.ballHolderSlot]?.position ?? basePosition(targetBase)),
        ballIsFlying: chase !== null,
        // 공 그리기 0x36dfc(36e90) — 쥔 공(+0x12c)은 공 · 그림자를 안 그린다
        ballHeld: play.held,
        // 공+0x68 — 판 시작 · 송구 · 다시 쏘기가 0 으로 둔 그림은 0x36dfc 36e24 가 공 · 그림자를 건너뛴다
        ballPlaybackTick: at - (chase?.startTick ?? 0),
        fielders: fieldersNow,
        runners: runnerStates(),
        catchKind: null,
        chaserSlot: PITCHER_SLOT,
        throwingSlot: at < 3 ? PITCHER_SLOT : NONE,
        throwBase: flight?.base ?? targetBase,
        previousActions,
        // 공 가진 야수 고리 0x43cb0 — 경기+0x19ac · +0x130 · 공격 주체. 이 판은 레이저(+0x19ad)를 안 옮겼다
        holderMark: holderMarkOf({
          grabbed,
          holderSlot: play.ballHolderSlot,
          offenseIsCpu: input.offenseIsCpu === true,
          isShining: false,
        }),
        holderPlate: input.fielderPlates?.[play.ballHolderSlot] ?? null,
        fumbleTicks: fumbleMarks,
        throwErrorTicks: throwErrorMarks,
        // 공 그리기 0x36dfc 의 튐 파티클 — 0x46c88 이 판 종류를 안 보고 늘 부른다(`ballParticleFactsOf`). 큰 타구 갈래는 판 종류 ∈ {1, 8} 이라 없다.
        // 공은 송구 · 다시 쏘기 · 폭투가 깐 궤적(세계 0xbfed0)을 판 틱으로 읽는다. 쥔 공 · 쫓는 공이 없는 그림은 안 쏜다.
        // +0xfd4(결과 코드) — 견제는 0x11 을 안 지나 **앞 공**의 스윙 판정 값이 남는다(`sceneResultCode`)
        ballParticles:
          chase === null || play.held
            ? null
            : ballParticleFactsOf({
                ballTick: at - chase.startTick,
                at,
                trajectory: chase.trajectory,
                onTrajectory: true,
                bigHitWatch: false,
                playKind: PICKOFF_PLAY_KIND,
                resultCode: input.sceneResultCode ?? null,
              }),
        runnerAceIndexes,
        runnerAceSprite,
        sceneResultCode: input.sceneResultCode ?? null,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        offenseTeamIndex: input.offenseTeamIndex,
      })
    // 이 판 틱에 낸 소리(차례대로)를 그림에 싣는다 — 미리 돌린 판을 재생만 하는 화면(`DefensePlayback` 의 재생 갈래)이 그 틱에 낸다
    const tickView = snapshotAt(tick, fielders)
    ticks.push(sound.thisTick.length > 0 ? { ...tickView, tickSoundIds: [...sound.thisTick] } : tickView)
    // ── 이 그림의 수비 화면 그리기 0x46c88 의 연출 몫 (`defenseScene`) — 관문을 안 보고 그리기마다 돈다(46de4~46e24) ──
    const drawSceneEffects = (): void => {
      const view = ticks[ticks.length - 1]
      const drawn = drawDefenseScene(scene, {
        holderSlot: play.ballHolderSlot,
        holder: fielders[play.ballHolderSlot]?.position,
        holderAction: view?.fielders.find((fielder) => fielder.slot === play.ballHolderSlot)?.action,
      })
      scene = drawn.scene
      if (drawn.recordsLaserOut) laserOutFlag = true
      // ⚠️ 이 판은 레이저 발사 · 경기 멈춤(+0x1993)을 안 옮겼다 — 앞 판에서 이어진 연출이 내리는 칸(unpaused · flashEnded)은 볼 것이 없다
      if (view !== undefined && (drawn.zoom !== null || drawn.bigOut !== null || drawn.judgeText !== null || drawn.flash !== null)) {
        ticks[ticks.length - 1] = {
          ...view,
          ...(drawn.zoom === null ? {} : { zoom: drawn.zoom }),
          ...(drawn.bigOut === null ? {} : { bigOut: drawn.bigOut }),
          ...(drawn.judgeText === null ? {} : { judgeText: drawn.judgeText }),
          ...(drawn.flash === null ? {} : { flash: drawn.flash }),
        }
      }
    }
    drawSceneEffects()
    // 관문 G3 · G4 · G1 은 다음 그림의 목록 틱(아래 이동) 앞 주자를 본다 (`playGate.gateRunnerViewsOf`)
    const runnersBeforeListTick = runnerStates()

    // ── 한 틱 움직이기 — 커버는 제 루로, 쫓는 야수는 포구 지점(x, 0, z)으로(AI 1), 나머지는 제자리 ──
    const chasing = chase
    fielders = fielders.map((fielder) => {
      if (chasing !== null && fielder.slot === chasing.slot) {
        return { ...fielder, target: chasing.catchPoint, position: stepToward(fielder.position, chasing.catchPoint, fielder.speed) }
      }
      // 이번 틱에 던진 야수는 +0xb1 잠금으로 다음 야수 틱 하나를 걷지 않는다(a1346 · a143e — 타구 진행기 `thrownThisTick`, U-78)
      if (fielder.slot === thrownThisTick) return fielder
      if (fielder.target === fielder.position) return fielder
      return { ...fielder, position: stepToward(fielder.position, fielder.target, fielder.speed) }
    })
    for (const runner of runners) {
      // 주자 +0x3b — 목록 틱마다 지우고(0xbf094 bf0a2) 막 닿은 갱신에서만 세운다. 다음 판 틱 득점 0xaa0a8 이 본다
      runner.arrivedThisListTick = false
      if (runner.state.isOut || runner.state.scored) continue
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, basePosition(runner.state.targetBase), runner.state.speed),
      }
      if (!isAtTarget(runner.state) || runner.state.settled) continue
      // 0xa040c 도착 — +0x84 = +0x8c = +0x7c
      const touched = runner.state.targetBase
      runner.previousTarget = touched
      runner.state = { ...runner.state, settled: true, startBase: touched }
      runner.arrivedThisListTick = true
    }

    // ── 판 진행 관문 0xb0d28 (`playGate.passPlayGateBetweenTicks`) — 이 틱 그리기 G3 · 0x3f378 G4 · 다음 틱 0x3f060 G1 · 슬롯 2 머리 G2 ──
    // 3아웃 · 처리 안 끝난 주자(0xaa05c, +0x94 까지) · 공을 쥔 채 관문 51 번(+0x120 — 그림마다 3 번, 17 틱). state[0xb] 는 이 판의 결과 코드(9 · 13)다.
    const gateRunners = gateRunnerViewsOf(runnersBeforeListTick, runnerStates())
    const gate = passPlayGateBetweenTicks(
      {
        foulFlag: false,
        lastEventCode: resultCode ?? 0,
        outs,
        someRunnerActive: someRunnerStillActive(gateRunners.frame, isAtTarget),
        homeRunDerby: false,
        homeRunFlag: false,
        poleHomeRunFlag: false,
        liveRunnerCount: liveRunnerCountOf(gateRunners.frame),
        ballHeld: play.held,
        groundRuleFlag: false,
        endCounter,
      },
      false,
      false,
      // G2(슬롯 2 머리 52502) — 목록 틱(이동) 뒤 · 득점 0xaa0a8 앞
      {
        someRunnerActive: someRunnerStillActive(gateRunners.head, isAtTarget),
        liveRunnerCount: liveRunnerCountOf(gateRunners.head),
      },
    )
    endCounter = gate.endCounter
    if (!gate.open) play = { ...play, finished: true }
    // G2 만 닫힌 그림 — 다음 그림의 목록 틱(이동 · 야수 준비 틱 줄이기)과 카메라는 돌고 슬롯 2 는 빠진 채 그려진다
    // (`DefenseViewState.closingListFrame`, 타구 진행기 10 절과 같다)
    if (!gate.open && gate.listTickOpen === true) {
      const listTickFielders = fielders.map((fielder) =>
        fielder.holdingBall && fielder.actionRemainingTicks > 0
          ? { ...fielder, actionRemainingTicks: fielder.actionRemainingTicks - 1 }
          : fielder,
      )
      ticks.push({ ...snapshotAt(tick + 1, listTickFielders), closingListFrame: true })
      // 그 그림도 그리기 0x46c88 이 관문을 안 보고 연출을 한 번 더 돌린다(타구 진행기 10 절)
      drawSceneEffects()
    }
  }

  return {
    targetBase,
    resultCode,
    advance: { bases: basesOf(runners), runsScored, outsAdded },
    ticks,
    // 투수가 처음부터 공을 쥐고 시작한다 (0xb28be `P+0x130 = 0`)
    catchFielderSlot: PITCHER_SLOT,
    catchTick: 0,
    isUncatchable: false,
    caughtOnTheFly: false,
    tagOut,
    throwBase: targetBase,
    // 공이 실제로 받는 쪽에 들어간 틱 — 커버를 기다렸으면 던질 때 잡아 둔 도착 틱(`throwArrivalTick`)보다 늦다
    throwArrivalTick: catchTick >= 0 ? catchTick : throwArrivalTick,
    voidedRuns: 0,
    fumbled,
    errantThrow,
    specialDefense: { jumpUnlocked: false, slideUnlocked: false },
    laserThrow: false,
    laserOutFlag,
    scene: { ...scene, throwTarget: manualThrowBase },
    rundowns: 0,
    rundownOuts: 0,
    // 목록 = 찬 루 오름차순, 타자주자 없음 (종류 4 — 위 "상태 0x17 진입" 주석)
    runnerFates: runners.map((runner) => runnerFateOf(runner.state)),
    log,
  }
}

/**
 * 견제가 끝난 뒤의 콜 — 결과 9 면 **늘 17**(0x51c14 의 종류 4·5 갈래), 13 이면 62/20(0x51b36).
 * 견제사는 포스가 걸릴 일이 없어 언제나 태그(결과 3 → state[0x87] = 1)라 사실상 62 다.
 * 결과 코드가 안 섰으면(악송구 근사) 소리도 없다.
 */
export function pickoffCallSoundIdOf(result: Pick<PickoffPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === PICKOFF_RESULT.SAFE) return SAFE_CALL
  if (result.resultCode === PICKOFF_RESULT.OUT) return result.tagOut ? CAUGHT_OUT_CALL : FORCE_OUT_CALL
  return null
}

/** 재생 칸(`lastDefensePlay`)에 든 결과가 견제 판인가 — 타구 결과에는 `resultCode` 가 없다 */
export function isPickoffPlayResult(result: DefensePlayResult | null): result is PickoffPlayResult {
  return result !== null && 'resultCode' in result && 'targetBase' in result
}

const HOME_BASE = 4
/** 투수 AI 0xe(0xb47da)의 견제 송구 — 로그를 "b루 견제 송구" 로 남긴다 */
const PICKOFF_THROW = ' (견제 0xb47da)'
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
const MINIMUM_THROW_DISTANCE = 600
const wrapBase = (base: number) => ((base % 4) + 4) % 4

function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

function basesOf(runners: readonly PickoffRunner[]): BaseState {
  let bases = EMPTY_BASES
  for (const runner of runners) {
    if (runner.state.isOut || runner.state.scored) continue
    const base = wrapBase(runner.state.targetBase)
    if (base === 1) bases = { ...bases, first: true }
    if (base === 2) bases = { ...bases, second: true }
    if (base === 3) bases = { ...bases, third: true }
  }
  return bases
}

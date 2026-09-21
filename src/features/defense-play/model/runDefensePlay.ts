import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  inPlayCommandOf,
  type ControlSide,
  type RunnerTarget,
} from '@/entities/defense-controls/model/defenseKeys'
import {
  canFireLaser,
  isLaserWindowOpen,
  judgeLaserInput,
  rollLaserThrow,
  SIXTH_SENSE_SKILL_ID,
  HOME_RUN_DERBY_MODE,
  BATTER_CAREER_MODE,
  LASER_WINDOW_FIRST_TICK,
} from '@/entities/defense-controls/model/laserThrow'
import {
  slideOnKey,
  SLIDING_SPEED_BONUS,
  type SlidingRunner,
} from '@/entities/defense-controls/model/sliding'
import {
  autoAdvanceDecisions,
  requiredBasesOnBounce,
  requiredBasesOnFlyCatch,
} from '@/entities/fielding/model/autoAdvance'
import {
  MINIMUM_THROW_SPEED,
  NO_THROW_ERROR,
  rollFumble,
  rollSpecialDefense,
  rollThrowError,
} from '@/entities/fielding/model/fieldingErrors'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import {
  BASE_DEFAULT_FIELDER,
  basePosition,
  FIELDER_COUNT,
  horizontalDistance,
  isSamePoint,
  progressPercent,
  runnerSpeedOf,
  stepToward,
  ticksToReach,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'
import {
  buildRundownPlan,
  canStartRundown,
  chooseRundownRunner,
  endRundown,
  rundownAction,
  NO_RUNDOWN,
  type RundownPlan,
} from '@/entities/fielding/model/rundown'
import {
  AI_STATE,
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import {
  EMPTY_HELD_RUNS,
  onRunnerReachesHome,
  releaseHeldRuns,
  runsAfterTwoOutRule,
  type HeldRunState,
} from '@/entities/fielding/model/heldRuns'
import { defenseArrivalTicks, secondBaseCoverSlot } from '@/entities/fielding/model/throwArrival'
import { effectiveThrowSpeedOf, readyTicksOf, throwTicksToFielder } from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase } from '@/entities/fielding/model/throwTargetBase'
import { EMPTY_BASES, type AdvanceResult, type BaseState } from '@/entities/game/model/baseState'
import { forecastCatch } from '@/features/defense-play/model/catchForecast'
import {
  viewStateOf,
  type ActionMemory,
  type DefensePlayView,
} from '@/features/defense-play/model/defensePlayView'

/**
 * 타구 하나를 **틱 단위로 돌리는 진행기**.
 *
 * ## 틱 스테퍼 — 사람이 실시간으로 끼어들 수 있게
 * 예전에는 타구 하나를 통째로 미리 계산해 `ticks` 배열을 뱉는 한 덩이 함수였다. 그러면
 * **사람이 아직 안 누른 키를 알 수 없어** 실시간 조작이 원리적으로 불가능하다. 그래서 넷으로 쪼갰다:
 *   `startDefensePlay` → `stepDefensePlay`(한 갱신 = 한 틱, 0xc2198) → `isDefensePlayFinished` →
 *   `defensePlayResultOf`
 * `runDefensePlay` 는 그 넷을 끝까지 돌리는 **얇은 껍데기**로 남아 있다 — 미리 다 계산해도 되는
 * 자리(CPU 경기·미션)는 그대로 부르면 되고, 결과는 쪼개기 전과 **한 톨도 다르지 않다**.
 *
 * `entities/fielding` 에 따로따로 들어와 있는 조각들을 여기서 한 줄로 잇는다:
 *   포구 예보(0xb12d0 · 0xb3b38) → 송구 목표 루(0xafb24) → 송구 도착 틱(0xaf284) →
 *   자동 추가 진루(0xaf918) → 2아웃 득점 보류(state[0]).
 *
 * ## 무엇이 무엇을 정하는가 (중요)
 * **타자주자의 운명은 결과 코드가 정한다.** 안타·아웃은 `battedBallOutcome.outcomeOfPattern` 이
 * 이미 정해 놓았고(그 자체가 위치 분석 4차의 근사다), 이 진행기는 **나머지 주자의 진루·추가 아웃·
 * 득점**을 원본 규칙으로 정한다. 그래서 여기서 바뀌는 것은 `baseState` 의 두 근사 —
 * "희생플라이 보장" 과 "고정 진루표" — 이고, 그 자리를 `autoAdvanceDecisions` + `heldRuns` 가 채운다.
 *
 * ⚠️ 타구 궤적은 `entities/batting/model/battedBallFlight` 의 **근사**다. 원본 물리 루프
 * (0xb3b38·0xb401c)는 해독 금지 주제라 뜯지 않았고, 원본 패턴 데이터의 각·세기·높이만 읽어 썼다.
 */

/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
const DEFAULT_ABILITY = 500
/** 한 플레이가 이 틱을 넘기면 강제로 끊는다 (원본에는 없는 우리 쪽 안전망) */
const DEFAULT_MAXIMUM_TICKS = 240
/** 홈을 가리키는 루 번호 — 원본 루 표의 [4] 가 홈의 사본이라 진루는 4 로 센다 */
const HOME_BASE = 4

export interface DefensePlayInput {
  /** 타석 결과 — 타자주자의 운명이 여기서 온다 */
  readonly outcome: AtBatOutcome
  /** 원본 패턴에서 만든 타구 궤적 */
  readonly trajectory: BattedBallTrajectory
  /** 투구 때의 루 상황 */
  readonly bases: BaseState
  /** 투구 때의 아웃 수 */
  readonly outs: number
  /** 수비 9명의 수비 능력치 (칸 순서). 기본 500 */
  readonly defenseAbilities?: readonly number[]
  /** 주자들의 주루 능력치. 기본 500 */
  readonly runAbility?: number
  /**
   * **이 타구는 잡히지 않는다** — 필살타법이 성공한 타구 (0x51800, S13 6절 확정).
   *
   * 원본은 확률 굴림에 성공하면 공 객체(`[경기+0x204]`)의 속성 목록 `+0x5c` 에
   * `0xaf180(목록, 4, 0, −1)` 로 **비트 4 = 송구공 표시**를 단다. 야수는 포구 틱에 그 비트를 보고
   * 메시지 `0xbc3`(받음)만 보낸 뒤 **쥐기(0xb2710)로 가지 않고**, 그 `0xbc3` 은 전용 처리기가
   * 아예 없다(P2 2b 181행 · S8 4절). 결국 그 타구는 아무도 잡지 못한다.
   *
   * ⚠️ 비트를 읽는 쪽(`0xb425c`)은 궤적 물리 루프(`0xb401c` 계열) 안이라 해독 금지 구역이다 —
   * 이미 공개된 두 노트의 읽기만 근거로 삼았고 물리식은 건드리지 않았다.
   */
  readonly isUncatchable?: boolean
  readonly maximumTicks?: number
  /**
   * 난수. **주면 원본 확률 굴림이 돈다** — 필살수비(0x66b30/0x66be4) · 펌블(0xb41d0) ·
   * 악송구(0xa1828) · 레이저 송구(0x66a8c). 안 주면 하나도 굴리지 않아 지금까지와 똑같이 결정론이다.
   */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서). 21(초감각)이면 필살수비·레이저 확률 +3%p */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /** 전역 모드 0x1552d10 — 7(홈런더비)이면 필살수비를 안 굴리고, 4(나리 타자편)면 기준이 절반이다 */
  readonly gameMode?: number
  /**
   * **수비를 CPU 가 맡았는가** — 협살(AI 상태 8)은 `state[0x31 + 수비측] == 1` 일 때만 시작한다
   * (S8 1-4, 확정). 사람이 수비하면 원본에서도 협살이 절대 안 일어난다.
   *
   * 안 주면 **안 도는 쪽**으로 둔다. 원본은 경기 상태가 늘 답을 알지만 이 진행기는 부르는 쪽이
   * 말해 줘야 알 수 있어서, 모르면 시작하지 않는 쪽이 안전하다.
   */
  readonly defenseIsCpu?: boolean
  /** 사람 조작 (I-controls 0절 상태 0x17 표). 안 주면 전부 자동이다 */
  readonly controls?: DefensePlayControls
}

/** `defenseAbilitiesOf` 가 받는 수비 한 명 */
export interface DefenseLineupPlayer {
  /**
   * 수비 자리 코드 = 선수 레코드 `+0x1c & 0xf` (1 지명 · 2 포수 · 3 1루 · 4 2루 · 5 3루 ·
   * 6 유격 · 7 1루 쪽 외야 · 8 3루 쪽 외야 · 9 중견). **수비 칸 = 코드 − 1** 이고
   * 칸 0(투수)은 이 표에서 빠진다 (0xb103e~0xb105e · 0xb1048).
   */
  readonly position?: number
  /** 경기용 능력치 칸 2 — 타자 레코드면 수비 (0xb570c(팀, 2, 선수, 90, 1), I-controls 1a) */
  readonly defense: number
}

/**
 * 타순에 선 선수들을 **수비 칸 9개**(0 투수 … 8 중견)의 능력치 배열로 옮긴다.
 *
 * ⚠️ **원본 그대로**: 칸 0(투수)의 "수비 능력치" 도 같은 `0xb570c(팀, **2**, 선수, 90, 1)` 로 읽는데,
 * 투수 레코드의 칸 2 는 **변화**다 (J-4 의 칸 표). 원본이 레코드 종류를 가리지 않고 칸 2 를 읽으므로
 * 여기서도 투수의 변화 값을 그대로 넘긴다 — 고치지 않는다.
 *
 * 자리 코드가 없거나 겹치는 칸은 원본 평균대(등급 3 = 500)로 둔다.
 */
export function defenseAbilitiesOf(
  lineup: readonly DefenseLineupPlayer[],
  pitcherDefense: number = DEFAULT_ABILITY,
): number[] {
  const abilities = Array.from({ length: FIELDER_COUNT }, () => DEFAULT_ABILITY)
  abilities[0] = pitcherDefense
  const filled = Array.from({ length: FIELDER_COUNT }, (_unused, slot) => slot === 0)
  for (const player of lineup) {
    const code = (player.position ?? 0) & 0xf
    const slot = code - 1
    if (slot < 1 || slot >= FIELDER_COUNT) continue
    if (filled[slot]) continue
    abilities[slot] = player.defense
    filled[slot] = true
  }
  return abilities
}

/** 이번 틱에 눌린 키 한 개 — 경기 장면 `this+0x38` 에 해당한다 */
export interface DefenseKeyPress {
  /** `KeyboardEvent.key` 그대로 (`defenseKeys.ts` 가 원본 키로 옮긴다) */
  readonly key: string
  /**
   * 누르고 있는 중인가. 레이저 확정은 **새로 누른 키만** 받는다
   * (0x4e858 `this+0x6c & 0xf == 0` = 키 반복 계수 0).
   */
  readonly isRepeat?: boolean
}

/**
 * 사람 조작 — 화면이 틱마다 "이번 틱에 눌린 키" 를 넘겨 준다.
 * 원본은 경기 장면이 매 틱 키를 담고 조작 객체 0x536bc 가 상태 0x17 갈래(0x53420)로 가른다.
 */
export interface DefensePlayControls {
  /** 조작 객체 `[+0xc]` — 0 공격(주루) / 1 수비(송구·레이저) */
  readonly side: ControlSide
  /** 이 틱에 눌린 키. 없으면 null */
  keyAt(tick: number): DefenseKeyPress | null
  /** 귀루 셋('3'/'1'/'7')의 게이트 `[+0x1c] & 0xf0 == 0` (뜻 미해결). 기본 true */
  readonly canReturn?: boolean
}

export interface DefensePlayResult {
  /** `baseState.advanceRunners` 와 같은 모양 — 그대로 경기 상태에 넣을 수 있다 */
  readonly advance: AdvanceResult
  /** 매 틱의 화면 스냅샷 (`pages/defense` 가 그대로 그린다) */
  readonly ticks: readonly DefensePlayView[]
  /** 공을 쫓은 야수 칸. 잡히지 않는 타구면 "닿기만 한" 야수다 */
  readonly catchFielderSlot: number
  /** 포구 틱. 잡히지 않는 타구면 야수가 공에 닿은 틱이다 */
  readonly catchTick: number
  /** 필살타법 성공으로 아무도 잡지 못한 타구인가 (0x51800) */
  readonly isUncatchable: boolean
  /** 뜬공을 뜬 채로 잡았는가 (태그업이 걸리는 조건) */
  readonly caughtOnTheFly: boolean
  /** CPU 가 고른 송구 목표 루. −1 이면 안 던졌다 */
  readonly throwBase: number
  /** 송구 도착 틱. 송구가 없으면 −1 */
  readonly throwArrivalTick: number
  /** 보류됐다가 3아웃으로 날아간 득점 수 (state[0]) */
  readonly voidedRuns: number
  /** 펌블(에러)이 났는가 — 0xb41d0 굴림 (`random` 을 줘야 돈다) */
  readonly fumbled: boolean
  /** 악송구가 났는가 — 0xa1828 굴림 */
  readonly errantThrow: boolean
  /** 필살수비 창이 열렸는가 — 0x66b30(점프) / 0x66be4(슬라이딩). 열려도 보통 포구가 되면 안 쓰인다 */
  readonly specialDefense: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean }
  /** 사람이 반짝임 창 안에 키를 넣어 레이저 송구가 나갔는가 (플레이+0x1f4) */
  readonly laserThrow: boolean
  /**
   * 협살(AI 상태 8)이 몇 번 걸렸는가 — 0xb3a94. `defenseIsCpu` 를 줘야 돈다.
   * 홈런 재생(`homeRunPlayback`)처럼 진행기를 안 돌린 결과에는 없다.
   */
  readonly rundowns?: number
  /** 협살로 잡은 아웃 수 */
  readonly rundownOuts?: number
  /** 사람이 읽을 진행 기록 — 테스트가 "왜 그렇게 됐나" 를 확인할 때 쓴다 */
  readonly log: readonly string[]
}

/**
 * 이 타석이 수비 시뮬레이션을 돌릴 타구인가 — 삼진·볼넷·홈런은 돌릴 것이 없다.
 *
 * 홈런은 아무도 잡지 못하고 진루·득점도 타석 쪽이 이미 정해 놓으므로 여기서 빼 두고,
 * **날아가는 그림만** `homeRunPlayback.ts` 가 따로 만든다.
 */
export function isBattedBallInPlay(outcome: AtBatOutcome): boolean {
  return outcome.kind === '안타' || outcome.kind === '아웃'
}

/** 뜬 채로 잡히는 타구인가. 땅볼 아웃은 "잡히는 타구" 가 아니라 굴러간 공을 주운 것이다 */
function catchesOnTheFly(outcome: AtBatOutcome): boolean {
  return outcome.kind === '아웃' && (outcome.detail === '뜬공아웃' || outcome.detail === '직선타아웃')
}

/** 타자주자가 최소한 몇 루까지 가는가 */
function batterMinimumBaseOf(outcome: AtBatOutcome): number {
  if (outcome.kind === '안타') return outcome.bases
  if (outcome.kind === '홈런') return HOME_BASE
  return 1
}

/** 진행기 안에서 **제자리에서 바뀌는** 주자 한 명 */
export interface MutableRunner {
  state: RunnerState
  /** 최소 진루 루 — 타자주자만 결과 코드로 정해진다 */
  minimumBase: number
  /** 이미 득점 처리를 했는가 */
  counted: boolean
}

/**
 * 포스 판정 — 뒤 루가 모두 차 있어야 밀린다. 타자주자는 언제나 뛴다.
 * (원본 `requiredBasesOnBounce` 는 주자 번호와 목표 루를 비교하는 **다른** 계산이라 요구 루에만 쓴다.)
 */
function forcedFlagsOf(bases: BaseState): { first: boolean; second: boolean; third: boolean } {
  return {
    first: true,
    second: bases.first,
    third: bases.first && bases.second,
  }
}

function createPlayRunners(bases: BaseState, outcome: AtBatOutcome, speed: number): MutableRunner[] {
  const forced = forcedFlagsOf(bases)
  const runners: MutableRunner[] = []
  const push = (fromBase: number, isForced: boolean, minimumBase: number) => {
    const index = runners.length
    // 포스로 밀리는 주자만 바로 뛴다. 나머지는 루에 붙어 있다가 자동 진루(0xaf918)가 보내 준다.
    const targetBase = isForced ? fromBase + 1 : fromBase
    runners.push({
      state: createRunner(index, fromBase, speed, { targetBase, isBatterRunner: index === 0 }),
      minimumBase,
      counted: false,
    })
  }
  // 0 = 타자주자. 그 뒤는 **뒤 주자 → 앞선 주자** 순서다 (자동 진루가 목록 끝부터 = 앞선 주자부터 본다)
  // 최소 진루 루는 **타자주자만** 결과 코드로 정해진다. 나머지는 포스로 밀리거나 자동 진루로만 간다.
  push(0, true, batterMinimumBaseOf(outcome))
  if (bases.first) push(1, forced.second, 1)
  if (bases.second) push(2, forced.third, 2)
  if (bases.third) push(3, forced.third, 3)
  return runners
}

/**
 * 루 커버 배정 — 기본표 0xd85a8 = [포수, 1루수, 2루수, 3루수] 에 2루 규칙(0xb1e24)을 얹는다.
 * 공을 쫓는 야수는 커버를 못 하므로 1루만 투수(0)가 대신 들어가고, 나머지는 커버 없음(−1)이 된다
 * — `defenseArrivalTicks` 의 (A) 갈래가 그때 "직접 들고 뛰기" 를 본다.
 */
function assignCovers(chaserSlot: number, ballToFirstSide: boolean): number[] {
  const covers = [...BASE_DEFAULT_FIELDER]
  covers[2] = secondBaseCoverSlot(ballToFirstSide, chaserSlot)
  return covers.map((slot, base) => {
    if (slot !== chaserSlot) return slot
    return base === 1 ? 0 : NONE
  })
}

/**
 * **한 플레이가 도는 동안 바뀌는 것 전부** — 지금까지 `runDefensePlay` 루프 안의 `let` 변수였던 것들이다.
 *
 * 앞쪽(`input`~`specialDefense`)은 시작할 때 한 번 정해지고 끝까지 안 바뀌는 것,
 * 뒤쪽은 틱마다 바뀌는 것이다.
 *
 * ⚠️ **제자리에서 고친다**: `stepDefensePlay` 는 이 객체를 **그대로 고쳐 같은 객체를 돌려준다**.
 * 주자(`runners`)·기록(`ticks`·`log`)·동작 기억(`previousActions`)은 원래부터 제자리에서 바뀌던 것이라
 * 겉만 불변으로 꾸며 봐야 거짓말이 된다. **지난 상태를 들고 있지 말고 늘 돌려받은 것을 써라.**
 */
export interface DefensePlayState {
  // ── 시작할 때 정해지는 것 ──
  readonly input: DefensePlayInput
  readonly trajectory: BattedBallTrajectory
  readonly abilities: readonly number[]
  readonly maximumTicks: number
  /** 아무도 잡지 못하는 타구인가 (필살타법 0x51800) */
  readonly uncatchable: boolean
  /** 뜬 채로 잡히는 타구인가 */
  readonly onTheFly: boolean
  /** 공을 쫓는 야수 칸 */
  readonly chaserSlot: number
  /** 포구 지점 — 펌블로 포구 틱이 밀려도 **자리는 그대로다** (⚠️ 원본 그대로) */
  readonly catchPoint: WorldPoint
  /** 루 커버 배정 (0xd85a8 + 0xb1e24) */
  readonly covers: readonly number[]
  readonly defenseIsCpu: boolean
  /** 필살수비 창 — 시작할 때 한 번만 굴린다 (0x66b30 / 0x66be4) */
  readonly specialDefense: { readonly jumpUnlocked: boolean; readonly slideUnlocked: boolean }
  /** 주자들 — **제자리에서 바뀐다** */
  readonly runners: readonly MutableRunner[]
  /** 매 틱 화면 스냅샷 — **제자리에서 쌓인다** */
  readonly ticks: DefensePlayView[]
  /** 진행 기록 — **제자리에서 쌓인다** */
  readonly log: string[]
  /** `actionTick` 을 세는 동작 기억 — **제자리에서 바뀐다** */
  readonly previousActions: ActionMemory

  // ── 틱마다 바뀌는 것 ──
  /** 다음에 돌릴 틱 번호 */
  tick: number
  fielders: readonly FielderState[]
  play: PlayView
  /** 2아웃 보류 득점 state[0] */
  held: HeldRunState
  outs: number
  outsAdded: number
  throwBase: number
  throwArrivalTick: number
  throwFromSlot: number
  batterOutTick: number
  /** 포구 틱 — 펌블이 나면 15틱 뒤로 밀린다 */
  catchTick: number
  fumbled: boolean
  errantThrow: boolean
  /** 경기+0x24 — 자동 주루. 사람이 주루 키를 누르면 0 이 된다 (0x5209e) */
  autoBaserunning: boolean
  /** 주자관리+0x31c — 이번 플레이에서 이미 슬라이딩 효과음을 냈다 */
  slidingSoundPlayed: boolean
  /** 경기+0x19ad(반짝임) */
  laserShining: boolean
  /** 경기+0x19ae(레이저 확정) */
  laserConfirmed: boolean
  /** 경기+0x19af — 한 플레이에 한 번만 굴린다 */
  laserRolled: boolean
  /** 플레이+0x1f4(레이저 송구가 나갔다) */
  laserThrow: boolean
  /** 협살 기록칸 P+0x1ec~+0x1f3 (0xb3a04). 대상이 −1 이면 협살 중이 아니다 */
  rundown: RundownPlan
  /** 협살 중 짝에게 던진 공이 닿는 틱. 없으면 −1 */
  rundownThrowArrival: number
  /** 그 공을 받을 야수 칸 */
  rundownThrowTo: number
  rundowns: number
  rundownOuts: number
}

/**
 * 타구 하나를 **시작 상태**로 세운다 — 포구 예보 · 필살수비 굴림 · 커버 배정까지.
 *
 * ⚠️ 난수는 여기서 **필살수비 굴림(최대 2번)만** 돈다. 펌블·악송구·레이저는 틱 안에서 돈다 —
 * 그 순서와 횟수가 씨앗 결과를 정하므로 자리를 옮기면 안 된다.
 */
export function startDefensePlay(input: DefensePlayInput): DefensePlayState {
  const trajectory = input.trajectory
  const abilities =
    input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const speed = runnerSpeedOf(input.runAbility ?? DEFAULT_ABILITY)
  const maximumTicks = input.maximumTicks ?? DEFAULT_MAXIMUM_TICKS

  let fielders = createFielders(abilities)
  const runners = createPlayRunners(input.bases, input.outcome, speed)
  const uncatchable = input.isUncatchable === true
  // 잡히지 않는 타구는 뜬 채로 잡힐 일도 없다 — 떨어진 뒤 굴러가는 공처럼 본다
  const onTheFly = !uncatchable && catchesOnTheFly(input.outcome)

  // ── 포구 예보 ──
  // 뜬 채로 잡히는 타구는 낙구 전까지만, 굴러간 타구는 낙구 **다음** 틱부터 본다.
  // (낙구 틱에 걸리면 `chooseChaser` 우선순위 1~5 = "낙구 전 포구" 가 되어 잡힌 공이 된다)
  const window = onTheFly
    ? { from: 0, to: trajectory.landingTick }
    : { from: trajectory.landingTick + 1, to: Number.POSITIVE_INFINITY }
  let forecast = forecastCatch(trajectory, fielders, window)

  // ── 필살수비 굴림 (메시지 0x11 = 타구가 떠난 순간, I-controls 2c) ──
  // A(점프, +0x1f5) 를 먼저 굴리고 실패했을 때만 B(슬라이딩, +0x1f6). 창을 여는 것뿐이라
  // 보통 포구가 낙구 전에 되면 쓰이지 않는다 (고르기 우선순위 4·5 — P2 3절).
  // 원본은 "이미 고른 추적야수" 의 칸으로 조건을 보므로 여기서도 예보를 한 번 돌린 뒤에 굴리고,
  // 창이 열리면 예보(0xb12d0 = vt24)를 다시 만든다 — 원본도 vt24 를 여러 번 부른다.
  const specialDefense = rollSpecialDefenseFor({
    random: input.random,
    ability: abilities[forecast.choice.slot] ?? DEFAULT_ABILITY,
    skillIds: input.fielderSkillIds?.[forecast.choice.slot],
    gameMode: input.gameMode,
    chaserSlot: forecast.choice.slot,
    uncatchable,
  })
  if (specialDefense.jumpUnlocked || specialDefense.slideUnlocked) {
    forecast = forecastCatch(trajectory, fielders, window, {
      jumpUnlocked: specialDefense.jumpUnlocked,
      slideUnlocked: specialDefense.slideUnlocked,
    })
  }

  const chaserSlot = forecast.choice.slot
  let catchTick = Math.max(0, Math.min(forecast.choice.catchTick, maximumTicks))
  const catchPoint = trajectory.pointAt(catchTick)
  const covers = assignCovers(chaserSlot, catchPoint.x > basePosition(0).x)

  // 시작 목표를 미리 세워 둔다 — 첫 틱부터 쫓는 야수는 공 쪽, 커버 야수는 제 루 쪽을 보고 있어야 한다
  fielders = fielders.map((fielder) => {
    if (fielder.slot === chaserSlot) {
      return { ...fielder, target: catchPoint, aiState: AI_STATE.CHASE }
    }
    const base = covers.indexOf(fielder.slot)
    if (base < 0) return fielder
    return {
      ...fielder,
      target: basePosition(base),
      targetBase: base,
      aiState: AI_STATE.COVER_HOME + base,
    }
  })

  let play: PlayView = {
    ...initialPlayView(1),
    coverOfBase: covers,
    ballHolderSlot: chaserSlot,
    catchFielderSlot: chaserSlot,
    catchKind: forecast.choice.kind,
    catchTick,
    actionStartTick: forecast.choice.actionStartTick,
    earliestCatchTick: onTheFly ? forecast.earliestCatchTick : 0xffff,
  }

  return {
    input,
    trajectory,
    abilities,
    maximumTicks,
    uncatchable,
    onTheFly,
    chaserSlot,
    catchPoint,
    covers,
    defenseIsCpu: input.defenseIsCpu === true,
    specialDefense,
    runners,
    ticks: [],
    log: [],
    previousActions: new Map<string, { action: number; since: number }>(),

    tick: 0,
    fielders,
    play,
    held: EMPTY_HELD_RUNS,
    outs: input.outs,
    outsAdded: 0,
    throwBase: NONE,
    throwArrivalTick: -1,
    throwFromSlot: NONE,
    batterOutTick: -1,
    catchTick,
    fumbled: false,
    errantThrow: false,
    autoBaserunning: true,
    slidingSoundPlayed: false,
    laserShining: false,
    laserConfirmed: false,
    laserRolled: false,
    laserThrow: false,
    rundown: NO_RUNDOWN,
    rundownThrowArrival: -1,
    rundownThrowTo: NONE,
    rundowns: 0,
    rundownOuts: 0,
  }
}

/**
 * 더 돌릴 것이 남았는가 — 원본 루프의 `for (tick = 0; tick <= 최대틱; …)` 와 그 안의 `break` 다.
 * 끝 조건(공·송구·타자주자가 다 정리됐고 뛰는 주자가 없다)이 서면 `play.finished` 가 선다.
 */
export function isDefensePlayFinished(state: DefensePlayState): boolean {
  return state.play.finished || state.tick > state.maximumTicks
}

/**
 * **한 틱만 돌린다** — 원본 경기 루프의 한 갱신(0xc2198)에 해당한다.
 *
 * `key` 는 **이번 틱에 눌린 키**다. `runDefensePlay` 처럼 미리 다 계산하는 쪽은
 * `input.controls.keyAt(tick)` 에서 꺼내 넘기고, 화면(`DefensePlayback`)은 실제 `keydown` 을 넘긴다.
 * 어느 쪽이든 진행기가 보는 것은 똑같다.
 *
 * ⚠️ 상태는 **제자리에서 바뀐다** — 돌려받은 것을 쓰고 지난 것은 버려라.
 */
export function stepDefensePlay(
  state: DefensePlayState,
  key: DefenseKeyPress | null = null,
): DefensePlayState {
  if (isDefensePlayFinished(state)) return state

  const input = state.input
  const trajectory = state.trajectory
  const abilities = state.abilities
  const maximumTicks = state.maximumTicks
  const uncatchable = state.uncatchable
  const onTheFly = state.onTheFly
  const chaserSlot = state.chaserSlot
  const catchPoint = state.catchPoint
  const covers = state.covers
  const defenseIsCpu = state.defenseIsCpu
  const runners = state.runners
  const ticks = state.ticks
  const log = state.log
  const previousActions = state.previousActions
  const tick = state.tick

  let fielders = state.fielders
  let play = state.play
  let held = state.held
  let outs = state.outs
  let outsAdded = state.outsAdded
  let throwBase = state.throwBase
  let throwArrivalTick = state.throwArrivalTick
  let throwFromSlot = state.throwFromSlot
  let batterOutTick = state.batterOutTick
  let catchTick = state.catchTick
  let fumbled = state.fumbled
  let errantThrow = state.errantThrow
  let autoBaserunning = state.autoBaserunning
  let slidingSoundPlayed = state.slidingSoundPlayed
  let laserShining = state.laserShining
  let laserConfirmed = state.laserConfirmed
  let laserRolled = state.laserRolled
  let laserThrow = state.laserThrow
  let rundown = state.rundown
  let rundownThrowArrival = state.rundownThrowArrival
  let rundownThrowTo = state.rundownThrowTo
  let rundowns = state.rundowns
  let rundownOuts = state.rundownOuts

  const contextAt = (at: number): DefenseContext => ({
    play,
    fielders,
    runners: runners.map((runner) => runner.state),
    currentTick: at,
    landingTick: trajectory.landingTick,
  })

  // 아래 묶음은 예전 `for (let tick = 0; …)` 루프의 **몸통 그대로**다.
  // 한 줄도 안 옮기려고 묶음(블록)만 씌워 두었다 — 결과가 한 톨도 달라지면 안 되는 자리다.
  {
    const ballOnGround = play.everHeld || tick >= trajectory.landingTick

    // ── 0. 사람 조작 (상태 0x17 갈래 0x53420 — I-controls 0·2b·3b절) ──
    // 예전에는 `input.controls?.keyAt(tick)` 로 미리 물어봤다. 이제는 **이번 틱에 눌린 키**를 받는다
    const press = key
    if (input.controls !== undefined && press !== null) {
      const command = inPlayCommandOf(press.key, input.controls.side, {
        canReturn: input.controls.canReturn,
      })
      if (command !== null && !play.finished) {
        if (command.kind === '송구') {
          // 메시지 0x588 → 플레이 vt0x60 → 플레이+0x160. 자동 규칙(0xb1c90)보다 늘 앞선다
          play = { ...play, manualThrowBase: command.target }
          log.push(`${tick}틱 사람이 ${command.target}루로 송구 지시`)
        } else if (command.kind === '슬라이딩') {
          // 메시지 0x585 → 0x518da
          const decision = slideOnKey({
            playKind: play.kind,
            // 인플레이 진행기는 페어 타구만 돌린다 — 파울이면 여기까지 오지 않는다
            isFoulBattedBall: false,
            runners: runners.map(slidingRunnerOf),
            isSoundPlaying: false,
            hasPlayedSoundThisPlay: slidingSoundPlayed,
          })
          if (decision.playsSound) slidingSoundPlayed = true
          for (const index of decision.slidRunnerIndexes) {
            const runner = runners[index]
            if (runner.state.sliding) continue
            // 슬라이딩의 이득은 딱 하나, 속도 +40 (0xa0164 · R3 3절)
            runner.state = {
              ...runner.state,
              sliding: true,
              speed: runner.state.speed + SLIDING_SPEED_BONUS,
            }
          }
          if (decision.slidRunnerIndexes.length > 0) {
            log.push(`${tick}틱 슬라이딩 — 주자 ${decision.slidRunnerIndexes.join('·')}`)
          }
        } else {
          // 메시지 0x582(진루) · 0x584(귀루) → 0x5209e / 0x5222a → 0xa9b04
          // 0x5209e 는 먼저 경기+0x24 = 0(자동 끄기), 0xa9b04 는 성공한 주자마다 다시 1 로 되돌린다.
          // 앞뒤가 서로 밀어내는 것이 **원본 그대로**라 그 순서를 지킨다.
          autoBaserunning = false
          const moved = runBaserunningCommand(runners, command.kind, command.runner)
          if (moved.length > 0) {
            autoBaserunning = true
            log.push(`${tick}틱 ${command.kind} — 주자 ${moved.join('·')}`)
          }
        }
      }
    }

    // ── 0b. 레이저 송구 반짝임 창 (0x523bc · 0xb2648 · 0x4e858 — I-controls 2d) ──
    if (input.controls?.side === '수비' && input.random !== undefined && !uncatchable) {
      const ticksSinceCatch = tick - catchTick
      const windowOpen = isLaserWindowOpen({
        ticksSinceCatch,
        hasChosenThrowTarget: play.manualThrowBase !== NONE,
        isBallHeld: play.held,
        isThrowerReady: fielders[chaserSlot].actionRemainingTicks <= 0,
      })
      // 굴림은 한 플레이에 한 번(this+0x19af). 창이 열리는 첫 틱(포구 10틱 전)에 굴린다
      if (!laserRolled && windowOpen && ticksSinceCatch >= LASER_WINDOW_FIRST_TICK) {
        laserRolled = true
        laserShining = rollLaserThrow(
          {
            defenseAbility: abilities[chaserSlot] ?? DEFAULT_ABILITY,
            skillIds: input.fielderSkillIds?.[chaserSlot] ?? [],
          },
          input.random,
        )
      }
      const judged = judgeLaserInput({
        isShining: laserShining,
        isWindowOpen: windowOpen,
        key: press?.key ?? null,
        isRepeat: press?.isRepeat === true,
      })
      laserShining = judged.isShining
      if (judged.isLaserConfirmed) laserConfirmed = true
    }

    // ── 1. 포구 ──
    // 필살타법 성공 타구(비트 4)는 야수가 쥐지 않고 지나친다 — 포구 자체를 건너뛴다 (0xaf180·0xbc3)
    if (tick === catchTick && !uncatchable && input.random !== undefined && !fumbled) {
      // 펌블 굴림 (0xb41d0) — **움직이는 공을 잡을 때마다** 걸린다(뜬공 직접 포구 포함).
      // 굴러와 멈춘 공을 줍는 것만 빠진다 (공 vt18 = "공이 멈췄는가", P2 3절 정정).
      const ballIsMoving = tick < trajectory.length - 1
      if (rollFumble(abilities[chaserSlot] ?? DEFAULT_ABILITY, ballIsMoving, input.random)) {
        fumbled = true
        // 야수+0xb8 = 6(놓침 동작), 야수+0xb4 = 15(동작 잠금), 공은 야수 vt78 로 **무작위 튕김**.
        // **근사 1**: 튕김 궤적은 만들지 않는다(궤적 물리 루프는 해독 금지 구역). 같은 자리에서
        // 동작 잠금 15틱 뒤에 다시 줍는 것으로 본다 (R3 5절 동작 0xd = `+0xb4 = 15`).
        // **근사 2**: 원본은 뜬공을 펌블하면 공이 땅에 닿아 타자주자 표시(+0x98)가 풀려 **뜬공 아웃이
        // 사라진다**. 여기서는 타석 결과 코드가 이미 '아웃' 이라 그것을 뒤집으면 기록과 어긋난다 —
        // 그래서 아웃은 그대로 두고 **시간만 잃는** 것으로 옮겼다 (주자들은 그사이 더 간다).
        catchTick = Math.min(tick + FUMBLE_LOCK_TICKS, maximumTicks)
        play = { ...play, catchTick, actionStartTick: catchTick }
        log.push(`${tick}틱 ${chaserSlot}번 야수 펌블 — ${catchTick}틱에 다시 줍는다`)
      }
    }
    if (tick === catchTick && !uncatchable) {
      fielders = fielders.map((fielder) =>
        fielder.slot === chaserSlot
          ? {
              ...fielder,
              position: catchPoint,
              target: catchPoint,
              holdingBall: true,
              // 잡고 던지기까지의 준비 틱(내야 3 · 외야 6, cfg+0x20/+0x22) 을 동작 남은 틱(+0xc8)에 넣는다.
              // `defenseArrivalTicks` 의 "이미 잡았다" 갈래가 이 칸을 그대로 더한다 (0xaf53e).
              actionRemainingTicks: readyTicksOf(fielder.slot),
            }
          : fielder,
      )
      play = { ...play, held: true, everHeld: true, wantsThrow: true }
      log.push(`${tick}틱 ${chaserSlot}번 야수가 잡았다 (종류 ${play.catchKind})`)

      if (onTheFly) {
        // 뜬공 아웃 — 타자주자는 여기서 죽고, 나머지는 리터치(0xa9620) 뒤 태그업 판정을 받는다
        markOut(runners[0])
        outs += 1
        outsAdded += 1
        batterOutTick = tick
        const required = requiredBasesOnFlyCatch(runners.map((runner) => runner.state))
        for (let index = 1; index < runners.length; index += 1) {
          const runner = runners[index]
          if (runner.state.isOut) continue
          const back = basePosition(runner.state.pitchBase)
          // **근사**: 리터치는 즉시 성립한 것으로 본다. 원본은 돌아가는 동안 더블아웃이 날 수 있다.
          runner.state = {
            ...runner.state,
            position: back,
            legStart: back,
            startBase: runner.state.pitchBase,
            targetBase: runner.state.pitchBase,
            requiredBase: required[index],
            settled: false,
          }
        }
      } else {
        // 굴러간 공 — 포스 요구 루를 세운다 (0xa95e8)
        const required = requiredBasesOnBounce(runners.map((runner) => runner.state))
        runners.forEach((runner, index) => {
          runner.state = { ...runner.state, requiredBase: required[index] }
        })
      }

      // ── 송구 목표 루 ──
      // 사람이 방향키로 고른 목표(플레이+0x160)가 있으면 그 루가 먼저다 (0xb1c90 의 사람 가지).
      // 안 골랐으면 CPU 점수식(0xafb24)이 고른다.
      const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
      throwBase =
        play.manualThrowBase !== NONE
          ? play.manualThrowBase
          : chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active })
      if (throwBase !== NONE) {
        // 레이저 송구 — 반짝임 창 안에 새로 누른 키가 들어왔고 공을 쥐었으면 특수 송구가 나간다 (0x400bc)
        laserThrow = canFireLaser({
          isLaserConfirmed: laserConfirmed,
          hasChosenThrowTarget: play.manualThrowBase !== NONE,
          isBallHeld: true,
          isThrowerReady: true,
        })
        // 악송구 굴림 (0xa1828). 레이저(특수)면 기준이 +100 = +1%p 더 위험하다
        const error =
          input.random === undefined
            ? NO_THROW_ERROR
            : rollThrowError(abilities[chaserSlot] ?? DEFAULT_ABILITY, laserThrow, input.random)
        errantThrow = error.errant
        let arrivalTicks = defenseArrivalTicks(contextAt(tick), throwBase)
        if (error.errant) {
          // 속도 보정은 공 속도에 그대로 더해진다(하한 100) → 도착 틱이 그 비율만큼 늘거나 준다.
          // **근사**: 방향 보정(±49)은 공이 루를 벗어난다는 뜻이라 궤적을 다시 만들어야 하는데
          // 그 물리 루프는 해독 금지 구역이다. 여기서는 "그 송구로는 아웃이 안 난다" 로만 본다.
          const base = effectiveThrowSpeedOf(fielders[chaserSlot])
          const errant = Math.max(MINIMUM_THROW_SPEED, base + error.speedDelta)
          arrivalTicks = Math.max(1, Math.trunc((arrivalTicks * base) / errant))
        }
        throwArrivalTick = tick + arrivalTicks
        throwFromSlot = chaserSlot
        log.push(
          `${tick}틱 ${throwBase}루로 ${laserThrow ? '레이저 ' : ''}송구 — ${throwArrivalTick}틱 도착` +
            (error.errant ? ' (악송구)' : ''),
        )
      }
      // 땅볼·직선타로 타자주자가 죽는 시각은 1루에 공이 닿는 때다
      if (input.outcome.kind === '아웃' && !onTheFly) {
        batterOutTick = tick + defenseArrivalTicks(contextAt(tick), 1)
      }
    }

    // ── 2. 송구 도착 — 그 루로 가던 주자가 아직 못 닿았으면 아웃 ──
    // 악송구면 공이 루를 벗어나므로 아무도 잡히지 않는다 (위 근사)
    if (throwArrivalTick >= 0 && tick === throwArrivalTick) {
      if (!errantThrow) {
        for (let index = runners.length - 1; index >= 1; index -= 1) {
          const runner = runners[index]
          if (runner.state.isOut || runner.state.scored) continue
          if (wrapBase(runner.state.targetBase) !== wrapBase(throwBase)) continue
          if (isAtTarget(runner.state)) continue
          markOut(runner)
          outs += 1
          outsAdded += 1
          log.push(`${tick}틱 ${index}번 주자 ${throwBase}루에서 아웃`)
          break
        }
      }
      play = { ...play, wantsThrow: false }
      // 공은 **받은 야수의 손으로 옮겨 간다** — 0xb2734 가 `P+0x130 = 받은 야수 번호` · `야수+0xe0 = 1`.
      // 이 줄이 없으면 공 쥔 야수가 끝까지 "쫓아간 야수" 로 남는데, 그 야수는 커버 배정에서 빠져 있어
      // 협살 조건("공 쥔 야수가 두 커버 야수 중 하나", 0xb3fa8)이 영영 서지 않는다.
      const receiverSlot = errantThrow ? NONE : covers[wrapBase(throwBase)] ?? NONE
      if (receiverSlot !== NONE) {
        fielders = fielders.map((fielder) =>
          fielder.slot === receiverSlot
            ? { ...fielder, holdingBall: true }
            : fielder.holdingBall
              ? { ...fielder, holdingBall: false }
              : fielder,
        )
        play = { ...play, ballHolderSlot: receiverSlot, held: true }
      }
    }

    // ── 2b. 협살 (AI 상태 8) ──
    // 원본은 플레이 틱 0xb401c 안 0xb433c~0xb4378 에서, 송구 판정 바로 뒤에 이 갈래를 본다:
    //   `P+0x1f0 == −1 이면 0xb3fa8(가능 검사) → state[0x31+수비측] == 1(CPU) 이면 0xb3a94(시작)`.
    // **사람이 수비하면 협살은 절대 안 일어난다** (S8 1-4).
    if (defenseIsCpu && !play.finished && play.everHeld) {
      if (rundown.runnerIndex === NONE) {
        const context = contextAt(tick)
        const target = chooseRundownRunner(context.runners)
        // ⚠️ **근사**: 대상이 타자주자(0번)면 협살을 걸지 않는다. 이 진행기의 규약이
        // "타자주자의 운명은 결과 코드가 정한다" 여서, 송구 도착 아웃 판정도 같은 이유로
        // `index >= 1` 부터 본다. 협살이 타자주자를 잡으면 3루타가 아웃으로 뒤집혀 기록과 어긋난다.
        // 원본은 위치 분석이 결과를 정하지 않으므로 타자주자도 협살 대상이 된다.
        // 고르기(0xb398c)가 **뒤 주자부터** 보므로 0번은 다른 주자가 없을 때만 뽑힌다.
        if (target !== NONE && target !== 0 && canStartRundown(context, true)) {
          rundown = buildRundownPlan(context, target)
          rundowns += 1
          fielders = fielders.map((fielder) =>
            fielder.slot === rundown.backFielder || fielder.slot === rundown.frontFielder
              ? { ...fielder, aiState: AI_STATE.RUNDOWN }
              : fielder,
          )
          log.push(
            `${tick}틱 협살 시작 — ${rundown.runnerIndex}번 주자 ${rundown.backBase}↔${rundown.frontBase}루 ` +
              `(야수 ${rundown.backFielder}·${rundown.frontFielder})`,
          )
        }
      } else {
        // 협살 중 짝에게 던진 공이 닿았다 — 공 쥔 쪽이 바뀐다
        if (rundownThrowArrival >= 0 && tick >= rundownThrowArrival) {
          const to = rundownThrowTo
          fielders = fielders.map((fielder) =>
            fielder.slot === to
              ? { ...fielder, holdingBall: true }
              : fielder.holdingBall
                ? { ...fielder, holdingBall: false }
                : fielder,
          )
          play = { ...play, ballHolderSlot: to, held: true }
          rundownThrowArrival = -1
          rundownThrowTo = NONE
        }
        const chased = runners[rundown.runnerIndex]
        let released = true
        if (chased !== undefined && !chased.state.isOut) {
          released = false
          for (const slot of [rundown.backFielder, rundown.frontFielder]) {
            if (released) break
            const action = rundownAction({ ...contextAt(tick), plan: rundown, slot, ballTarget: catchPoint })
            if (action.kind === '협살해제') {
              released = true
              break
            }
            const self = fielders[slot]
            if (self === undefined) continue
            if (action.kind === '주자추적') {
              // vt0x4c — 상대의 현재 위치를 그대로 목표로 삼는다
              const to = chased.state.position
              const moved = stepToward(self.position, to, self.speed)
              fielders = fielders.map((fielder) =>
                fielder.slot === slot ? { ...fielder, target: to, position: moved } : fielder,
              )
              // **근사**: 태그 판정(0xb3946)은 따로 있는 함수라 여기서는 "공을 쥔 야수가 한 걸음 안까지
              // 붙으면 잡았다" 로 본다. 원본의 태그 판정 줄까지는 안 읽었다.
              if (self.holdingBall && horizontalDistance(moved, to) <= self.speed) {
                markOut(chased)
                outs += 1
                outsAdded += 1
                rundownOuts += 1
                released = true
                log.push(`${tick}틱 협살 태그 — ${rundown.runnerIndex}번 주자 아웃`)
              }
            } else if (action.kind === '짝에게송구') {
              if (rundownThrowArrival < 0) {
                const partner = fielders[action.toSlot]
                if (partner !== undefined) {
                  rundownThrowTo = action.toSlot
                  rundownThrowArrival = tick + Math.max(1, throwTicksToFielder(self, partner))
                  log.push(`${tick}틱 협살 송구 ${slot}→${action.toSlot} — ${rundownThrowArrival}틱 도착`)
                }
              }
            } else if (action.kind === '루로' || action.kind === '공쫓기') {
              const to = action.kind === '루로' ? basePosition(action.base) : action.target
              fielders = fielders.map((fielder) =>
                fielder.slot === slot
                  ? { ...fielder, target: to, position: stepToward(fielder.position, to, fielder.speed) }
                  : fielder,
              )
            }
            // '대기' 는 vt0x10(동작 정지) — 이번 틱에 아무것도 안 한다
          }
        }
        if (released) {
          // 협살 종료 0xb26b8 — 기록칸을 지우고 상태 8 인 야수를 전부 상태 0 으로 되돌린다
          fielders = endRundown(fielders)
          rundown = NO_RUNDOWN
          rundownThrowArrival = -1
          rundownThrowTo = NONE
        }
      }
    }

    // ── 3. 타자주자의 선언된 운명 ──
    if (batterOutTick >= 0 && tick === batterOutTick && !runners[0].state.isOut) {
      markOut(runners[0])
      outs += 1
      outsAdded += 1
      log.push(`${tick}틱 타자주자 아웃`)
    }

    // ── 4. 자동 추가 진루 (0xaf918) ──
    // 멈춘 주자(루에 붙은 주자·태그업 대기)까지 보려면 force 가 필요하다 — 원본 인자 그대로다.
    // 사람이 주루 키를 눌러 경기+0x24 가 0 이 된 플레이에서는 돌지 않는다 (I-controls 3b).
    if (!play.finished && autoBaserunning) {
      const decisions = autoAdvanceDecisions({ ...contextAt(tick), force: true })
      for (const decision of decisions) {
        const runner = runners[decision.runnerIndex]
        if (runner === undefined || runner.state.isOut || runner.state.scored) continue
        if (decision.toBase > HOME_BASE) continue
        // **근사**: 원본은 이 판정을 매 틱 돌리지만, 여기서는 **지금 목표 루에 닿아 있을 때만** 묻는다.
        // 안 그러면 달리는 도중에 한 루씩 계속 얹혀 타구가 떠나기도 전에 홈까지 밀려 버린다.
        if (!isAtTarget(runner.state)) continue
        // 타자주자는 결과 코드가 정한 루에서 멈춘다 — 안타 종류가 이미 정해져 있어 더 가면 기록과 어긋난다
        if (runner.state.isBatterRunner && decision.toBase > runner.minimumBase) continue
        startLeg(runner, decision.toBase)
      }
    }

    // ── 5. 화면 스냅샷 ──
    ticks.push(
      viewStateOf({
        tick,
        ball: ballPointAt({
          tick,
          trajectory,
          catchTick,
          fielders,
          chaserSlot,
          throwBase,
          throwArrivalTick,
          throwFromSlot,
          uncatchable,
        }),
        ballIsFlying:
          uncatchable
            ? tick < trajectory.landingTick
            : tick < catchTick || (throwArrivalTick >= 0 && tick < throwArrivalTick),
        fielders,
        runners: runners.map((runner) => runner.state),
        catchKind: tick >= play.actionStartTick && tick <= catchTick ? play.catchKind : null,
        chaserSlot,
        throwingSlot: throwArrivalTick >= 0 && tick >= catchTick && tick < catchTick + 3 ? chaserSlot : NONE,
        throwBase,
        previousActions,
      }),
    )

    // ── 6. 한 틱 움직이기 ──
    fielders = fielders.map((fielder) => moveFielder(fielder, { chaserSlot, catchPoint, covers, tick, catchTick }))
    for (const runner of runners) {
      if (runner.state.isOut || runner.state.scored) continue
      const target = basePosition(runner.state.targetBase)
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, target, runner.state.speed),
      }
      if (!isAtTarget(runner.state)) continue
      runner.state = { ...runner.state, settled: true }
      // 결과 코드가 정한 루까지는 반드시 간다 (타자주자의 1·2·3루타). 한 루씩 이어 달린다
      if (runner.state.targetBase < runner.minimumBase) {
        startLeg(runner, runner.state.targetBase + 1)
        continue
      }
      // 홈을 밟았다 — 2아웃 보류 규칙(state[0])을 태운다
      if (wrapBase(runner.state.targetBase) === 0 && runner.state.targetBase !== 0 && !runner.counted) {
        runner.counted = true
        runner.state = { ...runner.state, scored: true }
        held = onRunnerReachesHome(held, {
          outs,
          ballOnGround,
          batterRunner: runners[0].state,
          scoringRunnerIsBatterRunner: runner.state.index === 0,
        })
        log.push(`${tick}틱 ${runner.state.index}번 주자 홈 — 보류 ${held.heldRuns} / 득점 ${held.scoreboardRuns}`)
      }
    }

    // ── 7. 보류 득점 풀기 (0xaa34c) ──
    const stillActive = runners.some(
      (runner) => !runner.state.isOut && !runner.state.scored && !isAtTarget(runner.state),
    )
    held = releaseHeldRuns(held, {
      outs,
      ballOnGround,
      batterRunner: runners[0].state,
      someRunnerStillActive: stillActive,
    })

    // ── 8. 끝났나 ──
    const throwSettled = throwArrivalTick < 0 || tick >= throwArrivalTick
    const batterSettled = batterOutTick < 0 || tick >= batterOutTick
    // 아무도 잡지 않는 타구는 "잡은 적 있음" 이 서지 않으므로 낙구를 끝 조건으로 쓴다
    const ballSettled = uncatchable ? tick >= trajectory.landingTick : play.everHeld
    if (ballSettled && throwSettled && batterSettled && !stillActive) {
      play = { ...play, finished: true }
    }
  }

  // ── 한 틱치를 상태에 되돌려 넣는다 ──
  state.fielders = fielders
  state.play = play
  state.held = held
  state.outs = outs
  state.outsAdded = outsAdded
  state.throwBase = throwBase
  state.throwArrivalTick = throwArrivalTick
  state.throwFromSlot = throwFromSlot
  state.batterOutTick = batterOutTick
  state.catchTick = catchTick
  state.fumbled = fumbled
  state.errantThrow = errantThrow
  state.autoBaserunning = autoBaserunning
  state.slidingSoundPlayed = slidingSoundPlayed
  state.laserShining = laserShining
  state.laserConfirmed = laserConfirmed
  state.laserRolled = laserRolled
  state.laserThrow = laserThrow
  state.rundown = rundown
  state.rundownThrowArrival = rundownThrowArrival
  state.rundownThrowTo = rundownThrowTo
  state.rundowns = rundowns
  state.rundownOuts = rundownOuts
  state.tick = tick + 1
  return state
}

/**
 * 다 돈 상태에서 결과를 뽑는다 — 원본 루프가 끝난 뒤의 마무리다.
 *
 * 타석 단위로 마무리할 때의 같은 결과 규칙 (S2 2-5, `runsAfterTwoOutRule`):
 * **땅볼로 타자주자가 아웃이 되어 그 플레이에서 3아웃이 되면 주자 득점은 0** 이다.
 * 틱 단위로는 주자가 타자주자보다 먼저 홈을 밟아 `state[0]` 보류를 안 타는 경우가 있어
 * (0xaa164 는 "타자주자가 살아서 뛰는 중" 이면 바로 올린다) 마지막에 한 번 더 건다.
 */
export function defensePlayResultOf(state: DefensePlayState): DefensePlayResult {
  const held = state.held
  const runners = state.runners
  const runsScored = runsAfterTwoOutRule(held.scoreboardRuns, {
    outsAfter: state.outs,
    ballOnGround: !state.onTheFly,
    batterRunnerOut: runners[0].state.isOut,
  })

  return {
    advance: {
      bases: basesOf(runners),
      runsScored,
      outsAdded: state.outsAdded,
    },
    ticks: state.ticks,
    catchFielderSlot: state.chaserSlot,
    catchTick: state.catchTick,
    isUncatchable: state.uncatchable,
    caughtOnTheFly: state.onTheFly,
    throwBase: state.throwBase,
    throwArrivalTick: state.throwArrivalTick,
    voidedRuns: held.heldRuns + (held.scoreboardRuns - runsScored),
    fumbled: state.fumbled,
    errantThrow: state.errantThrow,
    specialDefense: state.specialDefense,
    laserThrow: state.laserThrow,
    rundowns: state.rundowns,
    rundownOuts: state.rundownOuts,
    log: state.log,
  }
}

/**
 * 타구 하나를 **끝까지 미리 돌려** 결과를 내준다 — 스테퍼를 다 돌리는 **얇은 껍데기**다.
 *
 * 사람이 실시간으로 치는 화면은 이것을 쓰지 않고 `startDefensePlay`·`stepDefensePlay` 를 직접 돌린다.
 * 여기서는 조작이 있으면 `keyAt(tick)` 으로 "그 틱에 눌렸을 키" 를 미리 물어 넘긴다.
 */
export function runDefensePlay(input: DefensePlayInput): DefensePlayResult {
  let state = startDefensePlay(input)
  while (!isDefensePlayFinished(state)) {
    state = stepDefensePlay(state, input.controls?.keyAt(state.tick) ?? null)
  }
  return defensePlayResultOf(state)
}

/** 펌블 뒤 동작 잠금 틱 — 야수+0xb4 = 15 (놓침 동작 0xd, R3 2-1) */
const FUMBLE_LOCK_TICKS = 15

interface SpecialDefenseRollInput {
  readonly random?: RandomPort
  readonly ability: number
  readonly skillIds?: readonly number[]
  readonly gameMode?: number
  readonly chaserSlot: number
  readonly uncatchable: boolean
}

/**
 * 필살수비 굴림의 관문 (0x50faa 가지, I-controls 2c).
 * 모드 7(홈런더비) 제외 · 공 쫓는 야수가 투수(0)·포수(1)가 아닐 것 — 나머지 조건(경기+0x13·0x19·0x1e,
 * 담장 판정 0x36140)은 이 진행기가 도는 시점에 이미 참이다(페어 인플레이 타구만 돌린다).
 */
function rollSpecialDefenseFor(input: SpecialDefenseRollInput): {
  readonly jumpUnlocked: boolean
  readonly slideUnlocked: boolean
} {
  const 닫힘 = { jumpUnlocked: false, slideUnlocked: false }
  if (input.random === undefined) return 닫힘
  if (input.uncatchable) return 닫힘
  if (input.gameMode === HOME_RUN_DERBY_MODE) return 닫힘
  if (input.chaserSlot === 0 || input.chaserSlot === 1) return 닫힘
  return rollSpecialDefense(input.ability, input.random, {
    hasSixthSense: input.skillIds?.includes(SIXTH_SENSE_SKILL_ID) === true,
    isBatterCareerMode: input.gameMode === BATTER_CAREER_MODE,
  })
}

/** 주자 한 명을 슬라이딩 판정(0xa9690)이 보는 모양으로 옮긴다 */
function slidingRunnerOf(runner: MutableRunner): SlidingRunner {
  const target = basePosition(runner.state.targetBase)
  return {
    progressPercent: progressPercent(runner.state.legStart, runner.state.position, target),
    isOut: runner.state.isOut,
    // 아웃돼 걸어 나가는 연출(+0xba)은 이 진행기에 없다 — 죽은 주자는 그 자리에서 사라진다
    isLeavingField: false,
    isSliding: runner.state.sliding,
    targetBase: runner.state.targetBase,
    ticksToArrive: ticksToReach(runner.state.position, target, runner.state.speed),
  }
}

/**
 * 주루 키 한 번 — 0xa9b04(주자관리, 루, 방향).
 * 인자는 **주자 번호**다 — 1·2·3 = 투구 때 1·2·3루에 있던 주자, −1 = 전원 (I-controls 0절).
 * 전원이면 **진루는 1→2→3루 주자 순, 귀루는 3→2→1루 주자 순**으로 하나씩 부른다.
 *
 * 앞길 검사(0xa99a8)는 "가려는 루를 다른 주자가 목표로 삼고 있지 않을 것" 만 옮겼고,
 * 뒷길 검사(0xa9924)는 **달리는 중인 주자를 출발 루로 되돌리는 것**으로 좁혔다.
 * 원본의 나머지 조건은 문서가 **유력**으로만 적어 두어 지어내지 않는다 (I-controls 3b).
 */
function runBaserunningCommand(
  runners: readonly MutableRunner[],
  kind: '진루' | '귀루',
  target: RunnerTarget,
): readonly number[] {
  const order: RunnerTarget[] =
    target === '전원' ? (kind === '진루' ? [1, 2, 3] : [3, 2, 1]) : [target]
  const moved: number[] = []
  for (const pitchBase of order) {
    // 0xa97a0(루의 주자) — 인자가 가리키는 것은 "투구 때 그 루에 있던 주자" 다
    const runner = runners.find(
      (candidate) =>
        !candidate.state.isOut &&
        !candidate.state.scored &&
        candidate.state.pitchBase === pitchBase,
    )
    if (runner === undefined) continue

    if (kind === '귀루') {
      // 달리는 중인 주자만 되돌린다 (이미 루에 붙어 있으면 되돌릴 곳이 없다)
      if (isAtTarget(runner.state)) continue
      startLeg(runner, runner.state.startBase)
      moved.push(runner.state.index)
      continue
    }

    const toBase = runner.state.targetBase + 1
    if (toBase > HOME_BASE) continue
    const blocked = runners.some(
      (other) =>
        other !== runner &&
        !other.state.isOut &&
        !other.state.scored &&
        wrapBase(other.state.targetBase) === wrapBase(toBase),
    )
    if (blocked) continue
    startLeg(runner, toBase)
    moved.push(runner.state.index)
  }
  return moved
}

/** 패턴에서 궤적까지 한 번에 만들어 돌린다 — 부르는 쪽이 편하게 */
export function runDefensePlayForPattern(
  input: Omit<DefensePlayInput, 'trajectory'> & { readonly pattern: BattedBallPattern },
): DefensePlayResult {
  return runDefensePlay({ ...input, trajectory: battedBallTrajectory(input.pattern) })
}

// ── 잡다한 도우미들 ──

const wrapBase = (base: number) => ((base % 4) + 4) % 4

function isAtTarget(runner: RunnerState): boolean {
  return isSamePoint(runner.position, basePosition(runner.targetBase))
}

function markOut(runner: MutableRunner): void {
  runner.state = { ...runner.state, isOut: true, settled: true }
}

/** 다음 구간 시작 — 출발점(+0x14)과 출발 루(+0x7c)를 새로 잡아야 진행률·협살 계산이 맞는다 */
function startLeg(runner: MutableRunner, toBase: number): void {
  runner.state = {
    ...runner.state,
    legStart: runner.state.position,
    startBase: runner.state.targetBase,
    targetBase: toBase,
    settled: false,
  }
}

function basesOf(runners: readonly MutableRunner[]): BaseState {
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

interface FielderMoveInput {
  readonly chaserSlot: number
  readonly catchPoint: WorldPoint
  readonly covers: readonly number[]
  readonly tick: number
  readonly catchTick: number
}

/** 야수 한 틱 — 쫓는 야수는 포구 지점으로, 커버는 제 루로, 나머지는 제자리 */
function moveFielder(fielder: FielderState, input: FielderMoveInput): FielderState {
  // 협살(상태 8) 중인 야수는 분기표가 0xb48b6 으로 가므로 커버 이동을 하지 않는다 — 2b 절이 이미 옮겼다
  if (fielder.aiState === AI_STATE.RUNDOWN) return fielder
  if (fielder.slot === input.chaserSlot) {
    if (input.tick >= input.catchTick) return fielder
    return {
      ...fielder,
      target: input.catchPoint,
      position: stepToward(fielder.position, input.catchPoint, fielder.speed),
      aiState: AI_STATE.CHASE,
    }
  }
  const base = input.covers.indexOf(fielder.slot)
  if (base < 0) return fielder
  const point = basePosition(base)
  return {
    ...fielder,
    target: point,
    targetBase: base,
    position: stepToward(fielder.position, point, fielder.speed),
    aiState: AI_STATE.COVER_HOME + base,
  }
}

interface BallPointInput {
  readonly tick: number
  readonly trajectory: BattedBallTrajectory
  readonly catchTick: number
  readonly fielders: readonly FielderState[]
  readonly chaserSlot: number
  readonly throwBase: number
  readonly throwArrivalTick: number
  readonly throwFromSlot: number
  /** 아무도 잡지 않는 타구인가 — 그러면 공은 끝까지 궤적 위에 있다 */
  readonly uncatchable: boolean
}

/** 이번 틱에 공이 어디 있나 — 포구 전에는 궤적, 포구 뒤에는 송구선 위 */
function ballPointAt(input: BallPointInput): WorldPoint {
  if (input.uncatchable) return input.trajectory.pointAt(input.tick)
  if (input.tick < input.catchTick) return input.trajectory.pointAt(input.tick)
  const holder = input.fielders[input.chaserSlot] ?? input.fielders[0]
  if (input.throwArrivalTick < 0 || input.throwBase === NONE) return holder.position
  if (input.tick >= input.throwArrivalTick) return basePosition(input.throwBase)

  const from = input.fielders[input.throwFromSlot]?.position ?? holder.position
  const to = basePosition(input.throwBase)
  const whole = input.throwArrivalTick - input.catchTick
  if (whole <= 0) return to
  const done = input.tick - input.catchTick
  return {
    x: from.x + Math.trunc(((to.x - from.x) * done) / whole),
    // 송구는 낮은 포물선으로 본다 (근사) — 화면이 공 크기를 고를 때만 쓴다
    y: Math.trunc((1200 * done * (whole - done)) / (whole * whole)),
    z: from.z + Math.trunc(((to.z - from.z) * done) / whole),
  }
}

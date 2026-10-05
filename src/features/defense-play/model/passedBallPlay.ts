import type { RandomPort } from '@/shared/api/random/randomPort'
import { battedBallTrajectory, BATTING_POINT } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { basePosition, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { PASSED_BALL_PLAY_KIND, type PassedBallShot } from '@/entities/fielding/model/passedBall'
import { secondBaseCoverSlot } from '@/entities/fielding/model/throwArrival'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import { forecastCatch } from '@/features/defense-play/model/catchForecast'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import {
  RUNNER_PLAY_RESULT,
  runRunnerPlay,
  type RunnerPlayEngineResult,
} from '@/features/defense-play/model/runnerPlayEngine'

/**
 * **폭투·포일 한 판** — 플레이 종류 9 (S8 5절). 투구마다 0.1% 로 공이 포수 뒤로 빠지고, 포수(또는 가장
 * 먼저 닿는 야수)가 그 공을 쫓아 줍는 동안 주자가 뛴다.
 *
 * ## 길 (전부 직접 뜬 것)
 * ```
 * 0x3e038  r = 0x35034(장면)                 ; rollPassedBall — 모드 7 빼고 10 > rand(0,10000)
 * 0x3e05a  v = 0x9d57c(…)                    ; 투구 판정
 * 0x3e062  r && v ≠ 3 && v ≠ 4:
 *            0x3507c  각 = rand(60,130) · 세기 = rand(160,280) · 수직 −100 → 메시지 0x11(공 쏘기)   ; passedBallShot
 *            0xb0cb8(플레이, 9) ; 포수+0xb8 = 6(놓침 동작) ; 상태 0x17
 *            v == 5 → 낫아웃 갈래 (`passedBallStrikeoutOf`)
 * 0x46418  상태 0x17 진입: 플레이.vt18 → 종류 9 = 0xb284a
 * 0xb284a  vt1c ; vt20(0) ; P+0x130 = 1(포수) ; vt24(1)(=0xb12d0 예보) ; vt34(=0xb3b38 고르기) ;
 *          vt30(=0xb1c90 송구/커버) ; **P+0x112 = 1**(0xb2888 → 0xb28b6 `strb`)
 * ```
 * - **P+0x112 = 1 로 시작한다** — 아웃 판정의 결과 1(뜬공 아웃)은 "+0x112 == 0 에서 처음 쥠" 이라
 *   공을 바운드 전에 잡아도 아웃이 아니다. 타격 기록도 없다(0x9d5bc 가 state[0x19] 면 0).
 * - 종류 9 는 `0xa276c`(공 첫 점 세우기)를 안 부른다 — 공은 메시지 0x11 이 쏜 궤적 그대로다.
 * - 판정 콜: 결과 9 는 0x51c14 의 종류 4·5 갈래 **밖**이라 소리 객체 상태(`[[0x1400058]+5]`·`+0x14`)를 본다 —
 *   둘 다 17 을 내는 갈래이고(하나는 0x51b18 경유) 소리가 이미 재생 중이면 안 낸다. 그래서 웹은 17 로 둔다.
 *
 * ## 판이 끝난 뒤의 진루 — S8 5-5 의 미해결을 닫는다
 * 진루는 판이 **끝난 뒤** 따로 정해지지 않는다. 판이 도는 동안 매 틱 자동 추가 진루 0xaf918 이 돈다:
 * - 0x5261c~0x52668(경기 장면 슬롯 2, 상태 0x17 매 틱): `0xae690` = 공격이 CPU 거나 주루 설정 자동이면 돈다.
 * - 0xaf918 의 종류 거르개는 {2, 3, 8} 뿐이고(0xaf9ac), "잡힐 뜬공" 갈래(0xaf98e)는 `+0x112 == 0` 일 때만인데
 *   종류 9 는 +0x112 = 1 로 시작하므로 **처음부터 틱 비교 갈래**를 탄다: 다음 루에 수비 송구(0xaf284)보다
 *   2틱 넘게 먼저 닿으면 한 루 더 간다 (`autoAdvance.ts`, P2 5a · S7 확정).
 * - 사람이 공격하면서 주루 수동이면 이 진루는 아예 안 돈다 — 사람 주루 키(0x582)로만 간다.
 * 곧 폭투·포일의 진루 = 위 규칙 그대로다. 사람 주루 키는 이 진행기가 받지 않는다(미리 돌려 재생만 한다).
 *
 * ## 근사 (지어내지 않은 자리)
 * - ⚠️ **공 궤적**은 웹 타구 근사(`battedBallFlight`)에 0x3507c 의 각·세기·수직 속도를 넣은 것이다.
 *   원본 물리 루프(0xb401c)는 해독 금지 구역이다. 각은 0x3507c 가 부호 없이 넣고(+0xfcc = +60…+130),
 *   타격은 −a 를 넣으므로 웹 패턴 각으로는 −각 이다(S8 5-4: 홈플레이트 뒤쪽).
 * - ⚠️ **포수 +0xb8 = 6(놓침 동작)** 이 포구 예보·이동에 주는 효과는 안 옮겼다(동작 잠금 칸은 +0xb4 라 따로다).
 * - ⚠️ **커버**: 0xb1c90 은 매 틱 다시 고르지만 여기서는 시작에 한 번 고른다 — 2루는 타구 진행기와 같은
 *   `secondBaseCoverSlot`, 쫓는 야수가 맡던 루는 0xb1d48 갈래대로 투수(0)가 맡되 `0xb1b88`(그 루로 올 주자가
 *   있는가)이 거짓이면 없음(−1). 0xb1b88 의 타자주자 갈래(0xb1bde~0xb1c08, P+0x168 비교)는 안 옮겼다.
 * - ⚠️ 낫아웃 타자주자는 0xa93ac 가 세우는 대로 요구 루 1 로 만들고 처음부터 1루로 뛰게 한다 —
 *   0xa93ac 뒤 누가 목표 루를 1 로 세우는지는 안 읽었다(타구 진행기와 같은 다리).
 */
export interface PassedBallPlayInput {
  /** 0x3507c 가 굴린 값 — `passedBallShot(random)` 을 rollPassedBall 이 선 투구에서 그대로 */
  readonly shot: PassedBallShot
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /**
   * state[6] — 판이 열릴 때의 아웃 수 = **이 투구 전의 아웃 수** (`StealPlayInput.outs` 와 같다).
   * 낫아웃 갈래의 0xa7c4c 는 삼진 기록(이벤트 5 · 투수/타자 칸)만 올리고 state[6] 은 안 건드린다.
   */
  readonly outs: number
  /** `passedBallStrikeoutOf` 가 `'batterRuns'` 면 참 — 타자주자를 맨 앞에 만든다 (state[0x1a]) */
  readonly batterRuns?: boolean
  readonly defenseAbilities?: readonly number[]
  /** 주자 주루 능력치 — 루별(0 = 낫아웃 타자주자) */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
  /** 주면 펌블(0xb41d0) · 악송구(0xa1828) · 특수 송구(0xafa60) 굴림이 돈다 */
  readonly random?: RandomPort
  readonly defenseIsCpu?: boolean
  readonly throwMode?: ManualAutoMode
  readonly manualThrowBase?: number
  readonly offenseIsCpu?: boolean
  readonly runningMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
}

export interface PassedBallPlayResult extends RunnerPlayEngineResult {
  readonly shot: PassedBallShot
  readonly batterRuns: boolean
}

const DEFAULT_ABILITY = 500
const CATCHER_SLOT = 1
const PITCHER_SLOT = 0

/** 0x3507c 의 쏘기 값 → 웹 궤적 (근사 — 머리말). 시작점은 타구와 같은 표준 배팅 지점 */
export function passedBallTrajectoryOf(shot: PassedBallShot): BattedBallTrajectory {
  return battedBallTrajectory([-shot.angle, shot.strength, shot.verticalSpeed, 0], { origin: BATTING_POINT })
}

export function runPassedBallPlay(input: PassedBallPlayInput): PassedBallPlayResult {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const trajectory = passedBallTrajectoryOf(input.shot)
  const batterRuns = input.batterRuns === true

  // ── 주자 목록 — 타자주자(낫아웃이면) 맨 앞 + 찬 루 오름차순 ──
  const runners: RunnerState[] = []
  const speedOf = (base: 0 | 1 | 2 | 3) =>
    runnerSpeedOf(input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY, input.runnerTeamGrade ?? 0)
  if (batterRuns) {
    // 0xa93ac: 홈에 세우고 +0x88 = 1(요구 루) · +0x90 = 0 · +0x98 = 1(타자주자)
    runners.push(createRunner(0, 0, speedOf(0), { targetBase: 1, requiredBase: 1, isBatterRunner: true }))
  }
  ;([1, 2, 3] as const).forEach((base) => {
    const occupied = base === 1 ? input.bases.first : base === 2 ? input.bases.second : input.bases.third
    if (!occupied) return
    // 번호는 1 부터 — 0 은 타자주자 자리 (그림이 타자로 그리지 않게, 견제 진행기와 같다)
    const index = batterRuns ? runners.length : runners.length + 1
    runners.push(createRunner(index, base, speedOf(base), { isBatterRunner: false }))
  })

  // ── 0xb284a: 예보(vt24, 추적야수 = 포수라 t ≤ 4 동안 포수를 건너뜀) → 고르기(vt34) ──
  const startFielders = createFielders(abilities)
  const forecast = forecastCatch(trajectory, startFielders, { from: 0, to: Number.POSITIVE_INFINITY }, {
    initialChaserSlot: CATCHER_SLOT,
  })
  const chaserSlot = forecast.choice.slot
  const catchTick = Math.max(0, forecast.choice.catchTick)
  const catchPoint = trajectory.pointAt(catchTick)

  // ── vt30 = 0xb1c90 커버 ──
  const covers = passedBallCovers(chaserSlot, catchPoint.x > basePosition(0).x, runners)
  const fielders: FielderState[] = startFielders.map((fielder) => {
    if (fielder.slot === chaserSlot) return { ...fielder, aiState: AI_STATE.CHASE }
    const base = covers.indexOf(fielder.slot)
    if (base < 0) return fielder
    return { ...fielder, target: basePosition(base), targetBase: base, aiState: AI_STATE.COVER_HOME + base }
  })
  const play: PlayView = {
    ...initialPlayView(PASSED_BALL_PLAY_KIND),
    coverOfBase: covers,
    ballHolderSlot: chaserSlot,
    catchFielderSlot: chaserSlot,
    catchKind: forecast.choice.kind,
    catchTick,
    actionStartTick: forecast.choice.actionStartTick,
    // 0xb28b6: P+0x112 = 1
    everHeld: true,
  }

  const result = runRunnerPlay({
    kind: PASSED_BALL_PLAY_KIND,
    fielders,
    play,
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: false,
    chase: { trajectory, slot: chaserSlot, catchTick },
    random: input.random,
    defenseIsCpu: input.defenseIsCpu,
    throwMode: input.throwMode,
    manualThrowBase: input.manualThrowBase,
    offenseIsCpu: input.offenseIsCpu,
    runningMode: input.runningMode,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    offenseTeamIndex: input.offenseTeamIndex,
  })
  return { ...result, shot: input.shot, batterRuns }
}

/**
 * 시작 커버 (0xb1c90 의 커버 부분 0xb1cd6~0xb1f04 를 시작 한 번만):
 * 표 0xd8774 = [1, 2, 3, 4] → 쫓는 야수(P+0x130)가 1·2·4 면 그 루를 투수(0)에게 넘기고(0xb1d48 갈래),
 * 0xb1b88 이 그 루로 올 주자가 없다고 하면 −1. 2루는 쫓는 야수가 2루수면 유격수, 유격수면 2루수,
 * 아니면 공이 1루 쪽이면 유격수 · 아니면 2루수(0xb1e2e~0xb1e64 = `secondBaseCoverSlot`).
 */
export function passedBallCovers(
  chaserSlot: number,
  ballToFirstSide: boolean,
  runners: readonly RunnerState[],
): number[] {
  const covers = [1, 2, 3, 4]
  covers[2] = secondBaseCoverSlot(ballToFirstSide, chaserSlot)
  const handedOver = chaserSlot === 1 ? 0 : chaserSlot === 2 ? 1 : chaserSlot === 4 ? 3 : NONE
  if (handedOver !== NONE) covers[handedOver] = needsCover(handedOver, runners) ? PITCHER_SLOT : NONE
  return covers
}

/**
 * 0xb1b88(P, 루 b) — 그 루에 커버가 필요한가 (state[7] = 1 · 협살 없음 일 때, 직접 뜬 것):
 * ```
 * 주자 중 +0x94 && +0x88 == b && 산 주자 → 1
 * (타자주자 갈래 0xb1bde~0xb1c08 — 안 옮김)
 * r = b == 0 ? 4 : b
 * 루 r 에 닿은 주자(0xa97a0) 있으면 → 살았나
 * 없고 루 r−1 에 닿은 주자 있으면 → 살았나
 * 없고 루 r−2 에 닿은 산 주자가 r−1 로 가는 중(+0x7c) 이면 1, 아니면 0
 * ```
 */
function needsCover(base: number, runners: readonly RunnerState[]): boolean {
  const alive = runners.filter((runner) => !runner.isOut)
  if (alive.some((runner) => runner.settled && runner.requiredBase === base)) return true
  const r = base === 0 ? 4 : base
  const on = (b: number) => alive.find((runner) => runner.startBase === b)
  if (on(r) !== undefined) return true
  if (on(r - 1) !== undefined) return true
  const twoBack = on(r - 2)
  return twoBack !== undefined && twoBack.targetBase === r - 1
}

/** 폭투·포일 판의 콜 — 결과 9 → 17 (소리 재생 중이 아니면, 머리말) · 13 → 62/20 · 없음 → 없음 */
export function passedBallCallSoundIdOf(result: Pick<PassedBallPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === RUNNER_PLAY_RESULT.SAFE) return 17
  if (result.resultCode === RUNNER_PLAY_RESULT.OUT) return result.tagOut ? 62 : 20
  return null
}

/** 재생 칸에 든 결과가 폭투·포일 판인가 */
export function isPassedBallPlayResult(result: DefensePlayResult | null): result is PassedBallPlayResult {
  return result !== null && 'shot' in result && 'resultCode' in result
}

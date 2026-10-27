import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { FUMBLE_MARK_TICKS } from '@/features/defense-play/model/playerEffects'
import type { HolderPlate } from '@/features/defense-play/model/defensePlayView'
import { loadedRunnerAceOf, runnerAceIndexesOf, type RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import { battedBallTrajectory, BATTING_POINT } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallTrajectory } from '@/entities/fielding/model/catchPrediction'
import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
  initialPlayView,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { PASSED_BALL_PLAY_KIND, type PassedBallShot } from '@/entities/fielding/model/passedBall'
import { withCarriedSlack } from '@/entities/fielding/model/fielderPose'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { stealTargetBaseOf, type StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import { forecastCatch } from '@/features/defense-play/model/catchForecast'
import { PITCHER_BALL_POINT, runCoverTick, runnerPlayBallInput } from '@/features/defense-play/model/coverTick'
import type { DefensePlayControls, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import {
  RUNNER_PLAY_RESULT,
  runRunnerPlay,
  type RunnerPlayEngineInput,
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
 *   +5(기기 예외 바이트)가 서 있으면 곧장 17, 아니면 +0x14(물린 소리 버퍼)가 0 일 때만 17 이다. +5 는 PHONEMODEL 조회가 되면
 *   초기화 0x6e852 가 늘 1 로 쓰므로 실기에서는 늘 17 이다 — 웹도 17 (`judgeCall.SAFE_CALL_SOUND` 주석, 2026-10-16 직접 뜸).
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
 * ## 공 궤적 · 그 밖의 자리
 * - **공 궤적**은 타구와 같은 쏘기 길이다(r305 다시 뜸): 0x3507c 가 +0xfcc · +0xfce · +0xfd0 에 각 · 세기 · 수직(−100)을 적고
 *   메시지 0x11 의 인자로 +0xfcc 를 넘긴다(350b0~350b8). 받는 쪽 0x50faa 는 덱 갈래([sp+0xa0] · [sp+0x9c])가 서지 않으면
 *   그 칸을 그대로 쓴다 — 공은 늘 0xbef58(공, 0xcfb70 = (20000, 1000, 30000))에 놓이고(51040~51058) 51172~51188 이
 *   vt44(+2 세기, +4 수직, +0 각)로 쏜다. 물리 · 충돌은 `ballPhysics`(원본을 직접 뜬 것)가 그대로 돈다. 각은 0x3507c 가
 *   부호 없이 넣고(+60…+130), 타격 덱은 그 칸에 −a 를 넣으므로 웹 패턴 각으로는 −각 이다(S8 5-4: 홈플레이트 뒤쪽).
 * - **포수 +0xb8 = 6(놓침 동작)** 은 포구 예보·이동에 효과가 없다 — `.text` 를 훑어(`adds rX, #0xb8` · `adds #0x80 + [#0x38]` ·
 *   `movs #0xb8` 레지스터 오프셋) 야수 +0xb8 을 만지는 곳은 쓰기 b4276(펌블) · 3e08e(폭투) · 줄이기 a12da(야수 틱) · 읽기
 *   4381a(그리기 — 29 · 실책 · "!") 넷뿐이다(나머지 `+0xb8` 은 vtable 칸 호출 · 주자 객체 베끼기 af786). 동작 잠금 칸은 +0xb4 라 따로다.
 * - **커버**: 0xb1c90 은 판 시작(b2884)과 vt4c 끝(b4c72)에서 매 틱 다시 고른다(`coverTick.runCoverTick` — r162). 공 첫 점이
 *   웹 폭투 공의 시작점(표준 배팅 지점 = 0xd8758)이라 2루는 b1e12 규칙 — 공 각(+60…+130) + 90 > 0 이라 유격수, 2루수가 2루 위면 맞바꿈.
 *   0xb1b88 의 타자주자 갈래(0xb1bde~0xb1c08, P+0x168 비교)는 P+0x168 을 쓰는 곳이 바이너리에 없어 안 선다(`batterRunnerNeedsCover`).
 * - 낫아웃 타자주자는 0xa93ac 가 세우는 대로 처음부터 1루로 뛴다 — a93f8~a9400 `주자.vt48(1)`(= 0xa07b0 → +0x80 · +0x7c ·
 *   +0x84 = 1)로 목표 루 1, a940a `+0x88 = 1`(요구 루) · a940c `+0x94 = 1` · a940e `+0x98 = 1`(타자주자). 판 시작 목표 0xa9e44 는
 *   목록 1 번부터 돌아(a9e5c `movs r1, #1`) 타자주자(0 번)를 건드리지 않는다.
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
  /**
   * 이번 투구에 출발한 도루 주자들의 루 — state[0x14 + 루] (`0xa9bd4`, 종류 마스크 0xae794 = {1, 4, 5, 9}). 출발한 주자는 목표가
   * 이미 다음 루이고, 판 시작 리드(0x3d7b8)가 `0xcffa8`[루] + rand(0,9)(2 이하 → 3) 틱 몰아 돌린다. 안 주면 아무도 출발 안 했다
   */
  readonly stealingFrom?: readonly StealBase[]
  /** 장면 +0xfdc — 이번 투구의 번트 종류(0 = 없음). 서 있으면 도루 안 한 주자 리드가 +3 틱(`0x3d7b8` 3d8e0). 기본 0 */
  readonly buntKind?: number
  readonly defenseAbilities?: readonly (number | null)[]
  /**
   * **수비 팀 보너스** (판 시작 0xb0fb4 b10d0 — `defenseTeamBonusOf`): 모드 1·2·8·9 에서 수비 팀 '집중' 등급.
   * 아홉 칸(칸 0 포함) 송구 속도에 더한다. 안 주면 0(모드 3~7 과 같다)
   */
  readonly defenseTeamBonus?: number
  /** 주자 주루 능력치 — 루별(0 = 낫아웃 타자주자) */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
  /** 주면 펌블(0xb41d0) · 악송구(0xa1828) · 특수 송구(0xafa60) 굴림이 돈다 */
  readonly random?: RandomPort
  /** 수비 9명의 스킬 번호 (칸 순서) — 레이저 굴림 0x66a8c 의 초감각(21) (`DefensePlayInput.fielderSkillIds`) */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  readonly defenseIsCpu?: boolean
  readonly throwMode?: ManualAutoMode
  readonly manualThrowBase?: number
  readonly offenseIsCpu?: boolean
  readonly runningMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `DefensePlayInput.fielderPlates`) */
  readonly fielderPlates?: readonly (HolderPlate | null | undefined)[]
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (`DefensePlayInput.runnerAces`) */
  readonly runnerAces?: RunnerAces
  readonly defenseTeamIndex?: number
  /** 야수 +0xec — 칸별 선수 레코드(판 시작 뒤 값, `entities/fielding/model/fielderRecords`). 그림이 야수마다 싣는다. 안 주면 싣지 않는다 */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  readonly offenseTeamIndex?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) */
  /**
   * 경기 +0xfd4 — 이 판이 열릴 때 남아 있던 스윙 판정 결과 코드(`sceneResultCode`). 튐 파티클(0x37022 ∉ {9,10,11}) ·
   * 홈런성(0x357e0, 24~26)이 본다. 모르면(헛스윙의 정해지지 않은 값 · 안 줌) null — 두 조건 모두 거르지 않는다
   */
  readonly sceneResultCode?: number | null
  readonly scene?: DefenseScene
  /** 사람 조작 — 틱마다 눌린 키 (`RunnerPlayEngineInput.controls`) */
  readonly controls?: DefensePlayControls
}

export interface PassedBallPlayResult extends RunnerPlayEngineResult {
  readonly shot: PassedBallShot
  readonly batterRuns: boolean
}

const DEFAULT_ABILITY = 500
const CATCHER_SLOT = 1

/** 0x3507c 의 쏘기 값 → 공 궤적 (머리말 — 메시지 0x11 의 덱 없는 갈래 51172). 시작점은 타구와 같은 0xcfb70 */
export function passedBallTrajectoryOf(shot: PassedBallShot): BattedBallTrajectory {
  return battedBallTrajectory([-shot.angle, shot.strength, shot.verticalSpeed, 0], { origin: BATTING_POINT })
}

/**
 * **판 시작 목표 · 리드** — 상태 0x17 진입 0x46418 (직접 뜬 것):
 * ```
 * 464a8  state[0x11](맞은 공) || 종류 ∈ {2, 3} || 0xb6c3c(state[0x1a] 낫아웃) 가 아니면 4657e 로 — 종류 9 는 낫아웃일 때만 아래 둘
 * 4650e    0xa93ac 타자주자(목표 1 — vt48(1))
 * 4653e    주자관리.vt1c = 0xa9e44(vt94, +0x111, state[6]): 목록 1 번부터 — 도루 아니면 vt88(제 루), 포스(0..i 산 주자 수 > 루)
 *          || 아웃 == 2 || 도루면 앞 주자 +0x7c ≥ 루 → 목표 = 루 + 1 (종류 1 의 2아웃 갈래 a9efa 는 종류 9 에 없다).
 *          1루 예외(a9ed6)는 1루 주자 · 아웃 != 2 라 낫아웃(1루 빔 || 2아웃)과 안 겹친다
 * 4657e  주자 목록 차례로 0x3d7b8 리드 — 도루 주자 0xcffa8[루] + rand(0,9) 틱 · 목표 그대로, 그 밖 0xcffb0[루](+ 번트 3) 틱 뒤 되돌리기
 * 465ca  사슬 끊긴 도루 주자 되돌리기는 종류 2·3 만 — 종류 9 엔 없다
 * ```
 * 낫아웃이 아니면 0xa9e44 가 안 돌아 도루 안 한 주자의 목표는 제 루, 도루 주자는 0xa9bd4 가 세운 다음 루 그대로다.
 * 굴림은 도루 주자마다 rand(0,9) 한 번(목록 차례) — 0x3507c 의 두 굴림 뒤 · 판 틱 굴림 앞.
 */
function leadRunnersForPassedBall(runners: RunnerState[], input: PassedBallPlayInput, batterRuns: boolean): void {
  const stealing = input.stealingFrom ?? []
  let previousTarget = Number.NEGATIVE_INFINITY
  for (let index = 0; index < runners.length; index += 1) {
    const runner = runners[index]
    if (runner.isBatterRunner) {
      previousTarget = runner.targetBase
      continue
    }
    const base = runner.startBase
    const isStealing = stealing.includes(base as StealBase)
    let target = isStealing ? stealTargetBaseOf(base) : base
    if (batterRuns) {
      const forced = index + 1 > base
      if ((forced || input.outs === 2 || isStealing) && previousTarget >= base) target = base + 1
    }
    previousTarget = target
    runners[index] = { ...runner, targetBase: target }
  }
  for (let index = 0; index < runners.length; index += 1) {
    const runner = runners[index]
    const lead = runnerLeadOf(runner, {
      playKind: PASSED_BALL_PLAY_KIND,
      stealing: !runner.isBatterRunner && stealing.includes(runner.startBase as StealBase),
      buntKind: input.buntKind,
      random: input.random,
    })
    runners[index] = applyRunnerLead(runner, lead)
  }
}

/** 판 하나를 끝까지 돌린다 — 시작 → 진행기 → 정리 */
export function runPassedBallPlay(input: PassedBallPlayInput): PassedBallPlayResult {
  return passedBallPlayResultOf(input, runRunnerPlay(passedBallPlayEngineInputOf(input)))
}

/** 판 시작 — 예보 · 커버까지 세운 진행기 입력 (실시간이면 `startRunnerPlay` 에, 끝나면 `passedBallPlayResultOf`) */
export function passedBallPlayEngineInputOf(input: PassedBallPlayInput): RunnerPlayEngineInput {
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
  // 판 시작 vt30(b2884)이 보는 주자 — vt18(0xb284a)은 0x46418 의 타자주자 0xa93ac(4650e) · 목표 0xa9e44 · 리드 0x3d7b8 보다
  // 앞이라 루에 선 주자들뿐이다(도루 주자의 목표는 투구 중 0xa9bd4 가 세운 다음 루)
  const stealingFrom = input.stealingFrom ?? []
  const coverRunners = runners
    .filter((runner) => !runner.isBatterRunner)
    .map((runner) =>
      stealingFrom.includes(runner.startBase as StealBase)
        ? { ...runner, targetBase: stealTargetBaseOf(runner.startBase) }
        : runner,
    )
  leadRunnersForPassedBall(runners, input, batterRuns)

  // ── 0xb284a: 예보(vt24, 추적야수 = 포수라 t ≤ 4 동안 포수를 건너뜀) → 고르기(vt34) ──
  // b2856 vt20(0) — b1144 가 +0xcc 쓰기(b1156)를 건너뛰어 앞 판이 남긴 값을 들고 연다(`DefenseScene.fielderSlack`, r196).
  // 예보 복제(0xb12d0)도 그 +0xcc 를 베낀다 — 막힌 복제는 판정 없이 복제 틱만 돈다(`forecastCatch`)
  const startFielders = withCarriedSlack(createFielders(abilities, input.defenseTeamBonus ?? 0), input.scene?.fielderSlack)
  const forecast = forecastCatch(trajectory, startFielders, { from: 0, to: Number.POSITIVE_INFINITY }, {
    initialChaserSlot: CATCHER_SLOT,
  })
  const chaserSlot = forecast.choice.slot
  const catchTick = Math.max(0, forecast.choice.catchTick)

  // ── b2884 vt30 = 0xb1c90 — 판 시작 커버 · 키스톤 자리 (`coverTick.runCoverTick`, 그 뒤로는 진행기가 vt4c 끝에서 매 틱) ──
  // 고르기 vt34(b2878)가 쫓는 야수를 AI 1 로 둔다(b3e54 — 목표는 안 바꾼다). 공 첫 점 · 각은 메시지 0x11 이 쏜 폭투 공이다
  // b3f5c — 외야 추적야수면 가장 가까운 외야수 AI 0xc(백업, `CatchForecast.backupSlot`, r180)
  const chased = startFielders.map((fielder) =>
    fielder.slot === chaserSlot
      ? { ...fielder, aiState: AI_STATE.CHASE }
      : fielder.slot === forecast.backupSlot
        ? { ...fielder, aiState: AI_STATE.BACKUP }
        : fielder,
  )
  const startPlay: PlayView = {
    ...initialPlayView(PASSED_BALL_PLAY_KIND),
    ballHolderSlot: chaserSlot,
    catchFielderSlot: chaserSlot,
    catchKind: forecast.choice.kind,
    catchTick,
    actionStartTick: forecast.choice.actionStartTick,
    // 0xb28b6: P+0x112 = 1
    everHeld: true,
  }
  const started = runCoverTick({
    context: { play: startPlay, fielders: chased, runners: coverRunners, currentTick: 0, landingTick: trajectory.landingTick },
    ...runnerPlayBallInput({ trajectory, startTick: 0 }, PITCHER_BALL_POINT, 0),
    relayFlag: true,
  })
  const fielders = started.fielders
  const play = started.play

  return {
    kind: PASSED_BALL_PLAY_KIND,
    fielders,
    play,
    relayFlag: started.relayFlag,
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: false,
    chase: { trajectory, slot: chaserSlot, catchTick, diveTicks: forecast.diveTicks, forecastCatchTick: forecast.choice.catchTick },
    random: input.random,
    fielderSkillIds: input.fielderSkillIds,
    defenseIsCpu: input.defenseIsCpu,
    throwMode: input.throwMode,
    manualThrowBase: input.manualThrowBase,
    offenseIsCpu: input.offenseIsCpu,
    runningMode: input.runningMode,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    fielderRecords: input.fielderRecords,
    offenseTeamIndex: input.offenseTeamIndex,
    fielderPlates: input.fielderPlates,
    runnerAceIndexes: runnerAceIndexesOf(input.runnerAces, input.bases),
    runnerAceSprite: loadedRunnerAceOf(input.runnerAces, input.bases),
    // 0x3e062(0x3e08c~0x3e092) — 판정이 포수 +0xb8 = 6 을 적고 0x17 로 간다(첫 그림 앞 야수 틱이 5 로 줄인다)
    fumbleMarks: Array.from({ length: abilities.length }, (_, slot) => (slot === CATCHER_SLOT ? FUMBLE_MARK_TICKS : 0)),
    scene: input.scene,
    sceneResultCode: input.sceneResultCode,
    controls: input.controls,
  }
}

/** 판 끝 정리 */
export function passedBallPlayResultOf(input: PassedBallPlayInput, result: RunnerPlayEngineResult): PassedBallPlayResult {
  return { ...result, shot: input.shot, batterRuns: input.batterRuns === true }
}

/**
 * 폭투·포일 판의 콜 — 결과 9 → 17 · 13 → 62/20 · 없음 → 없음. 종류 9 의 9 는 0x51c14 가 소리 객체 +5(기기 예외 바이트 — 실기에서 늘 1)
 * · +0x14(물린 소리 버퍼)를 보지만 +5 가 서 있어 늘 17 이다(`judgeCall.SAFE_CALL_SOUND` 주석).
 *
 * **함성 29 는 없다 (확정).** 판정 0x3dfac 의 폭투·포일 갈래(0x3e08c~0x3e092)가 포수 +0xb8 = 6 을 적고 0x17 을 예약하지만,
 * 29 를 내는 곳은 0x17 그리기 0x46c88 → 야수 그리기 0x43278 의 0x4381a(+0xb8 == 6 이면 예약 29)뿐이고, 한 그림의 차례가
 * G1 0x3f060(목록 틱 — 야수 틱 0xa1284 의 a12da 가 잠금이 없으면 +0xb8 −1) → 슬롯 2 → G3 그리기라 0x17 첫 그림에서 포수는
 * 이미 5 다. 0x17 진입 0x46418 은 +0xb8 을 다시 안 적는다(`adds #0xb8` 꼴로 6 을 적는 곳은 바이너리 전체에서 이 판정 하나 — 그 밖은 펌블 b4280).
 * 29 가 실제로 나는 것은 플레이 틱(슬롯 2)에서 서는 **펌블** 쪽이다 — `DefensePlayback` 의 `FUMBLE_CHEER_SOUND`.
 */
export function passedBallCallSoundIdOf(result: Pick<PassedBallPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === RUNNER_PLAY_RESULT.SAFE) return 17
  if (result.resultCode === RUNNER_PLAY_RESULT.OUT) return result.tagOut ? 62 : 20
  return null
}

/** 재생 칸에 든 결과가 폭투·포일 판인가 */
export function isPassedBallPlayResult(result: DefensePlayResult | null): result is PassedBallPlayResult {
  return result !== null && 'shot' in result && 'resultCode' in result
}

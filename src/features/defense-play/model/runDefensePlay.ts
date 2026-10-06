import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
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
  autoSlideRunnerIndexes,
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
  BOUNCE_THROW_DISTANCE,
  NO_THROW_ERROR,
  rollFumble,
  rollSpecialDefense,
  rollThrowError,
  type ThrowErrorResult,
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
  tagsRunner,
  NO_RUNDOWN,
  type RundownPlan,
} from '@/entities/fielding/model/rundown'
import {
  AI_STATE,
  createFielders,
  createRunner,
  fielderArrivalTicks,
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
import {
  judgeOut,
  OUT_KIND,
  releaseForcesAfterOut,
} from '@/entities/fielding/model/outJudgement'
import {
  defenseArrivalTicks,
  secondBaseCoverSlot,
  secondBaseHelperPlacement,
} from '@/entities/fielding/model/throwArrival'
import {
  planThrow,
  errantThrowFlight,
  LASER_THROW_SPEED,
  readyTicksOf,
  thrownWith,
  throwTicksTo,
  throwTicksToFielder,
} from '@/entities/fielding/model/throwPlan'
import { chooseThrowTargetBase, isSpecialThrow } from '@/entities/fielding/model/throwTargetBase'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { stealTargetBaseOf } from '@/entities/fielding/model/stealStart'
import { EMPTY_BASES, type AdvanceResult, type BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import { forecastCatch } from '@/features/defense-play/model/catchForecast'
import { runnerFateOf, type RunnerFate } from '@/features/defense-play/model/runnerFates'
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
   * 이번 투구에 출발한 도루 주자들의 루 — state[0x14 + 루] (`0xa9bd4`). 판이 열릴 때 `0x3d7b8` 이 이 주자들은
   * 다음 루를 목표로 `0xcffa8`[루] + rand(0,9)(2 이하 → 3) 틱, 나머지는 `0xcffb0`[루] 틱 몰아 돌린다.
   * 안 주면 아무도 출발 안 했다.
   */
  readonly stealingFrom?: readonly number[]
  /**
   * 장면 +0xfdc — 이번 투구의 번트 종류(0 = 없음). 서 있으면 도루 안 한 주자 리드가 +3 틱(`0x3d7b8`).
   * ⚠️ 부르는 쪽이 아직 안 싣는다(번트 종류가 타구 결과까지 안 넘어온다) — 안 주면 0.
   */
  readonly buntKind?: number
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
  /**
   * **2스트라이크 번트 파울 아웃**(원본 판정 11)로 들어온 플레이인가 — 진행기는 이 칸을 보지 않는다.
   *
   * 원본은 판정 11 을 **수비 시뮬레이션 없이** 그 자리에서 내고 아웃 콜도 조건 없이 62 다
   * (`0x51b20` → `0x51b2e movs r1,#0x3e`). 웹은 그 아웃을 `직선타아웃` 으로 옮겨 두어
   * 수비 화면을 한 번 거치므로, 플레이가 끝나는 자리에서 콜을 고를 때
   * (`play-at-bat/model/atBatSounds.inPlayCallSoundIdOf`) 이 표가 있어야 20 으로 새지 않는다.
   */
  readonly buntFoulOut?: boolean
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
  /**
   * **공격을 CPU 가 맡았는가** — 자동 주루 제어기를 켜는 조건의 한쪽이다.
   * 원본 `0xae690(x, 설정+0xbd)` 의 앞 항: `경기[0x31 + 경기[9](공격측)] == 1` (확정, 아래 참고).
   *
   * 안 주면 `false`(사람 공격)로 둔다 — 그러면 `runningMode` 혼자가 답을 정한다.
   */
  readonly offenseIsCpu?: boolean
  /**
   * **주루 수동/자동** (환경설정 옵션 +0xbd, 기본 자동). 안 주면 자동이다.
   *
   * 원본 배선(직접 뜬 것, 매 틱 도는 경기 장면 슬롯 2 = `0x524c0` 안):
   * ```
   * 5261c: 설정 = 0x1f1d8([0x1400054])
   * 52628: r1 = 설정+0xbd                         ; 주루 수동(0)/자동(1)
   * 5262e: bl 0xae690([장면+0x214], r1)
   *        ae692~ae6be: r2 = [x+0x174](= 경기) ; 공격측 = 경기[9]
   *                     반환 = (경기[0x31 + 공격측] == 1)  ||  (설정+0xbd != 0)
   * 52638: 그 값이 0 이면 → 플레이+0x111(끝남)·+0x129 를 보고, 종류 7(홈런더비)이면 그래도 돈다
   * 52660: 0xaf8c0(제어기 = 장면+0x210, 0)        ; = 제어기.vt8 = 0xaf918 자동 추가 진루
   * ```
   * 곧 **"공격이 CPU 거나 설정이 자동이면 자동 진루 제어기를 돌리고, 사람이 공격하면서 설정이
   * 수동이면 아예 안 돌린다"**. 예외 셋(플레이 끝남 +0x111 · +0x129 · 종류 7)은 수동이어도 돈다.
   *
   * ⚠️ `경기+0x24` 는 이 갈림과 **아무 상관이 없다** — 아래 `autoBaserunning` 주석 참고.
   */
  readonly runningMode?: ManualAutoMode
  /**
   * **송구 수동/자동** (환경설정 옵션 +0xf4, **원본 기본 0 = 수동**). 안 주면 수동이다.
   *
   * 원본 배선은 바로 위 주루 갈림(`0xae690`)과 **판박이**다. 같은 경기 장면 슬롯 2
   * (`0x524c0`, 매 틱) 안에서 주루 갈림 스물여섯 바이트 뒤에 붙어 있다 (직접 뜬 것):
   * ```
   * 52690: 설정 = 0x1f1d8([0x1400054])
   * 5269c: r3 = 설정+0xf4 ; r1 = [r3]              ; 송구 수동(0)/자동(1)
   * 526a4: bl 0xae6c8([장면+0x214], r1)
   *        ae6ca~ae6f6: r2 = [x+0x174](= 경기) ; 수비측 = 경기[0xa](부호 있는 바이트)
   *                     반환 = (경기[0x31 + 수비측] == 1)  ||  (설정+0xf4 != 0)
   * 526ac: 그 값이 0 이면 건너뛴다                  ; ★ 주루와 달리 예외가 하나도 없다
   * 526ae: 0xaf8e0(제어기 = 장면+0x210)             ; = 제어기.vt0xc = 0xafa60 CPU 송구 결정
   * ```
   * `0xae6c8` 은 `0xae690` 과 **오프셋 한 글자만 다른 쌍둥이**다 — `경기[9]`(공격측) 자리가
   * `경기[0xa]`(수비측)이고 나머지는 한 명령도 다르지 않다.
   *
   * 곧 **"수비가 CPU 거나 설정이 자동이면 CPU 송구 결정을 돌리고, 사람이 수비하면서 설정이
   * 수동이면 아예 안 돌린다"**.
   *
   * 그러면 사람 수비는 무엇으로 던지나 — **사람이 키를 누를 때만 던진다** (2026-10-06 확정, 직접 뜬 것).
   * 공을 내보내는 호출(플레이.vt58 = 0xb2c90 · vt5c = 0xb2e38)을 전부 따라가면:
   * - `0xafa60`(CPU 송구 결정): 위 슬롯 2 갈림 · 도루 시작 메시지 0x583(0x52222) · 결과 메시지 0xbba(0x51dae, 아래)
   * - 플레이 틱 vt4c `0xb45dc`: b4616 중계 이어 던지기(앞선 송구가 세운 +0x14c 계획) ·
   *   **b4660~b46a8 사람 목표 +0x160**(메시지 0x588 → vt0x60 `0xb3118`) · AI 상태 9(0xb2e38 이 미룬 송구) ·
   *   AI 상태 0xe(견제) — 모두 앞선 송구나 견제에서만 선다
   * - 협살 `0xb3a94`: CPU 수비 전용 (0xb4358)
   * - `0xb1c90`(플레이 vt0x30, 매 틱): **송구 호출이 없다**. 자동 가지(+0x160 = −1)가 고른 루는 0xb203a 뒤
   *   2루 커버/중계 야수 자리 잡기에만 쓰인다(c8649a3).
   * 곧 **사람 수비 + 수동 송구에서 키를 안 누르면 공 쥔 야수는 공을 들고 서 있다**. 예외는 결과 메시지
   * 0xbba 하나다 — 결과 코드 9·13(아웃)이 나면 0x51d40~0x51db4 가 수비 조작이 사람(0x33fe4)이든 CPU(0x3403c)든
   * `아웃 ≤ 2` 일 때 플레이+0x128 = 1 로 세우고 `0xafa60` 을 **한 번** 부른다(이 파일 6c 절).
   *
   * ⚠️ 예전 해독(S8 4-3 · I-controls 2b)의 "메시지 처리기 `0x509a0` 앞머리가 메시지마다 0xafa60 을 부른다" 는
   * **틀렸다**. 앞머리가 부르는 것은 `[장면+0x214]`(경기 로직, 생성 0xae1d8 · vtable **0xd84cc**)의 vt0xc =
   * **`0xae5f8` = `sub sp ; movs r0,#0 ; add sp ; bx lr` 빈 함수**다. 0xafa60 은 `[장면+0x210]`(제어기,
   * 생성 0xaf20c · vtable 0xd8554, 0x3ea84 가 +0x210 에 넣는다)의 vt0xc 이고 둘은 다른 객체다.
   * (메시지 받는 곳 = 장면+0x70, vt0xc 썽크 0x53138 이 this −= 0x70 뒤 0x509a0 으로 간다.)
   *
   * 배선: 사람이 수비하는 자리(`pitcherGameFlow` · `teamGameFlow` 수비 타석 · 투수편 미션)가
   * 이 칸을 넘기면 된다. 안 넘기면 원본 기본값(수동)이다.
   */
  readonly throwMode?: ManualAutoMode
  /** 사람 조작 (I-controls 0절 상태 0x17 표). 안 주면 전부 자동이다 */
  readonly controls?: DefensePlayControls

  // ── 아래 셋은 **그림에만 쓰인다** — 진행(아웃·진루·난수)에는 한 톨도 안 닿는다 ──

  /**
   * 수비 칸별 **마선수 번호 0~4** (마선수가 아닌 칸은 null·undefined). 안 주면 아홉 칸 모두
   * 보통 수비수 그림(`defender.pzx`)이다.
   *
   * 번호는 `0xb63a0(선수)` = 마선수(레코드 `+0xa` 비트6)면 `+0xa & 0x1f`, 아니면 −1 이다.
   * 타자 마선수 다섯의 그림 이름은 표 `0xd3f10`(20바이트 간격, C-16 · R3 7-1)에서 고른다:
   * 0 메디카 · 1 어거지죠 · 2 로제 · 3 크라이져 · 4 킹타이거.
   *
   * ⚠️ **원본 그대로**: 원본은 타자 마선수 그림을 **팀당 첫 한 명만** 적재해 놓고 그리는 쪽
   * (`0x79b48` 의 b 갈래)은 "그 칸 선수가 마선수인가" 만 보므로, 한 팀에 타자 마선수가 둘 이상이면
   * 둘째부터도 첫째의 그림으로 나온다(R3 7-3). 그 버그를 되살리려면 **부르는 쪽이** 마선수인 칸에
   * 전부 같은(첫째의) 번호를 넣어 주면 된다 — 여기서 고쳐 주지 않는다.
   * (`defensePlayView.aceIndexesWithOriginalBug` 가 그 일을 한 번에 해 준다.)
   *
   * 칸 0(투수)은 표가 다르다 — 투수 마선수 그림 `0xd4008`(38장)은 `+17` 을 안 쓴다.
   * 그 갈림은 `pages/defense/lib/defenseView.fielderSpriteOf` 가 칸 0 인지로 이미 처리한다(S12 8-2).
   */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 `defender.mpl` (C-1, 15색) */
  readonly defenseTeamIndex?: number
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number
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
  /**
   * **아웃 판정(0xb36d0)이 마지막으로 적은 아웃이 태그였나** — 원본 `state[0x87]`.
   *
   * 아웃 콜을 62("잡아서·태그해서 낸 아웃")로 낼지 20(루에서 잡은 포스 아웃)으로 낼지를
   * 가르는 칸이다 (`play-at-bat/model/atBatSounds.ts` 의 `inPlayCallSoundIdOf`).
   *
   * **"한 번이라도" 가 아니라 "마지막 판정" 이다** — 근거는 `runOutJudgement` 주석에 적었다.
   * 쓰는 자리는 원본 판정을 옮긴 두 곳뿐이다: `runOutJudgement` 와 협살 태그.
   * 타자주자의 "선언된 운명"(`batterOutTick`)은 원본 판정이 아니라 이 진행기의 규약이라
   * 이 칸을 건드리지 않는다 — **근사**다.
   */
  readonly tagOut: boolean
  /** **첫** 송구의 목표 루(사람 키든 CPU 결정이든). −1 이면 안 던졌다 */
  readonly throwBase: number
  /** 첫 송구의 도착 틱. 송구가 없으면 −1 */
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
  /**
   * **주자 목록의 운명** — 원본 목록 순서 그대로(`[타자주자?, 1루?, 2루?, 3루?]`, `runnerFates.ts` 머리말).
   * 정산 `0xa8024` 가 읽는 +0x95(득점)·+0x96(처리 끝)을 옮긴 것이라 R+0x128(실점)·R+0x130(출루 허용)을
   * 원본대로 셀 수 있다 (`chargedRunsOfFates` · `baserunnerAllowedOfFates`).
   * 점수판 득점(`advance.runsScored`)과 달리 **3아웃으로 날아간 보류 득점의 주자도 `scored` 다**.
   */
  readonly runnerFates: readonly RunnerFate[]
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
  /** 최소 진루 루 — 타자주자는 결과 코드가, 앞 주자들은 포스 사슬이 정한다 (`createPlayRunners`) */
  minimumBase: number
  /** 이미 득점 처리를 했는가 */
  counted: boolean
}

/**
 * 주자들을 세우면서 **포스 사슬**을 잇는다 — 이 진행기의 포스는 `0xaf918`(자동 진루 제어기)이 아니다.
 *
 * 원본에는 "이 타구는 2루타" 같은 결과 코드가 없다. 타자주자가 2루까지 가면 그게 2루타다.
 * 그래서 원본의 포스 사슬 머리는 **언제나 "타자주자가 1루로 간다"** 한 칸이고,
 * 그 뒤는 루가 이어 차 있는 만큼만 밀린다. 그리고 원본은 **한 루에 산 주자를 둘 놓지 않는다** —
 * "루 b 의 주자" `0xa97a0` 이 `+0x8c`(목표 루) == b 인 주자를 **하나만** 집어 오고,
 * 주루 키의 앞길·뒷길 검사(`0xa99a8` · `0xa9924`, 0xa9b04 에서 부른다)가 겹치는 루로는 못 보낸다 (I 3b).
 *
 * 웹판은 타자주자의 운명을 **타석 결과 코드가 먼저 정한다**(이 파일 머리말). 그러면 사슬 머리가
 * 1루가 아니라 **결과 코드가 준 최소 루 M** 이 된다: 타자주자가 반드시 M 에 선다면 그 앞 주자는
 * M+1, 그 앞은 M+2 … 에 서 있어야 원본이 절대 만들지 않는 "한 루에 둘" 이 안 생긴다.
 *
 * 그래서 **최소 진루 루 = min(홈, max(출발 루, M + 목록 번호))** 로 잇는다. 목록은 타자주자(0)부터
 * 앞선 주자 쪽으로 빈 루를 건너뛰며 쌓이므로, 번호 k 는 "타자주자 앞으로 k 번째 주자" 다.
 *
 * ⚠️ **M = 1 일 때는 예전 `forcedFlagsOf` 와 한 톨도 다르지 않다.** 목록은 오름차순이라
 * `출발루[k] ≥ k` 이고, 밀리는 조건 `1 + k > 출발루[k]` 는 `출발루[k] == k`, 곧
 * "1루부터 내 앞까지 빈 루 없이 차 있다" 와 같은 말이다 — 땅볼·뜬공·단타는 그대로다.
 *
 * ⚠️ **근사**: M 이 2 이상인 타구(2·3루타)에서 사슬을 잇는 것은 웹판이 결과 코드를 먼저 정하기
 *    때문에 필요한 **다리**다. 원본에는 대응하는 코드가 없다(원본은 애초에 M 을 미리 정하지 않는다).
 *
 * 포스로 밀리는(최소 루가 출발 루보다 큰) 주자만 첫 틱부터 뛴다.
 * 나머지는 루에 붙어 있다가 자동 진루(0xaf918)가 보내 준다 — 그쪽은 **주루 수동이면 안 돈다**.
 */
function createPlayRunners(
  bases: BaseState,
  outcome: AtBatOutcome,
  speed: number,
  firstBaseException: FirstBaseException | null = null,
): MutableRunner[] {
  const batterMinimum = batterMinimumBaseOf(outcome)
  // 0 = 타자주자. 그 뒤는 **뒤 주자 → 앞선 주자** 순서다 (자동 진루가 목록 끝부터 = 앞선 주자부터 본다)
  const fromBases = [0]
  if (bases.first) fromBases.push(1)
  if (bases.second) fromBases.push(2)
  if (bases.third) fromBases.push(3)
  const pushed = firstBaseException === null ? null : pushedRunnersWithFirstBaseException(fromBases, firstBaseException)
  return fromBases.map((fromBase, index) => {
    // 홈보다 더 갈 곳은 없다 — 사슬이 만루 + 3루타처럼 넘치면 전부 홈에서 멈춘다
    const chained = Math.min(HOME_BASE, Math.max(fromBase, batterMinimum + index))
    const minimumBase = pushed === null || index === 0 ? chained : pushed[index] ? fromBase + 1 : fromBase
    const targetBase = minimumBase > fromBase ? fromBase + 1 : fromBase
    return {
      state: createRunner(index, fromBase, speed, { targetBase, isBatterRunner: index === 0 }),
      minimumBase,
      counted: false,
    }
  })
}

/** `0xa9e44` 의 1루 주자 예외가 걸리는 판 — 2아웃 전 · 잡힐 뜬공(플레이.vt94) · 끝나지 않은 판 */
interface FirstBaseException {
  /** 0xa9bd4 가 출발 표시를 세운 주자의 루 — 그 주자의 +0x7c 는 이미 다음 루다 */
  readonly stealingFrom: readonly number[]
}

/**
 * **1루 주자 예외** — 주자관리.vt1c = `0xa9e44`(a9ed6~a9eea, 직접 뜬 것)를 타자주자 다음 주자부터 그대로 돈다.
 * ```
 * a9ec2  관리.vt10(i) = 0xa9f60(목록 0..i 산 주자 수 > +0x8c) || 아웃 == 2 || 도루 표시  가 아니면 건너뜀
 * a9ed6  +0x8c == 1 && 플레이.vt94() && !플레이+0x111 && 아웃 != 2  → 건너뜀            ; ★ 1루 주자 예외
 * a9eec  앞 주자(목록 i−1).+0x7c ≥ +0x8c  → +0x7c = +0x8c + 1 ; vt48(+0x8c + 1)          ; 밀린다
 * a9ef6  아니면 아웃 == 2 && 종류 == 1 → 같은 목표 / 아니면 건너뜀
 * ```
 * 플레이.vt94 = `0xb1b2c` 는 "가장 이른 포구 틱 +0x11c ≤ 공 낙구 틱" = 잡힐 뜬공이다(인자는 0x46516~0x4653e).
 * 곧 2아웃 전 잡힐 뜬공이면 1루 주자가 밀리지 않고, 그 앞 주자도 "앞 주자 +0x7c ≥ 내 루" 가 안 서서
 * 사슬이 끊긴다. 도루 표시가 선 1루 주자는 +0x7c 가 이미 2(0xa9bd4 → vt48)라 2루 주자는 그대로 밀린다.
 * 앞 주자의 +0x7c: 타자주자 = 1, 건너뛴 주자 = 제 루(vt88 0xa0820 이 +0x7c = +0x8c), 도루 주자 = 다음 루.
 * 이 갈래는 2아웃이 아닐 때만이라 웹의 결과 코드 다리(최소 루 M = 1, 뜬공 아웃)와 겹치는 곳은 이 함수뿐이다.
 */
function pushedRunnersWithFirstBaseException(fromBases: readonly number[], exception: FirstBaseException): boolean[] {
  const pushed = fromBases.map(() => false)
  let previousTarget = 1 // 타자주자 +0x7c
  for (let index = 1; index < fromBases.length; index += 1) {
    const base = fromBases[index]
    const stealing = exception.stealingFrom.includes(base)
    const forced = index + 1 > base // 0xa9f60: 목록 0..i 산 주자 수 > +0x8c
    let target = stealing ? base + 1 : base
    if ((forced || stealing) && base !== 1 && previousTarget >= base) {
      pushed[index] = true
      target = base + 1
    }
    previousTarget = target
  }
  return pushed
}

/**
 * 타구 판(종류 1)의 시작 위치 — `0x46418` 의 주자 고리(0x4657e~0x465aa)가 주자마다 부르는 `0x3d7b8`
 * (`entities/fielding/model/runnerLead`, 9976cb7 에서 직접 뜬 것).
 * - 도루 주자: 목표 = 다음 루(0xa9bd4 가 이미 세움) · `0xcffa8`[루](15·14·14) + rand(0,9)(2 이하 → 3) 틱 · 목표 그대로
 * - 그 밖: 다음 루로 `0xcffb0`[루](6·13·7) 틱(번트 종류가 서 있으면 +3) 간 뒤 목표를 **판 시작 때의 목표**로 되돌린다
 *   — 포스로 밀리는 주자는 다음 루, 아니면 제 루(돌아오는 중)
 * - 타자주자는 칸 0 이 0 틱이라 움직이지 않는다
 *
 * 리드 앞의 목표는 `0x4653e` 주자관리.vt1c = `0xa9e44`(직접 뜬 것)가 세운다 — 타자주자 다음 주자부터:
 * ```
 * a9e8a  도루 표시가 없으면 R.vt88() ; 0xbef1c(R,0) ; +0x98 = +0x94 = 0 ; +0x88 = +0x90 = +0x8c
 * a9ec2  관리.vt10(i)(0xa9f60 포스: 0..i 산 주자 수 > +0x8c) || 아웃 == 2 || 도루 표시 일 때만:
 * a9ed6    +0x8c == 1 && 플레이.vt94() && !플레이+0x111 && 아웃 != 2 → 건너뜀
 * a9eec    앞 주자 +0x7c ≥ +0x8c → +0x7c = +0x8c + 1 ; vt48(+0x8c + 1)        ; 밀린다
 * a9ef6    아니면 아웃 == 2 && 종류(state[0x26]) == 1 → 같은 목표              ; 2아웃이면 친 순간 뛴다
 * ```
 * 웹은 포스 사슬을 `createPlayRunners`(결과 코드 다리)가 세우므로 여기서는 **2아웃 갈래만** 더한다.
 * 1루 주자 예외(a9ed6)는 아웃 != 2 일 때만이라 2아웃 갈래와 안 겹친다 — `createPlayRunners` 가 받는다
 *    (`pushedRunnersWithFirstBaseException`). 인자 둘은 0x46516~0x4653e 가 넘긴다: 플레이.vt94 = `0xb1b2c`
 *    (+0x11c 가장 이른 포구 틱 ≤ 공+0xaa0 낙구 틱 — "뜬공이 잡힐 예정", autoAdvance 의 af98e 와 같은 함수) ·
 *    플레이+0x111(끝남, 판 시작이라 0). 웹은 잡힐 뜬공을 결과 코드(뜬공·직선타 아웃 = `onTheFly`)로 본다.
 * - 도루 표시 없는 주자의 R.vt88(+0x8c) = `0xa0820`: 루 좌표 0xd77d8[b] 에 세우고(0xbef58) +0x7c·+0x80·+0x88·+0x8c·+0x90 = b,
 *   +0x94 = 0, vt10(동작 0). 리드는 루 좌표에서 출발하므로(applyRunnerLead) 웹과 같다.
 * ⚠️ S8 6-3 의 "0x46418 의 주자 움직임은 0x46664 걷기 루프뿐" 은 이 고리를 놓친 것이다.
 */
function leadRunnersForBattedBall(runners: readonly MutableRunner[], input: DefensePlayInput): void {
  const stealing = input.stealingFrom ?? []
  const twoOuts = input.outs === 2
  for (const runner of runners) {
    const base = runner.state.startBase
    if (runner.state.isBatterRunner || base < 1 || base > 3) continue
    const isStealing = stealing.includes(base)
    // 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞.
    // 0x4653e 주자관리.vt1c(0xa9e44): 2아웃이면 종류 1 에서 모든 주자에게 다음 루(+0x7c = +0x8c + 1 · vt48)
    // — 포스(0xa9f60)·도루가 아니어도 (a9eb4 r6 = 아웃 == 2 → a9efa 종류 1 갈래)
    const started =
      isStealing || (twoOuts && runner.state.targetBase === base)
        ? { ...runner.state, targetBase: stealTargetBaseOf(base) }
        : runner.state
    const lead = runnerLeadOf(started, {
      playKind: BATTED_BALL_PLAY_KIND,
      stealing: isStealing,
      buntKind: input.buntKind,
      random: input.random,
    })
    runner.state = applyRunnerLead(started, lead)
  }
}

/** 타구 판의 플레이 종류 (0x3e11a 이후 상태 0x13 → 0x17) */
const BATTED_BALL_PLAY_KIND = 1

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
  /** 지금(마지막) 송구의 목표 루 · 도착 틱 · 던진 야수 — 송구가 없었으면 −1 */
  throwBase: number
  throwArrivalTick: number
  throwFromSlot: number
  /** 공이 손을 떠난 틱 — 포구 틱에 던졌으면 포구 틱, 키·아웃 뒤에 던졌으면 그 틱. 송구가 없으면 −1 */
  throwReleaseTick: number
  /** 지금 송구를 받을 야수 (+0x154). 악송구면 −1 — 아무도 못 받는다 */
  throwReceiverSlot: number
  /** 이 판에서 나간 송구 수 — 받은 야수가 이어 던지면 2 이상이 된다 */
  throwCount: number
  /** 첫 송구의 목표 루 · 도착 틱 — 결과(`DefensePlayResult.throwBase`)로 내보낸다 */
  firstThrowBase: number
  firstThrowArrivalTick: number
  batterOutTick: number
  /** 포구 틱 — 펌블이 나면 15틱 뒤로 밀린다 */
  catchTick: number
  fumbled: boolean
  errantThrow: boolean
  /**
   * **경기+0x24** (전역 경기 구조체 `[0x1552d0c]` 의 바이트 한 칸) — "주자가 뛰는 중" 표시다.
   *
   * ⚠️ **자동 주루 스위치가 아니다.** `.text` 를 전부 훑어(오프셋 0x24 바이트 접근 24곳) 확인한
   * 쓰는 곳·읽는 곳 전부:
   *   - 쓰기 `0x3d960`(상태 0xf 진입 = 매 투구 시작) = 0, 같이 경기[0x14+i]·경기[0x90+i] 도 0
   *   - 쓰기 `0x4648a`(상태 0x17 진입 0x46418) = 설정+0xbd
   *   - 쓰기 `0x520b6`(진루 키 0x582) = 0 · `0x52240`(귀루 키 0x584) = 0 · `0x521dc`(도루) = 0
   *   - 쓰기 `0xa9b86`·`0xa9ba8`(0xa9b04 가 주자를 실제로 움직인 순간) = **1** · `0xa9c40`(0xa9bd4) = 1
   *   - **읽기는 딱 둘** — `0x3e0e6` 과 `0x521fa`. 그게 전부다.
   * `0x3e0e6` 은 상태 0x12 진입(공 도착·스윙 판정) 안이고, 하는 일은
   * "경기+0x24 ≠ 0 이고 (아웃 ≤ 1 또는 판정 ≠ 5) 이면 **플레이 종류 5(주자 움직임만) + 상태 0x17**",
   * 곧 **투구가 끝난 뒤 수비 화면을 열지 말지**를 가른다(S8 5-3 의 state[0x24] "도루 중"과 같은 칸).
   * `0x521fa` 는 도루 메시지 처리에서 경기[0x14+루]·경기[0x90+루] 를 세울지 가른다.
   * → **자동 진루 0xaf918 을 막는 곳은 한 군데도 없다.** 그 갈림은 `input.runningMode` 주석의
   *   `0xae690` 이다. 여기서는 원본이 세우고 지우는 칸을 그대로 들고만 있는다(읽는 쪽이 아직 없다 —
   *   웹판에는 "종류 5 로 수비 화면 열기" 가 없다).
   */
  autoBaserunning: boolean
  /** 주자관리+0x31c — 이번 플레이에서 이미 슬라이딩 효과음을 냈다 */
  slidingSoundPlayed: boolean
  /**
   * **방금 돈 틱에서 슬라이딩 효과음 10 을 낸다.** 진행기는 순수 함수라 소리를 못 내므로
   * 틱을 실제로 돌리는 수비 재생(`DefensePlayback`)이 이 칸을 보고 그 틱에 낸다.
   * 사람 키 0x5199c(+0x31c 잠금으로 한 플레이 한 번) · 자동 0x5268c(잠금 없음, 슬라이딩시킨 수 > 0) 둘 다 여기로 온다.
   */
  slidingSoundThisTick: boolean
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
  /** 원본 `state[0x87]` — 마지막 아웃 판정이 태그였나 (`runOutJudgement` 주석) */
  tagOut: boolean
  /** 플레이+0x126 — 판 시작 vt20(b11fe)이 1, 키스톤 야수가 중계 자리를 잡으면(b22f6) 0 */
  relayFlag: boolean
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
  const uncatchable = input.isUncatchable === true
  // 잡히지 않는 타구는 뜬 채로 잡힐 일도 없다 — 떨어진 뒤 굴러가는 공처럼 본다
  const onTheFly = !uncatchable && catchesOnTheFly(input.outcome)
  // 0xa9e44 의 1루 주자 예외 (a9ed6) — 2아웃 전 잡힐 뜬공이면 1루 주자는 포스 목표를 안 받는다
  const runners = createPlayRunners(
    input.bases,
    input.outcome,
    speed,
    onTheFly && input.outs !== 2 ? { stealingFrom: input.stealingFrom ?? [] } : null,
  )

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

  // ── 상태 0x17 진입 0x46418 → 0x3d7b8: 판 시작(vt18) 뒤 주자 목록 차례로 리드 틱을 몰아서 돌린다 ──
  // 필살수비 굴림(메시지 0x11)보다 뒤다. 도루 주자만 rand(0,9) 한 번 — 종류 1 은 그 뒤 도루 표시를 지운다(state[0x14+b] = 0)
  leadRunnersForBattedBall(runners, input)

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
    throwReleaseTick: -1,
    throwReceiverSlot: NONE,
    throwCount: 0,
    firstThrowBase: NONE,
    firstThrowArrivalTick: -1,
    batterOutTick: -1,
    catchTick,
    fumbled: false,
    errantThrow: false,
    autoBaserunning: true,
    slidingSoundPlayed: false,
    slidingSoundThisTick: false,
    laserShining: false,
    laserConfirmed: false,
    laserRolled: false,
    laserThrow: false,
    rundown: NO_RUNDOWN,
    rundownThrowArrival: -1,
    rundownThrowTo: NONE,
    rundowns: 0,
    rundownOuts: 0,
    tagOut: false,
    relayFlag: true,
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
  // 0xae690([장면+0x214], 설정+0xbd) — 공격이 CPU 거나 주루 설정이 자동이면 자동 진루 제어기가 돈다.
  // 안 넘기면 원본 기본값(자동)이라 지금까지와 똑같이 논다.
  const autoBaserunningEnabled =
    input.offenseIsCpu === true || (input.runningMode ?? '자동') !== '수동'
  // 0xae6c8([장면+0x214], 설정+0xf4) — 수비가 CPU 거나 송구 설정이 자동이면 CPU 송구 결정
  // 제어기(0xaf8e0 → vt0xc = 0xafa60 → 점수식 0xafb24)가 돈다. 안 넘기면 원본 기본값(수동)이다.
  const cpuThrowEnabled = input.defenseIsCpu === true || (input.throwMode ?? '수동') !== '수동'
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
  let throwReleaseTick = state.throwReleaseTick
  let throwReceiverSlot = state.throwReceiverSlot
  let throwCount = state.throwCount
  let firstThrowBase = state.firstThrowBase
  let firstThrowArrivalTick = state.firstThrowArrivalTick
  let batterOutTick = state.batterOutTick
  let catchTick = state.catchTick
  let fumbled = state.fumbled
  let errantThrow = state.errantThrow
  let autoBaserunning = state.autoBaserunning
  let slidingSoundPlayed = state.slidingSoundPlayed
  let slidingSoundThisTick = false
  let laserShining = state.laserShining
  let laserConfirmed = state.laserConfirmed
  let laserRolled = state.laserRolled
  let laserThrow = state.laserThrow
  let rundown = state.rundown
  let rundownThrowArrival = state.rundownThrowArrival
  let rundownThrowTo = state.rundownThrowTo
  let rundowns = state.rundowns
  let rundownOuts = state.rundownOuts
  let tagOut = state.tagOut
  let relayFlag = state.relayFlag

  const contextAt = (at: number): DefenseContext => ({
    play,
    fielders,
    runners: runners.map((runner) => runner.state),
    currentTick: at,
    landingTick: trajectory.landingTick,
  })

  /**
   * **아웃 판정 0xb36d0 (플레이 vt90) 한 번 돌리기.**
   *
   * 원본이 이 판정을 부르는 자리는 하나가 아니다 — **공을 쥘 때마다**(`0xb2710` 안 `0xb2758`) 한 번,
   * 그리고 플레이 틱 `0xb401c` 안 `0xb43da`("이 플레이의 야수가 공을 쥐고 있으면")에서 **틱마다** 한 번.
   * 그래서 여기서도 세 자리에서 부른다: 야수가 공을 잡았을 때 · 송구가 루에 닿았을 때 · 틱 갱신 뒤.
   * 잡는 순간에도 한 번 도는 것이 중요하다 — 그러지 않으면 "송구가 닿는 그 틱에 루를 밟은 주자" 가
   * 늘 세이프가 되어, 예전의 송구 도착 판정과 아슬아슬한 경우의 답이 달라진다.
   *
   * ⚠️ **0번(타자주자)은 뺀다.** 이 진행기의 규약이 "타자주자의 운명은 결과 코드가 정한다" 여서,
   * 판정이 3루타 주자를 태그로 잡으면 기록과 어긋난다. 원본에는 이 제외가 없다 — **근사**다.
   *
   * ## `tagOut`(원본 `state[0x87]`)은 "한 번이라도" 가 아니라 **"마지막 판정"** 이다 — 직접 뜬 근거
   * ```
   * b36d2: ldr  r3,[r0,#0x28] ; b36d8: adds r3,#0x87 ; b36dc: strb r2(=0),[r3]
   *        → 0xb36d0 은 **부를 때마다 머리에서 state[0x87] = 0** 으로 지우고 시작한다.
   * b3940: cmp r1,#3 ; b394a: ldr r3,[r5,#0x28] ; b394e: adds r3,#0x87 ; b3950: strb r2(=1),[r3]
   *        → 결과가 3(태그)일 때만 1 을 적고 곧바로 아웃 꼬리(0xb36fa)로 빠져 **그 자리에서 돌아온다**.
   * b43cc: 이 플레이의 야수(0xb0c90)가 +0xe0(공 쥠) 이면 b43da 에서 **매 틱** vt90 을 부른다.
   * ```
   * 곧 그 칸은 **직전 0xb36d0 한 번의 결과**만 담는다. 그런데 읽는 자리가 언제인지가 중요하다:
   * ```
   * b4540: ldr r1,[sp,#0x34] ; cmp #0 ; beq …   ; **이번 틱의 vt90 결과**가 0 이 아니면
   * b4546: state[0x1f] 면 플레이+0x12b = 1
   * b4556: movs r4,#0xd ; str r4,[sp,#0x38]     ; **결과 코드 13**
   * b4562: vt44(13) · vt54(13) → 화면 판정 스위치 0x51a94 의 v = 13 갈래
   * 51b3a: ldrb r3,[r2,#0x1f] ≠ 0 → 62 / 51b44: ldrb state[0x87] ≠ 0 → 62 / 아니면 20
   * ```
   * 결과 코드 13 은 **아웃이 난 바로 그 틱의 끝**에서, 같은 틱 안에서 화면 쪽으로 넘어간다.
   * 그러니 0x51b36 이 보는 `state[0x87]` 은 언제나 **그 아웃을 낸 판정의 값**이고,
   * 아웃이 안 난 틱의 지우기(0xb36d8)는 **아무도 읽지 않아 보이지 않는다**.
   *
   * → 그래서 여기서는 **아웃이 적히는 자리에서만** 갈아 끼운다(덮어쓴다). 아웃이 안 난 판정으로
   *   지우지 않는다 — 지워 봐야 원본에서 읽히지 않는 값이고, 웹은 콜을 **플레이 끝에 한 번**만
   *   내므로 지우면 오히려 "그 아웃을 낸 판정" 을 잃는다. 아웃이 여럿이면 **마지막 아웃**이 이긴다.
   *
   * ⚠️ **원본 `state[0x87]` 의 나머지 절반(0xb4312)은 안 옮겼다.** 원본은 결과가 **2(루 아웃)**
   *    이면서 그 야수의 `+0x3b` 가 서 있을 때도 이 칸을 세운다. 억지로 vt18(위치 == 목표)로
   *    바꿔 끼우면 **땅볼 포스 아웃이 죄다 62 로 뒤집힌다**(앞 시도).
   *
   *    2026-10 에 둘레를 더 떴다(직접 뜬 것):
   *    - `+0x3b` 의 뜻은 **확정**이다. 야수 vtable `0xd7934` 의 vt30 도 주자와 같은 `0xbf0dc` 라,
   *      갱신 머리에서 지우고(bf0e6) 목표점에 **막 닿은 갱신에서만** 1 이 된다(bf146) — 한 틱짜리 맥박.
   *    - 0xb4300~0xb4314 는 **타구 포구 틱 구역**(`b42ce`)에만 있다. 들어오는 길은 공 쥐기
   *      `b42c8 0xb2710` 과 필살타법 타구 `b4290`(메시지 0xbc3) 둘뿐이고, 틱마다 도는 `b43da` 판정은
   *      이 칸을 결과 2 로 세우지 않는다. 그 구역은 `b42e0`: `0xa99d8`(막 닿은 산 주자가 있나) ||
   *      야수+0x3b 면 vt90 을 **한 번 더** 부르고(b42f2), 그 결과가 2 이고 야수+0x3b 면 1 을 적는다.
   *    - 결과 2 는 공 쥔 야수의 발밑 루(`0xa0ae4`, 좌표 **비트까지** 같음)가 주자의 루와 같아야 서는데,
   *      포구 틱의 야수는 목표점 = 포구점에 서 있다. 포구점이 루 좌표와 비트까지 같을 때만 닿는 갈래라
   *      실제로는 거의 안 선다.
   *    여기에 **새로 드러난 어긋남 하나**: 포구 틱에는 vt90 이 두 번 돈다 — 쥐기 안(0xb2758) 한 번,
   *    그 뒤 `b42f2` 또는 `b43de` 한 번(쥐기가 야수+0xe0 = 1 을 세우니 둘 중 하나는 반드시 돈다).
   *    두 번째도 머리(b36dc)에서 `state[0x87] = 0` 으로 지우므로, **쥐기 판정이 태그 아웃(3)을 내고
   *    두 번째가 0 이면 결과 코드 13 을 읽는 b4540 시점의 칸은 0** 이다(콜 20). 이 진행기는 쥐기 판정의
   *    태그를 그대로 들고 가 62 를 낸다. 고치려면 "그 틱의 **마지막** 판정" 을 원본 차례대로 맞춰야 하는데,
   *    포구 틱 뒤의 판정(웹은 이동 뒤 6b)이 원본에서 이동 갱신 앞인지 뒤인지가 `0xb401c`(해독 금지 구역)와
   *    장면 갱신 고리에 있어 확정하지 못했다. 아웃·세이프와 난수는 안 바뀌고 콜 소리만 걸린 자리라
   *    **에뮬레이터로 확인하기 전에는 그대로 둔다.**
   */
  const runOutJudgement = (): void => {
    if (play.finished) return
    const judged = judgeOut({ ...contextAt(tick), skipRunnerIndexes: [0] })
    if (judged.kind === OUT_KIND.NONE) return
    const victim = runners[judged.runnerIndex]
    if (victim === undefined || victim.state.isOut) return
    markOut(victim)
    outs += 1
    outsAdded += 1
    outJudgedThisTick = true
    // 0xb394e — state[0x87] = (결과 == 3). 아웃이 적히는 이 자리에서만 갈아 끼운다 (위 주석)
    tagOut = judged.kind === OUT_KIND.TAG
    // 결과 3(태그)이면 원본은 그 자리에서 협살을 끝낸다 (0xb3946 → 0xb26b8)
    if (judged.kind === OUT_KIND.TAG && rundown.runnerIndex === judged.runnerIndex) {
      rundownOuts += 1
      log.push(`${tick}틱 협살 태그 — ${judged.runnerIndex}번 주자 아웃`)
    } else {
      const name = judged.kind === OUT_KIND.FLY ? '뜬공' : judged.kind === OUT_KIND.BASE ? '루' : '태그'
      log.push(`${tick}틱 ${judged.runnerIndex}번 주자 ${name} 아웃 (0xb36d0 결과 ${judged.kind})`)
    }
    if (judged.kind === OUT_KIND.TAG) {
      fielders = endRundown(fielders)
      rundown = NO_RUNDOWN
      rundownThrowArrival = -1
      rundownThrowTo = NONE
    }
    // 0xa9648 — 아웃 뒤 포스 풀기
    const relaxed = releaseForcesAfterOut(runners.map((runner) => runner.state))
    runners.forEach((runner, index) => {
      runner.state = relaxed[index] ?? runner.state
    })
  }

  /** 이번 틱에 0xb36d0 이 아웃을 냈나 — 결과 코드 13 → 메시지 0xbba (6c 절) */
  let outJudgedThisTick = false

  /**
   * **공 가진 야수가 던질 준비가 됐나** — 0xafa60 · b4674 가 보는 `야수.vtC4()` = 0xa20ec
   * (`+0xb0 == 0 && +0xb4 ≤ 0 && +0xc8 ≤ 0`) 와 0xafa60 의 `AI 상태 ∉ {8, 9}`.
   * 쥐기 0xb2710(P, f, 1)이 +0xc8 에 준비 틱(내야 3 · 외야 6)을 넣고, 이 틱 머리(0절)의 야수 틱이 쥔 동안 하나씩 줄인다.
   * 상태 8(협살)은 CPU 수비에만 선다. +0xb0 · +0xb4(동작 잠금)는 이 진행기에 없다(펌블은 15틱 뒤 다시 줍기로 옮겼다).
   */
  const isHolderReady = (): boolean => {
    const holder = fielders[play.ballHolderSlot]
    return (
      play.held &&
      holder !== undefined &&
      holder.holdingBall &&
      holder.actionRemainingTicks <= 0 &&
      rundown.runnerIndex === NONE
    )
  }

  /**
   * **공 가진 야수가 루 `base` 로 던진다** — 송구 0xb2e38 → 던지기 0xa1620. 루로 보내기 0xb2c90 의 관문은
   * `sendToBase` 가 먼저 본다. `chooser` 는 누가 고른 루인가: '사람'(+0x160, b4660~b46a8) · 'CPU'(0xafa60 → 0xafb24).
   * `cpuSpecial` 은 0xafa60 이 홈을 골랐을 때 굴린 20% 특수(`afad2`)다 — 굴림은 부르는 쪽이 한다.
   *
   * 던지면 공이 손을 떠난다(직접 뜬 것):
   * ```
   * b2f80: 던진 야수+0xe0 = 0                      ; 공 쥠 풀림
   * b3070: 플레이+0x12c = 0                        ; 아무도 안 쥠
   * b307c: 플레이.vt24(0) = 0xb12d0 포구 예보       ; +0x170(받을 야수) · +0x174(받는 틱)를 송구공으로 다시 세운다
   * ```
   * 그래서 날아가는 동안 수비 틱 예측 0xaf284 의 "잡을 야수"(+0x170)는 받을 야수이고 "남은 틱" 은 받는 틱까지다.
   * 웹은 받는 틱을 이 진행기의 도착 틱으로 둔다(궤적 물리 0xb401c 는 해독 금지 구역).
   */
  const launchThrow = (fromSlot: number, base: number, chooser: '사람' | 'CPU', cpuSpecial: boolean): void => {
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    // 레이저 송구 — 반짝임 창 안에 새로 누른 키가 들어왔고 공을 쥐었으면 특수 송구가 나간다 (0x400bc)
    const laser = canFireLaser({
      isLaserConfirmed: laserConfirmed,
      hasChosenThrowTarget: play.manualThrowBase !== NONE,
      isBallHeld: true,
      isThrowerReady: true,
    })
    if (laser) laserThrow = true
    // CPU 홈 송구 20% 특수 송구 — 효과는 `cpuSpecialThrowOf` 참고. 레이저는 0xb2e38 이 다른 함수로 던진다(아래)
    const special = !laser && cpuSpecial ? cpuSpecialThrowOf(fielders, fromSlot, coverSlot) : NO_CPU_SPECIAL_THROW
    let error: ThrowErrorResult = NO_THROW_ERROR
    let arrivalTicks: number
    if (laser) {
      // b2f06: 플레이+0x1f4(레이저) 면 0xa1620(vtac) 대신 야수 vtb0 = 0xa222c 로 던진다 (직접 뜬 것):
      //   a229c `+0xdc = 2000` 고정 속도 · 0xa1adc 와 같은 정수 산술(0xa279d 중력 배율 · 0xbfab0 · cos) · **난수 굴림 없음**
      //   (0xbfa54 호출이 없다 — 악송구가 안 난다). 특수라 0xb3444 가 중계도 안 끼운다(b3528).
      fielders = fielders.map((fielder) =>
        fielder.slot === fromSlot ? { ...fielder, throwSpeed: LASER_THROW_SPEED } : fielder,
      )
      arrivalTicks = specialThrowArrivalTicks(contextAt(tick), base, fielders[fromSlot])
    } else {
      // 원바운드(0xa17fc 갈래)는 악송구 굴림 대신 rand(0,2) 한 번으로 각도 부호(±1)만 정한다
      if (special.bounce && input.random !== undefined) randomIntegerBelow(input.random, 0, 2)
      // 악송구 굴림 (0xa1828). CPU 특수 송구는 0xa1620 의 다섯째 인자(= 계획 [1])로 기준 +100 에 들어간다
      if (input.random !== undefined && !special.bounce) {
        error = rollThrowError(abilities[fromSlot] ?? DEFAULT_ABILITY, special.special, input.random)
      }
      // a16dc~a16ec: +0xdc = 특수 ? +0xd8 : +0xd4 — 던질 때 덮어쓰고 그 판 동안 남는다(`FielderState.throwSpeed`)
      fielders = fielders.map((fielder) => (fielder.slot === fromSlot ? thrownWith(fielder, special.special) : fielder))
      arrivalTicks = special.special
        ? specialThrowArrivalTicks(contextAt(tick), base, fielders[fromSlot])
        : defenseArrivalTicks(contextAt(tick), base)
    }
    if (error.errant) errantThrow = true
    if (error.errant && input.random !== undefined) {
      // 악송구 갈래(a1868~a1908) — 수평 속도·방향을 흔들고 굴림 둘을 더 먹는다(`errantThrowFlight`).
      // 공은 송구 계획 [3](중계면 중계맨, b2ea8)의 목표점(+0x2c)으로 쏜다. 도착 틱 = 남은 동작 틱(+0xc8) + 흔들린 공이
      // 그 큰 축 거리를 가는 틱. **근사**: 그 뒤 공 경로는 해독 금지 구역이라 "그 송구는 아무도 못 받는다" 로 본다.
      arrivalTicks = errantArrivalTicks(fielders, fromSlot, coverSlot, base, special.special, error, input.random)
    }
    throwBase = base
    throwArrivalTick = tick + Math.max(1, arrivalTicks)
    throwFromSlot = fromSlot
    throwReleaseTick = tick
    throwReceiverSlot = error.errant ? NONE : coverSlot
    throwCount += 1
    if (firstThrowBase === NONE) {
      firstThrowBase = base
      firstThrowArrivalTick = throwArrivalTick
    }
    // 손을 떠난다 — 준비 틱(+0xc8)도 다 썼다. 받을 야수 · 받는 틱을 다시 세운다 (b2f80 · b3070 · b307c)
    fielders = fielders.map((fielder) =>
      fielder.slot === fromSlot ? { ...fielder, holdingBall: false, actionRemainingTicks: 0 } : fielder,
    )
    play = {
      ...play,
      held: false,
      catchFielderSlot: coverSlot === NONE ? play.catchFielderSlot : coverSlot,
      catchTick: throwArrivalTick,
    }
    log.push(
      `${tick}틱 ${base}루로 ${laser ? '레이저 ' : ''}${cpuSpecial ? '특수 ' : ''}송구 — ${throwArrivalTick}틱 도착` +
        (special.bounce ? ' (원바운드)' : '') +
        (error.errant ? ' (악송구)' : '') +
        (chooser === 'CPU' ? ' (CPU 결정)' : '') +
        ` (${fromSlot}번 야수)`,
    )
  }

  /**
   * **루로 보내기 0xb2c90**(플레이.vt58, 인자 루·특수) — 성공(1)이면 참. 직접 뜬 것:
   * ```
   * b2cb4: C = +0xf0[루 & 3]
   * b2cc4: C == −1 → 공 가진 야수 AI 상태 6 · vt48(루) = 직접 들고 뛴다 ; 0
   * b2cf0: C.vt68()(목표 루) ≠ 루 → 0
   * b2d14: t_run = 공가진야수.vt1c(루 좌표) ; t_throw = 공가진야수.vtb8(C 목표점) ; t_recv = C.vtc0()
   * b2d64: t_run ≤ max(t_throw, t_recv) → 0xb2a48(P, +0x130, 루) 직접 밟으러 간다 ; 1
   * b2d7e: 거리(공가진야수, C) > 600 이고 C ≠ 자신 → +0x154 = C, vt5c(C, 특수) = 0xb2e38 송구 ; 그 결과
   *        아니면 아무것도 안 함 ; 0
   * ```
   * 실패(0)하면 0xafa60 은 +0x128 을 안 지워 다음 틱에 다시 고른다.
   * ⚠️ 0xb2e38 의 AI 상태 9 갈래(받을 야수가 늦으면 송구를 미룸, b2ec4)와 던진 야수 상태 0(제자리로 돌아감)은 안 옮겼다.
   *    0xb2a48 의 걸음은 "들고 뛰기" 와 같은 상태 6 이동으로 둔다(AI 번호는 안 떴다).
   */
  const sendToBase = (fromSlot: number, base: number, chooser: '사람' | 'CPU', cpuSpecial: boolean): boolean => {
    const holder = fielders[fromSlot]
    if (holder === undefined) return false
    const coverSlot = play.coverOfBase[wrapBase(base)] ?? NONE
    const basePoint = basePosition(base)
    /** 공 든 채 루로 (AI 상태 6 · vt48(루)). 같은 루로 이미 가고 있으면 새로 적지 않는다 — 0xafa60 이 매 틱 다시 고른다 */
    const carry = (why: string): void => {
      if (holder.aiState === AI_STATE.CARRY && holder.targetBase === base) return
      fielders = fielders.map((fielder) =>
        fielder.slot === fromSlot
          ? { ...fielder, target: basePoint, targetBase: base, aiState: AI_STATE.CARRY }
          : fielder,
      )
      log.push(`${tick}틱 ${fromSlot}번 야수가 ${why}`)
    }
    if (coverSlot === NONE) {
      carry(`${base}루로 공을 들고 뛴다 (커버 없음)`)
      return false
    }
    const cover = fielders[coverSlot]
    if (cover === undefined || cover.targetBase !== base) return false
    const runTicks = ticksToReach(holder.position, basePoint, holder.speed)
    const throwTicks = throwTicksTo(holder, cover.target)
    const receiveTicks = fielderArrivalTicks(cover)
    if (runTicks <= Math.max(throwTicks, receiveTicks)) {
      if (runTicks > 0) carry(`${base}루를 직접 밟으러 간다`)
      return true
    }
    if (coverSlot === fromSlot || horizontalDistance(holder.position, cover.position) <= MINIMUM_THROW_DISTANCE) {
      return false
    }
    launchThrow(fromSlot, base, chooser, cpuSpecial)
    return true
  }

  /**
   * **CPU 송구 결정 0xafa60** — 플레이+0x128 이 서 있고 공 가진 야수가 준비됐을 때 점수식 0xafb24 로 루를 고르고
   * (홈이면 20% 특수 굴림), 0xb2c90 이 성공하면 +0x128 = 0.
   */
  const cpuThrowDecision = (): void => {
    if (!play.wantsThrow || !isHolderReady()) return
    const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
    const base = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
    if (base === NONE) return
    // afad2: 홈(0)을 골랐을 때**만** rand(0,100) — 0xb2c90 이 실패해도 굴림은 먹는다
    const cpuSpecial =
      base === 0 && input.random !== undefined && isSpecialThrow(base, randomIntegerBelow(input.random, 0, 100))
    if (sendToBase(play.ballHolderSlot, base, 'CPU', cpuSpecial)) play = { ...play, wantsThrow: false }
  }

  // 아래 묶음은 예전 `for (let tick = 0; …)` 루프의 **몸통 그대로**다.
  // 한 줄도 안 옮기려고 묶음(블록)만 씌워 두었다 — 결과가 한 톨도 달라지면 안 되는 자리다.
  {
    outJudgedThisTick = false
    const ballOnGround = play.everHeld || tick >= trajectory.landingTick

    // ── 0'. 야수 틱 0xa1284 의 준비 틱 줄이기 (직접 뜬 것) ──
    // ```
    // 52c50: 장면 갱신 — 52e16 공용 갱신 0x3f060 → (상태 0x17 이면) 52e94 0x524c0(슬롯 2: 플레이 틱 · 자동 진루 · CPU 송구)
    // 3f0d2: 0x3f060 은 플레이가 돌고 상태 0x17 이면 장면+0x1e4 객체 목록.vt8 = 원소마다 vt0xc — 야수 9명(3e660, new(0xf4)
    //        + 0xa0e08)·주자가 이 목록에 들어 있다(0xc0104)
    // a1312: 야수 vt0xc = 0xa1284: (+0xb4 동작 잠금이 0 일 때) +0xc8 > 0 && +0xe0(공 쥠) 이면 +0xc8 −= 1 (0 아래로 안 감)
    // ```
    // 곧 **야수 틱이 플레이 틱보다 먼저** 돈다 — 포구 틱에 쥐기(0xb2710)가 넣은 준비 틱 R 은 다음 틱부터 줄어
    // 포구 R 틱 뒤에 0 이 된다. 쥔 동안만 줄고, +0xc8 을 넣는 곳은 쥐기(vt88, b27aa·b27be)뿐이다.
    fielders = fielders.map((fielder) =>
      fielder.holdingBall && fielder.actionRemainingTicks > 0
        ? { ...fielder, actionRemainingTicks: fielder.actionRemainingTicks - 1 }
        : fielder,
    )

    // ── 0. 사람 조작 (상태 0x17 갈래 0x53420 — I-controls 0·2b·3b절) ──
    // 예전에는 `input.controls?.keyAt(tick)` 로 미리 물어봤다. 이제는 **이번 틱에 눌린 키**를 받는다
    const press = key
    if (input.controls !== undefined && press !== null) {
      // 누르고 있어서 되풀이된 키는 귀루 셋이 안 먹는다 — 원본 `[조작+0x1c] & 0xf0`(경기+0x6c 비트 4~7)
      const command = inPlayCommandOf(press.key, input.controls.side, {
        isHoldRepeat: press.isRepeat === true,
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
          if (decision.playsSound) {
            slidingSoundPlayed = true
            slidingSoundThisTick = true
          }
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
    //
    // ⚠️ 굴림(0x66a8c)은 **사람·CPU 를 가리지 않고** 돈다. 0x523bc 를 그대로 읽으면
    //   0x523d6  [this+0x19af] ≠ 0 → 반환        ; 한 플레이 한 번
    //   0x523e0  [this+0x1094] > 0  → 반환
    //   0x523e6  공 가진 야수가 있으면 준비됐는지(0xb8da8) 확인, 없으면 건너뜀
    //   0x52408  [경기+0x19] ≠ 0 → 반환
    //   0x5242a  창 0xb2648(플레이) 거짓 → 반환
    //   0x5243e  주자 수 0xa9598 == 0 → 반환
    //   0x52456  0x66a8c(…) 굴림 → 떨어져도 0x5248c 에서 `+0x19af = 1`
    //   0x52468  통과하면 `경기[0x31 + 경기[0xa]]` 가 0(사람)이면 `+0x19ad`(반짝임),
    //            아니면(CPU) `+0x19ae`(곧바로 레이저)
    // 즉 **굴림은 갈림 앞**에 있다. 예전 웹판은 `controls.side === '수비'` 로 굴림째 막아
    // CPU 수비 타구에서 난수를 한 번 덜 뽑아 원본과 차례가 어긋났다 — 그 자리를 바로잡는다.
    //
    // 주자 수(0xa9598) 관문은 따로 옮기지 않았다 — 이 진행기의 `runners` 에는 타자주자가 늘
    // 들어 있어 타구 플레이에서는 언제나 참이다.
    if (input.random !== undefined && !uncatchable) {
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
        const passed = rollLaserThrow(
          {
            defenseAbility: abilities[chaserSlot] ?? DEFAULT_ABILITY,
            skillIds: input.fielderSkillIds?.[chaserSlot] ?? [],
          },
          input.random,
        )
        if (passed) {
          // CPU 수비는 반짝임 없이 곧바로 `경기+0x19ae`, 사람 수비는 `경기+0x19ad`(반짝임)
          if (defenseIsCpu) laserConfirmed = true
          else laserShining = true
        }
      }
      // 0x4e858 은 조건 없이 매 틱 돈다 — 창이 닫히면 `+0x19ad` 를 지우고,
      // 반짝이는 중에 **새로 누른** 키가 오면 `+0x19ae` 를 켠다. CPU 수비는 반짝임이 없으니
      // 이 갈래가 아무것도 바꾸지 않는다(키도 안 들어온다).
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
      // 공 쥐기 0xb2710 은 쥐자마자 vt90(아웃 판정)을 부른다 (0xb2758)
      runOutJudgement()

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
          // 포스가 풀린다 — 뜬 채로 잡히면 타자주자가 1루에 안 서므로 뒤에서 미는 힘이 사라진다.
          // 원본 0xa9620 이 **모든 주자의 요구 루를 원래 루로** 되돌리는 것과 같은 자리다.
          // (안 되돌리면 리터치한 주자가 곧바로 다시 뛰어 나가 포스 아웃을 당한다)
          runner.minimumBase = runner.state.pitchBase
        }
      } else {
        // 굴러간 공 — 포스 요구 루를 세운다 (0xa95e8)
        const required = requiredBasesOnBounce(runners.map((runner) => runner.state))
        runners.forEach((runner, index) => {
          runner.state = { ...runner.state, requiredBase: required[index] }
        })
      }

      // ── 송구 목표 루 ──
      // 사람이 방향키로 고른 목표(플레이+0x160)가 있으면 그 루다 (플레이 틱 0xb45dc 의 b4660~b46a8).
      // 안 골랐으면 — **송구 설정 갈림**(`input.throwMode` 주석의 0x5269c·0xae6c8):
      //   CPU 송구 결정이 도는 쪽(수비 CPU 또는 설정 자동)이면 점수식 0xafb24,
      //   안 도는 쪽(사람 수비 + 설정 수동)이면 **아무도 던지지 않는다**. 0xb1c90 의 자동 가지는 고른 루를
      //   2루 커버/중계 야수 자리 잡기에만 쓰고 송구 호출이 없다(c8649a3). 그 밖에 공을 내보내는 자리
      //   (중계 이어 던지기 b4616 · AI 상태 9·0xe · 협살 0xb3a94)는 모두 앞선 송구·견제·CPU 에서만 선다.
      //   아웃이 난 뒤에는 한 번 CPU 결정이 돈다 — 아래 6c 절.
      //
      // ⚠️ **근사(그대로 둔 것)**: 원본은 쥐기가 넣은 준비 틱(+0xc8)이 다 줄어야(vtC4) 사람 키(b4660)든 CPU(0xafa60)든
      //    던진다 — 포구 R 틱 뒤다. 이 절은 포구 틱에 고르고 준비 틱을 도착 틱에 더한다(0xaf284 "이미 잡았다" 갈래).
      //    고른 뒤의 루로 보내기 관문(0xb2c90: 커버 없음 → 들고 뛰기 · 직접 밟기 · 600 이하)은 원본대로 본다.
      //    CPU 가 −1 을 고르거나 0xb2c90 이 실패하면 +0x128 이 남아 준비가 끝난 틱부터 4c 절이 다시 고른다.
      const active = runners.filter((runner) => !runner.state.isOut && !runner.state.scored).length
      // 땅볼·직선타로 타자주자가 죽는 시각은 1루에 공이 닿는 때다 — 공이 손을 떠나기 전(쥔 채)의 0xaf284 로 잰다
      if (input.outcome.kind === '아웃' && !onTheFly) {
        batterOutTick = tick + defenseArrivalTicks(contextAt(tick), 1)
      }
      if (play.manualThrowBase !== NONE) {
        const manual = play.manualThrowBase
        sendToBase(chaserSlot, manual, '사람', false)
        // b46a4: 사람 목표는 한 번 보면 지운다 (+0x160 = −1)
        play = { ...play, manualThrowBase: NONE }
      } else if (cpuThrowEnabled) {
        const target = chooseThrowTargetBase({ ...contextAt(tick), activeRunnerCount: active, outs })
        if (target !== NONE) {
          // CPU 홈 송구 20% 특수 송구 (0xafa60) — 점수식이 홈(0)을 골랐을 때**만** 한 번 굴린다
          // (`afad2: cmp r0,#0 ; bne` 로 홈이 아니면 굴림 자체를 건너뛴다). 효과는 `cpuSpecialThrowOf` 참고.
          const cpuSpecial =
            target === 0 &&
            input.random !== undefined &&
            isSpecialThrow(target, randomIntegerBelow(input.random, 0, 100))
          if (sendToBase(chaserSlot, target, 'CPU', cpuSpecial)) play = { ...play, wantsThrow: false }
        }
      }
    }

    // ── 1b. 포구 뒤에 사람이 고른 목표 — 플레이 틱 vt4c(0xb45dc) 의 b4660~b46a8 (직접 뜬 것) ──
    // ```
    // b4660: +0x160 ≠ −1 && +0x12c(쥠) && 공가진야수.vtC4()(준비) 이면
    // b4686:   공가진야수.vt58()(발밑 루) ≠ +0x160 이면 플레이.vt58(+0x160, 0) = 0xb2c90   ; 루로 보내기
    // b46a4:   +0x160 = −1
    // ```
    // 포구 틱 전에 고른 키는 위 1절이 포구 틱에 던진다(준비 틱은 도착 틱에 더한다 — 근사). 여기는 포구 **뒤에**
    // 고른 키 — 공 가진 야수(받은 야수 포함)의 준비가 끝난 틱부터 그 루로 보낸다. 발밑 루(좌표 완전일치)가
    // 그 루면 보내지 않는다. 어느 쪽이든 본 뒤에는 +0x160 = −1 이다.
    if (
      !play.finished &&
      !uncatchable &&
      play.manualThrowBase !== NONE &&
      tick > catchTick &&
      isHolderReady()
    ) {
      const manual = play.manualThrowBase
      const holderSlot = play.ballHolderSlot
      if (!isSamePoint(fielders[holderSlot].position, basePosition(manual))) {
        sendToBase(holderSlot, manual, '사람', false)
      }
      play = { ...play, manualThrowBase: NONE }
    }

    // ── 2. 송구 도착 — 공이 받은 야수의 손으로 옮겨 간다 ──
    //
    // ⚠️ 예전에는 여기서 **"그 루로 가던 주자가 아직 못 닿았으면 아웃"** 을 바로 찍었다.
    // 그것은 원본에 없는 갈래다. 원본은 아웃 판정 `0xb36d0`(vt90) 하나가 **틱마다** 돌면서
    // 포스(2)와 태그(3)를 **갈라서** 잡는다 — 포스가 안 걸린 주자는 루에 공이 먼저 닿아도
    // 안 죽고 태그(≤499)를 받아야 죽는다. 그래서 그 갈래를 통째로 6b 절로 옮겼다.
    // (`outJudgement.judgeOut` · 근거는 그 파일 머리에 다 적어 두었다.)
    if (throwArrivalTick >= 0 && tick === throwArrivalTick) {
      // 공은 **받은 야수의 손으로 옮겨 간다** — 송구공도 포구 틱 갈래 b42c8 의 쥐기 0xb2710(P, f, **1**)로 잡는다:
      // `+0x128 = 1 · P+0x130 = 받은 야수 · +0x12c = 1 · 야수+0xe0 = 1` 에 준비 틱(내야 3 · 외야 6, vt88)을 넣고
      // 그 자리에서 vt90(아웃 판정)을 부른다. 이 줄이 없으면 공 쥔 야수가 끝까지 "쫓아간 야수" 로 남아
      // 협살 조건("공 쥔 야수가 두 커버 야수 중 하나", 0xb3fa8)이 영영 서지 않는다.
      const receiverSlot = throwReceiverSlot
      if (receiverSlot !== NONE) {
        fielders = fielders.map((fielder) =>
          fielder.slot === receiverSlot
            ? { ...fielder, holdingBall: true, actionRemainingTicks: readyTicksOf(receiverSlot) }
            : fielder.holdingBall
              ? { ...fielder, holdingBall: false }
              : fielder,
        )
        play = {
          ...play,
          ballHolderSlot: receiverSlot,
          catchFielderSlot: receiverSlot,
          held: true,
          wantsThrow: true,
        }
        runOutJudgement()
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
          // 공이 짝에게 날아가는 중이면 "공 쪽" 은 짝이 선 자리다 (원본은 공 객체의 목표점 공+0x2c 을 본다)
          const ballTarget =
            rundownThrowArrival >= 0 && rundownThrowTo !== NONE
              ? fielders[rundownThrowTo]?.position ?? catchPoint
              : catchPoint
          for (const slot of [rundown.backFielder, rundown.frontFielder]) {
            if (released) break
            const action = rundownAction({ ...contextAt(tick), plan: rundown, slot, ballTarget })
            if (action.kind === '협살해제') {
              released = true
              break
            }
            const self = fielders[slot]
            if (self === undefined) continue
            if (action.kind === '주자추적') {
              // vt0x4c — 상대의 현재 위치를 그대로 목표로 삼는다
              const to = chased.state.position
              fielders = fielders.map((fielder) =>
                fielder.slot === slot
                  ? { ...fielder, target: to, position: stepToward(fielder.position, to, fielder.speed) }
                  : fielder,
              )
            } else if (action.kind === '짝에게송구') {
              if (rundownThrowArrival < 0) {
                const partner = fielders[action.toSlot]
                if (partner !== undefined) {
                  rundownThrowTo = action.toSlot
                  rundownThrowArrival = tick + Math.max(1, throwTicksToFielder(self, partner))
                  // **공이 손을 떠난다** — 던진 야수는 `야수+0xe0 = 0`, 플레이는 `+0x12c = 0` 이 된다.
                  // 그래서 원본에서 던진 야수는 다음 틱부터 상태 8 의 첫 갈래("아직 포구 전")로 떨어져
                  // **제 송구를 따라 짝 쪽으로 달린다**. 이 줄이 없으면 던진 야수가 제 루에 붙박여
                  // 두 야수가 주자 쪽으로 좁혀 들어오지 않는다.
                  fielders = fielders.map((fielder) =>
                    fielder.slot === slot ? { ...fielder, holdingBall: false } : fielder,
                  )
                  play = { ...play, held: false }
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

            // ── 태그 아웃 판정 (0xb36d0 결과 3 → 0xb3946 이 협살을 끝낸다) ──
            // 원본은 AI 상태와 무관하게 아웃 판정이 돌아, **공 쥔 야수와 주자의 거리가 499 이하**이고
            // 주자가 루 위가 아니면 아웃이다. 여기서는 협살에 낀 두 야수에 대해서만 본다.
            const afterMove = fielders[slot]
            if (afterMove !== undefined && tagsRunner(afterMove, chased.state)) {
              markOut(chased)
              outs += 1
              outsAdded += 1
              rundownOuts += 1
              // 이것도 0xb36d0 결과 3 이다 — state[0x87] = 1 (0xb394e)
              tagOut = true
              released = true
              log.push(`${tick}틱 협살 태그 — ${rundown.runnerIndex}번 주자 아웃`)
            }
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
    //
    // **언제 도는가** — 원본 0x5261c~0x52668 (매 틱, 경기 장면 슬롯 2) 을 그대로 옮긴다:
    //   0xae690 = (공격측이 CPU) || (설정+0xbd ≠ 0 = 자동) 이 참이면 돈다.
    //   거짓이어도 플레이+0x111(끝남)·플레이+0x129·종류 7(홈런더비)이면 그래도 돈다.
    // 곧 **사람이 공격하면서 주루 설정이 수동이면 자동 진루가 통째로 안 돈다.**
    //
    // ⚠️ 예전 줄은 `경기+0x24`(autoBaserunning)로 이 판단을 막았는데 **원본에는 그런 게이트가
    //    없다** — 0x24 를 읽는 곳은 0x3e0e6·0x521fa 둘뿐이고 둘 다 자동 진루와 무관하다
    //    (위 `autoBaserunning` 칸 주석). 그래서 그 항을 뺐다.
    // (예외 중 `+0x111`·`+0x129` 는 여기서 뜻이 없다 — `autoAdvanceDecisions` 가 그 두 칸에
    //  빈 목록을 돌려주기 때문이다. 원본 게이트 모양을 그대로 보이려고 항만 남겨 둔다.)
    if (!play.finished && (autoBaserunningEnabled || play.suppressed || play.kind === 7)) {
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
        // afa0e: 한 루 더 보내면 플레이+0x128 = 1 — CPU 송구 결정이 다시 고른다
        play = { ...play, wantsThrow: true }
      }
    }

    // ── 4b. 자동 슬라이딩 (0x52670 → 0xaf8fc → 제어기 vt10 = 0xb030c) ──
    // 원본은 경기 장면 슬롯 2 에서 자동 진루(0x52660) **바로 뒤**, CPU 송구 결정(0x526ae) 앞에 매 틱 돈다.
    // 사람/CPU·주루 설정 갈림이 없다. 슬라이딩시킨 주자가 하나라도 있으면 그 자리에서 효과음 10
    // (0x5267e `ble` → 0x5268c request(10)) — 사람 키와 달리 +0x31c 잠금도, 소리 재생 중 검사도 없다.
    //
    // ⚠️ 원본 그대로: 0xb030c 는 `주자+0x7c == 계획[+0xf]` 를 **mod 4 없이** 견준다(b0368~b036c).
    // 홈으로 가는 주자의 목표 루는 4(루 표 [4] = 홈 사본)이고 송구 목표 홈은 0 이라 **홈 송구로는 자동
    // 슬라이딩이 걸리지 않는다.** 고치지 않는다.
    //
    // **근사**: 원본 T = 계획[5](1구간 틱) − 공+0x68 이다. 웹은 송구 도착 틱 하나만 들고 있어
    // `송구 도착 틱 − 지금 틱` 을 쓴다(중계 송구면 원본은 첫 구간만 본다). "공.vt18() 거짓" 은
    // 송구가 날아가는 중으로 읽었다(R3 3-3). 메시지 처리기 0x519a4 의 같은 호출은 웹에 메시지 큐가 없어 뺐다.
    if (!play.finished) {
      const slid = autoSlideRunnerIndexes({
        isThrowInFlight: throwArrivalTick >= 0 && tick < throwArrivalTick,
        throwTargetBase: throwArrivalTick >= 0 && tick < throwArrivalTick ? throwBase : NONE,
        throwArrivalTicks: throwArrivalTick - tick,
        runners: runners.map(slidingRunnerOf),
      })
      for (const index of slid) {
        const runner = runners[index]
        runner.state = {
          ...runner.state,
          sliding: true,
          speed: runner.state.speed + SLIDING_SPEED_BONUS,
        }
      }
      if (slid.length > 0) {
        slidingSoundThisTick = true
        log.push(`${tick}틱 자동 슬라이딩 — 주자 ${slid.join('·')}`)
      }
    }

    // ── 4c. CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 자동 슬라이딩 바로 뒤 · 매 틱) ──
    // `0xae6c8` = 수비 CPU || 송구 설정 자동 일 때만 돈다(`input.throwMode` 주석). 0xafa60 은 +0x128 이 서 있고
    // 공 가진 야수가 준비(vtC4)됐을 때만 고른다 — +0x128 은 쥐기(받은 송구 포함)·자동 진루(afa0e)·결과 메시지
    // 0xbba 가 세우고 0xb2c90 성공이 지운다. 그래서 받은 야수는 준비 틱이 다 지난 틱에 **이어 던진다**(병살 송구),
    // 점수식이 −1 이면 다음 틱에 다시 고른다.
    if (cpuThrowEnabled && !play.finished && !uncatchable && tick > catchTick) {
      cpuThrowDecision()
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
          holderSlot: play.ballHolderSlot,
          held: play.held,
          throwBase,
          throwArrivalTick,
          throwFromSlot,
          throwReleaseTick,
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
        throwingSlot:
          throwArrivalTick >= 0 && tick >= throwReleaseTick && tick < throwReleaseTick + 3 ? throwFromSlot : NONE,
        throwBase,
        previousActions,
        // ── 그림에만 쓰이는 것들 ──
        // 번쩍임(deadly_effect B·C)은 넘길 것이 없다 — 켜짐 칸 플레이+0x1f7·+0x1f8 을 세우는 것이
        // 포구 동작 분기표 0xd87f4 의 종류 3(점프)·4(슬라이딩)라 `catchKind` 로 이미 정해진다
        // (P2 2b, 확정). `defensePlayView.flashOf` 주석 참고.
        // 레이저 송구 반짝임(경기+0x19ad) — 0x43406~0x4342c 의 세 조건을 여기서 본다:
        // 공 쥔 야수(플레이+0x130) · 반짝임 켜짐 · deadly_effect A(+0x1990)가 안 돎.
        // A 는 **그리지 않는 줌 펀치**라 웹판에 상태 자체가 없다(R2 2절) — 셋째 조건은 늘 참으로 둔다(근사).
        laserShiningSlot: laserShining && play.held ? play.ballHolderSlot : NONE,
        aceIndexes: input.aceIndexes,
        defenseTeamIndex: input.defenseTeamIndex,
        offenseTeamIndex: input.offenseTeamIndex,
      }),
    )

    // ── 6. 한 틱 움직이기 ──
    // 0xb1c90(플레이 vt30, 매 틱)의 커버 배치 갈래 0xb203a — 2루 커버가 아닌 키스톤 야수의 자리(중계 자리 · 기본 자리)
    if (!play.finished) {
      const placement = secondBaseHelperPlacement({
        context: contextAt(tick),
        secondBaseCover: covers[2] ?? NONE,
        ballToFirstSide: catchPoint.x > basePosition(0).x,
        relayFlag,
      })
      if (placement.kind === '자리') {
        if (placement.relayPlaced) relayFlag = false
        fielders = fielders.map((fielder) =>
          fielder.slot === placement.slot
            ? { ...fielder, target: placement.target, aiState: AI_STATE.BUSY }
            : fielder,
        )
      }
    }
    fielders = fielders.map((fielder) => moveFielder(fielder, { chaserSlot, catchPoint, covers, tick, catchTick }))
    for (const runner of runners) {
      if (runner.state.isOut || runner.state.scored) continue
      const target = basePosition(runner.state.targetBase)
      runner.state = {
        ...runner.state,
        position: stepToward(runner.state.position, target, runner.state.speed),
      }
      if (!isAtTarget(runner.state)) continue
      // 0xa040c 도착 — **+0x8c = +0x7c**(닿은 루를 "마지막으로 닿은 루" 로 굳힌다).
      // 그 뒤 `+0x94 && +0x8c == +0x88` 이면 `+0x88 = -1, +0x94 = 0` 으로 요구 루가 풀린다.
      const touched = runner.state.targetBase
      runner.state = {
        ...runner.state,
        settled: true,
        startBase: touched,
        requiredBase:
          runner.state.requiredBase !== NONE && runner.state.requiredBase === touched
            ? NONE
            : runner.state.requiredBase,
      }
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

    // ── 6b. 아웃 판정 0xb36d0 — 틱 갱신 뒤 갈래 (0xb43da) ──
    runOutJudgement()

    // ── 6c. 아웃이 난 틱 끝의 CPU 송구 결정 — **사람 수비·수동 송구에서도 돈다** (직접 뜬 것) ──
    // ```
    // b4540: 이번 틱 vt90 결과 ≠ 0 → 결과 코드 13 (b4556) → 메시지 0xbba(13) (b457c, 0xbfbac = 곧바로 부른다)
    // 51a56: 화면 0xbba 처리 → 점프표 0xd0488[13] = 0x51b36(콜) → 0x51d3c → 0x51d40
    // 51d40: 결과 코드 ∈ {9, 13} 이면
    // 51d4e:   0x3403c(수비 조작 객체 +0x10 == 1, CPU) || 0x33fe4(== 0, 사람) 면 통과 — 사람·CPU 모두
    //          (그 밖의 종류 2 조작만 설정+0xf4 를 본다)
    // 51d7a:   0x33c98(경기 상태 ∈ 6·0x17·…) && 아웃 state[6] ≤ 2 이면
    // 51da8:     플레이+0x128 = 1 ; 0xaf8e0(제어기) = vt0xc = 0xafa60 CPU 송구 결정 (한 번)
    // ```
    // 0xafa60 은 공 가진 야수가 준비(vtC4)돼 있어야 던진다 — 포구 틱의 뜬공 아웃은 준비 틱이 남아 안 던진다.
    // 결과 코드 9(0xb444a: 공 쥔 야수가 목표 루에 막 닿았고(+0x3b) 그 루에 주자가 서 있음)도 같은 길이다.
    // ⚠️ 그 갈래는 안 옮겼다 — 공 들고 루로 가는 야수(0xb2c90 들고 뛰기 · 직접 밟기)가 닿는 틱에만 선다.
    // 받은 야수가 다시 던지는 병살 송구도 이 길이다 — 다만 송구를 받는 틱의 아웃은 쥐기가 준비 틱을 막 넣어
    // 그 자리 0xafa60 이 못 던지고, 사람 수비·수동 송구에서는 그 뒤 0xafa60 을 부르는 곳이 없어 이어 던지지 않는다.
    // (CPU 송구가 도는 쪽은 4c 절이 준비가 끝난 틱에 던진다.)
    if (outJudgedThisTick && outs <= 2 && !play.finished && !uncatchable) {
      play = { ...play, wantsThrow: true }
      cpuThrowDecision()
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
  state.throwReleaseTick = throwReleaseTick
  state.throwReceiverSlot = throwReceiverSlot
  state.throwCount = throwCount
  state.firstThrowBase = firstThrowBase
  state.firstThrowArrivalTick = firstThrowArrivalTick
  state.batterOutTick = batterOutTick
  state.catchTick = catchTick
  state.fumbled = fumbled
  state.errantThrow = errantThrow
  state.autoBaserunning = autoBaserunning
  state.slidingSoundPlayed = slidingSoundPlayed
  state.slidingSoundThisTick = slidingSoundThisTick
  state.laserShining = laserShining
  state.laserConfirmed = laserConfirmed
  state.laserRolled = laserRolled
  state.laserThrow = laserThrow
  state.rundown = rundown
  state.rundownThrowArrival = rundownThrowArrival
  state.rundownThrowTo = rundownThrowTo
  state.rundowns = rundowns
  state.rundownOuts = rundownOuts
  state.tagOut = tagOut
  state.relayFlag = relayFlag
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
    tagOut: state.tagOut,
    throwBase: state.firstThrowBase,
    throwArrivalTick: state.firstThrowArrivalTick,
    voidedRuns: held.heldRuns + (held.scoreboardRuns - runsScored),
    fumbled: state.fumbled,
    errantThrow: state.errantThrow,
    specialDefense: state.specialDefense,
    laserThrow: state.laserThrow,
    rundowns: state.rundowns,
    rundownOuts: state.rundownOuts,
    // 진행기 주자 배열이 곧 원본 목록 순서다 — 0 = 타자주자, 그 뒤 찬 루 오름차순 (`createPlayRunners`)
    runnerFates: runners.map((runner) => runnerFateOf(runner.state)),
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
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
const MINIMUM_THROW_DISTANCE = 600

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
  // 0xb2c90 이 세운 "공 들고 루로" (AI 상태 6 · vt48(루)) · 0xb203a 가 세운 키스톤 야수 자리(AI 0xa) — 목표점으로 걷는다
  if (fielder.aiState === AI_STATE.CARRY || (fielder.aiState === AI_STATE.BUSY && fielder.slot !== input.chaserSlot)) {
    if (isSamePoint(fielder.position, fielder.target)) return fielder
    return { ...fielder, position: stepToward(fielder.position, fielder.target, fielder.speed) }
  }
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
  /** 공 가진(마지막으로 쥔) 야수 P+0x130 */
  readonly holderSlot: number
  /** 지금 누가 쥐고 있나 P+0x12c */
  readonly held: boolean
  readonly throwBase: number
  readonly throwArrivalTick: number
  readonly throwFromSlot: number
  /** 공이 손을 떠난 틱 */
  readonly throwReleaseTick: number
  /** 아무도 잡지 않는 타구인가 — 그러면 공은 끝까지 궤적 위에 있다 */
  readonly uncatchable: boolean
}

/** 이번 틱에 공이 어디 있나 — 포구 전에는 궤적, 송구 중에는 송구선 위, 그 밖에는 쥔 야수 손 */
function ballPointAt(input: BallPointInput): WorldPoint {
  if (input.uncatchable) return input.trajectory.pointAt(input.tick)
  if (input.tick < input.catchTick) return input.trajectory.pointAt(input.tick)
  const holder = input.fielders[input.holderSlot] ?? input.fielders[0]
  const flying =
    input.throwArrivalTick >= 0 &&
    input.throwBase !== NONE &&
    input.tick >= input.throwReleaseTick &&
    input.tick < input.throwArrivalTick
  if (!flying) {
    // 받은 야수가 없는 송구(악송구)는 루 자리에 떨어진 것으로 그린다 (근사)
    if (!input.held && input.throwArrivalTick >= 0 && input.throwBase !== NONE) return basePosition(input.throwBase)
    return holder.position
  }

  const from = input.fielders[input.throwFromSlot]?.position ?? holder.position
  const to = basePosition(input.throwBase)
  const whole = input.throwArrivalTick - input.throwReleaseTick
  if (whole <= 0) return to
  const done = input.tick - input.throwReleaseTick
  return {
    x: from.x + Math.trunc(((to.x - from.x) * done) / whole),
    // 송구는 낮은 포물선으로 본다 (근사) — 화면이 공 크기를 고를 때만 쓴다
    y: Math.trunc((1200 * done * (whole - done)) / (whole * whole)),
    z: from.z + Math.trunc(((to.z - from.z) * done) / whole),
  }
}

/** CPU 홈 특수 송구가 0xa1620 에 무엇을 넘기는가 (`cpuSpecialThrowOf`) */
interface CpuSpecialThrow {
  /** 계획 [1] — 0xa1620 다섯째 인자. 거짓이면 특수 굴림이 아무 효과도 없다 */
  readonly special: true
  /** 거리 상한(20400)을 넘어 원바운드로 던진다 — 악송구 굴림을 건너뛴다 */
  readonly bounce: boolean
  /** 송구 속도 +0xdc 를 +0xd8(= +0xd4 × 130%)로 바꿔 끼운 던지는 야수 (`thrownWith`) */
  readonly thrower: FielderState
}

const NO_CPU_SPECIAL_THROW = { special: false, bounce: false } as const

/**
 * **CPU 홈 송구 20% 특수 송구의 효과** — `0xafa60` 이 굴린 특수 값이 어디까지 내려가는가 (직접 뜬 것).
 *
 * ```
 * afad2: b == 0 이면 r6 = (rand(0,100) ≤ 19)          ; 0xbfa54, 홈이 아니면 굴림 없음
 * afae6: 플레이.vt58(b, r6)                            ; = 0xb2c90
 * b2c9e: [sp+0x1c] = 특수
 * b2cc4: C = +0xf0[b] ; C == −1 → 공 가진 야수가 직접 들고 뛴다(특수 버려짐)
 * b2de8: 플레이.vt5c(C, [sp+0x1c])                      ; = 0xb2e38
 * b2e78: 플레이.vt8c(결과, 플레이, 던지는야수, C, 특수)   ; = 0xb3444 송구 계획 → +0x14c..+0x153
 * b3528: 외야수(칸>5) && 특수 → 중계 안 함
 * b368a: [1] = 외야수(+0x88 > 5) && 특수 && 송구틱(vtb8) > 0x11
 * b2f06: +0x1f4(사람 레이저) == 0 이면 던지는야수.vtac(받는야수 +0x2c 목표점, [+0x14d] = [1])  ; = 0xa1620
 * a165c: 특수 → 야수+0xe8 = 4
 * a16be: 특수 && 거리 > cfg(17000)×120/100 → 거리 = 상한, 원바운드 표시
 * a16dc: +0xdc(송구 속도) = 특수 ? +0xd8 : +0xd4      ; 0xa0fc4: +0xd8 = +0xd4 × 130 / 100
 * a17fc: 원바운드면 +0xc0 = 4, 각도 ±1 (0xbfaa0 = rand(0,2)) → **악송구 굴림 건너뜀**
 * a1828: 아니면 악송구 굴림 기준 = +0xe4 + 특수×100 + 100 (`rollThrowError`)
 * ```
 * 곧 **"레이저급 속도"는 맞다** — 다만 계획 [1] 을 거치므로 **외야수가, 중계 없이, 17틱 넘게 걸리는
 * 홈 송구**일 때만 효과가 난다. 내야수의 홈 송구는 20% 를 맞혀도 아무 차이가 없다(굴림만 먹는다).
 *
 * **근사**: 원본은 0xb2c90 이 실패하면(직접 뛰는 게 빠름·거리 ≤ 600) 다음 틱에 `0xafa60` 이 다시 돌아
 * 또 굴린다. 웹 진행기는 송구를 잡는 틱에 한 번만 정하므로 굴림도 한 번이다.
 * 원바운드 거리는 웹 관례대로 수평 거리로 잰다(원본 0xbf9f1 은 던지는 쪽 높이 1000 을 넣는다).
 */
export function cpuSpecialThrowOf(
  fielders: readonly FielderState[],
  throwerSlot: number,
  receiverSlot: number,
): CpuSpecialThrow | typeof NO_CPU_SPECIAL_THROW {
  if (receiverSlot === NONE) return NO_CPU_SPECIAL_THROW
  const plan = planThrow({ fielders, fromSlot: throwerSlot, finalSlot: receiverSlot, base: 0, special: true })
  if (!plan.special) return NO_CPU_SPECIAL_THROW
  const holder = fielders[throwerSlot]
  return {
    special: true,
    bounce: horizontalDistance(holder.position, fielders[receiverSlot].target) > BOUNCE_THROW_DISTANCE,
    thrower: thrownWith(holder, true),
  }
}

/**
 * 악송구 도착 틱 — 던지는 야수의 남은 동작 틱(+0xc8) + `errantThrowFlight`(0xa1620 악송구 갈래)의 틱.
 * 공을 쏘는 점은 송구 계획 0xb3444 의 [3](받는 야수 — 중계면 중계맨)의 목표점이다 (b2ea8 → b2f52 vtac).
 */
export function errantArrivalTicks(
  fielders: readonly FielderState[],
  fromSlot: number,
  coverSlot: number,
  base: number,
  special: boolean,
  error: ThrowErrorResult,
  random: RandomPort,
): number {
  const thrower = fielders[fromSlot]
  const plan = planThrow({ fielders, fromSlot, finalSlot: coverSlot, base, special })
  const target = fielders[plan.toSlot]?.target ?? basePosition(base)
  return Math.max(1, thrower.actionRemainingTicks + errantThrowFlight(thrower, target, error, random).ticks)
}

/**
 * 특수 송구의 도착 틱 — `defenseArrivalTicks`(0xaf284) 의 "커버 있음" 갈래를 **중계 없이,
 * 속도만 +0xd8 로 바꿔** 그대로 따른다 (특수면 0xb3444 가 중계를 끼우지 않는다).
 */
export function specialThrowArrivalTicks(context: DefenseContext, base: number, thrower: FielderState): number {
  const { play, fielders } = context
  const cover = fielders[play.coverOfBase[wrapBase(base)] ?? NONE]
  if (cover === undefined) return defenseArrivalTicks(context, base)
  let ticks = throwTicksToFielder(thrower, cover)
  let remaining = 0
  if (!thrower.holdingBall) {
    remaining = play.catchTick - context.currentTick
    ticks += readyTicksOf(thrower.slot)
  } else {
    ticks += thrower.actionRemainingTicks
  }
  ticks = Math.max(ticks, ticksToReach(cover.position, basePosition(base), cover.speed) - remaining)
  return remaining + ticks
}

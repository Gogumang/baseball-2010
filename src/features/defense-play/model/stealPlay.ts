import type { RandomPort } from '@/shared/api/random/randomPort'
import { basePosition, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
  initialPlayView,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { PICKOFF_COVER_OF_BASE } from '@/entities/fielding/model/pickoff'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { STEAL_PLAY_KIND, stealTargetBaseOf, type StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { ManualAutoMode } from '@/entities/settings/model/gameSettings'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import {
  RUNNER_PLAY_RESULT,
  runRunnerPlay,
  type RunnerPlayEngineResult,
  type RunnerPlayResultCode,
} from '@/features/defense-play/model/runnerPlayEngine'

/**
 * **도루 한 판** — 플레이 종류 5(주자만)를 틱 단위로 돌린다.
 *
 * 사람 경기의 도루는 표 굴림이 아니다. 도루 메시지 0x583 이 주자를 **출발만** 시키고
 * (`entities/fielding/model/stealStart` — 0xa9bd4), 투구가 끝나면 상태 0x12 진입 0x3dfac 가
 * `state[0x24]`(도루 중)를 보고 **종류 5 · 상태 0x17** 을 연다(0x3e0e4~0x3e116). 그 판에서
 * 포수 송구와 주자 도착이 겨뤄 세이프(결과 9) · 도루사(13)가 갈린다.
 *
 * ## 시작 0xb2950 (플레이 vt 0x18 의 종류 5 가지, 직접 뜬 것)
 * ```
 * b2950: 플레이.vt1c() ; 플레이.vt20(0)
 * b2966: P+0x130 = 1                          ; 공 가진 야수 = 포수
 * b2970: 0xa276c(공, 종류)                     ; 종류 5 면 공 첫 점 = 0xd7c30 = (20000, 0, 29705) = 포수 자리
 * b297a: for b = 0..3: 야수(b+1) → 루 좌표 0xd86b0[b] (0xbef59) ; P+0xf0[b] = b+1   ← 견제(0xb28be)와 같은 고리
 * b29b4: 플레이.vt24(0) ; vt34(=0xb3b38 고르기) ; vt30(=0xb1c90 송구/커버)
 * b29d4: 0xb2710(P, 1, 0)                      ; ★ 포수가 공을 쥔다 — 셋째 인자 0 이라 준비 틱을 안 넣는다
 * b29de: 포수.vt88(0)                           ; 야수+0xc8 = 0 (0xa0ed8) — 곧바로 던질 수 있다
 * ```
 * - 공 쥐기 0xb2710 이 `+0x112 = 1`(이미 잡힘) · `state[0x1e] = 1` 을 세우므로 뜬공 아웃(결과 1)은 없고,
 *   홈에 들어온 주자는 2아웃 보류 규칙을 탄다.
 * - 커버: `0xb1c90` 은 부를 때마다 `+0xf0` 을 표 `0xd8774` = [1, 2, 3, 4] 로 되돌린 뒤 고친다. 2루는
 *   공 첫 점(포수 자리)이 0xd8758 (20000, 1000, 30000) 과 달라 `0xb1e86` 의 "2루에 더 가까운 쪽(2루수 3 ·
 *   유격수 5)" 갈래로 가는데, 2루수가 이 고리에서 이미 2루로 가고 있어 늘 2루수다. 1·3루는 표 그대로.
 *   ⚠️ 홈 커버만 미해결이다 — 포수의 AI 상태(0xb3b38 고르기가 세우는 값)에 따라 포수(1) 그대로이거나
 *   투수(0)/없음(−1)으로 바뀐다(0xb1d14~0xb1d94). 홈으로 던질 일은 공 쥔 포수가 홈에 있는 홈 도루뿐이고,
 *   그때는 어느 쪽이든 송구 없이 포수가 홈에서 태그하는 같은 판이라 [1, 2, 3, 4] 로 둔다.
 *
 * ## 판정
 * - 송구 판단·도착·아웃·세이프는 `runnerPlayEngine` (0xb1c90/0xafa60 → 0xb2c90 · 0xb36d0 · 0xb4292).
 *   도루 주자는 밀린 주자가 아니라 **태그(≤499)** 로만 죽는다.
 * - 세이프 = 커버가 루 위에서 공을 받는 틱에 그 루의 주자가 이미 닿아 있다 → 결과 9 → 콜 17.
 * - 송구가 없으면(자동 규칙 0xb1c90 이 "잡을 수 있는 루" 를 못 찾음) 결과 코드 없이 주자가 그대로 간다.
 *
 * - CPU 수비(또는 송구 설정 자동)의 송구 목표는 `throwTargetBase.chooseThrowTargetBase`(0xafb24) — 후보표 칸이
 *   +0x7c(달려가는 루)라 도루 주자는 **다음 루** 칸에 든다. 리드 뒤엔 대개 잡을 루가 없어 던지지 않는다.
 * - 사람 수비가 키를 안 누르면 `throwArrival.autoThrowTargetBase`(0xb1c90) — 잡을 주자가 없어도 마지막으로 본
 *   산 주자의 루가 남아(b2036) 그 루로 던진다.
 *
 * ## 1·2루 도루는 원본에서도 (거의) 늘 세이프다 — 수식
 * 같은 단위(틱, 월드 좌표)로 원본 값만 놓고 셈한다.
 * - 루 사이 D = |0xd86b0[1]−0xd86b0[2]| = |0xd86b0[2]−0xd86b0[3]| = 7772.
 * - 주자 한 틱 = 속도 +0x3c = 300 + ⌊주루×7/100⌋(+팀 등급) — 루에 세울 때 0xa93ac(a94a6 vt64 → 0xbec7c)가 넣고,
 *   리드 틱 0xa01cc → 0xbf094 → vt30 0xbf0dc → vt24 0xbf158 이 그 값만큼 옮긴다(가속·대기 없음 — +0xba 흔들기
 *   갈래 a01ea 는 아웃 주자(+0x96) 전용 0xaa008 → 0xa03ac 만 켠다). 그래서 s ≥ 300.
 * - 리드 L = 0xcffa8[b] + max(rand(0,9), 3) — rand(0,9) 는 0xbfa54 로 0~8 → 1루 18~23 · 2루 17~22 틱.
 * - 판이 열린 뒤 주자 도착 T_run = ⌈D/s⌉ − L ≤ ⌈7772/300⌉ − 18 = 8 (1루) · 26 − 17 = 9 (2루, 주루 0 일 때).
 *   주루 500(s = 335)이면 ⌈23.2⌉ = 24 − L → 1루 1~6 · 2루 2~7 틱.
 * - 포수 송구: 공 첫 점 = 포수 자리 (20000, 29705)(0xd7c30), 준비 0(vt88(0)). 송구 틱 0xa1adc 는 공 속도
 *   v = +0xdc(= 940 + 8(등급+1) + 팀 보너스, 특수면 130%)로 쏜 포물선의 수평 성분으로 나눈 값이라
 *   **T_throw ≥ 거리 / v** 다. 2루까지 10535 · 3루까지 8119 → 보통 송구(v ≤ 1004 + 보너스)면 2루 ≥ 10.5 · 3루 ≥ 8.1 틱.
 * → 1루 도루는 T_run ≤ 8 < T_throw 로 **늘 세이프**(v < 1317 인 한). 2루 도루도 주루 ≥ 158(s ≥ 311 → T_run ≤ 8)이면
 *   늘 세이프이고, 그 아래에서만 리드 굴림·포수 등급에 따라 한 틱 안팎으로 겨룬다.
 *   CPU 수비(0xafb24 점수식)는 잡을 루가 없어 송구조차 안 한다. 웹 3000판 결과(1·2루 2996 세이프 · 4 폭투)와 같다.
 * - 홈 도루는 공 쥔 포수가 처음부터 홈 옆에 있어(260) 주자가 닿기 전 태그(≤499)로 잡힌다 — 주루 700 이상에서만 일부 세이프.
 *
 * ## 난수 — 이 판이 굴리는 것
 * 판이 열릴 때 도루 주자마다 리드 덧틱 `rand(0,9)` 한 번(`0x3d7b8`, 주자 목록 차례). 그다음 송구가 나갈 때
 * 악송구 굴림(0xa1828) 한 번(악송구면 +2). CPU 송구가 홈을 고르면 그 앞에 특수 송구 굴림 `rand(0,100)` 한 번.
 *
 * ## 주자의 출발 시각 — 판이 열릴 때 이미 달려 나가 있다 (확정, `entities/fielding/model/runnerLead`)
 * 도루는 투구 중(상태 0x11, CPU 는 그 10번째 틱)에 걸고 판은 공이 도착한 뒤(0x12 → 0x17) 연다.
 * 그 사이 주자 틱(vt0xc = 0xa01cc)은 **한 번도 안 돈다** — 주자·야수 틱 고리 `[장면+0x1e4].vt8` 은
 * 공용 갱신 0x3f060 이 상태 0x17 에서만 부른다(0x3f0c6). 대신 상태 0x17 진입 `0x46418` 이 플레이 시작
 * (0xb2950) 뒤 주자마다 `0x3d7b8` 을 불러 **틱을 몰아서 돌린다**:
 * - 도루 주자: 루 좌표에서 다음 루로 `0xcffa8`[루] = 15(1루)·14(2·3루) + max(rand(0,9), 3) 틱
 * - 도루 안 한 주자: 다음 루로 `0xcffb0`[루] = 6·13·7 틱(번트 종류가 서 있으면 +3) 간 뒤 **목표를 제 루로 되돌린다**
 *   — 판이 열리면 제 루로 돌아오는 중이라 그 루로 공이 가면 태그될 수 있다.
 */
export interface StealPlayInput {
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 출발한 주자들의 루 — 0xa9bd4 가 받아들인 것만 (`canStartSteal`) */
  readonly stealingFrom: readonly StealBase[]
  /**
   * state[6] — 판이 열릴 때의 아웃 수 = **이 투구 전의 아웃 수**. 0x3dfac 는 투구 판정 v 를 판정 칸
   * `[scene+0x10ac]` 에 적어 둘 뿐 아웃은 올리지 않고 곧장 상태 0x17 로 간다 — 1아웃 이하 삼진이면
   * 그 삼진 아웃은 판이 끝난 뒤 판정 칸을 읽는 쪽이 올린다(읽는 자리는 안 떴다 — 유력).
   */
  readonly outs: number
  /** 수비 9명 능력치 (칸 순서) */
  readonly defenseAbilities?: readonly number[]
  /** 주자 주루 능력치 — 루별로 줄 수 있다. 없으면 `runAbility` */
  readonly runAbilities?: Partial<Record<1 | 2 | 3, number>>
  readonly runAbility?: number
  /** 주자 속도에 더하는 팀 등급 (전역 모드 1·2·8 에서만, R3 4절) */
  readonly runnerTeamGrade?: number
  /** 장면 +0xfdc — 이번 투구의 번트 종류 (도루 안 한 주자의 리드 +3, `0x3d7b8`). 기본 0 */
  readonly buntKind?: number
  /** 주면 악송구(0xa1828)·특수 송구(0xafa60) 굴림이 돈다 */
  readonly random?: RandomPort
  readonly defenseIsCpu?: boolean
  /** 송구 설정 +0xf4 (기본 수동) */
  readonly throwMode?: ManualAutoMode
  /** 사람이 방향키로 고른 송구 루 (+0x160). 안 주면 자동 규칙 */
  readonly manualThrowBase?: number
  readonly offenseIsCpu?: boolean
  /** 주루 설정 +0xbd (기본 자동) */
  readonly runningMode?: ManualAutoMode
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
}

export interface StealPlayResult extends RunnerPlayEngineResult {
  readonly stealingFrom: readonly StealBase[]
  /** 루를 옮긴 도루 주자의 출발 루 (정산 0xa8024 @a83c6 — 잡힌 주자가 없을 때만 기록 8) */
  readonly stolenFrom: readonly StealBase[]
  /** 잡힌 도루 주자의 출발 루 (@a83de — 기록 24) */
  readonly caughtFrom: readonly StealBase[]
}

const DEFAULT_ABILITY = 500
const CATCHER_SLOT = 1

export function runStealPlay(input: StealPlayInput): StealPlayResult {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const covers = [...PICKOFF_COVER_OF_BASE]

  // ── b297a: 야수 1~4 를 제 루로 · 커버 = 루 + 1 ──
  const fielders: FielderState[] = createFielders(abilities).map((fielder) => {
    const base = covers.indexOf(fielder.slot)
    if (base < 0) return fielder
    return {
      ...fielder,
      target: basePosition(base),
      targetBase: base,
      aiState: AI_STATE.COVER_HOME + base,
      // b29d4·b29de: 포수가 공을 쥐고(0xb2710 → 야수+0xe0 = 1) 준비 틱은 0 (vt88(0) → +0xc8 = 0)
      holdingBall: fielder.slot === CATCHER_SLOT,
      actionRemainingTicks: 0,
    }
  })
  const play: PlayView = {
    ...initialPlayView(STEAL_PLAY_KIND),
    coverOfBase: covers,
    ballHolderSlot: CATCHER_SLOT,
    catchFielderSlot: CATCHER_SLOT,
  }

  // ── 주자 목록 — 찬 루 오름차순(0xa9a10), 타자주자 없음(0x46418: state[0x11] · 종류 2·3 · state[0x1a] 가 아님) ──
  const runners: RunnerState[] = []
  ;([1, 2, 3] as const).forEach((base) => {
    const occupied = base === 1 ? input.bases.first : base === 2 ? input.bases.second : input.bases.third
    if (!occupied) return
    const ability = input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY
    const speed = runnerSpeedOf(ability, input.runnerTeamGrade ?? 0)
    const runner = createRunner(runners.length + 1, base, speed, { isBatterRunner: false })
    // 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞
    const stealing = input.stealingFrom.includes(base)
    const started = stealing ? { ...runner, targetBase: stealTargetBaseOf(base) } : runner
    // 0x46418 → 0x3d7b8: 플레이 시작 뒤 주자 목록 차례로 리드 틱을 몰아서 돌린다 (도루 주자는 rand(0,9) 한 번)
    const lead = runnerLeadOf(started, {
      playKind: STEAL_PLAY_KIND,
      stealing,
      buntKind: input.buntKind,
      random: input.random,
    })
    runners.push(applyRunnerLead(started, lead))
  })

  const result = runRunnerPlay({
    kind: STEAL_PLAY_KIND,
    fielders,
    // b29d4: 0xb2710(P, 1, 0) — 엔진이 첫 틱 앞에서 쥐게 하려고 쥠 칸을 세워 둔다
    play: { ...play, held: true, everHeld: true },
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: true,
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

  const stolenFrom: StealBase[] = []
  const caughtFrom: StealBase[] = []
  result.runnerFates.forEach((fate) => {
    const from = fate.fromBase
    if (from !== 1 && from !== 2 && from !== 3) return
    if (!input.stealingFrom.includes(from)) return
    if (fate.retired && !fate.scored) caughtFrom.push(from)
  })
  // 잡히지 않은 도루 주자는 다음 루 이상에 닿았다 — 목표 루에 닿기 전엔 판이 안 끝난다
  for (const from of input.stealingFrom) {
    if (caughtFrom.includes(from)) continue
    stolenFrom.push(from)
  }
  return { ...result, stealingFrom: [...input.stealingFrom], stolenFrom, caughtFrom }
}

/**
 * 도루 판이 끝난 뒤의 콜 — 결과 9 면 **늘 17**(0x51c14 머리 세 줄이 종류 4·5 를 따로 빼 다른 검사 없이 17),
 * 13 이면 state[0x87](마지막 판정이 태그) 이 서 있으니 62, 아니면 20 (0x51b36). 결과 코드가 없으면 소리도 없다.
 */
export function stealCallSoundIdOf(result: Pick<StealPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === RUNNER_PLAY_RESULT.SAFE) return SAFE_CALL
  if (result.resultCode === RUNNER_PLAY_RESULT.OUT) return result.tagOut ? CAUGHT_OUT_CALL : FORCE_OUT_CALL
  return null
}

const SAFE_CALL = 17
const CAUGHT_OUT_CALL = 62
const FORCE_OUT_CALL = 20

/** 재생 칸에 든 결과가 도루 판인가 */
export function isStealPlayResult(result: DefensePlayResult | null): result is StealPlayResult {
  return result !== null && 'stealingFrom' in result && 'resultCode' in result
}

export type { RunnerPlayResultCode as StealResultCode }

import { batterBoxPosition, createRunner } from '@/entities/fielding/model/fieldingState'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { stealTargetBaseOf } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import { BATTED_BALL_PLAY_KIND, HOME_BASE } from '@/features/defense-play/model/defensePlay/constants'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
import type { MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * 주자들을 세우면서 **포스 사슬**을 잇는다 — 이 진행기의 포스는 `0xaf918`(자동 진루 제어기)이 아니다.
 *
 * 원본에는 "이 타구는 2루타" 같은 결과 코드가 없다. 타자주자가 2루까지 가면 그게 2루타다.
 * 그래서 원본의 포스 사슬 머리는 **언제나 "타자주자가 1루로 간다"** 한 칸이고,
 * 그 뒤는 루가 이어 차 있는 만큼만 밀린다. 그리고 원본은 **한 루에 산 주자를 둘 놓지 않는다** —
 * "루 b 의 주자" `0xa97a0` 이 `+0x8c`(목표 루) == b 인 주자를 **하나만** 집어 오고,
 * 주루 키의 앞길·뒷길 검사(`0xa99a8` · `0xa9924`, 0xa9b04 에서 부른다)가 겹치는 루로는 못 보낸다 (I 3b).
 *
 * 그래서 **최소 진루 루 = min(홈, max(출발 루, 1 + 목록 번호))** 로 잇는다. 목록은 타자주자(0)부터
 * 앞선 주자 쪽으로 빈 루를 건너뛰며 쌓이므로, 번호 k 는 "타자주자 앞으로 k 번째 주자" 다. 목록은 오름차순이라
 * `출발루[k] ≥ k` 이고, 밀리는 조건 `1 + k > 출발루[k]` 는 `출발루[k] == k`, 곧
 * "1루부터 내 앞까지 빈 루 없이 차 있다" 와 같은 말이다(0xa9f60).
 * (예전 웹은 타석 결과 코드가 준 최소 루 M(2·3루타)을 사슬 머리로 썼다 — 결과를 먼저 정한 웹 다리라 걷었다.)
 *
 * 포스로 밀리는(최소 루가 출발 루보다 큰) 주자만 첫 틱부터 뛴다.
 * 나머지는 루에 붙어 있다가 자동 진루(0xaf918)가 보내 준다 — 그쪽은 **주루 수동이면 안 돈다**.
 */
export function createPlayRunners(
  bases: BaseState,
  speedOf: (fromBase: number) => number,
  firstBaseException: FirstBaseException | null = null,
  batterHand: number | undefined = undefined,
): MutableRunner[] {
  // 포스 사슬 머리 — 타자주자는 1루로 간다 (0xa93ac 가 +0x88 = 1)
  const batterMinimum = 1
  // 0 = 타자주자. 그 뒤는 **뒤 주자 → 앞선 주자** 순서다 (자동 진루가 목록 끝부터 = 앞선 주자부터 본다)
  const fromBases = [0]
  if (bases.first) fromBases.push(1)
  if (bases.second) fromBases.push(2)
  if (bases.third) fromBases.push(3)
  const pushed = firstBaseException === null ? null : pushedRunnersWithFirstBaseException(fromBases, firstBaseException)
  return fromBases.map((fromBase, index) => {
    // 홈보다 더 갈 곳은 없다 — 사슬이 만루 + 3루타처럼 넘치면 전부 홈에서 멈춘다
    const chained = Math.min(HOME_BASE, Math.max(fromBase, batterMinimum + index))
    const minimumBase = minimumBaseOf(chained, pushed, index, fromBase)
    const targetBase = minimumBase > fromBase ? fromBase + 1 : fromBase
    // 타자주자 0xa93ac a9446 → vt94 0xa0884: 위치(+0x20)는 타석 자리다(`batterBoxPosition`). 구간 출발점(`legStart`)은 홈으로 둔다 —
    // 웹 진행률(`progressPercent`)의 분모 자리이고, 원본 진행률 vt90 0xa04e8 은 거리(루[+0x8c] = 홈, 루[+0x7c])로 잰다
    const batterBox = index === 0 && batterHand !== undefined ? { position: batterBoxPosition(batterHand) } : {}
    return {
      state: createRunner(index, fromBase, speedOf(fromBase), { targetBase, isBatterRunner: index === 0, ...batterBox }),
      minimumBase,
      previousTarget: fromBase,
      counted: false,
      arrivedThisListTick: false,
    }
  })
}

/** 포스 최소 루 — 1루 주자 예외 판이면 예외 셈(`pushed`)이 밀린 주자만 한 루 앞, 아니면 포스 사슬(`chained`) */
function minimumBaseOf(chained: number, pushed: readonly boolean[] | null, index: number, fromBase: number): number {
  if (pushed === null || index === 0) return chained
  return pushed[index] ? fromBase + 1 : fromBase
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
 * 정정: S8 6-3 의 "0x46418 의 주자 움직임은 0x46664 걷기 루프뿐" 은 이 고리를 놓친 것이다.
 */
export function leadRunnersForBattedBall(runners: readonly MutableRunner[], input: DefensePlayInput): void {
  // 주자 목록 차례 그대로 — 도루 주자의 rand(0,9) 가 이 차례로 굴린다
  for (const runner of runners) {
    const base = runner.state.startBase
    if (runner.state.isBatterRunner || base < 1 || base > 3) continue
    rollRunnerLead(runner, input)
  }
}

/**
 * 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞.
 * 0x4653e 주자관리.vt1c(0xa9e44): 2아웃이면 종류 1 에서 모든 주자에게 다음 루(+0x7c = +0x8c + 1 · vt48)
 * — 포스(0xa9f60)·도루가 아니어도 (a9eb4 r6 = 아웃 == 2 → a9efa 종류 1 갈래)
 */
function rollRunnerLead(runner: MutableRunner, input: DefensePlayInput): void {
  const base = runner.state.startBase
  const isStealing = (input.stealingFrom ?? []).includes(base)
  const runsOnContact = isStealing || (input.outs === 2 && runner.state.targetBase === base)
  const started = runsOnContact ? { ...runner.state, targetBase: stealTargetBaseOf(base) } : runner.state
  const lead = runnerLeadOf(started, { playKind: BATTED_BALL_PLAY_KIND, stealing: isStealing, buntKind: input.buntKind, random: input.random })
  runner.state = applyRunnerLead(started, lead)
}

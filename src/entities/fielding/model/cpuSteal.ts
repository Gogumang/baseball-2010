import type { RandomPort } from '@/shared/api/random/randomPort'
import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import type { BaseState } from '@/entities/game/model/baseState'
import type { StealBase } from '@/entities/fielding/model/stealStart'

/**
 * **CPU 도루 판정 0x520de** — 사람이 수비(투구)할 때 CPU 공격이 도루를 거는가 (Q1 3a, 직접 다시 뜬 것).
 *
 * ## 언제 굴리나 — 0x537dc (CPU 조작 객체, 경기 장면 상태 0x11 = 공이 날아가는 동안)
 * ```
 * 53874: 상태([조작+0x14]) == 0x11 → 0x537dc
 * 537de: [조작+0xc] == 0 일 때만
 * 537e6:   [조작+0x18](이 상태의 틱) == 11 → 메시지 0x6a9 (타자 결정 0x34334)
 * 537fa:   [조작+0x18] == 10 → 메시지 0x583, 인자 −1      ← 도루
 * ```
 * 곧 **투구마다 한 번, 상태 0x11 의 10번째 틱**(타자 결정 바로 한 틱 앞)에 굴린다.
 * (`[조작+0xc]` 는 조작 객체의 칸 — 0 일 때만 보낸다. 칸 이름은 미확인.)
 *
 * ## 0x520de (메시지 0x583 처리)
 * ```
 * 520e6: 플레이+0x111 ≠ 0 → 끝
 * 520fc: state[0x31 + state[9]] == 1 (공격이 CPU) 이면:
 * 52120:   3루 주자 && 2루 주자 → 끝                      ; 2·3루 · 만루는 안 뛴다
 * 5213c:   0xa990d(살아 있는 주자 수) == 0 → 끝
 * 52148:   2루 주자 → 대상 2, 줄 1 ; 1루 주자도 있으면 줄 2
 * 5216c:   아니고 1루 주자 → 대상 1, 줄 0                 ; 1·3루도 여기 — 1루 주자만 뛴다
 *          (3루 단독이면 대상이 0 으로 남아 0xa97a0(관리, 0) 이 없음 → 끝)
 * 5217c:   r = 0xa97a0(관리, 대상) ; 없으면 끝
 * 5218c:   칸 = min(r.vt64() ÷ 250, 3)                    ; vt64 = 0xa092c = 주자+0xa4 + cfg+0x14(300)
 * 521a6:   rand(0, 1000) > 표 0xd047c[줄×4 + 칸] → 끝     ; `cmp 표, r ; bge 뛴다`
 *          그 밖이면 인자 = 대상
 * 521c4: (공통) 0x457cc ; … ; 0xa9bd4(주자관리, 인자)      ; 출발 — `stealStart.canStartSteal`
 * ```
 * - 표 0xd047c (바이트로 직접 읽음): 줄0(1루 주자) `5 10 40 100` · 줄1(2루 단독) `2 4 12 20` · 줄2(1·2루) `1 2 5 15`.
 * - ⚠️ **원본 그대로(버그 후보)**: 칸 = 주자 속도 ÷ 250 인데 주자 속도는 300 + 주루×7÷100 (+팀 등급 0~7)
 *   = 300~383 이라 **늘 1** 이다. 그래서 주루와 무관하게 1루 주자 11/1000 · 2루 단독 5/1000 · 1·2루 3/1000
 *   (`표 ≥ rand`, rand 는 이 저장소 관례대로 [0, 1000) → (값 + 1)/1000) = Q1 의 1.1% · 0.5% · 0.3%.
 *   표의 칸 0·2·3 은 죽은 칸이다 — 고치지 않는다.
 * - 투수·포수 능력, 볼카운트, 아웃, 점수, 이닝은 보지 않는다.
 * - 간이 엔진 도루(0xc1818 · 표 0xd9064, `entities/game/model/steal`)와는 완전히 다른 길이다.
 */

/** 상태 0x11 안에서 CPU 가 도루 메시지를 보내는 틱 (`[조작+0x18] == 10`) */
export const CPU_STEAL_DECISION_TICK = 10
/** 같은 자리의 타자 결정 틱 (`[조작+0x18] == 11` → 0x6a9) — 차례를 맞출 때 참고 */
export const CPU_BATTER_DECISION_TICK = 11

/** 표 0xd047c — 4칸씩 3줄, 확률 = (값 + 1) / 1000 */
export const CPU_STEAL_TABLE: readonly (readonly number[])[] = [
  [5, 10, 40, 100],
  [2, 4, 12, 20],
  [1, 2, 5, 15],
]

const SPEED_COLUMN_DIVISOR = 250
const LAST_SPEED_COLUMN = 3
const RANDOM_LIMIT = 1_000

export interface CpuStealTarget {
  /** 뛸 주자의 루 */
  readonly base: StealBase
  /** 표 줄 — 0 1루 주자 · 1 2루 단독 · 2 1·2루의 2루 주자 */
  readonly row: number
}

/** 0x52120~0x5217c — 누가 뛸 후보인가. 난수를 안 쓴다 */
export function cpuStealTargetOf(bases: BaseState): CpuStealTarget | null {
  if (bases.third && bases.second) return null
  if (bases.second) return { base: 2, row: bases.first ? 2 : 1 }
  if (bases.first) return { base: 1, row: 0 }
  return null
}

/** 0x5218c — 표 칸 = min(주자 속도 ÷ 250, 3). 주자 속도는 0xa092c (`runnerSpeedOf`) */
export function cpuStealSpeedColumnOf(runnerSpeed: number): number {
  return Math.min(Math.trunc(runnerSpeed / SPEED_COLUMN_DIVISOR), LAST_SPEED_COLUMN)
}

export interface CpuStealInput {
  readonly bases: BaseState
  /** state[0x31 + state[9]] == 1 — 공격 팀이 CPU 인가. 아니면 사람 키 인자를 쓰는 길이라 여기서는 안 굴린다 */
  readonly offenseIsCpu: boolean
  /** 뛸 후보 주자의 주루 능력치 */
  readonly runAbilityOf: (base: StealBase) => number
  /** 주자 속도에 더하는 팀 등급 (전역 모드 1·2·8 에서만, R3 4절). 기본 0 */
  readonly runnerTeamGrade?: number
  /** 플레이+0x111 — 플레이가 끝남 표시가 서 있으면 아무것도 안 한다. 기본 거짓 */
  readonly playFinished?: boolean
}

/**
 * 0x520de 의 CPU 갈래 한 번. 뛰기로 했으면 그 주자의 루, 아니면 null.
 *
 * **난수 차례**: 후보가 있을 때만 `rand(0, 1000)` **한 번**. 후보가 없으면(빈 루 · 2·3루 · 만루 · 3루 단독)
 * 굴리지 않는다. 부르는 쪽은 상태 0x11 의 10번째 틱 = 같은 투구의 CPU 타자 결정(11번째 틱) **바로 앞**에서
 * 부르면 된다.
 *
 * 돌려받은 루는 그대로 `stealStart.canStartSteal` 을 거쳐(0xa9bd4) 출발시킨다 — CPU 가 고르는 후보는
 * 늘 앞 루가 비어 있어 거기서 떨어지는 일은 없다.
 */
export function rollCpuSteal(input: CpuStealInput, random: RandomPort): StealBase | null {
  if (input.playFinished === true) return null
  if (!input.offenseIsCpu) return null
  const target = cpuStealTargetOf(input.bases)
  if (target === null) return null
  const speed = runnerSpeedOf(input.runAbilityOf(target.base), input.runnerTeamGrade ?? 0)
  const column = cpuStealSpeedColumnOf(speed)
  const roll = random.rand(0, RANDOM_LIMIT)
  return CPU_STEAL_TABLE[target.row][column] >= roll ? target.base : null
}

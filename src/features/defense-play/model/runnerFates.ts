import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'
import type { AdvanceResult, BaseState } from '@/entities/game/model/baseState'
import { runnerCountOf } from '@/entities/game/model/baseState'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * **주자 목록 한 칸의 운명** — 플레이가 끝난 뒤 정산 `0xa8024` 가 주자 목록(`0xa9564(관리, i)`)을 돌며 읽는 두 바이트.
 *
 * ## 칸의 뜻 (직접 뜬 것 — 바이너리 전체에서 `+0x78` 기준 `+0x1d`·`+0x1e` 쓰기를 훑었다)
 * - **+0x95 = 득점 표시.** 1 을 쓰는 곳은 셋뿐이다:
 *   - `0x5200c` — 메시지 0x13 처리기 `0x51fb8`(점수 1 올리기, `0xb6a9c` → `0xa5c34`). 받은 주자 번호 i 가
 *     목록 크기보다 작을 때만(`0x51ffc cmp/bge`) 그 주자의 +0x95·+0x96 을 같이 세운다.
 *     주자 틱 `0xaa0a8` 의 홈 도착이 **바로 득점**일 때 `0xaa1b0` 에서 i 를 실어 보낸다.
 *   - `0xaa1cc` — 같은 홈 도착이 **2아웃 보류**(`state[0]++`)일 때. 점수판은 안 올리고 +0x95 만 세운다.
 *     보류는 3아웃이면 영영 안 풀려 날아가지만(`0xaa388`) **+0x95 는 그대로 남는다.**
 *   - `0xc10b8` — 간이 엔진 홈런 `0xc1054`(목록 전원 +0x95·+0x96). 사람 경기는 여기로 오지 않는다.
 *   0 으로 지우는 곳은 목록에 끼울 때(`0xa93e6`)·투구 전 다시 세울 때(`0xa9a78`)·`0xc1154` 다.
 * - **+0x96 = 처리 끝.** 아웃 판정 꼬리 `0xb371c`(state[7] = 1 과 함께, 아웃 카운트는 `0xb3700` 에서 +1)
 *   · 타자주자 아웃 `0xb3752` · 그리고 홈 도착 `0xaa1d6 → 0xa9520(관리, i)`(**두 길 모두**) 가 1 을 쓴다.
 *   그래서 홈을 밟은 주자도 +0x96 이 선다 — "아웃" 만이 아니다.
 *
 * ## 목록 순서
 * 투구 전 `0xa9a10` 이 찬 루를 **3 → 2 → 1 루 순으로 맨 앞에 끼워** `[1루, 2루, 3루]` 오름차순을 만들고,
 * 상태 0x17 진입 `0x46418` 이 `state[0x11] || 종류 ∈ {2, 3} || state[0x1a](0xb6c3c)` 이고 종류 ≠ 8 이면
 * 타자주자를 `0xa93ac` 로 **맨 앞에** 끼운다 (0x464a8~0x464da). 그래서 목록은 `[타자주자?, 1루?, 2루?, 3루?]` 다.
 *
 * ## 정산이 읽는 두 자리
 * - `0xa8c5c~0xa8c86` R+0x130(출루 허용) = **마지막 원소**의 `+0x96 == 0` (`baserunnerAllowedOfFates`)
 * - `0xa8ea4~0xa8f6e` R+0x128(실점) = +0x95 가 선 주자 수, 다만 `state[6] == 3` 이고 **목록 0번**의 +0x96 이
 *   서 있으면 하나도 안 센다 (`chargedRunsOfFates`)
 */
export interface RunnerFate {
  /** 투구 때 서 있던 루 (`+0x90`). 0 = 이번 타석의 타자주자 */
  readonly fromBase: number
  /** `+0x95` — 홈을 밟았다. 바로 득점·2아웃 보류 둘 다 선다 (보류가 3아웃으로 날아가도 남는다) */
  readonly scored: boolean
  /** `+0x96` — 처리 끝: 아웃이 됐거나 홈을 밟았다 */
  readonly retired: boolean
}

/** 진행기 주자 하나를 운명으로 — 웹 `isOut` 은 아웃만이라 홈 밟음(`scored`)을 더해 +0x96 을 만든다 */
export function runnerFateOf(runner: Pick<RunnerState, 'pitchBase' | 'scored' | 'isOut'>): RunnerFate {
  return { fromBase: runner.pitchBase, scored: runner.scored, retired: runner.isOut || runner.scored }
}

/** 투구 전 `0xa9a10` 이 세운 목록 — 찬 루 오름차순, 아직 아무 표시도 없다 */
function baseRunnersOf(bases: BaseState): RunnerFate[] {
  const fromBases: number[] = []
  if (bases.first) fromBases.push(1)
  if (bases.second) fromBases.push(2)
  if (bases.third) fromBases.push(3)
  return fromBases.map((fromBase) => ({ fromBase, scored: false, retired: false }))
}

/**
 * **수비 진행기를 돌리지 않는 결과**의 주자 운명 — 삼진·볼넷·사구·홈런.
 *
 * - **삼진**: `0xae24c` 가 판정 5 를 상태 0x17 없이 곧장 정산 `0xa8024` 로 보낸다(0xae360) → 타자주자가 목록에
 *   들지 않고, 루의 주자들은 아무 표시 없이 남는다.
 * - **볼넷·사구**: 판정 3(0x3e1ae)·4(0x3e1b4) 모두 플레이 종류 2(0x3e1cc) → 타자주자가 맨 앞에 든다.
 *   밀려난 주자만 한 루씩 가고(웹 `advanceRunners` 의 밀어내기와 같다), 만루면 3루 주자가 홈을 밟아
 *   주자 틱 `0xaa0a8` 이 +0x95·+0x96 을 세운다 (바로 득점이든 보류든 둘 다 선다).
 * - **홈런**: 원본은 홈런도 상태 0x17 로 넘어가 주자 전원이 홈을 돈다(`homeRunPlayback` 머리말) → 전원 +0x95·+0x96.
 *
 * 인플레이 타구(안타·아웃)는 진행기 결과의 `runnerFates` 를 써라. 여기 넘기면 빈 목록 대신 오류를 낸다.
 */
export function runnerFatesWithoutPlay(bases: BaseState, outcome: AtBatOutcome): RunnerFate[] {
  const onBase = baseRunnersOf(bases)
  switch (outcome.kind) {
    case '삼진':
      return onBase
    case '홈런':
      return [{ fromBase: 0, scored: false, retired: false }, ...onBase].map((fate) => ({
        ...fate,
        scored: true,
        retired: true,
      }))
    case '볼넷':
    case '사구': {
      // 1루부터 빈 루 없이 이어 찬 주자만 밀린다 — 만루일 때만 3루 주자가 홈을 밟는다
      const forcedHome = bases.first && bases.second && bases.third
      return [
        { fromBase: 0, scored: false, retired: false },
        ...onBase.map((fate) => (forcedHome && fate.fromBase === 3 ? { ...fate, scored: true, retired: true } : fate)),
      ]
    }
    case '안타':
    case '아웃':
      throw new Error('인플레이 타구의 주자 운명은 수비 진행기 결과(runnerFates)에서 온다')
  }
}

/**
 * **R+0x128(실점)에 이번 플레이가 더하는 수** — 정산 `0xa8024` 안 `0xa8ea4~0xa8f6e` (직접 뜬 것):
 * ```
 * a8eb2  주자+0x95 == 0 → 건너뜀
 * a8ec0  state[6] == 3 이고 0xa9564(관리, 0)+0x96 != 0 → 건너뜀       ; 목록 0번 = 타자주자(있으면)
 * a8ee4  P = 0xb8c44(수비 팀, 주자+0x30) ; 0 이면 건너뜀               ; 그 주자를 내보낸 투수
 * a8f04  0xa56dc(R, P, 0) 이면 P+0x22(실점)++
 * a8f3c  0xb6388(P)(+0xa 비트7) && 0xa56dc(R, P, 0) 이면 a8f56 R+0x128 += 1
 * ```
 * `outsAfterPlay` 는 그 플레이가 끝났을 때의 `state[6]` — 3아웃 정리(이닝 바꿈) **전**의 값이다.
 * 3아웃 검사는 `cmp r3,#3 ; bne` 로 **정확히 3** 일 때만 건다.
 *
 * 책임 투수(주자+0x30)·기록 대상 검사(0xb6388·0xa56dc)는 부르는 쪽 몫이다 — 미션 투수는 육성·명예 투수라
 * 비트7 이 서 있고 시작 주자도 지금 투수가 내보낸 것으로 적혀 득점 하나마다 1 이다(`pitcherRun` 주석).
 */
export function chargedRunsOfFates(fates: readonly RunnerFate[], outsAfterPlay: number): number {
  const first = fates[0]
  if (outsAfterPlay === 3 && first !== undefined && first.retired) return 0
  return fates.filter((fate) => fate.scored).length
}

/**
 * 정산 주자 루프가 실점을 매기는 주자의 **투구 때 루**(0 = 타자주자) — `chargedRunsOfFates` 와 같은 거르기(3아웃이고 목록 0번이
 * 끝났으면 하나도 없다). 그 주자의 책임 투수(주자+0x30)에게 +0x22 · 경기 기록 [2] 를 매긴다(`entities/game/model/runnerPitchers`)
 */
export function chargedFromBasesOfFates(fates: readonly RunnerFate[], outsAfterPlay: number): readonly number[] {
  if (chargedRunsOfFates(fates, outsAfterPlay) === 0) return []
  return fates.filter((fate) => fate.scored).map((fate) => fate.fromBase)
}

/**
 * **R+0x130(출루 허용)** — 정산 `0xa8c5c~0xa8c86`: 목록을 돌며 `r5 = (주자+0x96 == 0)` 을 루프 안에서
 * **새로** 매기므로 **마지막 원소 하나만** 본다. 목록이 비면 r5 = 0 그대로다(0xa8c2e).
 *
 * **고침(`bugfixes.json` B-37, 기본 켬)**: `movs r5,#0` 을 루프 밖으로 — 목록에 **안 끝난 주자가 하나라도** 있으면 선다.
 * 야수선택으로 타자주자만 살고 앞 주자가 죽은 판도 출루 허용이라 퍼펙트(state[0x88])가 깨진다. 굴림 없음.
 */
export function baserunnerAllowedOfFates(fates: readonly RunnerFate[]): boolean {
  // 고침(B-37): 목록 전체를 본다 — 산 주자가 하나라도 있으면 출루 허용 (야수선택으로 산 타자주자도)
  if (isBugFixed('B-37')) return fates.some((fate) => !fate.retired)
  const last = fates[fates.length - 1]
  return last !== undefined && !last.retired
}

/**
 * **타자주자가 살아남았나** — 정산 `0xa87ba~0xa87fa` 의 r5 (직접 뜬 것):
 * ```
 * a87c2  목록 0번 주자가 없으면 r5 = 0
 * a87d2  0번이 이번 타자(+0x98)면 +0x96(끝) == 0 → r5 = 1 , 아니면 +0x95(득점) ≠ 0 → r5 = 1
 * a87ea  0번이 타자가 아니면 +0x95(득점) ≠ 0 → r5 = 1
 * a8816  안타 || 볼 4개 || 사구 || r5 → (아웃 state[6] + 이번 아웃 [sp+0x30] ≤ 2 면) 결과비트 B5(0x20, 0xa882a)
 * ```
 * 안타 없이 살아 나간 타자(야수 선택)도 B5 를 켠다 — 기록(타수 · 결과 링)은 아웃 갈래 그대로다(`playOutcome` 머리말).
 */
export function batterRunnerSafeOfFates(fates: readonly RunnerFate[]): boolean {
  const first = fates[0]
  if (first === undefined) return false
  return (first.fromBase === 0 && !first.retired) || first.scored
}

/**
 * **판이 끝나고 루에 남은 주자**(득점도 처리 끝도 아닌)의 투구 때 루 — 0 = 타자주자. 주자 신원을 다음 루에 앉히는 실마리
 * (`gameState.applyAtBatOutcome` 의 `survivorsFromBase`). 보류됐다 날아간 득점의 주자는 `scored` 라 빠진다.
 */
export function survivorsFromBaseOfFates(fates: readonly RunnerFate[]): readonly number[] {
  return fates.filter((fate) => !fate.retired && !fate.scored).map((fate) => fate.fromBase)
}

/**
 * **결과비트 B7 루프의 주자 조건** — 정산 `0xa88fc~0xa8944` (직접 뜬 것):
 * ```
 * a88fc  for r = 2..3:
 * a88fe    0xb68dc(state)(파울) → 다음 r
 * a890c    p = 0xa97a0(관리, r) ; p == 0 → 다음 r     ; 목록 앞에서부터 +0x96 == 0 이고 +0x8c == r 인 첫 주자
 * a891a    p+0x98(이번 타자) ≠ 0 → 다음 r
 * a892a    state[0x13](번트) → 0xa87a8: B7(0x80) 켜고 a8946 로
 * ```
 * 여기는 가운데 두 줄 — 판이 끝난 뒤 2루나 3루에 **처리 끝이 아닌**(+0x96 == 0) 주자가 서 있고, 그 루를 목록 앞에서 처음
 * 찾은 주자가 타자주자가 아니다. 파울(`0xb68dc`)과 번트(`state[0x13]`)는 `burstResultBitsOf` 가 본다.
 * 이닝 · 경기 끝은 안 본다 — 3아웃으로 끝나도 루에 남은 주자는 +0x96 이 없어 걸린다(원본 그대로).
 */
export function scoringBaseRunnerAfterOf(runners: readonly Pick<RunnerState, 'startBase' | 'isOut' | 'scored' | 'isBatterRunner'>[]): boolean {
  return [2, 3].some((base) => {
    const found = runners.find((runner) => !(runner.isOut || runner.scored) && runner.startBase === base)
    return found !== undefined && !found.isBatterRunner
  })
}

/**
 * 이 정산(`0xa8024`)이 `state[0x88]`(출루 허용)을 세우는가 — `0xa8c5c~0xa8ca6`:
 * ```
 * a8c2e  r5 = 0 ; r4 = 0
 * a8c5c  for i < 0xa9598(목록 크기):  r3 = 주자[i]+0x96 ; r5 = 0 ; if r3 == 0: r5 = 1   ; ★ 루프 안에서 지운다
 * a8c86  0xa57f8(R, 0x17, r5)                                                          ; R+0x130 = r5 (읽는 곳 없음)
 * a8ca6  if r5 && 수비 팀이 사람: state[0x88] = 1
 * ```
 * 목록은 `[타자주자?, 1루?, 2루?, 3루?]` 라 마지막 원소 하나만 본다 (`baserunnerAllowedOfFates`).
 * - 수비 화면을 돈 판(인플레이 · 낫아웃 판)은 진행기의 `runnerFates`.
 * - 사람 장면의 삼진·볼넷·사구·홈런은 수비 화면 없이 정산으로 가므로 `runnerFatesWithoutPlay`.
 *
 * - **간이 엔진 타석**(자동으로 넘긴 상대 타석, `quick`)은 정산을 부르는 네 자리의 주자 목록 그대로다 (직접 떴다).
 *   목록(sim+0x80)은 루에 선 주자들이고, 판마다 `0xc1120` 이 루의 주자 +0x96 을 0 으로 지운다. 타자는 `0xa93ac` 가
 *   `0xa9374` 로 목록을 한 칸씩 뒤로 민 뒤 **0번 칸**에 넣는다 → 마지막 원소 = 가장 앞선 주자(주자가 없으면 타자).
 *   ```
 *   c1054 홈런      : 타자를 넣고 목록 전원 +0x95 · +0x96 = 1 (c10b8 · c10c4) → 0xa8024            → 안 선다
 *   c1170 안타 n루  : 타자를 넣고 c0fb4(n) — 전원 n루 진루, 4루를 넘은 주자만 +0x96 = 1 → 0xa8024
 *   c1918 볼넷·사구 : 타자를 넣고 c0fb4(1) — 전원 한 루 → 0xa8024
 *   c15b4·c170c·c1748·c18de·c18ec 아웃·삼진 : 타자를 **안 넣고** 0xa8024 (땅볼 진루 c0fb4(1)은 앞선 주자가 2루 이하일 때만이라 득점이 없다)
 *   ```
 *   전원이 같은 수만큼 가니 "가장 앞선 주자가 들어왔다" ⇔ 이 타석 득점 > 0 이다. 그래서 타자가 나간 결과(안타 · 홈런 · 볼넷 ·
 *   사구)는 **득점이 없을 때만**, 아웃 · 삼진은 **루에 주자가 있으면** 선다(원본 그대로 — 주자 있는 삼진도 "출루 허용" 이다).
 *   타석 중 도루(c1982~)는 실패도 득점도 없어(3루 주자는 안 뛴다, c1a12) 주자 수를 안 바꾼다.
 */
export function baserunnerAllowedOfPlay(
  bases: BaseState,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: Pick<DefensePlayResult, 'runnerFates'> | null,
  /** 간이 엔진 타석이 먹인 진루 (`playQuickPlateAppearance` 의 `advance`) — 득점이 곧 가장 앞선 주자의 +0x96 이다 */
  quickAdvance?: AdvanceResult,
): boolean {
  if (defensePlay !== null) return baserunnerAllowedOfFates(defensePlay.runnerFates)
  if (mine && outcome.kind !== '안타' && outcome.kind !== '아웃') {
    return baserunnerAllowedOfFates(runnerFatesWithoutPlay(bases, outcome))
  }
  if (quickAdvance !== undefined) {
    // 고침(B-37): 목록 전체를 보면 타자주자가 늘 살아 있다 — 홈런(전원 +0x96 = 1)만 안 선다
    if (isHit(outcome) || isFreePass(outcome)) {
      return isBugFixed('B-37') ? outcome.kind !== '홈런' : quickAdvance.runsScored === 0
    }
    return runnerCountOf(bases) > 0
  }
  // 판도 간이 엔진도 아닌 타석은 원본에 없다(정산 0xa8024 를 부르는 곳은 수비 판 · 사람 장면 · 간이 엔진 넷뿐 — 위 머리말).
  // 남는 것은 수비 화면 없이 정산으로 가는 결과뿐이라 사람 장면과 같은 목록으로 본다. 인플레이 타구가 판 없이 오면
  // `runnerFatesWithoutPlay` 가 오류를 낸다 — 예전 근사(안타 · 볼넷 · 사구면 선다)는 걷었다(전체 시험 · soak 에서 한 번도 안 지났다, r276)
  return baserunnerAllowedOfFates(runnerFatesWithoutPlay(bases, outcome))
}

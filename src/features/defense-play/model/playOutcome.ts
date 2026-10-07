import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'

/**
 * ============================================================================
 * **타구 판이 끝난 뒤의 타자 결과** — 판 끝 판정 B `0xae3e8` → 정산 `0xa8024` 의 타자 갈래 (직접 뜬 것)
 * ============================================================================
 *
 * 원본에는 "이 타구는 2루타" 같은 결과 코드가 없다. 타구 시작(0x51408 → 메시지 0x11 0x50faa)은 패턴 덱에서 뽑은
 * 패턴을 그대로 쏘고, 안타·아웃은 수비 판(상태 0x17)이 끝난 뒤 **정산이 판에서 쌓인 사건과 타자주자 칸**을 읽어 정한다.
 *
 * ## 사건 목록 (ctx+0x30.., 개수 ctx+0x2c) — 판 안에서 쌓인다
 * - 공이 처음 땅에 닿거나 담장선을 넘는 틱(플레이 틱 b44f6)에 판 끝 결과 코드 `0x9d5bc` 가 6·10 이면 메시지 0xbba →
 *   표 0xd0488 → `0x51d32`·`0x51d24` → **`0xa5ffc` 사건 6(안타)**, 8·12 면 `0x51c82` → **`0xa5fec` 사건 8(홈런)**.
 * - 아웃 판정 0xb36d0 이 아웃을 낸 틱은 결과 코드 13 → `0x51b36` … `0x51bf2` → **`0xa7d0c` 사건 0xd(아웃)**.
 *
 * ## 정산 0xa8024 의 타자 갈래 (a8096 ~ a8266)
 * ```
 * a8096  사건을 센다: 8 → 홈런 [sp+0x24]·안타 [sp+0x2c] · 6 → 안타 [sp+0x2c] · 0xd·5 → 아웃 [sp+0x30]
 * a8118  [sp+0x18](야수 선택) = 0
 *        주자0 이 이번 타자(+0x98)이고 끝나지 않았으면(+0x96 == 0):
 * a814e    i = 1.. : 주자 i 가 끝났고(+0x96) 득점 아님(+0x95 == 0)이고 +0x7c == i + 1 이면 [sp+0x18] = 1
 * a8192  [sp+0x24] > 0 → 안타 · 루타 4                                     ; 담장을 넘긴 홈런
 * a81a6  [sp+0x2c] > 0 && 주자0 있음 && 주자0 이 타자 && ![sp+0x18] 이면:
 * a81d2    (+0x7c > 1 || +0x84 > 1) && !state[0x1f]  → a8210
 * a81f8    아니면 주자0 이 끝났고(+0x96) 아웃 [sp+0x30] ≠ 0 → 안타 아님
 * a8210  안타 · 루타 = 주자0 +0x8c ; 주자0 이 끝났고 득점 아님 && +0x7c ≤ 1 && +0x84 ≤ 1 이면 루타 − 1
 * a84cc  state[0x25](타자주자가 판 안에서 홈을 밟음 — 0xaa1e2) → 홈런 수 +1 · 그라운드홈런(R+0xcc) +1
 * ```
 * 주자 칸: `+0x7c` 지금 달려가는 루 · `+0x84` 직전의 +0x7c · `+0x8c` 마지막으로 닿은 루 · `+0x95` 득점 · `+0x96` 끝(아웃·득점).
 * 판 안에서 홈을 밟은 타자주자는 +0x8c = 4 라 루타 4 — 웹은 그것을 그대로 홈런으로 적는다(그라운드 홈런, E-8).
 *
 * ## 웹 결과 꼴로 옮기기
 * - 안타(루타 1~3) → `{ 안타, bases }` · 루타 4 → `홈런`.
 * - 안타가 아닌 판 → `아웃`. 야수 선택([sp+0x18])으로 타자가 살아 나간 판도 **원본 기록이 아웃 판과 같다** (직접 뜬 것):
 *   ```
 *   a8490  [sp+0x14](안타) == 0 → a87ba (안타 갈래를 건너뜀 — 안타 · 루타 · 연속 안타를 안 적는다)
 *   a87ba  r5 = 타자주자가 살아남음(`batterRunnerSafeOfFates`) → 아웃 state[6] + [sp+0x30] ≤ 2 면 결과비트 B5(0x20) — 출루
 *   a882e  ([sp+0x28](사건 0xf) > 0 && 아웃 > 0 && !안타) · (안타 사건 [sp+0x2c] == 0 && 아웃 == 0) · [sp+8](희생) · 종류 4·5 가
 *          아니면 a889c 기록 8(G+0xec 타수) · 타자 레코드 +0x20(타수) +1     ; 야수 선택은 [sp+0x18] 이라 a83ec 가 [sp+8] 을 안 세운다
 *   a89f4  아웃 [sp+0x30] > 0 && !안타 && 종류 4·5 아님 → 삼진 [sp+0x20] 이 없으면 0xa908c(타자 칸, 5 땅볼 · state[0x1f] 면 6 뜬공) ·
 *          a8ac2 기록 5(연속 홈런 끊김)
 *   ```
 *   야수 선택은 포스 아웃([sp+0x30] > 0)과 안타 사건(공이 땅에 닿음)이 늘 함께라 타수 +1 · 안타 0 · 0xa908c 5/6 — 웹 `아웃`
 *   (타수 +1 · 안타 0 · detail)과 같다. 다른 것은 B5(출루) 하나라 흐름이 판의 `runnerFates` 로 따로 켠다.
 *   안타 사건이 있는 판에서 타자주자가 살아 남으면 a81f8 이 늘 안타로 보내므로, 야수 선택 말고 "안타 없이 출루" 갈래는 없다
 *   (악송구 · 펌블로 산 타자도 안타다). `detail` 은 웹 전용이다: 뜬공 아웃(state[0x1f])이면 `뜬공아웃`, 아니면 `땅볼아웃`.
 *   ⚠️ 미해결: 희생 [sp+8](a83f2~a848e — 정산 객체 +0x15c~+0x15e 를 세우는 곳을 못 찾았다)이 서면 타수를 안 센다 — 웹 `아웃` 은 센다.
 */

export interface PlayOutcomeInput {
  /** 진행기 주자 목록 — 원본 목록 순서 그대로(0 = 타자주자, 그 뒤 찬 루 오름차순) */
  readonly runners: readonly RunnerState[]
  /** 주자마다 원본 `+0x84`(직전의 +0x7c) — 진행기가 따로 든다. 없으면 그 주자의 +0x8c(`startBase`)로 본다 */
  readonly previousTargets?: readonly number[]
  /** 판에서 사건 6(안타 — 결과 코드 6·10)이 났나 */
  readonly hitEvent: boolean
  /** 판에서 사건 8(홈런 — 결과 코드 8·12)이 났나 */
  readonly homeRunEvent: boolean
  /** state[0x1f] — 쥐기 0xb2710 의 아웃 판정이 뜬공 아웃(1)을 냈다 */
  readonly flyOut: boolean
  /** 판에서 난 아웃 사건(0xd) 수 — 정산 [sp+0x30] */
  readonly outEvents: number
}

/** 홈을 가리키는 루 번호 — 진행기 루 표 [4] */
const HOME_BASE = 4

/** 정산 0xa8024 가 타자에게 적는 결과 (위 머리말) */
export function settledBatterOutcomeOf(input: PlayOutcomeInput): AtBatOutcome {
  const credited = creditedBasesOf(input)
  if (credited >= HOME_BASE) return { kind: '홈런' }
  if (credited >= 1) return { kind: '안타', bases: credited as 1 | 2 | 3 }
  return { kind: '아웃', detail: input.flyOut ? '뜬공아웃' : '땅볼아웃' }
}

/** 정산이 적는 루타 — 0 이면 안타가 아니다 */
export function creditedBasesOf(input: PlayOutcomeInput): number {
  // a8192 — 홈런 사건이 하나라도 있으면 루타 4
  if (input.homeRunEvent) return HOME_BASE
  const batter = input.runners[0]
  if (batter === undefined || !batter.isBatterRunner) return 0
  if (!input.hitEvent) return 0
  if (isFieldersChoice(input.runners)) return 0
  const previousTarget = input.previousTargets?.[0] ?? batter.startBase
  const ended = batter.isOut || batter.scored
  const beyondFirst = batter.targetBase > 1 || previousTarget > 1
  // a81d2 · a81f8
  if (!(beyondFirst && !input.flyOut) && ended && input.outEvents !== 0) return 0
  // a8210 — 루타 = +0x8c, 끝났는데 득점이 아니고 1루를 넘보지 않았으면 하나 뺀다
  let bases = batter.startBase
  if (ended && !batter.scored && !beyondFirst) bases -= 1
  return bases
}

/**
 * **야수 선택 [sp+0x18]** (a8118 ~ a8190) — 타자주자가 살아 있고, 목록 i 번째(1부터) 주자가 득점 없이 끝났는데
 * 그 주자의 `+0x7c`(달려가던 루)가 i + 1 이면 선다. ⚠️ 원본 그대로 **목록 번호**와 루를 견준다 — 1루부터 빈 루 없이
 * 찬 사슬의 포스 아웃만 잡히고, 2루 주자 혼자 3루에서 죽은 판(i = 1, +0x7c = 3)은 야수 선택이 아니다.
 */
function isFieldersChoice(runners: readonly RunnerState[]): boolean {
  const batter = runners[0]
  if (batter === undefined || !batter.isBatterRunner) return false
  if (batter.isOut || batter.scored) return false
  for (let index = 1; index < runners.length; index += 1) {
    const runner = runners[index]
    // +0x96(끝) && +0x95 == 0(득점 아님) — 곧 아웃된 주자
    if (runner.isOut && !runner.scored && runner.targetBase === index + 1) return true
  }
  return false
}

/**
 * 타석이 **맞은 공(페어 타구)** 으로 끝났나 — 안타·아웃·홈런. 원본에서는 이 셋 모두 상태 0x17 수비 판을 돈다
 * (담장을 넘긴 공도 판 안에서 사건 8 · 주자 무조건 진루로 끝난다). 삼진·볼넷·사구는 판이 없다.
 */
export function isBattedBallKind(outcome: AtBatOutcome): boolean {
  return outcome.kind === '안타' || outcome.kind === '아웃' || outcome.kind === '홈런'
}

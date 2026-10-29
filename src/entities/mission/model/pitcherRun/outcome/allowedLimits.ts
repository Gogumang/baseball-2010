import { baserunnerAllowedOfFates, chargedRunsOfFates, isHit } from '@/entities/mission/model/pitcherRun/otherSlices'
import type { AtBatOutcome, RunnerFate } from '@/entities/mission/model/pitcherRun/otherSlices'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun/types'
import { isBugFixed } from '@/shared/config/bugfixes'
import type { OriginalMission } from '@/shared/config/original/missions'

/*
 * R+0x130 "출루 허용" — 정산 0xa8024 안 0xa8c2e~0xa8c86 (R15 11-1 · P7 A1-1, 직접 다시 뜸).
 *
 * ```
 * a8c5c  for i in 0 .. 0xa9598(주자관리)−1:          ; 주자 목록 = [타자주자?, 1루, 2루, 3루 중 찬 루] 오름차순
 * a8c66    r3 = 0xa9564(관리, i)+0x96                ; 처리 끝 (득점해도 0xa9520 이 같은 칸을 세운다)
 * a8c6a    r5 = 0 ; if r3 == 0 → r5 = 1             ; ⚠️ 루프 안에서 0 으로 되돌린다 → **마지막 원소 하나만** 본다
 * a8c86  0xa57f8(R, 0x17, r5)                       ; R+0x130 = (r5 != 0)
 * ```
 * 목록(I 3b-1): 투구 전 `0xa9a10` 이 찬 루를 **3 → 2 → 1 루 순서로 맨 앞에 끼워** `[1루, 2루, 3루]` 오름차순을 만들고,
 * 상태 0x17 진입 `0x46418` 이 타자주자를 `0xa93ac` 로 **맨 앞에** 하나 더 끼운다. 그 조건은 0x464a8~0x464cc:
 * `state[0x11] != 0 || 플레이 종류 ∈ {2, 3} || state[0x1a]`, 그리고 종류 ≠ 8. 볼넷(판정 3, 0x3e1ae)·사구(판정 4,
 * 0x3e1b4)는 **둘 다 종류 2**(0x3e1cc `movs r1,#2` → 0xb0cb8)라 타자주자가 목록에 든다. 삼진은 상태 0x17 을 안 거친다
 * (0xae24c 가 판정 5 를 바로 정산 0xa8024 로 보낸다, 0xae360) → 타자주자 없음.
 * 그래서 **마지막 원소 = 투구 때 맨 앞 주자(가장 높은 루), 주자가 없으면 타자주자**다.
 *
 * 예전에는 진행기가 주자별 운명을 안 내줘 "득점 없고 가장 높은 찬 루 ≥ 맨 앞 주자 출발 루" 로 근사했다.
 * 이제 `missionPlay` 의 `runnerFates`(진행기 결과 · 진행기 없는 결과는 `runnerFatesWithoutPlay`)를
 * `baserunnerAllowedOfFates` 로 그대로 읽는다 — 앞 주자가 잡히고 뒤 주자가 그 루 이상까지 간 플레이도 원본대로 0 이다.
 */

/**
 * **B-31 고침** (기본) — 원본은 노히트노런(13번)의 "무출루" 한도(R+0x130)가 볼넷 · 사구 타자에도 서서 볼넷 하나로 실패하고,
 * "무사사구" 한도(R+0x144)는 이름과 달리 볼넷만 센다. 고친 길은
 *   - 볼넷 · 사구로 끝난 플레이는 출루 허용(R+0x130)으로 치지 않고 — 노히트노런은 사사구를 허용한다(실점 · 피안타 한도는 그대로),
 *   - "무사사구" 한도는 볼넷과 사구를 함께 센다 — 퍼펙트(14번) · 마선수 공략 같은 무사사구 한도 미션은 사구로도 깨진다.
 * 굴림 없는 집계라 난수 차례는 같다
 */
function countsTowardWalkLimit(kind: AtBatOutcome['kind']): boolean {
  if (kind === '볼넷') return true
  return kind === '사구' && isBugFixed('B-31')
}

function isWalkBaserunnerExempt(kind: AtBatOutcome['kind']): boolean {
  return (kind === '볼넷' || kind === '사구') && isBugFixed('B-31')
}

/** 허용 칸 · 레코드 한도 칸 · 깨지는 조건 이름 — 판정 0xaac76~0xaacd6 의 차례 */
const LIMIT_CONDITIONS: readonly (readonly [keyof PitcherRun['allowed'], keyof OriginalMission['failLimits'], string])[] = [
  ['runs', 'runs', '무실점'],
  ['hits', 'hits', '무안타'],
  ['walks', 'walks', '무사사구'],
  ['baserunner', 'baserunners', '무출루'],
]

/**
 * 한도에 닿으면 깨지는 조건 이름 — 실점 → 무실점, 피안타 → 무안타, 볼넷 → 무사사구, 출루 허용 → 무출루.
 *
 * 원본 판정 0xaac76~0xaacd6 은 레코드 바이트(행+0xa0)의 니블을 투수 기록 R 칸과 견준다
 * (`0xaa940`: 한도 > 0 이고 칸 ≥ 한도면 실패 2):
 *   +0xa1 아래 ↔ R+0x128(실점) · +0xa2 위 ↔ **R+0x144(볼넷)** · +0xa2 아래 ↔ R+0x12c(피안타) · +0xa3 ↔ R+0x130(출루 허용, u8)
 * "무사사구" 한도가 보는 R+0x144 는 **볼넷만**이다 — 코드 0x1c 는 볼 카운트 state[5] > 3 일 때뿐(0xa8e04~0xa8e0e)이고
 * 사구는 R+0x148(코드 0x1d, 0xa8e2a)로 따로 간다. 그래서 사구는 이 한도를 채우지 않는다 (이름과 달리 — 원본 버그 B-31, 고친 길은 센다).
 *
 * 넷째 한도 +0xa3(s8, `0xaacca ldrsb`) ↔ R+0x130 (`0xaacc6 ldrb [r6,#0xc]`, r6 = R+0x124) — `0xaaccc bl 0xaa940` — 투수 13·14 번만 1 이다.
 *   R+0x130 은 `baserunnerAllowedOfFates`(주자 운명 목록) 로 센다 — 아래 주석. 볼넷·사구 타자도 주자 목록에 들므로 **노히트노런(13번)도
 *   볼넷·사구 하나로 실패**다 — 원본 버그 B-31 (고친 길은 사사구 플레이를 출루 허용으로 안 친다, `isWalkBaserunnerExempt`).
 *
 * 첫 한도 +0xa1 아래 ↔ R+0x128(실점)은 **원본에서도 걸린다** (전수 확인). P1 5-1 의 "쓰는 곳 없음" 은 사건 함수
 * 0xa57f8 의 코드 0x15 만 본 것이다 — 0xa57f8 로 가는 BL 34곳의 r1 은 모두 상수이고 0x15 는 없지만(맞다),
 * 정산 0xa8024 가 사건 함수를 거치지 않고 **직접** 올린다:
 * ```
 * a8ea4  for i in 0 .. 0xa9598(주자관리)−1:  주자 = 0xa9564(관리, i)
 * a8eb2    주자+0x95(득점 표시) == 0 → 건너뜀            ; 바로 득점·보류 득점 둘 다 +0x95 를 세운다 (0xaa1c0)
 * a8ec0    state[6](아웃) == 3 이고 목록 0번 주자+0x96(아웃) != 0 → 건너뜀
 * a8ee4    P = 0xb8c44(수비 팀, 주자+0x30)             ; 그 주자를 내보낸 투수 (+0xa 바이트가 같은 투수)
 * a8f04    기록 대상이면 P+0x22(실점)++ …
 * a8f3c    0xb6388(P) (+0xa 비트7 = 육성·명전 선수) && 0xa56dc(R, P, 0)(기록 대상) 이면
 * a8f56      R+0x128 += 1                                  ; movs r3,#0x94 ; lsls r3,#1 ; ldr/adds/str
 * ```
 * 미션 투수는 육성·명예 투수(선수 고르기 코드 1·3, Q2)라 비트7 이 서 있고, 미션 시작 주자도 0xa9a10 이 지금 투수를
 * 내보낸 투수로 적으므로(0xa9a4e `0xae83d(수비 팀)` → 0xa93ac 넷째 인자) **+0x95 주자 하나마다 1** 이다.
 * 그래서 점수판 득점(`runsScored`)이 아니라 주자 운명 목록으로 센다 — `chargedRunsOfFates`.
 * (상수 0x128 을 만드는 곳을 바이너리 전체에서 훑어 R 객체 함수 영역 0xa5000~0xa9000 에 쓰기는 0xa8f56 하나, 읽기는
 *  평가 0xa651c·0xa65d6·0xa6b7c·0xa6bd8·0xa6c92·0xa6d1c·0xa726c 뿐이다.)
 *
 * 3아웃으로 끝난 플레이에서 원본은 "목록 0번 주자가 살아 있으면 보류됐다 날아간 득점까지 +0x95 로 세고,
 * 죽었으면 그 플레이 득점을 하나도 안 센다" — 점수판 득점과 다를 수 있는 갈래다. 진행기 결과의 `runnerFates`
 * (보류 무효 주자도 `scored`)로 그대로 옮겼다.
 */
export function brokenConditionsOf(mission: OriginalMission, allowed: PitcherRun['allowed']): string[] {
  const limits = mission.failLimits
  const reached = (count: number, limit: number) => limit > 0 && count >= limit
  return LIMIT_CONDITIONS.filter(([count, limit]) => reached(allowed[count], limits[limit])).map(([, , name]) => name)
}

/** 정산이 본 플레이 — 기록할 결과 · 주자 목록 · 그때의 아웃 수 */
interface SettledPlay {
  readonly outcome: AtBatOutcome
  readonly runnerFates: readonly RunnerFate[]
  readonly outsAtSettlement: number
}

/** 플레이 하나를 허용 칸에 먹인다 — 실점 · 피안타 · 볼넷은 더하고, 출루 허용은 이번 플레이 값으로 덮는다 */
export function allowedAfterPlay(
  allowed: PitcherRun['allowed'],
  play: SettledPlay,
  settledRunnerFates: readonly RunnerFate[] | undefined,
): PitcherRun['allowed'] {
  const settled = play.outcome
  return {
    // R+0x128 = +0x95 주자 수, 3아웃이고 목록 0번이 끝났으면 0 (0xa8ea4~0xa8f56)
    runs: allowed.runs + chargedRunsOfFates(play.runnerFates, play.outsAtSettlement),
    hits: allowed.hits + (isHit(settled) ? 1 : 0),
    // R+0x144 = 볼넷만 (사구는 R+0x148 — `brokenConditionsOf` 머리글). B-31 고침이면 "무사사구" 한도가 사구도 센다
    walks: allowed.walks + (countsTowardWalkLimit(settled.kind) ? 1 : 0),
    // R+0x130 = 이번 플레이 하나의 값 (덮어쓴다) — 목록 마지막 원소의 +0x96 이 꺼져 있나.
    // B-31 고침이면 볼넷 · 사구 플레이는 출루 허용으로 안 친다(사사구는 위 "무사사구" 한도의 몫)
    baserunner: !isWalkBaserunnerExempt(settled.kind) && baserunnerAllowedOfFates(settledRunnerFates ?? play.runnerFates) ? 1 : 0,
  }
}

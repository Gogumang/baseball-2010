/**
 * 투수편 경기 평가 객체 R 의 **투수 칸 다섯** (binary.mod 기록 함수 0xa57f8 · 점프표 0xd8218 —
 * S5 U-13 전부 확정).
 *
 * | 코드 | 칸 | 뜻 | 쓰는 곳 | 읽는 곳 |
 * |---|---|---|---|---|
 * | 0x17 | R+0x130 (u8) | 출루 허용 표시 | 0xa8c86 | **없음** |
 * | 0x19 | R+0x138 | 상대한 타자 수 | 0xa8db0 | **없음** |
 * | 0x1d | R+0x148 | 사구(몸에 맞는 공) | 0xa8e2a | 0xa6b0a (선발형 인기도 퍼펙트 판정) |
 * | 0x1f | R+0x150 (u8) | 등판 순간 팀이 앞서고 있었나 = 세이브 기회 | 0xa6194 | 0xa6d16 (구원형 인기도) |
 * | 0x21 | R+0x158 | t=5 로 던진 공 수 | 0xa5e0a | **없음** |
 *
 * ⚠️ **실제로 읽히는 칸은 사구(0x148)·세이브 기회(0x150) 둘뿐**이다.
 * 0x130·0x138·0x158 은 모으기만 하고 아무 데도 쓰지 않으며 원본에 표시 화면도 없다 (S5 U-13 6절).
 * 그래도 원본 구조 그대로 다섯 칸을 둔다.
 */

/** 기록 코드 (0xa57f8 의 두 번째 인자) */
export const PITCHER_RECORD_CODE = {
  allowedBaserunner: 0x17,
  battersFaced: 0x19,
  hitByPitch: 0x1d,
  leadingAtEntry: 0x1f,
  /** 0x20 = R+0x154 삼자범퇴 이닝 (이 파일이 다루는 다섯 칸 밖) */
  perfectInning: 0x20,
  topGradePitches: 0x21,
} as const

/**
 * "수비팀 현재 투수가 본인" 필터를 거치는가 (0xa584e 의 `코드 − 0x14 ≤ 0xb`).
 *
 * ⚠️ S5 가 P1 5-1 을 정정했다: 필터는 **코드 0x14~0x1f 에만** 걸린다.
 * **0x20(삼자범퇴 이닝)·0x21(t=5 투구 수) 은 상대 투수가 던져도 내 기록에 쌓인다** — 그대로 옮긴다.
 */
export function passesOwnPitcherFilter(code: number): boolean {
  return code >= 0x14 && code <= 0x1f
}

export interface PitcherGameRecord {
  /** R+0x130 — 정산 뒤 루에 살아남은 주자가 있었나 */
  readonly allowedBaserunner: boolean
  /** R+0x138 — 상대한 타자 수(타석 수) */
  readonly battersFaced: number
  /** R+0x148 — 사구 허용 수 */
  readonly hitByPitch: number
  /** R+0x150 — 등판한 순간 수비팀이 앞서고 있었나 */
  readonly leadingAtEntry: boolean
  /** R+0x158 — 게이지 등급 t=5 로 던진 공 수 (마구도 늘 t=5 라 포함된다) */
  readonly topGradePitches: number
}

export const EMPTY_PITCHER_GAME_RECORD: PitcherGameRecord = {
  allowedBaserunner: false,
  battersFaced: 0,
  hitByPitch: 0,
  leadingAtEntry: false,
  topGradePitches: 0,
}

/**
 * R+0x130 — 정산 0xa8024 안 0xa8c2e~0xa8c86.
 *
 * ⚠️ **원본 버그 그대로**: `movs r5,#0` 가 루프 **안**(0xa8c6a)에 있어서
 * r5 는 **주자 목록의 마지막 원소 하나**만 반영한다. 목록이 비면 0 이다.
 * 그래서 야수선택으로 타자주자가 살고 앞 주자가 죽으면 출루가 잡히지 않아
 * 그 경기가 퍼펙트로 계산될 수 있다 (S5 정정 1). 고치지 않는다.
 *
 * @param runnersOut 주자 목록의 "아웃 표시"(주자+0x96) 를 순서대로 담은 배열
 */
export function recordAllowedBaserunner(
  record: PitcherGameRecord,
  runnersOut: readonly boolean[],
): PitcherGameRecord {
  const last = runnersOut.length === 0 ? undefined : runnersOut[runnersOut.length - 1]
  return { ...record, allowedBaserunner: last === false }
}

/** 견제(4)·주자만(5) 플레이는 타석으로 세지 않는다 (`state[0x26]`, 0xa8d98) */
export const RUNNER_ONLY_PLAY_KINDS: readonly number[] = [4, 5]

/**
 * R+0x138 — 정산 한 번마다(= 타석 결과 하나마다) +1 (0xa8db0).
 * 파울은 정산을 부르지 않으므로 세지 않는다.
 */
export function recordBatterFaced(record: PitcherGameRecord, playKind: number): PitcherGameRecord {
  if (RUNNER_ONLY_PLAY_KINDS.includes(playKind)) return record
  return { ...record, battersFaced: record.battersFaced + 1 }
}

/**
 * R+0x148 — 사구 칸 `state[0x12]` 이 서 있으면 +1 (0xa8e2a).
 * 같은 자리에서 `R+0x184`(삼자범퇴 표시) 도 끈다 — 이 함수는 그 사실을 함께 돌려준다.
 *
 * 읽는 곳은 선발형 인기도의 **퍼펙트게임 판정**(0xa6b0a: 볼넷·사구·피안타·실점이 모두 0)이다.
 */
export function recordHitByPitch(record: PitcherGameRecord): {
  readonly record: PitcherGameRecord
  /** `R+0x184 = 0` — 이 이닝은 더 이상 삼자범퇴가 아니다 */
  readonly clearsPerfectInningFlag: true
} {
  return { record: { ...record, hitByPitch: record.hitByPitch + 1 }, clearsPerfectInningFlag: true }
}

/**
 * R+0x158 — 투구 등급 t 가 5 일 때만 +1 (0xa5e00 → 0xa5e0a).
 * 부르는 곳은 "공이 포수까지 갔다" 판정(0x3dfac)의 스트라이크·볼 두 갈래라 **판정마다 한 번**이다.
 */
export function recordPitchGrade(record: PitcherGameRecord, grade: number): PitcherGameRecord {
  if (grade !== 5) return record
  return { ...record, topGradePitches: record.topGradePitches + 1 }
}

export interface SaveSituationInput {
  /** `state[0x69]` = 마지막 이닝 인덱스 (초기화 0xb6814 가 넣는 8) */
  readonly lastInningIndex: number
  /** `state[0x6b]` = 지금 이닝 (0-기준) */
  readonly currentInningIndex: number
  /** `state[6]` = 아웃 수 */
  readonly outs: number
  /** 수비팀 점수 */
  readonly defenseScore: number
  /** 공격팀 점수 */
  readonly offenseScore: number
  /** 루에 나가 있는 주자 수 */
  readonly runnerCount: number
}

export interface SaveSituation {
  /** 남은 아웃 수 `(마지막−지금)·3 − 아웃 + 3` */
  readonly outsRemaining: number
  /** 세이브 요건 1 / 3 / 9. 0 이면 요건이 서지 않았다 */
  readonly requirement: number
  /** 세이브 후보 투수로 적어 둘 상황인가 (`need || hit`) */
  readonly isCandidate: boolean
  /** R+0x150 에 들어갈 값 — 그 순간 수비팀이 앞서는가 */
  readonly leading: boolean
}

/**
 * `0xa60c0(R)` — **투수가 바뀐 바로 그 순간 한 번만** 도는 세이브 후보 갱신.
 * (게이트는 `수비팀+0x296`, 그 칸은 투수 교체 적용 0xaebe4 의 0xaee44 가 세운다.)
 *
 * 세이브 요건은 원본 순서 그대로다:
 *   - 4점 이상 앞서면서 남은 아웃이 9(3이닝)를 넘으면 요건 9
 *   - 3점 이하로 앞서면서 남은 아웃이 3(1이닝)을 넘으면 요건 3
 *   - 동점주자가 대기 타석까지 와 있으면(`수비점수 ≤ 공격점수 + 주자수 + 2`) 요건 1 로 **덮어쓴다**
 *
 * 같은 함수가 `R+0x14c`(연속 탈삼진)도 0 으로 지운다 — 새 투수가 올라올 때 연속 기록을 끊는 것이라
 * 앞뒤가 맞는다(S5 정정 5). 그 칸은 이 파일의 다섯 칸 밖이라 여기서 다루지 않는다.
 */
export function saveSituationOf(input: SaveSituationInput): SaveSituation {
  const outsRemaining = (input.lastInningIndex - input.currentInningIndex) * 3 - input.outs + 3
  const leading = input.defenseScore > input.offenseScore
  let requirement = 0
  let hit = false
  if (leading) {
    if (input.defenseScore - input.offenseScore > 3) {
      if (outsRemaining > 8) {
        requirement = 9
        hit = true
      }
    } else if (outsRemaining > 2) {
      requirement = 3
      hit = true
    }
    if (input.defenseScore <= input.offenseScore + input.runnerCount + 2 && outsRemaining > 0) requirement = 1
  }
  return { outsRemaining, requirement, isCandidate: leading && (requirement !== 0 || hit), leading }
}

/** 투수 교체 순간에 R+0x150 을 갱신한다 (0xa6194) */
export function recordEntryLead(record: PitcherGameRecord, situation: SaveSituation): PitcherGameRecord {
  return { ...record, leadingAtEntry: situation.leading }
}

/**
 * 웹에 아직 없어서 **채울 수 없는 것**:
 *   - 마운드 교체 기록(누가 언제 올라왔는지)이 없다. `saveSituationOf` 가 돌려주는
 *     후보 측·투수 번호(`state+0x5c`/`+0x60`/`+0x64`)를 실제로 적으려면 그 기록이 있어야 한다.
 *   - 주자 객체의 "아웃 표시"(주자+0x96) 목록이 필요하다 — `recordAllowedBaserunner` 의 인자다.
 *   - 사구 칸 `state[0x12]` 에 해당하는 판정이 웹 타석 결과에 없다.
 */
export interface SaveCandidate {
  /** `state+0x5c` = 세이브 측 (수비측 번호) */
  readonly side: number
  /** `state+0x60` = 세이브 후보 투수 번호 */
  readonly pitcherNumber: number
  /** `state+0x64` = 세이브 요건 1 / 3 / 9 */
  readonly requirement: number
}

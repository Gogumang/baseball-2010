import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **CPU 대타 판정 `0xac228`** — 공격 팀이 CPU 일 때 타석 시작마다 한 번 물어보는 함수다 (Q1 4절).
 *
 * 부르는 곳은 둘뿐이다:
 *   - 간이 엔진 `0xc1ba4` (`0xc1c50`): `0xac228([장면+0x7c], 공격팀 [장면+0x74], 주자관리
 *     [장면+0x80], 경기 [장면+0x60])` — **투수 교체 `0xac428` 보다 먼저** 부른다 (0xc1ce2).
 *   - 사람 경기 타석 시작 `0x3d954` (`0x3da6e`): `경기[0x31 + 경기[0xa](수비팀)] == 1`
 *     (수비가 CPU) 이면 `0xac428`, **아니면(사람이 수비) `0xac228(…, 공격팀 [장면+0x220],
 *     주자관리 [장면+0x20c], 경기)`**.
 *
 * 1 을 돌려주면 장면이 효과음 0x16 과 상태 0x16(교체 연출)으로 넘어가고, 이어지는 상태 0xd 의
 * `0xaebe4` 가 명단 두 칸을 맞바꿔 확정한다 — 웹은 그 한 줄기를 한 번에 돌린다.
 *
 * ```
 * 0xac228(?, team, 주자관리, state):                 ; 첫 인자는 안 쓴다
 *   if state[0xe] != 0: return 0                    ; ac234  이번 경기 이미 썼다
 *   if 마선수(0xae89c(team)): return 0               ; ac242~ac250
 *   n = team[+0x28c]; if n <= 0: return 0            ; ac252~ac25e  벤치 타자 수
 *   if 마선수(0xae89c(team)): return 0               ; ac260~ac26e  ← 같은 검사를 한 번 더 한다(원본 그대로)
 *   e = team + 0x34 + team[+0x32](타순)×0x18
 *   if e[0x13] != 0: return 0                        ; ac282  적시타가 있으면 안 바꾼다
 *   if e[0x12] >  1: return 0                        ; ac288  안타 2개 이상이면 안 바꾼다
 *   if e[0x14] <  2: return 0                        ; ac28e  타석 2번은 서야 바꾼다
 *   if 타자[+0x19]·[+0x1a] 의 네 니블 중 하나라도 != 0: return 0   ; ac294~ac2d0  장비 단 선수 제외
 *   p = 100 × 주자수(0xa9598) + 100                   ; ac2d2~ac2e2
 *   if p == 400: p = 500                             ; ac2e6~ac2ec  만루만 500
 *   if e[0x12] == 1: p >>= 1                         ; ac2ee~ac300
 *   k = state[4](S) + state[5](B)                    ; ac302~ac30a
 *   if k > 0: p >>= (k + 1)                          ; ac30e~ac312
 *   if rand(0,1000) >= p: return 0                   ; ac314~ac322
 *   0xaf06c(team, rand(0,n), 0)                      ; ac324~ac334  벤치 무작위 한 명
 *   state[0xe] = 1; return 1                         ; ac338~ac33e
 * ```
 *
 * ⚠️ `state[0xe]` 는 **경기 하나에 한 칸**이다 — 두 팀 몫이 따로 있지 않다. 곧 한 경기에 CPU 대타는
 * 어느 쪽이 쓰든 **딱 한 번**이다.
 */

/**
 * 타순 한 칸의 이 경기 기록 — 원본 `team + 0x34 + 타순×0x18` 24바이트 중 `0xac228` 이 보는 세 칸.
 * 세우는 곳은 타석 정산 `0xa8024` 다.
 */
export interface BatterGameRecord {
  /** `+0x12` — 이 경기 **안타 수** (`0xa8726`, 안타 가지에서 +1) */
  readonly hits: number
  /**
   * `+0x13` — 그 안타가 **점수를 냈으면** +1 (`0xa874c`). 안타 가지 안에서 그 플레이의
   * 이벤트 8(득점) 개수 `sp+0x24` 가 0 보다 클 때만 올라간다 = **적시타 수**.
   */
  readonly runScoringHits: number
  /**
   * `+0x14` — 이 경기 **타석 수** (`0xa8b02`).
   *
   * ⚠️ 해독 문서 Q1 4절은 이 칸을 "범타(아웃) 수" 로 적었지만 **틀렸다**. `0xa8ac6` 은
   * `0xa8024` 의 **공통 꼬리**다 — 안타 가지(`0xa86e0`)도 `0xa8946` 을 거쳐 여기로 내려오고,
   * 아웃 가지도 `0xa89f4` 에서 여기로 떨어진다. 막는 것은 `state[0x26] ∈ {4,5}`
   * (플레이 종류 4 견제 · 5 주자만) 하나뿐이라, **타자가 끝낸 플레이마다** 올라간다.
   * (웹에는 견제·주자만 플레이가 없어 타석마다 세면 된다.)
   */
  readonly plateAppearances: number
}

export const EMPTY_BATTER_GAME_RECORD: BatterGameRecord = {
  hits: 0,
  runScoringHits: 0,
  plateAppearances: 0,
}

/** 타석 하나를 기록에 얹는다 (`0xa8024` 의 세 칸만) */
export function recordPlateAppearance(
  record: BatterGameRecord,
  play: { readonly isHit: boolean; readonly runsBattedIn: number },
): BatterGameRecord {
  return {
    hits: record.hits + (play.isHit ? 1 : 0),
    runScoringHits: record.runScoringHits + (play.isHit && play.runsBattedIn > 0 ? 1 : 0),
    plateAppearances: record.plateAppearances + 1,
  }
}

export interface CpuPinchHitInput {
  /** `state[0xe]` — 이 경기에 CPU 대타를 이미 썼는가 (양 팀 공용 칸이다) */
  readonly alreadyUsedThisGame: boolean
  /** 지금 타석에 선 타자가 마선수인가 (`0xb633c` = 레코드 `+0xa` 비트6) */
  readonly batterIsAce: boolean
  /** 벤치 타자 수 `team+0x28c` */
  readonly benchBatters: number
  /** 그 타자의 타순 칸 기록 */
  readonly record: BatterGameRecord
  /**
   * 그 타자가 **장비를 달고 있는가** — 원본은 레코드 `+0x19`·`+0x1a` 의 네 니블(장비 레벨)이
   * 하나라도 0 이 아니면 안 바꾼다. 장비는 내 선수(나만의리그)만 다는 것이라 로스터 선수는 늘 0 이다.
   * 웹 로스터 표에는 장비 칸이 없어 **기본 거짓**이다.
   */
  readonly batterHasEquipment?: boolean
  /** 주자 수 0~3 (`0xa9598` = 주자관리 `+0xc`) */
  readonly runnerCount: number
  /** `state[4]` 스트라이크 — 원본은 타석 시작(0-0)에만 부르므로 사실상 0 이다 */
  readonly strikes: number
  /** `state[5]` 볼 */
  readonly balls: number
}

/** 만루일 때만 끌어올리는 값 (`ac2ea: movs r4,#0xfa; lsls r4,#1`) */
const LOADED_BASES_PERMILLE = 500
/** `ac2e6` 이 비교하는 값 — 주자 3명이면 100×3+100 = 400 이다 */
const LOADED_BASES_RAW = 400
/** `ac314: movs r1,#0xfa; lsls r1,#2` */
const PERMILLE = 1000

/**
 * 지금 CPU 대타를 낼 것인가 — 낸다면 **벤치 칸 번호 `k`**(0부터), 안 내면 −1.
 *
 * 원본 `0xaf06c(team, k, 0)` 이 `team+0x293 = 9 + k` 로 예약하므로, 명단에서의 자리는 `9 + k` 다.
 *
 * 난수는 **막는 조건을 모두 지난 뒤에만** 돈다 — `rand(0,1000)` 한 번, 그것도 통과하면
 * `rand(0, 벤치수)` 한 번. 그래서 대부분의 타석은 굴림을 하나도 쓰지 않는다.
 */
export function judgeCpuPinchHit(input: CpuPinchHitInput, random: RandomPort): number {
  if (input.alreadyUsedThisGame) return -1
  if (input.batterIsAce) return -1
  const bench = input.benchBatters
  if (bench <= 0) return -1
  // ac260~ac26e 가 같은 마선수 검사를 한 번 더 한다 — 결과는 같아 여기서는 위 한 줄로 갈음한다
  const record = input.record
  if (record.runScoringHits !== 0) return -1
  if (record.hits > 1) return -1
  if (record.plateAppearances < 2) return -1
  if (input.batterHasEquipment === true) return -1

  let permille = 100 * input.runnerCount + 100
  if (permille === LOADED_BASES_RAW) permille = LOADED_BASES_PERMILLE
  if (record.hits === 1) permille >>= 1
  const count = input.strikes + input.balls
  if (count > 0) permille >>= count + 1

  if (Math.trunc(random.nextInRange(0, PERMILLE)) >= permille) return -1
  return Math.trunc(random.nextInRange(0, bench))
}

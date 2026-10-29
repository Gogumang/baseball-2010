import type { PitcherRole } from '@/entities/pitching/model/pitcherChange/otherSlices'

/** 이번 투수의 카운터 — 원본 팀 객체 `+0x27c` 묶음 (P7 E1 확정) */
export interface MoundPitcherCounters {
  /** `+0x284 = A` 이번 투수의 **이번 이닝** 실점. 이닝 교대(0xa5b00)에서 0 이 된다 */
  readonly inningRunsAllowed: number
  /** `+0x280 = B` 이번 투수의 실점. 투수 교체(0xaec64)에서만 0 이 된다 */
  readonly runsAllowed: number
  /** `+0x27c` 이번 투수의 투구 수 (0xa5e5e 에서 투구마다 +1) */
  readonly pitches: number
}

export const EMPTY_MOUND_COUNTERS: MoundPitcherCounters = {
  inningRunsAllowed: 0,
  runsAllowed: 0,
  pitches: 0,
}

export interface PitcherChangeInput extends MoundPitcherCounters {
  /** 지금 투수의 보직 — 레코드 `+0xb` 하위 2비트 (0xb6704) */
  readonly role: PitcherRole
  /** 지금 마운드 투수가 마선수인가 (0xb633c = 레코드 `+0xa` 비트6, ac4f2) */
  readonly isSpecialPitcher?: boolean
  /** 지금 투수의 스태미나 0~10000 (`+0x2c`) */
  readonly stamina: number
  /** 벤치에 남은 투수 수 (`team+0x33`) */
  readonly benchCount: number
  /** 바꾸려면 벤치가 이보다 많아야 한다 — 간이 경기가 넘기는 인자는 1 이다 */
  readonly minimumBench?: number
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly justChanged?: boolean
  /** 수비 팀 점수 − 공격 팀 점수 */
  readonly lead: number
  /** **0-기준** 이닝 (state+0x6b). 1-기준 회에서 하나 뺀 값이다 */
  readonly inningIndex: number
  /** 루에 나가 있는 주자 수 (ac5aa 0xa9598 = 주자 목록 길이) — 9회 이후 마무리 상황 판정에 쓴다 */
  readonly runnerCount: number
}

export interface PitcherChangeDecision {
  /**
   * 바꾸는가 (`[sp+8]`). 9회 이후 **마무리 상황이면 이것도 참이다** — ac5b4~ac5c2 가 `[sp+4]` 를 세우며
   * 곧장 ac5c0 의 `[sp+8] = 1` 로 간다 (아래 `judgePitcherChange` 디스어셈).
   */
  readonly replace: boolean
  /**
   * "마무리 상황" 표시 `[sp+4]`. 새 투수를 어떻게 고를지를 가른다 (0xac5d8~0xac61c):
   *   - 마무리 상황이 **아니고** 벤치에 마선수가 있으면(0xb8a8d) 0xac360 을 굴려, 참이면 벤치 **마지막**에서 고른다
   *   - 그 밖이면 굴리지 않고 곧장 0xabfcc(`chooseReplacementPitcher`) 로 간다
   *     (이때 0xabfcc 의 다섯째 인자 = 마무리 플래그 → `lateInningFlag`)
   * ⚠️ E-6 4절 3c 가 이 방향을 **거꾸로** 적었던 것을 CORRECTIONS 가 정정했다 ("E: 새 투수는
   * … 방향이 반대", V3-E "새 투수 고르기 방향이 반대").
   */
  readonly saveSituation: boolean
}

/** 새 투수 후보 한 명 — 벤치 칸과, 고를 때 보는 값들 */
export interface ReplacementCandidate {
  /** 로스터 칸 */
  readonly index: number
  /** 스태미나 0~10000 (`+0x2c`). 모르면 `FULL_STAMINA` */
  readonly stamina?: number
  /** 보직 `+0xb & 3` (0xb6dec) — 로스터 줄은 `rosterPitcherRoleOf`(= `RosterPlayer.profile & 3`). 넣어 주면 원본 순서를 그대로 쓴다 */
  readonly role?: PitcherRole
  /** 마선수인가 — 0xb633c = 레코드 `+0xa` **비트6**. 0xabfcc 는 늘 거르고, 0xb8a8d 는 이것을 찾는다 */
  readonly isSpecialPitcher?: boolean
  /** 내 육성 선수인가 — 0xb6388 = 레코드 `+0xa` **비트7**(부호). 모드 3 에서만 거른다 */
  readonly isOwnPlayer?: boolean
  /**
   * 능력 합 `0xb5b50(팀, P)` — 마무리 갈래(ac0be)가 이 값 큰 순으로 줄 세운다. `pitcherAbilitySumOf` 로 만든다.
   * 마무리 후보에 하나라도 없으면 그 갈래는 예전 근사(스태미나 순)로 고른다.
   */
  readonly abilitySum?: number
}

export interface ReplacementPickInput {
  /** `judgePitcherChange` 가 세운 "마무리 상황" 표시 */
  readonly saveSituation: boolean
  /** **0-기준** 이닝 (state+0x6b) */
  readonly inningIndex: number
  /** 수비 팀 점수 − 공격 팀 점수 */
  readonly lead: number
  readonly runnerCount: number
  /** 지금 마운드에 선 투수의 스태미나 */
  readonly currentStamina: number
  /** 두 팀 다 CPU 조작이면 마무리 굴림 0xac360 이 난수 없이 거짓이다 (0xb6c20) */
  readonly bothTeamsAreCpu?: boolean
  /**
   * 0xac428 의 `[sp+4]` = (모드 == 3). 참이면 0xabfcc 가 내 육성 선수를 거르고, 고른 투수가 내 선수면
   * ac626 에서 **ac5d8 로 돌아가 다시 고른다** (0xac360 을 또 굴린다)
   */
  readonly excludeOwnPlayers?: boolean
}

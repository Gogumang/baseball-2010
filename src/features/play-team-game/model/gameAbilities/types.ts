import type { FieldingAssignment } from '@/features/play-team-game/model/gameAbilities/seasonPenalties'

/** 시즌모드가 함께 넘기는 팀 상태 (시즌 레코드·팀 레코드에서 온다) */
export interface SeasonTeamCondition {
  /** 질병 벌점 칸 — **SR+6 > 0** 이면 −30% (0xb5824 `ldrsb [SR, #6]`, 질병 종류 SR+5 가 아니다 — `illnessPenaltyFieldOf`) */
  readonly illness: number
  /** 팀 레코드 +2 팀 사기 0~100 */
  readonly morale: number
  /**
   * SR+0x185 코치 (−1 없음, 0~9).
   * 원본 코치 분기에는 팀 검사가 없어 **상대 팀 선수에게도 붙는다** (J 4-2, 직접 떴다): 0xb5a74 `[sp+4] == 2`(모드) →
   *   SR+0x185 ≥ 0 → 점프표 0xd8858[코치] 가 칸(r7)·투수 여부(0xb6279)만 보고 b5b04 `r4 += 0xd884c[코치]` — 팀 비교가 없고,
   *   b5a16 뒤로는 모든 갈래가 b5a74 로 모인다 (원본 버그 B-21 — 고친 길은 `isMyTeam` 선수에게만, `gameAbilityPartsOf`).
   */
  readonly coach: number
}

export interface GameAbilityInput {
  /** 원본 게임 모드 (1 일반 · 2 시즌 · 8·9 대전) */
  readonly mode: number
  /** 선수 레코드에 적힌 밑값 (0~999) */
  readonly base: number
  readonly isPitcher: boolean
  /** 칸 0~3 */
  readonly slot: number
  /** 이 선수가 **시즌모드 내 팀** 선수인가 (0xb5804 `[시즌+1] == 팀레코드+0`) */
  readonly isMyTeam: boolean
  /** 팀 능력치 네 칸 [투구, 타격, 집중, 근성]. 없으면 팀 보정 플래그가 꺼진 것으로 본다 */
  readonly teamAbilities?: readonly number[]
  /** 시즌 팀 상태. 모드 2 가 아니면 무시한다 */
  readonly season?: SeasonTeamCondition
  /** 타자 수비 칸(보직 불일치) 판정 입력. 없으면 벌점 없음 */
  readonly assignment?: FieldingAssignment
  /**
   * **스킬 14(투수 비트 14 — 투지) 갈래가 서는가** (0xb5a28~0xb5a72) — 장착 비트 `0xb62b5(선수, 0xe)` 이고 전역 경기 상태가 6회 이후 · 이 팀이
   * 지는 측(`isLiveGameFightingSpiritSituation`)이면 부르는 쪽이 참을 넘긴다. 투수(0xb6279) · 칸 ≠ 3(체력) 검사는 여기서 한다.
   * 피로 · 팀 능력치 정액 **뒤**, 코치 **앞**에 `v += v/10`(0 쪽 버림, 0xca7b5). 안 넘기면 없음.
   * 피로를 따로 먹이는 `gameAbilityPartsOf`(경기 중 투수) 길은 `fightingSpirit` · `coachBonus` 로 넘겨 `pitcherGameStatOf` 가
   * 피로 → 팀 정액 → 투지 → 코치 차례로 먹인다 (A-23).
   */
  readonly fightingSpirit?: boolean
}

/**
 * `0xb570c` 를 피로(0xb58e6) 앞뒤로 쪼갠 한 칸 — 원본 차례는 모드 가지(시즌 질병·보직·사기) → **피로** →
 * 팀 능력치 정액(0xb592c) → 코치(0xb5a74) → 0..999 자르기라, 투수 체력%를 먹이려면 피로를 정액 **앞에** 끼워야 한다
 * (`entities/pitching/model/pitcherGameStats` 의 `PitcherGameAbilityParts`).
 */
export interface GameAbilityParts {
  /** 0xb58e6 에 들어가기 **전** 값 — 밑값에 시즌 내 팀 보정(0xb581a 가지)까지 먹인 값, 자르기 전 */
  readonly beforeFatigue: number
  /** 0xb58e6 **뒤에** 더하는 정액 — 팀 능력치(모드 1·2·8·9) + 코치(모드 2) */
  readonly bonusAfterFatigue: number
  /** `bonusAfterFatigue` 가운데 코치 몫 — 스킬 14(b5a16~b5a72)가 팀 정액과 코치 사이에 선다 */
  readonly coachBonus: number
  /** 스킬 14 갈래가 이 칸에 서는가 — `fightingSpirit` ∧ 투수 ∧ 칸 ≠ 3 */
  readonly fightingSpirit: boolean
}

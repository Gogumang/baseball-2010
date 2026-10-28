import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { replacementPitcherSlotOf } from '@/entities/pitching/model/pitcherChange'

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
  /** 벤치 투수 칸의 스태미나 `+0x2c` — 안 넘기면 모두 가득으로 본다 */
  readonly benchStaminaOf?: (index: number) => number
  /** 벤치 투수 칸이 마선수(0xb633c)인가 — 안 넘기면 아무도 아니다 */
  readonly benchIsSpecialPitcherAt?: (index: number) => boolean
  /** 벤치 투수 칸의 보직 `+0xb & 3` — 안 넘기면(또는 모르면) 0xabfcc 가 스태미나 최고 근사로 고른다 */
  readonly benchRoleOf?: (index: number) => PitcherRole | undefined
  /** 벤치 투수 칸의 능력 합 `0xb5b50` — 마무리 갈래(ac0be) 정렬 열쇠. 안 넘기면 그 갈래는 스태미나 순 근사 */
  readonly benchAbilitySumOf?: (index: number) => number
}

/**
 * 새 투수 고르기 `0xac5d6~0xac640` — `entities/pitching` 의 `replacementPitcherSlotOf` 에 벤치 칸을 넘긴다
 * (디스어셈 대조는 그쪽 주석).
 *
 * 벤치에 마투수가 있을 때만(0xb8a8d) 마무리 굴림 0xac360 이 돌고, 참이면 벤치 **마지막**(명부 끝의 마투수 자리)을
 * 올린다. 마무리 상황이거나 벤치에 마투수가 없으면 난수 없이 0xabfcc 로 가고, 0xabfcc 는 마선수를 고르지 않는다.
 * 팀 경기는 한 팀을 사람이 잡으므로 "두 팀 다 CPU"(0xb6c20)가 아니고, 모드 3 이 아니라 내 선수 거르기도 없다.
 */
export function replacementPitcherIndexOf(bench: readonly number[], input: ReplacementPickInput, random: RandomPort): number {
  return replacementPitcherSlotOf(
    bench.map((index) => ({
      index,
      ...(input.benchStaminaOf === undefined ? {} : { stamina: input.benchStaminaOf(index) }),
      ...(input.benchIsSpecialPitcherAt?.(index) === true ? { isSpecialPitcher: true } : {}),
      ...(input.benchRoleOf === undefined ? {} : { role: input.benchRoleOf(index) }),
      ...(input.benchAbilitySumOf === undefined ? {} : { abilitySum: input.benchAbilitySumOf(index) }),
    })),
    {
      saveSituation: input.saveSituation,
      inningIndex: input.inningIndex,
      lead: input.lead,
      runnerCount: input.runnerCount,
      currentStamina: input.currentStamina,
      bothTeamsAreCpu: false,
    },
    random,
  )
}

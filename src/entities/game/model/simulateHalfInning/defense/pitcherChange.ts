import type { RandomPort } from '@/shared/api/random/randomPort'
import { moundAfterChange } from '@/entities/game/model/simulateHalfInning/defense/mound'
import { PITCHER_ROLE, judgePitcherChange, replacementPitcherSlotOf } from '@/entities/game/model/simulateHalfInning/otherSlices'
import type { PitcherRole, ReplacementCandidate } from '@/entities/game/model/simulateHalfInning/otherSlices'
import type { HalfInningDefense, HalfInningMound } from '@/entities/game/model/simulateHalfInning/types/defense'

/** `roleAt` 을 안 넘긴 길 — 보직을 모른다 */
const NO_ROLE = (_pitcherSlot: number): PitcherRole | undefined => undefined
const NOBODY = (_pitcherSlot: number): boolean => false

/** 투수 교체 판정이 보는 그 순간의 판 */
interface PitcherChangeSituation {
  readonly inningIndex: number
  readonly lead: number
  readonly runnerCount: number
  readonly inningRunsAllowed: number
  readonly random: RandomPort
  /**
   * `0xac428` 의 일곱째 인자 `[sp+0x58]` — 벤치(`team+0x33`)가 이보다 많아야 바꾼다 (ac44e). 안 넘기면 0.
   * 간이 엔진은 `max(r7, 0)`(0xc1c84) 을 넘기고 r7 은 투수편 구원 갈래에서만 벤치의 내 투수 번호다.
   */
  readonly minimumBench?: number
  /** `[sp+8]` 강제 교체 — 강판·자동진행 켜기 `0xc1b48` 만 1 을 넘긴다 (0xc1b6e). 판정이 거짓이어도 바꾼다 (ac5c4) */
  readonly force?: boolean
  /**
   * 지금 마운드 투수의 보직 (`0xb6ded(현재 투수)`, ac4a0). 안 넘기면 `defense.roleAt` 으로, 그것도
   * 모르면 선발로 본다 — 투수편 내 투수(강판 `0xc1b48`)처럼 칸 표 밖의 투수만 넘긴다.
   */
  readonly moundRole?: PitcherRole
}

/**
 * 타석 하나를 돌리기 **전에** 수비 팀 투수를 바꿀지 본다 (0xc1ba4 → 0xac428 → 0xabfcc → 0xaf09c).
 * 안 바꾸면 받은 마운드를 그대로 돌려준다.
 *
 * 반 이닝 엔진 밖에서도 쓴다 — 나만의리그 타자편은 우리 공격 타석(동료 간이 타석 `0xc1ba4`,
 * 사람 타석 시작 `0x3d954`)에서 **상대 투수**를 이 판정으로 바꾼다 (`features/play-game`).
 *
 * 최소 벤치 인자(`0xac428` 의 일곱째 인자 `[sp+0x58]`)는 **0** 이다: 간이 엔진 `0xc1c8c~0xc1cdc` 가
 * `max(r7, 0)` 을 넘기는데 r7 은 모드 3 갈래(내 구원 투수 찾기)에서만 벤치 번호가 되고 그 밖에는
 * −1 이다. 사람 타석 시작 `0x3da34` 도 0 을 넘긴다. 곧 벤치가 **한 명이라도** 남으면 바꿀 수 있다
 * (`judgePitcherChange` 의 기본값 1 은 이 두 자리와 맞지 않는다).
 *
 * ⚠️ 원본 `0xc1ba4` 의 첫 갈래 — 모드 3(c1bc6) · `0xb6ded`(내 투수 0x1fbd0) == 2 구원 보직(c1bd0 `cmp r0,#2`) ·
 * 수비 팀이 사람 팀(c1bd8~c1bec `state[0x31+state[0xa]] == 0`) · 지금 투수가 내 투수가 아님(c1bf8 `0xb6388`;
 * 0xb6388 은 +0xa 비트7 = 내 육성 선수, 마선수 판정은 0xb633c 비트6)이면 벤치의 **내 투수**를 0-기준 7 = **8회**
 * (c1c2e `cmp r3,#7`)에 올린다 — 는 **나만의리그 투수편 전용**이라 CPU 끼리의 리그 경기에는 없다.
 * 그 갈래는 `entities/pitcher-career/model/pitcherRotation` 이 이미 갖고 있다.
 *
 * 리그·타자편·투수편이 **한 길**로 0xac428 을 지난다 (ac428~ac656 전체 대조는 `entities/pitching/model/pitcherChange`
 * 의 `judgePitcherChange` · `replacementPitcherSlotOf` 주석). 투수편(모드 3)만 `isOwnPlayerAt`(`[sp+4]`)을,
 * 강판 `0xc1b48` 만 `force`(`[sp+8]`)를 넘긴다.
 *
 * 보직(`+0xb & 3`)은 `defense.roleAt` 으로 본다 (안 넘기면 모른다 — 그 주석의 근사).
 */
export function changePitcherIfNeeded(defense: HalfInningDefense, mound: HalfInningMound, situation: PitcherChangeSituation): HalfInningMound {
  const bench = defense.pitcherSlots.filter((slot) => slot !== mound.pitcherSlot && !mound.usedSlots.includes(slot))
  if (isChangeRuledOut(defense, mound, bench, situation)) return mound
  const decision = moundDecisionOf(defense, mound, bench, situation)
  // ac5c4 — `[sp+8]` 강제면 판정이 거짓이어도 바꾼다
  if (!decision.replace && situation.force !== true) return mound

  const next = replacementPitcherSlotOf(
    bench.map((slot) => benchCandidateOf(defense, slot, situation)),
    {
      saveSituation: decision.saveSituation,
      inningIndex: situation.inningIndex,
      lead: situation.lead,
      runnerCount: situation.runnerCount,
      currentStamina: mound.stamina,
      bothTeamsAreCpu: defense.bothTeamsAreCpu,
      // `[sp+4]` = (모드 == 3) — 투수편만 `isOwnPlayerAt` 을 넘긴다
      excludeOwnPlayers: defense.isOwnPlayerAt !== undefined,
    },
    situation.random,
  )
  if (next < 0) return mound

  return moundAfterChange(defense, mound, next)
}

/** 0xac428 머리의 이른 빠짐 — 벤치 수(ac44e) · 남은 벤치가 내 투수(ac458) · 교체 직후(ac486) */
function isChangeRuledOut(defense: HalfInningDefense, mound: HalfInningMound, bench: readonly number[], situation: PitcherChangeSituation): boolean {
  // ac44e — 0xc1cd8 `[sp+0xc] = max(r7, 0)`: 모드 3 갈래 밖에서는 r7 = −1 이라 0 (위 주석)
  if (bench.length <= (situation.minimumBench ?? 0)) return true
  // ac458 — 남은 벤치 하나가 내 투수면 안 바꾼다 (모드 3)
  if (isLastBenchOwnPlayer(defense, bench)) return true
  // ac486 state[0xd] — 강제(`[sp+8]`)보다 먼저 빠진다
  return mound.justChanged
}

function isLastBenchOwnPlayer(defense: HalfInningDefense, bench: readonly number[]): boolean {
  const isOwn = defense.isOwnPlayerAt
  if (isOwn === undefined || bench.length > 1 || bench[0] === undefined) return false
  return isOwn(bench[0])
}

/** 마운드 투수를 바꿀지 — `judgePitcherChange`(ac4a0~ac5c2). 이른 빠짐 둘(ac44e · ac486)은 위에서 보았다 */
function moundDecisionOf(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  bench: readonly number[],
  situation: PitcherChangeSituation,
): ReturnType<typeof judgePitcherChange> {
  const roleAt = defense.roleAt ?? NO_ROLE
  const isSpecial = defense.isSpecialPitcherAt ?? NOBODY
  return judgePitcherChange({
    inningRunsAllowed: situation.inningRunsAllowed,
    runsAllowed: mound.runsAllowed,
    pitches: mound.pitches,
    // ac4a0 0xb6ded(마운드 투수) — 보직을 모르는 칸은 선발로 본다 (역할 0·1 은 같은 갈래)
    role: situation.moundRole ?? roleAt(mound.pitcherSlot) ?? PITCHER_ROLE.starter,
    isSpecialPitcher: isSpecial(mound.pitcherSlot),
    stamina: mound.stamina,
    benchCount: bench.length,
    // ac44e 는 위에서 보았다
    minimumBench: -1,
    // ac486 은 위에서 보았다
    justChanged: false,
    lead: situation.lead,
    inningIndex: situation.inningIndex,
    runnerCount: situation.runnerCount,
  })
}

/** 새 투수 고르기 0xabfcc 에 넘기는 벤치 투수 한 명 */
function benchCandidateOf(defense: HalfInningDefense, slot: number, situation: PitcherChangeSituation): ReplacementCandidate {
  const roleAt = defense.roleAt ?? NO_ROLE
  const isSpecial = defense.isSpecialPitcherAt ?? NOBODY
  const isOwn = defense.isOwnPlayerAt
  return {
    index: slot,
    role: roleAt(slot),
    ...(isSpecial(slot) ? { isSpecialPitcher: true } : {}),
    // 벤치 투수의 +0x2c — 나리 타자편 · 투수편 · CPU 리그 경기는 리그 표에서 이어 온 값을 넘긴다(`staminaAt`).
    // ⚠️ `staminaAt` 을 안 넘기는 길(옛 길 · 시험)은 벤치 투수를 **다 가득**으로 본다 — 스태미나가 같으면
    //    0xabfcc 가 벤치 번호가 작은 쪽을 고른다.
    ...(defense.staminaAt === undefined ? {} : { stamina: defense.staminaAt(slot) }),
    // 0xabfcc 의 `[sp+4] && 0xb6388` 거르기 · ac626 되돌이가 보는 내 육성 선수
    ...(isOwn === undefined ? {} : { isOwnPlayer: isOwn(slot) }),
    // 0xb5b50 능력 합 — 마무리 갈래(ac0be)의 정렬 열쇠
    ...(defense.abilitySumAt === undefined ? {} : { abilitySum: defense.abilitySumAt(slot, fightingSpiritNowOf(defense, situation)) }),
    // 마선수(0xb633c) — 타자편·투수편 로스터에는 마선수가 없고, 리그의 마투수 8번 칸은 `isSpecialPitcherAt` 을
    // 넘겨야 선다. 마선수가 벤치에 없으면 0xb8a8d(team, 0) 이 거짓이라 마무리 굴림 0xac360 은 **돌지 않는다**.
  }
}

/** 스킬 14 의 경기 상태는 지금 리드로 — 반 이닝 시작 리드에서 빠진 만큼이 이 반 이닝 득점이다 */
function fightingSpiritNowOf(defense: HalfInningDefense, situation: PitcherChangeSituation): boolean {
  return defense.fightingSpiritAt?.(defense.lead - situation.lead) === true
}

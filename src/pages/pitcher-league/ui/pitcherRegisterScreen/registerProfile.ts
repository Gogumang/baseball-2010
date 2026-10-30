import {
  PITCHER_SKIN_LABELS,
  PITCHER_TYPE_COUNT,
  pitcherRoleChoiceOf,
  pitcherRoleOfChoice,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'

function wrap(value: number, count: number): number {
  return ((value % count) + count) % count
}

/** 줄별 값 바꾸기 — 원본 목록의 좌우 키 ([0x7c] 타입 · [0x78] 보직 · [0x80] 손 · [0x84] 피부). 이름 줄(0)은 값이 없다 */
const VALUE_STEPS: Readonly<Record<number, (profile: PitcherRookieProfile, step: number) => PitcherRookieProfile>> = {
  1: (profile, step) => ({ ...profile, typeIndex: wrap(profile.typeIndex + step, PITCHER_TYPE_COUNT) }),
  2: (profile, step) => ({ ...profile, role: pitcherRoleOfChoice(wrap(pitcherRoleChoiceOf(profile.role) + step, 2)) }),
  3: (profile, step) => ({ ...profile, handIndex: wrap(profile.handIndex + step, 2) }),
  4: (profile, step) => ({ ...profile, skinIndex: wrap(profile.skinIndex + step, PITCHER_SKIN_LABELS.length) }),
}

/** 줄 `row` 의 값을 `step`(±1) 만큼 돌린 프로필 — 값 줄이 아니면 그대로 */
export function profileAfterValueStep(profile: PitcherRookieProfile, row: number, step: number): PitcherRookieProfile {
  const apply = VALUE_STEPS[row]
  return apply === undefined ? profile : apply(profile, step)
}

import { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { inGameFightingSpiritStateOf, isFightingSpiritSituationOf } from '@/shared/lib/liveGameState/liveGameState'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 투수 스킬 번호 30 = 장착 비트 14 투지 (`skillIdsOfBits` — 비트 + 16) */
export const FIGHTING_SPIRIT_PITCHER_SKILL_ID = 30

/** 능력 합 0xb5b50 의 네 칸에 스킬 14 갈래 — 칸 0~2 만 `v += v/10` (b5a48 칸 ≠ 3) */
export function withSumFightingSpirit(ability: readonly number[], on: boolean): readonly number[] {
  return on ? ability.map((value, slot) => (slot === 3 ? value : withFightingSpirit(value))) : ability
}

/**
 * **스킬 14(투지) 갈래의 경기 상태** (0xb570c b5a4c~b5a66) — 경기 장면은 전역 상태 [0x1552d0c] 자체를 굴려 지금 판의 이닝(+0x6b) ·
 * 측별 팀(+0x28) · 점수(+0x7e)를 본다. `extraRuns` 는 자동진행 간이 엔진이 굴리는 중인 이번 반 이닝 득점 (A-23)
 */
export function pitcherGameFightingSpiritOf(
  progress: PitcherGameProgress,
  teamId: number,
  extraRuns?: { readonly runs: number; readonly offenseIsOurs: boolean },
): boolean {
  return isFightingSpiritSituationOf(inGameFightingSpiritStateOf(progress.options, progress.game, extraRuns), teamId)
}

/** 사람이 던지는 내 투수에 스킬 14 갈래가 지금 서는가 — 장착 비트 14(`pitcherSkillIds` 30) ∧ 경기 상태(내 팀 레코드 +0) */
export function myFightingSpiritOf(progress: PitcherGameProgress): boolean {
  return (
    (progress.options.pitcherSkillIds ?? []).includes(FIGHTING_SPIRIT_PITCHER_SKILL_ID) &&
    pitcherGameFightingSpiritOf(progress, progress.options.ourTeamId)
  )
}

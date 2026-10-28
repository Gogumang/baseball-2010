import { type TeamEntryBatter, NO_ACE_BATTER } from '@/features/play-team-game/model/teamGameRoster'
import { specialSwingCountOf } from '@/entities/batting/model/specialSwing'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { isBatterTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 필살 남은 칸의 "아직 안 채움" (0xaebe4 가 음수일 때만 채운다) */
export const UNFILLED_SPECIAL_SWING = -1

export const UNFILLED_SPECIAL_SWINGS: readonly number[] = Array.from({ length: BATTING_ORDER_SIZE }, () => UNFILLED_SPECIAL_SWING)

/** 마선수 레코드 +0x18 = 순번 + 5 (H2 4-1) */
export const ACE_SPECIAL_NUMBER_OFFSET = 5

/** 0xaebe4 가 보는 타자 비트 23 무자비(필살 +1) · 투수 비트 23 혼신(마구 +2) — 둘 다 `0xb62b4(P, 0x17)` */
const RUTHLESS_SKILL_BIT = 23

export const SPIRIT_SKILL_BIT = 23

/**
 * 명단 한 칸 타자의 **한 경기 필살 횟수** — 타석 교대 0xaebe4 가 채우는 값 (`specialSwingCountOf`).
 *   마타자: s8 0xd84fa[레벨] — 레벨 = 전역 기록 `mgr[0x13f + 순번]` (`options.aceLevels`, 양 팀 모두 같은 전역 칸)
 *   그 밖:  `+0x18 == 0 → 0` — 팀 경기 명단은 리그 로스터와 마선수뿐이고 일반 레코드 +0x18 은 모두 0 이다 (H2 4-2)
 * 스킬 23 무자비 +1 은 `0xb62b4(B, 0x17)` — 명단 줄 레코드 +0x14(`TeamEntryBatter.skillBits`, 마타자는 XlsACE_BAT 행)로 본다
 * (마타자 다섯 줄 모두 비트 23 이 꺼져 있다).
 * ⚠️ 기록으로 선 표 밖 타자(영입한 명전 · 나리)의 +0x18 은 0 이 아닐 수 있는데 웹 명단에 그 칸이 없어 0 으로 본다.
 */
function specialSwingCountFor(progress: TeamGameProgress, batter: TeamEntryBatter | undefined): number {
  if (batter === undefined || batter.aceIndex === NO_ACE_BATTER) return 0
  return specialSwingCountOf({
    swingNumber: batter.aceIndex + ACE_SPECIAL_NUMBER_OFFSET,
    isAceBatter: true,
    aceLevel: aceBatterLevelOf(progress, batter.aceIndex),
    hasRuthlessSkill: (((batter.skillBits ?? 0) >>> RUTHLESS_SKILL_BIT) & 1) === 1,
  })
}

/** 마타자 순번의 레벨 0~4 = `mgr[0x13f + 순번]` */
export function aceBatterLevelOf(progress: TeamGameProgress, aceIndex: number): number {
  return aceLevelOf(progress.options.aceLevels, aceLevelSlotOf('타자', aceIndex + 1))
}

/**
 * 지금 타순 칸의 **남은 필살 횟수** = 0xaea30 — 칸이 −1 이면 0xaebe4 처럼 그 타자의 횟수로 채운 값을 돌려준다.
 * `side` 가 '우리' 면 사람 타석(`BattingStage` 의 `specialSwingRemaining`), '상대' 면 사람이 던지는 CPU 타석.
 */
export function specialSwingRemainingAt(progress: TeamGameProgress, side: '우리' | '상대'): number {
  const ours = side === '우리'
  const slot = ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const stored = (ours ? progress.ourSpecialSwingRemaining : progress.opponentSpecialSwingRemaining)[slot]
  if (stored !== undefined && stored >= 0) return stored
  return specialSwingCountFor(progress, (ours ? progress.ourEntry : progress.opponentEntry)[slot])
}

export function withSpecialSwingSlot(cells: readonly number[], slot: number, value: number): readonly number[] {
  if (slot < 0 || slot >= cells.length || cells[slot] === value) return cells
  return cells.map((cell, index) => (index === slot ? value : cell))
}

/**
 * 사람 타석의 필살 스윙이 나갔다 — 스윙 틱 0x4e136 의 `0xae9e8(팀, 남은 − 1)`. `remaining` 은 `BattingStage` 의
 * `onSpecialSwingUsed` 가 넘긴 줄인 뒤 값이다. 난수는 쓰지 않는다.
 */
export function spendOurSpecialSwing(progress: TeamGameProgress, remaining: number): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  const cells = withSpecialSwingSlot(progress.ourSpecialSwingRemaining, progress.game.battingOrderIndex, remaining)
  return cells === progress.ourSpecialSwingRemaining ? progress : { ...progress, ourSpecialSwingRemaining: cells }
}

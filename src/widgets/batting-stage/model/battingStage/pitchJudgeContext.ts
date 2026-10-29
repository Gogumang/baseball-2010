/** 판정 0x51408 의 재료 — 타자 · 투수 능력 · 상황 · 내 선수 · 보정 구조체 · 필살 */
import type { BattingContext, BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { pitcherBoostSideOf, swingBoostOf } from '@/entities/batting/model/swingBoost'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { situationOf } from '@/widgets/batting-stage/lib/stageText'
import type { StageLatest } from '@/widgets/batting-stage/model/stageRefs'

/** 이 타자의 필살 · 마타자 · 내 선수 표지 (props) */
export interface BatterMarks {
  readonly aceBatterIndex: number
  readonly specialSwingNumber: number
  readonly isBatterOwnPlayer: boolean
  readonly careerYearIndex: number
}

/** 마구 번호(+0x18) 1~4 를 가진 투수 — 비트7(육성 · 명전) */
const OWN_PITCHER_MAGIC_NUMBERS = { min: 1, max: 4 } as const
/** 마타자 레코드 +0x18 은 5~9 (H2 4-1) — 마타자 순번 + 5 */
const ACE_BATTER_SWING_NUMBER_BASE = 5

export function pitchJudgeContextOf(latest: StageLatest, pitch: Pitch, swing: BattingSwing | null, marks: BatterMarks): BattingContext {
  const { aceBatterIndex, specialSwingNumber } = marks
  const pitcherMagicNumber = pitch.pitcherMagicNumber ?? 0
  return {
    batter: latest.batterAbility,
    pitcher: latest.pitcherAbility,
    mode: latest.swingMode,
    batterSkillIds: latest.batterSkillIds,
    // 0xab214 는 투수 레코드로 손 0xb63c0 을 바로 읽는다(스킬 13 좌완UP · 14 우완UP) — 던진 공이 그 투수의 폼·+0x18 을 든다.
    // 다섯째 인자는 타자 레코드 칸 0xb6394(투수 스킬 31) — 부르는 쪽이 그 모드의 레코드 칸을 넘긴다(`batterRecordSlot`)
    situation: situationOf(latest.hud, latest.recentAtBatCodes, latest.batterForm, pitch, latest.batterRecordSlot, latest.batterHand),
    // 내 선수 보너스·계수는 비트7(육성·명전)만 본다 — 마선수(비트6) 등판은 해당하지 않는다 (0xb6389).
    // 마구 번호(+0x18) 1~4 를 가진 투수는 비트7 이다 (일반 레코드 +0x18 은 모두 0 — H2 4-2)
    isBatterOwnPlayer: marks.isBatterOwnPlayer,
    isPitcherOwnPlayer: pitcherMagicNumber >= OWN_PITCHER_MAGIC_NUMBERS.min && pitcherMagicNumber <= OWN_PITCHER_MAGIC_NUMBERS.max,
    careerYearIndex: marks.careerYearIndex,
    // 보정 구조체 0x34d6c — 판정 바로 앞(0x51294)에서 이번 스윙(S+0x10)·공(P+0x10)으로 만든다
    swingBoost: swingBoostOf(
      batterBoostSideOf(latest, swing, marks),
      pitcherBoostSideOf(pitch.magicNumber ?? 0, pitcherMagicNumber, (order) => aceLevelOf(latest.aceLevels, aceLevelSlotOf('투수', order + 1))),
    ),
    // 필살 성공 굴림 0x34c74 — 확률은 번호(+0x18)로, 마타자는 30% (판정 안에서 맞은 공일 때만 굴린다)
    specialSwing: { number: specialSwingNumber, isAceBatter: aceBatterIndex >= 0 },
  }
}

/** 보정 구조체의 타자 쪽 — S+0x10 = 타자 +0x18 (0x51e40). 마타자 레코드 +0x18 은 5~9 (H2 4-1) — 0 만 아니면 된다 */
function batterBoostSideOf(latest: StageLatest, swing: BattingSwing | null, marks: BatterMarks): Parameters<typeof swingBoostOf>[0] {
  const { aceBatterIndex, specialSwingNumber } = marks
  const isAce = aceBatterIndex >= 0
  return {
    number: swingNumberOf(swing, marks),
    isAce,
    aceOrder: Math.max(aceBatterIndex, 0),
    aceLevel: isAce ? aceLevelOf(latest.aceLevels, aceLevelSlotOf('타자', aceBatterIndex + 1)) : 0,
    // 번호(+0x18)를 가진 비마선수는 육성·명전(비트7)뿐이다 — 일반 선수 레코드는 +0x18 이 모두 0 (H2 4-2)
    isOwnPlayer: !isAce && specialSwingNumber > 0,
  }
}

function swingNumberOf(swing: BattingSwing | null, { aceBatterIndex, specialSwingNumber }: BatterMarks): number {
  if (swing?.isSpecial !== true) return 0
  return aceBatterIndex >= 0 ? aceBatterIndex + ACE_BATTER_SWING_NUMBER_BASE : specialSwingNumber
}

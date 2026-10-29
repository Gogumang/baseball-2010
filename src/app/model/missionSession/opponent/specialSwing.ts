import type { OriginalMission } from '@/shared/config/original/missions'
import { RUTHLESS_SKILL_ID, specialSwingCountOf } from '@/entities/batting/model/specialSwing'
import { aceLevelOf, aceLevelSlotOf, aceSkillIdsOf } from '@/entities/mission/model/aceLevel'
import { ACE_SPECIAL_NUMBER_OFFSET } from '@/app/model/missionSession/constants/missionConstants'
import { missionOpponent } from '@/app/model/missionSession/opponent/missionOpponent'

/**
 * **타자 미션에서 치는 내 타자의 남은 필살 횟수** = 0xaea30. 칸이 −1 이면 0xaebe4 처럼 채운 값이다:
 * `+0x18 == 0 → 0`, 아니면 u8 0xd84f0[번호] (내 선수는 마선수가 아니다) + 스킬 23 무자비(장착) +1.
 * 미션은 나리 타자편 저장(0x213c0 6 → 4)을 올리니 그 선수의 번호·장착 스킬이다.
 */
export function missionBatterSpecialSwingRemainingOf(
  stored: number,
  batter: { readonly specialSwingNumber: number; readonly skillIds: readonly number[] },
): number {
  if (stored >= 0) return stored
  return specialSwingCountOf({
    swingNumber: batter.specialSwingNumber,
    isAceBatter: false,
    hasRuthlessSkill: batter.skillIds.includes(RUTHLESS_SKILL_ID),
  })
}

/**
 * **투수 미션 상대 마타자의 필살** — 0x34468 이 보는 번호·남은 횟수와 0x34d6c 의 순번·레벨.
 * 마타자 미션이 아니면 null (일반 CPU 타자는 S+0x10 을 쓰지 않는다 — Q1 5절).
 * 남은 칸이 −1 이면 0xaebe4 처럼 s8 0xd84fa[레벨] 로 채운다 (레벨 = `mgr[0x13f + 순번]`).
 * 스킬 23 무자비(+1)는 마타자 레코드 +0x14(XlsACE_BAT 행 그대로)의 비트 23 이다 — 다섯 줄 모두 꺼져 있어 늘 거짓이지만 행 비트로 본다.
 */
export function missionOpponentSpecialSwingOf(
  mission: OriginalMission,
  stored: number,
  aceLevels?: Readonly<Record<number, number>>,
): { readonly swingNumber: number; readonly remaining: number; readonly aceOrder: number; readonly aceLevel: number } | null {
  const opponent = missionOpponent(mission)
  if (mission.side !== '투수' || opponent === null) return null
  const aceOrder = mission.opponentAce - 1
  const swingNumber = aceOrder + ACE_SPECIAL_NUMBER_OFFSET
  const aceLevel = aceLevelOf(aceLevels, aceLevelSlotOf('타자', mission.opponentAce))
  const remaining =
    stored >= 0
      ? stored
      : specialSwingCountOf({
          swingNumber,
          isAceBatter: true,
          aceLevel,
          hasRuthlessSkill: aceSkillIdsOf(opponent).includes(RUTHLESS_SKILL_ID),
        })
  return { swingNumber, remaining, aceOrder, aceLevel }
}

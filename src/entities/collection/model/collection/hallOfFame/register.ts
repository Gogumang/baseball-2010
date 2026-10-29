import {
  batterRecordLineOf,
  equippedAbilityOf,
  equippedPitcherAbilityOf,
  nariRecordSalaryGradeOfCareer,
  pitcherRecordLineOf,
  type PitcherCareer,
  type PlayerCareer,
} from '@/entities/collection/model/collection/otherSlices'
import {
  firstEmptyHallOfFameSlot,
  hallOfFameBatterAt,
  hallOfFamePitcherAt,
  isHallOfFameSlotOpen,
} from '@/entities/collection/model/collection/hallOfFame/slots'
import type { Collection, HallOfFamePitcher, HallOfFameResult, HallOfFameSide, HallOfFamer } from '@/entities/collection/model/collection/types'

/** 등록 비용 — 0x62e20 `ldr r2,=0x4e20` → G −= 20000, 0x22c29(모드 4 ? 1 : 2, 20000) */
export const HALL_OF_FAME_COST = 20000

/**
 * 등록 확정 (명예의 전당 등록 목록 0x62568 — 팝업 0x16 "예", 0x62cea~0x62e4e):
 * ```
 * G(+0x64) ≤ 19999 → 팝업 0xcc214 "G포인트가 부족합니다. 구매 페이지로 이동하시겠습니까?" (예 → 결과 7 = G 충전 🌐)
 * 칸 = 고른 빈 칸([목록+0x451]) 이 없으면 0x62514 의 첫 빈 칸
 * 투수(모드 3): 0x1f654(저장, 0x1fbd0 지금 투수, 칸) · 0x224ec(저장, 3)
 * 타자(모드 4): 0x1f680(저장, 0x1fc20 지금 타자, 칸) · 0x224ec(저장, 4)      ; 나리 편 초기화
 * G −= 20000 (0~99999) · 저장 · StrCOMMON[52] · 0x22c29(모드 4 ? 1 : 2, 20000)
 * ```
 * G 를 실제로 깎고 통계를 적는 것은 부르는 쪽(지갑)이 한다 — 여기서는 칸만 채운다.
 * 빈 칸이 없으면 '빈칸없음' — 원본은 확인 팝업 전에 StrCOMMON[51] 로 막는다(0x6267a).
 */
export function registerHallOfFame(collection: Collection, career: PlayerCareer, gamePoint: number, slot: number | null = null): HallOfFameResult {
  if (career.endingIndex === null) return { kind: '엔딩전' }
  const target = slot ?? firstEmptyHallOfFameSlot(collection, '타자')
  if (target === null || !isEmptyOpenSlot(collection, '타자', target)) return { kind: '빈칸없음' }
  if (gamePoint < HALL_OF_FAME_COST) return { kind: 'G부족' }
  const famer: HallOfFamer = {
    name: career.name,
    ability: career.ability,
    endingIndex: career.endingIndex,
    season: career.season,
    titleIds: career.titleIds,
    slot: target,
    equippedAbility: equippedAbilityOf(career),
    look: { typeIndex: career.battingTypeIndex, handIndex: career.battingSide, skinIndex: career.skinIndex, teamId: career.teamId },
    equipmentLevels: career.equipmentLevels,
    equippedSkillIds: career.equippedSkillIds,
    specialSwingNumber: career.specialSwingNumber,
    positionIndex: career.positionIndex,
    recordLine: batterRecordLineOf(career.stats),
    salaryGrade: nariRecordSalaryGradeOfCareer(career),
  }
  return { kind: '등록', slot: target, collection: { ...collection, hallOfFame: [...collection.hallOfFame, famer] } }
}

/** 투수편(모드 3) 등록 — `0x1f654(저장, 0x1fbd0, 칸)` 로 +0x880 칸에 넣는다. 나머지는 타자와 같다 */
export function registerHallOfFamePitcher(
  collection: Collection,
  career: PitcherCareer,
  gamePoint: number,
  slot: number | null = null,
): HallOfFameResult {
  if (career.endingIndex === null) return { kind: '엔딩전' }
  const target = slot ?? firstEmptyHallOfFameSlot(collection, '투수')
  if (target === null || !isEmptyOpenSlot(collection, '투수', target)) return { kind: '빈칸없음' }
  if (gamePoint < HALL_OF_FAME_COST) return { kind: 'G부족' }
  const famer: HallOfFamePitcher = {
    name: career.name,
    ability: career.ability,
    equippedAbility: equippedPitcherAbilityOf(career),
    endingIndex: career.endingIndex,
    season: career.season,
    titleIds: career.titleIds,
    slot: target,
    look: { typeIndex: career.typeIndex, handIndex: career.handIndex, skinIndex: career.skinIndex, teamId: career.teamId },
    equipmentLevels: career.equipmentLevels,
    equippedSkillIds: career.equippedSkillIds,
    pitchMask: career.pitchMask,
    selectedMagicNumber: career.selectedMagicNumber,
    role: career.role,
    recordLine: pitcherRecordLineOf(career.stats),
    salaryGrade: nariRecordSalaryGradeOfCareer(career),
    // +0x2c — 0x30 바이트 통째 사본이라 등록 순간의 스태미나
    stamina: career.stamina,
  }
  return {
    kind: '등록',
    slot: target,
    collection: { ...collection, hallOfFamePitchers: [...collection.hallOfFamePitchers, famer] },
  }
}

/** 고른 칸이 열려 있고 비었나 — 고른 칸이 없으면 첫 빈 칸(0x62514)을 쓴다 */
function isEmptyOpenSlot(collection: Collection, side: HallOfFameSide, slot: number): boolean {
  if (!isHallOfFameSlotOpen(side, slot)) return false
  const taken = side === '투수' ? hallOfFamePitcherAt(collection, slot) : hallOfFameBatterAt(collection, slot)
  return taken === null
}

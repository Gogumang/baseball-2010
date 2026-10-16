import type { BatterAbility } from '@/entities/batting/model/batter'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { batterRecordLineOf } from '@/entities/career/model/seasonStats'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hallOfFameBatterAt, hallOfFameRecordSlotOf } from '@/entities/collection/model/collection'
import type { Collection, HallOfFamer, HallOfFamePlayerPick } from '@/entities/collection/model/collection'

/**
 * **미션(모드 5·6)·홈런더비(모드 7)에서 치는 육성 타자.**
 *
 * 원본은 이 모드로 들어갈 때 `0x213c0(앱, 4, 0)` 으로 나만의리그 **타자편 저장**(칸 4)을 올린다
 * (모드 6 은 0x213c0 안에서 4 로 바뀐다 — H-modes · Q2 1-0). 그래서 지금 진행 중인 커리어가 없어도
 * 저장된 선수가 친다 — 부르는 쪽은 `career ?? savedCareer` 를 넘긴다.
 *
 * 능력치는 **0xb6414 = `equippedAbilityOf`** (장비·스킬까지) 다. 경기 능력치 `0xb570c` 의
 * 질병·부상·사기 감소(0xb574a~0xb5802)는 **모드 3·4 에서만** 돈다 —
 *   0xb5734~0xb5748: `[0x1552d10]`(모드) == 2 → 0xb5804(모드 2 갈래) · 3·4 → 0xb574a(감소) ·
 *   < 2 또는 > 4 → 곧장 0xb58e6 (피로 단계)
 * 모드 5·6·7 은 감소 없이 피로로 건너뛰고, 타자 쪽 피로 인자는 54 를 넘어 그대로이며,
 * 팀 능력치(0xb592c)는 모드 1·2·8·9 만이라 결과가 0xb6414 와 같다.
 * 앞서 웹은 `effectiveAbilityOf`(감소 포함)를 써서 아프거나 사기가 낮은 선수가 미션·홈런더비에서 약해졌다.
 *
 * 스킬은 선수 기록 +0x14 의 **장착** 비트(0xb62b4)를 그대로 본다 — 저장을 올리니 장착 스킬이 그대로 산다
 * (압도 22: 실투율 +5 0x33d52 · 투구 소모 ×2 0xa5f0e, 스윙 스킬 등). 모드를 가리는 갈래는 없다.
 *
 * 선수가 없으면(저장을 불러오는 짧은 순간) 신인 능력치·스킬 없음 — 원본에는 이 대체가 없다
 * (미션·홈런더비 진입은 선수가 있을 때만 열린다, EntryRoutes · Q2 3-1).
 */
export interface ModeBatter {
  readonly ability: BatterAbility
  /** 장착 스킬 id (`career.equippedSkillIds`) — 타석 화면 `batterSkillIds` 로 간다 */
  readonly skillIds: readonly number[]
  /**
   * 고른 필살타법 번호 = 선수 레코드 +0x18 (`career.specialSwingNumber`, 1~4 · 0 이면 안 고름).
   * 미션도 나리 타자편 저장을 올리니 그 선수의 번호다 — '0' 키(0x51dee)가 S+0x10 에 싣는 값.
   */
  readonly specialSwingNumber: number
  /**
   * 선수 레코드 +0xb 의 생김새 — 폼(윗니블 `2 × 타입 + 손`) · 피부(bit2-3). 타석 교대 0x47d98~0x47dd6 이 타자 그림 적재 0x78ab0 에
   * 폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` · 손 `0xb63c0`(= 폼 & 1)을 넘긴다. 모르면(선수 없음 · 옛 명전 기록) 없다
   */
  readonly look?: ModeBatterLook
  /**
   * 선수 레코드 +0x20~+0x2b 시즌 줄 s16 여섯 칸 — 미션(모드 6)은 0xb87cc 가 이 기록을 0x30 바이트 통째 명부에 넣어 소개 판 0x44944 가
   * 그대로 읽는다(+ 기록 게이트 0xa5764 가 여는 이 경기 줄). 나리 = 저장 선수의 시즌 줄(`career.stats`), 명예 = 등록 때 베낀 줄.
   * 모르면(선수 없음 · 줄을 안 남긴 옛 명전 기록) 없다
   */
  readonly recordLine?: readonly number[]
  /**
   * 선수 레코드 +0xa 아랫 5비트 — 명예 타자만 (`hallOfFameRecordSlotOf`: 등록 0 · 시즌 영입 0xc554 의 0xb6605 가 고른 자리).
   * 0xb53f0 의 0x20 갈래(b5532~)가 이 칸 k 에 넣는다 — 홈런더비 3a550 · 타자 미션 aa7c2 의 0xb6394(0x1fc20(앱)).
   * 나리 타자는 나리 팀 레코드의 내 줄 첨자라 여기 없다
   */
  readonly recordSlot?: number
}

/** 선수 레코드 +0xb — 폼 `2 × 타입 + 손` · 피부 0 황인 · 1 백인 · 2 흑인 */
export interface ModeBatterLook {
  readonly form: number
  readonly skinIndex: number
}

export function modeBatterOf(career: PlayerCareer | null): ModeBatter {
  if (career === null) return { ability: ROOKIE_BATTER_ABILITY, skillIds: [], specialSwingNumber: 0 }
  return {
    ability: equippedAbilityOf(career),
    skillIds: career.equippedSkillIds,
    specialSwingNumber: career.specialSwingNumber,
    // 저장 선수의 +0xb — 폼 = 2 × 타입 + 손 (C 5절 0x16f9a) · 피부
    look: { form: career.battingTypeIndex * 2 + career.battingSide, skinIndex: career.skinIndex },
    recordLine: batterRecordLineOf(career.stats),
  }
}

/**
 * **명예 타자** — 선수 게터 `0x1fc20` 이 모드 5·6·7 · 전역기록 +0x11f == 0 · (s8)+0xa6 ≥ 0 이면 주는
 * `0x1f640(저장, +0xa6)` = 전역기록 +0x940 + i·0x30 의 기록. 등록이 0x30 바이트를 통째 옮긴 사본이라
 * 0xb6414(장비 니블·장착 비트 +0x14) · 필살타법 번호 +0x18 을 나리 타자와 같은 식으로 읽는다.
 * ⚠️ 옛 저장(기록 칸을 남기기 전에 등록한 선수): 장비 니블이 없으면 등록 때 남긴 0xb6415 값(없으면 기본 능력치),
 *    장착 비트가 없으면 스킬 없음, 필살 번호가 없으면 0 — 원본 기록에는 늘 있는 칸이다.
 */
export function modeBatterOfHallOfFame(famer: HallOfFamer): ModeBatter {
  const skillIds = famer.equippedSkillIds ?? []
  const ability = famer.equipmentLevels === undefined
    ? (famer.equippedAbility ?? famer.ability)
    : equippedAbilityOf({ ability: famer.ability, equipmentLevels: famer.equipmentLevels, equippedSkillIds: skillIds })
  return {
    ability,
    skillIds,
    specialSwingNumber: famer.specialSwingNumber ?? 0,
    ...(famer.recordLine === undefined ? {} : { recordLine: famer.recordLine }),
    // +0xa 아랫 5비트 — 등록 0x1f680 의 0x20 → 0, 시즌 영입이 고친 자리 j (전역 블록째 저장)
    recordSlot: hallOfFameRecordSlotOf(famer),
    // 등록이 옮긴 +0xb — 옛 기록(생김새 칸을 남기기 전)은 모른다
    ...(famer.look === undefined
      ? {}
      : { look: { form: famer.look.typeIndex * 2 + famer.look.handIndex, skinIndex: famer.look.skinIndex } }),
  }
}

/**
 * 고른 선수가 명예 타자(+0xa6 ≥ 0)면 그 기록의 타자, 아니면 null (나리 타자 — 부르는 쪽이 `modeBatterOf` 를 쓴다).
 * 마선수 대결(+0x11f ≠ 0)이면 부르는 쪽이 `pick` 을 null 로 넘긴다.
 */
export function hallOfFameModeBatterOf(pick: HallOfFamePlayerPick | null, collection: Collection): ModeBatter | null {
  if (pick?.side !== '타자' || pick.hallOfFameIndex === null) return null
  const famer = hallOfFameBatterAt(collection, pick.hallOfFameIndex)
  return famer === null ? null : modeBatterOfHallOfFame(famer)
}

import {
  HALL_OF_FAME_BATTER_FIRST_RECORD_ID, HALL_OF_FAME_MAX_BATTERS, HALL_OF_FAME_MAX_PITCHERS,
  HALL_OF_FAME_PITCHER_FIRST_RECORD_ID, hallOfFameBatterAt, hallOfFamePitcherAt,
} from '@/entities/collection/model/collection'
import type { Collection } from '@/entities/collection/model/collection'
import { equippedPitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherFormOf } from '@/entities/pitcher-career/model/pitcherRegistration'
import type { SeasonEntryRecordSource } from '@/entities/season-mode/model/seasonEntry'
import { modeBatterOfHallOfFame } from '@/app/model/modeBatter'

/** 명전 칸 사본 — 시즌 영입 후보·경기 명단이 읽는 두 목록 */
export type SeasonHallOfFame = Pick<Collection, 'hallOfFame' | 'hallOfFamePitchers'>

/** 등록이 FASTBALL(1) 을 무조건 준다(`0xb6dfd(p, 1)`) — 구질 마스크가 없는 옛 명전 기록의 대체 (`modePitcherOfHallOfFame` 과 같다) */
const FASTBALL_ONLY_MASK = 1

/**
 * **영입한 명전 선수의 경기 기록** — 시즌 명단 차례(`seasonEntryOrderOf`)에 실어 팀 경기에 넘긴다.
 *
 * 영입 0xc554 는 명전 칸(`0x1f62c` 투수 · `0x1f640` 타자)의 0x30 바이트를 통째로 팀 레코드에 옮기고(S6 4-2), 경기용 팀
 * 0xb891c 는 그 레코드를 id 로 거르지 않고 쓴다(7da5044). 기록 번호는 등록이 덮어쓴 칸 + 0xb4 / + 0xc8 이라 번호에서 칸을
 * 되찾는다 — 투수 `id − 0xb4` · 타자 `id − 0xc8`.
 *   이름  = rec + 1 (0xaa458 표 밖)
 *   능력치 = 0xb6414(기록, k, 1) — 장비 니블·장착 스킬을 얹은 값 (미션 `modeBatterOfHallOfFame`·`modePitcherOfHallOfFame` 과 같은 식)
 *   투수 레퍼토리 = 구질 마스크 +0x1c · 폼 0xb6e24(= 2×타입 + 손) · 고른 마구 +0x18
 *
 * ⚠️ 웹 시즌 명단은 선수 기록 0x30 바이트를 들지 않아(번호·종류·수비 위치·스태미나만) 영입 때 옮긴 사본 대신 지금의 명전
 *    칸을 읽는다. 영입 뒤 명전 칸이 바뀌는 길은 삭제뿐이고 삭제는 시즌 명단에서도 그 선수를 뺀다(0x221dc)라 결과가 같다.
 *    단 영입 선수의 시즌 장비 구매(0xdc → 0x2328c 가 명전 기록에도 반영)는 웹에 없다.
 * ⚠️ 투수 보직 `+0xb & 3`(0xb6dec)은 웹 명전 기록에 칸이 없어 싣지 않는다 — 받는 쪽은 선발로 본다.
 */
export function seasonHallOfFameRecordSourceOf(hallOfFame: SeasonHallOfFame): SeasonEntryRecordSource {
  return {
    batter: (player) => {
      const slot = player.id - HALL_OF_FAME_BATTER_FIRST_RECORD_ID
      if (slot < 0 || slot >= HALL_OF_FAME_MAX_BATTERS) return undefined
      const famer = hallOfFameBatterAt(hallOfFame, slot)
      if (famer === null) return undefined
      const { ability } = modeBatterOfHallOfFame(famer)
      return { name: famer.name, ability: [ability.hit, ability.power, ability.defense, ability.run] }
    },
    pitcher: (player) => {
      const slot = player.id - HALL_OF_FAME_PITCHER_FIRST_RECORD_ID
      if (slot < 0 || slot >= HALL_OF_FAME_MAX_PITCHERS) return undefined
      const famer = hallOfFamePitcherAt(hallOfFame, slot)
      if (famer === null) return undefined
      const equippedSkillIds = famer.equippedSkillIds ?? []
      // 옛 저장(장비 니블이 없는 기록)은 등록 때 남긴 0xb6415 값 그대로 (`modePitcherOfHallOfFame` 과 같은 대체)
      const ability = famer.equipmentLevels === undefined
        ? famer.equippedAbility
        : equippedPitcherAbilityOf({ ability: famer.ability, equipmentLevels: famer.equipmentLevels, equippedSkillIds })
      return {
        name: famer.name,
        ability: [ability.control, ability.velocity, ability.breaking, ability.stamina],
        repertoire: {
          name: famer.name,
          form: pitcherFormOf(famer.look.typeIndex, famer.look.handIndex),
          magicId: famer.selectedMagicNumber ?? 0,
          pitchMask: famer.pitchMask ?? FASTBALL_ONLY_MASK,
        },
      }
    },
  }
}

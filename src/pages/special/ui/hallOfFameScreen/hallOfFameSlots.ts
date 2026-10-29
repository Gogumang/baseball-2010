import type { Collection, HallOfFameSide } from '@/entities/collection/model/collection'
import { hallOfFameBatterAt, hallOfFamePitcherAt, isHallOfFameSlotOpen } from '@/entities/collection/model/collection'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import {
  HALL_OF_FAME_PITCHER_SLOTS,
  HALL_OF_FAME_SLOTS,
  NARI_BATTER_SLOT,
  NARI_PITCHER_SLOT,
  hallOfFameEntryOfSlot,
} from '@/pages/special/lib/specialLayout'
import { HALL_OF_FAME_FIGURE_TEAM } from '@/pages/special/lib/hallOfFameFigure'
import type { HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
import type { HallOfFameMode, HallOfFameNariPlayer, HallOfFameSlotView } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'
import { isHomeRunDerbyPick } from '@/pages/special/ui/hallOfFameScreen/hallOfFameGridView'

const batterChartOf = (ability: BatterAbility) => [ability.hit, ability.power, ability.defense, ability.run]
const pitcherChartOf = (ability: PitcherAbility) => [ability.control, ability.velocity, ability.breaking, ability.stamina]

/**
 * 명전 칸 몸 그림 — 기록 +0xb 의 폼(2 × 타입 + 손)·피부와 장비 니블, 팀은 늘 14 (0x65296).
 * 니블 차례는 능력치 차례 그대로다(부위 0~3 = rec[0x19] 윗·아랫 · rec[0x1a] 윗·아랫). 옛 저장(니블 없음)은 맨몸.
 */
function hallOfFameFigureLookOf(
  look: { readonly typeIndex: number; readonly handIndex: number; readonly skinIndex: number },
  nibbles: readonly number[] | undefined,
): HallOfFameFigureLook {
  const [first = 0, second = 0, third = 0, fourth = 0] = nibbles ?? []
  return {
    form: look.typeIndex * 2 + look.handIndex,
    skin: look.skinIndex,
    team: HALL_OF_FAME_FIGURE_TEAM,
    equipment: [first, second, third, fourth],
  }
}

const isNariSlot = (index: number) => index === NARI_PITCHER_SLOT || index === NARI_BATTER_SLOT

/** 나리 칸 0·5 — 보기(스페셜)는 비우고(상태 0), 나머지는 저장이 있으면 1 · 없으면 2 */
function nariSlotOf(mode: Exclude<HallOfFameMode, { kind: '보기' }>, index: number): HallOfFameSlotView {
  const nari: HallOfFameNariPlayer | null = index === NARI_PITCHER_SLOT ? mode.nari.투수 : mode.nari.타자
  if (nari === null) return { kind: '빈칸', state: 2 }
  return { kind: '찬칸', state: 1, name: nari.name, chartValues: nari.equippedAbility, figure: nari.figure ?? null }
}

/** 명예 투수 칸 — 비었으면 상태 4, 찼으면 3 */
function pitcherSlotOf(collection: Collection, slot: number): HallOfFameSlotView {
  const famer = hallOfFamePitcherAt(collection, slot)
  if (famer === null) return { kind: '빈칸', state: 4 }
  return {
    kind: '찬칸',
    state: 3,
    name: famer.name,
    chartValues: pitcherChartOf(famer.equippedAbility),
    figure: hallOfFameFigureLookOf(famer.look, famer.equipmentLevels === undefined ? undefined : pitcherChartOf(famer.equipmentLevels)),
  }
}

/** 명예 타자 칸 — 옛 저장(장비 얹은 값이 없는 선수)은 기본 능력치로 그린다 */
function batterSlotOf(collection: Collection, slot: number): HallOfFameSlotView {
  const famer = hallOfFameBatterAt(collection, slot)
  if (famer === null) return { kind: '빈칸', state: 4 }
  const nibbles = famer.equipmentLevels === undefined ? undefined : batterChartOf(famer.equipmentLevels)
  return {
    kind: '찬칸',
    state: 3,
    name: famer.name,
    chartValues: batterChartOf(famer.equippedAbility ?? famer.ability),
    figure: famer.look === undefined ? null : hallOfFameFigureLookOf(famer.look, nibbles),
  }
}

const FAMER_SLOT_OF: Readonly<Record<HallOfFameSide, (collection: Collection, slot: number) => HallOfFameSlotView>> = {
  투수: pitcherSlotOf,
  타자: batterSlotOf,
}

/** 칸 하나 (0x5eb8c) — 홈런더비(목록 종류 1)는 투수 칸 0~4 를 채우지 않는다 (0x5ec8e → 0x5ed0e 건너뜀) */
function hallOfFameSlotOf(collection: Collection, mode: HallOfFameMode, index: number): HallOfFameSlotView {
  if (isHomeRunDerbyPick(mode) && index < HALL_OF_FAME_PITCHER_SLOTS) return { kind: '빈칸', state: 0 }
  if (isNariSlot(index)) return mode.kind === '보기' ? { kind: '빈칸', state: 0 } : nariSlotOf(mode, index)
  const entry = hallOfFameEntryOfSlot(index)
  if (entry === null) return { kind: '빈칸', state: 0 }
  if (!isHallOfFameSlotOpen(entry.side, entry.index)) return { kind: '빈칸', state: 5 }
  return FAMER_SLOT_OF[entry.side](collection, entry.index)
}

/** 칸 15개의 상태 (0x5eb8c) — `HallOfFameSlotState` 머리말 */
export function hallOfFameSlotsOf(collection: Collection, mode: HallOfFameMode): readonly HallOfFameSlotView[] {
  return Array.from({ length: HALL_OF_FAME_SLOTS }, (_unused, index) => hallOfFameSlotOf(collection, mode, index))
}

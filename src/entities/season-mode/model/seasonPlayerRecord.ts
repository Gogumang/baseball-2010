import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { HALL_OF_FAME_FIRST_ID, tableTeamOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord, SeasonEntryRecordSource } from '@/entities/season-mode/model/seasonEntry'

/**
 * **시즌 선수 한 명의 레코드 칸** — 선수 상세 카드 0xd9(0x7ba44 시즌 갈래) · 능력치 상세 글 0x897e8 이 읽는 것만.
 *
 * 원본은 팀 레코드(`0x1f570(저장, 팀)` → 투수 `+0x14` · 타자 `+0x18` 배열, 한 명 0x30 바이트)의 그 선수 바이트를 그대로 읽는다.
 * 웹 시즌 명단(`SeasonPlayer`)은 번호·종류·수비 위치·스태미나·장비만 들고, 나머지는 그 선수의 붙박이 표 행
 * (`shared/config/original/roster` — Xls 행 0x30 바이트가 곧 시즌 레코드의 처음 값이다, S6 3-1)에서 빌린다:
 * ```
 * +0xc..+0x13  능력치 s16 × 4      표 `ability`
 * +0xb         타입 · 보직          표 `profile`  (윗 3비트 타자 타입 · 아랫 2비트 보직 0xb6704)
 * +0x14        장착 스킬 비트        표 `skillBits` (0xb62b4)
 * +0x19 · +0x1a 장비 니블            시즌 명단 `equipment`, 없으면 표 `equipment`
 * +0x1c        수비 위치 (& 0xf)      시즌 명단 `fieldPosition`
 * ```
 * 시즌 명단에는 마선수가 없다(0xdf 들어옴 0x5980 이 열 팀 모두 `0xb512c` 로 마선수 칸을 비운 뒤 목록을 채운다) —
 * 그래서 0xb6414 의 마선수 배율(+0xa 비트 6 일 때만)은 여기서 늘 건너뛴다.
 */
export interface SeasonPlayerRecordView {
  readonly name: string
  /** 목록 탭 — 0xdf `ed+0x33f`(1 투수 · 0 타자)로 고른 배열 (`0xb5694(팀, 탭 == 0 ? 1 : 0, 커서)`) */
  readonly isPitcher: boolean
  /** `0xb6415(기록, k, 0)` — 장비·스킬을 뺀 기본 능력치 네 칸 */
  readonly base: readonly number[]
  /** +0xb */
  readonly profile: number
  /** +0x14 */
  readonly skillBits: number
  /** +0x19 · +0x1a 니블 네 칸 */
  readonly equipment: readonly number[]
  /** +0x1c & 0xf (투수는 0) */
  readonly fieldPosition: number
  /** +0x18 — 고른 필살타법 · 마구 번호 (0 안 고름). 붙박이 표 300행은 모두 0 */
  readonly specialNumber?: number
  /**
   * 위 칸을 원본 레코드에서 모두 읽었는가. 영입한 나리·명예 선수(id ≥ 0xb4)는 웹 명단이 0x30 바이트를 들지 않아
   * 기록 사본의 이름·능력치(0xb6414 플래그 1 값)만 있다 — ⚠️ 그때는 `base` 가 장비·스킬을 얹은 값이고
   * +0x14 · 장비 니블은 0 으로 둔다(미해결, 아래 `seasonPlayerRecordOf` 주석). +0xb · +0x18 은 기록 사본에 있으면 그 값이다.
   */
  readonly isComplete: boolean
}

const NO_EQUIPMENT: readonly number[] = [0, 0, 0, 0]

/** 장비 니블 네 칸 — 시즌 명단 값, 없으면 그 선수의 붙박이 표 행 (`SeasonPlayer.equipment`) */
export function seasonPlayerEquipmentOf(player: SeasonPlayer, ownerTeamId: number, isPitcher: boolean): readonly number[] {
  if (player.equipment !== undefined) return player.equipment
  if (player.id >= HALL_OF_FAME_FIRST_ID) return NO_EQUIPMENT
  const table = isPitcher ? teamPitchers(tableTeamOf(player, ownerTeamId)) : teamBatters(tableTeamOf(player, ownerTeamId))
  return table[player.id]?.equipment ?? NO_EQUIPMENT
}

/**
 * 시즌 명단의 한 선수를 레코드 칸으로 편다.
 *
 * - 리그 선수(id < 0xb4): 그 선수의 붙박이 표 팀(`tableTeamOf` — 트레이드로 옮겨 온 선수는 옛 팀) 표의 id 번째 행.
 * - 영입 선수: 나리 선수는 영입 때 옮긴 기록 사본(`SeasonPlayer.record`), 명예 선수는 `recordOf` 가 주는 명전 칸 기록.
 *   ⚠️ 둘 다 이름 · `0xb6414(기록, k, 1)` 능력치 · +0xb(`profile`) · +0x18 만 있다 — 원본은 옮긴 0x30 바이트에서
 *   기본값(플래그 0)·+0x14·장비 니블도 따로 읽지만 웹 사본에는 그 칸이 없다. 그래서 `isComplete: false` 로 표시하고 능력치를
 *   기본값 자리에 둔다. 옛 사본(+0xb 칸이 생기기 전)은 투수 보직(`role`)만 +0xb & 3 에 싣는다.
 * - 셋 다 없으면 이름 `투수 N번` 과 빈 능력치 (`playerFaceOf` 와 같다).
 */
export function seasonPlayerRecordOf(
  ownerTeamId: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  index: number,
  recordOf?: SeasonEntryRecordSource,
): SeasonPlayerRecordView {
  const fieldPosition = isPitcher ? 0 : player.fieldPosition & 0xf
  if (player.id < HALL_OF_FAME_FIRST_ID) {
    const team = tableTeamOf(player, ownerTeamId)
    const row = (isPitcher ? teamPitchers(team) : teamBatters(team))[player.id]
    if (row !== undefined) {
      return {
        name: row.name,
        isPitcher,
        base: row.ability,
        profile: row.profile,
        skillBits: row.skillBits,
        equipment: player.equipment ?? row.equipment,
        fieldPosition,
        isComplete: true,
      }
    }
  }
  const record = player.record ?? (isPitcher ? recordOf?.pitcher(player) : recordOf?.batter(player))
  const pitcherRecord = isPitcher ? record as SeasonEntryPitcherRecord | undefined : undefined
  const batterRecord = isPitcher ? undefined : record as SeasonEntryBatterRecord | undefined
  // +0xb — 기록 사본의 바이트, 옛 사본(칸이 생기기 전)은 투수 보직(+0xb & 3, 0xb6dec)만
  const role: number = pitcherRecord?.role ?? 0
  return {
    name: record?.name ?? `${isPitcher ? '투수' : '타자'} ${index + 1}번`,
    isPitcher,
    base: record?.ability ?? [],
    profile: record?.profile ?? role & 3,
    specialNumber: (isPitcher ? pitcherRecord?.repertoire.magicId : batterRecord?.specialNumber) ?? 0,
    skillBits: 0,
    equipment: player.equipment ?? NO_EQUIPMENT,
    fieldPosition,
    isComplete: false,
  }
}

/** `0xb62b4(기록, n)` = (+0x14 >> n) & 1 — 장착 스킬 */
export function hasSeasonSkill(view: Pick<SeasonPlayerRecordView, 'skillBits'>, skill: number): boolean {
  return ((view.skillBits >>> skill) & 1) === 1
}

/** `0xb6704(기록)` = +0xb & 3 — 투수 보직(한계 행) · 타자 내야(0)/외야(1) */
export function seasonPositionBarOf(view: Pick<SeasonPlayerRecordView, 'profile'>): number {
  return view.profile & 3
}

/** 능력치 상한 — 0xb6494·0xb64ca 의 `min 999` */
const ABILITY_LIMIT = 999
/** 스킬 번호 (A 문서 · G-1a) */
export const SEASON_RECORD_SKILL = { 무력감: 5, 전설: 7, 수비불가: 20, 모든포지션: 21, 냉정: 22 } as const

/**
 * `0xb6415(기록, k, 1)` — 기본값에 장비·장착 스킬을 얹는다 (G-1a 확정, 마선수 배율은 위 머리 주석대로 건너뛴다):
 * ```
 * b6494  니블 n ≥ 1 → v = min(v + 0xd8890[n − 1], 999)
 * b64b0  스킬 5  → v = max(v − 100, 0)
 * b64ca  스킬 7  → v = min(v + 50, 999)
 * b64e6  투수 ∧ 스킬 22 ∧ k == 0 → v += v / 10        ; 자르지 않는다
 * b6512  타자 ∧ 스킬 20 ∧ k == 2 → v = max(v − 100, 0)
 * ```
 */
export function equippedSeasonAbilityOf(view: SeasonPlayerRecordView, slot: number): number {
  let value = view.base[slot] ?? 0
  const nibble = view.equipment[slot] ?? 0
  if (nibble >= 1) value = Math.min(value + equipmentBonusOf(nibble), ABILITY_LIMIT)
  if (hasSeasonSkill(view, SEASON_RECORD_SKILL.무력감)) value = Math.max(value - 100, 0)
  if (hasSeasonSkill(view, SEASON_RECORD_SKILL.전설)) value = Math.min(value + 50, ABILITY_LIMIT)
  if (view.isPitcher && hasSeasonSkill(view, SEASON_RECORD_SKILL.냉정) && slot === 0) value += Math.trunc(value / 10)
  if (!view.isPitcher && hasSeasonSkill(view, SEASON_RECORD_SKILL.수비불가) && slot === 2) value = Math.max(value - 100, 0)
  return value
}

/** 표 0xd1743 — 투수 한계 두 줄 (s8 × 10) · 0xd174b — 타자 타입 두 줄 */
const PITCHER_LIMIT_ROWS: readonly (readonly number[])[] = [[80, 80, 80, 80], [85, 85, 85, 60]]
const BATTER_LIMIT_ROWS: readonly (readonly number[])[] = [[80, 80, 80, 80], [80, 85, 75, 75]]
const LIMIT_SCALE = 10

/**
 * 능력치 상세 창의 "최대" 칸 — `0x5e864(skin, 창+0x14c, 0, …)` (0x897e8 의 부름 · 0x5e864 를 직접 떴다):
 * ```
 * 투수  0x5e864(skin, 칸, 0, 0, 0xb6704(기록), 0) → r = min(보직, 1) · 칸[k] = s8 0xd1743[r·4 + k] × 10
 * 타자  0x5e864(skin, 칸, 0, +0xb >> 5, 0, 1)    → 칸[k] = s8 0xd174b[(+0xb >> 5)·4 + k] × 10
 * ```
 * 표 값: 0xd1743 `[80,80,80,80, 85,85,85,60]` · 0xd174b `[80,80,80,80, 80,85,75,75]` (뒤는 0). 리그 타자 타입은 0·1 뿐이다.
 */
export function seasonAbilityLimitsOf(view: Pick<SeasonPlayerRecordView, 'isPitcher' | 'profile'>): readonly number[] {
  const row = view.isPitcher
    ? PITCHER_LIMIT_ROWS[Math.min(seasonPositionBarOf(view), 1)]
    : BATTER_LIMIT_ROWS[view.profile >> 5]
  return (row ?? [0, 0, 0, 0]).map((value) => value * LIMIT_SCALE)
}

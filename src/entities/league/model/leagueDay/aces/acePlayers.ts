import { renumberedRecordSlotsOf } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { aceLevelOf, aceLevelSlotOf, aceRecordAbilityAtLevel, aceSkillIdsOf } from '@/entities/mission/model/aceLevel'
import { ACE_BATTER_ENTRY_SLOT, ACE_BATTER_ROSTER_SLOT } from '@/entities/league/model/leagueDay/roster/slots'

/**
 * 마투수 레코드의 스태미나 `+0x2c` — 원본은 `0xb521c` 가 저장의 마투수 레코드(`0x1f824` = 앱 데이터 +0xac → +0xc64
 * + 번호×0x30)를 **+0x2c 까지 통째로** 팀 레코드 8번 칸에 복사한다. 그 레코드는 `0x20094` 의 6번 갈래가
 * `data/XlsACE_PIT_DATA.zt1` 의 0x30 바이트 행을 그대로 부어 만들고, 다섯 행 모두 +0x2c = `10 27` = **10000** 이다.
 * `0x1f824` 를 부르는 넷(0x48d50 · 0x5aefc · 0xaae7c · 0xb88c8)은 모두 복사해 가는 쪽이라 이 칸을 고치는 곳이 없다.
 */
export const ACE_PITCHER_RECORD_STAMINA = 10_000

/** 마투수 하나 — 간이 타석용 능력과 스태미나 용량의 바탕(체력 칸), 레코드 스태미나 */
export interface LeagueAcePitcher {
  readonly quick: QuickAtBatPitcher
  readonly staminaAbility: number
  /** 변화 칸 (능력 합 0xb5b50 용) */
  readonly breaking: number
  /** 레코드 +0x2c — 마운드에 오를 때 이 값으로 선다 */
  readonly stamina: number
  /** 레코드 +0x14 장착 스킬 비트 — XlsACE_PIT_DATA 행 그대로 (`acePlayers.skillBits`) */
  readonly skillBits: number
}

export function acePitcherOf(index: number, levels: Readonly<Record<number, number>> | undefined): LeagueAcePitcher | undefined {
  const ace = ACE_PITCHERS[index]
  if (ace === undefined) return undefined
  // 마투수 레코드 +0xc 부터 u16 넷 = 제구·구속·변화·체력 (acePlayers 의 hit·power·defense·run 칸 차례)
  const level = aceLevelOf(levels, aceLevelSlotOf('투수', index + 1))
  // 0xb570c 첫머리의 0xb6415(rec, k, 1) — 레벨 배율 뒤 장착 스킬(발렌타인 냉정 22 = 제구 + 1/10)
  const ability = aceRecordAbilityAtLevel(ace, level)
  return {
    // 0xb633c 비트6 — 간이 타석 보정 구조체에 구속·제구가 붙는다 (`quickSwingBoostOf`)
    quick: { control: ability.hit, velocity: ability.power, stamina: ability.run, skillIds: aceSkillIdsOf(ace), ace: { order: index, level } },
    staminaAbility: ability.run,
    breaking: ability.defense,
    stamina: ACE_PITCHER_RECORD_STAMINA,
    skillBits: ace.skillBits,
  }
}

export function aceBatterOf(index: number, levels: Readonly<Record<number, number>> | undefined): QuickAtBatBatter | undefined {
  const ace = ACE_BATTERS[index]
  if (ace === undefined) return undefined
  const level = aceLevelOf(levels, aceLevelSlotOf('타자', index + 1))
  const ability = aceRecordAbilityAtLevel(ace, level)
  // 0xb633c 비트6 — 간이 타석 보정 구조체에 히트·파워가 붙는다 (`quickSwingBoostOf`)
  // 레코드 칸 0xb6394 = XlsACE_BAT 행 +0xa (0x40 + 순번) & 0x1f = 순번
  return { hit: ability.hit, power: ability.power, run: ability.run, skillIds: aceSkillIdsOf(ace), recordSlot: index, ace: { order: index, level } }
}

/**
 * 마타자를 넣은 명단 — `0xb53f0` 은 9번(첫 벤치)에 넣으며 **옛 9번을 맨 끝으로 옮긴다**(b544a, 밀기가 아니다).
 * 벤치 타자 수 `team+0x28c` 가 하나 는다(0xb8870 b8898~b88b2) — CPU 대타 `rand(0, 벤치 수)` 의 범위가 3 → 4 다.
 */
export function withAceBatterLineup(lineup: QuickLineup): QuickLineup {
  const rosterSlots = [...lineup.rosterSlots]
  const records = [...lineup.records]
  const seated = rosterSlots[ACE_BATTER_ENTRY_SLOT]
  if (seated !== undefined) {
    rosterSlots.push(seated)
    records.push(records[ACE_BATTER_ENTRY_SLOT] ?? EMPTY_BATTER_GAME_RECORD)
  }
  rosterSlots[ACE_BATTER_ENTRY_SLOT] = ACE_BATTER_ROSTER_SLOT
  records[ACE_BATTER_ENTRY_SLOT] = EMPTY_BATTER_GAME_RECORD
  // 0xb8870 이 넣은 뒤 b889a 에서 0xb8768 로 다시 매긴다 — 맨 끝으로 밀린 옛 9번은 그 첨자(12)
  return { rosterSlots, records, benchBatters: lineup.benchBatters + 1, recordSlots: renumberedRecordSlotsOf(rosterSlots.length) }
}

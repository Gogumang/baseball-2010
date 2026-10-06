/**
 * **경기에 실린 마선수** — 나만의리그 142 경기 준비 진입 `0x1c46c` 가 두 팀에 넣는 마타자·마투수 (1c62e~1c660).
 *
 * 직접 떴다:
 * ```
 * 0x1c46c   0xb891c(팀[칸], [장면+0xcc] = 모드 3·4, 팀 번호, −1)       ; 팀 객체 +0x24 = 모드 · +0x25 = 팀
 * 1c62e     0xb88c8(내 팀, p) · 0xb8870(내 팀, b) · 0xb88c8(상대, 0x66968(p)) · 0xb8870(상대, 0x66994(b))
 *
 * 0xb88c8(팀, k)  명부 = 0xb8680(팀)            ; 팀 +0x24 − 1 의 점프표 0xd8a30 — 모드 3·4 는 0xb86c6 →
 *                                               ;   0x1f989(저장, 팀+0x25) = 모드 3 0x1f940 · 모드 4 0x1f8f8
 *                                               ;   (저장 블록 [g+0xb8]·[g+0xbc] + 0x1c·팀 + 4 — 나리 리그의 팀 레코드)
 *                 0xb521d(명부, 0x1f825(저장, k), 1) ; 마투수 레코드를 **명부 투수 8번 칸**에 (옛 8번은 맨 끝으로)
 *                 −1 이 아니면 0xb8768(팀)(팀 객체 차례를 명부로 다시 세움) · team+0x26 ++ · team+0x33(벤치 투수) ++
 * 0xb8870(팀, k)  같은 꼴 — 0x1f84d(저장, k) → 0xb53f1(명부, 레코드, 1) 로 **명부 타자 9번 칸**(첫 벤치, 옛 9번은 맨 끝),
 *                 team+0x27 ++ · team+0x28c(벤치 타자) ++
 * ```
 * 곧 마선수는 **저장 안의 나리 팀 레코드(명부)** 에 들어간다. 경기 장면 진입 0x39fdc 가 같은 `0xb891c(…, 모드, 팀)` 로
 * 팀 객체를 다시 세우므로 경기 팀에 그대로 실린다. 명부에서 마선수를 빼는 코드는 없다 — 그래서 109 로 물러났다 다시 142 에
 * 들어와도(장면+0x288 이 서 있어 굴리지 않는다) 같은 마선수가 남는다. 다음 장면의 142 가 새로 굴리면 `0xb521c`·`0xb53f0` 의
 * "그 칸이 이미 마선수면 덮어쓰고 −1" 가지(b524a · b541e)로 같은 칸이 갈린다 — 레코드째(+0x2c 스태미나 10000 포함) 덮인다.
 * 그래서 웹은 장면마다 굴린 넷을 세션이 들고 있다가 경기를 세울 때 넣는다(경기마다 새 레코드 — `leagueDay` 와 같은 눈).
 *
 * 마선수는 선발이 아니다 — 마타자는 CPU 대타(0xac228)로만, 마투수는 CPU 교체(0xac428 · 0xabfcc 는 마선수를 안 고른다)
 * 뒤에도 못 오르고 마운드 마선수 문턱으로만 본다(아래 `isSpecialPitcherAt`).
 */
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { aceAbilityAtLevel, aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { ACE_BATTER_ROSTER_SLOT, ACE_PITCHER_RECORD_STAMINA, ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay'
import type { AcePlayer } from '@/shared/config/original/acePlayers'

export { ACE_BATTER_ROSTER_SLOT, ACE_PITCHER_SLOT }

/** 마선수가 없다 — 표 0xd7638[0] = −1 */
export const NO_GAME_ACE = -1

/** 마타자를 넣는 명단 칸 — `0xb53f0` 의 `0x40` 가지가 9번 = 첫 벤치 칸 */
const ACE_BATTER_ENTRY_SLOT = 9

/** 한 팀에 실린 마선수 번호 (`ACE_BATTERS` · `ACE_PITCHERS` 칸 0~4, 없으면 −1) */
export interface GameTeamAces {
  readonly batter: number
  readonly pitcher: number
}

/** 경기 두 팀의 마선수 + 마선수 레벨 열 칸(`mgr[0x13a..]`, 능력치 배율 0xd88aa) */
export interface GameAceSetup {
  readonly ours: GameTeamAces
  readonly opponent: GameTeamAces
  readonly levels?: Readonly<Record<number, number>>
}

export const NO_GAME_ACES: GameTeamAces = { batter: NO_GAME_ACE, pitcher: NO_GAME_ACE }

export function acePitcherPlayerOf(index: number): AcePlayer | undefined {
  return index < 0 ? undefined : ACE_PITCHERS[index]
}

export function aceBatterPlayerOf(index: number): AcePlayer | undefined {
  return index < 0 ? undefined : ACE_BATTERS[index]
}

/** 마투수 하나 — 레벨 배율 먹은 네 칸 (레코드 +0xc 부터 제구·구속·변화·체력) */
export interface GameAcePitcher {
  readonly player: AcePlayer
  readonly quick: QuickAtBatPitcher
  readonly control: number
  readonly velocity: number
  readonly breaking: number
  readonly staminaAbility: number
}

export function gameAcePitcherOf(
  index: number,
  levels: Readonly<Record<number, number>> | undefined,
): GameAcePitcher | undefined {
  const player = acePitcherPlayerOf(index)
  if (player === undefined) return undefined
  const ability = aceAbilityAtLevel(player.ability, aceLevelOf(levels, aceLevelSlotOf('투수', index + 1)))
  return {
    player,
    quick: { control: ability.hit, velocity: ability.power, stamina: ability.run, skillIds: [] },
    control: ability.hit,
    velocity: ability.power,
    breaking: ability.defense,
    staminaAbility: ability.run,
  }
}

/** 마타자의 간이 타석 능력 — 레벨 배율을 먹는다 (0xb6414 첫 단계) */
export function gameAceBatterOf(
  index: number,
  levels: Readonly<Record<number, number>> | undefined,
): QuickAtBatBatter | undefined {
  const player = aceBatterPlayerOf(index)
  if (player === undefined) return undefined
  const ability = aceAbilityAtLevel(player.ability, aceLevelOf(levels, aceLevelSlotOf('타자', index + 1)))
  return { hit: ability.hit, power: ability.power, run: ability.run, skillIds: [] }
}

/**
 * 마타자를 넣은 명단 — `0xb53f0` 은 9번(첫 벤치)에 넣으며 **옛 9번을 맨 끝으로 옮긴다**(b544a, 밀기가 아니다).
 * 벤치 타자 수 `team+0x28c` 가 하나 는다(0xb8870 b8898~b88b2) — CPU 대타 `rand(0, 벤치 수)` 의 범위가 3 → 4 다.
 * (`entities/league/model/leagueDay` 의 CPU 끼리 경기와 같은 넣기)
 */
export function withAceBatterLineup(lineup: QuickLineup, aceIndex: number): QuickLineup {
  if (aceBatterPlayerOf(aceIndex) === undefined) return lineup
  const rosterSlots = [...lineup.rosterSlots]
  const records = [...lineup.records]
  const seated = rosterSlots[ACE_BATTER_ENTRY_SLOT]
  if (seated !== undefined) {
    rosterSlots.push(seated)
    records.push(records[ACE_BATTER_ENTRY_SLOT] ?? EMPTY_BATTER_GAME_RECORD)
  }
  rosterSlots[ACE_BATTER_ENTRY_SLOT] = ACE_BATTER_ROSTER_SLOT
  records[ACE_BATTER_ENTRY_SLOT] = EMPTY_BATTER_GAME_RECORD
  return { rosterSlots, records, benchBatters: lineup.benchBatters + 1 }
}

/** 마투수를 넣은 투수 차례 — 8번 칸(로스터 여덟 뒤 = 벤치 맨 끝)에 하나 더 (0xb521c, 벤치 투수 수 team+0x33 +1) */
export function withAcePitcherOrder(order: readonly number[], aceIndex: number): readonly number[] {
  return acePitcherPlayerOf(aceIndex) === undefined ? order : [...order, ACE_PITCHER_SLOT]
}

/** 마투수 칸의 스태미나 — 레코드째 복사해 온 +0x2c (`ACE_PITCHER_RECORD_STAMINA` = 10000) */
export function withAcePitcherStamina(table: readonly number[], aceIndex: number): readonly number[] {
  if (acePitcherPlayerOf(aceIndex) === undefined) return table
  const out = [...table]
  out[ACE_PITCHER_SLOT] = ACE_PITCHER_RECORD_STAMINA
  return out
}

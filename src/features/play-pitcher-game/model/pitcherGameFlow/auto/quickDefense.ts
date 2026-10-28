import { quickPitcherOf, teamPitchers } from '@/entities/team/model/teamRoster'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import type { RosterPlayer } from '@/shared/config/original/roster'
import type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { type HalfInningDefense, withQuickFightingSpirit } from '@/entities/game/model/simulateHalfInning'
import { hasFightingSpiritBit } from '@/entities/pitching/model/pitcherGameStats'
import { pitcherAbilitySumOf, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { GameAcePitcher } from '@/features/play-game/model/gameAces'
import {
  FIGHTING_SPIRIT_PITCHER_SKILL_ID,
  pitcherGameFightingSpiritOf,
  withSumFightingSpirit,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/fightingSpirit'
import {
  acePitcherSlotOf,
  opponentPitcherOrderOf,
  ourPitcherOrderOf,
  teamAcePitcherOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import { MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/optionsTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 공 하나 소모 0xa5e14 가 보는 레코드 +0x14 비트 — 비겁자 18 · 끈기 10 */
const COWARD_SKILL_BIT = 1 << 18
const ENDURE_SKILL_BIT = 1 << 10

/** 투수 목록 한 칸에 선 투수 — 내 육성 투수 · 142 가 넣은 마투수 · 붙박이 로스터 줄 */
type SlotPitcher =
  | { readonly kind: 'mine'; readonly quick: QuickAtBatPitcher }
  | { readonly kind: 'ace'; readonly ace: GameAcePitcher }
  | { readonly kind: 'roster'; readonly player: RosterPlayer; readonly equipment: readonly number[] | undefined }

/**
 * 한 팀의 수비 쪽 재료 — 투수 목록 차례·능력·사기. 모드 3 이라 `0xac428` 의 `[sp+4]` 가 서서
 * 내 투수(`MY_PITCHER_SLOT`)를 새 투수로 안 고른다 (`isOwnPlayerAt`).
 *
 * `bothTeamsAreCpu` 는 거짓 — 모드 3 경기 준비 `0x3a20a` 가 내 팀을 사람 팀으로 적는다. 다만 마무리 굴림 `0xac360` 은
 * 벤치에 마선수가 있을 때만(0xb8a8d) 돌아 이 화면 로스터에서는 돌지 않는다.
 * 사기는 용량 `0x66e44` 의 `V[+2]` — 0xaeb08 이 **그 투수 팀**의 레코드(0x1f9a8, 모드 3 → 0x1f940)를 찾아 읽는데, 그 칸은 셋업
 * 0x39fdc(3a332) · 실효 능력치 0xb570c(b5768)가 두 팀 모두 지금 나리 사기 0xa3a24 로 덮는다 → 두 팀 다 `options.teamMorale`.
 * (r87 의 "상대는 표값" 은 b5768 쓰기를 못 본 것이었다.) 간이 엔진 소모(0xa5e14)와 체력 막대가 같은 값을 본다.
 */
function quickDefenseOf(progress: PitcherGameProgress, isOurs: boolean): HalfInningDefense {
  const { options } = progress
  const teamId = isOurs ? options.ourTeamId : options.opponentTeamId
  const slotPitcherAt = slotPitcherFinderOf(options, isOurs)
  return {
    mound: isOurs ? progress.ourMound : progress.opponentMound,
    pitcherSlots: isOurs ? ourPitcherOrderOf(options) : opponentPitcherOrderOf(options),
    // 벤치 투수는 제 레코드 +0x2c 로 올라온다 — 리그 표에서 이어 온 값 (내 자리는 `stamina`)
    staminaAt: (slot) => (slotPitcherAt(slot).kind === 'mine' ? progress.stamina : (staminaTableFor(progress, isOurs)[slot] ?? FULL_STAMINA)),
    // 0xb570c 스킬 14 갈래 — 모드 3 은 정액이 없어 밑값에 곧장 v/10 (`withQuickFightingSpirit`, 장착은 skillIds 30)
    pitcherAt: (slot, fightingSpirit) => withQuickFightingSpirit(quickPitcherFor(slotPitcherAt(slot)), fightingSpirit),
    // 경기 장면 안 자동진행은 전역 상태 자체 — 이 반 이닝 득점은 공격 쪽(우리가 수비면 상대)에 얹는다
    fightingSpiritAt: (runs) => pitcherGameFightingSpiritOf(progress, teamId, { runs, offenseIsOurs: !isOurs }),
    // 투수 능력치 순서는 제구·구속·변화·**체력** (칸 3)
    staminaAbilityAt: (slot) => staminaAbilityFor(options, slotPitcherAt(slot)),
    lead: isOurs ? progress.game.ourScore - progress.game.opponentScore : progress.game.opponentScore - progress.game.ourScore,
    // 0xb570c b5768 이 두 팀 레코드 +2 를 공마다 지금 나리 사기로 덮는다 — 상대 팀도 같은 값 (`PitcherGameOptions.teamMorale`)
    morale: options.teamMorale,
    // 상대 첫 투수 첫 공의 앞 값 — 이 경기에서 상대 레코드가 아직 안 덮였을 때만 (`PitcherGameProgress.opponentRecordMorale`, r104)
    ...staleMoraleFor(progress, isOurs),
    bothTeamsAreCpu: false,
    isOwnPlayerAt: (slot) => slotPitcherAt(slot).kind === 'mine',
    // 0xb6dec 보직 — 로스터 칸 0~3 선발 · 4~6 중간 · 7 마무리. 내 투수(칸 8)는 표 밖이라 0xabfcc 목록에 안 든다
    roleAt: (slot) => (slotPitcherAt(slot).kind === 'roster' ? rosterPitcherRoleOf(slot) : undefined),
    // 마선수 0xb633c(+0xa 비트6) — 마운드면 특수 문턱(ac4f2), 벤치에 있으면 0xb8a8d 가 참이라 마무리 굴림 0xac360 을
    // 지나고, 0xabfcc 는 고르지 않는다 (`leagueDay.defenseOf` 와 같다)
    isSpecialPitcherAt: (slot) => slotPitcherAt(slot).kind === 'ace',
    // 공 하나 소모 0xa5e14 의 비겁자(비트 18) · 끈기(비트 10) — 레코드 +0x14. 내 투수는 장착 스킬(`pitcherIsCoward` ·
    // `pitcherEndures`, 사람 투구 `drainStamina` 와 같은 칸), 붙박이 줄은 Xls 행 그대로, 마투수도 제 행(`acePlayers.skillBits`)
    skillBitsAt: (slot) => skillBitsFor(options, slotPitcherAt(slot)),
    abilitySumAt: (slot, fightingSpirit) => abilitySumFor(options, slotPitcherAt(slot), fightingSpirit === true),
  }
}

/** 칸 → 그 칸의 투수. 142 가 명부 8번 칸에 넣은 마투수 — 웹 칸 번호는 우리 9(`OUR_ACE_PITCHER_SLOT`) · 상대 8 */
function slotPitcherFinderOf(options: PitcherGameOptions, isOurs: boolean): (slot: number) => SlotPitcher {
  const roster = teamPitchers(isOurs ? options.ourTeamId : options.opponentTeamId)
  const ace = teamAcePitcherOf(options, isOurs)
  const mine: SlotPitcher = { kind: 'mine', quick: myQuickPitcherOf(options) }
  return (slot) => {
    if (isOurs && slot === MY_PITCHER_SLOT) return mine
    if (ace !== undefined && slot === acePitcherSlotOf(isOurs)) return { kind: 'ace', ace }
    // 상대 레코드 장비 니블 (나리 새 시즌 0x665e8) — 내 팀은 굴리지 않는다
    const equipment = isOurs ? undefined : options.opponentEquipment?.pitchers?.[slot % roster.length]
    return { kind: 'roster', player: roster[slot % roster.length], equipment }
  }
}

function staminaTableFor(progress: PitcherGameProgress, isOurs: boolean): readonly number[] {
  return isOurs ? progress.ourPitcherStaminas : progress.opponentPitcherStaminas
}

function staleMoraleFor(progress: PitcherGameProgress, isOurs: boolean): { readonly staleMorale?: number } {
  const stale = progress.options.opponentStaleMorale
  if (isOurs || stale === undefined || progress.opponentRecordMorale !== undefined) return {}
  return { staleMorale: stale }
}

/** 내 투수의 간이 타석 능력 — 장착 스킬은 0xab214 ab91c~ 가 `0xb62b4(투수, n)` 로 레코드 +0x14 를 읽는다(모드 검사 없음) */
function myQuickPitcherOf(options: PitcherGameOptions): QuickAtBatPitcher {
  return {
    control: options.stats.control,
    velocity: options.stats.velocity,
    stamina: options.stats.stamina,
    skillIds: options.pitcherSkillIds ?? [],
    // 내 육성 투수 — 레코드 +0xa 비트7(0xb6389). 간이 타석에 서면 스트라이크존 기준 −10(c182a · c1880) · 0xab214 내 선수 보너스
    isOwnPlayer: true,
  }
}

function quickPitcherFor(pitcher: SlotPitcher): QuickAtBatPitcher {
  if (pitcher.kind === 'mine') return pitcher.quick
  if (pitcher.kind === 'ace') return pitcher.ace.quick
  return quickPitcherOf(pitcher.player, pitcher.equipment)
}

function staminaAbilityFor(options: PitcherGameOptions, pitcher: SlotPitcher): number {
  if (pitcher.kind === 'mine') return options.staminaAbility
  if (pitcher.kind === 'ace') return pitcher.ace.staminaAbility
  return pitcher.player.ability[3]
}

function skillBitsFor(options: PitcherGameOptions, pitcher: SlotPitcher): number {
  if (pitcher.kind === 'ace') return pitcher.ace.player.skillBits
  if (pitcher.kind === 'roster') return pitcher.player.skillBits
  return (options.pitcherIsCoward === true ? COWARD_SKILL_BIT : 0) | (options.pitcherEndures === true ? ENDURE_SKILL_BIT : 0)
}

/**
 * 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 0xb570c(팀, k, P, 1, 90, 1) 네 칸 합. 모드 3 은 팀 능력치(0x306)·코치
 * 정액이 없고 0xb574a 가지는 내 육성 선수(0xb6388)에만 붙는다 — 로스터 투수는 밑값을 0..999 로 자른 합.
 * 내 투수는 0xabfcc 가 모드 3 에서 거르므로(내선수거름) 그 칸 값은 쓰이지 않는다 — 실효 능력치 네 칸 합을 둔다.
 * 스킬 14 갈래(b5a16~b5a72)는 칸 0~2 에 v/10 을 얹고 자른다
 */
function abilitySumFor(options: PitcherGameOptions, pitcher: SlotPitcher, fightingSpirit: boolean): number {
  if (pitcher.kind === 'mine') {
    const ability = [options.stats.control, options.stats.velocity, options.stats.breaking, options.staminaAbility]
    return pitcherAbilitySumOf(
      withSumFightingSpirit(ability, fightingSpirit && (options.pitcherSkillIds ?? []).includes(FIGHTING_SPIRIT_PITCHER_SKILL_ID)),
    )
  }
  if (pitcher.kind === 'ace') {
    const { ace } = pitcher
    const ability = [ace.control, ace.velocity, ace.breaking, ace.staminaAbility]
    return pitcherAbilitySumOf(withSumFightingSpirit(ability, fightingSpirit && hasFightingSpiritBit(ace.player.skillBits)).map(clampAbility))
  }
  const ability = rosterPitcherAbilityOf(pitcher.player, pitcher.equipment)
  return pitcherAbilitySumOf(withSumFightingSpirit(ability, fightingSpirit && hasFightingSpiritBit(pitcher.player.skillBits)).map(clampAbility))
}

/**
 * 붙박이 투수 줄의 능력치 — 레코드 장비 니블이 있으면 `0xb6414(rec, k, 1)`(니블 보너스 뒤 장착 스킬 단계), 없으면 행 그대로
 * (리그 열 팀 Xls 행은 니블 0 이고 스킬 5 · 7 · 22 비트도 없어 예전 값과 같다).
 */
function rosterPitcherAbilityOf(player: RosterPlayer, equipment: readonly number[] | undefined): readonly number[] {
  return equipment === undefined ? player.ability : recordAbilityOf({ ...player, equipment }, true)
}

/** 0xb5b06 — 경기용 능력치를 0..999 로 자른다 */
const clampAbility = (value: number) => Math.min(999, Math.max(0, value))

export function ourQuickDefenseOf(progress: PitcherGameProgress): HalfInningDefense {
  return quickDefenseOf(progress, true)
}

export function opponentQuickDefenseOf(progress: PitcherGameProgress): HalfInningDefense {
  return quickDefenseOf(progress, false)
}

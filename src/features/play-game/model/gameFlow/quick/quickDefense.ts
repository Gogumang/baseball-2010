import { type HalfInningMound, type HalfInningDefense, withQuickFightingSpirit } from '@/entities/game/model/simulateHalfInning'
import { type GameAcePitcher, ACE_PITCHER_SLOT } from '@/features/play-game/model/gameAces'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { type TeamRecordEquipment, teamPitchers, quickPitcherOf } from '@/entities/team/model/teamRoster'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { rosterPitcherRoleOf, pitcherAbilitySumOf } from '@/entities/pitching/model/pitcherChange'
import { hasFightingSpiritBit, withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import { gameFightingSpiritOf } from '@/features/play-game/model/gameFlow/context/fightingSpirit'
import { teamAcePitcherOf } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import { ALL_PITCHER_SLOTS } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 한 팀의 수비 쪽 재료 (`HalfInningDefense`) — `leagueDay.defenseOf` 와 같은 모양이다.
 *
 * `bothTeamsAreCpu` 는 **거짓**이다: 모드 3·4 경기 준비 `0x3a20a` 가 `0xb6c18(state, 내 팀, 0)`·
 * `(state, 상대, 1)` 로 내 팀을 사람 팀으로 적는다 (R8 · S11). 그래도 마무리 투입 굴림 `0xac360` 은
 * **벤치에 마선수가 있을 때만(0xb8a8d)** 돈다 — 로스터 투수에는 마선수가 없어 이 경기에서는 안 굴러간다.
 *
 * 보직(`+0xb & 3`, 0xb6dec)은 로스터 칸 표 `rosterPitcherRoleOf`(칸 0~3 선발 · 4~6 중간 · 7 마무리)로 넘긴다 —
 * 판정 0xac428 이 마운드 보직을, 새 투수 고르기 0xabfcc 가 벤치 보직을 본다. 안 넘기면 모두 선발로 보여
 * 9회 이후 마무리 상황마다 매 타자 투수가 바뀐다(58066a1 뒤의 회귀).
 *
 * 팀 사기(`0x66e44` 의 `V[+2]`)는 0xaeb08 이 **그 투수 팀**의 레코드(0x1f9a8, 모드 4 → 0x1f8f8 `[저장+0xbc]+4+0x1c·팀`)를 찾아 읽는다.
 * 그 칸 +2 는 경기 셋업 0x39fdc(3a332) · 실효 능력치 0xb570c(b5768)가 두 팀 모두 **지금 나리 사기** 0xa3a24 로 덮는다
 * (`GameProgress.teamMorale` 머리말) — 그래서 두 팀이 같은 값이다. 투구 소모(0xa5e14)의 용량과 상대 마운드 체력 막대(`opponentMoundOf`)가
 * 같은 값을 본다. (r87 의 "상대 팀은 표값" 은 0xb570c 의 b5768 쓰기를 못 본 것이었다)
 */
export function quickDefenseOf(
  teamId: number,
  mound: HalfInningMound,
  lead: number,
  /** 투수 레코드 차례 — 벤치를 이 차례로 훑는다 (`GameProgress.…PitcherOrder`) */
  order: readonly number[] = ALL_PITCHER_SLOTS,
  /** 칸별 레코드 스태미나 — 벤치 투수는 이 값으로 올라온다 */
  staminas?: readonly number[],
  /** 142 가 명부 8번 칸에 넣은 마투수 (`order` 에 8 이 들어 있다) */
  ace?: GameAcePitcher,
  /** 그 팀 레코드 +2 — 나리 사기(`GameProgress.teamMorale`). 안 넘기면 표값 */
  morale: number = teamRecordMoraleOf(teamId),
  /** 그 레코드 +2 의 앞 값 — 첫 투수 첫 공만 (`HalfInningDefense.staleMorale`) */
  staleMorale?: number,
  /** 그 팀 레코드 장비 니블 (`GameProgress.opponentEquipment`) — 상대 팀만. 없으면 Xls 행 */
  equipment?: TeamRecordEquipment,
  /** 스킬 14(투지) 갈래의 경기 상태 — 이 반 이닝 득점을 받아 (`HalfInningDefense.fightingSpiritAt`, `gameFightingSpiritOf`) */
  fightingSpiritAt?: (runsThisHalf: number) => boolean,
): HalfInningDefense {
  const roster = teamPitchers(teamId)
  const recordAt = (slot: number) => withRecordEquipment(roster[slot % roster.length], equipment?.pitchers?.[slot % roster.length], true)
  const isAce = (slot: number) => ace !== undefined && slot === ACE_PITCHER_SLOT
  return {
    mound,
    pitcherSlots: order,
    ...(staminas === undefined ? {} : { staminaAt: (slot: number) => staminas[slot] ?? FULL_STAMINA }),
    // 0xb570c 스킬 14 갈래 — 모드 4 는 정액이 없어 밑값에 곧장 v/10 (`withQuickFightingSpirit`)
    pitcherAt: (slot, fightingSpirit) =>
      withQuickFightingSpirit(
        isAce(slot) && ace !== undefined ? ace.quick : quickPitcherOf(roster[slot % roster.length], equipment?.pitchers?.[slot % roster.length]),
        fightingSpirit,
      ),
    ...(fightingSpiritAt === undefined ? {} : { fightingSpiritAt }),
    // 투수 능력치 순서는 제구·구속·변화·**체력** (칸 3)
    staminaAbilityAt: (slot) => (isAce(slot) && ace !== undefined ? ace.staminaAbility : roster[slot % roster.length].ability[3]),
    lead,
    morale,
    ...(staleMorale === undefined ? {} : { staleMorale }),
    bothTeamsAreCpu: false,
    roleAt: rosterPitcherRoleOf,
    // 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 0xb570c(팀, k, P, 1, 90, 1) 네 칸 합. 모드 4 는 0xb574a 가지가 내 육성
    // 선수(0xb6388)에만 붙고 팀 능력치(0x306)·코치(모드 2) 정액이 없어 로스터 밑값을 0..999 로 자른 합이다
    // 스킬 14 갈래(b5a16~b5a72)는 칸 0~2 에 v/10 을 얹고 자른다 (칸 3 체력은 빠진다)
    abilitySumAt: (slot, fightingSpirit) =>
      isAce(slot) && ace !== undefined
        ? pitcherAbilitySumOf(
            withSumFightingSpirit(
              [ace.control, ace.velocity, ace.breaking, ace.staminaAbility],
              fightingSpirit === true && hasFightingSpiritBit(ace.player.skillBits),
            ).map(clampAbility),
          )
        : pitcherAbilitySumOf(
            withSumFightingSpirit(recordAt(slot).ability, fightingSpirit === true && hasFightingSpiritBit(recordAt(slot).skillBits)).map(
              clampAbility,
            ),
          ),
    // 마선수 0xb633c(+0xa 비트6) — 마투수 8번 칸. 마운드면 특수 문턱(ac4f2), 벤치에 있으면 0xb8a8d 가 참이라
    // 마무리 굴림 0xac360 을 지나고, 0xabfcc 는 고르지 않는다 (`leagueDay.defenseOf` 와 같다). 보직은 칸 8 이 표 밖이라 없다
    isSpecialPitcherAt: isAce,
    // 공 하나 소모 0xa5e14 의 비겁자(비트 18) · 끈기(비트 10) — 레코드 +0x14. 붙박이 줄은 Xls 행 그대로, 마투수도 제 행
    // (`acePlayers.skillBits` — 다섯 줄 모두 두 비트가 0 이라 소모는 같다)
    skillBitsAt: (slot) => (isAce(slot) && ace !== undefined ? ace.player.skillBits : roster[slot % roster.length].skillBits),
  }
}

/**
 * 레코드 장비 니블이 있으면 그 행의 능력치를 `0xb6414(rec, k, 1)` 값으로 — 니블 보너스 뒤 장착 스킬 단계(`recordAbilityOf`).
 * 니블이 없으면 행 그대로 둔다(리그 열 팀 Xls 행은 니블 0 이고 스킬 5 · 7 · 20 · 22 비트도 없어 예전 값과 같다).
 */
export function withRecordEquipment<T extends RosterPlayer>(row: T, equipment: readonly number[] | undefined, isPitcher: boolean): T {
  if (equipment === undefined) return row
  return { ...row, ability: recordAbilityOf({ ...row, equipment }, isPitcher) }
}

/** 0xb5b06 — 경기용 능력치를 0..999 로 자른다 */
const clampAbility = (value: number) => Math.min(999, Math.max(0, value))

/** 능력 합 0xb5b50 의 네 칸에 스킬 14 갈래 — 칸 0~2 만 `v += v/10` (b5a48 칸 ≠ 3) */
function withSumFightingSpirit(ability: readonly number[], on: boolean): readonly number[] {
  return on ? ability.map((value, slot) => (slot === 3 ? value : withFightingSpirit(value))) : ability
}

/** 우리가 공격 중일 때 상대 팀 수비 — 리드는 상대 점수 − 우리 점수 */
export function opponentQuickDefenseOf(progress: GameProgress): HalfInningDefense {
  return quickDefenseOf(
    progress.opponentTeamId,
    progress.opponentMound,
    progress.game.opponentScore - progress.game.ourScore,
    progress.opponentPitcherOrder,
    progress.opponentPitcherStaminas,
    teamAcePitcherOf(progress, false),
    // 0xb570c b5768 이 상대 팀 레코드 +2 에도 나리 사기를 쓴다 (`GameProgress.teamMorale`)
    progress.teamMorale,
    // 이 경기에서 아직 안 덮였을 때만 앞 값 (`GameProgress.opponentRecordMorale`)
    progress.opponentRecordMorale === undefined ? progress.opponentStaleMorale : undefined,
    progress.opponentEquipment,
    // 우리가 공격 — 이 반 이닝 득점은 우리 쪽
    (runs) => gameFightingSpiritOf(progress, progress.opponentTeamId, { runs, offenseIsOurs: true }),
  )
}

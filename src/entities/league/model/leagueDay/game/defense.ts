import type { HalfInningDefense } from '@/entities/game/model/simulateHalfInning'
import type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { FULL_STAMINA, abilityAfterFatigue } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherAbilitySumOf, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { hasFightingSpiritBit } from '@/entities/pitching/model/pitcherGameStats'
import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'
import { cpuPitcherGameAbilityOf } from '@/entities/league/model/leagueDay/ability/cpuGameAbility'
import type { LeagueAcePitcher } from '@/entities/league/model/leagueDay/aces/acePlayers'
import { leagueFightingSpiritOf } from '@/entities/league/model/leagueDay/game/fightingSpirit'
import type { LeagueHalfInningGameState } from '@/entities/league/model/leagueDay/game/fightingSpirit'
import type { LeagueGameSide } from '@/entities/league/model/leagueDay/game/gameSides'
import { ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay/roster/slots'
import { recordPitcherAbilityAt, recordPitcherRowAt, recordPlayerAt, recordQuickPitcherAt } from '@/entities/league/model/leagueDay/roster/teamRecord'

/**
 * 한 팀의 수비 쪽 재료 (`HalfInningDefense`) — 반 이닝마다 리드와 마운드만 갈아 끼운다.
 *
 * `bothTeamsAreCpu` 는 **참**이다: 하루치 리그 경기는 양 팀 다 CPU 조작이라 마무리 투입 굴림
 * 0xac360 이 첫 줄에서 0 을 돌려준다 (`state[0x31+0]==1 && state[0x31+1]==1`, 0xb6c20).
 * 그래서 리그 경기의 새 투수는 **늘 0xabfcc** 로 고른다.
 */
export function leagueDefenseOf(
  side: LeagueGameSide,
  lead: number,
  abilityContext: LeagueAbilityContext | undefined,
  /** 이 CPU 경기 자신의 상태(sim+0x60 — 스택 상태) — B-107 고친 길의 스킬 14 갈래가 본다 */
  ownGame: LeagueHalfInningGameState,
): HalfInningDefense {
  const { teamId, record, acePitcher, mound, staminas } = side
  /** 그 칸이 마투수 자리(8번)이고 마투수가 앉았으면 그 마투수 */
  const aceAt = (slot: number): LeagueAcePitcher | undefined => (slot === ACE_PITCHER_SLOT ? acePitcher : undefined)
  /** 그 칸 투수의 밑값 간이 능력 (마투수는 레벨 배율을 먹은 레코드 값) */
  const quickAt = (slot: number): QuickAtBatPitcher => aceAt(slot)?.quick ?? recordQuickPitcherAt(record, teamId, slot)
  /** 그 칸 레코드 +0x14 장착 비트 — 마투수는 XlsACE_PIT 행(붕붕머신 0x16000 은 섰다) */
  const skillBitsAt = (slot: number) => aceAt(slot)?.skillBits ?? recordPitcherRowAt(record, teamId, slot).skillBits
  /** 그 칸 레코드의 투지(비트 14) ∧ 이 순간 경기 상태 */
  const spiritAt = (slot: number, fightingSpirit: boolean | undefined) => fightingSpirit === true && hasFightingSpiritBit(skillBitsAt(slot))
  /** 칸 k 의 경기용 능력치 `0xb570c(…, 1, 90, 1)` — 밑값(0xb6414) 위에 팀 능력치 정액 · 코치 */
  const gameAbility = (base: number, k: number, spirit: boolean) => cpuPitcherGameAbilityOf(base, k, teamId, abilityContext, spirit)
  return {
    mound,
    // 마투수는 명단 8번 칸 = 벤치 맨 끝에 하나 더 (0xb88c8 → 0xb521c, 벤치 투수 수 team+0x33 +1)
    pitcherSlots: acePitcher === undefined ? side.pitcherOrder : [...side.pitcherOrder, ACE_PITCHER_SLOT],
    pitcherAt: (slot, fightingSpirit) => {
      const quick = quickAt(slot)
      const spirit = spiritAt(slot, fightingSpirit)
      return { ...quick, control: gameAbility(quick.control, 0, spirit), velocity: gameAbility(quick.velocity, 1, spirit) }
    },
    // 체력%로 부른 `0xb570c` — 피로 0xb58e6 이 팀 정액 · 코치보다 먼저 먹는다 (simulateHalfInning `tiredPitcherAt`)
    tiredPitcherAt: (slot, staminaPercent, fightingSpirit) => {
      const quick = quickAt(slot)
      const spirit = spiritAt(slot, fightingSpirit)
      return {
        control: gameAbility(abilityAfterFatigue(quick.control, staminaPercent), 0, spirit),
        velocity: gameAbility(abilityAfterFatigue(quick.velocity, staminaPercent), 1, spirit),
      }
    },
    // 0xb570c 스킬 14 갈래의 경기 상태 — CPU 끼리 경기(0xc239c · 0xc2a48 · 0xc2760 · 0xc2dac)는 0xc0dac 에 제 스택 상태를 넘겨
    // 전역 [0x1552d0c] 를 안 건드리지만 0xb570c 는 늘 전역을 읽는다 → **마지막 사람 경기**의 이닝 · 측별 팀 · 점수가 그대로다.
    // 팀은 넘겨 받은 팀 레코드 +0 = 이 팀 번호 — 그 경기 +0x28 팀이 아니면 측 1 이다 (A-23).
    // **B-107 고친 길**: 이 경기 자신의 상태(0xc0dac 가 sim+0x60 에 둔 스택 상태 — 0xb6b6c 이닝 · 0xb6a9c 득점이 그 칸을 굴린다)로
    // 이닝 · 측별 팀(원정 · 홈) · 지금 점수(반 이닝 앞 점수 + 이번 반 이닝 득점)를 본다
    fightingSpiritAt: (runsThisHalf) => leagueFightingSpiritOf(ownGame, runsThisHalf, teamId),
    // 투수 능력치 순서는 제구·구속·변화·**체력** (칸 3) — 용량 0x66e44 는 `0xb6415(P, 3, 1)` 이라 장비 니블을 먹는다
    staminaAbilityAt: (slot) => aceAt(slot)?.staminaAbility ?? recordPitcherAbilityAt(record, teamId, slot)[3] ?? 0,
    // 벤치 투수는 제 레코드 값으로 올라온다 — 경기 사이에 이어진 값
    staminaAt: (slot) => staminas[slot] ?? FULL_STAMINA,
    lead,
    // 나리는 0xb570c b5768 이 두 팀 레코드 +2 를 나리 사기로 덮는다(`LeagueAbilityContext.nariMorale`) — 시즌모드는 표값 100
    ...(abilityContext?.nariMorale === undefined ? {} : { morale: abilityContext.nariMorale }),
    bothTeamsAreCpu: true,
    // 보직 `+0xb & 3` — 로스터 투수 표 칸 0~3 선발 · 4~6 중간 · 7 마무리 (0xb6dec). 로테이션 0xb5ca8 은 선발 넷만
    // 섞어 칸의 보직이 그대로다. 마투수(8번)의 보직은 저장 레코드라 모른다 → 선발로 본다(changePitcherIfNeeded).
    // 트레이드로 옮겨 온 투수는 레코드째 와서 제 표 칸의 보직을 든다
    roleAt: (slot) => rosterPitcherRoleOf(slot === ACE_PITCHER_SLOT ? slot : recordPlayerAt(record, teamId, true, slot).tableSlot),
    // 마선수 0xb633c(+0xa 비트6) — 마투수 8번 칸. 마운드면 특수 문턱(ac4f2), 벤치에 있으면 0xb8a8d 가 참이라
    // 마무리 굴림 0xac360 을 지나고(CPU 끼리라 0xb6c20 이 늘 거짓), 0xabfcc 는 고르지 않는다(ac084)
    isSpecialPitcherAt: (slot) => aceAt(slot) !== undefined,
    // 공 하나 소모 0xa5e14 의 비겁자(비트 18) · 끈기(비트 10) — 레코드 +0x14. 마투수 다섯 줄은 두 비트가 모두 0 이다(XlsACE_PIT_DATA 행 바이트 0x14~0x17)
    skillBitsAt,
    // 마무리 갈래(ac0be)의 정렬 열쇠 0xb5b50 = 경기용 능력치(체력 인자 90) 네 칸 합. 마투수는 0xabfcc 가 거르므로
    // 그 칸 값은 쓰이지 않는다 — 레벨 배율 먹은 네 칸을 그대로 둔다
    abilitySumAt: (slot, fightingSpirit) => {
      const ace = aceAt(slot)
      if (ace !== undefined) return pitcherAbilitySumOf([ace.quick.control, ace.quick.velocity, ace.breaking, ace.staminaAbility])
      const spirit = spiritAt(slot, fightingSpirit)
      return pitcherAbilitySumOf(recordPitcherAbilityAt(record, teamId, slot).map((base, k) => gameAbility(base, k, spirit)))
    },
  }
}

/**
 * 1회초 수비 팀(home)의 레코드 +2 앞 값 — 첫 투수 첫 공만 본다 (`LeagueAbilityContext.staleRecordMorales`).
 * 원정 팀도 1회초 공격에서 한 번도 안 덮였으면 1회말 첫 공에 같은 값을 본다 (`HalfInningResult.offenseRecordTouched`, r104)
 */
export function withStaleMorale(defense: HalfInningDefense, staleMorale: number | undefined): HalfInningDefense {
  return staleMorale === undefined ? defense : { ...defense, staleMorale }
}

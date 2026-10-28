import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { NO_ACE_BATTER, NO_ROSTER_SLOT, entryPitcherGameAbilityParts } from '@/features/play-team-game/model/teamGameRoster'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { pitcherGameStatsOf } from '@/entities/pitching/model/pitcherGameStats'
import type { LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import { staminaCapacityOf, pitchStaminaCostOf, consumeStamina, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherAbilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import {
  entryAbilitiesAt,
  entryBatterSkillIdsOf,
  entryBattersOf,
  entryPitcherSkillIdsOf,
} from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { pitcherAbilitiesAt, pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { aceBatterLevelOf } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 간이 타석 엔진이 보는 타자 — 히트·파워·주루만 쓴다 */
export function entryQuickBatterOf(progress: TeamGameProgress, teamId: number, slot: number): QuickAtBatBatter {
  const ability = entryAbilitiesAt(progress, teamId, slot)
  const entry = entryBattersOf(progress, teamId)[slot]
  const aceIndex = entry?.aceIndex ?? NO_ACE_BATTER
  return {
    hit: ability[0],
    power: ability[1],
    run: ability[3],
    // 장착 스킬 — 0xab214 ab91c~ 가 `0xb62b4(타자, n)` 로 레코드 +0x14 를 모드 검사 없이 읽는다 (마타자는 제 행)
    skillIds: entryBatterSkillIdsOf(entry),
    // 레코드 칸 0xb6394 — 경기 시작 명단 첨자 · 마타자 순번 (`TeamEntryBatter.recordSlot`, 사람 타석 투수 스킬 31 과 같은 값)
    ...(entry?.recordSlot === undefined ? {} : { recordSlot: entry.recordSlot }),
    // 기록으로 선 표 밖 타자(영입한 명전 · 나리)는 레코드 +0xa 비트7(0xb6389) — 0xab214 의 내 선수 갈래가 레코드를 직접 읽는다
    ...(entry !== undefined && aceIndex < 0 && entry.rosterSlot === NO_ROSTER_SLOT ? { isOwnPlayer: true } : {}),
    // 0xc11f0 c1226 — 마타자면 보정 구조체 out+0 · +2 에 D[0x100/0x132 + 2k] (k = 레벨·5 + 순번, `quickSwingBoostOf`)
    ...(aceIndex >= 0 ? { ace: { order: aceIndex, level: aceBatterLevelOf(progress, aceIndex) } } : {}),
  }
}

/** 간이 타석 엔진이 보는 투수 — 제구·구속·체력만 쓴다 */
export function entryQuickPitcherOf(progress: TeamGameProgress, teamId: number, slot: number): QuickAtBatPitcher {
  const ability = pitcherAbilitiesAt(progress, teamId, slot)
  const entry = pitcherEntryAt(progress, teamId, slot)
  return {
    control: ability[0],
    velocity: ability[1],
    stamina: ability[3],
    // 장착 스킬 — `0xb62b4(투수, n)` (투수 번호 = 비트 + 16). 마투수는 제 행(XlsACE_PIT +0x14)
    skillIds: entryPitcherSkillIdsOf(entry),
    // 손 0xb63c0 — 마투수(+0xa 비트6)는 폼 7·9·10 이 0, 그 밖은 폼 & 1 (0xab214 의 스킬 13·14)
    ...(entry === undefined ? {} : { hand: pitcherHandOf(entry.repertoire.form, entry.aceIndex >= 0) }),
    // 0xc11f0 c1278 — 마투수면 보정 구조체 out+4 · +6 에 D[0xce/0x9c + 2k] (레벨 = mgr[0x13a + 순번])
    ...(entry !== undefined && entry.aceIndex >= 0
      ? { ace: { order: entry.aceIndex, level: aceLevelOf(progress.options.aceLevels, aceLevelSlotOf('투수', entry.aceIndex + 1)) } }
      : {}),
    // 기록으로 선 표 밖 투수(영입한 명전 · 나리)는 레코드 +0xa 비트7(0xb6389) — 스트라이크존 기준 −10(c182a · c1880)
    ...(entry !== undefined && entry.aceIndex < 0 && entry.tableSlot === undefined ? { isOwnPlayer: true } : {}),
  }
}

/**
 * 간이 타석의 **체력%로 부른 제구 · 구속** — 0xc11f0 · 0xc1818 의 세 자리(구위 등급 · 스트라이크존 · 0xab214 투수 쪽)가
 * `0xb570c(…, 체력% 0xaebb0, 1)` 로 부른다: 피로 0xb58e6 을 팀 능력치 · 코치 정액보다 **먼저** 먹인다(`pitcherGameStatsOf`).
 */
export function entryQuickTiredOf(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
  staminaPercent: number,
): { readonly control: number; readonly velocity: number } | undefined {
  const entry = pitcherEntryAt(progress, teamId, slot)
  if (entry === undefined) return undefined
  const stats = pitcherGameStatsOf(entryPitcherGameAbilityParts(pitcherAbilityContextOf(progress), teamId, entry), staminaPercent)
  return { control: stats.control, velocity: stats.velocity }
}

/**
 * 간이 타석 도루(0xc1818 끝 c1a42~c1a98)의 리그 기록 — 루를 옮긴 주자마다 `0xa56dc(ctx, 주자, 0)` 이 참이면 그 레코드 +0x2c.
 * 게이트가 **주자 자신**을 본다(사람 판 도루와 다르다) — 마선수 주자만 빠진다. 모드 · 포스트시즌 거르기는 기록표에 넣는 쪽이 맡는다.
 * 주자는 신원(타순 칸, `playQuickPlateAppearance` 의 `stolenRunners`)대로다.
 */
function quickLeagueStolenBasesOf(progress: TeamGameProgress, ours: boolean, stolenRunners: readonly number[]): readonly LeagueStolenBase[] {
  const teamId = ours ? progress.options.ourTeamId : progress.options.opponentTeamId
  const entry = ours ? progress.ourEntry : progress.opponentEntry
  const stolen: LeagueStolenBase[] = []
  for (const slot of stolenRunners) {
    if ((entry[slot]?.aceIndex ?? NO_ACE_BATTER) >= 0) continue
    const rosterSlot = entry[slot]?.rosterSlot ?? slot
    if (rosterSlot === NO_ROSTER_SLOT) {
      const recordId = entry[slot]?.recordId
      if (recordId !== undefined) stolen.push({ teamId, battingOrderIndex: NO_ROSTER_SLOT, recordId })
      continue
    }
    stolen.push({ teamId: entry[slot]?.tableTeamId ?? teamId, battingOrderIndex: rosterSlot })
  }
  return stolen
}

/** 간이 타석 도루의 리그 기록을 진행에 얹을 칸 — 없으면 빈 것 */
export function withQuickSteals(
  progress: TeamGameProgress,
  ours: boolean,
  stolenRunners: readonly number[],
): { readonly leagueStolenBases?: readonly LeagueStolenBase[] } {
  const stolen = quickLeagueStolenBasesOf(progress, ours, stolenRunners)
  return stolen.length === 0 ? {} : { leagueStolenBases: [...(progress.leagueStolenBases ?? []), ...stolen] }
}

/**
 * 간이 타석의 투구 한 개마다 수비 팀 투수의 스태미나가 깎이고 투구 수가 는다 (0xa5e14).
 *
 * 원본 `0xc262c` 의 공 고리는 c26be 0xa5c2d → **c26c8 0xa5e14(소모)** → c26d4 rand(0,100) 경로 굴림 →
 * 0xc11f0/0xc1818 차례다 — 공 하나가 보는 체력%(0xaebb0)는 **그 공의 소모까지 먹은 값**이다
 * (`simulateHalfInning` 의 `beforePitch` 와 같다, d9d376c). 그래서 `playQuickAtBat` 의 `beforePitch` 갈고리로
 * 공마다 한 번 깎고, 그 공의 투수 체력%를 `QuickAtBatPitcher.stamina` 에 실어 돌려준다(0 이면 0xab214 탈진 갈래·
 * 제구 등급 지친 갈래). 갈고리는 난수를 쓰지 않는다.
 *
 * 간이 엔진 소모는 늘 구질 1(`0xa5e14` 의 c26c8 인자) — `pitchStaminaCostOf` 의 기본 소모다.
 * 용량 X 는 그 투수의 체력 능력치(칸 3)와 팀 사기로 구한다 (0x66e44).
 */
interface QuickPitcherDrain {
  /** 공 하나를 던지기 앞 — 깎고 그 공의 투수(체력% 실음)를 돌려준다 */
  readonly beforePitch: () => QuickAtBatPitcher
  /** 지금까지 깎은 스태미나 */
  readonly stamina: () => number
}

export function quickPitcherDrainOf(
  pitcher: QuickAtBatPitcher,
  stamina: number,
  staminaAbility: number,
  teamMorale: number,
  isFirstPitcher: boolean,
  /** 수비 투수 레코드 +0x14 의 비겁자 · 끈기 (`pitcherSkillFlagsAt`) */
  skillFlags: { readonly pitcherIsCoward: boolean; readonly pitcherEndures: boolean },
  /** 이 타석 타자의 스킬 22 압도 — 0xa5e14 a5f32 의 0xb62b4(공격 팀 지금 타자, 22) (`entryBatterIntimidatesAt`) */
  batterIntimidates: boolean,
  /** 그 공의 체력%로 부른 제구 · 구속 (`entryQuickTiredOf`) — 없으면 피로 없이 */
  tiredAt?: (staminaPercent: number) => { readonly control: number; readonly velocity: number } | undefined,
): QuickPitcherDrain {
  const capacity = staminaCapacityOf(staminaAbility, teamMorale, isFirstPitcher)
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: 1,
    batterIntimidates,
    ...skillFlags,
  })
  let current = stamina
  return {
    beforePitch: () => {
      current = consumeStamina(current, cost, capacity)
      const percent = staminaPercentOf(current)
      const tired = tiredAt?.(percent)
      return { ...pitcher, stamina: percent, ...(tired === undefined ? {} : { tired }) }
    },
    stamina: () => current,
  }
}

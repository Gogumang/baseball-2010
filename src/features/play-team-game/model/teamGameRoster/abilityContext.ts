import { TEAMS } from '@/shared/config/original/teams'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { hasFightingSpiritBit, TEAM_ABILITY_SLOT } from '@/features/play-team-game/model/gameAbilities'
import type { FieldingAssignment, SeasonTeamCondition } from '@/features/play-team-game/model/gameAbilities'
import { defenseTeamBonusOf, runnerTeamGradeOf } from '@/entities/fielding/model/fieldingState'

/** XlsTEAM_DATA 한 줄의 u16 6개 중 뒤 4개가 팀 능력치다 (앞 둘은 id·100) */
const TEAM_ABILITY_OFFSET = 2

/**
 * 붙박이 표 줄의 **`0xb6414(rec, k, 1)`** 네 칸 — 장비 니블 · 장착 스킬을 먹인 밑값 (`recordAbilityOf`).
 * 경기용 능력치 `0xb570c` 는 맨 앞에서 이 값을 받는다(b5728). `equipment` 를 주면 레코드의 장비 니블이 그 값이다
 * (시즌 저장 명단 — 새 해 CPU 장비 0x665e8 · 내 팀 장비 창 0x7d90). 없으면 Xls 행의 니블(리그 열 팀은 0, 외인구단만 차 있다).
 */
export function rowAbilityOf(
  player: RosterPlayer | undefined,
  isPitcher: boolean,
  equipment?: readonly number[],
): readonly [number, number, number, number] {
  if (player === undefined) return [0, 0, 0, 0]
  return recordAbilityOf({ ...player, equipment: equipment ?? player.equipment }, isPitcher)
}

export interface TeamGameAbilityContext {
  /** 원본 게임 모드 (1 일반 · 2 시즌 · 8·9 대전) */
  readonly mode: number
  /** 시즌모드 내 팀 번호. 시즌이 아니면 −1 (그러면 내 팀 보정 셋이 아무 데도 안 붙는다) */
  readonly seasonTeamId: number
  /** 시즌 팀 질병·사기·코치 */
  readonly season?: SeasonTeamCondition
  /**
   * 팀별 능력치 네 칸 [투구, 타격, 집중, 근성].
   * 안 넘기면 XlsTEAM_DATA 값을 그대로 쓴다 (일반·대전모드는 트레이닝이 없어 늘 이 값이다).
   */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 내 팀 타순 칸(0~11)별 수비 자리·보직 — 보직 불일치 판정 입력 */
  readonly lineup?: readonly FieldingAssignment[]
  /**
   * 마선수 레벨 열 칸 = 원본 전역 기록 `mgr[0x13a..0x143]` (칸 0~4 마투수 · 5~9 마타자 → 0~4).
   * 마선수 명단 칸의 네 능력치가 0xb6414 첫 단계에서 `v · 0xd88aa[레벨] / 100` 을 먹는다 —
   * 모드를 가리지 않고, 사람 팀·AI 팀 마선수 모두 **같은 전역 칸**을 본다 (`aceLeveledAbility`).
   * 안 넘기면 모두 Lv1(0) = 60% 다 (새 저장 기본값 0x9f26c).
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * **스킬 14(투지) 갈래의 경기 상태 조건** — 0xb570c b5a4c~b5a66: 전역 경기 상태 [0x1552d0c] +0x6b > 4 이고 `팀`(팀레코드 +0)이
   * 지는 측. 경기 장면은 지금 판의 이닝 · 점수를 본다(`inGameFightingSpiritStateOf`). 장착 비트 14 는 투수 레코드 +0x14 로
   * 여기서 본다(`hasFightingSpiritBit`). 안 넘기면 늘 거짓
   */
  readonly fightingSpiritOf?: (teamId: number) => boolean
}

/** 투수 레코드 하나에 스킬 14 갈래가 지금 서는가 — 장착 비트 14(+0x14) ∧ 경기 상태(`fightingSpiritOf`) */
export function pitcherFightingSpiritOf(context: TeamGameAbilityContext, teamId: number, skillBits: number | undefined): boolean {
  return hasFightingSpiritBit(skillBits) && context.fightingSpiritOf?.(teamId) === true
}

export function teamAbilitiesOf(context: TeamGameAbilityContext, teamId: number): readonly number[] {
  const given = context.teamAbilities?.[teamId]
  if (given !== undefined) return given
  return TEAMS[teamId]?.values.slice(TEAM_ABILITY_OFFSET) ?? []
}

/**
 * **수비 판의 팀 보너스** — 판 시작 0xb0fb4 b10d0: 모드 1·2·8·9 면 `0xbbe98(s16 수비 팀레코드+8)`.
 * 팀레코드 +8 은 팀 능력치 셋째 칸 '집중'이다 — 경기용 능력치 0xb570c 의 팀 보정(0xb592c)이 읽는 같은 레코드라
 * `teamAbilitiesOf`(시즌 트레이닝을 먹인 값 · 없으면 XlsTEAM_DATA) 그대로 쓴다.
 */
export function defenseTeamBonusFor(context: TeamGameAbilityContext, teamId: number): number {
  return defenseTeamBonusOf(context.mode, teamAbilitiesOf(context, teamId)[TEAM_ABILITY_SLOT.집중] ?? 0)
}

/**
 * **주자 속도의 팀 등급** — 주자 만들기 0xa93ac a9488: 모드 1·2·8 면 `0xbbe98(s16 공격 팀레코드+0xa)`.
 * 팀레코드 +0xa 는 팀 능력치 넷째 칸 '근성'이다 — `defenseTeamBonusFor` 와 같은 레코드(시즌 트레이닝을 먹인 값 ·
 * 없으면 XlsTEAM_DATA)를 읽는다. 모드 9(대전 이벤트)는 0 이다.
 */
export function runnerTeamGradeFor(context: TeamGameAbilityContext, teamId: number): number {
  return runnerTeamGradeOf(context.mode, teamAbilitiesOf(context, teamId)[TEAM_ABILITY_SLOT.근성] ?? 0)
}

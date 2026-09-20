import { TEAMS } from '@/shared/config/original/teams'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { DEFAULT_PLAYER_SIDE, startsToday } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type {
  PitcherGameOptions,
  PitcherGameSummary,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { magicPitchCountOf } from '@/entities/pitcher-career/model/magicPitch'
import { isMyStartDay } from '@/entities/pitcher-career/model/pitcherRotation'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  effectivePitcherAbilityOf,
  hasPitcherSkill,
  nextPitcherOpponentOf,
  pitcherFormOfCareer,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherGameOutcome } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * 커리어·로테이션·환경설정으로 **경기 한 판의 옵션**을 조립한다 —
 * `startPitcherGame(options, random)` 과 `<PitcherGameScreen options … />` 가 받는 그 값이다.
 *
 * 값이 어디서 오는지:
 * ```
 * ourTeamId       커리어 소속 팀
 * opponentTeamId  일정표(0xd89cb)나 지금 포스트시즌 시리즈 — nextPitcherOpponentOf
 * dayCounter      리그 날짜 카운터 g = 시즌+0xb2. 하루 끝 0xb818c 가 +1 하므로 **지금까지 치른 경기 수**다
 * role/positionCode  레코드 +0xb&3 · +0xa&0x1f
 * stats           0xb6415(P, i, 1) = 장비·부상·질병·사기까지 반영한 실효 능력치
 * staminaAbility  그 실효 능력치의 **체력 칸**(칸 3) — 스태미나 용량 X 의 바탕
 * stamina         레코드 +0x2c (경기 사이에 이어진다)
 * repertoire      +0x1c 구질 마스크 · 폼(= 2×타입+손) · +0x18 마구 번호(= 마구 레벨)
 * magicCount      0xd84ff 표 (마구 번호별 4·5·6·7) + 혼신(투수 스킬 23) +2
 * teamMorale      모드별 팀 레코드 s16 +2 — XlsTEAM_DATA 의 둘째 u16 이 그 칸이고 전 팀 100 이다
 * gaugeSettingOn  환경설정 "투구 게이지" (설정 +0x2d). **원본 기본값은 꺼짐** (K 5-2)
 * ```
 */

/** 투수 스킬 번호 — P1 3-1 · S5 가 가리키는 세 개만 확정이다 */
const COWARD_SKILL = 18
const ENDURE_SKILL = 10
const SPIRIT_SKILL = 23
/** 행운 스킬 6 — 경기 뒤 사기 +1 (pitcherGameEvaluation 의 `hasLuckSkill`) */
const LUCK_SKILL = 6

/** 팀 사기 기본값 — 팀 레코드 s16 +2 (XlsTEAM_DATA 둘째 u16). 전 팀이 100 으로 시작한다 */
const TEAM_MORALE_VALUE_INDEX = 1
export const DEFAULT_TEAM_MORALE = 100

export function teamMoraleOf(teamId: number): number {
  return TEAMS[teamId]?.values[TEAM_MORALE_VALUE_INDEX] ?? DEFAULT_TEAM_MORALE
}

export interface PitcherGameSettings {
  /** 환경설정 "투구 게이지" — 안 넘기면 **원본 기본값(꺼짐)** 이다 */
  readonly gaugeSettingOn?: boolean
  /** 라이벌전인가 — 경기 뒤 사기 변화가 두 배가 된다 */
  readonly isRivalGame?: boolean
  /** 상대 팀을 직접 정할 때 (국가대항전·연습 경기). 안 넘기면 일정표가 정한다 */
  readonly opponentTeamId?: number
  /** 사람이 맡는 측. 안 넘기면 나만의리그 기본값(후공) */
  readonly playerSide?: PlayerSide
  /** 화면 배치 side (투영 원점 표 0xcfb18) */
  readonly stageSide?: number
  /** 팀 사기를 직접 줄 때 (시즌 팀 상태 보정이 붙은 값) */
  readonly teamMorale?: number
}

export function pitcherGameOptionsOf(
  career: PitcherCareer,
  settings: PitcherGameSettings = {},
): PitcherGameOptions {
  const ability = effectivePitcherAbilityOf(career)
  return {
    ourTeamId: career.teamId,
    opponentTeamId: settings.opponentTeamId ?? nextPitcherOpponentOf(career),
    playerSide: settings.playerSide ?? DEFAULT_PLAYER_SIDE,
    role: career.role,
    positionCode: career.positionCode,
    // g = 시즌+0xb2. 시즌 첫 경기가 0 이고 하루가 끝날 때마다 1 늘어난다 (0xb818c)
    dayCounter: career.gamesPlayed,
    isPostseason: career.postseason !== null,
    stats: {
      control: ability.control,
      velocity: ability.velocity,
      breaking: ability.breaking,
      stamina: ability.stamina,
    },
    // 용량 X 의 바탕은 **체력 칸의 실효값** 하나다 (0x66e44 가 0xb6415(P, 3, 1) 로 읽는다)
    staminaAbility: ability.stamina,
    stamina: career.stamina,
    repertoire: {
      pitchMask: career.pitchMask,
      form: pitcherFormOfCareer(career),
      // 육성 투수의 마구 번호는 마구 레벨 그대로다 (투수 표 0xcc368 = [1,2,3,4], H-4)
      magicNumber: career.magicLevel,
      isAce: false,
    },
    magicCount: magicPitchCountOf({
      number: career.magicLevel,
      isAce: false,
      aceLevel: 0,
      hasSpiritSkill: hasPitcherSkill(career, SPIRIT_SKILL),
    }),
    teamMorale: settings.teamMorale ?? teamMoraleOf(career.teamId),
    reputation: career.reputation,
    // 원본 기본값은 꺼짐이다 — 환경설정에서 켠 값을 그대로 받아 넘긴다
    gaugeSettingOn: settings.gaugeSettingOn ?? false,
    pitcherIsCoward: hasPitcherSkill(career, COWARD_SKILL),
    pitcherEndures: hasPitcherSkill(career, ENDURE_SKILL),
    isRivalGame: settings.isRivalGame,
    hasLuckSkill: hasPitcherSkill(career, LUCK_SKILL),
    stageSide: settings.stageSide,
  }
}

/**
 * 오늘 내 투수가 선발로 나가는가 (`startsToday` 가 보는 것과 같은 판정).
 * 보직이 구원이면 선발로는 안 나가고 **8회 교체로** 올라온다 (0xc1ba4) — 경기 진행기가 알아서 한다.
 */
export function startsTodayFor(career: PitcherCareer, settings: PitcherGameSettings = {}): boolean {
  return startsToday(pitcherGameOptionsOf(career, settings))
}

/** 오늘 등판 예정 표시 — 선발이면 짝수 날, 구원이면 늘 등판 기회가 있다 (P1 1절) */
export function todayAssignmentOf(career: PitcherCareer, settings: PitcherGameSettings = {}): '선발' | '구원' | '대기' {
  if (career.role === PITCHER_ROLE.relief) return '구원'
  return startsTodayFor(career, settings) ? '선발' : '대기'
}

/**
 * 다음 등판까지 남은 경기 수 — 선발은 날짜 카운터 g 가 **짝수인 날**마다 등판한다 (`isMyStartDay`).
 * 구원은 매 경기 8회에 올라오므로 늘 0 이다.
 */
export function gamesUntilNextStartOf(career: PitcherCareer): number {
  if (career.role === PITCHER_ROLE.relief) return 0
  return isMyStartDay(career.gamesPlayed) ? 0 : 1
}

export interface PitcherGameOutcomeExtras {
  /** 이 경기에 실제로 등판했는가 (`progress.hasEntered`). 안 넘기면 투구 수로 가늠한다 */
  readonly entered?: boolean
  /** 경기 끝 G포인트 — 투수 경기 진행기는 아직 기록 달성 id 를 내놓지 않아 기본 0 이다 */
  readonly gamePointReward?: number
}

/**
 * 경기 결과를 커리어가 받을 꼴로 옮긴다.
 * (`entities` 는 `features` 를 모르는 층이라 이 옮김은 페이지 쪽에 둔다.)
 */
export function pitcherGameOutcomeOf(
  summary: PitcherGameSummary,
  options: PitcherGameOptions,
  extras: PitcherGameOutcomeExtras = {},
): PitcherGameOutcome {
  return {
    result: summary.result,
    ourTeamId: options.ourTeamId,
    opponentTeamId: options.opponentTeamId,
    seasonDelta: summary.seasonDelta,
    stamina: summary.stamina,
    entered: extras.entered ?? (summary.pitchCount > 0 || summary.record.outsRecorded > 0),
    gamePointReward: extras.gamePointReward ?? 0,
  }
}

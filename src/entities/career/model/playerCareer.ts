import type { BatterAbility } from '@/entities/batting/model/batter'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { GameEvaluation } from '@/entities/career/model/gameEvaluation'
import type { League } from '@/entities/league/model/league'
import { BALANCE } from '@/shared/config/original/balance'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import {
  EMPTY_LEAGUE,
  advancePostseason,
  nextSeasonLeague,
  opponentOf,
  pitcherOrdersAfterPostseason,
  recordLeagueResult,
  startPostseason,
} from '@/entities/league/model/league'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { runCpuPostseasonWithStamina } from '@/entities/league/model/postseasonPlay'
import type { PitcherStaminaTable } from '@/entities/league/model/postseasonPlay'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import {
  humanGamePitcherOrderOf,
  humanGamePitcherStaminasOf,
  recordHumanGamePitchers,
  recoveredLeagueStaminas,
  staminaTableAfterHumanGame,
} from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { BATTER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  EMPTY_LEAGUE_PLAYER_STATS,
  recordLeaguePlateAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import {
  EMPTY_SEASON_STATS,
  mergeStats,
  recordGamePlayed,
} from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import { ROOKIE_BATTER_SLOT } from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecords } from '@/entities/career/model/nariTeamRecord'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'

/** 원본 능력치 상한 (0xb6414 가 999 로 자른다) */
export const MAXIMUM_ABILITY = BALANCE.ability.maximum
const MAXIMUM_AFFECTION = BALANCE.limits.affection

/**
 * 관리 메뉴가 열리는 주기.
 * 원작 설명서 원문: "2경기마다 관리 메뉴가 발생하며 다음 커맨드로 선수를 육성합니다."
 * (StrHOWTO[11], r_event_txt[172])
 */
export const GAMES_PER_MANAGEMENT_CYCLE = BALANCE.season.gamesPerManagementCycle

/** 한 시즌 경기 수. 원작 설명서 StrHOWTO[10]: "1년에 총 45경기의 정규리그를 진행하며" */
export const GAMES_PER_SEASON = BALANCE.season.gamesPerSeason

/**
 * S+0x50(돌아온 까닭)을 쓰는 상태 번호 — `PlayerCareer.seasonEndState`. 시즌 끝 사슬(S+0x50 값 0xb·0xc·0xe·0xf·9)과
 * 다음경기 앞 순위표 109(진입 0x10d8c 의 `S+0x50 = 4`, 0x10db0), 경기 뒤 평가 116(진입 0x1278c 의 `S+0x50 = 2`, 0x1279a)이다.
 * 그 밖 값(1 · 3)은 웹이 null 로 든다. **137** 은 이벤트 464(국가대표 거절) 보상 뒤 0x8ccba 가 쓰는 `S+0x50 = 0x11` 이다 —
 * 0x1c154(1c25e)가 새 시즌 0x1b768(→ 137 "N년차")로 보낸다 (`rewardResumePatchOf`).
 */
export type SeasonEndState = 136 | 130 | 131 | 128 | 132 | 109 | 116 | 137

/**
 * **116 경기 뒤 평가를 다시 띄울 재료** — 원본은 S 의 칸(+0x4a 지난 경기 인기도 변화 · +0x1d8 이 경기 기록 바이트)이 저장에 남아
 * 이어하기(S+0x50 == 2)가 116 진입 0x1278c 를 그대로 다시 돈다. 웹은 그 칸 대신 지난 경기 요약(리그 기록 재료는 뺀다)과
 * 평가를 둔다. 경기마다 덮어쓴다.
 */
export interface NariLastGame {
  readonly summary: Omit<GameSummary, 'leaguePlateAppearances' | 'leaguePitchers' | 'pitcherStaminas'>
  /**
   * 116 이 읽는 S+0x4a · +0x64 · +7 과 그 감독 글. 평가 0xa719c 가 도는 정규시즌 경기만 덮어쓰므로 포스트시즌 경기 뒤에는
   * **앞 평가 경기 값**이다(감독 글은 116 이 그 +0x4a 와 지금 평판으로 다시 고른다).
   */
  readonly evaluation: GameEvaluation
  /**
   * S+0x1d8 기록 줄 (0xa719c 모드 4 a71d0~a7222: [0] 타수 · [1] 안타 · [2] 타점 · [3] 홈런, u8) — 116 이 줄
   * "타수 안타 타점 홈런"(12958~12998)과 칭호 39 판정([3] > 3, 129b2)에 읽는다. 정규시즌 경기만 덮어쓴다. 옛 저장에는 없다
   */
  readonly recordLine?: NariRecordLine
}

/** 타자편 S+0x1d8 네 바이트 */
export interface NariRecordLine {
  readonly atBats: number
  readonly hits: number
  readonly runsBattedIn: number
  readonly homeRuns: number
}

/** 이 경기 성적으로 S+0x1d8 줄을 짓는다 (strb — u8) */
export function nariRecordLineOf(stats: Pick<GameSummary['stats'], 'atBats' | 'hits' | 'runsBattedIn' | 'homeRuns'>): NariRecordLine {
  return {
    atBats: stats.atBats & 0xff,
    hits: stats.hits & 0xff,
    runsBattedIn: stats.runsBattedIn & 0xff,
    homeRuns: stats.homeRuns & 0xff,
  }
}

/**
 * **116 기록 줄 글** — 진입 0x1278c 의 모드 4 갈래(12958~1299a, 직접 떴다): 글 상자(sp+0x4c, 0xbc75d)에 S+0x1d8 의 네 바이트를
 * 차례로 숫자(0xbc73d — ldrb 라 u8 그대로)와 글로 붙인다.
 * ```
 * [0] + "타수 "(0xcc938) · [1] + "안타 "(0xcc940) · [2] + "타점 "(0xcc948) · [3] + "홈런!N"(0xcc950)
 * ```
 * 이 글은 평가 내장 이벤트 0x8a6fc 의 넷째 인자로 이벤트 +0x2cc 에 담기고(0x8a76c), 이벤트 글을 짓는 0x8bab8 이 +0xb 가 서 있으면
 * **이 줄 뒤에 감독 글(StrUSER_EVT[+0x1e])을 이어 붙여** 한 대사로 띄운다(0x8bb66~0x8bbac). 끝의 `!N` 이 줄바꿈이라 감독 글이 다음 줄이다.
 * 포스트시즌 경기 뒤에는 S+0x1d8 이 앞 평가 경기 값이다(`NariLastGame.recordLine`, a2ad0a7).
 */
export function nariRecordLineTextOf(line: NariRecordLine): string {
  return `${line.atBats}타수 ${line.hits}안타 ${line.runsBattedIn}타점 ${line.homeRuns}홈런!N`
}

/** 116 이 읽는 S+0x1d8 — 저장의 줄, 줄이 없던 옛 저장이면 그 경기 성적으로 */
export function nariLastGameRecordLineOf(lastGame: NariLastGame): NariRecordLine {
  return lastGame.recordLine ?? nariRecordLineOf(lastGame.summary.stats)
}

/** 경기 요약에서 116 재료만 — 리그 선수 기록·투수 줄·스태미나 표는 정산이 이미 먹었다 */
export function nariLastGameOf(
  summary: GameSummary,
  evaluation: GameEvaluation,
  recordLine: NariRecordLine = nariRecordLineOf(summary.stats),
): NariLastGame {
  return {
    recordLine,
    summary: {
      result: summary.result,
      ourScore: summary.ourScore,
      opponentScore: summary.opponentScore,
      stats: summary.stats,
      popularityPoints: summary.popularityPoints,
      doublePlays: summary.doublePlays,
      scoringPositionOuts: summary.scoringPositionOuts,
      reputationCounts: summary.reputationCounts,
      ourTeamId: summary.ourTeamId,
      opponentTeamId: summary.opponentTeamId,
      recordIds: summary.recordIds,
      ...(summary.pitchersOfRecord === undefined ? {} : { pitchersOfRecord: summary.pitchersOfRecord }),
    },
    evaluation,
  }
}

/** 경기를 치르면 회복하는 체력 */

export interface PlayerCareer {
  readonly name: string
  readonly ability: BatterAbility
  readonly gamePoint: number
  readonly season: number
  readonly gamesPlayed: number
  readonly stats: SeasonStats
  readonly careerStats: SeasonStats
  /** 마선수 아이디 → 호감도 (0~100) */
  readonly affection: Readonly<Record<string, number>>
  readonly titleIds: readonly string[]
  /**
   * 장착 중인 칭호 **번호** (+0x1c4, s8). 새 선수는 −1 = 없음 (0x11292).
   * 칭호를 얻으면 곧바로 이 칸에 들어가고(0x1b214), 뒤에 칭호 목록 화면(하위 상태 129)에서 바꾼다
   * (키 처리 0x11f78 — P3 10-1).
   */
  readonly equippedTitle: number
  /** 이글아이 아이템이 남아 있는 경기 수. 0이면 투구 도착 지점이 보이지 않는다. */
  readonly eagleEyeGamesRemaining: number
  readonly seenEventIds: readonly string[]
  /** 원본 스토리에서 다음에 볼 장면 번호 */
  readonly storySceneIndex: number
  /** 소속 팀 (원본 TEAMS 인덱스) */
  readonly teamId: number
  /** 훈련 항목별 누적 횟수. 원작의 "%d/%d회 훈련" 표시를 위한 것. */
  readonly trainingCounts: Readonly<Record<string, number>>
  /**
   * 새 시즌이 시작할 때 떠 둔 통산 훈련 수 사본 (+0x6b+i).
   * 통산에서 이걸 빼면 **이번 시즌 훈련 수**가 된다 — 스킬 획득 조건이 그 값을 본다 (A-4).
   */
  readonly seasonStartTrainingCounts: Readonly<Record<string, number>>
  /**
   * 칸별 **연속** 훈련 수 (+0x70~+0x74). 같은 칸을 훈련하면 오르고,
   * **다른 칸을 훈련하면 전부 0 이 된다** (0x18a80). 스킬 18·19·20 해제 조건이 본다.
   */
  readonly consecutiveTrainingCounts: Readonly<Record<string, number>>
  /**
   * 연도별 MVP 비트 (+0x1ca) — 연차 1 이 bit0 이고 13년까지 쓴다 (0xa4d50).
   * 시즌이 바뀌어도 **지우지 않는다** — 통산 MVP 횟수를 보는 칭호가 이것을 읽는다.
   */
  readonly mvpSeasonBits: number
  /** 이번 시즌 인기도 변화 합 (+0x1c2) — 새 시즌에 0 이 된다. 먹튀 획득 조건이 본다 */
  readonly seasonPopularityGain: number
  /** 먹튀(스킬 2)를 가진 뒤의 인기도 변화 합과 경기 수 (+0x1c0 / +0x1cd) — 먹튀 해제 조건이 본다 */
  readonly moneyGrubberPopularityGain: number
  readonly moneyGrubberGames: number
  /** 무력감(스킬 5) 보유 중 "경기 뒤 사기 ≥ 90" 이 **연속**으로 이어진 경기 수 (+0x1c7) */
  readonly highMoraleStreak: number
  /**
   * 평판 0 으로 끝난 경기 뒤 평가가 **연속**으로 이어진 수 (+0x184, u8). 경기 뒤 평가 116 의 `0xa4d08(S)` 가
   * `s16 S+0x62(평판) == 0` 이면 +1(바이트라 255 다음은 0), 아니면 0 으로 되돌린다 (0x12c32 — `+0x1c2` 바로 뒤).
   * 칭호 30 "가짜 인간" 이 `s8 +0x184 > 4` 로 본다 (0x1a670). 새 시즌에도 안 지운다 (쓰는 곳은 0xa4d08 하나).
   */
  readonly reputationZeroGames: number
  /** 몹쓸몸(스킬 3)을 가진 채로 한 훈련 수 (+0x75) — 6회가 되면 해제 조건을 넘는다 */
  readonly badBodyTrainings: number
  /** 유리몸(스킬 4)을 가진 채로 한 훈련 수 (+0x76) — 8회가 되면 해제 조건을 넘는다 */
  readonly fragileTrainings: number
  /** 원작 인기도 — 경기 후 감독 평가와 외출로 변동 */
  readonly popularity: number
  /** 원작 평판 */
  readonly reputation: number
  /** 원작 사기 — 낮으면 부상·질병 확률이 오른다 (StrHOWTO) */
  readonly morale: number
  /** 원작 소지금 (만원 단위). G포인트와는 별개다. */
  readonly money: number
  /**
   * 한 번 해제한 마이너스 스킬 (+0x1d0+k, 표 0xd7e10 = [2,3,4,5,17,18,19,20]).
   * **그 해 안에는 다시 얻을 수 없다** — 이벤트 조건 20 이 이 플래그를 본다 (A-4). 연초 115 의 0xa4ee8 이 지운다(R9 7절).
   */
  readonly removedMinusSkillIds: readonly number[]
  readonly isInjured: boolean
  /** 부상 상태로 치른 경기 수 (+0x1b6) — 20 이 되면 부상 엔딩 0 (0xa3a84) */
  readonly injuredGamesPlayed: number
  readonly isSick: boolean
  /** 걸린 질병 이름 (StrMODE[186]~[189]). 모르면 null */
  readonly illnessName: string | null
  /**
   * 이번 관리 주기에 트레이닝·휴식·외출 중 하나를 이미 했는가.
   * r_event_txt[176] "한번에 트레이닝, 휴식, 외출 중 딱 한 가지 일만 할 수 있으니"
   */
  readonly hasActedThisCycle: boolean
  /** 이번 시즌 외출 횟수 (선수 +0x6a) */
  readonly outingsThisSeason: number
  /**
   * 지난 시즌 외출 횟수 — 칭호 25·26 "1년간 외출 2회 이하/20회 이상" (StrNICKNAME[89][90]) 전용.
   *
   * 원본은 칸을 하나(+0x6a)만 두고 **새 시즌 첫 경기 전**에 그 값을 본다(0x1a590·0x1a5d0, P3 9절).
   * 시즌 전환 0x1b768·0xa39a8 어디에도 +0x6a 를 지우는 줄이 없어 **어디서 지우는지는 미확인**이라,
   * 웹은 전환 때 이 칸에 지난해 값을 떠 두고 세는 칸은 0 으로 되돌린다 — 문서가 확정한
   * "지난해 값으로 판정" 은 그대로이고, 지우는 시점만 **근사**다.
   */
  readonly outingsLastSeason: number
  /** 한 경기 최다 홈런 — 칭호 "한 경기 홈런 4회 달성" */
  readonly bestHomeRunsInGame: number
  /** 사이클링 히트를 친 경기 수 — 칭호 "사이클링 히트 2회 달성" */
  readonly cycleHitGames: number
  /**
   * 시즌 시작 때 인기도 (선수 +0x78) — 올해의 목표 "인기도 상승" 과 연봉 계산의 기준.
   * 새 시즌 전환이 `S[0x78] = 0xb6e78(S)`(지금 인기도)로 다시 뜬다 (0xa39e0).
   */
  readonly popularityAtSeasonStart: number
  /**
   * 올해의 목표 창을 이미 봤는가 (선수 +0x1b7, 0xa39d0 이 새 시즌마다 0 으로 되돌린다).
   *
   * **1b8807f 앞의 타자편 저장 — 판단: 원본과 다르다(받아들인 차이)**. 원본은 창이 닫힐 때 0x7fe90 이 S+0x1b7 = 1 을 쓰고 곧바로
   * 저장(0x22755)하며, 해마다 105 는 115 를 거친 뒤에야 머물 수 있다(105 진입 0x11bc0 → 0x11bd6). 그래서 원본의 연중 저장은
   * 늘 S+0x1b7 = 1 이고 불러와도 115 가 다시 서지 않는다 — 0 인 저장은 새 시즌 0x1b768(0xa39a9 가 0) 뒤 첫 105 앞뿐이다.
   * 웹 타자편은 115 가 없던 때 이 칸을 켠 적이 없어 옛 저장이 모두 거짓이다 → 불러온 뒤 첫 관리 화면에서 115 를 **한 번 더** 본다.
   * 같은 것은 "새 해 첫 105 앞에서 저장한 경우" 뿐이고, 연중 저장이면 (1) 대사 + 목표 창이 한 번 더 뜨고 (2) 0xa4ee8 이
   * 그 해에 이미 쌓인 마이너스 스킬 해제 기록까지 지워 같은 해에 다시 얻을 수 있게 된다(원본은 연초에 한 번만 지운다).
   * 옛 저장은 115 가 아예 없던 탓에 해제 기록이 여러 해 쌓여 있어 (2) 는 오히려 원본 쪽으로 돌려놓는 몫이 크고, 몇 경기째에
   * 연초가 지났는지로 칸을 지어 채우는 것은 원본에 없는 판정이라 옮김을 두지 않는다 — 한 번 보고 나면 원본과 같아진다.
   */
  readonly hasSeenYearGoalWindow: boolean
  /**
   * 연초 "올해의 목표" 이벤트(0xd4)를 이미 치렀는가 (선수 +0x1bc 4바이트).
   * 이벤트 조건이 `S+0x1bc == 0 && S+0x187 == 0` 이라, 새 시즌 전환(0x1b882)이 이 칸을 비워
   * **목표 창을 다시 띄우는 스위치**가 된다.
   */
  readonly yearGoalEventDone: boolean
  /** 연봉 (만원 단위, 추정) — 새 시즌 시작 때 소지금에 들어온다 */
  readonly salary: number
  /** 선수 생활이 끝났으면 StrENDING 번호 */
  readonly endingIndex: number | null
  /**
   * 질병 이벤트 쿨다운 (선수 +0x7c). 질병에 걸리거나 나으면 20 이 되고, 0 보다 크면 이벤트 490 이 막힌다.
   * 줄어드는 단위는 미확인이라 경기마다 1 씩 줄인다 (추정).
   */
  readonly illnessCooldown: number
  /** 타순 (1~9). 신인은 9번 (0xa4c2c) */
  /** 배팅 타입 첫 선택 (선수 +0xb 상위 비트) */
  readonly battingTypeIndex: number
  /** 0 내야 · 1 외야 */
  readonly positionIndex: number
  /** 0 우타 · 1 좌타 */
  readonly battingSide: number
  /** 0 황인 · 1 백인 · 2 흑인 */
  readonly skinIndex: number
  /** 가진 서브 아이템 번호 0~9 (선수 +0x58+k) */
  readonly subItemIds: readonly number[]
  /** 질병 남은 기간(+6, 걸리면 3) · 부상 남은 기간(+0x1b5) */
  readonly illnessRemaining: number
  readonly injuryRemaining: number
  /** 장착 레벨 니블 (0 = 미장착, 1~11 = 레벨+1) — 능력치 이름으로 부위를 가리킨다 */
  readonly equipmentLevels: BatterAbility
  /** 산 적 있는 장비 "부위-레벨" */
  readonly ownedEquipment: readonly string[]
  /** 열린 히든 id (원본은 전역 저장 game_o.sav — 앱이 기록연감과 맞춘다) */
  readonly openedHiddenIds: readonly number[]
  /** 리그 전적 (0xb76dc·0xb77e0). 지금은 내 팀 경기만 쌓인다 — 다른 팀 경기는 원본 간이 시뮬레이터를 옮길 때 채운다 */
  readonly league: League
  /**
   * 리그 선수 개인 시즌 성적 (타석 기록 0xa8024). 사람 경기와 CPU 끼리 경기가 **같은 표**에 쌓는다.
   * 개인 타이틀 순위표 0x9d789 · MVP · 연봉협상 등급 k 가 전부 이 표를 본다 (B-2·B-3·B-5).
   * 새 시즌에 0 으로 돌아간다 (0x204e0 — `startNextSeason`).
   */
  readonly leaguePlayerStats: LeaguePlayerStats
  /**
   * 리그 열 팀 투수의 레코드 스태미나 `+0x2c` — 팀 번호 → 붙박이 표 칸(0~7)별 값. 없는 팀·칸은 10000.
   * 원본은 팀 저장 레코드에 있어 경기 사이에 이어진다: 경기 준비 0x1c46c 가 g == 0 이면 열 팀 10000, 사람·CPU 경기가
   * 깎고, 하루 끝 4f2e8 이 열 팀 +20% (`entities/pitcher-career/model/leaguePitcherRecords`). 옛 저장에는 없다(전원 10000).
   */
  readonly leaguePitcherStaminas?: PitcherStaminaTable
  /** 정규시즌 1위 횟수 — 원본 세이브 레코드 +0x7a (0xb818c 가 45경기째에 늘린다) */
  readonly regularSeasonFirstCount: number
  /**
   * 정규시즌 우승 보상(StrMODE[191])을 받았는가 — 원본 세이브 레코드 +0x77.
   * 포스트시즌 대진 128 진입(0x120a4)이 이 칸이 0 일 때만 보상 팝업을 띄우고, 팝업이 닫힐 때(0x15b4c) 1 로 세운다.
   * 새 시즌 처리 0x1b7c0 이 0 으로 되돌린다.
   */
  readonly regularSeasonRewardTaken: boolean
  /**
   * 시즌 끝 사슬의 어느 상태에 들어와 있는가 — 원본 세이브 레코드 **S+0x50(돌아온 까닭)** 의 시즌 끝 값.
   * 상태 진입마다 값을 쓰고 곧바로 저장한다: 136 → 0xb (0x10bba) · 130 → 0xc 타자 (0x19848) · 131 → 0xe (0x19782) ·
   * 128 → 0xf (0x120ce) · 132 → 9 (0x10c60) · 109 → 4 (0x10db0) · 116 → 2 (0x1279a). 새 시즌 처리 0x1b768 이 1 로(0x1b7ba),
   * 105 진입이 3 으로(0x11990), 114 진입 0x11d00 이 2 → 3(0x11d88) 으로 되돌린다 — 웹은 1 · 3 을 null 로 든다.
   * 이어하기(상태 100 진입 0x1c154)는 이 값으로 136·130·131·132 에 돌아가고, 0xf 는 S+0xb4(포스트시즌 중) 갈래로 128,
   * 4 는 맨 끝 갈래(S+0x50 ∉ {1,3})로 109 다.
   */
  readonly seasonEndState: SeasonEndState | null
  /** 116 다시 띄우기 재료 (`NariLastGame`) — 경기를 한 번도 안 치렀거나 옛 저장이면 없다 */
  readonly lastGame?: NariLastGame
  /** 진행 중인 포스트시즌. 정규시즌 중에는 null 이다 (0xb80a8 이 45경기째에 연다) */
  readonly postseason: PostseasonSeries | null
  /** 또또상품권 구매 수(상한 200, +0x186) · 1등 횟수 — 칭호 21·22 */
  readonly lotteryPurchases: number
  readonly lotteryFirstPrizes: number
  /** 필살타법 레벨(+0x201) · 이번 레벨 누적 훈련 횟수(+0x200) */
  readonly specialSwingLevel: number
  readonly specialSwingSessions: number
  /**
   * **고른 필살타법 번호** — 선수 레코드 **+0x18** (H-4 · H2 1·2절 확정).
   * 선수정보 칸 3 의 창(상태 0x7b, 키 0x17cec)에서 고른 칸의 표 값 `0xcc378[칸]` = 1~4 가 그대로 들어간다
   * (0x18166~0x1816c `strb`). **"4 + 타입" 은 이름에만 쓰고 여기엔 안 들어간다** — 미라지·메테오 모두 4.
   * 경기는 레벨(+0x201)이 아니라 **이 번호**만 본다: 0 이면 '0' 키가 무시되고(0x51e14 ← 0xaea30),
   * 성공 확률은 표 `0xcfdbe[번호−1]` 이다(0x34c74).
   *
   * 0 = 아직 안 고름. ⚠️ 새 선수의 초깃값은 원본에서 못 짚었다(배우기 0xa3bac 는 이 칸을 안 쓴다 —
   * 0xa3c26~0xa3cc6 확인). 0 으로 둔다(**추정**). 이 칸이 없던 옛 저장도 0 으로 채워진다.
   */
  readonly specialSwingNumber: number
  /**
   * 타순 — 내 선수 레코드의 칸 번호 `0xb6395 + 1` (타순 판정 0xa4c2c · 보상 19 가 이 값을 본다). 142 진입·경기 장면이
   * `0xb8768` 로 칸 번호를 첨자로 다시 매기므로 곧 나리 팀 레코드(`nariTeams`) 안 내 줄의 첨자 + 1 이다.
   */
  readonly battingOrder: number
  /**
   * **열 팀 나리 팀 레코드** (`entities/career/model/nariTeamRecord`) — 저장 블록 `[저장+0xbc] + 4 + 0x1c·팀`.
   * 142 마선수 넣기·타순 보상 19 가 고친다. 옛 저장·아직 안 고친 새 선수는 없다 — `nariTeamsOf` 가 등록 때의 꼴로 세운다.
   */
  readonly nariTeams?: NariTeamRecords
  /**
   * **국가대항전 대회 레코드 두 칸** (`entities/career/model/nariCupTeams`) — 저장 블록 +0xbc4 대표팀(내 선수가 낀) · +0xbe0 상대국.
   * 대회를 시작할 때(0xb7bf0 · 133) 세우고 142·하루 끝이 고친다. 대회 밖에서는 읽지 않는다. 옛 저장에는 없다.
   */
  readonly nariCupTeams?: NariCupTeams
  /**
   * **국가대항전 진행 중** — 원본 `S+0x12c`(= 리그 `L+0xac`) 플래그와 같은 리그 구조체의 대회 칸 `L+0xa8`~`L+0xc4` · 날짜 `L+0x32`.
   * 리그 구조체 L = S+0x80 은 나리 저장 블록 안이라 저장 0x22755 가 대회째 파일에 쓴다: 133 진입 0x1a090(대회 초기화 0xb7bf1 뒤
   * 0x1a14e~0x1a15c 저장) · 463 끝 0x8c460(0x8cca2 S+0x50 = 3 · S+0x12c = 1 → 0x8cd44 저장) · 경기 정산 0x4ea0c(하루 끝 0xb818d 뒤
   * 0x4f3c4 저장). 이어하기 0x1c154 는 S+0x50 이 특수값이 아니면 S+0x12c 로 134 에 돌아온다(1c348~1c358).
   * 있으면 대회 중 · 없으면 아님. 새 시즌 0x1b768 이 내린다(`endNationalCup`). 옛 저장에는 없다.
   */
  readonly nationalCup?: NationalCup
  /** 목표 타순 경로 — 이벤트 487 에서 고른다. 고르기 전에는 null */
  readonly battingOrderPath: '4번' | '1번' | null
  /** 지난 중간평가 달성 수 (원본 +0x1cc) — 칭호 "전년 대비 성적 우수" */
  readonly lastMidSeasonGoalCount: number
  /** 가진 스킬 번호 (0~39, original/skills). 원본 보유 비트 +0x1b8 — 얻은 차례대로 쌓인다 */
  readonly skillIds: readonly number[]
  /**
   * **장착한 스킬** — 선수기록 **+0x14** 비트 (H-modes 6절 "장착 칸", A 0절 정정).
   * 경기 스킬 효과 0xb62b4·0xa4bf8 은 보유(+0x1b8)가 아니라 이 칸만 본다.
   * 켜는 곳은 장착 동작 0xa4b04 하나(얻을 때 0xa4bd8 의 자동 장착 포함), 끄는 곳은 해제·제거(0xa4430)뿐이다.
   * 마이너스 스킬은 상한을 안 보고 늘 장착되고 창에서 못 뺀다 → 마이너스는 보유 = 장착이다.
   */
  readonly equippedSkillIds: readonly number[]
  /** 플러스 스킬 장착 슬롯 단계 L (선수 **+0x1c6**, s8 0~2) — 상한 `[6,8,10][L]` (0xd7e8e) */
  readonly skillSlotLevel: number
  /** 연속 기록 (전역 저장 +0x1bc) — 2안타 이상 경기 · 홈런 경기 · 무안타 경기 */
  readonly streaks: { readonly multiHit: number; readonly homeRun: number; readonly hitless: number }
  readonly wins: number
  /** 원본에 없는 칸 — 나리 경기는 무승부로 끝나지 않아(0xb68fc · 정산 4f072) 늘 0 이다. 화면은 더 읽지 않고(성적 · 시즌 종료의 "N무" 를 걷었다) 옛 저장 호환으로 칸만 남겨 둔다 */
  readonly draws: number
  readonly losses: number
}

/** 신인의 시작 상태 — 나만의리그 공통 초기화 0x11244~0x11296 */
export const STARTING_POPULARITY = BALANCE.rookie.popularity
export const STARTING_REPUTATION = BALANCE.rookie.reputation
export const STARTING_MORALE = BALANCE.rookie.morale
/** 원본 연봉 50 (0xa4fd8). 원본 단위(100만원) 그대로 둔다 — 화면은 ×100 만원 (관리 화면 0x63118) */
export const STARTING_SALARY = BALANCE.rookie.salary
/** 소지금 단위는 만원이다. 원본은 100만원 단위 60 = 6000만 */
export const STARTING_MONEY = BALANCE.rookie.money
/** 원본 소지금·연봉 한 칸 = 100만원 */
export const ORIGINAL_MONEY_UNIT = BALANCE.money.unit
/** 원본 소지금 상한 9999 칸 (0x1b768) */
const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT
/** 신인 스킬 — 0 병아리 · 8 의외성 (0x11230 에서 a4bd9 두 번) */
const STARTING_SKILL_IDS: readonly number[] = BALANCE.rookie.skillIds

/**
 * 인기도·평판 상한. 원본 칭호 조건에 "평판 999 달성", "인기도 4000이상 달성" 이 있다 (StrNICKNAME[91][71]).
 * 이벤트 보상 점프 표(binary.mod 0xd4e50)도 인기도를 9999, 평판을 999 로 자른다 (점검 에이전트 정적 확인).
 */
export const MAXIMUM_POPULARITY = BALANCE.limits.popularity
export const MAXIMUM_REPUTATION = BALANCE.limits.reputation
export const MAXIMUM_MORALE = BALANCE.limits.morale

/** 기본 소속 팀 — 서울 드래곤즈 */
export const DEFAULT_TEAM_ID = 0

/** 타자 시작 능력치 표 0xcc3fa (배팅 타입 → 히트·파워·수비·주루) */
const ROOKIE_ABILITY_BY_TYPE: readonly BatterAbility[] = BALANCE.ability.rookieByBattingType
/** 생성 화면 둘째 목록이 0 이면 수비, 아니면 주루에 더한다 (0x16e2c) — 목록 뜻은 내야/외야 (추정) */
const ROOKIE_POSITION_BONUS = BALANCE.ability.rookiePositionBonus

export function rookieAbilityOf(battingTypeIndex: number, positionIndex: number): BatterAbility {
  const base = ROOKIE_ABILITY_BY_TYPE[battingTypeIndex] ?? ROOKIE_ABILITY_BY_TYPE[0]
  return positionIndex === 0
    ? { ...base, defense: base.defense + ROOKIE_POSITION_BONUS }
    : { ...base, run: base.run + ROOKIE_POSITION_BONUS }
}

/** 등록 화면 기본 선택(0, 0)의 능력치 */
export const STARTING_ABILITY: BatterAbility = rookieAbilityOf(0, 0)

/** 선수 등록 선택 (0x16f28 — 선수 +0xb: 비트5~7 타입, 비트0~1 내외야, 비트4 손 [추]) */
export interface RookieProfile {
  readonly battingTypeIndex: number
  /** 0 내야 · 1 외야 (StrMODE[4]) */
  readonly positionIndex: number
  /** 0 우타 · 1 좌타 (StrMODE[9], 판정의 side 와 같은 뜻) */
  readonly battingSide: number
  /** 0 황인 · 1 백인 · 2 흑인 (선수 +0xb 비트2~3) */
  readonly skinIndex: number
  /**
   * 팀 고르기(상태 0x65)에서 고른 팀 — 목록 값 0~14 그대로다 (C-1: 몸통 팔레트 = 피부×15 + 팀).
   * 안 넘기면 기본 팀(서울 드래곤즈)이다.
   */
  readonly teamId?: number
}

export const DEFAULT_ROOKIE_PROFILE: RookieProfile = { battingTypeIndex: 0, positionIndex: 0, battingSide: 0, skinIndex: 0 }

/** 이름 길이 — 원본은 CP949 바이트로 센다. 한글 2바이트, 영문·숫자 1바이트 (StrMODE[3] "한글 4글자, 영문 8글자") */
export const MAXIMUM_NAME_BYTES = BALANCE.limits.nameBytes

export function nameByteLengthOf(name: string): number {
  return [...name].reduce((total, character) => total + (character.charCodeAt(0) > 0x7f ? 2 : 1), 0)
}
const STARTING_GAME_POINT = BALANCE.rookie.gamePoint

export function createCareer(name: string, profile: RookieProfile = DEFAULT_ROOKIE_PROFILE): PlayerCareer {
  return {
    name,
    ability: rookieAbilityOf(profile.battingTypeIndex, profile.positionIndex),
    gamePoint: STARTING_GAME_POINT,
    season: 1,
    gamesPlayed: 0,
    stats: EMPTY_SEASON_STATS,
    careerStats: EMPTY_SEASON_STATS,
    affection: {},
    titleIds: [],
    // 새 선수의 +0x1c4 는 −1 이다 (0x11292). 0번 "이름 없는 신인" 을 첫 관리 화면에서 얻으며 곧바로 장착된다
    equippedTitle: -1,
    eagleEyeGamesRemaining: 0,
    seenEventIds: [],
    storySceneIndex: 0,
    teamId: profile.teamId ?? DEFAULT_TEAM_ID,
    trainingCounts: {},
    seasonStartTrainingCounts: {},
    consecutiveTrainingCounts: {},
    mvpSeasonBits: 0,
    seasonPopularityGain: 0,
    moneyGrubberPopularityGain: 0,
    moneyGrubberGames: 0,
    highMoraleStreak: 0,
    reputationZeroGames: 0,
    badBodyTrainings: 0,
    fragileTrainings: 0,
    popularity: STARTING_POPULARITY,
    reputation: STARTING_REPUTATION,
    morale: STARTING_MORALE,
    money: STARTING_MONEY,
    removedMinusSkillIds: [],
    isInjured: false,
    injuredGamesPlayed: 0,
    isSick: false,
    illnessName: null,
    hasActedThisCycle: false,
    outingsThisSeason: 0,
    outingsLastSeason: 0,
    bestHomeRunsInGame: 0,
    cycleHitGames: 0,
    popularityAtSeasonStart: STARTING_POPULARITY,
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    salary: STARTING_SALARY,
    endingIndex: null,
    illnessCooldown: 0,
    battingTypeIndex: profile.battingTypeIndex,
    positionIndex: profile.positionIndex,
    battingSide: profile.battingSide,
    skinIndex: profile.skinIndex,
    subItemIds: [],
    illnessRemaining: 0,
    injuryRemaining: 0,
    equipmentLevels: { hit: 0, power: 0, defense: 0, run: 0 },
    ownedEquipment: [],
    openedHiddenIds: [],
    league: EMPTY_LEAGUE,
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    regularSeasonFirstCount: 0,
    regularSeasonRewardTaken: false,
    seasonEndState: null,
    postseason: null,
    lotteryPurchases: 0,
    lotteryFirstPrizes: 0,
    specialSwingLevel: 0,
    specialSwingSessions: 0,
    specialSwingNumber: 0,
    // 생성 0x17360 이 +0xa = 0xa7 → 등록 0x10fb4 의 0xb53f1 이 레코드 7번 칸에 넣는다 (8번 타자 — `ROOKIE_BATTER_SLOT`)
    battingOrder: ROOKIE_BATTER_SLOT + 1,
    battingOrderPath: null,
    lastMidSeasonGoalCount: 0,
    skillIds: STARTING_SKILL_IDS,
    // 신인 스킬도 0xa4bd9 로 얻으니(0x11230) 그 자리에서 자동 장착된다 — 둘 다 플러스, 상한 6 안
    equippedSkillIds: STARTING_SKILL_IDS,
    // +0x1c6 을 쓰는 곳은 확장(0x148f8) 하나뿐 — 새 선수는 0 으로 본다 (추정: 신인 적재 0x10fb4 가 이 칸을 안 쓴다)
    skillSlotLevel: 0,
    streaks: { multiHit: 0, homeRun: 0, hitless: 0 },
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

export function trainingCountOf(career: PlayerCareer, menuId: string): number {
  return career.trainingCounts[menuId] ?? 0
}

/**
 * 훈련 한 번을 메뉴별로 센다. 칭호 23(200회)·24(100회)가 이 합을 본다 (titles.ts).
 * 메뉴별로 나눠 두는 것은 원본 저장 구조를 아직 못 찾아서다 — 합계만 쓰므로 안전하다 (추정).
 */
/** 몹쓸몸·유리몸 스킬 번호 — 그 스킬을 가진 채로 훈련한 횟수를 따로 센다 (A-4) */
const BAD_BODY_SKILL = 3
const FRAGILE_SKILL = 4

/**
 * 훈련 한 번을 센다 (0x18a80).
 * 통산 수와 함께 **칸별 연속 훈련 수**도 갱신한다 — 훈련한 칸은 +1, **나머지 칸은 모두 0** 이다.
 * 몹쓸몸·유리몸은 0x18b86~0x18bd6(모드 갈림 없음, 직접 떴다): 보유 비트(0xa3a75)면 u8 +0x75/+0x76 += 1, **아니면 0 으로** —
 * 가진 채 이어 한 훈련 수다(예전 웹은 안 가졌을 때 그대로 두어, 풀린 뒤 다시 얻으면 곧 풀렸다).
 */
export function countTraining(career: PlayerCareer, menuId: string): PlayerCareer {
  return {
    ...career,
    trainingCounts: { ...career.trainingCounts, [menuId]: trainingCountOf(career, menuId) + 1 },
    consecutiveTrainingCounts: { [menuId]: (career.consecutiveTrainingCounts[menuId] ?? 0) + 1 },
    badBodyTrainings: hasSkill(career, BAD_BODY_SKILL) ? (career.badBodyTrainings + 1) & 0xff : 0,
    fragileTrainings: hasSkill(career, FRAGILE_SKILL) ? (career.fragileTrainings + 1) & 0xff : 0,
  }
}

const MONEY_GRUBBER_SKILL = 2
const HELPLESS_SKILL = 5
/** 무력감 해제 카운터가 이어지는 기준 사기 (A-4) */
const HIGH_MORALE = 90

/** 무력감 · 먹튀 경기 뒤 카운터 세 칸 (+0x1c7 · +0x1cd · +0x1c0) */
export interface SkillGameCounters {
  readonly highMoraleStreak: number
  readonly moneyGrubberGames: number
  readonly moneyGrubberPopularityGain: number
}

const toInt8 = (value: number) => (value << 24) >> 24
const toInt16 = (value: number) => (value << 16) >> 16

/**
 * **+0x1c2 이번 시즌 인기도 변화 합을 쌓는다** — 116 의 12c14~12c30 `ldrsh +0x1c2 · + ldrsb +0x4a · strh`(모드 3·4 공용).
 * 더하는 쪽 +0x4a 는 **s8 로 읽고**(−128~127 을 넘는 변화는 잘려 돈다), 합은 s16 칸에 적는다(넘치면 음수로 돈다).
 */
export function addSeasonPopularityGain(gain: number, popularityChange: number): number {
  return toInt16(gain + toInt8(popularityChange))
}

/**
 * **116 진입의 경기 뒤 카운터** (12bc2~12c84, 모드 3·4 공용 — 스킬은 `0xa3a75(S, 5|2)` 보유 비트 5 무력감 · 2 먹튀, 두 편 같은 번호):
 * ```
 * 무력감 있고 사기(0xa3a25) > 89  → s8 +0x1c7 += 1
 * 무력감 있고 사기 ≤ 89          → +0x1c7 = 0
 * 무력감 없음                     → 그대로 (지우지 않는다)
 * (s16 +0x1c2 += s8 +0x4a · 0xa4d09 — `addSeasonPopularityGain`)
 * 먹튀 있음 → s8 +0x1cd += 1 · s16 +0x1c0 += s8 +0x4a  /  없음 → 둘 다 0
 * ```
 */
export function countSkillGameCounters(
  counters: SkillGameCounters,
  input: { readonly hasHelpless: boolean; readonly hasMoneyGrubber: boolean; readonly morale: number; readonly popularityChange: number },
): SkillGameCounters {
  return {
    highMoraleStreak: !input.hasHelpless
      ? counters.highMoraleStreak
      : input.morale >= HIGH_MORALE ? toInt8(counters.highMoraleStreak + 1) : 0,
    moneyGrubberGames: input.hasMoneyGrubber ? toInt8(counters.moneyGrubberGames + 1) : 0,
    moneyGrubberPopularityGain: input.hasMoneyGrubber
      ? toInt16(counters.moneyGrubberPopularityGain + toInt8(input.popularityChange))
      : 0,
  }
}

/**
 * 경기 뒤 카운터 (A-4 · 116 진입 12bc2~12c3c) — 인기도 변화가 정해진 다음에 부른다.
 *   +0x1c2 이번 시즌 인기도 변화 합 · +0x1c0/+0x1cd 먹튀 보유 중 합/경기 수
 *   +0x1c7 무력감 보유 중 "경기 뒤 사기 ≥ 90" 연속 경기 수 (`countSkillGameCounters`)
 * 먹튀 카운터는 그 스킬이 **없으면 0** 으로 되돌리고, 무력감 카운터는 없으면 **그대로 둔다**(12bee~12bfc).
 */
export function countGameForSkills(
  career: PlayerCareer,
  popularityChange: number,
): PlayerCareer {
  return {
    ...career,
    seasonPopularityGain: addSeasonPopularityGain(career.seasonPopularityGain, popularityChange),
    ...countSkillGameCounters(career, {
      hasHelpless: hasSkill(career, HELPLESS_SKILL),
      hasMoneyGrubber: hasSkill(career, MONEY_GRUBBER_SKILL),
      morale: career.morale,
      popularityChange,
    }),
    reputationZeroGames: countReputationZeroGame(career.reputationZeroGames, career.reputation),
  }
}

/**
 * `0xa4d08(S)` — 평판(+0x62)이 0 이면 +0x184 를 한 칸 올리고(u8, 255 → 0), 아니면 0 (0xa4d08~0xa4d24).
 * ⚠️ 원본은 연속 기록 0x8a6fc(@0x12b6e) 뒤에 부른다. 웹은 연속 기록이 주는 평판을 이 카운터 **뒤에** 더하므로
 *    그 평판이 0 을 벗어나게 하는 경기에선 한 칸 어긋날 수 있다 — 0x8a6fc 가 평판을 그 자리에서 바꾸는지 아직 안 읽었다.
 */
export function countReputationZeroGame(count: number, reputation: number): number {
  return reputation === 0 ? (count + 1) & 0xff : 0
}

/** 이번 시즌 칸별 훈련 수 = 통산 − 새 시즌 사본 (A-4) */
export function seasonTrainingCountOf(career: PlayerCareer, menuId: string): number {
  return trainingCountOf(career, menuId) - (career.seasonStartTrainingCounts[menuId] ?? 0)
}

/** 이번 시즌 훈련 수 합계 */
export function seasonTrainingTotalOf(career: PlayerCareer): number {
  return Object.keys(career.trainingCounts).reduce(
    (total, menuId) => total + seasonTrainingCountOf(career, menuId),
    0,
  )
}

export function gainPopularity(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, popularity: clamp(career.popularity + amount, 0, MAXIMUM_POPULARITY) }
}

export function gainReputation(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, reputation: clamp(career.reputation + amount, 0, MAXIMUM_REPUTATION) }
}

/** G포인트를 더한다 (상한 99999). 원본은 전역 저장 +0x64 에 쌓는다 */
export function gainGamePoint(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, gamePoint: clamp(career.gamePoint + amount, 0, MAXIMUM_GAME_POINT) }
}

export function gainMorale(career: PlayerCareer, amount: number): PlayerCareer {
  return { ...career, morale: clamp(career.morale + amount, 0, MAXIMUM_MORALE) }
}

/**
 * 필살타법 창(상태 0x7b)에서 고른 번호를 선수 +0x18 에 쓴다 (0x1816c `strb`).
 * 관리 주기 행동·G포인트는 건드리지 않는다 — 0x18150~0x1816e 사이 쓰기는 이 `strb` 하나뿐이다.
 */
export function selectSpecialSwingNumber(career: PlayerCareer, number: number): PlayerCareer {
  return { ...career, specialSwingNumber: number }
}

/** 관리 주기의 행동 한 번을 쓴다. 경기를 치르면 다시 생긴다. */
export function spendCycleAction(career: PlayerCareer): PlayerCareer {
  return { ...career, hasActedThisCycle: true }
}

/** 보유 비트(+0x1b8) — 0xa3a74. 칭호·엔딩·연속 기록·경기 뒤 카운터처럼 **보유** 를 보는 곳이 쓴다 */
export function hasSkill(career: PlayerCareer, skillId: number): boolean {
  return career.skillIds.includes(skillId)
}

/**
 * 장착 비트(선수기록 +0x14) — 0xa4bf8 / 0xb62b4. 경기 스킬 효과(0xab214·0xb6414)·훈련 상승(0x17f5c 의 0)·
 * 행운(6: 부상 0x1b4c4 · 질병 0xadbb8 · 사기 0xa741c) 처럼 **장착** 을 보는 곳이 쓴다.
 */
export function isSkillEquipped(career: Pick<PlayerCareer, 'equippedSkillIds'>, skillId: number): boolean {
  return career.equippedSkillIds.includes(skillId)
}

/** 플러스 스킬 장착 상한 표 0xd7e8e (= UI 쪽 0xcc4f4) — 슬롯 단계 L 0·1·2 */
export const PLUS_SKILL_SLOT_LIMITS: readonly number[] = [6, 8, 10]
/** 장착 수 세기 0xa4aa4 가 도는 번호 범위 0~23 (`cmp r4,#0x17`) */
const LAST_COUNTED_SKILL_ID = 23

/**
 * 마이너스 스킬인가 — 0x5f350(표, s) 비트1. 디스어셈(확정):
 *   s ≤ 1 → 1 · s−8 ≤ 8(8~16) → 1 · s−2 ≤ 3(2~5) → **2** · s−17 ≤ 3(17~20) → **2** · 나머지(6·7·21~) → 4
 *   (여기에 s ≤ 7 이면 0x10, 아니면 0x20 을 OR). 그래서 19·20 도 마이너스다 — 표 0xd7e10 = [2,3,4,5,17,18,19,20] 과 같은 묶음.
 * 쓰는 곳이 둘로 갈리지만 묶음은 같다:
 *   0x5f350 비트1 — 장착 수 0xa4aa4 · 장착 동작 0xa4b04(상한 건너뜀) · 최면요법 효과 0xa4970 · 장착 창 해제불가(H-modes 6절)
 *   표 0xd7e10 — 해제 플래그 0xa43fc/0xa4f30(+0x1d0+k) · 최면요법 가드 0xa4f00(보유 수)
 * 모드 3(투수편)도 같은 함수들을 탄다(0x5f350 에 모드 갈림이 없다).
 */
export function isMinusSkill(skillId: number): boolean {
  return MINUS_SKILL_IDS.includes(skillId)
}

/** 지금 단계의 플러스 스킬 장착 상한 (0xd7e8e[+0x1c6]) */
export function plusSkillSlotLimitOf(career: Pick<PlayerCareer, 'skillSlotLevel'>): number {
  return PLUS_SKILL_SLOT_LIMITS[career.skillSlotLevel] ?? PLUS_SKILL_SLOT_LIMITS[0]
}

/** 장착한 플러스 스킬 수 — 0xa4aa4: 번호 0~23 중 장착이고 마이너스가 아닌 것만 센다 */
export function equippedPlusSkillCountOf(career: Pick<PlayerCareer, 'equippedSkillIds'>): number {
  return career.equippedSkillIds.filter((id) => id <= LAST_COUNTED_SKILL_ID && !isMinusSkill(id)).length
}

/**
 * 장착 동작 0xa4b04(P, s, on) — **켜기는 이 함수에서만** 일어난다 (0xb663c 호출지는 여기 둘뿐).
 *   on = false → 0xb66dc: 장착만 끈다 (보유는 그대로)
 *   on = true  → 플러스 스킬이고 `상한 ≤ 장착 수` 면 아무 일도 안 한다(못 낌).
 *                **마이너스 스킬은 상한을 안 본다** — 늘 장착된다. 이미 켜져 있으면 그대로(0xb663c 가 0 반환).
 * 보유 여부는 보지 않는다 — 부르는 쪽(획득 0xa4bd8 · 창 0x147b0)이 맞춘다.
 * 모드 3(투수편)도 같은 함수를 탄다 — 갈림은 팀 칸 고르기(모드 4 0xb53d1 · 모드 3 0xb51fd(팀, 0))뿐이라 칸 꼴만 받는다.
 *
 * ⚠️ 원본은 켤 때 통계 기록 `[mgr+0xc8]` 의 +0xf4(모드 4)·+0xf8(모드 3) 에도 같은 비트를 OR 한다 — "한 번이라도 켠 스킬",
 *    읽는 곳은 전부 수집 보상 k=5 "스킬 모두 수집"(0x28f8a) 하나다. 저장 칸·함수는 `collection/model/annalsStats.ts`
 *    (`markSkillEquipped`)에 있고 **부르는 자리는 아직 잇지 않았다** · 모드 4 면 팀 로스터 칸(0xb53d1)에도 켠다(같은 칸인지 유력).
 */
export function setSkillEquipped<T extends Pick<PlayerCareer, 'equippedSkillIds' | 'skillSlotLevel'>>(
  career: T,
  skillId: number,
  on: boolean,
): T {
  if (!on) {
    if (!isSkillEquipped(career, skillId)) return career
    return { ...career, equippedSkillIds: career.equippedSkillIds.filter((id) => id !== skillId) }
  }
  if (!isMinusSkill(skillId) && plusSkillSlotLimitOf(career) <= equippedPlusSkillCountOf(career)) return career
  if (isSkillEquipped(career, skillId)) return career
  return { ...career, equippedSkillIds: [...career.equippedSkillIds, skillId] }
}

/**
 * 장착 칸이 없는 옛 저장의 장착 칸 다시 세우기 — 웹에는 장착 창이 없었으므로 그동안의 장착은 **모두
 * 획득 때의 자동 장착(0xa4bd8 → 0xa4b04(P,s,1))** 뿐이었다. 그래서 보유 목록(얻은 차례)을 슬롯 단계 0 에서
 * 차례로 다시 자동 장착하면 원본이 그 선수에게 남겼을 장착과 같다.
 * ⚠️ 어긋나는 한 가지: 플러스 스킬이 상한을 넘겨 못 낀 뒤 앞선 플러스 스킬이 보상으로 지워진 경우 —
 *    원본은 빈자리를 다시 채우지 않지만 이 재구성은 채운다(웹 저장에 그 이력이 없다).
 */
export function rebuildEquippedSkillIds(skillIds: readonly number[]): readonly number[] {
  let equipped: Pick<PlayerCareer, 'equippedSkillIds' | 'skillSlotLevel'> = { equippedSkillIds: [], skillSlotLevel: 0 }
  for (const id of skillIds) {
    if (!isMinusSkill(id) && plusSkillSlotLimitOf(equipped) <= equippedPlusSkillCountOf(equipped)) continue
    if (!equipped.equippedSkillIds.includes(id)) equipped = { ...equipped, equippedSkillIds: [...equipped.equippedSkillIds, id] }
  }
  return equipped.equippedSkillIds
}

/** 마이너스 스킬 (표 0xd7e10) — 한 번 해제하면 다시 얻을 수 없다 */
export const MINUS_SKILL_IDS: readonly number[] = [2, 3, 4, 5, 17, 18, 19, 20]

/** 스킬 보상이 건드리는 칸 — 모드 3(투수편) 레코드도 같은 칸이라(0xa4430 · 0xa4bd8 공용) 꼴만 받는다 */
export type SkillRewardCareer = Pick<PlayerCareer, 'skillIds' | 'removedMinusSkillIds' | 'equippedSkillIds' | 'skillSlotLevel'>

/**
 * 보상 종류 4 — 양수 n 은 스킬 n−1 획득, 음수 −n 은 스킬 n−1 해제 (0x8c5bc).
 *
 * **마이너스 스킬을 해제하면 `+0x1d0+k` 플래그가 서서 그 해 안에는 다시 얻지 못한다** (0xa4430, A-6) — 연초 115 의
 * 0xa4ee8 이 지운다(R9 7절, `useCareerSession` 105 진입).
 * 획득 쪽도 그 플래그를 보고 막는다 — 웹에 통째로 빠져 있던 규칙이다.
 */
export function applySkillReward<T extends SkillRewardCareer>(career: T, value: number): T {
  const skillId = Math.abs(value) - 1
  const owns = career.skillIds.includes(skillId)
  if (value > 0) {
    if (career.removedMinusSkillIds.includes(skillId)) return career
    // 획득 0xa4bd8 = 보유 비트를 켜고 **곧바로 0xa4b04(P, s, 1)** — 자리가 있으면 자동 장착.
    // 이미 가진 스킬이어도 장착은 다시 시도한다(0xa4bd8 에 보유 검사가 없다) — 창에서 뺀 플러스 스킬이
    // 다시 들어오면 자리가 있는 한 다시 끼워진다.
    const owned = owns ? career : { ...career, skillIds: [...career.skillIds, skillId] }
    return setSkillEquipped(owned, skillId, true)
  }
  if (!owns) return career
  const removed = MINUS_SKILL_IDS.includes(skillId) && !career.removedMinusSkillIds.includes(skillId)
  // 제거 0xa4430 = 보유 비트를 끄고 0xb66dd 로 장착도 끈다
  return setSkillEquipped({
    ...career,
    skillIds: career.skillIds.filter((id) => id !== skillId),
    removedMinusSkillIds: removed ? [...career.removedMinusSkillIds, skillId] : career.removedMinusSkillIds,
  }, skillId, false)
}

export function affectionOf(career: PlayerCareer, heroineId: string): number {
  return career.affection[heroineId] ?? 0
}

export function gainAffection(
  career: PlayerCareer,
  heroineId: string,
  amount: number,
): PlayerCareer {
  const next = clamp(affectionOf(career, heroineId) + amount, 0, MAXIMUM_AFFECTION)
  return { ...career, affection: { ...career.affection, [heroineId]: next } }
}

export function gainAbility(
  career: PlayerCareer,
  gains: Partial<BatterAbility>,
): PlayerCareer {
  return {
    ...career,
    ability: {
      hit: clamp(career.ability.hit + (gains.hit ?? 0), 0, MAXIMUM_ABILITY),
      power: clamp(career.ability.power + (gains.power ?? 0), 0, MAXIMUM_ABILITY),
      run: clamp(career.ability.run + (gains.run ?? 0), 0, MAXIMUM_ABILITY),
      defense: clamp(career.ability.defense + (gains.defense ?? 0), 0, MAXIMUM_ABILITY),
    },
  }
}

/** 경기 결과를 커리어에 반영한다. G포인트 지급과 체력 회복이 함께 일어난다. */
export function applyGameResult(career: PlayerCareer, summary: GameSummary): PlayerCareer {
  const playedStats = recordGamePlayed(summary.stats)

  return {
    ...career,
    gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint + gamePointRewardOf(summary)),
    gamesPlayed: career.gamesPlayed + 1,
    // 부상 중 치른 경기 수 (+0x1b6). 부상 기간은 경기로 줄지 않고 휴식·입원으로만 줄어든다 (G-2)
    injuredGamesPlayed: career.injuredGamesPlayed + (career.isInjured ? 1 : 0),
    illnessCooldown: Math.max(0, career.illnessCooldown - 1),
    // 원본은 **경기마다** 행동 플래그를 지운다 (0x4f158, G-6 확정).
    // 투수편(`pitcherCareer.ts`)과 같은 기준이다 — 예전에는 2경기(관리 주기)마다 풀었다.
    hasActedThisCycle: false,
    bestHomeRunsInGame: Math.max(career.bestHomeRunsInGame, summary.stats.homeRuns),
    cycleHitGames: career.cycleHitGames + (isCycleHit(summary.stats) ? 1 : 0),
    eagleEyeGamesRemaining: Math.max(0, career.eagleEyeGamesRemaining - 1),
    stats: mergeStats(career.stats, playedStats),
    careerStats: mergeStats(career.careerStats, playedStats),
    // 사람 경기도 원본은 **같은 기록 함수 0xa8024** 를 부른다 — 동료 여덟 타순과 상대 팀 타석이
    // CPU 끼리 경기와 한 표에 쌓인다 (B-2). 내 선수만 빠져 있는데, 내 성적은 `stats` 가 이미
    // 세고 있어 두 번 세지 않으려는 것이다 (순위표를 만들 때 `myLeagueRecordOf` 로 끼워 넣는다).
    // 미션·홈런더비처럼 리그 밖 경기는 이 칸을 주지 않으므로 그때는 표가 그대로다.
    // 투수 줄도 같은 정산 0xa8024 · 경기 끝 0xa7de8 이 쌓는다 — 정규시즌 경기만 (0xa56dc 의 포스트시즌 거짓)
    leaguePlayerStats: recordHumanGamePitchers(
      recordLeaguePlateAppearances(career.leaguePlayerStats, summary.leaguePlateAppearances ?? []),
      summary.leaguePitchers,
      career.postseason === null,
    ),
    // 두 팀 투수 레코드 +0x2c 는 경기 끝 값이 남는다 — 준비 0x1c46c 가 g == 0 이면 열 팀을 10000 으로 채운 뒤다
    ...(summary.pitcherStaminas === undefined
      ? {}
      : {
          leaguePitcherStaminas: staminaTableAfterHumanGame(career, leagueDayCounterOf(career), [
            { teamId: summary.ourTeamId, staminas: summary.pitcherStaminas.ours },
            { teamId: summary.opponentTeamId, staminas: summary.pitcherStaminas.opponent },
          ]),
        }),
    // 정산 0x4ea0c 모드 4 → 4f020 → 4f072: 측 1 점수 > 측 0 점수 ? 측 1 승 : 측 0 승 — 무승부 갈래가 없다.
    // 경기 끝 0xb68fc 가 동점이면 끝을 안 내 경기는 늘 갈리므로(웹 경기도 연장 상한이 없다 — `gameState`) 이긴 쪽 = 점수가 많은 쪽이다.
    // **포스트시즌 중에는 정규시즌 전적을 건드리지 않는다** — 0xb76dc 가 포스트시즌 플래그로 갈라져
    // 시리즈 승수만 깎는다. 그래서 45경기 뒤에 치른 경기가 순위표에 더 쌓이지 않는다.
    league:
      career.postseason !== null
        ? career.league
        : recordLeagueResult(
            career.league,
            summary.result === '승' ? summary.ourTeamId : summary.opponentTeamId,
            summary.result === '승' ? summary.opponentTeamId : summary.ourTeamId,
          ),
    // 포스트시즌 경기는 시리즈 승수로 들어간다 (0xb76dc 포스트시즌 분기)
    postseason:
      career.postseason === null
        ? career.postseason
        : advancePostseason(
            career.postseason,
            summary.result === '승' ? summary.ourTeamId : summary.opponentTeamId,
          ),
    wins: career.wins + (summary.result === '승' ? 1 : 0),
    losses: career.losses + (summary.result === '승' ? 0 : 1),
  }
}

/**
 * 같은 날 나머지 네 경기를 치러 리그 전적에 넣는다.
 * 원본도 사람 경기 정산(0x4ea0c) 안에서 0xc2a48 을 따로 부른다 — 기록 갱신과 별개의 단계다.
 * `applyGameResult` 뒤에 부르는 것을 전제로 `gamesPlayed − 1` 을 일차로 쓴다.
 */
export function applyLeagueDay(
  career: PlayerCareer,
  myTeamId: number,
  random: RandomPort,
  /** 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` — CPU 끼리 경기의 마선수 배율(0xd88aa). 안 넘기면 Lv1(60%) */
  aceLevels?: Readonly<Record<number, number>>,
): PlayerCareer {
  // 포스트시즌 경기 끝은 4f268 이 CPU 리그 경기(0xc2a48)를 건너뛰고 곧장 하루 끝으로 간다 — 회복만 돈다
  if (career.postseason !== null) {
    return { ...career, leaguePitcherStaminas: recoveredLeagueStaminas(career.leaguePitcherStaminas ?? {}, BATTER_EDITION_MODE) }
  }
  const day = Math.max(0, career.gamesPlayed - 1)
  // 원본 0xc2a48 은 승패만이 아니라 **선수별 타석 기록(0xa8024)도** 남긴다 — 둘 다 받아 넣는다.
  // CPU 경기 투수는 리그 표의 +0x2c 로 서고(경기 사이에 이어진 값), 사람 경기 두 팀 차례는 여기서 한 칸 돈다
  const played = playLeagueDay(
    career.league,
    day,
    myTeamId,
    random,
    career.leaguePlayerStats,
    career.leaguePitcherStaminas ?? {},
    aceLevels,
  )
  return {
    ...career,
    league: played.league,
    leaguePlayerStats: played.playerStats,
    // 하루 끝 4f2e8 — 열 팀 0xb617c (+20%)
    leaguePitcherStaminas: recoveredLeagueStaminas(played.pitcherStaminas, BATTER_EDITION_MODE),
  }
}

/**
 * 사람 경기 준비 `0x1c46c` 가 세운 두 팀 투수 — 레코드 차례(0번 선발 · 벤치 차례)와 칸별 `+0x2c`.
 * `startGame` 마지막 인자(`GamePitcherSetup`)로 넘긴다. g 는 `leagueDayCounterOf`.
 */
export function leagueGamePitchersOf(
  career: PlayerCareer,
  opponentTeamId: number,
): {
  readonly ourOrder: readonly number[]
  readonly opponentOrder: readonly number[]
  readonly ourStaminas?: readonly number[]
  readonly opponentStaminas?: readonly number[]
} {
  const day = leagueDayCounterOf(career)
  const ourStaminas = humanGamePitcherStaminasOf(career, day, career.teamId)
  const opponentStaminas = humanGamePitcherStaminasOf(career, day, opponentTeamId)
  return {
    ourOrder: humanGamePitcherOrderOf(career, BATTER_EDITION_MODE, day, career.teamId),
    opponentOrder: humanGamePitcherOrderOf(career, BATTER_EDITION_MODE, day, opponentTeamId),
    ...(ourStaminas === undefined ? {} : { ourStaminas }),
    ...(opponentStaminas === undefined ? {} : { opponentStaminas }),
  }
}

/**
 * 대진 128 [확인]의 CPU 끼리 포스트시즌(0x13da0 → 0xc2760) — 리그 표의 +0x2c 로 서고 깎인 값을 남긴다(회복 없음).
 * 내 차례이거나 끝난 대진이면 그대로다.
 */
export function applyPostseasonCpuGames(
  career: PlayerCareer,
  random: RandomPort,
  aceLevels?: Readonly<Record<number, number>>,
): PlayerCareer {
  if (career.postseason === null) return career
  const result = runCpuPostseasonWithStamina(
    career.postseason,
    career.teamId,
    random,
    career.leaguePitcherStaminas ?? {},
    aceLevels,
  )
  return { ...career, postseason: result.series, leaguePitcherStaminas: result.pitcherStaminas }
}

/**
 * 45경기가 끝나면 정규시즌을 닫는다 (0xb818c).
 * 1위면 레코드 +0x7a 를 늘리고, 포스트시즌 대진(0xb80a8)을 연다.
 * 이미 포스트시즌이 열려 있으면 아무것도 하지 않는다.
 */
export function applySeasonEnd(career: PlayerCareer): PlayerCareer {
  if (career.postseason !== null || career.gamesPlayed < GAMES_PER_SEASON) return career
  const result = finishRegularSeason(career.league, career.teamId)
  return {
    ...career,
    regularSeasonFirstCount: career.regularSeasonFirstCount + (result.isRegularSeasonFirst ? 1 : 0),
    // 대진 0xb80a8 — 정규시즌 끝 투수 레코드 차례를 그대로 들고 간다 (포스트시즌 선발·벤치 차례의 바탕)
    postseason: startPostseason(result.ranking, career.league.pitcherOrders),
  }
}

/**
 * 다음 경기 상대 (0xb765c).
 * 정규시즌은 일정표 0xd89cb 에서 그날 상대를 읽고, 포스트시즌은 지금 시리즈의 맞은편이다.
 * 포스트시즌인데 내 팀이 그 시리즈에 없으면(진출 실패) 상대가 없다 — 그때는 일정표로 돌아간다 (추정).
 */
export function nextOpponentOf(career: PlayerCareer): number {
  const series = career.postseason
  if (series !== null && series.round !== '종료') {
    if (series.teams[0] === career.teamId) return series.teams[1]
    if (series.teams[1] === career.teamId) return series.teams[0]
  }
  return opponentOf(career.gamesPlayed, career.teamId)
}

/** 원본 전역 G포인트 상한 */
/** G포인트 상한 (저장+0x64) */
export const MAXIMUM_GAME_POINT = BALANCE.limits.gamePoint

/** 경기 끝 G포인트 = 달성 기록 금액 합 (0x4ea0c, 누락 탐색 9차). 출전·승리 보너스는 원본에 없다 */
export function gamePointRewardOf(summary: GameSummary): number {
  return recordGamePointsOf(summary.recordIds)
}

export function isManagementCycleOpen(career: PlayerCareer): boolean {
  return career.gamesPlayed > 0 && career.gamesPlayed % GAMES_PER_MANAGEMENT_CYCLE === 0
}

export function isSeasonFinished(career: PlayerCareer): boolean {
  return career.gamesPlayed >= GAMES_PER_SEASON
}

/**
 * 시즌을 넘긴다 (0x1b768 · 안쪽 `0xa39a8`, S13 2절 전수 확정).
 * 시즌 성적은 초기화되고 통산 성적은 남는다.
 *
 * ⚠️ **원본 버그 그대로** — `0xa39bc`·`0xa39c6` 이 **둘 다 `S+0x1e0`** 을 16바이트 지운다.
 * 경기 뒤 누적 카운터는 `+0x1e0`·`+0x1f0` **두 벌**이고 `0xa690c` 가 같은 값을 양쪽에 더하는데,
 * 둘째 줄이 `r6`(= `S + 0x1e0`)을 그대로 다시 써서 **`+0x1f0` 벌은 영영 안 지워진다**
 * → 나리 누적 카운터 한 벌이 해를 넘겨 계속 쌓인다.
 * 웹판에는 그 두 벌짜리 누적 카운터 자체가 없어 **옮길 코드가 없다** — 사실만 적어 둔다.
 */
/**
 * 국가대항전 플래그를 내린다 — 원본 `S+0x12c = 0`(대회 끝 0x1b9ea · 0x1bae6 · 새 시즌 0x1b768 의 1b774). 대회 칸(L+0xa8~)은
 * 지우지 않지만 플래그가 꺼지면 아무도 안 읽으므로 웹은 칸째 뺀다. 대표팀 칸 두 개(`nariCupTeams`)는 남긴다(원본도 안 지운다).
 */
export function endNationalCup<T extends { readonly nationalCup?: NationalCup }>(career: T): T {
  if (career.nationalCup === undefined) return career
  const next = { ...career }
  delete (next as { nationalCup?: NationalCup }).nationalCup
  return next
}

export function startNextSeason(career: PlayerCareer): PlayerCareer {
  return {
    ...endNationalCup(career),
    season: career.season + 1,
    gamesPlayed: 0,
    // 칭호 25·26 은 새 시즌 첫 경기 전에 **지난해** 외출 수로 본다 (P3 9절) — 세는 칸을 비우기 전에 떠 둔다
    outingsThisSeason: 0,
    outingsLastSeason: career.outingsThisSeason,
    // 인기도 스냅샷 (+0x78 ← 지금 인기도, 0xa39e0) — 올해의 목표 "인기도 상승" 의 기준점
    popularityAtSeasonStart: career.popularity,
    // 올해의 목표 플래그 두 개를 되돌린다 — +0x1b7(0xa39d0) 창을 봤다 · +0x1bc(0x1b882) 연초 이벤트
    hasSeenYearGoalWindow: false,
    yearGoalEventDone: false,
    // 새 시즌 시작 때 통산 훈련 수를 떠 둔다 (+0x6b+i) — 이번 시즌 훈련 수를 빼서 구한다
    seasonStartTrainingCounts: { ...career.trainingCounts },
    // 이번 시즌 인기도 변화 합은 새 시즌에 0 이다 (+0x1c2)
    seasonPopularityGain: 0,
    // 새 시즌 전환 0x1b768: 사기 100, 소지금 += 연봉
    morale: MAXIMUM_MORALE,
    money: Math.min(MAXIMUM_MONEY, career.money + career.salary * ORIGINAL_MONEY_UNIT),
    stats: EMPTY_SEASON_STATS,
    // 리그를 새로 깐다 — `0xa39ae` 가 리그 객체(S+0x80)를 초기화하고, 뒤이어 `0x204e0(저장, 편, 0)`
    // 이 **리그 전 선수의 시즌 성적**을 0 으로 되돌린다(팀 레코드·능력치·사기는 그대로 둔다).
    // 웹판은 로스터가 붙박이 표라 성적만 따로 `leaguePlayerStats` 에 담는다 — 그 표가 0x204e0 이
    // 지우는 칸에 해당하므로 여기서 함께 비운다.
    // 승패는 비우되 **투수 레코드 차례는 잇는다** — 새 시즌 처리는 팀 저장 레코드를 다시 짓지 않아 지난 시즌·포스트시즌에
    // 섞인 차례가 그대로 남는다 (`nextSeasonLeague`). 레코드 +0x2c 는 첫 경기 준비(g == 0)가 열 팀 10000 으로 채운다
    league: nextSeasonLeague(
      career.postseason === null
        ? career.league.pitcherOrders
        : pitcherOrdersAfterPostseason(career.postseason, career.league.pitcherOrders),
    ),
    leaguePlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
    postseason: null,
    // 0x1b7c0 `S[0x77] = 0` — 정규시즌 우승 보상 받음 플래그 해제 (S13)
    regularSeasonRewardTaken: false,
    // 0x1b7ba `S[0x50] = 1` — 시즌 끝 사슬을 벗어난다
    seasonEndState: null,
    // 0x1b882 `memset(S+0x1bc, 0, 4)` — 나리 S 의 +0x1bc 는 연속 기록 세 칸이다(0xa4ce0 · 0x8a6fc)
    streaks: { multiHit: 0, homeRun: 0, hitless: 0 },
    wins: 0,
    draws: 0,
    losses: 0,
  }
}

/** 한 경기에 단타·2루타·3루타·홈런을 모두 쳤는가 */
function isCycleHit(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

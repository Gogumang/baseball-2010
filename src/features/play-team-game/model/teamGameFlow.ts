import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { describeOutcome, isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { applyPitchResolution, createAtBat } from '@/entities/at-bat/model/atBatState'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'
import {
  applyAtBatOutcome,
  createGame,
  ourHalfOf,
  PLAYER_SIDE_LAST_BAT,
  resultOf,
} from '@/entities/game/model/gameState'
import type { GameState, PlayerSide } from '@/entities/game/model/gameState'
import { advanceRunners } from '@/entities/game/model/baseState'
import { attemptSteal, canStealFrom } from '@/entities/game/model/steal'
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { rollStartingPitcherIndex } from '@/entities/team/model/teamRoster'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { applyOpponentAtBat, applyOpponentRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { defenseAbilitiesOf, isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { PICKOFF_RESULT, runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import type { PickoffPlayResult } from '@/features/defense-play/model/pickoffPlay'
import { PICKOFF_PLAY_KIND, pickoffPlayForKey } from '@/entities/defense-controls/model/pickoff'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats'
import {
  popularityCompleteGameOf,
  reputationCompleteGameOf,
} from '@/entities/season-mode/model/seasonEvaluation'
import type { CompleteGameFlags } from '@/entities/season-mode/model/seasonEvaluation'
import {
  clearSeasonGameRecord,
  recordSeasonGameEvent,
  SEASON_RECORD_CODE,
} from '@/entities/season-mode/model/seasonReputation'
import type { CompleteGameKind, MySide } from '@/entities/season-mode/model/seasonReputation'
import { createBurstSession, resolveBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import {
  benchClearingEffectOf,
  rollsIntoBenchClearing,
  staminaAfterBenchClearing,
} from '@/entities/game/model/benchClearing'
import { pitchAgainstBatter } from '@/entities/pitching/model/simulateBatter'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import {
  consumeStamina,
  FULL_STAMINA,
  pitchStaminaCostOf,
  staminaCapacityOf,
  staminaPercentOf,
} from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  chooseReplacementPitcher,
  EMPTY_MOUND_COUNTERS,
  judgePitcherChange,
  rollsCloser,
} from '@/entities/pitching/model/pitcherChange'
import type { MoundPitcherCounters } from '@/entities/pitching/model/pitcherChange'
import { runnerCountOf } from '@/entities/game/model/baseState'
import {
  buildHumanPitch,
  drainStamina,
  fatiguedStatsOf,
  pitchGradeOf,
  pitchSlotsOf,
} from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot, PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import type { FieldingAssignment, SeasonTeamCondition } from '@/features/play-team-game/model/gameAbilities'
import { FULL_PLAY_SETTINGS, isHumanControlled } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  aceLeveledAbility,
  entryBatterGameAbilities,
  entryPitcherGameAbilities,
  NO_ACE_BATTER,
  NO_ROSTER_SLOT,
  rosterEntryBattersOf,
  rosterEntryPitchersOf,
  withAceBatter,
  withAcePitcher,
} from '@/features/play-team-game/model/teamGameRoster'
import type {
  TeamEntryBatter,
  TeamEntryPitcher,
  TeamGameAbilityContext,
} from '@/features/play-team-game/model/teamGameRoster'
import { rollOpponentAceIndex } from '@/entities/game/model/aceOpponent'
import {
  EMPTY_BATTER_GAME_RECORD,
  judgeCpuPinchHit,
  recordPlateAppearance,
} from '@/entities/batting/model/pinchHitAi'
import type { BatterGameRecord } from '@/entities/batting/model/pinchHitAi'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { TEAMS } from '@/shared/config/original/teams'

/**
 * **사람이 팀을 조작하는 경기** — 원본 게임 모드 **1 일반 · 2 시즌 · 8·9 대전** 이 쓰는 경기다
 * (장면 0x104, H-1 모드표).
 *
 * 나만의리그 두 흐름과 뼈대는 같지만 **공수를 모두 사람이 맡는다**:
 *   - 우리 팀 공격 반 이닝 → 타순 아홉 칸을 사람이 **친다** (`applyBatterPitch`)
 *   - 우리 팀 수비 반 이닝 → 사람이 공을 하나씩 **던진다** (`throwPitch`)
 *   - 어느 타석을 사람이 잡고 어느 타석을 자동으로 넘길지는 **경기진행 설정**(J-3, `matchSettings`)이 정한다
 *
 * 자동으로 넘기는 타석은 원본과 같이 간이 엔진(0xc11f0·0xc262c)이 한 타석씩 돌린다.
 * 사람이 잡은 타석의 인플레이 타구만 수비 시뮬레이션(`features/defense-play`)을 거친다 —
 * 원본도 CPU 끼리의 타석에만 간이 엔진을 쓴다 (`play-game/gameFlow` 의 같은 주석).
 *
 * ⚠️ **아직 안 옮긴 것** (원본에는 있다):
 *   - 엔트리 편집(0x55864) — 타순 첫 순서는 로스터 순서 그대로다
 *   (**대타**는 사람·CPU 양쪽 다 들어왔다 — `pinchHit` 과 CPU 대타 0xac228, Q1 4절)
 *   (경기 중 **투수 교체**는 들어왔다: 자동으로 넘긴 타석에서 CPU 교체 AI(0xac428)가 양 팀 투수를
 *    바꾸고, 사람이 잡은 타석은 원본대로 `#` 메뉴가 바꾼다 — `changePitcher`·`canOpenPitcherChange`.
 *    공격 중 `#` 는 **대타**다 — `pinchHit`·`canOpenPinchHit`, R4 1a·1c)
 *   - 자동진행 **중계 화면**(경기 상태 0x21, R10 7절) — 비용·가드·자동 소화만 있다(`runAutoProgress`)
 *   - 감독 강판은 **투수편(모드 3) 전용**이라(P1 2절) 팀 경기에는 원본에도 없다
 *
 * ## 부르는 쪽에게 (시즌 세션 · 포스트시즌 · 국가대항전)
 * 지금 `app/model/useSeasonSession.playNextGame` 이 리그 시뮬레이터로 자동 진행하는 자리를
 * 이 진행기가 대신한다. 이어 붙이는 순서는 이렇다:
 * ```
 * 1. 화면을 띄운다:  pages/team-game/ui/TeamGameScreen  (또는 pages/team-game/model/useTeamGame)
 *      options = { mode: 2, ourTeamId, opponentTeamId, playerSide,
 *                  settings, season: { illness, morale, coach }, teamAbilities, lineup }
 * 2. onFinish(summary) 에서 지금 playNextGame 이 하던 일을 그대로 한다:
 *      recordLeagueResult(league, 이긴 팀, 진 팀)            ← summary.won
 *      playLeagueDay(...)                                   ← 같은 날 나머지 네 경기
 *      recordLeaguePlateAppearances(playerStats, summary.leaguePlateAppearances)
 *      evaluateSeasonGame(record, { myRuns: summary.ourScore, opponentRuns: summary.opponentScore,
 *                                   won: summary.won, opponentTeamId: summary.opponentTeamId,
 *                                   popularityCompleteGame: summary.popularityCompleteGame,
 *                                   reputationCompleteGame: summary.reputationCompleteGame })
 * 3. 돌발 보상은 경기 중에 난다 — `progress.lastBurstResolution.deltas` 를 시즌 레코드에 얹고
 *    `closeBurstWindow` 로 창을 닫는다 (종류 1 사기 · 2 인기도 · 3 평판 · 4 소지금).
 * ```
 * 포스트시즌·국가대항전도 같은 화면을 쓴다 — `mode` 는 그대로 2 이고 상대 팀만 바뀐다.
 */

/** 팀 사기 = 팀 레코드 s16 +2 = XlsTEAM_DATA 둘째 u16 (전 팀 100) */
const TEAM_MORALE_VALUE_INDEX = 1
const DEFAULT_TEAM_MORALE = 100

/** 자동 진행이 끝나지 않는 상황을 막는 안전장치 (원본에는 없다) */
const MAXIMUM_AUTO_STEPS = 2_000
const MAXIMUM_LOG_LENGTH = 40
const OUTS_PER_INNING = 3
const BATTING_ORDER_SIZE = 9
/** 정규 마지막 이닝의 0-기준 번호 (상태 +0x69, 기본 8) */
const REGULATION_LAST_INNING_INDEX = 8

export interface TeamGameOptions {
  /** 원본 게임 모드 — 1 일반 · 2 시즌 · 8·9 대전 */
  readonly mode: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 사람이 맡는 측 (0 선공 · 1 후공) — 원본 설정 레코드 +8 */
  readonly playerSide: PlayerSide
  /** 경기진행 설정 (J-3). 안 넘기면 "모든 이닝을 직접 플레이" */
  readonly settings?: MatchProgressSettings
  /** 시즌 팀 질병·사기·코치 (모드 2에서만 쓰인다) */
  readonly season?: SeasonTeamCondition
  /**
   * **시즌 팀 번호** `[시즌+1]` (0~9) — 모드 2 에서만 본다. 안 넘기면 `ourTeamId` 와 같다고 본다
   * (정규·포스트시즌은 내 팀이 곧 시즌 팀이다).
   *
   * 질병·보직·사기 세 보정은 `0xb5804` 에서 `[시즌+1] == 팀레코드+0` 으로 **선수의 팀 번호**와
   * 비교한다 (b580e `ldrsb [S+1]` · b5816 `ldrsh [팀레코드+0]` · b581a `bne`).
   * 국가대항전은 내 팀이 대한민국(10)이라 시즌 팀(0~9)과 같을 수 없어서 **아무 팀에도 안 붙는다**.
   * 그래서 국가대항전을 부르는 쪽은 `ourTeamId: 10` 과 함께 원래 시즌 팀을 여기에 넘겨야 한다.
   */
  readonly seasonTeamId?: number
  /**
   * 리그 날짜 카운터 g (`리그+0x32` = `시즌+0xb2` = 시즌 레코드의 `games`) — **모드 2 에서만** 본다.
   * 시즌모드 경기 직전 화면 `0x6548` 이 `0xb8c80` 으로 양 팀 4인 로테이션을 한 칸 돌리는 자리다
   * (R13 4절). 안 넘기면 0 = 시즌 첫 경기라 두 팀 모두 로스터 0번이 선발이다.
   * 국가대항전 중에는 같은 칸 `L+0x32` 가 **대회 날짜**다 (0xb7bf0 이 0 으로 놓는다).
   */
  readonly dayCounter?: number
  /** 팀별 능력치 네 칸. 안 넘기면 XlsTEAM_DATA 값 */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 내 팀 타순 칸별 수비 자리·보직 — 보직 불일치 −20% 입력 (시즌모드 전용) */
  readonly lineup?: readonly FieldingAssignment[]
  /** 환경설정 "투구 게이지" (설정 +0x2d) — **원본 기본값은 꺼짐** (K 5-2) */
  readonly gaugeSettingOn?: boolean
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 +0xbd). 안 넘기면 자동이다.
   * 갈림길은 `0xae690` — `(경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)` 이 거짓이면
   * 자동 진루 제어기(0xaf8c0)를 통째로 안 돌린다. 곧 **사람이 공격일 때만** 설정이 먹는다.
   */
  readonly runningModeManual?: boolean
  /**
   * 환경설정 "송구" 가 **수동**인가 (설정 +0xf4). 안 넘기면 **원본 기본값인 수동**이다.
   *
   * 갈림길은 `0xae6c8` — 직접 떴다 (`0xae690` 과 오프셋 한 글자만 다른 쌍둥이):
   * ```
   * ae6ce: r2 = [obj + 0x174]                       ; = 경기 상태
   * ae6d4: r3 = (s8)경기[0xa]                       ; ★ 수비 측 (주루 쪽은 경기[9] = 공격 측)
   * ae6de: r3 = 경기[0x31 + 수비측]
   * ae6e6: r1 = (r3 == 1)                           ; 그 팀을 CPU 가 조작하는가
   * ae6ee: 반환 = r1 || (인자 != 0)                  ; 인자 = 설정 +0xf4 (0 = 수동)
   * ```
   * 거짓이면 CPU 송구 결정 `0xafa60` 을 **아예 안 돌린다** (0x526ac, 예외 없음).
   * 곧 **사람이 수비하는 타석에서만** 이 설정이 먹는다 — 우리 공격 타석은 수비가 CPU 라
   * 앞 항이 늘 참이어서 설정과 무관하다. 그래서 이 칸은 `defensiveDefenseInputOf` 한 곳에만 간다.
   */
  readonly throwModeManual?: boolean
  /**
   * 준비 화면에서 고른 **마타자** 0~4 (준비 기록 `skin+0xbc` +0xd). 안 넘기면 없다.
   *
   * 경기 세우기 `0x30f20` 이 `0xb8870(팀, 이 값)` 으로 마타자를 **벤치 첫 칸(9번)** 에 끼워 넣고
   * 벤치 타자 수 `team+0x28c` 를 하나 올린다 (`31046` · `b8898~b88b2`). 원본에서 마타자가
   * 타석에 서는 길은 **대타(`#`)뿐**이다 — 타순 아홉 칸에는 안 들어간다.
   *
   * 원본은 같은 자리에서 **AI 팀에도** 마타자를 넣는다 — 이 값으로 `0x66994` 를 굴려 나온 번호다
   * (`3106c`). 그래서 이 칸은 상대 팀 마타자의 **입력**이기도 하다 (`rollOpponentAceIndex`).
   */
  readonly aceBatterId?: number
  /**
   * 준비 화면에서 고른 **마투수** 0~4 (준비 기록 `skin+0xbc` +0xe). 안 넘기면 없다.
   *
   * 경기 세우기 `0x30f20` 이 `0xb88c8(팀, 이 값)` 으로 마투수를 **투수 명단 8번 칸**에 넣고
   * 벤치 투수 수 `team+0x33` 을 하나 올린다 (`31042` · `b88f6~b8906`). 마타자의 9번과 **칸이 다르다**
   * — `0xb521c` 의 `0x60` 가지가 8번이다 (`teamGameRoster.PITCHER_ENTRY_ACE_SLOT` 주석).
   * 원본에서 마투수가 마운드에 서는 길은 **`#` 투수 교체(또는 CPU 교체 AI)** 뿐이다 — 선발이 아니다.
   *
   * 원본은 같은 자리에서 **AI 팀에도** 마투수를 넣는다 — 이 값으로 `0x66968` 을 굴려 나온 번호다
   * (`31058`). 그래서 이 칸은 상대 팀 마투수의 **입력**이기도 하다 (`rollOpponentAceIndex`).
   */
  readonly acePitcherId?: number
  /**
   * **마선수 레벨 열 칸** = 원본 전역 기록 `mgr[0x13a..0x143]` (`entities/mission/model/useAceLevels` 의 `levels`).
   * 명단의 마선수(사람 팀·AI 팀 모두)가 능력치 0xb6414 첫 단계에서 `0xd88aa[레벨]` 배율을 먹고,
   * 상대 마투수의 마구 횟수 0xd8509[레벨] 도 이 칸을 본다 (타석 화면이 `BattingStage.aceLevels` 로 받는다).
   * 안 넘기면 모두 Lv1(0) — 배율 60% · 마구 3 회다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /** 이 경기에 쓸 수 있는 마구 횟수. 로스터 투수는 마구가 없어 기본 0 이다 */
  readonly magicCount?: number
  /** 화면 배치 side (투영 원점 표 0xcfb18 의 칸) */
  readonly stageSide?: number
}

export interface TeamGameLogEntry {
  readonly id: number
  readonly text: string
  /** 사람이 잡은 타석인지 — 화면에서 강조한다 */
  readonly isMine: boolean
}

/** 우리 팀 투수가 이 경기에 내준 것 — 완투·노히트·퍼펙트 판정이 보는 `state+0x88·0x89·0x8a` */
export interface TeamPitchingLine {
  readonly outsRecorded: number
  readonly hitsAllowed: number
  /** 볼넷 + 사구 — 투수 +0x2a 와 같은 셈 (0xa8b58 · 0xa8bd2) */
  readonly walksAllowed: number
  readonly runsAllowed: number
  /**
   * `state+0x88` 출루 허용.
   * ⚠️ 원본은 이 칸을 **주자 목록의 마지막 원소만** 보고 세워서 야수선택이 퍼펙트를 안 깬다
   * (CORRECTIONS 2-1, S5 확정). 웹판에는 야수선택이 없어 차이가 드러나지 않으므로
   * 안타·볼넷·사구면 세우는 것으로 둔다 (**근사** — 사구는 아웃 없는 플레이라 원본도 늘 선다, 확정).
   */
  readonly allowedBaserunner: boolean
}

/**
 * 화면이 실시간으로 돌리는 한 타구 — 진행기에 넘길 것과, 그것이 끝난 뒤 어느 길로 먹일지.
 *
 * `side` 는 **사람이 어느 쪽을 잡는가** 다 — 조작 객체 `[+0xc]` (0 공격 · 1 수비).
 * 원본은 상태 0x17 갈래 `0x53420` 에서 **공격이면 주루 `0x5331c`**(진루 0x582 · 귀루 0x584 ·
 * OK → 슬라이딩 0x585), **수비면 송구 `0x533c8`**(0x588, 목표 루)로 가른다 (I 0절 표).
 * 팀 경기는 공수를 모두 사람이 맡으니 이 칸도 타석마다 갈린다 — 나만의리그 타자편처럼 고정이 아니다.
 */
export interface PendingDefensePlay {
  /** 사람이 잡은 쪽 — 우리 공격 타석이면 '공격'(주루), 사람이 던진 타석이면 '수비'(송구) */
  readonly side: ControlSide
  /** 진행기에 그대로 넘기는 한 타구 (`startDefensePlay`/`stepDefensePlay` 가 받는다) */
  readonly input: DefensePlayInput
  /** 이 타구를 낸 타석 결과 — 다 돌린 뒤 경기 상태에 먹일 때 쓴다 */
  readonly outcome: AtBatOutcome
}

const EMPTY_PITCHING_LINE: TeamPitchingLine = {
  outsRecorded: 0,
  hitsAllowed: 0,
  walksAllowed: 0,
  runsAllowed: 0,
  allowedBaserunner: false,
}

export interface TeamGameProgress {
  readonly options: TeamGameOptions
  readonly game: GameState
  /** 지금 타석의 볼 카운트 (사람이 잡은 타석에서만 찬다) */
  readonly atBat: AtBatState
  /** 상대 타순 커서 0~8 */
  readonly opponentOrderIndex: number
  /**
   * **지금 마운드에 선** 투수의 로스터 칸. 경기를 세울 때 선발을 정하고(`startingPitcherSlotsOf`
   * — 모드 1·8·9 는 무작위 0x3107a·0x31090, 모드 2 는 4인 로테이션 0xb8c80),
   * 그 뒤로는 CPU 교체 AI(0xac428)나 `#` 메뉴(R4 1b)가 이 칸을 바꾼다 (교체 실행 0xaf09c).
   */
  readonly ourPitcherIndex: number
  readonly opponentPitcherIndex: number
  /**
   * 우리 팀 **투수 명단** — 원본 `team+0x00` 의 "칸 → 투수" 목록이다 (0xb8950).
   * 0번이 선발, 1번부터가 벤치이고, 고른 마투수는 **8번 칸**에 앉는다 (`withAcePitcher`).
   */
  readonly ourPitcherEntry: readonly TeamEntryPitcher[]
  /** 상대 팀 투수 명단 — 일반·대전모드에서는 `0x66968` 이 고른 AI 마투수가 8번에 있다 */
  readonly opponentPitcherEntry: readonly TeamEntryPitcher[]
  /** 이미 마운드를 밟은 투수 칸 — 벤치에서 빠진다 (`team+0x33` 이 줄어드는 자리, 0xaec22) */
  readonly ourUsedPitchers: readonly number[]
  readonly opponentUsedPitchers: readonly number[]
  /** 지금 상대 투수의 스태미나 0~10000 (`+0x2c`). 우리 쪽은 `stamina` 가 들고 있다 */
  readonly opponentStamina: number
  /** 지금 우리·상대 투수의 실점 카운터 A·B 와 투구 수 (`team+0x27c` 묶음, P7 E1) */
  readonly ourPitcherCounters: MoundPitcherCounters
  readonly opponentPitcherCounters: MoundPitcherCounters
  /**
   * 우리 팀 **명단** — 원본 `team+0xe` 의 "칸 → 선수" 목록이다.
   * 칸 0~8 이 타순, 9 부터가 벤치다. 대타(`pinchHit`)가 두 칸을 맞바꾸고 빠진 선수를 지운다.
   */
  readonly ourEntry: readonly TeamEntryBatter[]
  /** 벤치에 남은 우리 타자 수 (`team+0x28c`) — `#` 대타 화면의 진입 조건이다 */
  readonly ourBenchBatters: number
  /**
   * 상대 팀 **명단** — 우리 것과 같은 `team+0xe` 목록이다. CPU 대타(`0xac228`)가 이 목록을 바꾼다.
   * 일반·대전모드에서는 `0x66994` 로 고른 AI 마타자가 벤치 첫 칸(9번)에 들어가 있다.
   */
  readonly opponentEntry: readonly TeamEntryBatter[]
  /** 벤치에 남은 상대 타자 수 (`team+0x28c`) */
  readonly opponentBenchBatters: number
  /**
   * 타순 칸별 이 경기 기록 (`team + 0x34 + 타순×0x18` 의 안타·적시타·타석) — `0xac228` 이 본다.
   * 명단과 길이·차례가 같다: 대타가 두 칸을 맞바꾸고 빠진 칸을 지우면 기록도 같이 움직인다
   * (원본 `0xaebe4` 도 24바이트 기록을 함께 옮긴다).
   */
  readonly ourEntryRecords: readonly BatterGameRecord[]
  readonly opponentEntryRecords: readonly BatterGameRecord[]
  /**
   * **우리 타순 칸별 루타 목록** — 원본도 같은 24바이트 기록(`team + 0x34 + 타순×0x18`) 안에
   * 루타 값 1~4 를 하나씩 밀어 넣는다 (`0xa86e0`). 사이클 판정 `0xa7610` 이 이 목록만 훑어
   * 1·2·3·4 가 다 들어 있는지 본다.
   *
   * `0xa7610` 은 **공격측이 사람일 때만** 참을 돌려주므로(`a7644`: `st[0x31+st[9]] == 0`)
   * 우리 타순만 들고 있으면 된다. 대타가 두 칸을 맞바꿀 때 기록 24바이트와 **같이 움직인다**
   * (`aed02~aed16` — `substituteBatter`).
   */
  readonly ourHitBases: readonly (readonly number[])[]
  /**
   * **시즌 평판 평가 16칸** (`SR+0x1a0..0x1af`) — 경기 중 `0xa755c(ctx, k)` → `0xa3440(SR, k)`
   * 이 한 칸씩 올리는 그 배열이다 (S4 2b·3절).
   *
   * 원본은 시즌 레코드를 직접 올리지만 웹 진행기는 시즌 세이브를 모르므로 여기에 쌓아 두고,
   * `summaryOf` 가 실어 보내면 `useSeasonSession.finishGame` 이 `evaluateSeasonGame` 앞에서
   * `record.gameRecord` 에 꽂는다. 지우는 곳은 **경기 직전 화면 한 곳뿐**이라(`0xa3424`)
   * 여기서는 경기를 세울 때 한 번만 비운다.
   */
  readonly gameRecord: readonly number[]
  /**
   * `state[0xe]` — 이 경기에 CPU 대타를 이미 썼는가. 원본은 **경기에 한 칸**이라 양 팀을 합쳐 한 번뿐이다.
   */
  readonly cpuPinchHitUsed: boolean
  /**
   * `0x66968`·`0x66994` 가 뽑은 **AI 팀 마투수·마타자 번호** 0~4 (시즌모드는 −1 — `0x30f20` 을 안 탄다).
   * 마타자는 `opponentEntry` 벤치 첫 칸(9번)에, 마투수는 `opponentPitcherEntry` 8번 칸에 들어가 있다.
   */
  readonly opponentAcePitcherIndex: number
  readonly opponentAceBatterIndex: number
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly pitcherJustChanged: boolean
  /** 이 타석의 준비(상태 0xe·0xf)를 이미 지났는가 */
  readonly atBatPrepared: boolean
  /** 우리 투수 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  readonly magicRemaining: number
  readonly pitchCount: number
  readonly lastPitch: Pitch | null
  readonly lastResolution: PitchResolution | null
  /**
   * **재생만 하면 되는** 장면 — 매 틱 스냅샷이 들어 있어 화면은 이것만 받아 그리면 된다.
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 주루·송구를 잡는
   * 인플레이 타구는 `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다**
   * — 남기면 같은 장면을 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·득점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 0절). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 `isHumanTurn` 이 거짓이 되어 다음 타석을 시작하지 않는다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(자동 소화·테스트)는 `applyBatterOutcome`·`throwPitch` 를 부르면
   * 이 칸을 거쳐 가되 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: PendingDefensePlay | null
  readonly pitching: TeamPitchingLine
  /** 우리 팀 타선이 친 안타 수 (간단 박스스코어) */
  readonly ourHits: number
  /** 리그 선수 기록표에 넘길 타석 결과 — **양 팀 전부** (원본 0xa8024 가 사람 경기도 같게 쌓는다) */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 이번 경기의 돌발미션 (경기 장면이 모드 2·3·4 에서만 만든다 — 팀 경기에서는 **시즌만**) */
  readonly burst: BurstSession | null
  readonly lastBurstResolution: BurstResolution | null
  readonly log: readonly TeamGameLogEntry[]
  readonly nextLogId: number
}

/* ── 시작 ────────────────────────────────────────────────────────────────────── */

/**
 * 이 경기의 양 팀 선발 칸 — **모드마다 원본이 다르다**.
 *
 *   - 모드 1 일반 · 8·9 대전 (`0x30f20`·`0x30be0`): 경기를 세울 때 `0xb8c94(팀, 0, bfa54(0,4))`
 *     로 **로스터 앞 4명 중 무작위** (S13 1-4b 확정). AI 팀 → 사람 팀 차례로 뽑는다.
 *   - 모드 2 시즌: 경기 직전 화면 `0x6548` 이 `0xb8c80` → `0xb5ca8` 로 **양 팀 4인 로테이션**을
 *     한 칸 돌린다 (R13 4절 · P1 1-1 과 같은 규칙). 무작위가 아니다.
 *
 * 로테이션 쪽은 붙박이 로스터를 섞을 수 없어 칸 번호로 셈한다 — `rotationSlotOf` 주석(**근사다**).
 */
function startingPitcherSlotsOf(
  options: TeamGameOptions,
  random: RandomPort,
): { readonly opponent: number; readonly ours: number } {
  if (options.mode === TEAM_GAME_MODE.시즌) {
    const slot = rotationSlotOf(options.dayCounter ?? 0)
    return { opponent: slot, ours: slot }
  }
  // 원본은 AI 팀 → 사람 팀 차례로 뽑는다 (0x31088 → 0x3109e)
  const opponent = rollStartingPitcherIndex(random)
  return { opponent, ours: rollStartingPitcherIndex(random) }
}

/**
 * 일반모드 경기 세우기 `0x30f20` 이 뽑는 **AI 팀 마선수 번호 둘**.
 *
 * ⚠️ **굴림 차례가 원본과 같아야 한다** — `0x30f20` 은 마투수(`31058`) → 마타자(`3106c`) →
 * AI 선발(`3107a`) → 사람 선발(`31090`) 차례로 넉 장을 뽑는다. 그래서 여기가
 * `startingPitcherSlotsOf` 보다 **먼저** 돌아야 한다.
 *
 * 시즌(모드 2)은 `0x30f20` 을 타지 않는다 — 마선수 고르는 화면도 없어 굴리지 않는다.
 */
function opponentAceIndexesOf(
  options: TeamGameOptions,
  random: RandomPort,
): { readonly pitcher: number; readonly batter: number } {
  if (options.mode === TEAM_GAME_MODE.시즌) return { pitcher: -1, batter: -1 }
  // 31058: 0x66968(기록+0xe) → 31064: 0xb88c8(AI팀, v)
  const pitcher = rollOpponentAceIndex(options.acePitcherId ?? NO_ACE_BATTER, random)
  // 3106c: 0x66994(기록+0xd) → 31076: 0xb8870(AI팀, w)
  const batter = rollOpponentAceIndex(options.aceBatterId ?? NO_ACE_BATTER, random)
  return { pitcher, batter }
}

export function startTeamGame(options: TeamGameOptions, random: RandomPort): TeamGameProgress {
  const opponentAces = opponentAceIndexesOf(options, random)
  const startingSlots = startingPitcherSlotsOf(options, random)
  // 0x30f20 의 순서 그대로 — 팀을 세운 뒤 고른 마타자를 벤치에 끼워 넣는다 (0xb8870)
  const ourEntry = withAceBatter(
    rosterEntryBattersOf(options.ourTeamId),
    options.aceBatterId ?? NO_ACE_BATTER,
  )
  const opponentEntry = withAceBatter(
    rosterEntryBattersOf(options.opponentTeamId),
    opponentAces.batter,
  )
  // 0x31042 · 0x31064 — 마타자와 **같은 자리에서** 마투수도 양 팀에 들어간다 (0xb88c8)
  const ourPitcherEntry = withAcePitcher(
    rosterEntryPitchersOf(options.ourTeamId),
    options.acePitcherId ?? NO_ACE_BATTER,
  )
  const opponentPitcherEntry = withAcePitcher(
    rosterEntryPitchersOf(options.opponentTeamId),
    opponentAces.pitcher,
  )
  const initial: TeamGameProgress = {
    options,
    ourEntry,
    opponentEntry,
    ourPitcherEntry,
    opponentPitcherEntry,
    ourEntryRecords: ourEntry.map(() => EMPTY_BATTER_GAME_RECORD),
    opponentEntryRecords: opponentEntry.map(() => EMPTY_BATTER_GAME_RECORD),
    ourHitBases: ourEntry.map(() => []),
    gameRecord: clearSeasonGameRecord(),
    cpuPinchHitUsed: false,
    opponentAcePitcherIndex: opponentAces.pitcher,
    opponentAceBatterIndex: opponentAces.batter,
    opponentBenchBatters: Math.max(0, opponentEntry.length - BATTING_ORDER_SIZE),
    // 원본은 팀을 세울 때 이 칸을 채우고 마타자를 넣을 때 하나 올린다 — 결과가 명단 − 타순 아홉이다
    ourBenchBatters: Math.max(0, ourEntry.length - BATTING_ORDER_SIZE),
    // 타순 칸은 "사람이 서는 자리" 가 아니다 — 팀 경기는 아홉 칸을 모두 사람이 친다
    game: createGame(-1, options.playerSide),
    atBat: createAtBat(),
    opponentOrderIndex: 0,
    opponentPitcherIndex: startingSlots.opponent,
    ourPitcherIndex: startingSlots.ours,
    ourUsedPitchers: [],
    opponentUsedPitchers: [],
    opponentStamina: FULL_STAMINA,
    ourPitcherCounters: EMPTY_MOUND_COUNTERS,
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
    pitcherJustChanged: false,
    atBatPrepared: false,
    stamina: FULL_STAMINA,
    magicRemaining: options.magicCount ?? 0,
    pitchCount: 0,
    lastPitch: null,
    lastResolution: null,
    lastDefensePlay: null,
    pendingDefensePlay: null,
    pitching: EMPTY_PITCHING_LINE,
    ourHits: 0,
    leaguePlateAppearances: [],
    burst: createBurstSession(options.mode),
    lastBurstResolution: null,
    log: [],
    nextLogId: 1,
  }
  return advance(initial, random)
}

/** 기본 측 — 일반모드는 빠른실행이 반반으로 뽑지만(0x3123c) 화면이 없으면 후공으로 둔다 */
export const DEFAULT_PLAYER_SIDE: PlayerSide = PLAYER_SIDE_LAST_BAT

/* ── 지금 누구 차례인가 ───────────────────────────────────────────────────────── */

function settingsOf(progress: TeamGameProgress): MatchProgressSettings {
  return progress.options.settings ?? FULL_PLAY_SETTINGS
}

/** 우리 팀이 공격 중인가 (측이 정한다 — 측 0 선공 = 초 · 측 1 후공 = 말) */
export function isOurOffense(progress: TeamGameProgress): boolean {
  return progress.game.half === ourHalfOf(progress.game)
}

/**
 * 지금 타석을 사람이 조작하는가 (`0xc1e04`).
 * 팀 경기에서 사람이 조작하는 팀은 우리 팀 하나뿐이라, 공격 팀·수비 팀 판정이 곧 "우리 차례인가" 다.
 */
export function isHumanTurn(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  // 수비 진행 중(원본 상태 0x17)에는 타석·투구 차례가 아니다 — 원본도 공이 멈출 때까지
  // 0xe·0xf 로 돌아가지 않아 다음 투구가 나가지 않는다
  if (progress.pendingDefensePlay !== null) return false
  const ours = isOurOffense(progress)
  return isHumanControlled(settingsOf(progress), {
    mode: progress.options.mode,
    humanControlsOffense: ours,
    humanControlsDefense: !ours,
    bases: progress.game.bases,
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: progress.game.inning - 1,
    battingOrderIndex: ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex,
  })
}

/** 사람이 **칠** 차례인가 */
export function isBatterTurn(progress: TeamGameProgress): boolean {
  return isHumanTurn(progress) && isOurOffense(progress)
}

/** 사람이 **던질** 차례인가 */
export function isPitchTurn(progress: TeamGameProgress): boolean {
  return isHumanTurn(progress) && !isOurOffense(progress)
}

/* ── 화면이 보는 능력치 ───────────────────────────────────────────────────────── */

function abilityContextOf(options: TeamGameOptions): TeamGameAbilityContext {
  return {
    mode: options.mode,
    // 내 팀 보정 셋(질병·보직·사기)은 시즌모드에서만 붙는다 (0xb581a).
    // 비교 대상은 [시즌+1] = 시즌 팀 번호다 (0xb5804) — 국가대항전의 대한민국(10)과는 안 맞는다
    seasonTeamId: options.mode === TEAM_GAME_MODE.시즌 ? seasonTeamIdOf(options) : -1,
    season: options.season,
    teamAbilities: options.teamAbilities,
    lineup: options.lineup,
    aceLevels: options.aceLevels,
  }
}

/** 시즌 팀 번호 `[시즌+1]` — 안 넘기면 내 팀이 곧 시즌 팀이다 (정규·포스트시즌) */
function seasonTeamIdOf(options: TeamGameOptions): number {
  return options.seasonTeamId ?? options.ourTeamId
}

/**
 * 스태미나 용량이 보는 **내 팀 사기** — `0x66e44(V, 투수, 첫투수)` 의 `V+2`.
 *
 * `V` 는 소모 `0xaeb08` 이 `0x1f9a9(g, 모드, 팀+0x25)` 로 얻는 **투수 팀의 팀 레코드**다.
 * 팀 번호 비교(`0xb5804`) 같은 건 없고 그냥 그 팀 레코드의 +2 를 읽는다. 모드 2 가지
 * `0x1f570` 은 국가대항전 중(`S+0x12c` ≠ 0)이면 팀 10 을 리그 배열이 아닌 **대표팀 슬롯
 * `base+0x918`** 로 돌린다 (1f58a~1f59c). 그 슬롯은 대회를 시작할 때 `0xb7bf0 → 0x205c0` 이
 * 마스터 팀 데이터(XlsTEAM_DATA)에서 새로 만들어 사기가 **원본 표값 100** 이다 (S6 2-2).
 *
 * 그래서 시즌 팀으로 치는 경기만 시즌 사기(팀 레코드 +2)를 쓰고, 국가대항전의 대한민국은
 * 표값을 쓴다. 다른 모드는 지금까지처럼 넘긴 사기(없으면 100)다.
 */
function ourTeamMoraleOf(options: TeamGameOptions): number {
  if (options.mode === TEAM_GAME_MODE.시즌 && seasonTeamIdOf(options) !== options.ourTeamId) {
    return TEAMS[options.ourTeamId]?.values[TEAM_MORALE_VALUE_INDEX] ?? DEFAULT_TEAM_MORALE
  }
  return options.season?.morale ?? DEFAULT_TEAM_MORALE
}

/**
 * 한 팀의 **명단** — 양 팀 모두 대타로 바뀔 수 있어 진행 상태가 들고 있다
 * (우리 쪽은 `#` 대타 `0xaf06c`, 상대 쪽은 CPU 대타 `0xac228`).
 */
function entryBattersOf(progress: TeamGameProgress, teamId: number): readonly TeamEntryBatter[] {
  return teamId === progress.options.ourTeamId ? progress.ourEntry : progress.opponentEntry
}

/* ── 시즌 평판 16칸 (0xa8024 → 0xa755c → 0xa3440) ─────────────────────────────── */

/**
 * 게이트 `0xa755c` 를 통과시켜 코드 몇 개를 한꺼번에 올린다.
 *
 * 원본 게이트는 (1) **모드 2(시즌)** 이고 (2) 시즌 레코드가 있고 (3) 코드 ≤ 5 면 공격측이,
 * ≥ 6 이면 수비측이 **CPU** 일 때만 적는다. (2)는 부르는 쪽(시즌 세션)이 보장하고,
 * (3)은 `recordSeasonGameEvent` 가 `mySide` 로 가른다 — 여기서는 (1)만 본다.
 */
function withSeasonRecord(
  progress: TeamGameProgress,
  mySide: MySide,
  codes: readonly number[],
): readonly number[] {
  if (progress.options.mode !== TEAM_GAME_MODE.시즌) return progress.gameRecord
  return codes.reduce(
    (slots, code) => recordSeasonGameEvent(slots, code, mySide),
    progress.gameRecord,
  )
}

/** 사이클 판정 `0xa7610` — 그 타순 칸의 루타 목록에 1·2·3·4 가 다 들어 있는가 */
function hasCycle(hitBases: readonly number[]): boolean {
  return [1, 2, 3, 4].every((bases) => hitBases.includes(bases))
}

/**
 * **우리 타석 하나**가 올리는 코드들 — `0xa8024` 의 안타 가지 차례 그대로다.
 *
 * ```
 * a8490: [sp+0x14](안타인가) == 0 이면 안타 가지를 통째로 건너뛴다
 * a8518:   k=7  안타 — **루타를 가르기 전이라 홈런·2루타·3루타도 함께 오른다**
 * a856e:   k=8  [sp+0x10] == 2
 * a85b8:   k=9  [sp+0x10] == 3
 * a85be:   [sp+0x24](이 플레이 홈런 수) > 0 이면
 * a8648~:   k=0xa/0xb/0xc/0xd — [sp+0x28](이 플레이 득점) 1/2/3/4
 * a86e0:   루타 값을 타순 칸 기록 목록에 민다
 * a878a:   k=0xe 사이클 — 플레이 **전** 판정 [sp+0x1c] 이 거짓인데 지금 참이면
 * a8a46:  k=6  삼진 (수비가 CPU 인 쪽 — 내 타자가 당한 삼진)
 * ```
 */
function offenseRecordOf(
  outcome: AtBatOutcome,
  runsBattedIn: number,
  hitBasesBefore: readonly number[],
): { readonly codes: readonly number[]; readonly hitBases: readonly number[] } {
  const codes: number[] = []
  let hitBases = hitBasesBefore
  if (isHit(outcome)) {
    const bases: number = outcome.kind === '안타' ? outcome.bases : 4
    const cycleBefore = hasCycle(hitBases)
    hitBases = [...hitBases, bases]
    codes.push(SEASON_RECORD_CODE.안타)
    if (bases === 2) codes.push(SEASON_RECORD_CODE.이루타)
    if (bases === 3) codes.push(SEASON_RECORD_CODE.삼루타)
    // 홈런 네 칸은 **타점**이 가른다 — 원본도 득점이 1~4 가 아니면 아무 칸도 안 올린다
    if (outcome.kind === '홈런' && runsBattedIn >= 1 && runsBattedIn <= 4) {
      codes.push(SEASON_RECORD_CODE.솔로홈런 + runsBattedIn - 1)
    }
    if (!cycleBefore && hasCycle(hitBases)) codes.push(SEASON_RECORD_CODE.사이클)
  }
  if (outcome.kind === '삼진') codes.push(SEASON_RECORD_CODE.내타자삼진)
  return { codes, hitBases }
}

/**
 * **내가 던진 타석 하나**가 올리는 코드들 — `0xa8024` 의 공통 꼬리다.
 *
 * ```
 * a8a40: k=4  [sp+0x20](삼진 수) > 0 이고 **수비가 사람**이면 4 (아니면 6)
 *             ⚠️ 값 인자가 없어 삼진이 둘이어도 +1 이다
 * a8d6e: k=2  [sp+0x14](안타) — 피안타
 * a8e76: k=5  [sp+0x30](이 플레이 아웃 수) == 2 이고 state[0x1a] 가 0 일 때 — 병살
 * a8e8a: k=0  [sp+0x30] == 3 — 삼중살 (state[0x1a] 가 막지 않는다)
 * ```
 * ⚠️ `state[0x1a]` 는 "삼진 뒤 주자가 움직여 두 번째 아웃이 난 플레이" 표시다 (P7 F절).
 * 웹에는 그 플레이(삼진 + 주자 아웃)가 없어 아웃 둘이 나는 타석은 늘 병살이다.
 */
function defenseRecordCodesOf(outcome: AtBatOutcome, outsAdded: number): readonly number[] {
  const codes: number[] = []
  if (outcome.kind === '삼진') codes.push(SEASON_RECORD_CODE.탈삼진)
  if (isHit(outcome)) codes.push(SEASON_RECORD_CODE.피안타)
  if (outsAdded === 2) codes.push(SEASON_RECORD_CODE.병살)
  else if (outsAdded === 3) codes.push(SEASON_RECORD_CODE.삼중살)
  return codes
}

/** 우리 타순 칸 하나의 루타 목록에 이번 루타를 얹는다 (`0xa86e0`) */
function withHitBases(
  lists: readonly (readonly number[])[],
  slot: number,
  hitBases: readonly number[],
): readonly (readonly number[])[] {
  const next = [...lists]
  next[slot] = hitBases
  return next
}

/**
 * 타순 칸 기록에 플레이 하나를 얹는다 (`0xa8024`).
 *
 * `outcome` 이 null 이면 **타석 결과 없이 끝난 판**(견제 = 플레이 종류 4)이다 — 원본도 견제 판 끝
 * `0xae3e8` 이 `0xa8024` 를 부르지만(`0xae57e~0xae5b2`) `state[0x26] = 4` 라 타석 칸(+0x14)이 안 오르고,
 * 안타·적시타 칸은 안타 가지(`0xa86e0`) 안이라 애초에 안 선다. 게이트는 `recordPlateAppearance` 의 `playKind` 다.
 */
function withPlateAppearance(
  records: readonly BatterGameRecord[],
  slot: number,
  outcome: AtBatOutcome | null,
  runsBattedIn: number,
): readonly BatterGameRecord[] {
  const next = [...records]
  next[slot] = recordPlateAppearance(next[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: outcome !== null && isHit(outcome),
    runsBattedIn,
    ...(outcome === null ? { playKind: PICKOFF_PLAY_KIND } : {}),
  })
  return next
}

/**
 * 리그 선수 기록표에 타석 하나를 쌓는다 — **지금 그 타순 칸에 선 선수의 로스터 칸**으로.
 *
 * 원본 기록 함수 `0xa8024` 는 명단 칸(`team+0xe`)이 가리키는 선수 레코드에 쌓는다. 명단 칸은 대타
 * 확정 `0xaebe4` 가 맞바꾸고 지우므로(`aed02~aed16`) 대타가 들어온 뒤에는 타순 칸 번호와 로스터 칸이
 * 갈린다 — 타순 칸 번호로 쌓으면 기록이 빠진 선수나 엉뚱한 선수에게 붙는다 (`entities/game` 의
 * `quickLineup` 이 간이 엔진 경기에서 같은 자리를 고친 785796d 와 같은 이치다).
 *
 * 마타자(`NO_ROSTER_SLOT`)는 리그 로스터 선수가 아니라 표에 칸이 없다 — 원본도 저장에서 꺼낸 마타자
 * 레코드(`0x1f84c`)에 쌓으므로 리그 로스터 선수 기록은 오르지 않는다. 그래서 빼고 넘긴다.
 * (마타자는 일반·대전모드에만 들어오고 리그 기록표를 쓰는 시즌모드에는 없다.)
 */
function withLeaguePlateAppearance(
  appearances: readonly LeaguePlateAppearance[],
  teamId: number,
  entry: readonly TeamEntryBatter[],
  slot: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): readonly LeaguePlateAppearance[] {
  const rosterSlot = entry[slot]?.rosterSlot ?? slot
  if (rosterSlot === NO_ROSTER_SLOT) return appearances
  return [...appearances, { teamId, battingOrderIndex: rosterSlot, outcome, runsBattedIn }]
}

/** 지금 타석에 선 우리 타자 (명단 칸 = 타순 칸) */
export function currentBatterEntry(progress: TeamGameProgress): TeamEntryBatter | undefined {
  return progress.ourEntry[progress.game.battingOrderIndex]
}

/** 명단 한 칸의 경기용 능력치 네 칸 — 없는 칸이면 0 이다 */
function entryAbilitiesAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): readonly number[] {
  const entry = entryBattersOf(progress, teamId)[slot]
  if (entry === undefined) return [0, 0, 0, 0]
  return entryBatterGameAbilities(abilityContextOf(progress.options), teamId, entry, slot)
}

/** 타석 화면이 보는 능력치 (0~999 그대로) */
function entryStageAbilityOf(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): BatterAbility {
  const ability = entryAbilitiesAt(progress, teamId, slot)
  return { hit: ability[0], power: ability[1], defense: ability[2], run: ability[3] }
}

/** 간이 타석 엔진이 보는 타자 — 히트·파워·주루만 쓴다 */
function entryQuickBatterOf(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): QuickAtBatBatter {
  const ability = entryAbilitiesAt(progress, teamId, slot)
  return { hit: ability[0], power: ability[1], run: ability[3], skillIds: [] }
}

/** 간이 타석 엔진이 보는 투수 — 제구·구속·체력만 쓴다 */
function entryQuickPitcherOf(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): QuickAtBatPitcher {
  const ability = pitcherAbilitiesAt(progress, teamId, slot)
  return { control: ability[0], velocity: ability[1], stamina: ability[3], skillIds: [] }
}

/** 지금 타석에 선 우리 타자의 경기용 능력치 */
export function currentBatterAbility(progress: TeamGameProgress) {
  return entryStageAbilityOf(progress, progress.options.ourTeamId, progress.game.battingOrderIndex)
}

/**
 * 한 팀의 **투수 명단** — 타자 명단과 짝을 이루는 원본 `team+0x00` 목록이다 (0xb8950).
 * 0번이 선발, 1번부터가 벤치이고, 마투수가 있으면 8번에 앉아 있다 (`PITCHER_ENTRY_ACE_SLOT`).
 */
function pitcherEntriesOf(progress: TeamGameProgress, teamId: number): readonly TeamEntryPitcher[] {
  return teamId === progress.options.ourTeamId
    ? progress.ourPitcherEntry
    : progress.opponentPitcherEntry
}

/** 투수 명단 한 칸 — 없는 칸이면 0번(선발)으로 떨어진다 */
function pitcherEntryAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): TeamEntryPitcher | undefined {
  const entry = pitcherEntriesOf(progress, teamId)
  return entry[slot] ?? entry[0]
}

/** 투수 명단 한 칸의 경기용 능력치 네 칸 (제구·구속·변화·체력) */
function pitcherAbilitiesAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): readonly number[] {
  const entry = pitcherEntryAt(progress, teamId, slot)
  if (entry === undefined) return [0, 0, 0, 0]
  return entryPitcherGameAbilities(abilityContextOf(progress.options), teamId, entry)
}

/** 투수 명단 한 칸의 구질 표 (폼·마구·보유 구질) */
function pitcherRepertoireAt(
  progress: TeamGameProgress,
  teamId: number,
  slot: number,
): PitcherRepertoire {
  return (
    pitcherEntryAt(progress, teamId, slot)?.repertoire ?? {
      name: '',
      form: 0,
      magicId: 0,
      pitchMask: 1,
    }
  )
}

/** 원본 0~999 를 타석 화면의 0~100 눈금으로 (다른 화면들이 쓰는 것과 같은 나눗셈) */
const STAGE_PITCHER_DIVISOR = 10

/** 지금 우리 타자를 상대하는 투수의 경기용 능력치 (0~100 눈금) */
export function currentPitcherAbility(progress: TeamGameProgress): PitcherAbility {
  const teamId = progress.options.opponentTeamId
  const slot = progress.opponentPitcherIndex
  const ability = pitcherAbilitiesAt(progress, teamId, slot)
  const repertoire = pitcherRepertoireAt(progress, teamId, slot)
  return {
    control: Math.round(ability[0] / STAGE_PITCHER_DIVISOR),
    velocity: Math.round(ability[1] / STAGE_PITCHER_DIVISOR),
    breaking: Math.round(ability[2] / STAGE_PITCHER_DIVISOR),
    repertoire: {
      form: repertoire.form,
      pitchMask: repertoire.pitchMask,
      magicId: repertoire.magicId,
    },
  }
}

/** 지금 마운드에 선 상대 투수가 마투수면 `ACE_PITCHERS` 칸 0~4, 아니면 −1 */
export function currentPitcherAceIndex(progress: TeamGameProgress): number {
  return (
    pitcherEntryAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)
      ?.aceIndex ?? NO_ACE_BATTER
  )
}

/** 우리 선발 투수의 경기용 능력치 (제구·구속·변화·체력) */
export function ourPitcherStats(progress: TeamGameProgress): PitcherStats {
  const ability = pitcherAbilitiesAt(progress, progress.options.ourTeamId, progress.ourPitcherIndex)
  return { control: ability[0], velocity: ability[1], breaking: ability[2], stamina: ability[3] }
}

/**
 * **교체 화면 상세 창의 능력치 네 칸** — 원본은 교체 목록이 아니라 '0' 키로 여는 **상세 창**에서만
 * 능력치를 적는다. 그 값은 **`0xb6414(레코드, 칸, 1)`** 이고 경기용 `0xb570c` 를 거치지 않는다 (직접 떴다):
 * ```
 * 0x384b8 그리기 → 0x37e5c 벤치 목록 끝 (0x38420~0x38468):
 *   투수 교체면 rec = 0xb8b09(scene[0x224], 커서), 종류 3 · 대타면 rec = 0xb8b19(scene[0x220], 커서), 종류 2
 *   0x5b798(skin, 종류, rec)              ; skin+0x424('0' 키 상세 창)가 꺼져 있으면 바로 빠진다 (5b7a8)
 * 0x5b798 → 0x5aefc(…, [sp]=종류, [sp+4]=rec, …, [sp+0x18]=0)   ; 5b86a(종류 2) · 5bfbe(종류 3)
 * 0x5aefc 종류 2 (5b1aa) · 종류 3 (5b294): 칸 0..3 마다
 *   ctx([sp+0x198]) ≠ 0 이면 0xb570c(ctx, 칸, rec, 0x5a, 1) — **교체 창은 늘 0 을 넘긴다**
 *   그 밖 0xb6414(rec, 칸, 1) → 막대 값 · 0xb6414(rec, 칸, 0) → 기본 값
 * ```
 * 곧 마선수 레벨 배율(0xd88aa) → 장비(+0x19 니블) → 장착 스킬 보정까지이고, 시즌 질병·보직·사기·
 * 팀 능력치·코치(0xb570c 쪽)는 **안 먹는다**. 웹 팀 경기 명단에는 장비 니블도 스킬 비트(+0x14)도 없어
 * (`TeamEntryBatter` · `TeamEntryPitcher`) 남는 것은 **레벨 배율 하나**다 — 마선수가 아니면 명단 값 그대로.
 *
 * 목록 줄(`0x37904` 현재 선수 · `0x37e5c` 벤치)에는 능력치가 없다: 이름 · 보직/수비 아이콘 ·
 * 방어율(0xb6ce9)/타율(0xb8e3d) · 탈삼진(+0x26)/홈런(+0x28) 넷이고 두 함수 모두 0xb570c·0xb6414 를 안 부른다 (R4 1b).
 *
 * @param kind '투수' 면 우리 투수 명단 칸, '대타' 면 우리 타자 명단 칸
 * @returns 제구·구속·변화·체력 / 히트·파워·수비·주루. 칸이 없으면 null
 */
export function substitutionDetailAbilities(
  progress: TeamGameProgress,
  kind: '투수' | '대타',
  index: number,
): readonly [number, number, number, number] | null {
  const player = kind === '투수' ? progress.ourPitcherEntry[index] : progress.ourEntry[index]
  if (player === undefined) return null
  return aceLeveledAbility(player.ability, kind === '투수' ? '투수' : '타자', player.aceIndex, progress.options.aceLevels)
}

/**
 * 한 팀의 수비 아홉 칸 능력치 — 타순에 선 선수의 **경기용** 수비(질병·보직·사기·팀 능력치·코치까지
 * 먹인 값, J-4)를 로스터의 수비 자리 코드로 칸에 꽂는다.
 * 칸 0(투수)은 지금 마운드에 선 투수의 능력치 칸 2 다 (⚠️ 원본 그대로 — `defenseAbilitiesOf` 주석).
 */
function defenseAbilitiesFor(
  progress: TeamGameProgress,
  teamId: number,
  pitcherIndex: number,
): readonly number[] {
  const context = abilityContextOf(progress.options)
  return defenseAbilitiesOf(
    entryBattersOf(progress, teamId).map((player, slot) => ({
      position: player.position,
      defense: entryBatterGameAbilities(context, teamId, player, slot)[2],
    })),
    pitcherAbilitiesAt(progress, teamId, pitcherIndex)[2],
  )
}

/** 타순 한 칸의 경기용 주루 능력치 (칸 3) — 진행기의 주자 속도가 된다 */
function runAbilityFor(progress: TeamGameProgress, teamId: number, battingOrderIndex: number): number {
  return entryAbilitiesAt(progress, teamId, battingOrderIndex)[3]
}

/** 고를 수 있는 구질 칸 여섯 (0xb6d2c) */
export function pitchSlotsFor(progress: TeamGameProgress): readonly PitchSlot[] {
  const repertoire = pitcherRepertoireAt(
    progress,
    progress.options.ourTeamId,
    progress.ourPitcherIndex,
  )
  return pitchSlotsOf({
    pitchMask: repertoire.pitchMask,
    form: repertoire.form,
    magicNumber: repertoire.magicId,
  })
}

/* ── 사람이 치는 타석 ─────────────────────────────────────────────────────────── */

/**
 * 사람 타석의 **공 하나**를 반영한다. 타석이 끝나면 그 자리에서 주자·점수까지 처리한다.
 * 화면은 `BattingStage` 가 준 `PitchOutcomeDetail` 을 그대로 넘기면 된다.
 *
 * ⚠️ 수비 화면을 띄우는 화면은 `startBatterPitch` 를 쓴다 — 이쪽은 타구까지 미리 다 돌려 버린다.
 */
export function applyBatterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  return batterPitch(progress, detail, random, options, applyBatterOutcome)
}

/**
 * 같은 공 하나지만, 타석이 인플레이 타구로 끝나면 **주자 처리를 수비 화면 뒤로 미룬다**
 * (`pendingDefensePlay` 에 얹고 멈춘다). 화면이 다 돌면 `resolveDefensePlay` 를 부르면 된다.
 */
export function startBatterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  return batterPitch(progress, detail, random, options, startBatterOutcome)
}

function batterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions,
  applyOutcome: (
    progress: TeamGameProgress,
    outcome: AtBatOutcome,
    random: RandomPort,
    options: BatterOutcomeOptions,
  ) => TeamGameProgress,
): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  progress = throwOpponentPitch(progress, detail.pitchTypeNumber)
  const atBat = applyPitchResolution(progress.atBat, detail.resolution)
  const outcome = atBat.outcome
  if (outcome === null) return { ...progress, atBat }
  return applyOutcome({ ...progress, atBat }, outcome, random, options)
}

/**
 * 사람 타석에서 **상대 CPU 투수가 공 하나를 던졌다** — 공이 손을 떠날 때(상태 0x11 진입 0x3de10 의 0x3dec6)
 * `0xa5e14(ctx, game+0xfc8 = 구질)` 이 수비 팀 투수를 깎는다 (P1 3-1, 4099ec6 과 같은 자리):
 *   투구 수 +1 (`team+0x27c` 묶음) · state[0xd] = 0 (`pitcherJustChanged`) · 스태미나 −c·용량 (0xaeb08)
 *   c = 0x66ef0(구질), 타자 스킬 22 압도 또는 투수 스킬 18 이면 ×2, 투수 스킬 10 이면 −1.
 * 용량 X 는 간이 타석 쪽(`drainQuickPitcher`)과 같은 입력이다 — 상대 팀 사기 100 · 첫 투수 보너스(0x66e44).
 *
 * ⚠️ 미해결: 타자 스킬 22 압도 — 팀 경기 명단(`TeamEntryBatter`)에 스킬 비트(+0x14)가 없어 늘 거짓이다.
 *    상대 CPU 투수 스킬 18·10 도 같은 까닭으로 늘 거짓.
 * 구질이 없으면(`PitchOutcomeDetail.pitchTypeNumber` 를 안 실은 호출) 깎지 않는다. 난수는 쓰지 않는다.
 */
function throwOpponentPitch(progress: TeamGameProgress, pitchTypeNumber: number | undefined): TeamGameProgress {
  if (pitchTypeNumber === undefined) return progress
  return {
    ...progress,
    opponentStamina: drainStamina({
      stamina: progress.opponentStamina,
      typeNumber: pitchTypeNumber,
      staminaAbility: opponentPitcherStaminaAbility(progress),
      teamMorale: 100,
      isFirstPitcher: progress.opponentUsedPitchers.length === 0,
      batterIntimidates: false,
      pitcherIsCoward: false,
      pitcherEndures: false,
    }),
    opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, 0, 1, false),
    pitcherJustChanged: false,
  }
}

export interface BatterOutcomeOptions {
  readonly pattern?: BattedBallPattern
  readonly isUncatchable?: boolean
  /**
   * **2스트라이크 번트 파울 아웃**(원본 판정 11)인가 — 아웃 콜을 조건 없이 62 로 내기 위한 표다.
   * `resolvePitch` 의 `PitchOutcomeDetail.isBuntFoulOut` 이 그대로 들어온다.
   * 진행(아웃·진루·난수)에는 한 톨도 안 닿는다 — 소리 고르기만 본다.
   */
  readonly buntFoulOut?: boolean
}

/**
 * 사람 타석 하나의 **결과**를 반영하고 다음 사람 차례까지 민다.
 * 인플레이 타구는 수비 시뮬레이션을 돌려 아웃·득점·루 상황을 그 결과로 갈아 끼운다.
 *
 * ⚠️ 사람이 주루를 조작하는 화면은 이것을 쓰지 않는다 — `startBatterOutcome` 으로 타석 결과만
 * 먼저 정하고, 화면이 틱을 다 돌린 뒤 `resolveDefensePlay` 로 주자 처리를 먹인다.
 * 여기는 그 둘을 한 줄로 이어 붙인 **얇은 껍데기**다 (자동 소화·테스트처럼 끼어들 사람이 없는 자리용).
 */
export function applyBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  const started = startBatterOutcome(progress, outcome, random, options)
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  // 미리 다 돌려 버린다 — `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기라 난수 차례가 같다.
  // 이 갈래는 아직 아무것도 안 보여 줬으므로 돌린 결과를 그대로 재생거리로 넘긴다 (예전 그대로).
  const result = runDefensePlay(pending.input)
  return finishBatterOutcome({ ...started, pendingDefensePlay: null }, outcome, random, result, result)
}

/**
 * 사람 타석의 결과 코드만 먼저 정한다 — **인플레이 타구면 주자 처리를 뒤로 미룬다.**
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 `isHumanTurn` 이 거짓이라
 * 다음 투구가 나가지 않는 것이 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 0xf 로 안 돌아간다).
 *
 * 우리 공격 타석이므로 사람이 잡는 쪽은 **공격(주루 0x5331c)** 이다 (I 0절 상태 0x17 표).
 * 삼진·볼넷·사구·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다. 사구는 그 앞에서 벤치 클리어링을 굴린다.
 */
export function startBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 밀어내기 주루·정산보다 앞이다
  progress = withBatterBenchClearing(progress, outcome, random)
  if (!isBattedBallInPlay(outcome)) {
    // 홈런도 공이 날아가는 그림은 나와야 한다 — 진루·득점은 그대로 두고 **보여 줄 틱만** 만든다
    const playback = homeRunPlaybackOf({ outcome, bases: progress.game.bases, pattern: options.pattern })
    return finishBatterOutcome(progress, outcome, random, null, playback)
  }
  return {
    ...progress,
    pendingDefensePlay: {
      side: '공격',
      input: batterDefenseInputOf(progress, outcome, random, options),
      outcome,
    },
  }
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 우리 타석이라 수비(상대)는 CPU 다.
 * 들어가면 상대 투수 투구 수(`+0x27c`) +10 (0x3ab82). 시즌 평판 S[1](코드 1, 0x3ab92)도 부르지만 코드 ≤ 5 는
 * 공격측이 CPU 일 때만 적히므로 우리 공격에서는 게이트에서 버려진다 (`withSeasonRecord` 가 그대로 가른다).
 * 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * ⚠️ 연출 화면(양 팀이 마운드로 몰려나오는 100틱, 배경음 44)과 그 연출이 쓰는 난수는 없다.
 * 우리가 던진 공에 CPU 타자가 맞는 쪽(코드 1 이 S[1] 에 남고 우리 투수 스태미나 −1000)은 `withPitcherBenchClearing`.
 */
function withBatterBenchClearing(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): TeamGameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(false)
  return appendLog(
    {
      ...progress,
      opponentPitcherCounters: addRunsToCounters(
        progress.opponentPitcherCounters,
        0,
        effect.defensePitchCountGain,
        false,
      ),
      gameRecord: withSeasonRecord(progress, '공격', [effect.seasonRecordCode]),
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}

/**
 * 우리 공격 타석의 타구 하나 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다).
 */
function batterDefenseInputOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions,
): DefensePlayInput {
  const before = progress.game
  return {
    outcome,
    trajectory: battedBallTrajectory(options.pattern ?? representativePatternOf(outcome)),
    bases: before.bases,
    outs: before.outs,
    // 우리 공격이니 수비는 상대 팀이다
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.ourTeamId, before.battingOrderIndex),
    // 난수를 넘겨야 펌블·악송구·필살수비·레이저 굴림이 돈다
    random,
    gameMode: progress.options.mode,
    // 상대 수비는 CPU 다 → 협살(AI 상태 8)이 돈다
    defenseIsCpu: true,
    // 우리가 공격이다 — 여기서만 환경설정 "주루" 가 먹는다 (0xae690 의 둘째 항)
    offenseIsCpu: false,
    runningMode: progress.options.runningModeManual === true ? '수동' : '자동',
    // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
    isUncatchable: options.isUncatchable,
    // 판정 11(2스트라이크 번트 파울 아웃)이면 아웃 콜이 조건 없이 62 다 — 진행기는 안 본다
    buntFoulOut: options.buntFoulOut,
  }
}

/**
 * 사람 타석 하나를 경기 상태에 먹이고 다음 사람 차례까지 민다 — 예전 `applyBatterOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * **실시간으로 이미 다 보여 준 플레이는 null** 이고, 홈런은 부르는 쪽이 비행 틱을 만들어 넘긴다.
 */
function finishBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
): TeamGameProgress {
  const before = progress.game

  const game = applyAtBatOutcome(before, outcome, defensePlay?.advance)
  const runsBattedIn = game.ourScore - before.ourScore
  // 아웃 수는 반 이닝이 넘어가면 0 으로 되돌아가므로 진행 결과에서 직접 읽는다 (`gameFlow` 와 같은 길)
  const outsAdded =
    defensePlay?.advance.outsAdded ?? advanceRunners(before.bases, outcome, before.outs).outsAdded
  const slot = before.battingOrderIndex
  const inningEnded = before.outs + outsAdded >= OUTS_PER_INNING
  const isWalkOff = game.isFinished && runsBattedIn > 0 && game.ourScore > game.opponentScore
  // 시즌 평판 16칸 — 우리 공격이라 **수비측(상대)이 CPU** 인 코드(≥ 6)만 선다
  const offense = offenseRecordOf(outcome, runsBattedIn, progress.ourHitBases[slot] ?? [])

  const next: TeamGameProgress = {
    ...progress,
    game,
    gameRecord: withSeasonRecord(progress, '공격', offense.codes),
    ourHitBases: withHitBases(progress.ourHitBases, slot, offense.hitBases),
    lastDefensePlay: playback,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 우리 타석의 득점은 **상대 투수**의 A·B 로 들어간다 (0xa5c34 는 수비 팀 칸을 올린다)
    opponentPitcherCounters: addRunsToCounters(
      progress.opponentPitcherCounters,
      runsBattedIn,
      0,
      game.inning !== before.inning || game.half !== before.half,
    ),
    ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
    ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, outcome, runsBattedIn),
    leaguePlateAppearances: withLeaguePlateAppearance(
      progress.leaguePlateAppearances,
      progress.options.ourTeamId,
      progress.ourEntry,
      slot,
      outcome,
      runsBattedIn,
    ),
  }

  const resolved = resolveBurstFor(next, {
    outcome,
    runsBattedIn,
    outsBefore: before.outs,
    outsAdded,
    inningEnded,
    humanTeamWalkOff: isWalkOff,
  })

  return advance(
    appendLog(
      resolved,
      `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
        runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
      }`,
      true,
    ),
    random,
  )
}

/* ── 사람이 던지는 타석 ───────────────────────────────────────────────────────── */

export interface TeamPitchInput {
  /** 원본 구질 번호 1~21, 마구는 22 */
  readonly typeNumber: number
  /** 코스 칸 0~8 */
  readonly courseCell: number
  /** 게이지에서 누른 칸 0~9. 안 눌렀으면 0 */
  readonly gaugeCell: number
}

/**
 * 공 하나를 던진다 (상태 0x10 확정 → 0x11 → 0x12/0x13).
 * 투수편 `pitcherGameFlow.throwPitch` 와 같은 순서다 — 상대 타자는 CPU 가 반응한다.
 *
 * ⚠️ 수비 화면을 띄우는 화면은 `startThrowPitch` 를 쓴다 — 이쪽은 타구까지 미리 다 돌려 버린다.
 */
export function throwPitch(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
): TeamGameProgress {
  return pitchOnce(progress, input, random, false)
}

/**
 * 같은 공 하나지만, 인플레이 타구가 나오면 **송구를 사람이 잡도록 거기서 멈춘다**
 * (`pendingDefensePlay` 에 얹는다). 화면이 다 돌면 `resolveDefensePlay` 를 부르면 된다.
 */
export function startThrowPitch(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
): TeamGameProgress {
  return pitchOnce(progress, input, random, true)
}

/** `defer` 가 참이면 인플레이 타구에서 멈춘다 — 그 밖은 예전처럼 타구까지 한 번에 돌린다 */
function pitchOnce(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
  defer: boolean,
): TeamGameProgress {
  if (!isPitchTurn(progress)) return progress
  const { options } = progress
  const isMagic = input.typeNumber === MAGIC_PITCH_TYPE_NUMBER
  if (isMagic && progress.magicRemaining <= 0) return progress

  const stats = ourPitcherStats(progress)
  const fatigued = fatiguedStatsOf(stats, progress.stamina)
  const staminaPercent = staminaPercentOf(progress.stamina)
  const repertoire = pitcherRepertoireAt(progress, options.ourTeamId, progress.ourPitcherIndex)
  const grade = pitchGradeOf(
    {
      gaugeSettingOn: options.gaugeSettingOn === true,
      typeNumber: input.typeNumber,
      gaugeCell: input.gaugeCell,
      effectiveControl: fatigued.control,
      staminaPercent,
    },
    random,
  )
  const pitch = buildHumanPitch(
    {
      typeNumber: input.typeNumber,
      courseCell: input.courseCell,
      grade,
      gaugeCell: input.gaugeCell,
      stats: fatigued,
      repertoire: {
        pitchMask: repertoire.pitchMask,
        form: repertoire.form,
        magicNumber: repertoire.magicId,
      },
      side: options.stageSide ?? 1,
    },
    random,
  )

  // 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
  // 등급 뽑기·제구 흩어짐 굴림 뒤, CPU 타자 결정 0x34334 앞이다. 마구가 아니면 rand(0,100) 한 번.
  const isMistake = isMistakePitch(
    {
      isMagicPitch: isMagic,
      grade,
      // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속, 체력 인자 90 이라 피로 감소가 없다.
      // `ourPitcherStats` 가 곧 그 경기용 값(질병·사기·팀 능력치·코치, 피로 전)이다
      effectiveVelocity: stats.velocity,
      runnerCount: runnerCountOf(progress.game.bases),
      hasSecondBaseRunner: progress.game.bases.second,
      // 웹 로스터·마선수 표에 스킬 비트(+0x14)가 없어 타자 22 · 투수 16·17·22 를 늘 거짓으로 둔다
      batterIntimidates: false,
      pitcherIsSteady: false,
      pitcherIsTimid: false,
      pitcherIsCool: false,
    },
    random,
  )

  const batter = entryStageAbilityOf(progress, options.opponentTeamId, progress.opponentOrderIndex)
  const resolution = pitchAgainstBatter(
    pitch,
    batter,
    random,
    {
      control: fatigued.control,
      velocity: fatigued.velocity,
    },
    // 원본 0x34334 는 state+4·+5·+6(S·B·O)과 주자 유무로 타격 표(0x9f190)의 행을 고른다
    {
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
      outs: progress.game.outs,
      hasRunner: runnerCountOf(progress.game.bases) > 0,
    },
    {
      isMistakePitch: isMistake,
      // 0xb633d(타자) — 레코드 +0xa 비트 6. 명단에 끼운 마타자(`withAceBatter`)만 참이다
      isMagicBatter:
        (entryBattersOf(progress, options.opponentTeamId)[progress.opponentOrderIndex]?.aceIndex ??
          NO_ACE_BATTER) >= 0,
    },
  )

  // 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  const stamina = drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: stats.stamina,
    teamMorale: ourTeamMoraleOf(options),
    // 경기 중 교체를 아직 안 옮겨서 선발이 곧 "첫 투수" 다
    isFirstPitcher: true,
    // 상대 타자의 스킬 22(0xb62b4)를 웹 로스터가 들고 있지 않아 늘 거짓이다
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  })

  const afterPitch: TeamGameProgress = {
    ...progress,
    stamina,
    // ⚠️ 마구 횟수는 **코스 확정(OK)** 때 줄어든다 — 구질을 고른 순간이 아니다 (0x50e9c)
    magicRemaining: isMagic ? progress.magicRemaining - 1 : progress.magicRemaining,
    pitchCount: progress.pitchCount + 1,
    // 투구마다 state[0xd] 가 내려간다 (0xa5e72) — 그 뒤라야 다시 교체를 볼 수 있다
    pitcherJustChanged: false,
    ourPitcherCounters: {
      ...progress.ourPitcherCounters,
      pitches: progress.ourPitcherCounters.pitches + 1,
    },
    lastPitch: pitch,
    lastResolution: resolution,
    atBat: applyPitchResolution(progress.atBat, resolution),
  }

  const outcome = afterPitch.atBat.outcome
  if (outcome === null) return afterPitch

  // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 밀어내기 주루(0x17)·정산 0xa8024 보다 앞이다
  const cleared = withPitcherBenchClearing(afterPitch, outcome, random)
  const started = startDefensiveAtBat(cleared, outcome, true, random)
  const pending = started.pendingDefensePlay
  // 수비 진행 중 — 화면이 틱을 돌리는 동안 경기를 붙들어 둔다 (원본 상태 0x17)
  if (pending === null) return advance(started, random)
  if (defer) return started
  // 미리 다 돌려 버리는 갈래 — 난수를 쓰는 자리가 예전 `runDefensePlay` 호출과 똑같다
  const result = runDefensePlay(pending.input)
  return advance(
    finishDefensiveAtBat({ ...started, pendingDefensePlay: null }, outcome, true, result, result),
    random,
  )
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 우리가 던진 공이라 수비는 사람이다.
 * 들어가면 0x3ab7c `0xaeab0(수비 팀, 1000)` — 지금 마운드의 우리 투수 스태미나(+0x2c) −1000, [0, 10000] 로 자른다.
 * 시즌 평판 S[1](코드 1, 0x3ab92)은 코드 ≤ 5 라 공격측(상대)이 CPU 인 지금 남는다 — `withSeasonRecord` 가
 * 시즌 팀 경기(모드 2)일 때만 적는다. 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * ⚠️ 연출 화면(양 팀이 마운드로 몰려나오는 100틱, 배경음 44)과 그 연출이 쓰는 난수는 없다.
 */
function withPitcherBenchClearing(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): TeamGameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(true)
  return appendLog(
    {
      ...progress,
      stamina: staminaAfterBenchClearing(progress.stamina, effect.defenseStaminaLoss),
      gameRecord: withSeasonRecord(progress, '수비', [effect.seasonRecordCode]),
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}

/**
 * 상대 타석 하나의 결과 코드만 먼저 정한다. `mine` 이 참이면 사람이 던진 타석이라
 * 인플레이 타구를 `pendingDefensePlay` 에 얹고 **경기 상태는 한 톨도 안 건드린 채** 멈춘다.
 *
 * 사람이 잡는 쪽은 **수비(송구 0x533c8)** 다 — 원본 상태 0x17 갈래가 공/수로 가르는 그 자리다
 * (I 0절 표: 공격이면 0x5331c 주루, 수비면 0x533c8 송구).
 *
 * 자동으로 넘긴 타석(`mine` 거짓)은 수비 시뮬레이션 자체가 없어 곧장 끝난다.
 */
function startDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  random: RandomPort,
): TeamGameProgress {
  if (!(mine && isBattedBallInPlay(outcome))) {
    // 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 (자동으로 넘긴 타석은 재생 자체가 없다)
    const playback = mine ? homeRunPlaybackOf({ outcome, bases: progress.game.bases }) : null
    return finishDefensiveAtBat(progress, outcome, mine, null, playback)
  }
  return {
    ...progress,
    pendingDefensePlay: { side: '수비', input: defensiveDefenseInputOf(progress, outcome, random), outcome },
  }
}

/**
 * 사람이 던진 타석의 타구 하나. 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다**
 * (굴림은 전부 진행기 안에서 돈다).
 */
function defensiveDefenseInputOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
): DefensePlayInput {
  const before = progress.game
  return {
    outcome,
    trajectory: battedBallTrajectory(representativePatternOf(outcome)),
    bases: before.bases,
    outs: before.outs,
    // 우리가 수비 중이다 — 아홉 칸은 우리 팀, 주자는 상대 타자
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.ourTeamId, progress.ourPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.opponentTeamId, progress.opponentOrderIndex),
    random,
    gameMode: progress.options.mode,
    // 이 타석의 수비는 **사람**이다 → 협살은 원본에서도 안 일어난다 (S8 1-4)
    defenseIsCpu: false,
    // 공격이 CPU 라 0xae690 의 첫 항이 서서 설정과 무관하게 늘 자동 진루다
    offenseIsCpu: true,
    // 반대로 **송구는 여기서만 환경설정이 먹는다** — 0xae6c8 의 첫 항(`경기[0x31 + 수비측] == 1`)이
    // 사람 수비라 거짓이다. 안 넘기면 원본 기본값인 수동이다
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
  }
}

/**
 * 상대 타석 하나를 경기 상태에 먹인다 — 예전 `applyDefensiveAtBat` 의 몸통이다.
 * `playback` 이 null 이면 재생할 것이 없다는 뜻이라 `lastDefensePlay` 는 그대로 둔다
 * (실시간으로 이미 다 보여 준 플레이가 여기로 온다 — 넣으면 같은 장면을 한 번 더 튼다).
 */
function finishDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
): TeamGameProgress {
  const before = progress.game
  const applied = applyOpponentAtBat(
    before,
    progress.opponentOrderIndex,
    outcome,
    // 자동으로 넘긴 타석은 원본도 간이 엔진이다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정)
    defensePlay?.advance ?? advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }),
  )
  const slot = progress.opponentOrderIndex
  const hit = isHit(outcome)
  // 출루 허용 state[0x88] 와 투수 +0x2a 는 볼넷·사구를 함께 센다 (0xa8caa — 사구 플레이는 아웃이 없어 늘 선다)
  const walk = isFreePass(outcome)
  const inningEnded = before.outs + applied.outsAdded >= OUTS_PER_INNING

  const next: TeamGameProgress = {
    ...progress,
    game: applied.game,
    opponentOrderIndex: applied.opponentOrderIndex,
    lastDefensePlay: playback ?? progress.lastDefensePlay,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 득점 처리 0xa5c34 가 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
    ourPitcherCounters: addRunsToCounters(
      progress.ourPitcherCounters,
      applied.runsScored,
      0,
      applied.game.inning !== before.inning || applied.game.half !== before.half,
    ),
    pitching: {
      outsRecorded: progress.pitching.outsRecorded + applied.outsAdded,
      hitsAllowed: progress.pitching.hitsAllowed + (hit ? 1 : 0),
      walksAllowed: progress.pitching.walksAllowed + (walk ? 1 : 0),
      runsAllowed: progress.pitching.runsAllowed + applied.runsScored,
      allowedBaserunner: progress.pitching.allowedBaserunner || hit || walk,
    },
    // 시즌 평판 16칸 — 우리 수비라 **공격측(상대)이 CPU** 인 코드(≤ 5)만 선다
    gameRecord: withSeasonRecord(
      progress,
      '수비',
      defenseRecordCodesOf(outcome, applied.outsAdded),
    ),
    opponentEntryRecords: withPlateAppearance(
      progress.opponentEntryRecords,
      slot,
      outcome,
      applied.runsScored,
    ),
    leaguePlateAppearances: withLeaguePlateAppearance(
      progress.leaguePlateAppearances,
      progress.options.opponentTeamId,
      progress.opponentEntry,
      slot,
      outcome,
      applied.runsScored,
    ),
  }

  const resolved = mine
    ? resolveBurstFor(next, {
        outcome,
        runsBattedIn: applied.runsScored,
        outsBefore: before.outs,
        outsAdded: applied.outsAdded,
        inningEnded,
        // ⚠️ 0xa89f0 — 사람 팀 승리로 경기가 끝나면 홈런·볼넷 비트를 함께 켠다 (P7 K1)
        humanTeamWalkOff:
          applied.game.isFinished && applied.game.ourScore > applied.game.opponentScore,
      })
    : next

  return appendLog(
    resolved,
    `${before.inning}회${before.half} 상대 ${slot + 1}번 — ${describeOutcome(outcome)}${
      applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
    }`,
    mine,
  )
}

/* ── 수비 화면이 끝났을 때 (원본 상태 0x17 → 0x18/0xe) ───────────────────────── */

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·득점)와 `result.voidedRuns`(3아웃으로 날아간 보류 득점)가 여기서
 * 비로소 경기 상태가 된다. 붙들어 둔 칸을 비우므로 다음 타석이 그제서야 시작된다.
 *
 * 공격이었으면 우리 타석 길로, 수비였으면 상대 타석 길로 간다 — 붙들 때 적어 둔 `side` 가 가른다.
 * 이미 눈으로 다 본 플레이라 재생거리(`lastDefensePlay`)로는 남기지 않는다.
 */
export function resolveDefensePlay(
  progress: TeamGameProgress,
  result: DefensePlayResult,
  random: RandomPort,
): TeamGameProgress {
  const pending = progress.pendingDefensePlay
  if (pending === null) return progress
  const cleared = { ...progress, pendingDefensePlay: null }
  if (pending.side === '공격') {
    // 우리 타석 쪽은 몸통 끝에서 이미 다음 사람 차례까지 민다
    return finishBatterOutcome(cleared, pending.outcome, random, result, null)
  }
  return advance(finishDefensiveAtBat(cleared, pending.outcome, true, result, null), random)
}

/* ── 견제 (메시지 0x10 → 0x50f28 → 플레이 종류 4) ─────────────────────────────── */

/**
 * **사람 투수의 견제** — 구질 고르기(상태 0xf)에서 '3' 1루 · '1' 2루 · '7' 3루 (0x53548 → 메시지 0x10 → 0x50f28).
 * 투수편 `pitcherGameFlow.pickoff` 와 같은 길이다.
 *
 * 그 루에 주자가 없거나 견제 키가 아니면 **아무 일도 없다**(원본도 키를 먹고 끝난다 — 같은 객체를 돌려준다).
 * 견제는 투구가 아니다: 투구 수·스태미나·볼카운트·마구 횟수·상대 타순을 건드리지 않는다 (0x10~0x12 를 안 지난다).
 *
 * 수비 화면은 `runPickoffPlay` 가 미리 끝까지 돌린 틱을 `lastDefensePlay` 로 재생한다 — 견제 중에는 사람이
 * 바꿀 것이 없어서다(`pickoffPlay` 머리 주석). 난수는 그 안의 **악송구 굴림(0xa1828) 1번 · 악송구면 +2번**뿐이다.
 */
export function pickoff(progress: TeamGameProgress, webKey: string, random: RandomPort): TeamGameProgress {
  if (!isPitchTurn(progress) || !progress.atBatPrepared) return progress
  const bases = progress.game.bases
  const play = pickoffPlayForKey(webKey, (base) => hasRunnerOn(bases, base))
  if (play === null) return progress
  const result = runPickoffPlay({
    targetBase: play.targetBase,
    bases,
    outs: progress.game.outs,
    // 우리가 수비 중이다 — 아홉 칸은 우리 팀, 주자는 상대 (타구 진행기 `defensiveDefenseInputOf` 와 같은 근사:
    // 주자 모두가 지금 타자의 주루를 쓴다)
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.ourTeamId, progress.ourPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.opponentTeamId, progress.opponentOrderIndex),
    random,
    // 공격이 CPU 라 자동 진루 제어기(0xaf918)가 돈다 (0xae690 첫 항)
    offenseIsCpu: true,
  })
  return applyPickoffPlay(progress, result, '수비', random)
}

/**
 * **CPU 투수의 견제** — 사람이 칠 차례에 CPU 투수 AI 목표점 고르기 `0x345fc` 가 종류 4 를 뽑으면
 * 목표점을 안 만들고 `0x34848` 이 `rand(1,4)` 를 주자 있는 루가 나올 때까지 굴려 **사람 견제와 같은
 * 메시지 0x10** 을 보낸다(I-controls 4a-2). 공은 안 던진다 — 상태 0x11 예약(0x34888)을 안 지난다.
 *
 * 여기는 **그 루가 정해진 뒤**(메시지 0x10 이후)다. 루를 고르는 굴림(`entities/pitching/model/pitchTarget`
 * 의 `isCpuPickoff` · `cpuPickoffBaseOf`)은 CPU 투구를 고르는 자리 `selectPitch`(← `widgets/batting-stage/
 * model/useStageAnimation`)에서 굴린다: 구질(0x344dc) → 목표 종류(0x9eeac) → **견제 루(0x34848, 주자 있는
 * 루까지 반복)** 이고, 그 뒤 목표점·제구·곡선 굴림은 없다. 타석 화면이 `onPickoff(루)` 로 알려 주면
 * `TeamGameScreen` 이 `TeamGameSession.actions.cpuPickoff` 로 여기에 넘긴다.
 *
 * 그 루가 비었으면 원본 루프가 거기서 안 멈추므로 부르는 쪽 잘못이다 — 아무 일도 없다.
 */
export function cpuPickoff(progress: TeamGameProgress, base: PickoffBase, random: RandomPort): TeamGameProgress {
  if (!isBatterTurn(progress) || !progress.atBatPrepared) return progress
  const bases = progress.game.bases
  if (!hasRunnerOn(bases, base)) return progress
  const result = runPickoffPlay({
    targetBase: base,
    bases,
    outs: progress.game.outs,
    // 우리 공격이니 수비는 상대 팀이다
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
    runAbility: runAbilityFor(progress, progress.options.ourTeamId, progress.game.battingOrderIndex),
    random,
    // 우리가 공격이다 — 환경설정 "주루" 가 먹는다 (0xae690 의 둘째 항)
    offenseIsCpu: false,
    runningMode: progress.options.runningModeManual === true ? '수동' : '자동',
  })
  return applyPickoffPlay(progress, result, '공격', random)
}

function hasRunnerOn(bases: GameState['bases'], base: number): boolean {
  return base === 1 ? bases.first : base === 2 ? bases.second : base === 3 ? bases.third : false
}

/** `applyAtBatOutcome` 은 `precomputed` 를 받으면 결과 코드를 안 읽는다 — 견제에는 타석 결과가 없어 자리만 채운다 */
const PICKOFF_OUTCOME_PLACEHOLDER: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }

/**
 * 견제 한 판을 경기 상태에 먹인다 — 원본 견제 판 끝 `0xae3e8` 의 길이다.
 *
 * - `0xae576~0xae592`: `state[0x26]` 이 4 면 (아웃 ≤ 2 이고 다른 갈래에 안 걸리면) 다음 상태 **0xf**(같은 타석,
 *   다음 공) — 볼카운트·타순 그대로 두고 `atBatPrepared` 도 그대로 둔다.
 * - `0xae5a8`: 그리고 정산 `0xa8024` 를 부른다 — **종류 4 라 타석 칸(+0x14)이 안 오른다**(`withPlateAppearance`
 *   에 결과 null). 타석에 서 있는 타자(사람 수비면 상대 타순 칸, 사람 공격이면 우리 타순 칸)의 칸이다.
 *
 * ⚠️ 미해결·근사
 * - 원본은 0xf 에 다시 들어서며 진입 `0x3d954` 가 CPU 대타(0xac228)·CPU 투수 교체(0xac428)를 다시 부른다.
 *   웹은 공마다도 이것을 안 다시 부르므로(`prepareAtBat` 은 타석 시작에만) 견제 뒤에도 안 부른다 — 기존 근사와 같다.
 * - 견제사·진루는 이 모드에서 사실상 안 난다(웹 도루는 그 자리에서 끝나 루를 떠난 주자가 없다). 그래도 진행기가
 *   아웃·진루를 내면 경기 상태(루·아웃·점수·반 이닝 교대)에는 먹인다. 그때 `0xa8024` 의 나머지 칸(투수 아웃 수·
 *   평판 16칸·리그 기록·돌발 판정 0x8f414)이 견제 판에서 어떻게 도는지는 손대지 않았다 — 타순도 안 민다
 *   (`applyOpponentRunnerPlay` 주석과 같은 미해결).
 */
function applyPickoffPlay(
  progress: TeamGameProgress,
  result: PickoffPlayResult,
  humanSide: ControlSide,
  random: RandomPort,
): TeamGameProgress {
  const before = progress.game
  const advanceResult = result.advance
  const humanDefends = humanSide === '수비'
  const changed =
    advanceResult.outsAdded > 0 ||
    advanceResult.runsScored > 0 ||
    advanceResult.bases.first !== before.bases.first ||
    advanceResult.bases.second !== before.bases.second ||
    advanceResult.bases.third !== before.bases.third

  let next: TeamGameProgress = humanDefends
    ? {
        ...progress,
        lastDefensePlay: result,
        opponentEntryRecords: withPlateAppearance(progress.opponentEntryRecords, progress.opponentOrderIndex, null, 0),
      }
    : {
        ...progress,
        lastDefensePlay: result,
        ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, before.battingOrderIndex, null, 0),
      }

  let runs = 0
  if (changed) {
    let game: GameState
    if (humanDefends) {
      const applied = applyOpponentRunnerPlay(before, progress.opponentOrderIndex, advanceResult)
      game = applied.game
      runs = applied.runsScored
    } else {
      // 타석이 끝난 것이 아니라 타순 커서는 그대로 둔다
      game = {
        ...applyAtBatOutcome(before, PICKOFF_OUTCOME_PLACEHOLDER, advanceResult),
        battingOrderIndex: before.battingOrderIndex,
      }
      runs = game.ourScore - before.ourScore
    }
    const halfChanged = game.half !== before.half || game.inning !== before.inning
    next = {
      ...next,
      game,
      // 득점 처리 0xa5c34 는 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
      ...(humanDefends
        ? {
            ourPitcherCounters: addRunsToCounters(progress.ourPitcherCounters, runs, 0, halfChanged),
            pitching: { ...progress.pitching, runsAllowed: progress.pitching.runsAllowed + runs },
          }
        : {
            opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, runs, 0, halfChanged),
          }),
      ...(halfChanged ? { atBat: createAtBat(), atBatPrepared: false } : {}),
    }
  }

  const call = result.resultCode === PICKOFF_RESULT.OUT ? '견제사' : result.errantThrow ? '악송구' : '세이프'
  next = appendLog(
    next,
    `${before.inning}회${before.half} ${humanDefends ? '' : '상대 '}${result.targetBase}루 견제 — ${call}${
      runs > 0 ? ` (${runs}${humanDefends ? '실점' : '점'})` : ''
    }`,
    true,
  )
  return changed ? advance(next, random) : next
}

/* ── 타석 준비 · 돌발 ─────────────────────────────────────────────────────────── */

/**
 * 타석 준비 (상태 0xe → 0xf 전이의 **돌발 발동 판정 0x8f158**).
 *
 * 돌발미션 표는 시즌(모드 2)에만 있다 — 경기 장면이 모드 2·3·4 에서만 객체를 만든다 (0x48658).
 * 시즌 표 56행은 **사람 팀이 공격이면 0~30(타자형), 수비면 31~55(투수형)** 로 갈린다 (0x8f000).
 *
 * **근사**: 원본은 경기 장면이 지나는 모든 타석에서 굴리지만, 자동 진행 구간은 상태 0x21
 * (간이 엔진 중계)로 빠져 0xf 를 지나지 않는다. 그래서 여기서도 **사람이 잡은 타석에서만** 굴린다.
 */
function prepareAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 사람 경기 타석 시작 0x3d954 는 **수비가 사람일 때** CPU 대타 0xac228 을 부른다 (0x3da6e).
  // (수비가 CPU 면 그 자리에서 CPU 투수 교체 0xac428 로 간다 — 그쪽은 자동 타석에만 옮겨져 있다.)
  // ⚠️ 돌발미션 판정과의 앞뒤 차례는 **미확인**이다 (0x3d954 를 끝까지 읽지 않았다).
  if (isPitchTurn(progress)) progress = applyCpuPinchHit(progress, false, random)
  const session = progress.burst
  if (session === null) return { ...progress, atBatPrepared: true }
  const ours = isOurOffense(progress)
  const next = tryTriggerBurst(
    session,
    {
      isHumanTeamBatting: ours,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 원본 이닝은 0-기준이다 (game+0x6b)
      inning: progress.game.inning - 1,
      ourScore: progress.game.ourScore,
      opponentScore: progress.game.opponentScore,
      opponentBattingSlot: progress.opponentOrderIndex,
      // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 이벤트 match 명령으로만
      opponentAceBatterId: null,
      opponentAcePitcherId: null,
      // 웹 로스터에 선수별 경기 기록 칸이 없어 팀 누계를 쓴다 (근사)
      hitsInGame: ours ? progress.ourHits : progress.pitching.hitsAllowed,
      homeRunsInGame: 0,
      strikeoutsInGame: 0,
    },
    random,
  )
  return { ...progress, burst: next, atBatPrepared: true }
}

/** 타석이 끝나는 자리에서 돌발을 판정한다 (0x8f414) */
function resolveBurstFor(
  progress: TeamGameProgress,
  play: {
    outcome: AtBatOutcome
    runsBattedIn: number
    outsBefore: number
    outsAdded: number
    inningEnded: boolean
    humanTeamWalkOff: boolean
  },
): TeamGameProgress {
  if (progress.burst === null) return progress
  // 사구도 B5(출루)·B11 을 켠다 (0xa882a "볼 4개 || 사구" · 0xa8bf4) — burstResultBitsOf 가 '사구' 를 직접 받는다
  const resolution = resolveBurst(progress.burst, burstResultBitsOf(play))
  return {
    ...progress,
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : null,
  }
}

/** 돌발 결과 창을 닫는다 (보상은 앱이 시즌 레코드에 얹는다 — 판정에 변화량이 들어 있다) */
export function closeBurstWindow(progress: TeamGameProgress): TeamGameProgress {
  return progress.lastBurstResolution === null ? progress : { ...progress, lastBurstResolution: null }
}

/* ── 경기 중 투수 교체 (0xc1ba4 → 0xac428 · 0xabfcc · 0xaf09c) ───────────────── */

/**
 * 간이 타석 하나를 돌리기 **전에** 수비 팀 투수 교체를 판정한다 (0xc262c 가 타석마다 0xc1ba4 를 부른다).
 *
 * `defendingIsOurs` 가 참이면 우리 팀이 수비(= 우리 투수), 거짓이면 상대 투수를 본다.
 * 사람이 직접 던지는 타석은 이 길을 지나지 않는다 — 그때는 `#` 메뉴(`changePitcher`)뿐이다.
 *
 * ⚠️ 원본 `0xc1ba4` 의 첫 갈래(모드 3 에서 8회에 벤치 마선수로 교체)는 **투수편 전용**이라 여기 없다.
 */
function judgeAutoPitcherChange(
  progress: TeamGameProgress,
  defendingIsOurs: boolean,
  random: RandomPort,
): TeamGameProgress {
  const game = progress.game
  const used = defendingIsOurs ? progress.ourUsedPitchers : progress.opponentUsedPitchers
  const current = defendingIsOurs ? progress.ourPitcherIndex : progress.opponentPitcherIndex
  const stamina = defendingIsOurs ? progress.stamina : progress.opponentStamina
  const counters = defendingIsOurs ? progress.ourPitcherCounters : progress.opponentPitcherCounters
  const bench = benchIndexesOf(
    current,
    used,
    pitcherEntriesOf(progress, defendingIsOurs ? progress.options.ourTeamId : progress.options.opponentTeamId)
      .length,
  )
  const defenseScore = defendingIsOurs ? game.ourScore : game.opponentScore
  const offenseScore = defendingIsOurs ? game.opponentScore : game.ourScore

  const decision = judgePitcherChange({
    ...counters,
    // ⚠️ 웹 로스터에 보직(`+0xb`)이 없다 — 선발로 본다 (역할 0·1 은 같은 갈래라 결과가 같다).
    //    로스터 JSON 에 `+0xb` 가 들어오면 그 값을 쓰면 된다.
    role: PITCHER_ROLE.starter,
    stamina,
    benchCount: bench.length,
    // 0xac428 의 일곱째 인자(`[sp+0x58]`)는 0xc1cd8 이 넘기는 `[sp+0x10] = max(r7, 0)` 이다.
    // r7 은 0xc1bbc 에서 −1 로 서고 모드 3(투수편) 갈래(0xc1bc6~0xc1c48)에서만 벤치 번호가 된다 —
    // 팀 경기 모드(1·2·8·9)는 그 갈래를 안 타 늘 −1 → **0** 이다. 곧 벤치가 한 명만 남아도 바꾼다
    // (`judgePitcherChange` 의 기본값 1 은 이 자리와 맞지 않는다).
    minimumBench: 0,
    justChanged: progress.pitcherJustChanged,
    lead: defenseScore - offenseScore,
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: game.inning - 1,
    runnerCount: runnerCountOf(game.bases),
  })
  if (!decision.replace) return progress

  const next = replacementPitcherIndexOf(
    bench,
    {
      saveSituation: decision.saveSituation,
      // 원본 이닝은 0-기준이다 (state+0x6b)
      inningIndex: game.inning - 1,
      lead: defenseScore - offenseScore,
      runnerCount: runnerCountOf(game.bases),
      currentStamina: stamina,
    },
    random,
  )
  if (next < 0) return progress

  return appendLog(
    applyPitcherChange(progress, defendingIsOurs, next),
    `${game.inning}회${game.half} ${defendingIsOurs ? '우리' : '상대'} 투수 교체 — ${current + 1}번 → ${next + 1}번`,
    false,
  )
}

export interface ReplacementPickInput {
  /** `judgePitcherChange` 가 세운 "마무리 상황" 표시 */
  readonly saveSituation: boolean
  /** **0-기준** 이닝 (state+0x6b) */
  readonly inningIndex: number
  /** 수비 팀 점수 − 공격 팀 점수 */
  readonly lead: number
  readonly runnerCount: number
  /** 지금 마운드에 선 투수의 스태미나 */
  readonly currentStamina: number
}

/**
 * 새 투수 고르기 `0xac5d8~0xac61c`.
 *
 * ```
 * 0xb8a8d(team, 0) 이 참이고 **마무리 상황이 아니면**  →  0xac360 굴림
 *     참   → 벤치 **마지막**(벤치 수 − 1)
 *     거짓 → 벤치 ≤ 1 이면 0번, 아니면 0xabfcc
 * 마무리 상황이거나 0xb8a8d 가 거짓이면  →  0xabfcc(…, [sp] = 마무리 플래그)
 * ```
 *
 * ⚠️ E-defense-rules 4절 3c 가 이 방향을 **거꾸로**("마무리 상황이면 벤치 마지막") 적었던 것을
 * CORRECTIONS 가 정정했다 — V3-E "❌ 새 투수 고르기 방향이 반대". 여기서는 정정 쪽이다.
 *
 * ⚠️ `0xb8a8d(team, 0)` 이 무엇을 보는지는 해독 문서에 없어 **늘 참으로 본다** — **근사다**.
 * "벤치 ≤ 1 이면 0번" 갈래도 따로 두지 않았다 — 후보가 하나뿐이면 `chooseReplacementPitcher`
 * 가 그 하나를 돌려주므로 결과가 같다(벤치가 비면 `judgePitcherChange` 가 이미 안 바꾼다).
 */
export function replacementPitcherIndexOf(
  bench: readonly number[],
  input: ReplacementPickInput,
  random: RandomPort,
): number {
  const picksBenchLast =
    !input.saveSituation &&
    rollsCloser(
      {
        inningIndex: input.inningIndex,
        lead: input.lead,
        runnerCount: input.runnerCount,
        // 팀 경기는 한 팀을 사람이 잡으므로 "두 팀 다 CPU" 가 아니다 (0xb6c20)
        bothTeamsAreCpu: false,
      },
      random,
    )
  if (picksBenchLast) return bench.length === 0 ? -1 : bench[bench.length - 1]
  return chooseReplacementPitcher(
    bench.map((index) => ({ index })),
    {
      inningIndex: input.inningIndex,
      // 0xabfcc 의 다섯째 인자가 마무리 플래그다 (V3-E)
      lateInningFlag: input.saveSituation,
      currentStamina: input.currentStamina,
    },
  )
}

/**
 * 벤치에 남은 투수 칸 (`team+0x33`) — 이미 던진 투수와 지금 투수는 빠진다.
 *
 * 칸 수는 **투수 명단 길이**다. 원본도 `team+0x33 = 명부[0xc] − 1` 로 명부 길이에서 셈하므로
 * (0xb896c), 마투수가 들어와 명부가 8 → 9 로 늘면 벤치 투수도 7 → 8 로 는다.
 */
function benchIndexesOf(
  current: number,
  used: readonly number[],
  entryLength: number,
): readonly number[] {
  const out: number[] = []
  for (let index = 0; index < entryLength; index += 1) {
    if (index === current || used.includes(index)) continue
    out.push(index)
  }
  return out
}

/**
 * 교체 실행 `0xaf09c` → `0xaebe4`. 새 투수는 스태미나가 가득이고 카운터가 0 이며,
 * `state[0xd]` 가 서서 **다음 한 투구 동안**은 다시 바뀌지 않는다 (0xaec64 memset · 0xa5e72).
 */
function applyPitcherChange(
  progress: TeamGameProgress,
  ours: boolean,
  nextIndex: number,
): TeamGameProgress {
  const base = { ...progress, pitcherJustChanged: true }
  if (ours) {
    return {
      ...base,
      ourUsedPitchers: [...progress.ourUsedPitchers, progress.ourPitcherIndex],
      ourPitcherIndex: nextIndex,
      // 웹 로스터에는 투수별 누적 스태미나가 없다 — 새 투수는 가득 찬 채로 올라온다 (근사)
      stamina: FULL_STAMINA,
      ourPitcherCounters: EMPTY_MOUND_COUNTERS,
      pitchCount: 0,
    }
  }
  return {
    ...base,
    opponentUsedPitchers: [...progress.opponentUsedPitchers, progress.opponentPitcherIndex],
    opponentPitcherIndex: nextIndex,
    opponentStamina: FULL_STAMINA,
    opponentPitcherCounters: EMPTY_MOUND_COUNTERS,
  }
}

/**
 * 사람이 `#` 메뉴로 투수를 바꾼다 (R4 1b — 원본도 **사람 손으로만** 우리 투수를 바꾼다).
 * `benchIndex` 는 아직 안 쓴 우리 팀 투수 칸이어야 한다.
 */
export function changePitcher(progress: TeamGameProgress, benchIndex: number): TeamGameProgress {
  if (progress.game.isFinished) return progress
  if (!availablePitchers(progress).includes(benchIndex)) return progress
  return appendLog(
    applyPitcherChange(progress, true, benchIndex),
    `${progress.game.inning}회${progress.game.half} 투수 교체 — ${progress.ourPitcherIndex + 1}번 → ${benchIndex + 1}번`,
    true,
  )
}

/** 지금 바꿔 넣을 수 있는 우리 팀 투수 칸 — 화면의 투수 교체 목록이 쓴다 */
export function availablePitchers(progress: TeamGameProgress): readonly number[] {
  return benchIndexesOf(
    progress.ourPitcherIndex,
    progress.ourUsedPitchers,
    progress.ourPitcherEntry.length,
  )
}

/**
 * `#` 로 교체 화면(경기 상태 0xb)을 열 수 있는가 — 진입 조건 `0x498d4` 의 '#' 가지 (I-controls 4b · R4 1a).
 *
 * 원본 조건 셋: ① `0x38984` 참(모드 4·7 은 막는다 — 팀 경기 모드 1·2·8·9 는 통과),
 * ② 경기 상태가 **0xe 또는 0xf**(투구 전·구질 고르기) — 웹에서는 *사람이 던질 차례이고 아직 안 던진 상태*,
 * ③ 사람 팀 벤치 투수 수 `팀+0x33` > 0.
 *
 * 사람이 **공격** 중이면 같은 키가 **대타**로 간다 (`canOpenPinchHit`) — 갈림길은 `0x49598`
 * 한 줄이다: `state[0x31+공격] == 0`(공격이 사람) → `0xaf06c`(대타), 아니면 `0xaf09c`(투수 교체).
 */
export function canOpenPitcherChange(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isPitchTurn(progress)) return false
  return availablePitchers(progress).length > 0
}

/* ── 대타 (0xaf06c → 0xaebe4 의 +0x291 가지) ──────────────────────────────────── */

/**
 * 지금 올릴 수 있는 우리 벤치 타자의 **명단 칸** — 타순 아홉 칸 뒤가 그대로 벤치다.
 * 칸 수는 원본과 같이 `team+0x28c`(= `ourBenchBatters`)가 정한다.
 */
export function availablePinchHitters(progress: TeamGameProgress): readonly number[] {
  const count = Math.min(progress.ourBenchBatters, progress.ourEntry.length - BATTING_ORDER_SIZE)
  return Array.from({ length: Math.max(0, count) }, (_unused, k) => BATTING_ORDER_SIZE + k)
}

/**
 * `#` 로 **대타** 화면(경기 상태 0xb)을 열 수 있는가 — `canOpenPitcherChange` 와 같은 '#' 가지의
 * 공격 쪽이다 (R4 1a): 경기 상태 0xe·0xf 이고 **벤치 타자 수 `팀+0x28c` > 0**.
 *
 * 원본은 한 경기 대타 횟수를 사람에게 제한하지 않는다 — 벤치가 남아 있는 만큼 낼 수 있다
 * (경기당 1번 제한은 CPU 대타 `0xac228` 쪽 `state[0xe]` 뿐이다).
 */
export function canOpenPinchHit(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isBatterTurn(progress)) return false
  return availablePinchHitters(progress).length > 0
}

/**
 * **대타를 낸다** — 예약 `0xaf06c(team, k, 0)`(`team+0x291 = 1`, `team+0x293 = 9 + k`)이 서고,
 * 교체 연출(상태 0x16)을 지나 **다음 타석 시작(상태 0xd) 진입 `0x48d50` 이 `0xaebe4(team, 0)`**
 * 으로 확정한다. 여기서는 그 한 줄기를 한 번에 돌린다.
 *
 * 확정 `0xaebe4` 의 대타 가지(`aecac~aedec`) 그대로:
 *   1. 수비 위치 니블을 맞바꾼다 — 나가는 선수가 벤치 자리(0)를, **들어오는 선수가 그 수비 자리**를
 *      받는다 (`aecde~aecfe`: `0xb8e85(옛 타자, pb, 1)` · `0xb8e85(새 타자, pa, 1)`).
 *   2. 명단 두 칸을 맞바꾼다 (`aed02~aed14`).
 *   3. `0xb95b1` 로 뒤를 한 칸 당겨 **빠진 선수를 명단에서 지운다** — 재출장은 없다 (`aed16`).
 *      (원본은 타순별 경기 기록 24바이트도 같이 옮기고 당긴다. 리그 기록표 `leaguePlateAppearances`
 *      는 명단 칸이 든 **로스터 칸**(`TeamEntryBatter.rosterSlot`)으로 쌓으므로 선수를 따라간다.)
 *   4. 벤치 타자 수 `team+0x28c` 를 하나 줄인다 (0 밑으로는 안 간다, `aed9c~aedae`).
 *
 * 볼카운트가 **0-0 으로 돌아가는 것도 원본 그대로**다: 상태 0x16 다음이 0xd 이고, 그 진입
 * `0x48d50` 이 타석 초기화 `0xa5bcc` 를 부른다 (R8 · R10 8절 표). 곧 볼 셋에서 대타를 내면
 * 새 타자가 **처음부터** 친다.
 *
 * ⚠️ **안 옮긴 것**: 교체 연출(상태 0x16)과 그 자리에서 서는 "대타 홈런" 기록 칸(`ctx+0x160`,
 * `0xa5bf0`). 원본은 0x16 에서 세우고 바로 다음 0xd 의 타석 초기화가 지우는 모양이라
 * 순서가 **미해결**이다 (R8 19행) — 기록 5번은 웹에도 아직 없다.
 */
export function pinchHit(progress: TeamGameProgress, benchIndex: number): TeamGameProgress {
  if (progress.game.isFinished) return progress
  if (!availablePinchHitters(progress).includes(benchIndex)) return progress
  const swapped = substituteBatter(
    progress.ourEntry,
    progress.ourEntryRecords,
    progress.game.battingOrderIndex,
    benchIndex,
    progress.ourHitBases,
  )
  if (swapped === null) return progress

  return appendLog(
    {
      ...progress,
      ourEntry: swapped.entry,
      ourEntryRecords: swapped.records,
      ourHitBases: swapped.hitBases ?? progress.ourHitBases,
      // 4. 벤치 타자 수 −1
      ourBenchBatters: Math.max(0, progress.ourBenchBatters - 1),
      // 상태 0x16 → 0xd → 타석 초기화 0xa5bcc
      atBat: createAtBat(),
      atBatPrepared: false,
    },
    `${progress.game.inning}회${progress.game.half} 대타 — ${swapped.outgoing.name} → ${swapped.incoming.name}`,
    true,
  )
}

/**
 * **확정 `0xaebe4` 의 대타 가지 한 덩어리** — 사람 대타(`pinchHit`)와 CPU 대타(`0xac228`)가 같이 쓴다.
 * 타순별 경기 기록 24바이트도 원본처럼 선수를 따라 움직인다 (`aed02~aed16`).
 */
function substituteBatter(
  entryBefore: readonly TeamEntryBatter[],
  recordsBefore: readonly BatterGameRecord[],
  slot: number,
  benchIndex: number,
  /** 우리 팀일 때만 넘긴다 — 사이클 판정은 사람 팀 타순만 본다 (`0xa7610` 의 `st[0x31+st[9]]`) */
  hitBasesBefore?: readonly (readonly number[])[],
): {
  readonly entry: readonly TeamEntryBatter[]
  readonly records: readonly BatterGameRecord[]
  readonly hitBases: readonly (readonly number[])[] | undefined
  readonly outgoing: TeamEntryBatter
  readonly incoming: TeamEntryBatter
} | null {
  const outgoing = entryBefore[slot]
  const incoming = entryBefore[benchIndex]
  if (outgoing === undefined || incoming === undefined) return null

  const entry = [...entryBefore]
  // 1·2. 수비 자리는 자리에 남고 선수만 바뀐다
  entry[slot] = { ...incoming, position: outgoing.position }
  entry[benchIndex] = { ...outgoing, position: incoming.position }
  const records = [...recordsBefore]
  records[slot] = records[benchIndex] ?? EMPTY_BATTER_GAME_RECORD
  records[benchIndex] = recordsBefore[slot] ?? EMPTY_BATTER_GAME_RECORD
  // 루타 목록도 같은 24바이트 안에 있으니 함께 움직인다 (aed02~aed16)
  const hitBases = hitBasesBefore === undefined ? undefined : [...hitBasesBefore]
  if (hitBases !== undefined && hitBasesBefore !== undefined) {
    hitBases[slot] = hitBasesBefore[benchIndex] ?? []
    hitBases[benchIndex] = hitBasesBefore[slot] ?? []
  }
  // 3. 빠진 선수를 명단에서 지운다
  entry.splice(benchIndex, 1)
  records.splice(benchIndex, 1)
  hitBases?.splice(benchIndex, 1)

  return { entry, records, hitBases, outgoing, incoming }
}

/* ── CPU 대타 (0xac228) ──────────────────────────────────────────────────────── */

/**
 * **CPU 대타 한 번** — 타석 시작마다 공격 팀을 두고 `0xac228` 을 물어본다 (Q1 4절, `pinchHitAi`).
 *
 * 부르는 자리는 원본 둘을 그대로 옮긴 것이다:
 *   - 자동으로 넘기는 타석: 간이 엔진 `0xc1ba4` 가 **공격 팀**을 두고 부른다 (`0xc1c50`) —
 *     투수 교체 `0xac428` 보다 **먼저**. 공격이 우리 팀이어도 마찬가지다 (원본에 가림막이 없다).
 *   - 사람이 잡은 타석: `0x3d954` 가 **수비가 사람일 때만** 부른다 (`0x3da6e`) — 곧 우리가
 *     던지는 타석에서 상대 타순에만 선다.
 *
 * ⚠️ 원본이 보는 **장비 레벨 니블**(레코드 `+0x19`·`+0x1a`)은 웹 로스터 표에 없어 늘 0 으로 둔다.
 */
function applyCpuPinchHit(
  progress: TeamGameProgress,
  battingIsOurs: boolean,
  random: RandomPort,
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  const entry = battingIsOurs ? progress.ourEntry : progress.opponentEntry
  const records = battingIsOurs ? progress.ourEntryRecords : progress.opponentEntryRecords
  const bench = battingIsOurs ? progress.ourBenchBatters : progress.opponentBenchBatters
  const slot = battingIsOurs ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const batter = entry[slot]
  if (batter === undefined) return progress

  const benchIndex = judgeCpuPinchHit(
    {
      alreadyUsedThisGame: progress.cpuPinchHitUsed,
      batterIsAce: batter.aceIndex !== NO_ACE_BATTER,
      // 원본은 명단 칸이 모자라도 team+0x28c 만 보고 rand(0, n) 을 돌린다 — 실제 칸 수로 자른다
      benchBatters: Math.min(bench, Math.max(0, entry.length - BATTING_ORDER_SIZE)),
      record: records[slot] ?? EMPTY_BATTER_GAME_RECORD,
      runnerCount: runnerCountOf(progress.game.bases),
      // 타석 시작에서만 부르므로 둘 다 0 이다 (state[4]·state[5])
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
    },
    random,
  )
  if (benchIndex < 0) return progress

  const swapped = substituteBatter(
    entry,
    records,
    slot,
    BATTING_ORDER_SIZE + benchIndex,
    battingIsOurs ? progress.ourHitBases : undefined,
  )
  if (swapped === null) return progress

  const changed: TeamGameProgress = battingIsOurs
    ? {
        ...progress,
        ourEntry: swapped.entry,
        ourEntryRecords: swapped.records,
        ourHitBases: swapped.hitBases ?? progress.ourHitBases,
        ourBenchBatters: Math.max(0, progress.ourBenchBatters - 1),
      }
    : {
        ...progress,
        opponentEntry: swapped.entry,
        opponentEntryRecords: swapped.records,
        opponentBenchBatters: Math.max(0, progress.opponentBenchBatters - 1),
      }

  return appendLog(
    {
      ...changed,
      // state[0xe] = 1 — 경기에 한 번뿐이다
      cpuPinchHitUsed: true,
      // 상태 0x16 → 0xd → 타석 초기화 0xa5bcc
      atBat: createAtBat(),
    },
    `${progress.game.inning}회${progress.game.half} ${battingIsOurs ? '우리' : '상대'} CPU 대타 — ${swapped.outgoing.name} → ${swapped.incoming.name}`,
    false,
  )
}

/* ── 자동진행 (경기 중 메뉴 동작 4 = 0x3c60c → 하위 2 = 0x3c7d8) ─────────────── */

/** 대전모드(8·9) 자동진행 비용 (`3c67e: movs r2,#0x64`) */
export const AUTO_PROGRESS_COST_VERSUS = 100
/** 그 밖 모드의 자동진행 비용 (`3c694: movs r2,#0x1e`) */
export const AUTO_PROGRESS_COST = 30
/** 대전모드는 0-기준 이닝이 5 를 넘으면 거절한다 (`경기+0x6b > 5` → StrGAME[2]) */
const AUTO_PROGRESS_LAST_INNING_INDEX = 5

/** 이 모드의 자동진행 G포인트 비용 */
export function autoProgressCostOf(mode: number): number {
  return mode === TEAM_GAME_MODE.대전 || mode === TEAM_GAME_MODE.대전이벤트
    ? AUTO_PROGRESS_COST_VERSUS
    : AUTO_PROGRESS_COST
}

/** 대전모드인가 — 6회 제한과 100G 가 붙는 두 모드 */
function isVersusMode(mode: number): boolean {
  return mode === TEAM_GAME_MODE.대전 || mode === TEAM_GAME_MODE.대전이벤트
}

/**
 * 지금 자동진행을 물어볼 수 있는가 — **대전모드는 6회까지만**이다 (`0x3c60c`).
 * 거짓이면 원본은 StrGAME[2]("6회까지만") 알림만 띄우고 끝낸다.
 */
export function canAutoProgress(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isVersusMode(progress.options.mode)) return true
  // 원본 이닝은 0-기준이다 (state+0x6b)
  return progress.game.inning - 1 <= AUTO_PROGRESS_LAST_INNING_INDEX
}

/**
 * 자동진행을 한 번 굴린다 — 사람 차례를 건너뛰고 간이 엔진이 타석을 이어 돌린다
 * (`0x3c8da` 가 간이 시뮬레이터 `this+0x1780` 으로 넘기고, 갱신 `0x48480` 이 `0xc262c` 를 반복한다).
 *
 * ⚠️ **중계 화면(경기 상태 0x21)은 옮기지 않았다** — 속도 칸 3단계·주자 그림·"공격팀(PLAYER/COM)" 띠·
 * CLR 중단 질문(StrGAME[6])은 R10 7절에 있지만 연출이라 건너뛰었다. 여기서는 결과만 계산한다.
 *
 * ⚠️ **끝나는 지점은 근사**다. 원본은 `0xc2198(sim,1)` 이 거짓이 될 때까지 도는데 그 조건을 못 읽었다
 * (I-controls 4d 는 "7회 직접 플레이 전환 지점으로 보임 — 유력" 이라고만 적는다).
 * 여기서는 **경기 끝까지** 돌리되, 대전모드는 "6회까지만" 이라는 StrGAME[2] 에 맞춰 **6회를 마치면 멈춘다**.
 */
export function runAutoProgress(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 수비 진행 중에는 손대지 않는다 — 붙들어 둔 타구를 버리고 다음 타석으로 넘어가면 안 된다
  if (progress.pendingDefensePlay !== null) return progress
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isVersusMode(current.options.mode) && current.game.inning - 1 > AUTO_PROGRESS_LAST_INNING_INDEX) {
      break
    }
    current = isOurOffense(current)
      ? playAutoOffenseAtBat(current, random)
      : playAutoDefenseAtBat(current, random)
  }
  // 자동진행이 멈춘 자리부터는 평소대로 — 다음 사람 차례에서 선다
  return advance(current, random)
}

/* ── 도루 (상태 0x11 공격, 0x53610 → 메시지 0x583) ───────────────────────────── */

/**
 * 도루를 걸 수 있는 루 — 원본 키는 '3' → 1루 주자 · '2' → 2루 주자 · '1' → 3루 주자다
 * (`0x53610`, 인자 = 대상 주자 1·2·3). 공격 중(상태 0x11)일 때만 받는다.
 *
 * 3루 주자는 빠진다 — `entities/game/model/steal` 의 `canStealFrom` 이 적은 대로
 * 원본 도루 판정(0xc1818)이 홈 도루를 걸지 않기 때문이다.
 */
export function stealableBases(progress: TeamGameProgress): readonly StealBase[] {
  if (!isBatterTurn(progress)) return []
  const bases = progress.game.bases
  const out: StealBase[] = []
  if (bases.first && !bases.second) out.push(1)
  if (bases.second && !bases.third) out.push(2)
  return out.filter((base) => canStealFrom(base))
}

/** 도루 대상 주자가 선 루 */
export type StealBase = 1 | 2 | 3

/**
 * 도루 한 번 (메시지 0x583). 성공하면 주자가 한 루 가고, 실패하면 그 주자가 죽는다.
 *
 * 판정은 `entities/game/model/steal` 의 원본 표(0xd9064, 주력만 본다)를 그대로 쓴다.
 *
 * ⚠️ **주자가 누구인지가 근사**다 — 웹 `GameState` 는 루에 선 주자의 신원을 들고 있지 않다.
 * 1루 주자는 직전 타자, 2루 주자는 그 앞 타자로 보고 타순에서 거꾸로 세어 능력치를 꺼낸다.
 */
export function stealBase(
  progress: TeamGameProgress,
  base: StealBase,
  random: RandomPort,
): TeamGameProgress {
  if (!stealableBases(progress).includes(base)) return progress
  const before = progress.game
  const runnerSlot =
    (before.battingOrderIndex - base + BATTING_ORDER_SIZE * 2) % BATTING_ORDER_SIZE
  const runner = entryStageAbilityOf(progress, progress.options.ourTeamId, runnerSlot)
  const succeeded = attemptSteal(runner, random) === '성공'

  if (succeeded) {
    const bases =
      base === 1
        ? { ...before.bases, first: false, second: true }
        : { ...before.bases, second: false, third: true }
    return appendLog(
      { ...progress, game: { ...before, bases } },
      `${before.inning}회${before.half} ${base}루 주자 도루 성공`,
      true,
    )
  }

  // 도루 실패 = 주자 한 명 아웃. 타석은 그대로 이어지므로 타순 커서는 되돌린다.
  const bases = base === 1 ? { ...before.bases, first: false } : { ...before.bases, second: false }
  const caught = applyAtBatOutcome(before, { kind: '아웃', detail: '땅볼아웃' }, {
    bases,
    runsScored: 0,
    outsAdded: 1,
  })
  const next: TeamGameProgress = {
    ...progress,
    game: { ...caught, battingOrderIndex: before.battingOrderIndex },
    // 반 이닝이 넘어갔으면 볼카운트도 새로 시작한다
    atBat: caught.half === before.half ? progress.atBat : createAtBat(),
    atBatPrepared: caught.half === before.half ? progress.atBatPrepared : false,
  }
  return advance(
    appendLog(next, `${before.inning}회${before.half} ${base}루 주자 도루 실패 (주루사)`, true),
    random,
  )
}

/**
 * 간이 타석의 투구 한 개마다 수비 팀 투수의 스태미나가 깎이고 투구 수가 는다 (0xa5e14).
 *
 * **근사**: 간이 엔진은 구질을 고르지 않아 `pitchStaminaCostOf` 의 기본 소모(9)를 쓴다.
 * 용량 X 는 그 투수의 체력 능력치(칸 3)와 팀 사기로 구한다 (0x66e44).
 */
function drainQuickPitcher(
  stamina: number,
  staminaAbility: number,
  teamMorale: number,
  isFirstPitcher: boolean,
  pitches: number,
): number {
  const capacity = staminaCapacityOf(staminaAbility, teamMorale, isFirstPitcher)
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: 1,
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  })
  let next = stamina
  for (let pitch = 0; pitch < pitches; pitch += 1) next = consumeStamina(next, cost, capacity)
  return next
}

/* ── 자동 진행 ───────────────────────────────────────────────────────────────── */

function advance(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isHumanTurn(current)) {
      return current.atBatPrepared ? current : prepareAtBat(current, random)
    }
    current = isOurOffense(current)
      ? playAutoOffenseAtBat(current, random)
      : playAutoDefenseAtBat(current, random)
  }
  throw new Error('팀 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/** 자동으로 넘기는 우리 타석 — 원본도 같은 간이 엔진을 쓴다 (0xc11f0) */
function playAutoOffenseAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 0xc262c 는 타석마다 먼저 0xc1ba4 를 부른다 — 그 안에서 CPU 대타(공격 팀)가 먼저다 (0xc1c50)
  progress = applyCpuPinchHit(progress, true, random)
  // 이어서 CPU 투수 교체 (0xc1ce2) — 우리가 공격 중이면 **상대 투수**를 본다
  progress = judgeAutoPitcherChange(progress, false, random)
  const { options } = progress
  const before = progress.game
  const play = playQuickAtBat(
    entryQuickBatterOf(progress, options.ourTeamId, before.battingOrderIndex),
    entryQuickPitcherOf(progress, options.opponentTeamId, progress.opponentPitcherIndex),
    { inning: before.inning },
    random,
  )
  const outcome = play.outcome
  // 간이 엔진 타석 — 희생플라이가 없다 (E-2 확정)
  const game = applyAtBatOutcome(
    before,
    outcome,
    advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }),
  )
  const runsBattedIn = game.ourScore - before.ourScore
  const slot = before.battingOrderIndex
  const autoOffense = offenseRecordOf(outcome, runsBattedIn, progress.ourHitBases[slot] ?? [])

  return appendLog(
    {
      ...progress,
      game,
      atBat: createAtBat(),
      atBatPrepared: false,
      // 투구마다 state[0xd] 가 내려간다 (0xa5e72)
      pitcherJustChanged: false,
      opponentStamina: drainQuickPitcher(
        progress.opponentStamina,
        opponentPitcherStaminaAbility(progress),
        100,
        progress.opponentUsedPitchers.length === 0,
        play.pitches,
      ),
      opponentPitcherCounters: addRunsToCounters(
        progress.opponentPitcherCounters,
        runsBattedIn,
        play.pitches,
        game.inning !== before.inning || game.half !== before.half,
      ),
      ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
      ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, outcome, runsBattedIn),
      // 자동으로 넘긴 타석도 원본은 같은 0xa8024 를 지난다 — 평판 16칸도 똑같이 오른다
      gameRecord: withSeasonRecord(progress, '공격', autoOffense.codes),
      ourHitBases: withHitBases(progress.ourHitBases, slot, autoOffense.hitBases),
      leaguePlateAppearances: withLeaguePlateAppearance(
        progress.leaguePlateAppearances,
        options.ourTeamId,
        progress.ourEntry,
        slot,
        outcome,
        runsBattedIn,
      ),
    },
    `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
}

/** 자동으로 넘기는 상대 타석 */
function playAutoDefenseAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 0xc1ba4 안 차례 그대로 — CPU 대타(공격 = 상대 팀)가 먼저 (0xc1c50)
  progress = applyCpuPinchHit(progress, false, random)
  // 우리가 수비 중인 자동 타석 — 0xc1ba4 가 **우리 투수**를 본다 (0xc1ce2)
  progress = judgeAutoPitcherChange(progress, true, random)
  const { options } = progress
  const play = playQuickAtBat(
    entryQuickBatterOf(progress, options.opponentTeamId, progress.opponentOrderIndex),
    entryQuickPitcherOf(progress, options.ourTeamId, progress.ourPitcherIndex),
    { inning: progress.game.inning },
    random,
  )
  return startDefensiveAtBat(
    {
      ...progress,
      pitcherJustChanged: false,
      stamina: drainQuickPitcher(
        progress.stamina,
        ourPitcherStats(progress).stamina,
        ourTeamMoraleOf(progress.options),
        progress.ourUsedPitchers.length === 0,
        play.pitches,
      ),
    },
    play.outcome,
    false,
    random,
  )
}

/** 상대 투수의 체력 능력치 (칸 3) — 스태미나 용량 X 의 바탕 */
function opponentPitcherStaminaAbility(progress: TeamGameProgress): number {
  return pitcherAbilitiesAt(
    progress,
    progress.options.opponentTeamId,
    progress.opponentPitcherIndex,
  )[3]
}

/**
 * 실점 카운터 A·B 와 투구 수를 올린다 (P7 E1).
 * A(`+0x284`)는 **이닝 교대(0xa5b00)에서 0** 이 되고, B(`+0x280`)는 투수 교체 때만 0 이 된다.
 */
function addRunsToCounters(
  counters: MoundPitcherCounters,
  runs: number,
  pitches: number,
  halfChanged: boolean,
): MoundPitcherCounters {
  return {
    runsAllowed: Math.min(99, counters.runsAllowed + runs),
    inningRunsAllowed: halfChanged ? 0 : Math.min(99, counters.inningRunsAllowed + runs),
    pitches: counters.pitches + pitches,
  }
}

function appendLog(progress: TeamGameProgress, text: string, isMine: boolean): TeamGameProgress {
  const entry: TeamGameLogEntry = { id: progress.nextLogId, text, isMine }
  return {
    ...progress,
    log: [entry, ...progress.log].slice(0, MAXIMUM_LOG_LENGTH),
    nextLogId: progress.nextLogId + 1,
  }
}

/* ── 경기 뒤 ─────────────────────────────────────────────────────────────────── */

export interface TeamGameSummary {
  readonly result: ReturnType<typeof resultOf>
  readonly won: boolean
  readonly ourScore: number
  readonly opponentScore: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 치른 이닝 (1-기준) */
  readonly inningsPlayed: number
  readonly pitching: TeamPitchingLine
  /** 리그 선수 기록표에 그대로 넣는다 (`recordLeaguePlateAppearances`) */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 시즌 평가 `evaluateSeasonGame` 에 그대로 넘기는 두 칸 (인기도·평판이 서로 다른 이닝 칸을 본다) */
  readonly popularityCompleteGame: CompleteGameKind
  readonly reputationCompleteGame: CompleteGameKind
  /**
   * 시즌 평판 평가 16칸 (`SR+0x1a0..0x1af`) — 부르는 쪽이 `evaluateSeasonGame` **앞에서**
   * `record.gameRecord` 에 꽂는다. 시즌(모드 2)이 아니면 전부 0 이다 (게이트 `0xa755c`).
   */
  readonly gameRecord: readonly number[]
}

export function summaryOf(progress: TeamGameProgress): TeamGameSummary {
  const game = progress.game
  const flags: CompleteGameFlags = {
    allowedBaserunner: progress.pitching.allowedBaserunner,
    allowedHit: progress.pitching.hitsAllowed > 0,
    allowedRun: progress.pitching.runsAllowed > 0,
  }
  const outs = progress.pitching.outsRecorded
  return {
    result: resultOf(game),
    won: game.ourScore > game.opponentScore,
    ourScore: game.ourScore,
    opponentScore: game.opponentScore,
    ourTeamId: progress.options.ourTeamId,
    opponentTeamId: progress.options.opponentTeamId,
    inningsPlayed: game.inning,
    pitching: progress.pitching,
    leaguePlateAppearances: progress.leaguePlateAppearances,
    // ⚠️ 원본 그대로 — 인기도는 `st+0x6b`(현재 이닝), 평판은 `st+0x69`(정규 마지막 이닝)를 본다.
    //    그래서 **연장 완투는 인기도만 보너스를 받는다** (P4 "원본 버그·이상" 3번)
    popularityCompleteGame: popularityCompleteGameOf(outs, game.inning - 1, flags),
    reputationCompleteGame: reputationCompleteGameOf(outs, REGULATION_LAST_INNING_INDEX, flags),
    gameRecord: progress.gameRecord,
  }
}

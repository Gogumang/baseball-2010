import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { describeOutcome, isHit } from '@/entities/at-bat/model/atBatOutcome'
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
import { applyOpponentAtBat } from '@/features/play-pitcher-game/model/pitcherGameState'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { defenseAbilitiesOf, isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats'
import {
  popularityCompleteGameOf,
  reputationCompleteGameOf,
} from '@/entities/season-mode/model/seasonEvaluation'
import type { CompleteGameFlags } from '@/entities/season-mode/model/seasonEvaluation'
import type { CompleteGameKind } from '@/entities/season-mode/model/seasonReputation'
import { createBurstSession, resolveBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstResolution, BurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { pitchAgainstBatter } from '@/entities/pitching/model/simulateBatter'
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
  entryBatterGameAbilities,
  entryPitcherGameAbilities,
  NO_ACE_BATTER,
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
   * 리그 날짜 카운터 g (`리그+0x32` = `시즌+0xb2` = 시즌 레코드의 `games`) — **모드 2 에서만** 본다.
   * 시즌모드 경기 직전 화면 `0x6548` 이 `0xb8c80` 으로 양 팀 4인 로테이션을 한 칸 돌리는 자리다
   * (R13 4절). 안 넘기면 0 = 시즌 첫 경기라 두 팀 모두 로스터 0번이 선발이다.
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
  readonly walksAllowed: number
  readonly runsAllowed: number
  /**
   * `state+0x88` 출루 허용.
   * ⚠️ 원본은 이 칸을 **주자 목록의 마지막 원소만** 보고 세워서 야수선택이 퍼펙트를 안 깬다
   * (CORRECTIONS 2-1, S5 확정). 웹판에는 야수선택이 없어 차이가 드러나지 않으므로
   * 안타·볼넷이면 세우는 것으로 둔다 (**근사**).
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
    // 내 팀 보정 셋(질병·보직·사기)은 시즌모드에서만 붙는다 (0xb581a)
    seasonTeamId: options.mode === TEAM_GAME_MODE.시즌 ? options.ourTeamId : -1,
    season: options.season,
    teamAbilities: options.teamAbilities,
    lineup: options.lineup,
  }
}

/**
 * 한 팀의 **명단** — 양 팀 모두 대타로 바뀔 수 있어 진행 상태가 들고 있다
 * (우리 쪽은 `#` 대타 `0xaf06c`, 상대 쪽은 CPU 대타 `0xac228`).
 */
function entryBattersOf(progress: TeamGameProgress, teamId: number): readonly TeamEntryBatter[] {
  return teamId === progress.options.ourTeamId ? progress.ourEntry : progress.opponentEntry
}

/** 타순 칸 기록에 타석 하나를 얹는다 (`0xa8024`) */
function withPlateAppearance(
  records: readonly BatterGameRecord[],
  slot: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): readonly BatterGameRecord[] {
  const next = [...records]
  next[slot] = recordPlateAppearance(next[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: isHit(outcome),
    runsBattedIn,
  })
  return next
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
  const atBat = applyPitchResolution(progress.atBat, detail.resolution)
  const outcome = atBat.outcome
  if (outcome === null) return { ...progress, atBat }
  return applyOutcome({ ...progress, atBat }, outcome, random, options)
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
 * 삼진·볼넷·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다.
 */
export function startBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  if (progress.game.isFinished) return progress
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

  const next: TeamGameProgress = {
    ...progress,
    game,
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
    leaguePlateAppearances: [
      ...progress.leaguePlateAppearances,
      { teamId: progress.options.ourTeamId, battingOrderIndex: slot, outcome, runsBattedIn },
    ],
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

  const batter = entryStageAbilityOf(progress, options.opponentTeamId, progress.opponentOrderIndex)
  const resolution = pitchAgainstBatter(pitch, batter, random, {
    control: fatigued.control,
    velocity: fatigued.velocity,
  })

  // 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  const stamina = drainStamina({
    stamina: progress.stamina,
    typeNumber: input.typeNumber,
    staminaAbility: stats.stamina,
    teamMorale: options.season?.morale ?? 100,
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

  const started = startDefensiveAtBat(afterPitch, outcome, true, random)
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
  const walk = outcome.kind === '볼넷'
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
    opponentEntryRecords: withPlateAppearance(
      progress.opponentEntryRecords,
      slot,
      outcome,
      applied.runsScored,
    ),
    leaguePlateAppearances: [
      ...progress.leaguePlateAppearances,
      {
        teamId: progress.options.opponentTeamId,
        battingOrderIndex: slot,
        outcome,
        runsBattedIn: applied.runsScored,
      },
    ],
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
 *      (원본은 타순별 경기 기록 24바이트도 같이 옮기고 당긴다 — 웹 `leaguePlateAppearances` 는
 *      타순 칸으로만 쌓아서 옮길 것이 없다.)
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
  )
  if (swapped === null) return progress

  return appendLog(
    {
      ...progress,
      ourEntry: swapped.entry,
      ourEntryRecords: swapped.records,
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
): {
  readonly entry: readonly TeamEntryBatter[]
  readonly records: readonly BatterGameRecord[]
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
  // 3. 빠진 선수를 명단에서 지운다
  entry.splice(benchIndex, 1)
  records.splice(benchIndex, 1)

  return { entry, records, outgoing, incoming }
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

  const swapped = substituteBatter(entry, records, slot, BATTING_ORDER_SIZE + benchIndex)
  if (swapped === null) return progress

  const changed: TeamGameProgress = battingIsOurs
    ? {
        ...progress,
        ourEntry: swapped.entry,
        ourEntryRecords: swapped.records,
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
      leaguePlateAppearances: [
        ...progress.leaguePlateAppearances,
        { teamId: options.ourTeamId, battingOrderIndex: slot, outcome, runsBattedIn },
      ],
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
        progress.options.season?.morale ?? 100,
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
  }
}

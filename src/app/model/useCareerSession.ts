import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import { isBugFixed } from '@/shared/config/bugfixes'
import { clearsPitchJudgement } from '@/features/defense-play/model/pitchArrivalPlay'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { batterCollectorHiddenIdsOf } from '@/entities/collection/model/collection'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameEvaluationScreenData, Screen } from '@/app/model/screen'
import { NARI_STATE, playEndingContinueBgm, restartsManagementBgmFrom } from '@/app/model/screenBgm'
import { EMPTY_STORY_CARRY, matchResultEventOf } from '@/entities/story/model/aceMatch'
import { createMemoryAceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { AceMatchHoldPort, AceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import { isAutoScanHeldByAceMatch } from '@/app/model/aceMatchScanGuard'
import { atBatEndFramesOf } from '@/app/model/useAtBatRunner'
import { RESULT_WAIT_TICKS_AT_BAT_END } from '@/pages/game/lib/batterRecordAlert'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { applyPitchResolution, isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { arrivePitch, contactDefensePlayInputOf, cpuPickoff, enterBenchClearing, judgeHitByPitch, recordDrawnFieldingErrors, recordMyBuntAttempt, resolveBenchClearing, resolveDefensePlay, resolveRunnerPlay, spendMySpecialSwing, startGame, startPlayerFoulPlay, startPlayerOutcome, stageOpponentPitcherAbilityOf, startSteal, summaryOf, throwOpponentPitch, withGameTeamMorale } from '@/features/play-game/model/gameFlow'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { GameAutoRelay, GameProgress } from '@/features/play-game/model/gameFlow'
import { BATTER_PITCH_RESULT_ENTRY_TICKS, playSoundIdsAfterSceneTicks } from '@/features/play-game/model/sceneTickSounds'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { replayCallsOnScreen } from '@/features/defense-play/model/judgeCall'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { contactOutcomeOfDetail } from '@/features/play-at-bat/model/resolvePitch'
import { preRollContactMessage } from '@/features/defense-play/model/runDefensePlay'
import type { PitchArrivalStep } from '@/features/play-game/model/gameFlow'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { EMPTY_AT_BAT_PITCH_TALLY, tallyPitch } from '@/features/play-at-bat/model/atBatPitchTally'
import type { AtBatPitchTally } from '@/features/play-at-bat/model/atBatPitchTally'
import { deepHitCheerSoundIdOf, inPlayCallSoundIdOf, pitchCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import {
  GAME_INTRO_SOUND,
  gameResultSoundIdOf,
  gameStepSoundIdsOf,
} from '@/features/play-game/model/gameSounds'
import { playSoundIds } from '@/app/model/useSound'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import {
  applyGameResult,
  applyLeagueDay,
  applyPostseasonCpuGames,
  leagueGamePitchersOf,
  nextOpponentOf,
  applySeasonEnd,
  createCareer,
  gainMorale,
  gainPopularity,
  gainReputation,
  gamePointRewardOf,
  spendCycleAction,
  isManagementCycleOpen,
  isSeasonFinished,
  startNextSeason,
  withNariSceneSetupOutings,
  gainGamePoint,
  countGameForSkills,
  MAXIMUM_GAME_POINT,
  nariLastGameOf,
  nariRecordLineOf,
} from '@/entities/career/model/playerCareer'
import {
  applyKoreanSeriesReward,
  applyRegularSeasonReward,
  entersYearEndChainInPostseason,
  popupAfterChampion,
  regularSeasonPopupOnEnter,
  REGULAR_SEASON_HIDDEN_ID,
  regularSeasonOpenedHiddenIds,
} from '@/entities/career/model/postseasonFlow'
import type { RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import { applyBurstRewards } from '@/entities/career/model/burstReward'
import { nariMoraleOf, nariTeamRecordMoraleOf, withNariGameMorale, withNariTeamRecordMorales } from '@/entities/career/model/nariMorale'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { selectSpecialSwingNumber, setSkillEquipped } from '@/entities/career/model/playerCareer'
import { expandSkillSlots } from '@/entities/career/model/skillEquip'
import {
  awardTitles, equipTitle, gameResultTitleOf, nationalCupStandingsTitleOf, nextTitleOf,
} from '@/entities/career/model/titles'
import { blockReasonOf, runTraining, specialSwingCostOf } from '@/entities/career/model/training'
import { restResultTextOf, trainingBlockTextOf, trainingOutcomeLinesOf } from '@/entities/career/model/trainingText'
import { BATTING_TYPE_NAMES } from '@/pages/management/lib/basicInfoLayout'
import {
  actedAfterOutingMapCancel,
  outingBlockReasonOf,
  outingBlockTextOf,
  performOuting,
  recoverAfterRest,
  restBlockReasonOf,
  runRest,
} from '@/entities/career/model/outing'
import type { OutingPresentation, OutingResult } from '@/entities/career/model/outing'
import {
  EVENT_TRIGGER,
  finishEvent,
  NARI_YEAR_START_EVENT,
  NARI_YEAR_START_EVENT_ID,
  nextEventFor,
  placeTriggerOf,
} from '@/entities/story/model/storyScene'
import { EMPTY_OUTING_PLACE_SLOTS, outingPlaceSlotsOf, outingSlotPlaceIdsOf } from '@/pages/outing-map/lib/outingPlaceSlots'
import { selectShopItem } from '@/features/shop/model/shopSelection'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import {
  BATTER_LEAGUE_MODE, leagueUsageOf, skillEquipStatEventsOf,
} from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { lapPlayClock, startPlayClock } from '@/entities/collection/model/playClock'
import { EVENT_REWARD_KIND } from '@/entities/story/model/eventReward'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import { hiddenOpenNoticeTextOf } from '@/entities/collection/model/hiddenOpenNotice'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { useStorySchedule } from '@/app/model/useStorySchedule'
import { withGameSkillCounters } from '@/entities/story/model/skillCondition'
import { enterSeasonEvent, nextSeasonStep, resumePointOf } from '@/app/model/seasonEvents'
import {
  nariMatchCancelTargetOf, rollNariMatchAces, rollNariMatchInfoStage,
} from '@/pages/management/lib/nariMatchPrepare'
import type { NariGameMatch, NariGameSavePort, NariMatchAces, NariOpenedAces } from '@/pages/management/lib/nariMatchPrepare'
import { DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS } from '@/pages/general-mode/lib/generalModeSetup'
import {
  achievedGoalCount,
  applyEndingBonus,
  canContinueAfterEnding,
  CONTINUE_COST_GAME_POINT,
  endingBonusOf,
  continueAfterEnding,
  continueAfterEndingPayment,
  INJURY_ENDING_INDEX,
  GOAL_INTRO_EVENT_ID,
  INJURY_ENDING_EVENT_ID,
  judgeEnding,
  MID_SEASON_GAME,
  NO_ENDING_JUDGEMENT,
  savedCareerOf,
  midSeasonEventId,
  midSeasonTitlesOf,
  yearEndEventId,
} from '@/entities/career/model/seasonFlow'
import {
  forgetRepeatableEvents,
  markRewardedEvent,
  withOutingEventActed,
  nariSeasonEndStateOfResumeCode,
  rewardItemsResumeCodeOf,
  rewardResumePatchOf,
} from '@/entities/story/model/storyScene'
import { battingOrderEventId, emptyPlaceEventId, emptyPlaceFrameOf, isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { applyEventRewards } from '@/entities/story/model/eventReward'
import { effectiveAbilityOf, INJURY_FOLLOW_UP_NOTICE, rollTrainingInjury } from '@/entities/career/model/condition'
import type { ManagementDetail } from '@/app/model/managementDetail'
import { restDetailChangesOf, trainingDetailChangesOf } from '@/pages/management/lib/detailPopup'
import { advanceStreaks, evaluateGame, managerCommentIndexOf, streakEventOf } from '@/entities/career/model/gameEvaluation'
import type { GameEvaluation } from '@/entities/career/model/gameEvaluation'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { ManagementCommand } from '@/pages/management/ui/ManagementScreen'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import type { TeamRecordEquipment } from '@/entities/team/model/teamRoster'
import { nariTeamRecordEquipmentOf } from '@/entities/career/model/nariCpuEquipment'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { nariSceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import { KOREA_TEAM_ID, createNationalCup, nationalCupMatchupOf, nationalCupSideOf } from '@/entities/national-cup/model/nationalCup'
import {
  createNariCupTeams,
  nariCupBattingOrderOf,
  nariCupRecordOf,
  nextNariCupDayTeams,
  prepareNariCupMatch,
  recordNariCupGame,
} from '@/entities/career/model/nariCupTeams'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import { nariCupGameResultOf, settleNariCupGame } from '@/entities/career/model/nariCupGame'
import { liveGameSidesOf, resetLiveGameState, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { advanceNationalCupDay } from '@/entities/national-cup/model/nationalCupPlay'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { GamePitcherSetup } from '@/features/play-game/model/gameFlow'
import type { GameAceSetup } from '@/features/play-game/model/gameAces'
import {
  careerNationalCupRewardItems,
  careerNationalTeamEventId,
  isCareerNationalCupYear,
  NATIONAL_CUP_EVENT,
} from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import { leagueDayCounterOf, leagueGamePlayerSideOf } from '@/entities/career/model/leagueGameSetup'
import {
  applyBattingOrderRewards,
  nariQuickLineupOf,
  nariTeamRecordOf,
  nariTeamsOf,
  recordMatchAcesOf,
  recordTeamAcesOf,
  renumberedBattingOrderOf,
  seatNariMatchAces,
} from '@/entities/career/model/nariTeamRecord'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import {
  batterNariEntryViewOf, pointNariEntryCursor, pressNariEntryKey,
} from '@/pages/management/lib/nariEntryView'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'

/**
 * **경기 뒤 평가 창의 좋음·보통·나쁨 징글** (36 · 37 · 38).
 *
 * 나만의리그 상태 116(경기 뒤 평가) 안 `0x12c96~0x12cc6` — 디스어셈 재확인:
 * ```
 * 00012c96: ldr r3,[r4] ; adds r3,#0x4a ; ldrsb r0,[r3,r0]  ; p = (s8)레코드[+0x4a]
 * 00012c9e: cmp r0,#0 ; bge 0x12cb2
 * 00012ca4: movs r1,#0x26        ; p < 0      → 38
 * 00012cb6: cmp r0,#1 ; bgt 0x12cc0
 * 00012cbc: movs r1,#0x25        ; 0 ≤ p ≤ 1 → 37
 * 00012cc2: movs r1,#0x24        ; p > 1     → 36
 * ```
 * 시즌모드 쪽(0xdea0 = 0x105 상태 0xe9, 경기 뒤 관중·수입 창)은 같은 모양인데 문턱만 **3** 이다
 * (0xdece `cmp r3,#3`). 이 세션은 **나만의리그 타자편**(모드 4 · 장면 0x106)이라 문턱 1 을 쓴다.
 *
 * 레코드 `+0x4a` = **직전 경기 인기도 변화 p** 로 확정돼 있다 (A 0절 "+0x4a s8: 지난 경기
 * 인기도 변화 (0xa68ca 가 쓴다) 확정" · P1 5-2 정정). 웹 값은 `evaluation.popularityChange` 다.
 *
 * 우는 때는 116 진입이다 — 경기 결과(경기 장면 0x104 의 0x18 · 0x19)와 평가(나리 장면 0x106 의 116)가 따로 서는 원본처럼 웹도
 * 두 화면이라(r287) 승패 징글 31 · 32 는 정산 0x19 진입, 평가 징글은 정산 판을 나가 116 이 선 그 틀에 낸다(`enterGameEvaluationScreen`).
 */
const MY_LEAGUE_EVALUATION_THRESHOLD = 1
function evaluationJingleIdOf(popularityChange: number): number {
  if (popularityChange < 0) return 38
  return popularityChange > MY_LEAGUE_EVALUATION_THRESHOLD ? 36 : 37
}

/** 옛 저장의 컬렉터 해금을 보유에서 다시 센다 — 이미 있으면 그대로 */
function withBatterCollectorIds(career: PlayerCareer | null): PlayerCareer | null {
  if (career === null) return null
  const missing = batterCollectorHiddenIdsOf(career).filter((id) => !career.openedHiddenIds.includes(id))
  return missing.length === 0 ? career : { ...career, openedHiddenIds: [...career.openedHiddenIds, ...missing] }
}

/**
 * 저장의 국가대항전 대회 레코드 두 칸 — 없으면(대회 중 옛 저장) 대회 초기화 꼴로 세운다 (`createNariCupTeams`)
 */
function cupTeamsOf(career: PlayerCareer, opponentTeamId: number): NariCupTeams {
  return career.nariCupTeams ?? createNariCupTeams(renumberedBattingOrderOf(career) - 1, opponentTeamId)
}

/**
 * 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 세운 대회와 대표팀 칸(+0xbc4 대표팀 · +0xbe0 첫날 상대 · 0xb53f1 내 칸)을 들고
 * S+0x50 = 3(웹 null) · S+0x12c = 1. 보상 명령 뒤(0x8cca2)와 재생 끝(`continueSeason`) 둘 다 이 꼴이다 — 대회 · 칸은 굴림 없이
 * 서므로 두 번 세워도 같은 값이다. 칭호 8 은 134 첫 틀(0x1b92c 머리) 몫이라 여기 없다.
 */
function withNationalCupEntered(career: PlayerCareer): PlayerCareer {
  const cup = createNationalCup()
  return {
    ...career,
    seasonEndState: null,
    nationalCup: cup,
    nariCupTeams: createNariCupTeams(renumberedBattingOrderOf(career) - 1, nationalCupMatchupOf(cup)?.opponent ?? KOREA_TEAM_ID),
  }
}

/**
 * 보상 명령 뒤 이어하기 자리 — 0x8c460 끝 8cc2e(나리 갈래, 모드 4 라 393~396 은 0xc) → 8cd44 저장 (`rewardResumePatchOf`).
 * 463 은 S+0x12c = 1(대회 진행 중)이라 웹은 대회를 이 자리에서 세운다. 464 는 S+0x50 = 0x11 · S+0x12c = 0 — 웹은 464 앞에
 * 대회를 세우지 않으므로(463 만 세운다) 0 은 이미 그 값이다.
 * 그 앞, 줄을 도는 동안 보상 20(연봉)은 8cb90 에서 S+0x50 = 0xa 를 쓴다(`rewardItemsResumeCodeOf` — 웹 133).
 */
function withRewardResumePatch(career: PlayerCareer, eventId: number, items: readonly EventReward[]): PlayerCareer {
  const itemsCode = rewardItemsResumeCodeOf(items)
  const itemsState = itemsCode === null ? undefined : nariSeasonEndStateOfResumeCode(itemsCode)
  const salaried = itemsState === undefined || career.seasonEndState === itemsState ? career : { ...career, seasonEndState: itemsState }
  const patch = rewardResumePatchOf(eventId, '나리타자')
  if (patch === null) return salaried
  if (patch.nationalCup === true) return withNationalCupEntered(salaried)
  const state = nariSeasonEndStateOfResumeCode(patch.resumeCode)
  return salaried.seasonEndState === state ? salaried : { ...salaried, seasonEndState: state }
}

/**
 * **나간 마선수 대결의 결과 이벤트** — 105 진입 곁가지 0x11b46~0x11b6a: 전역 g[0x11f] 가 서 있고 모드가 4(타자편)면 현재를
 * 112(0x70)로 · 0x7e84d(그림, 0x70) · 0x118e4 · 다음 140(11b94~11bbe). 140 진입 0x10df8 이 결과 바이트 g[0x144](SYS 8 이 적은 0 이
 * 남았다 = 짐)로 resultEvents[1] 을 0x8bdc9 로 튼다 · [다음 114, 뒤 105]. 대기가 없으면 null.
 * 대기는 전역기록이라 그 대결을 연 선수가 아니어도(지우고 새로 만든 선수) 그 편 105 에 들어오면 뜬다 — 원본 그대로다.
 */
function pendingAceMatchScreenOf(port: AceMatchPendingPort): Screen | null {
  const resultEvents = port.read()
  if (resultEvents === null) return null
  // 140 진입 0x10e40 — 결과 바이트 g[0x144](SYS 8 이 0, 대기 중 미션 정산 0x4ea0c 가 덮어쓴다)로 resultEvents[이김 ? 0 : 1]
  return { kind: '이벤트', eventId: matchResultEventOf(resultEvents, port.isWon()), context: '대결결과', carried: EMPTY_STORY_CARRY }
}

/** 타자 스킬 22 압도 — 상대 투수 투구 스태미나 소모 ×2 (0xa5f0e) */
const INTIMIDATE_SKILL_ID = 22

/** 세션 타석의 볼카운트 — 진행기 0xf 진입(`AtBatCount`)에 넘긴다 */
const countOf = (atBat: AtBatState) => ({ strikes: atBat.strikes, balls: atBat.balls })

interface CareerSessionInput {
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly saveGame: SaveGamePort
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  /**
   * 소리 통로 (원본 사운드 객체 `[0x1400058]`). 안 넘기면 아무 소리도 안 난다 —
   * 테스트는 그대로 두면 된다.
   */
  readonly sound?: SoundPort
  /**
   * 전역 G 지갑 (원본 `mgr[+0x64]`). 넘기면 **G의 주인이 지갑**이 되고 커리어 칸은 따라간다.
   * 안 넘기면 예전처럼 커리어 칸 하나로만 돈다 — 테스트는 그대로 두면 된다.
   */
  readonly wallet?: GamePointWalletSession
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 레코드 +0xbd). 안 넘기면 자동이다 —
   * 테스트는 그대로 두면 된다.
   *
   * 갈림길은 `0xae690` — `(경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)` 이 거짓이면
   * 자동 진루 제어기(`0xaf8c0`)를 통째로 안 돌린다. 나만의리그 타자편은 사람이 늘 공격이라
   * 앞 항이 늘 거짓 → **설정이 그대로 먹는다.**
   */
  readonly runningModeManual?: boolean
  /**
   * 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 (GP 아이템 0x22e35 · G 사용처 0x22c29 · 획득 GP 0x22c7d · 켠 스킬 0xb663c).
   * 안 넘기면 아무것도 안 쌓는다 — 테스트는 그대로 두면 된다.
   */
  readonly recordStat?: (event: AnnalsStatEvent) => void
  /**
   * 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` (`useAceLevels().levels`). 같은 날 CPU 끼리 경기(0xc2a48)·포스트시즌
   * CPU 경기(0xc2760)의 마선수 능력치 배율(0xd88aa)이 이 칸을 본다. 안 넘기면 Lv1(60%) — 테스트는 그대로 두면 된다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 정규시즌 우승 팝업 0xb 닫힘(0x15b84~0x15c52)의 0x29 "오토봇 배트" 검사가 적재해 읽는 다른 두 저장 — 나리 투수편 저장
   * +0x7a · 시즌모드 시즌 기록 +0x7a · 전역 해금표 `app+0xc0`. 팝업을 닫을 때 읽는다. 안 넘기면 검사를 건너뛴다.
   */
  readonly readRegularSeasonOtherModes?: () => RegularSeasonOtherModes | undefined
  /** 공용 창에 히든 오픈 알림 (0x62368 → 0x74ef5) — 새로 연 k 만 넘긴다. 정규시즌 우승 팝업 0xb 닫힘이 쓴다 */
  readonly announceHiddenOpen?: (ids: readonly number[]) => void
  /**
   * 열린 마선수 로컬 번호 (전역 저장 +0x30.. 마투수 · +0x35.. 마타자, `useAceOpen`). 142 진입 0x1c46c 가 여기서
   * 내 팀 마선수를 굴린다(0x9f604 · 0x9f650). 안 넘기면 기본 개방 둘(마투수 0 · 마타자 0)이다.
   */
  readonly openedAces?: NariOpenedAces
  /**
   * 전역기록 +0x50(모드 4 "타자편 경기 중간 저장됨") 칸 — 142 확인이 세우고 등록·정산·지우기가 내린다(`entities/mode-save`).
   * 안 넘기면 아무 데도 안 쓴다.
   */
  readonly nariGameSave?: NariGameSavePort
  /**
   * 나간 마선수 대결 대기 칸 — 원본 **전역기록** g[0xec] · g[0xee] · g[0x11f] · g[0x144](타자편, `entities/mode-save`
   * `withAceMatchHeld`). 선수를 새로 만들어도 남는다. 안 넘기면 세션 메모리에만 든다.
   */
  readonly aceMatchPending?: AceMatchPendingPort
  /**
   * 두 편의 대결 대기 칸 g[0x11f] · g[0x176] (전역기록) — 자동 훑기 0x1cf9c 의 가드(1cfe4~1d008)가 모드를 안 보고 둘 다 본다
   * (`isAutoScanHeldByAceMatch`, B-124). 안 넘기면 가드가 없다.
   */
  readonly aceMatchHold?: AceMatchHoldPort
  /**
   * 화면이 '관리' 인 채 105 에 다시 들어온 앞 상태가 0x1aec4 의 배경음 4 목록에 들 때(125 훈련 결과 → 105) 부른다 — 배경음 표
   * `useScreenBgm` 의 다시 틀기(`restartsManagementBgmFrom`). 앱이 세션보다 먼저 배경음 표를 세우므로 수를 앱이 든다
   */
  readonly onManagementBgmRestart?: () => void
}

const NO_STAT = () => {}
const NO_BGM_RESTART = () => {}

/**
 * 여기서 '관리' 로 돌아오는 것은 105 진입이 아니다 — 111 상점 취소는 110 · 121 장비착용 취소는 106 하위 메뉴로 선다
 * (`nariReturnSubMenuOf`).
 */
const NOT_MANAGEMENT_ENTRY_FROM: ReadonlySet<Screen['kind']> = new Set<Screen['kind']>(['아이템'])

/** 처음부터 열린 마선수 — 저장 +0x30 · +0x35 (`normalizeAceOpenSave` 가 늘 켠다) */
const DEFAULT_NARI_OPENED_ACES: NariOpenedAces = {
  pitcherIds: DEFAULT_OPENED_ACE_PITCHER_IDS,
  batterIds: DEFAULT_OPENED_ACE_BATTER_IDS,
}

/**
 * **경기 뒤 평가 0xa719c 는 정규시즌 경기만 탄다** (모드 4 도 투수편과 같은 갈래, 6921426).
 *
 * 유일한 호출지 0x4ea0c 안 0x4f274 앞에서 0x4f216 이 L+0xac(국가대항전)면, 0x4f268 이 L+0x34(포스트시즌)면
 * 0x4f29a(하루 끝)로 건너뛴다. 이 갈래에는 모드 갈림이 없다. 국가대항전 경기는 웹도 `finishCupGame` 이 커리어 정산을
 * 아예 안 타므로 남는 것은 포스트시즌이다. 포스트시즌 표시는 45번째 경기의 하루 끝(0xb818c → 0xb80a8)에야 서므로
 * **경기 전 커리어**로 가른다 — 45번째 경기는 평가된다.
 */
export function isEvaluatedGame(careerBeforeGame: Pick<PlayerCareer, 'postseason'>): boolean {
  return careerBeforeGame.postseason === null
}

/** 평가 변화 없음 — 포스트시즌 경기는 0xa719c 를 안 타 인기도 · 평판 · 사기가 그대로다 (B-73 고친 길의 116 숫자) */
const NO_EVALUATION_CHANGE = { popularityChange: 0, reputationChange: 0, moraleChange: 0 } as const

/**
 * 116 이 보일 평가 숫자와 기록 줄 — S+0x4a · +0x64 · +7 · S+0x1d8 은 평가 0xa719c(정규시즌만 — 0x4f268 `ldrb L+0x34 ; bne 0x4f29a`)가 쓴다.
 * ⚠️ 원본 버그(B-73): 포스트시즌 경기 뒤 116 은 **앞 정규 경기의** 평가 숫자 · 기록 줄(타수 안타 타점 홈런) · 칭호 39 판정을 다시 보인다.
 * 옛 저장에 앞 값이 없으면 이 경기 값.
 * **고침(`bugfixes.json` B-73, 기본 켬)**: 기록 줄은 이 경기 값, 평가 숫자는 실제로 안 바뀌었으므로 0 (감독 글은 부르는 곳이 0 으로 다시 고른다).
 * 굴림 없음 — 다만 116 쪽 스킬 카운터(`countGameForSkills` +0x1c2 · 먹튀)가 0 을 세고 칭호 39 가 이 경기 홈런을 본다.
 */
export function shownGameEvaluationOf(
  isEvaluated: boolean,
  thisEvaluation: GameEvaluation,
  previous: PlayerCareer['lastGame'],
  stats: Parameters<typeof nariRecordLineOf>[0],
): { readonly evaluation: GameEvaluation; readonly recordLine: ReturnType<typeof nariRecordLineOf> } {
  if (isEvaluated) return { evaluation: thisEvaluation, recordLine: nariRecordLineOf(stats) }
  if (isBugFixed('B-73')) return { evaluation: { ...thisEvaluation, ...NO_EVALUATION_CHANGE }, recordLine: nariRecordLineOf(stats) }
  if (previous === undefined) return { evaluation: thisEvaluation, recordLine: nariRecordLineOf(stats) }
  return { evaluation: previous.evaluation, recordLine: previous.recordLine ?? nariRecordLineOf(previous.summary.stats) }
}

/** 평가(인기도 → 평판 → 사기, 0xa719c)를 얹는다 — 평가하지 않는 경기면 그대로 */
export function applyGameEvaluation(
  career: PlayerCareer,
  evaluation: Pick<GameEvaluation, 'popularityChange' | 'reputationChange' | 'moraleChange'>,
  isEvaluated: boolean,
): PlayerCareer {
  if (!isEvaluated) return career
  return gainMorale(
    gainReputation(gainPopularity(career, evaluation.popularityChange), evaluation.reputationChange),
    evaluation.moraleChange,
  )
}

/** 육성 모드 한 판 — 커리어·경기 진행·관리 커맨드를 한데 묶는다. */
export function useCareerSession({
  runner,
  random,
  saveGame,
  screen,
  setScreen,
  sound,
  wallet,
  runningModeManual = false,
  recordStat = NO_STAT,
  aceLevels,
  readRegularSeasonOtherModes,
  announceHiddenOpen,
  openedAces = DEFAULT_NARI_OPENED_ACES,
  nariGameSave,
  aceMatchPending,
  aceMatchHold,
  onManagementBgmRestart = NO_BGM_RESTART,
}: CareerSessionInput) {
  // 통로를 안 받으면 조용한 포트로 — 아래 자리들이 `sound` 가 있는지 매번 보지 않게 한다
  const silent = useMemo(() => createSilentSound(), [])
  const audio = sound ?? silent
  // 컬렉터 해금(36·40·44·48)은 구매 확정 0x14a74 가 전역 표에 켜 둔 것이다 — 그보다 앞서 산 옛 저장은 칸이 비어 있을 수 있어
  // 보유에서 다시 센다(`batterCollectorHiddenIdsOf`). `isHiddenOpen` 은 이 표만 본다
  const [savedCareer, setSavedCareer] = useState<PlayerCareer | null>(() => withBatterCollectorIds(saveGame.load()))
  const [rawCareer, setCareer] = useState<PlayerCareer | null>(null)
  /**
   * 커리어가 내보이는 G 는 **지갑 값**이다 (원본 `mgr[+0x64]` 한 칸). 상점·관리 화면·상태 막대가
   * 다 이 `career.gamePoint` 를 읽으므로, 여기서 한 번 갈아 끼우면 화면과 판정이 같은 값을 본다.
   *
   * ⚠️ **테스트용** — `?무한G` 는 지갑 쪽에서 처리한다 (`useGamePointWallet`): `balance` 가 늘
   *    99999 이고 쓰기는 먹히지 않는다. 지갑을 안 받은 자리(테스트)는 예전처럼 여기서 올린다.
   *
   * ⚠️ **값이 같으면 `rawCareer` 를 그대로 돌려줘야 한다.** 새 객체를 매번 만들면 아래 저장 고리가
   *    `setSavedCareer` 로 다시 그리고, 그 그리기가 또 새 객체를 만들어 **무한히 돈다**.
   */
  const overriddenGamePoint = wallet?.balance ?? (isInfiniteGamePointOn() ? MAXIMUM_GAME_POINT : null)
  const career = useMemo(
    () =>
      rawCareer === null || overriddenGamePoint === null || rawCareer.gamePoint === overriddenGamePoint
        ? rawCareer
        : { ...rawCareer, gamePoint: overriddenGamePoint },
    [rawCareer, overriddenGamePoint],
  )

  const [progress, setProgress] = useState<GameProgress | null>(null)

  const [shopNotice, setShopNotice] = useState('')
  /**
   * 새 시즌 0x1b768 을 부른 앞 상태(134 대진판 · 141 엔딩)가 아직 그리는 아홉 틀 — 화면은 그대로 두고 그 위에 효과기만 칠한다
   * (`startNewSeason` 의 `holdsPrevious` · `YearCoverHoldLayer`). 끝나면 `enterHeldYearCover` 가 137 로 넘긴다
   */
  const [isYearCoverHeld, setYearCoverHeld] = useState(false)
  /** 상점 GP 결과 창 (0x872a1) — 칸 0~4·6 구매 뒤. 닫아도 굴림 없이 상점 그대로 (0x1d649) */
  const [shopGpDetail, setShopGpDetail] = useState<GpDetailOf<PlayerCareer> | null>(null)
  const [outingNotice, setOutingNotice] = useState('')
  /**
   * 새 선수 플래그 장면+0x165 — 100 진입 끝 0x1c3be~0x1c3f8 이 이전 상태가 104(등록)일 때만 켜고, 105 · 112 틀의 0x1cfa6 이 오프닝
   * 451 을 번호로 부르며 지운다(1cfd6~1cfd8). 저장에 없는 칸이라 이어하기로는 안 선다(투수편 `newPlayerRef` 와 같다, A-54)
   */
  const newPlayerRef = useRef(false)
  /**
   * 116 → 114 평가 이벤트의 보상 명령 — 이미 준 몫(`given`). 0x8c460 이 명령마다 주고 끝(0x8b0e4 · 0x8cd44)에서 저장하므로
   * 첫 몫을 줄 때 S+0x50 이 114 진입 값(3 · 0xb — 웹 null)으로 저장된다(Q-23). 116 에 들어설 때 비운다
   */
  const evaluationRewardsRef = useRef<{ readonly rewards: readonly EventReward[]; readonly given: number } | null>(null)
  /** 105 → 112 로 들어설 때의 행동함(S+4) — B-26 고친 길에서 지도 취소가 되돌릴 값. 지도 밖이면 null */
  const outingEntryActedRef = useRef<boolean | null>(null)
  /** 상태 126 결과 팝업 두 장 — 효과 글(0x15234)과 입원 회복 글(0x1575c). 효과 팝업이 떠 있지 않으면 null */
  const [outingResult, setOutingResult] = useState<OutingResult | null>(null)
  /**
   * 상태 126 연출 (진입 0x11da8 → 0x85074 · 그리기 0x16874) — 고른 기능과 장소 p([gfx+0x184] = 지도 프레임 − 1).
   * 연출이 끝난 틀(0x84e58)에 효과 0x15234 를 굴려 `outingResult` 를 띄우고, 효과 팝업이 닫힐 때까지 판(띠 · 검정)이 남는다.
   */
  const [outingPresentation, setOutingPresentation] = useState<OutingPresentation | null>(null)
  const [managementNotice, setManagementNotice] = useState('')
  /** 상세정보 결과 창 (0x8a0a4) — 닫을 때 훈련은 부상, 휴식은 회복을 굴린다 */
  const [managementDetail, setManagementDetail] = useState<ManagementDetail | null>(null)
  /** 경기 전 원작 로딩 화면에 띄울 팁. null 이면 로딩 중이 아니다. */
  const [loadingTip, setLoadingTip] = useState<string | null>(null)
  /**
   * 이 경기 장면의 하늘 줄 — 구장 +0x10 (0x783b0 모드 4 갈래: 나리 저장 +0xb2 = 리그 날짜 g mod 6, 굴림 없음). 경기를 세울 때 정하고
   * 타석 화면과 정산 결과 그림(0x4a384)이 같이 쓴다 (`stadiumSkyRowOf`)
   */
  const [stadiumSkyRow, setStadiumSkyRow] = useState(0)
  const stadiumSkyRowRef = useRef(0)
  /**
   * 이 경기 장면의 두 구장 객체 — 셋업 0x39fdc 모드 3·4 갈래(`nariSceneStadium`): 홈(측 1) 팀, 국가대항전이면 풀리그 2 · 결승 8.
   * 타석 펜스 프레임(+0x70)과 바닥 · 수비 바탕 팔레트 줄(+0xc). 정산 결과 그림도 같은 구장이다. 경기를 세우기 전엔 null
   */
  const [sceneStadium, setSceneStadium] = useState<SceneStadium | null>(null)
  /** 142 진입 0x1c46c 가 세운 무대로 0x5fd04 가 떠 둔 경기정보 바탕 (`rollNariMatchInfoStage`). 142 에 들어온 적이 없으면 null */
  const [matchInfoStage, setMatchInfoStage] = useState<MatchInfoStadiumState | null>(null)
  /** 142 진입 0x1c46c 가 이 장면에서 굴린 마선수 — 경기정보 마투수·마타자 줄이 읽는다 */
  const [matchAces, setMatchAces] = useState<NariMatchAces | null>(null)
  /** 143 경기 전 엔트리 보기 (진입 0x16af8 · 키 0x1457c) — 142 위에 선다. 없으면 null */
  const [entryView, setEntryView] = useState<NariEntryView | null>(null)
  /**
   * 장면+0x288 — 142 진입의 마선수 넣기를 **장면마다 한 번**만 하게 막는 칸 (1c566~1c572 · 1c668). 장면 셋업 0xfb7c 가
   * 0 으로 둔다 → 장면이 새로 서는 이어하기(`continueSaved`)와 경기 뒤(`finishGame`)에 내린다.
   */
  const matchPreparedRef = useRef(false)
  /** 반복 이벤트 본 표시 지우기 대기 — 장면 셋업 0xf684 의 `0xacf60` (이벤트 본문이 도착한 뒤에 지운다) */
  const [shouldForgetRepeatable, setShouldForgetRepeatable] = useState(false)
  /** 이벤트 일정 훅의 장면 셋업(커서 0 · mgr+0x304 = 1) — 일정 훅이 아래에서 서므로 ref 로 잇는다 */
  const storySceneSetUpRef = useRef<() => void>(() => {})
  /**
   * **나리 장면 0x106 이 새로 선다** — 셋업 0xf684 의 세 초기화: fb1c `0x8ce94` → `0xacf60`(반복 이벤트 본 표시 지움 · 커서
   * reader+0x28 = 0) · fb7a mgr+0x304 = 1 · 0xfb7c 장면+0x288 = 0. 장면은 이어하기(`continueSaved`)와 **경기 뒤마다**(`finishGame` ·
   * `finishCupGame` — 경기 장면 0x104 를 지나 0x106 이 다시 선다) · 마선수 대결 뒤 · 새 선수 등록에 선다.
   */
  const setUpNariScene = useCallback(() => {
    matchPreparedRef.current = false
    storySceneSetUpRef.current()
    setShouldForgetRepeatable(true)
    setSceneSetUpCount((count) => count + 1)
  }, [])
  /**
   * 셋업 0xf684 fb92~fba8 — 경기 수 == 2 면 외출 칸 +0x6a = 0. 셋업은 경기 뒤 커리어가 들어오기 전에 불리므로(경기 정산이 경기 수를
   * 올린 뒤의 장면이다) 그 커밋 뒤 렌더에서 지운다 (`withNariSceneSetupOutings`)
   */
  const [sceneSetUpCount, setSceneSetUpCount] = useState(0)
  /** B-84 고친 길 — 앞 셋업 때(이 세션에서 마지막으로 본) 경기 수. 2 로 막 오른 셋업만 지운다 */
  const lastSeenGamesRef = useRef<number | null>(null)
  useEffect(() => {
    if (sceneSetUpCount === 0) return
    const previousGames = lastSeenGamesRef.current
    setCareer((current) => (current === null ? current : withNariSceneSetupOutings(current, previousGames)))
  }, [sceneSetUpCount])
  useEffect(() => {
    lastSeenGamesRef.current = career?.gamesPlayed ?? null
  }, [career?.gamesPlayed])
  /** 전역기록 +0x50 손잡이 — 콜백 신원이 흔들리지 않게 ref 로 읽는다 */
  const nariGameSaveRef = useRef(nariGameSave)
  nariGameSaveRef.current = nariGameSave
  /** 나간 마선수 대결 대기(전역기록) 손잡이 — 안 넘기면 세션 메모리 */
  const memoryAceMatchPending = useMemo(() => createMemoryAceMatchPendingPort(), [])
  const aceMatchPendingRef = useRef(aceMatchPending ?? memoryAceMatchPending)
  aceMatchPendingRef.current = aceMatchPending ?? memoryAceMatchPending
  /** 두 편 대결 대기(전역기록) — 자동 훑기 가드 1cfe4~1d008 (`isAutoScanHeldByAceMatch`) */
  const aceMatchHoldRef = useRef(aceMatchHold)
  aceMatchHoldRef.current = aceMatchHold

  // 캔버스 루프에서 최신 값을 읽어야 한다 — useAtBatRunner의 atBatRef와 같은 이유다.
  const progressRef = useRef(progress)
  progressRef.current = progress
  const careerRef = useRef(career)
  careerRef.current = career
  const rawCareerRef = useRef(rawCareer)
  rawCareerRef.current = rawCareer
  /**
   * **메모리에만 있는 커리어** — 원본이 그 자리에서 모드 저장(0x22755)을 안 부르는 변경이 만든 값. 저장 고리가 이 값이면 쓰지 않는다
   * (그 뒤 다른 변경이 새 값을 만들면 원본의 다음 저장처럼 통째로 쓴다). 메인 메뉴를 다녀오면 원본은 0x213c0(앱, 4, 0) 으로
   * 파일에서 다시 올리므로 사라진다 — 웹 재진입(`continueSaved` · `resumeInterruptedGame`)도 `savedCareer` 에서 다시 선다.
   * 쓰는 자리: 경기 중 돌발 보상 0x8e34c(`closeBurstResult`).
   */
  const unsavedCareerRef = useRef<PlayerCareer | null>(null)
  /**
   * 지금 타석의 공 수·연속 파울 (`atBatPitchTally`). 타석 결과(`AtBatState`)에 남지 않아 따로 든다 —
   * 타석이 끝나거나 경기를 세우거나 나갈 때 비운다.
   */
  const pitchTallyRef = useRef<AtBatPitchTally>(EMPTY_AT_BAT_PITCH_TALLY)
  /**
   * 지금 붙든 수비 판이 **파울 각 공 판**인가 (`startPlayerFoulPlay`) — 판이 파울로 닫히면 같은 타석이 이어지고, 낙구 전에
   * 잡히면(파울 뜬공 아웃) 이 타석에서 앞서 난 연속 파울 기록을 판 끝 정산과 함께 넘긴다.
   */
  const foulPlayRef = useRef(false)
  /**
   * 붙든 공 도착 판(`progress.pendingRunnerPlay` — 사람 주루 키를 받는 도루 · 폭투 판)이 끝나면 `handlePitchResolved` 의 나머지가
   * 쓸 이 공의 값 — 판이 도는 동안 들고 있는다
   */
  const arrivalContextRef = useRef<ArrivalContext | null>(null)
  // 경기를 세우는 `startMatch` 가 읽는다 — 설정이 바뀔 때마다 콜백 신원이 흔들리지 않게 ref 로 둔다
  const runningModeManualRef = useRef(runningModeManual)
  runningModeManualRef.current = runningModeManual

  /**
   * 경기 중에 환경설정 "주루" 를 바꾸면 **그 자리에서** 먹게 잇는다 — 원본은 이 칸(설정 +0xbd)을
   * 매 틱 다시 읽으므로(`0x5261c`) 다음 경기까지 기다리지 않는다. 값이 같으면 손대지 않는다.
   */
  useEffect(() => {
    const current = progressRef.current
    if (current === null || current.runningModeManual === runningModeManual) return
    const next = { ...current, runningModeManual }
    progressRef.current = next
    setProgress(next)
  }, [runningModeManual])

  /**
   * **켠 스킬 통계** (`0xb663c` → `[mgr+0xc8]+0xf4`, 모드 4). 원본은 장착 0xa4b04 가 새로 켤 때마다 비트를 OR 한다 —
   * 켜는 길이 스킬 창(0x147b0)·획득 자동 장착(0xa4bd8, 이벤트·보상)으로 갈라져 있어, 커리어가 바뀔 때 앞뒤 장착 목록을
   * 견줘 새로 켜진 것만 적는다. 선수를 불러오거나 새로 만들 때(앞이 없거나 다른 선수)는 견주지 않는다.
   */
  const equippedBeforeRef = useRef<{ name: string; ids: readonly number[] } | null>(null)
  useEffect(() => {
    const before = equippedBeforeRef.current
    if (rawCareer === null) {
      equippedBeforeRef.current = null
      return
    }
    equippedBeforeRef.current = { name: rawCareer.name, ids: rawCareer.equippedSkillIds }
    if (before === null || before.name !== rawCareer.name || before.ids === rawCareer.equippedSkillIds) return
    skillEquipStatEventsOf(BATTER_LEAGUE_MODE, before.ids, rawCareer.equippedSkillIds).forEach(recordStat)
  }, [rawCareer, recordStat])

  // 커리어가 바뀔 때마다 저장한다. 저장 실패는 게임 진행을 막지 않는다.
  // 원본은 저장(0x22755)을 부르는 자리가 67곳으로 정해져 있다(re.py xref 0x22754). 이벤트 재생 중에는 보상 명령마다(0x8c460 끝 —
  // 0x8b0e4 · 0x8cd44), system 창 답 0(0x7fe90), 경기 명령(0x8d870), 마지막 명령 뒤 끝(0x8cfc0)과 114 끝 처리(0x1c014)가
  // 저장한다 — 웹 커리어가 이벤트 중에 바뀌는 자리(보상 · 목표 창 · 끝)가 모두 그 자리라 이 자리에서는 원본보다 잦지 않다
  // (`giveEventReward`). 관리 장면(0x106) 안의 저장 안 하는 변경(122 스킬 켬/끔 0x147b0 의 3·4 → 0xa4b04 만 · 129 칭호 등)은
  // 메인 메뉴로 나가는 길이 늘 105 진입 0x11910(119a2 — 조건 없이 저장)을 지나므로 웹이 곧바로 써도 재진입 결과가 같다.
  // 장면 밖으로 저장 없이 나가는 길은 경기 중 나가기 0x40140 하나라, 경기 중 변경(돌발 보상 0x8e34c)만 `unsavedCareerRef` 로 뺀다.
  /** 명예의 전당 등록으로 저장을 지운 뒤 엔딩을 떠날 때까지 — 다시 저장하지 않는다 (`eraseSaveForHallOfFame`) */
  const isSaveErasedRef = useRef(false)
  useEffect(() => {
    if (career === null || isSaveErasedRef.current) return
    if (rawCareer !== null && rawCareer === unsavedCareerRef.current) return
    // 판정 없음(e = −1) 엔딩은 141 이 저장하지 않는다 — 엔딩 칸을 비운 114 끝의 커리어가 남는다 (`savedCareerOf`)
    const persisted = savedCareerOf(career)
    saveGame.save(persisted)
    setSavedCareer(persisted)
  }, [career, rawCareer, saveGame])

  /**
   * **커리어 칸 ↔ 지갑 다리.**
   *
   * 원본은 G가 전역 한 칸이라 다리가 필요 없지만, 웹판은 상점·경기 보상·이벤트가 전부
   * `PlayerCareer` 를 통째로 갈아 끼우는 식이라 커리어 칸을 아직 못 없앴다. 그래서 **나중에
   * 바뀐 쪽이 이기게** 이어 둔다 — 지갑이 주인이고, 커리어 칸은 저장 호환용 그림자다.
   *
   * - 커리어 쪽 G가 움직였으면(상점 구매·경기 보상·이벤트) 그 값을 지갑으로 옮긴다.
   * - 그 밖에 둘이 어긋나면 **지갑이 이긴다.** 선수를 불러오거나 새로 등록한 참에 옛 저장에
   *   남은 값이 지갑을 되돌리는 것을 막는다 (원본도 선수 등록·모드 초기화로 G가 줄지 않는다).
   */
  const walletBalance = wallet?.balance ?? 0
  const setWalletBalance = wallet?.setBalance
  const walletBridgeRef = useRef<{ career: number | null; wallet: number }>({
    career: rawCareer?.gamePoint ?? null,
    wallet: walletBalance,
  })
  useEffect(() => {
    if (setWalletBalance === undefined) return
    const previous = walletBridgeRef.current
    const careerPoint = rawCareer?.gamePoint ?? null
    if (careerPoint !== null && previous.career !== null && careerPoint !== previous.career) {
      walletBridgeRef.current = { career: careerPoint, wallet: careerPoint }
      setWalletBalance(careerPoint)
      return
    }
    if (careerPoint !== null && careerPoint !== walletBalance) {
      walletBridgeRef.current = { career: walletBalance, wallet: walletBalance }
      setCareer((current) => (current === null ? current : { ...current, gamePoint: walletBalance }))
      return
    }
    walletBridgeRef.current = { career: careerPoint, wallet: walletBalance }
  }, [rawCareer, walletBalance, setWalletBalance])

  /**
   * 사람이 치르고 있는 국가대항전 경기 (상태 142 `0x1c46c`) — 경기가 끝나면 이 대회로 하루를 넘긴다.
   * 정규 경기일 때는 늘 null 이다.
   */
  const cupGameRef = useRef<NationalCup | null>(null)

  /** 경기 한 판을 세운다 — 로딩 화면(StrTIP)이 끝나야 첫 투구가 나간다 */
  const startMatch = useCallback(
    (
      ourTeamId: number,
      battingOrder: number | undefined,
      opponentTeamId: number | undefined,
      /** 리그 날짜 카운터 g — 4인 로테이션이 본다 (`시즌+0xb2` 자리, 커리어는 `gamesPlayed`) */
      dayCounter = 0,
      /** 내 팀이 앉는 측 (`0xb7844` → `경기[0x28+side]`). 안 주면 후공 — 국가대항전 자리 (그 갈래는 아직 안 옮겼다) */
      playerSide: PlayerSide = PLAYER_SIDE_LAST_BAT,
      /** 리그 경기의 두 팀 투수 레코드 차례·칸별 +0x2c (`leagueGamePitchersOf`) · 국가대항전은 대회 레코드 두 칸의 차례 */
      pitchers?: GamePitcherSetup,
      /** 142 가 두 팀 명부에 넣은 마선수 (0xb88c8 · 0xb8870). 국가대항전은 안 넘긴다 */
      aces?: GameAceSetup,
      /** 내 팀 명단 — 나리 팀 레코드 타자 배열 차례(`nariQuickLineupOf`) · 국가대항전은 대표팀 칸(+0xbc4) */
      ourRecordLineup?: QuickLineup,
      /** 나리 저장 +0xb2 — 구장 하늘 줄(0x783b0 모드 4)이 본다. 정규 · 포스트시즌은 `dayCounter`, 국가대항전은 대회 날짜(L+0x32) */
      skyDayCounter = dayCounter,
      /**
       * 내 선수 주력 `0xb570d(ctx, 3, 나, 1, 0x5a, 1)` — 모드 4 는 팀 정액 · 코치를 안 타 피로 없는 실효값이다. 루에 선 내가
       * 간이 타석 도루 판정(c19a0) · 주자 판 주루에 쓰인다 (`GameProgress.myRunAbility`)
       */
      myRunAbility?: number,
      /**
       * 두 팀 레코드 +2 — 경기 셋업 0x39fdc(3a332)와 실효 능력치 0xb570c(b5768)가 두 팀 모두 **지금 나리 사기** 0xa3a24 로 덮는다
       * (`GameProgress.teamMorale`, `nariMoraleOf`). 국가대항전이면 원본 버그로 상대국 칸 +2 값이다
       */
      teamMorale?: number,
      /** 상대 리그 팀 레코드 +2 의 앞 값 — 이 경기에서 그 칸이 아직 안 덮였을 때 상대 첫 공만 본다 (`GameProgress.opponentStaleMorale`). 대회는 안 넘긴다 */
      opponentStaleMorale?: number,
      /** 상대 리그 팀 레코드 장비 니블 — 나리 새 시즌 CPU 장비 굴림 0x665e8 이 쓴 값 (`GameProgress.opponentEquipment`). 대회는 안 넘긴다 */
      opponentEquipment?: TeamRecordEquipment,
    ) => {
      // 경기 장면 셋업 0x39fdc 모드 3·4 갈래(0x3a200) — 0xb6814(전역 상태): +0x6b = 0 (`liveGameState`)
      resetLiveGameState()
      // 경기 장면 적재 0x3f584 의 0x3fa3e `0x3f554` — 플레이 시간 시계를 이때부터 잰다
      startPlayClock()
      // 상태 7 진입 0x39f88 → 0x53dbc 의 팁 rand(0, 73) — 경기 시작 굴림의 맨 앞(덱 1275 · 효과 1202 보다 앞, `rollSceneLoadingTip`)
      const tip = LOADING_TIPS[rollSceneLoadingTip(random)] ?? null
      // 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊는다(0x6e418) — 로딩 판부터 배경음이 없다.
      // (관리 화면이 경기로 넘길 때 0x15cfa · 0x1e916 도 먼저 끊지만 들리는 것은 같다)
      audio.stop()
      // 환경설정 "주루" 를 경기에 태운다 — 타자편은 사람이 늘 공격이라 설정이 그대로 먹는다 (0xae690)
      const started = startGame(
        random, ourTeamId, battingOrder, opponentTeamId, playerSide, dayCounter, runningModeManualRef.current, pitchers, aces,
        ourRecordLineup, myRunAbility,
        teamMorale, opponentStaleMorale, opponentEquipment,
      )
      progressRef.current = started
      setProgress(started)
      // 상태 9 의 0x39fdc 모드 4 갈래 — 홈(측 1) 팀 구장, 대회(S+0x12c)면 L+0xad > 1 ? 2 : 8. 리그 팀 0~9 · 상수라 굴림 없음
      setSceneStadium(nariSceneStadium(
        playerSide === PLAYER_SIDE_LAST_BAT ? started.ourTeamId : started.opponentTeamId,
        cupGameRef.current?.stage ?? null,
      ))
      // 적재(상태 8)의 구장 준비 0x352e8 → 0x783b0 — 이 경기 내내 같은 하늘 줄
      const skyRow = stadiumSkyRowOf({ mode: BATTER_LEAGUE_MODE, dayCounter: skyDayCounter }) ?? 0
      stadiumSkyRowRef.current = skyRow
      setStadiumSkyRow(skyRow)
      runner.resetAtBat()
      pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
      foulPlayRef.current = false
      runner.setBannerText('')
      runner.setIsPaused(true)
      setLoadingTip(tip)
      setScreen({ kind: '경기' })
    },
    [audio, random, runner, setScreen],
  )

  /**
   * 경기 장면 0x39fdc 모드 3·4 갈래 — 두 팀을 `0xb891c(…, 모드, 팀)` 로 세우고 `0xb8768` 로 칸 번호를 다시 매긴다(0x3a2fa).
   * 선수는 저장의 **나리 팀 레코드**에서 나온다(`nariTeamsOf`): 내 팀 타순·벤치는 레코드 타자 배열 차례, 142 가 넣은 마선수는
   * 두 팀 레코드의 9번(마타자)·8번(마투수) 칸이다. 투수 0~7 차례는 리그 칸(`leagueGamePitchersOf`)이다.
   */
  const beginGame = useCallback((from?: PlayerCareer) => {
    // `from` — 메인 메뉴의 "곧장 경기"(0x327b8 모드 4 갈래)는 저장을 올린 그 자리에서 세운다(아직 그려지기 전이라 ref 가 옛 값)
    const current = from ?? careerRef.current
    cupGameRef.current = null
    const opponent = current === null || current === undefined ? undefined : nextOpponentOf(current)
    const records = current === null || current === undefined ? undefined : nariTeamsOf(current)
    const mine = records === undefined || current === null || current === undefined
      ? undefined
      : nariTeamRecordOf(records, current.teamId)
    const theirs = records === undefined || opponent === undefined ? undefined : nariTeamRecordOf(records, opponent)
    const recordAces = records === undefined || current === null || current === undefined || opponent === undefined
      ? null
      : recordMatchAcesOf(records, current.teamId, opponent)
    startMatch(
      current?.teamId ?? 0,
      current === null || current === undefined ? undefined : renumberedBattingOrderOf(current),
      // 상대는 일정표(정규시즌)나 지금 시리즈(포스트시즌)가 정한다 — 무작위가 아니다
      opponent,
      // 날짜 카운터 g = S+0xb2(= L+0x32) — 경기 준비 0x1c46c 가 0x1c576 에서 읽고 0이 아니면 두 팀 로테이션을 돌린다.
      // 정규시즌은 오늘까지 치른 경기 수, 포스트시즌은 **시리즈 안 경기 수**다 (`leagueDayCounterOf` — b811c · b777a · b819a).
      // 커리어 `gamesPlayed` 는 내 경기만 세므로 포스트시즌 g 로 쓰지 않는다.
      current === null || current === undefined ? 0 : leagueDayCounterOf(current),
      // 내 팀의 측 — 경기 준비 0x1c46c(0x1c4f0)·장면 0x39fdc 모드 3·4 가지(0x3a164 → [sp+0x3c])가 정규시즌·포스트시즌
      // 가리지 않고 `0xb7844(L, 내 팀)` 로 정한다: 정규시즌은 일정표 0xd89cb · 9일 주기 뒤집기(`leagueSideOf`),
      // 포스트시즌은 대진 윗 시드(칸 0)가 홈·후공, 아랫 시드가 원정·선공 (`leagueGamePlayerSideOf`).
      current === null || current === undefined ? PLAYER_SIDE_LAST_BAT : leagueGamePlayerSideOf(current),
      // 0x1c46c 가 세운 두 팀 투수 — 리그가 들고 다니는 레코드 차례(g ≠ 0 이면 한 칸 돈 것 · 포스트시즌은 시리즈 이월)와
      // 레코드 +0x2c (g == 0 이면 1c8a8 이 열 팀 10000)
      current === null || current === undefined || opponent === undefined
        ? undefined
        : leagueGamePitchersOf(current, opponent),
      // 142 진입 0x1c46c 가 두 팀 명부(저장의 나리 팀 레코드)에 넣은 마선수 — 경기 장면 0x39fdc 가 같은 명부로 팀을 세운다
      recordAces === null || mine === undefined || theirs === undefined
        ? undefined
        : {
          ours: recordTeamAcesOf(mine),
          opponent: recordTeamAcesOf(theirs),
          ...(aceLevels === undefined ? {} : { levels: aceLevels }),
        },
      mine === undefined ? undefined : nariQuickLineupOf(mine),
      undefined,
      current === null || current === undefined ? undefined : effectiveAbilityOf(withNariGameMorale(current)).run,
      // 두 팀 레코드 +2 = 0xa3a24 — 대회가 아니라 커리어 사기
      current === null || current === undefined ? undefined : nariMoraleOf(current),
      // 상대 리그 팀 레코드 +2 에 남은 값 — 그 팀이 지난번 치른 경기 때의 나리 사기 (`nariTeamRecordMoraleOf`, r101)
      current === null || current === undefined || opponent === undefined ? undefined : nariTeamRecordMoraleOf(current, opponent),
      // 상대 팀 객체 0xb8680 → 0x1f989 가 읽는 저장 레코드의 장비 니블 (새 시즌 0x665e8 — `nariCpuEquipment`)
      opponent === undefined ? undefined : nariTeamRecordEquipmentOf(records, opponent),
    )
  }, [aceLevels, startMatch])

  /**
   * 109 다음경기 앞 순위표에 들어선다 — 진입 0x10d8c: `S+0x50 = 4`(0x10db0) · 이전 ≠ 142 면 저장(0x1fded · 0x22755).
   * 이전이 142 여도 값은 이미 4 라 웹은 늘 같은 값을 쓴다. 이어하기가 이 값으로 109 에 돌아온다(`resumePointOf`).
   */
  const enterNextGameStandings = useCallback(
    (fromManagement: boolean) => {
      setCareer((current) => (current === null || current.seasonEndState === 109 ? current : { ...current, seasonEndState: 109 }))
      setScreen({ kind: '다음경기순위', fromManagement })
    },
    [setScreen],
  )

  /**
   * 142 경기 준비에 들어선다 — 진입 0x1c46c. 이 장면에서 처음이면(장면+0x288 == 0) 국가대항전이 아닐 때 마선수 넷을
   * 굴린다(`rollNariMatchAces`, 난수 4). 로테이션·투수 +0x2c 는 웹이 경기를 세울 때(`beginGame`) 같은 값으로 구한다.
   */
  const enterMatchPrepare = useCallback(
    (postseasonFromReentry?: boolean) => {
      // 142 진입 0x1c46c 의 첫 줄(0x1c47a) — 0xb6814(전역 상태): +0x6b = 0
      resetLiveGameState()
      if (!matchPreparedRef.current) {
        matchPreparedRef.current = true
        const aces = rollNariMatchAces(random, openedAces)
        setMatchAces(aces)
        // 1c62e~1c660 — 굴린 넷을 두 팀 레코드에 넣는다(저장에 남는다 — 빼는 코드가 없다)
        setCareer((current) => {
          if (current === null) return current
          const nariTeams = seatNariMatchAces(nariTeamsOf(current), current.teamId, nextOpponentOf(current), aces)
          return { ...current, nariTeams }
        })
      }
      // 1c7ae~1c87c — 무대 · 구장 0x78664(무대, 홈 팀) · 0x5fd04. 리그 팀은 0~9 라 굴리지 않는다(마선수 굴림 뒤 자리)
      const prepared = careerRef.current
      if (prepared !== null && prepared !== undefined) {
        setMatchInfoStage(rollNariMatchInfoStage(random, {
          mode: BATTER_LEAGUE_MODE,
          myTeamId: prepared.teamId,
          opponentTeamId: nextOpponentOf(prepared),
          mySide: leagueGamePlayerSideOf(prepared),
          dayCounter: leagueDayCounterOf(prepared),
        }))
      }
      // 0x1c54a — 두 팀 칸 번호를 다시 매긴다(0xb8768): 타순 = 레코드 안 내 줄 첨자 + 1
      setCareer((current) => {
        if (current === null) return current
        const battingOrder = renumberedBattingOrderOf(current)
        return battingOrder === current.battingOrder ? current : { ...current, battingOrder }
      })
      setEntryView(null)
      setScreen(postseasonFromReentry === undefined ? { kind: '경기준비' } : { kind: '경기준비', postseasonFromReentry })
    },
    [openedAces, random, setScreen],
  )

  /**
   * 국가대항전 경기를 세운다 — 142 확인(`confirmMatchPrepare`)과 곧장 경기(`resumeInterruptedGame`)가 같이 쓴다.
   * 1c5fe 가 마선수를 안 넣었다. 경기가 끝나면 이 대회로 하루를 넘긴다 (`finishCupGame`).
   * 경기 장면 0xb891c — 두 팀을 대회 레코드 두 칸으로 세운다: 타순 = 대표팀 타자 배열(내 선수 · 벤치로 간 선수),
   * 선발 = 두 칸 투수 0번(142 가 돌린 차례). 두 칸 스태미나는 날마다 10000(대표팀 b81e0 · 상대국 새 복사).
   */
  const beginCupGame = (current: PlayerCareer, matchup: NationalCupMatchup, cup: NationalCup) => {
    cupGameRef.current = cup
    const teams = cupTeamsOf(current, matchup.opponent)
    startMatch(
      matchup.myTeam,
      nariCupBattingOrderOf(teams) ?? current.battingOrder,
      matchup.opponent,
      0,
      // 0xb7844 의 L+0xac 갈래 — 대진 칸 0 이 후공: 풀리그는 늘 대한민국 · 결승은 풀리그 1위라 대한민국이 2위면 선공
      nationalCupSideOf(cup, matchup.myTeam) as PlayerSide,
      {
        ourOrder: nariCupRecordOf(teams, matchup.myTeam).pitchers ?? UNSHUFFLED_PITCHER_ORDER,
        opponentOrder: nariCupRecordOf(teams, matchup.opponent).pitchers ?? UNSHUFFLED_PITCHER_ORDER,
      },
      undefined,
      nariQuickLineupOf(teams.korea),
      // 대회 중 나리 저장 +0xb2 = L+0x32 는 대회 날짜다(0xb7bf0 이 0 으로 놓고 하루 끝마다 +1)
      cup.day,
      // 0xb570c 의 사기 감소는 b5768 이 쓴 0xa3a24 값 — 대회 중이면 상대국 칸 +2(원본 버그, `withNariGameMorale`)
      effectiveAbilityOf(withNariGameMorale(current)).run,
      // 두 팀 레코드 +2 = 0xa3a24 — 대회 중이라 상대국 칸 +2 (대표팀 칸도 3a332 · b5768 이 이 값으로 덮는다)
      nariMoraleOf(current),
    )
  }

  /** 경기가 끝났을 때 보상·칭호를 정산하고 결과 화면으로 넘어간다. */
  const finishGame = useCallback(
    (finished: GameProgress, currentCareer: PlayerCareer) => {
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 이 0 (다음 142 에서 다시 굴린다) · 반복 이벤트 · 커서 · mgr+0x304
      setUpNariScene()
      // 정산 진입 0x4ea0c 의 0x4f3d6 — 전역기록 +0x4c + 모드(+0x50) = 0
      nariGameSaveRef.current?.clear()
      // 전역 경기 상태 +0x6b 에 이 경기 끝 이닝이 남는다(0xb6b6c) — 투수편 이어하기 116 의 감독 글 38 이 본다 (`liveGameState`)
      setLiveGameInningIndex(finished.game.inning - 1)
      // 측별 팀 +0x28 · 점수 +0x7e 도 남는다 — 관리 화면 상세 창의 스킬 14 갈래(0xb5a28~)가 본다 (`isLiveGameFightingSpiritSituation`)
      setLiveGameSides(liveGameSidesOf(finished, finished.game))
      const summary = summaryOf(finished)
      // 경기 후 평가 — 인기도 → 평판 → 사기 (0xa719c), 이어서 연속 기록 (0x8a6fc)
      const thisEvaluation = evaluateGame(currentCareer, summary)
      const isEvaluated = isEvaluatedGame(currentCareer)
      /*
       * 116 이 읽는 S+0x4a · +0x64 · +7 · S+0x1d8 은 평가 0xa719c(정규시즌만, 0x4f268)가 쓰는 칸이라 **포스트시즌 경기 뒤에는 앞 평가
       * 경기 값**이다 — 평가 창 숫자 · 감독 글 · 징글 · 경기 뒤 카운터(+0x1c2 · 먹튀) · 칭호 39 모두. 옛 저장에 앞 값이 없으면 이 경기 값.
       */
      const { evaluation: staleEvaluation, recordLine } = shownGameEvaluationOf(
        isEvaluated, thisEvaluation, currentCareer.lastGame, summary.stats,
      )
      // 승리 31 · 패배 32 징글은 정산 0x19 진입(경기 끝 판 0x18 의 OK 뒤), 평가 징글 36 · 37 · 38 은 116 진입이 낸다 —
      // 정산은 결과 화면이 그 단계에 들어설 때(`enterGameSettlement`), 평가는 116 을 띄우는 자리(`enterGameEvaluationScreen`)가 낸다
      // 같은 날 나머지 네 경기도 원본대로 치러 순위표에 넣는다 (0xc2a48)
      // 45경기째면 하루 끝(0xb818c)이 정규시즌을 닫고 대진(0xb80a8)을 연다.
      // CPU 끼리의 포스트시즌 경기는 **여기서 돌리지 않는다** — 원본은 대진 화면 128 의 [확인](0x13da0)에서 돌린다
      // (`pressPostseasonBracket`).
      const resulted = applyGameResult(currentCareer, summary)
      // CPU 경기 0xc2a48(4f296)는 평가 0xa719c(4f274)가 사기를 바꾼 **뒤**다 — 간이 엔진 0xb570c b5768 이 두 팀 레코드 +2 에 그 사기를 쓴다
      const moraleAtCpuGames = nariMoraleOf(applyGameEvaluation(resulted, thisEvaluation, isEvaluated))
      // 사람 경기 상대의 리그 레코드 +2 는 이 경기에서 0xb570c 가 마지막으로 그 칸을 덮을 때의 나리 사기로 남는다 (`teamRecordMorales`, r101).
      // 마지막 타석의 돌발 보상이 사기를 바꾸면(0x1c · 0x1d 진입) 그 뒤 0x18 · 0x19 는 그 칸을 안 덮어 **바뀌기 전 값**이다
      // (`GameProgress.opponentRecordMorale`, r104). 그 값이 없는 옛 진행(경기 중 저장)은 경기 끝 값 그대로
      const settled = withNariTeamRecordMorales(
        applySeasonEnd(applyLeagueDay(resulted, summary.ourTeamId, random, aceLevels, moraleAtCpuGames)),
        [finished.opponentTeamId],
        finished.opponentRecordMorale ?? finished.teamMorale ?? nariMoraleOf(currentCareer),
      )
      // 하루 끝 0xb818c 의 1위 갈래(b8266~b829c) — S+0x7a 다음에 통계 [mgr+0xc8]+0xfc(기록연감 셀 8 "나리 타자편 우승") +1 · 저장
      if (settled.regularSeasonFirstCount > resulted.regularSeasonFirstCount) {
        recordStat({ kind: '리그1위', mode: BATTER_LEAGUE_MODE })
      }
      // 평가 0xa719c 안 0xa690c 가 경기 뒤 누적 카운터 S+0x1f0 을 더한다 — 정규시즌(평가하는 경기)만 (`withGameSkillCounters`)
      const evaluated = applyGameEvaluation(
        isEvaluated ? withGameSkillCounters(settled, summary) : settled,
        thisEvaluation,
        isEvaluated,
      )
      // 116 감독 글은 진입이 +0x4a 와 **평가 뒤** 평판 +0x62 로 고른다 (0x128d2~0x12938 — 모드 4 표 39~74)
      const evaluation = {
        ...staleEvaluation,
        commentIndex: managerCommentIndexOf(evaluated, staleEvaluation.popularityChange),
      }
      // 스킬 조건용 경기 뒤 카운터 — 사기까지 반영된 뒤에 센다 (A-4). 116 쪽(0x12bc2~0x12c3c)이라 포스트시즌에도 돈다 — 그때
      // +0x4a 는 앞 평가 경기 값이다(위).
      //    포스트시즌엔 정산 0xa8024 의 [sp+0x34] = 0xa56dc(지금 타자, 0)(a8070)가 거짓이라 그 게이트 여덟 곳이 막힌다 —
      //    a8362 도루 +0x2c · a8498 안타 +0x22 · a8538 2루타 +0x24 · a8578 3루타 +0x26 · a85c4 홈런 +0x28 · a8866 타수 +0x20 ·
      //    a895c 타점 +0x2a 는 `applyGameResult` 의 `withoutRecordLine` 이 뺀다. 남은 a84d6 은 장내 홈런 state[0x25] 를 홈런 수
      //    [sp+0x24] 에 더하는 자리라, 포스트시즌 장내 홈런은 a8210 이 루타 4 안타로 적되 홈런 갈래(a85be~a86b4 · e[0x13] a8728)를
      //    건너뛴다 — 경기 흐름이 판을 먹일 때 옮겼다(`resolveDefensePlay` 의 `isRecorded` → `finishPlayerOutcome`).
      //    a8024 를 다 보아도 타자 레코드 +0x20~+0x2c 를 게이트 없이 쓰는 곳은 없다 — 게이트 없는 레코드 쓰기는 수비 투수의
      //    +0x2a 사사구(a8b58 · a8bd2)뿐이라 타자편 내 기록에는 없다.
      const counted = countGameForSkills(evaluated, evaluation.popularityChange)
      // 연속 기록 칸을 잇는다. 116 의 0x8a6fc 는 그 칸을 읽어 알림 줄과 **보상 명령**(평판 · 슬럼프 스킬)을 내장 이벤트에
      // 쌓을 뿐이라, 보상은 114 가 이벤트를 틀 때(웹은 [확인] `confirmGameResult`) 먹는다 (`streakEventOf`)
      // 0xa4ce0 은 평가 0xa719c 안이라 포스트시즌 경기는 잇지 않는다 (0x4f268) — 116 은 지난 칸으로 알림·보상을 다시 쌓는다
      const advanced = isEvaluated ? advanceStreaks(counted, summary.stats) : counted
      // 부상은 경기 뒤가 아니라 훈련 결과 창을 닫을 때 굴린다 (0x1b4c4)
      // 경기 뒤 평가 116 진입 0x1278c 가 S+0x50 = 2 · 저장 — 이어하기가 116 을 다시 띄운다(`continueSaved`). S 의 +0x4a ·
      // +0x1d8 처럼 지난 경기 재료를 저장에 남긴다(`lastGame`).
      // 0x1a1c0 칭호는 여기서 주지 않는다(관리 화면 갱신 0x1aec4 `pendingTitle`) — 116 은 칭호 39 하나만 직접 띄운다
      // (1299e: 이 경기 홈런 > 3 · 비트 없음 → +0x270 = 39 · 0x1274c 팝업). 진입은 팝업만 걸고 주는 것은 키 0x1b1e4 다
      // (`confirmGameResultTitle`) — 116 진입 저장(S+0x50 = 2)에는 비트가 없어 키 전에 끄면 이어하기가 팝업을 다시 띄운다.
      // 칭호 39 는 S+0x1d8[3] 을 본다 — 포스트시즌 경기 뒤에는 앞 평가 경기의 홈런 수다
      const dynamite = gameResultTitleOf(advanced.titleIds, recordLine.homeRuns)
      setCareer({ ...advanced, seasonEndState: 116, lastGame: nariLastGameOf(summary, evaluation, recordLine) })
      // 경기 끝 0x4ea0c: 기록 달성 G 합을 저장 G 에 더한 뒤 0x4ec82 `0x22c7d(액수, 모드 4)` 로 획득 GP 통계에 적는다
      recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: gamePointRewardOf(summary) })
      // 이어서 0x4ec8a `0x22e10` 이 이번 경기 기록 배열 40칸을 연감 달성 횟수 [+4+n] 에 더한다 (e48e922)
      recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
      // 0x4ea0c 끝 0x4f54a `0x4e8b0` — 장면 시작(또는 지난 누계)부터 지난 시간을 모드 칸 플레이 시간에 (0x22efc)
      recordStat({ kind: '플레이시간', mode: BATTER_LEAGUE_MODE, elapsed: lapPlayClock() })
      setScreen({
        kind: '경기결과',
        summary,
        gamePointReward: gamePointRewardOf(summary),
        // 원본 116 은 0x1a1c0 칭호를 띄우지 않는다 — 얻은 칭호는 관리 화면에서 하나씩 팝업으로 받는다. 39 만 116 이 준다
        newTitles: dynamite === null ? [] : [dynamite],
        evaluation,
        streakNotices: streakEventOf(advanced).notices,
        streakRewards: streakEventOf(advanced).rewards,
        // 0x4ea0c 꼬리 4f41a~ 의 정산 효과 — 하늘 칸은 경기 끝 이닝 (구장객체 +0x14), 하늘 줄은 경기를 세울 때 고른 구장 +0x10
        settlementInning: finished.game.inning,
        settlementPlayerSide: finished.game.playerSide,
        settlementSkyRow: stadiumSkyRowRef.current,
      })
    },
    [aceLevels, audio, random, recordStat, setScreen, setUpNariScene],
  )

  /**
   * 국가대항전 사람 경기가 끝났다 — 경기 장면 0x104 의 경기 끝 판(상태 0x18) → [OK] → 상태 0x19 진입 `0x4ea0c`(정산 · 그림
   * 0x4a384) → [OK] → 나리 장면 0x106 상태 100 `0x1c154` → S+0x12c 라 134 대진판. 116 은 안 지난다 — 0x4ea0c 4f03a 가 S+0x50 = 2 를
   * 대회가 아닐 때만 쓰고(대회면 4eb3e 의 3 그대로), 0x1c154 는 S+0x50 == 2 일 때만 116 이다.
   * 정산 차례: 기록 달성 G(4ebaa~4ec90) → 승패 4f072~4f136 → 행동 S+4 = 0(4f156) → 같은 라운드 CPU 경기 `0xc2dac` → 하루 끝
   * `0xb818c`(`advanceNationalCupDay`) → 부상 경기 수 · S+0x54 · S+0x7c(4f344~4f3b2) → 저장 (`settleNariCupGame`).
   * 리그 승패 · 평가 0xa719c(4f216 이 건너뛴다) · 내 시즌 기록(0xa56dc 거짓) · 경기 수 · 칭호는 안 건드린다.
   * 웹 경기 끝 판 · 정산 그림은 정규 경기처럼 결과 화면(`GameResultScreen`) 한 장이다 — [확인]이 134 로 간다(`confirmCupGameResult`).
   */
  const finishCupGame = useCallback(
    (finished: GameProgress, cup: NationalCup) => {
      const summary = summaryOf(finished)
      // 0x4ea0c 4f072~4f136 — 후공(측 1) 점수가 더 많을 때만 후공 승, 동점이면 선공(측 0) 승 (`nariCupGameResultOf`)
      const { winner, loser } = nariCupGameResultOf({
        mySide: finished.game.playerSide,
        myTeam: summary.ourTeamId,
        opponentTeam: summary.opponentTeamId,
        myScore: summary.ourScore,
        opponentScore: summary.opponentScore,
      })
      cupGameRef.current = null
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 = 0 · 반복 이벤트 · 커서 · mgr+0x304
      setUpNariScene()
      // 대회 경기도 정산 진입 0x4ea0c 를 지난다 — 0x4f3d6 은 모드를 가리지 않고 +0x4c + 모드 = 0
      nariGameSaveRef.current?.clear()
      // 전역 경기 상태 +0x6b — 대회 경기도 끝 이닝을 남긴다 (측별 팀 · 점수도)
      setLiveGameInningIndex(finished.game.inning - 1)
      setLiveGameSides(liveGameSidesOf(finished, finished.game))
      // 같은 날 CPU 경기 두 나라는 상대국 슬롯 레코드(base+0x934) 하나를 쓴다 — 사람 경기가 깎아 둔 그 레코드의
      // 투수 +0x2c 에서 선다 (701a7a9). 사람 경기 끝 상대 투수 칸별 값을 넘긴다
      // 그 CPU 경기(0xc2dac)의 간이 엔진도 0xb570c b5768 로 두 나라 레코드 +2 에 나리 사기를 쓴다 — 대회 중이라 상대국 칸 +2, 곧 사람
      // 경기 끝의 그 칸(돌발 보상 사기가 쌓인 값, `GameProgress.teamMorale`)이다
      const next = advanceNationalCupDay(
        cup, winner, loser, random, summary.pitcherStaminas?.opponent,
        finished.teamMorale === undefined ? undefined : { mode: BATTER_LEAGUE_MODE, nariMorale: finished.teamMorale },
      )
      // 기록 달성 G (4ebaa~4ec7c — 사람 팀 공·수로 거른 기록이라 대회 경기도 쌓인다)
      const gamePointReward = gamePointRewardOf(summary)
      // 하루 끝 b8216 — 다음 날 사람 경기 상대를 +0xbe0 에 마스터에서 새로 복사. 대회 칸(L+0xa8~ · L+0x32)은 정산 끝 0x4f3c4 가 저장
      setCareer((current) => current === null
        ? current
        : {
          ...settleNariCupGame(current, gamePointReward),
          nationalCup: next,
          ...(current.nariCupTeams === undefined
            ? {}
            : {
              // 대표팀 칸(+0xbc4)에 남는 것 먼저 — +2 사기는 0xb570c b5762 가 마지막으로 덮은 나리 사기(대회 중이라 상대국 칸 값, 상대 칸
              // 덮기와 같은 공이라 `opponentRecordMorale` 과 같은 때). 실책 +0x2e 는 타자편 수비 그림이 상대 야수뿐이라 대표팀 몫이 없다
              nariCupTeams: nextNariCupDayTeams(
                recordNariCupGame(current.nariCupTeams, {
                  morale: finished.opponentRecordMorale ?? finished.teamMorale,
                  errors: summary.leagueErrors,
                }),
                nationalCupMatchupOf(next)?.opponent ?? null,
              ),
            }),
        })
      // 0x4ec82 `0x22c7d(G, 모드 4)` 획득 GP 통계 · 0x4ec8a `0x22e10` 기록 달성 횟수 — 모드를 가리지 않는다
      recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: gamePointReward })
      recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
      // 0x4ea0c 끝 0x4f54a `0x4e8b0` — 장면 시작(또는 지난 누계)부터 지난 시간을 모드 칸 플레이 시간에 (0x22efc)
      recordStat({ kind: '플레이시간', mode: BATTER_LEAGUE_MODE, elapsed: lapPlayClock() })
      // 승리 31 · 패배 32 징글 — 정규 경기와 같이 정산 0x19 진입에서(`enterGameSettlement`). 116 의 평가 징글은 없다
      setScreen({
        kind: '대회경기결과', summary, gamePointReward, cup: next, settlementInning: finished.game.inning,
        settlementPlayerSide: finished.game.playerSide, settlementSkyRow: stadiumSkyRowRef.current,
      })
    },
    [audio, random, recordStat, setCareer, setScreen, setUpNariScene],
  )

  /**
   * **재생 판 뒤의 경기 끝** — 미리 돌려 재생 칸(`lastDefensePlay`)에 넣은 판(밀어내기 · 낫아웃 · 진루만 하는 판)이 경기를 끝내면
   * 원본은 그 판을 상태 0x17 로 끝까지 그린 뒤에야 0xd → 경기 끝 판 0x18 로 간다(판정 A/B 0xae3e8). 그 그리기 0x43278 이 실책 +0x2e 를
   * 올리므로(`recordFieldingErrors`) 정산 0x4ea0c 의 기록에 그 판 실책이 든다. 예전 웹은 판 결과를 먹인 자리에서 곧장 정산해
   * 재생이 잘리고 그 판 실책이 요약에서 빠졌다(r237 남김 — "웹 구조"). 재생 화면(`GameRoute`)은 판을 다 그리면 `finishReplay` 로
   * 알리므로 그때까지 정산을 미룬다. 재생 화면이 붙어 있지 않으면(화면 없는 시험) 곧장 정산한다 — 예전과 같다. soak 는 재생 화면 대신 붙어 알린다.
   */
  const replayHostCountRef = useRef(0)
  const replayedPlayRef = useRef<DefensePlayResult | null>(null)
  const isGameEndPendingRef = useRef(false)
  /**
   * **돌발 결과 창 뒤의 경기 끝** — 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 돌발 판정 0x8f414 가 참이면 0x1d · 0x1c(결과 창)를 먼저 거친 뒤
   * +0x1b6c 로 가고, 그 다음 상태는 0x18 · 0x19(경기 끝)일 수도 있다(R9 18-2 · R10 0x12 끝). 보상 0x8e34c 도 그 창 진입(0x3b04c ·
   * 0x3b068)이다. 웹은 내 타석 뒤 남은 반 이닝을 한 번에 돌리므로 경기가 끝나면 곧장 정산으로 가 결과 창 · 보상을 건너뛰었다(r315 —
   * 9회말 마지막 내 타석의 돌발). 판정이 남아 있으면 정산을 창을 닫을 때(`closeBurstResult`)까지 미루고, 보상이 든 커리어가
   * 그려진 뒤 정산한다(아래 효과). 재생 판 기다림이 먼저다 — 판을 다 그린 뒤(`finishReplay`) 여기로 다시 온다.
   */
  const [isGameEndHeldByBurst, setGameEndHeldByBurst] = useState(false)
  /**
   * **남은 중계 뒤의 경기 끝** (A-38) — 0x12 끝(4e7ca) · 0x17 끝(52a8e)이 예약한 +0x1b6c 를 0x35108 이 자동진행 중계 0x21 로 덮으면
   * 동료 타석 · 상대 반 이닝을 그 상태에서 다 돈 뒤에야 0xc2198 이 거짓을 내 경기 끝 판 0x18 → 정산 0x19 다(K · R10). 돌발 판정이
   * 참이면 그 앞에 결과 창 0x1d 가 선다(위). 웹 진행기는 그 중계를 한 걸음에 굴려 `autoRelay` 에 담고 경기 화면(`GameRoute`)이 틱마다
   * 튼다 — 예전 웹은 정산이 그것을 기다리지 않아 경기를 끝낸 중계가 잘렸다. 중계 화면이 붙어 있는 동안(`attachRelayHost`) 아직 다
   * 틀지 않은 중계가 있으면 정산을 그 끝(`finishRelay`)까지 미룬다. 화면이 붙어 있지 않으면(화면 없는 시험 · soak) 곧장 — 예전과 같다
   */
  const relayHostCountRef = useRef(0)
  const relayedRef = useRef<GameAutoRelay | null>(null)
  const isGameEndAwaitingRelayRef = useRef(false)
  const endGame = useCallback(
    (finished: GameProgress) => {
      // 재생 판이 실책을 올렸으면 진행 칸이 더 새 값이다 — 같은 끝난 경기면 그것으로 정산한다
      const latest = progressRef.current
      const settled = latest !== null && latest.game.isFinished ? latest : finished
      const play = settled.lastDefensePlay
      if (replayHostCountRef.current > 0 && play !== null && play.ticks.length > 0 && play !== replayedPlayRef.current) {
        isGameEndPendingRef.current = true
        return
      }
      isGameEndPendingRef.current = false
      if (settled.lastBurstResolution !== null) {
        setGameEndHeldByBurst(true)
        return
      }
      // 결과 창 다음이 남은 중계(0x21)다 — 다 튼 뒤 경기 끝 판 · 정산
      const relay = settled.autoRelay ?? null
      if (relayHostCountRef.current > 0 && relay !== null && relay.ticks.length > 0 && relay !== relayedRef.current) {
        isGameEndAwaitingRelayRef.current = true
        return
      }
      isGameEndAwaitingRelayRef.current = false
      // 국가대항전 경기는 커리어 정산을 타지 않고 대회 하루를 넘긴다 (상태 142 → 101 → 134)
      const cup = cupGameRef.current
      if (cup !== null) return finishCupGame(settled, cup)
      const currentCareer = careerRef.current
      if (currentCareer !== null) finishGame(settled, currentCareer)
    },
    [finishCupGame, finishGame],
  )
  const endGameRef = useRef(endGame)
  endGameRef.current = endGame
  // 돌발 결과 창을 닫아 판정이 치워졌다 — 보상이 든 커리어 · 진행이 그려진 뒤 미룬 정산을 한다
  useEffect(() => {
    if (!isGameEndHeldByBurst) return
    if (progress === null || !progress.game.isFinished) {
      setGameEndHeldByBurst(false)
      return
    }
    if (progress.lastBurstResolution !== null) return
    setGameEndHeldByBurst(false)
    endGameRef.current(progress)
  }, [isGameEndHeldByBurst, progress])

  /**
   * 타석 하나가 경기 상태에 다 먹은 뒤 — 결과 배너를 띄우고, 경기가 끝났으면 정산으로 넘긴다.
   * 인플레이 타구는 **수비 화면이 끝난 뒤에야** 여기까지 온다.
   */
  const finishAtBat = useCallback(
    (advanced: GameProgress, outcome: AtBatOutcome, runnersOnBase: number, endFrames: number) => {
      runner.pauseWithBanner(describeOutcomeBanner(outcome, runnersOnBase), endFrames, () => {
        if (!advanced.game.isFinished) {
          runner.setIsPaused(false)
          return
        }
        endGame(advanced)
      })
    },
    [endGame, runner],
  )

  /**
   * 공 하나의 **공 도착 뒤 나머지** — 판 소리 · 판에서 끊긴 타석 · 끝난 타석의 결과(`startPlayerOutcome`).
   * 판을 미리 돌린 공은 `handlePitchResolved` 가 곧바로, 사람 주루 키를 받으며 실시간으로 돈 판(`pendingRunnerPlay`)은
   * 판 끝(`finishRunnerPlay`)이 부른다.
   */
  const continueAfterArrival = useCallback(
    (beforeArrival: GameProgress | null, arrival: PitchArrivalStep | null, context: ArrivalContext) => {
      if (beforeArrival !== null && arrival !== null && arrival.progress !== beforeArrival) {
        progressRef.current = arrival.progress
        setProgress(arrival.progress)
        // 판정 콜(도루 17 · 62/20, 폭투 17) 뒤 공수 교대 소리. 원본은 판 안의 결과 코드가 선 틱(결과 메시지 0xbba → 0x51a56)에
        // 낸다 — 실시간으로 돈 판(`shownLive`)은 화면이 그 틱에 이미 냈고, 미리 돌린 판은 재생 칸(`lastDefensePlay` — 진루만 하는 판은
        // 공 도착에서, 낫아웃 · 밀어내기 판은 타석 결과 `finishPlayerOutcome` 에서 넣는다)에 들어가 재생 화면이 기록된 틱에 낸다
        // (`DefensePlayback` 재생 갈래의 `tickSoundIds`). 그릴 틱이 없는 판만 여기서(근사) 낸다
        playSoundIds(audio, [
          arrival.play == null || arrival.play.shownLive === true || arrival.play.result.ticks.length > 0
            ? null
            : arrival.play.callSoundId,
          ...gameStepSoundIdsOf(beforeArrival, arrival.progress),
        ])
      }
      if (arrival !== null && arrival.interrupted) {
        // 판에서 반 이닝·경기가 끝났다 — 내 타석이 끊긴다 (견제사와 같은 길)
        pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
        runner.resetAtBat()
        if (!arrival.progress.game.isFinished) return
        endGame(arrival.progress)
        return
      }
      if (!isAtBatFinished(context.nextAtBat) || context.nextAtBat.outcome === null) return

      // 타석이 끝났다 — 다음 타석은 새 카운터로 (타석 초기화 0xa5bcc 가 ctx+0x15f 를 지운다)
      pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY

      const currentProgress = progressRef.current
      if (currentProgress === null) return

      const { bases } = currentProgress.game
      const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
      // 타석 결과(안타/아웃 코드)만 먼저 정한다 — 인플레이 타구면 주자 처리는 화면 뒤로 미뤄진다.
      // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
      // 판정 11(2스트라이크 번트 파울)은 파울 각 공 판이 판 끝 결과 코드 11 로 낸다 — 콜 62 는 판 결과(`played.buntFoulOut`)가 고정한다
      const advanced = startPlayerOutcome(currentProgress, context.nextAtBat.outcome, random, {
        isUncatchable: context.isUncatchable,
        // 쏜 패턴(0xb0930 덱에서 뽑은 것)을 그대로 판에 싣는다 — 타석 결과 객체에 묶인 것과 같은 값을 명시적으로 넘긴다
        pattern: context.pattern,
        foulRecordIds: context.tally.foulRecordIds,
        arrivalPlay: arrival?.play ?? null,
        // 이 공의 번트 종류(장면 +0xfdc) — 타구 판 시작 리드(0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더한다
        buntKind: context.buntKind,
        // 삼진 + 도루 판의 한 정산이 0xa59c0 에 보는 타자 게이트 0xa56dc(ctx, 지금 타자, 1)
        isRecorded: cupGameRef.current === null && careerRef.current?.postseason === null,
      })
      progressRef.current = advanced
      setProgress(advanced)

      // 수비 진행 중 — 화면이 틱을 돌리는 동안 타석을 멈춰 둔다. 원본도 상태 0x17 이 도는 동안
      // 0xf(타석 준비)로 돌아가지 않아 다음 투구가 나가지 않는다
      if (advanced.pendingDefensePlay !== null) {
        runner.setIsPaused(true)
        return
      }
      // 사구 — 0x12 대기(32 그림) 끝의 판정(`judgeHitByPitch`)까지, 들어갔으면 벤치 클리어링 연출(상태 0x1e)이 끝날 때
      // (`finishBenchClearing`)까지 붙든다. 그동안 타석 화면은 0x12 를 그린다
      if (advanced.pendingBenchClearing !== null) {
        runner.setIsPaused(true)
        return
      }
      // 홈런·삼진·볼넷은 수비를 기다리지 않는다 — 홈런 함성(11)과 진행 소리를 여기서 낸다
      playSoundIds(audio, [
        inPlayCallSoundIdOf(context.nextAtBat.outcome),
        ...gameStepSoundIdsOf(currentProgress, advanced),
      ])
      // 0x12 진입에서 끝난 타석 — 도루 · 폭투 판(종류 5 · 9)이 열렸으면 곧장 0x17 이라 판 끝에서, 아니면 0x12 대기 32 그림 뒤 0xd
      finishAtBat(advanced, context.nextAtBat.outcome, runnersOnBase, atBatEndFramesOf(context.nextAtBat.outcome, arrival?.play))
    },
    [audio, endGame, finishAtBat, random, runner],
  )

  /**
   * **맞은 판정 틀** — 메시지 0x11 굴림 묶음(필살수비 · 표시 패턴 · 두 공 폴 · 필살타법)을 이 공으로 설 판 입력으로 미리 굴린다(A-37).
   * 0x13 뒤 `handlePitchResolved` 가 세우는 판(`startPlayerOutcome` · `startPlayerFoulPlay`)은 쏜 공에 묶인 그 값을 되찾는다.
   * 판정 틀과 0x13 끝 사이에 수비 칸(능력 · 스킬 · 모드)은 안 바뀐다
   */
  const preRollContact = useCallback(
    (detail: PitchOutcomeDetail, buntKind: number) => {
      const progress = progressRef.current
      const outcome = contactOutcomeOfDetail(detail)
      if (progress === null || outcome === null) return null
      const input = contactDefensePlayInputOf(progress, outcome, random, { buntKind })
      return input === null ? null : preRollContactMessage(input)
    },
    [random],
  )

  const handlePitchResolved = useCallback(
    (detail: PitchOutcomeDetail, _pitch?: unknown, isUncatchable?: boolean, buntKind?: number): PitchResolvedReply | undefined => {
      // 공이 손을 떠날 때 상대 투수 투구 수·스태미나를 깎는다 (0x3dec6 → 0xa5e14(ctx, 구질)).
      // 타자 스킬 22 압도(0xb62b4(현재 타자, 22) — 장착 비트)면 소모 ×2
      const beforePitch = progressRef.current
      if (beforePitch !== null && detail.pitchTypeNumber !== undefined) {
        const thrown = throwOpponentPitch(beforePitch, detail.pitchTypeNumber, {
          batterIntimidates: careerRef.current?.equippedSkillIds.includes(INTIMIDATE_SKILL_ID) ?? false,
          // 소모 0x345fc(0x51214 → 0x5121e) · 싣기 0x3de10 — 수비 팀 +0x28 · 공 +0x10 을 경기 동안 이어 든다
          magic: { pitcher: stageOpponentPitcherAbilityOf(beforePitch, aceLevels), aceLevels },
        })
        progressRef.current = thrown
        setProgress(thrown)
      }
      // 번트 판정을 받은 공(자세가 틱 N − 1 까지 섬) — 0x4e1f8 → 스윙 시작 0xa5fac → 코드 11 → G+0xf8 번트 수 +1.
      // 게이트 0xa56dc(R, 지금 타자, 1) 은 국가대항전 · 포스트시즌이면 거짓 (`recordMyBuntAttempt`)
      const beforeBunt = progressRef.current
      if (beforeBunt !== null && detail.hasSwung && (buntKind ?? 0) !== 0) {
        const bunted = recordMyBuntAttempt(beforeBunt, {
          isRecorded: cupGameRef.current === null && careerRef.current?.postseason === null,
        })
        progressRef.current = bunted
        setProgress(bunted)
      }
      // 파울 각 공 — 원본은 맞은 공이면 각과 무관하게 판(상태 0x17)을 돈다(메시지 0x11 → 0x13 → 0x17). 스트라이크(0xb6b58) ·
      // 연속 파울(0xa7dbc) · 파울 콜 25(51c5c)는 판이 파울로 닫힐 때(`finishDefensePlay`)다 — 여기서는 타구음만 낸다.
      // 공 도착 판(0x3dfac)은 못 맞힌 공만이라 열지 않는다. 필살타법 성공 굴림(0x517e6)도 판 시작이 한다(`foulContact`)
      if (detail.resolution.kind === '파울' && detail.foulContact !== undefined) {
        const beforeFoul = progressRef.current
        if (beforeFoul === null) return
        const started = startPlayerFoulPlay(beforeFoul, detail.foulContact, random, {
          strikes: runner.atBatRef.current.strikes,
          buntKind: buntKind ?? 0,
        })
        progressRef.current = started
        setProgress(started)
        playSoundIds(audio, [detail.contactSoundId])
        if (started.pendingDefensePlay === null) return
        foulPlayRef.current = true
        runner.setIsPaused(true)
        return
      }
      const nextAtBat = runner.applyPitch(detail.resolution)
      // 공마다 연속 파울(ctx+0x15f)을 센다 — 32·33 은 타석 결과와 함께 gameFlow 로 넘긴다 (0xa7dbc)
      const tally = tallyPitch(pitchTallyRef.current, detail.resolution)
      pitchTallyRef.current = tally
      // 타구음(0x515de~)은 판정 틀 — 타석 화면이 이미 냈다(`contactSoundId` 는 비어 온다). 심판 콜(0x51a94)은 다음 틀 0x12 진입
      // 0x3dfac 가 메시지 0xbba 를 곧바로 보내 낸다(3e1e2~3e1e8) — 타석 화면은 0x12 를 예약한 틀에 이 자리를 부른다(`showResult`)
      playSoundIds(audio, [detail.contactSoundId])
      playSoundIdsAfterSceneTicks(audio, [pitchCallSoundIdOf(detail.resolution, nextAtBat)], BATTER_PITCH_RESULT_ENTRY_TICKS)
      // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 출발한 도루(종류 5) 판을 연다 (`arrivePitch`)
      const beforeArrival = progressRef.current
      const arrival =
        beforeArrival === null
          ? null
          : arrivePitch(
              beforeArrival,
              // 못 맞힌 번트의 번트 종류(장면 +0xfdc)도 싣는다 — 도루 판 리드 0x3d7b8
              // 맞은 공의 결과 코드는 경기 +0xfd4 로 남는다(다음 견제 판이 본다)
              {
                resolution: detail.resolution,
                outcomeAfter: nextAtBat.outcome,
                buntKind: buntKind ?? 0,
                resultCode: detail.resultCode,
                // 타자 손 0xb63c0 — 밀어내기 · 낫아웃 판의 타자주자 타석 자리
                batterHand: detail.batterHand,
              },
              random,
              {
                // 정산 0xa59c0 의 타자 게이트 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓
                isRecorded: cupGameRef.current === null && careerRef.current?.postseason === null,
                // 판정 A 0xae24c 가 이 공을 먹인 카운트 — 타석이 이어지면 0xf 진입의 교체 틱 굴림(0x344dc)이 본다
                countAfter: { strikes: nextAtBat.strikes, balls: nextAtBat.balls },
                // 도루 · 폭투 판(종류 5 · 9)은 사람 주루 키(0x5331c · 0x585)를 받으므로 붙들어 화면이 실시간으로 돌린다
                live: true,
              },
            )
      const context: ArrivalContext = { nextAtBat, tally, isUncatchable, pattern: detail.pattern, buntKind: buntKind ?? 0 }
      // 0x3dfac 낫아웃 갈래(3e0aa)가 판정 칸을 지웠나 — 타석 화면이 0x12 틱 0 의 판정 글자 · 삼진 파티클을 고른다
      const held = arrival?.deferred === true ? arrival.progress.pendingRunnerPlay : null
      const reply: PitchResolvedReply = {
        judgementCleared: clearsPitchJudgement(arrival?.play) || (held?.kind === 'arrival' && clearsPitchJudgement(held.opened)),
      }
      if (beforeArrival !== null && arrival !== null && arrival.deferred === true) {
        // 판이 도는 동안(상태 0x17) 다음 공은 없다 — 판 끝에서 `finishRunnerPlay` 가 아래 나머지를 잇는다
        progressRef.current = arrival.progress
        setProgress(arrival.progress)
        arrivalContextRef.current = context
        runner.setIsPaused(true)
        return reply
      }
      continueAfterArrival(beforeArrival, arrival, context)
      return reply
    },
    [aceLevels, audio, continueAfterArrival, random, runner],
  )

  const story = useStorySchedule(career)
  storySceneSetUpRef.current = story.setUpScene
  /**
   * 외출 지도 [!] 칸 [gfx+0x9c] — 112 진입 0x118e4 → 0x8cdc0 이 **들어설 때 한 번** 찍은 값(`outingPlaceSlotsOf`). 지도 그림
   * 0x7ed6c 의 [!] 와 [들어가기] 0x8ce58 이 모두 이 값을 쓴다. 웹 화면이 112 진입이 되는 때(`isOutingMapEntry`):
   * 밖에서 '외출' 로 들어옴 · 이벤트 '외출진입'(원본은 112 진입 다음 폴링 0x1cf9c 가 찾는다) · 그 이벤트에서 '외출' 로 돌아옴(`뒤 112`)
   * · 이벤트 '대결결과'(105 진입 0x11910 의 0x11bb2 가 0x118e4 를 부르고 140). 장소 이벤트('장소')에서 돌아오는 길은 113 이라 안 찍는다.
   * 이벤트 본문이 아직 안 왔으면 오는 때 찍는다.
   */
  const careerForSlotsRef = useRef(career)
  careerForSlotsRef.current = career
  const outingEntryRef = useRef<{ readonly screen: Screen; readonly count: number }>({
    screen,
    count: isOutingMapEntry(null, screen) ? 1 : 0,
  })
  if (outingEntryRef.current.screen !== screen) {
    const entered = isOutingMapEntry(outingEntryRef.current.screen, screen)
    outingEntryRef.current = { screen, count: outingEntryRef.current.count + (entered ? 1 : 0) }
    // 0x8cdc0 은 찍고 나서 reader+0x28 = 0 (`rewindCursor`) — 다음 훑기는 처음부터다
    if (entered) story.rewindCursor()
  }
  /** 113 취소로 112 에 다시 들어선 횟수 — 화면은 '외출' 그대로라 위 셈에 안 잡힌다(`reenterOutingMap`, Q-22) */
  const [outingReentryCount, setOutingReentryCount] = useState(0)
  const outingEntryCount = outingEntryRef.current.count + outingReentryCount
  const outingSlots = useMemo(() => {
    const current = careerForSlotsRef.current
    const events = story.events
    if (outingEntryCount === 0 || current === null || events === null) return EMPTY_OUTING_PLACE_SLOTS
    return outingPlaceSlotsOf((placeFrame) => nextEventFor(current, events, placeTriggerOf(placeFrame)))
  }, [outingEntryCount, story.events])
  const eventPlaceIds = useMemo(() => outingSlotPlaceIdsOf(outingSlots), [outingSlots])
  /** 재생기에 넘기는 목록 — 파일 이벤트 뒤에 연초 115 내장 이벤트를 붙인다 (훑기는 파일 것만 본다, 투수편과 같다) */
  const storyEvents = useMemo(
    () => (story.events === null ? null : [...story.events, NARI_YEAR_START_EVENT]),
    [story.events],
  )
  /**
   * **105 진입 한 번** — 서 있으면 아래 고리가 진입 곁가지(0x11910)와 자동 훑기(0x1cf9c)를 한 번 돈다.
   * 상태 틀 0x1cdec 는 0xbc9c9(이번 틀에 상태가 바뀌었나)가 거짓이면 곧장 0x1d06a 로 가(0x1ce02~0x1ce0c) 진입 · 자동 훑기를
   * **상태가 105 로 바뀐 틀에만** 한다 — 105 에 머무는 틀에는 훑지 않는다. 그리고 바뀐 틀이면 **어디서 왔든** 훑고, 훑기
   * 0x8be80 은 늘 무작위 조건(22 질병 · 20 스킬 획득 확률)까지 굴린다. 그래서 경기 · 이벤트 끝 · 새 시즌 · 이어하기뿐 아니라
   * 훈련 결과 창(125, 0x1b5b8) · 휴식(127, 0x1b466) · 외출 효과(126, 0x158fa) · 외출 지도 취소(112) · 장소 끝(113) ·
   * 순위표 취소(109) · 하위 메뉴 취소(106 · 107 · 110)에서 돌아올 때도 `0xbcb49(0x69)` 로 105 에 다시 들어와 굴린다.
   * 훑기를 건너뛰는 것은 진입이 114 · 115 를 예약한 때(0x1cfdc — 연초 115 · 부상 엔딩 500)와 새 선수 · 대결 대기뿐이다(아래).
   *
   * 웹은 화면이 '관리' 로 바뀐 것을 진입으로 본다. 단 상점(111 취소 → 110 · 121 취소 → 106, `nariReturnSubMenuOf`)은
   * 하위 메뉴로 돌아오는 길이라 105 진입이 아니다. 화면이 '관리' 인 채 105 에 다시 들어오는 길(하위 메뉴
   * 취소 · 훈련 · 휴식 결과 창 닫기 · 필살타법 알림 닫기)은 `reenterManagement` 가 센다.
   */
  const [managementReentryCount, setManagementReentryCount] = useState(0)
  const managementBgmRestartRef = useRef(onManagementBgmRestart)
  managementBgmRestartRef.current = onManagementBgmRestart
  /**
   * `from` 은 105 로 다시 들어오는 원본 앞 상태 — 0x1aec4 의 배경음 4 목록에 들면(125 훈련 결과) 배경음 4 를 처음부터 다시 튼다
   * (`restartsManagementBgmFrom`). 하위 메뉴 106 · 107 · 110 취소 · 127 휴식은 목록 밖이다
   */
  const reenterManagement = useCallback((from?: number) => {
    setManagementReentryCount((count) => count + 1)
    if (from !== undefined && restartsManagementBgmFrom(from)) managementBgmRestartRef.current()
  }, [])
  /** 필살타법 결과 알림(125 의 알림 창)이 떠 있다 — 닫히면 105 진입 */
  const specialSwingNoticeRef = useRef(false)
  /** 부상 첫 팝업 0x28 이 떠 있다 — 닫히면 105 틀 0x1aec4 가 둘째 팝업 0x29(`INJURY_FOLLOW_UP_NOTICE`)를 띄운다 */
  const injuryNoticeRef = useRef(false)
  const managementEntryRef = useRef({ kind: screen.kind, reentryCount: managementReentryCount, isPending: false })
  {
    const seen = managementEntryRef.current
    if (seen.kind !== screen.kind || seen.reentryCount !== managementReentryCount) {
      const isArrival = seen.kind !== screen.kind && !NOT_MANAGEMENT_ENTRY_FROM.has(seen.kind)
      const isReentry = seen.reentryCount !== managementReentryCount
      managementEntryRef.current = {
        kind: screen.kind,
        reentryCount: managementReentryCount,
        isPending: screen.kind === '관리' && (seen.isPending || isArrival || isReentry),
      }
    }
  }
  const isManagementEntry = screen.kind === '관리' && managementEntryRef.current.isPending
  /**
   * **칭호 팝업 하나** — 관리 장면 this+0x270 (줄 칭호 번호, −1 = 없음). 판정 0x1a1c0 은 관리 장면 갱신 0x1aec4 끝
   * (0x1af90~0x1afc2)에서 `this+0x274 == 1`(관리 화면 105 에 들어와 두 번째 갱신 — 진입 0x11c64 가 0 으로 둔다)이고
   * +0x270 < 0 일 때만 돌고, 번호 차례로 **처음 맞는 하나만** 남겨 팝업 0x1274c 를 띄운다. 확인 0x1b1e4 가 비트를 켜고
   * 곧바로 장착(+0x1c4)·저장한 뒤 +0x270 = −1 · +0x274 = 1 로 다음 틀에 다시 판정한다 — 그래서 여러 개가 하나씩 이어진다.
   * 원본은 105 에 머무는 동안 커리어가 바뀌지 않는다(훈련·휴식·상점·외출은 다른 상태로 갔다 105 로 다시 들어온다).
   * 웹은 훈련 결과 따위를 관리 화면 위 알림으로 보이므로 "105 에 있고 진입 이벤트 검사가 끝났으면" 늘 판정한 값으로 둔다.
   * 117 진입 0x11e84(11ee6~11f4a)는 칭호 1 · 9 를 주지 않고 +0x270 에 **넣기만** 한다(`heldTitle`) — 452~454 를 보고 105 에
   * 머무는 둘째 틀에 0x1a1c0 대신 그 팝업이 서고(+0x270 ≥ 0 이라 판정을 건너뛴다) 확인이 비트 · 장착 · 저장을 한다.
   */
  const [heldTitle, setHeldTitle] = useState<string | null>(null)
  const pendingTitle = screen.kind === '관리' && !isManagementEntry && career !== null ? heldTitle ?? nextTitleOf(career) : null
  // 장면이 새로 서면 반복 이벤트를 다시 볼 수 있게 한다 (0xacf60, `setUpNariScene`) — 이벤트 본문이 도착한 뒤에.
  // ⚠️ 내보인 `career` 가 아니라 **지금 칸**(`current`)에서 지운다 (r245): 경기 끝(`finishGame`)은 셋업과 같은 그림에 기록 달성 G
  // (0x4ea0c)를 커리어 칸에 얹는데, 그 그림의 내보인 커리어는 아직 지갑 값(얹기 전 G)이라 그것으로 갈아 끼우면 지갑 다리가
  // "커리어 G 가 줄었다" 로 읽어 지갑까지 되돌렸다 — 경기마다 기록 달성 G 가 사라졌다
  const events = story.events
  useEffect(() => {
    if (!shouldForgetRepeatable || career === null || events === null) return
    setShouldForgetRepeatable(false)
    setCareer((current) => (current === null ? current : forgetRepeatableEvents(current, events)))
  }, [shouldForgetRepeatable, career, events])
  useEffect(() => {
    if (!isManagementEntry || !managementEntryRef.current.isPending || career === null || story.events === null) return
    // 셋업의 반복 이벤트 지우기가 아직이면 그 뒤에 훑는다 — 원본은 셋업 0xf684 가 105 진입보다 먼저다
    if (shouldForgetRepeatable) return
    managementEntryRef.current = { ...managementEntryRef.current, isPending: false }
    /*
     * **새 선수 오프닝 451 이 115 보다 먼저다** (모드 3·4 공용). 진입 0x11910 이 0x11bd6 에서 `0xbcb49(115)` 로 예약해도,
     * 같은 틀에 상태 틀 0x1cdec 가 진입(점프표 0xcc728) 뒤 곧장 자동 발동 0x1cf9c 로 떨어지고, 거기 1cfa6 이
     * 장면+0x165(새 선수 — 100 진입 끝 0x1c3be 가 이전 상태 104 면 켠다) ≠ 0 이면 `0x8bde0`(모드 2 → 400 · 3·4 → 451) ·
     * `0xbcb49(105)` · `0xbcb49(114)` 로 예약을 덮는다(0xbcb48: +0xc = +8 ; +8 = s — 115 는 밀려 사라진다).
     * 451 이 끝나 114 → 뒤 105 로 다시 들어오면 진입이 115 를 또 세운다 → **451 → 115**.
     * 판정은 새 선수 플래그 하나다 — "451 을 봤는가" 가 아니다(A-54: 451 도중 끊고 이어하면 원본은 다시 틀지 않는다). 굴림 없음.
     */
    if (newPlayerRef.current) {
      newPlayerRef.current = false
      const opening = story.openingEvent()
      if (opening !== null) return setScreen({ kind: '이벤트', eventId: opening.id, context: '관리' })
    }
    /*
     * **부상 엔딩** — 105 진입 0x11910 곁가지의 첫 줄(0x11b32~0x11b44): `0xa3a85(S) == 0`(부상 누적 +0x1b6 > 19)이면 0x113e8 이
     * 이벤트 500 을 번호로 틀고(0x8bdc8 — 대상 0 이라 훑기로는 안 나온다) `[다음 114, 뒤 141]` 을 예약한다(0x11442~0x11454).
     * 500 의 끝 명령(첫 종류 21)이 [0x1552adc] 를 켜 114 끝 1c088 이 141 로 간다(`completeScene`). 새 선수 오프닝 451(위)은
     * 같은 틀의 1cfa6 이 예약을 덮어 먼저다 — 451 이 끝나 105 로 다시 들어오면 진입이 500 을 다시 세운다. 0x113e8 은 500 을
     * 틀며 전역기록 +0xa8 = 1 도 쓰는데(0x11412~0x1141c) 엔딩 판 0x87c7c 가 같은 칸(+0xa8 + 0)을 다시 쓴다(`mergeEndingIntoCollection`).
     */
    if (judgeEnding(career) === 0) return setScreen({ kind: '이벤트', eventId: INJURY_ENDING_EVENT_ID, context: '관리' })
    // 나간 마선수 대결 — 곁가지 0x11b46~0x11bbe 가 112 → 140 (`pendingAceMatchScreenOf`)
    const pendingAceMatch = pendingAceMatchScreenOf(aceMatchPendingRef.current)
    if (pendingAceMatch !== null) return setScreen(pendingAceMatch)
    /*
     * 105 진입 0x11910 곁가지(0x11b24~): S+0x1b7 == 0(올해 목표 창 아직 안 봄) → **115 연초** 가 138 보다 먼저다.
     * 115 진입 0x16aac: 내장 이벤트 0x8a681 → `[다음 114, 뒤 105]` → `0xa4ee9(S)` — 마이너스 스킬 해제 기록
     * +0x1d0~+0x1d7 을 지운다(R9 7절). 그래서 해제 기록(0xa4f31)은 "그 해" 것만 남는다. 창이 닫히면 0x7fe90 이 S+0x1b7 = 1.
     * 1b8807f 앞의 옛 저장은 이 칸이 늘 거짓이라 불러온 뒤 한 번 더 115 를 본다 — 원본과의 차이 판단은 `hasSeenYearGoalWindow` 주석.
     */
    if (!career.hasSeenYearGoalWindow) {
      // 지금 칸에서 지운다 — 같은 그림에 커리어 쪽 G 가 움직였으면 내보인 커리어는 아직 지갑 값이다(위 반복 이벤트 지움과 같다)
      if (career.removedMinusSkillIds.length > 0) {
        setCareer((current) => (current === null ? current : { ...current, removedMinusSkillIds: [] }))
      }
      return setScreen({ kind: '이벤트', eventId: NARI_YEAR_START_EVENT_ID, context: '연초' })
    }
    /*
     * 타순 138 — 진입 곁가지 끝 `r4 = 0xa4c2d(S) > 0` 이면 `0xbcb49(138)` 예약(경기 뒤만이 아니라 105 진입마다). 그런데 같은 틀의
     * 자동 훑기는 다음 상태가 114 · 115 일 때만 건너뛰어(1cfdc) 138 예약 위에서도 돌고, 찾으면 `[다음 114, 뒤 105]` 로 예약을
     * 덮는다(1d03a~1d048). 그래서 **훑기가 먼저**이고 138 은 훑기가 빈 진입에서만 선다(덮인 138 은 이벤트 뒤 105 재진입이 다시 세운다).
     * 훑기 0x8be80 은 늘 무작위 조건까지 굴린다.
     */
    const orderEventId = battingOrderEventId(career)
    // 1cfe4~1d008 — 대결 대기(어느 편이든)가 서 있으면 훑지 않는다(B-124 원본 길, `isAutoScanHeldByAceMatch`)
    const event = isAutoScanHeldByAceMatch(aceMatchHoldRef.current) ? null : story.eventFor(career, EVENT_TRIGGER.관리, random)
    if (event !== null) return setScreen({ kind: '이벤트', eventId: event.id, context: '관리' })
    /*
     * **117 중간 성적표** — 진입 곁가지 11bda~11c0e: 115 다음, 138 앞. `S+0xb2 == 22 && 0xa4280(S, 모드 == 4, S+0xb3) == 0`
     * (그 해 비트 S+0x180 — `midSeasonEvaluatedYears`)이면 `0xbcb49(117)` 로 예약하고 11c1a 로 건너뛰어 138 은 안 본다.
     * 117 은 114 · 115 가 아니라 같은 틀의 자동 훑기(1cfdc)가 돌고, 찾으면 `[다음 114, 뒤 105]` 로 예약을 덮는다 — 그래서 훑기가 먼저다
     * (덮인 117 은 이벤트 뒤 105 재진입이 다시 세운다. 비트는 452~454 의 보상이 돌아야 켜진다 — `applyEventRewards`).
     * 117 진입 0x11e84: k = 0xa3de9(S, 1) → 452 · 453 · 454 · 칭호 1 · 9 를 +0x270 에 · 끝에 S+0x1cc = k → `[다음 114, 뒤 105]`.
     * 원래 웹은 116 [확인]에서 곧장 117 을 띄웠다(105 진입 · 훑기 · 저장을 건너뛰었다).
     */
    if (leagueDayCounterOf(career) === MID_SEASON_GAME && !career.midSeasonEvaluatedYears.includes(career.season - 1)) {
      const achieved = achievedGoalCount(career, '중간')
      // 11ee6~11f4a — 칭호는 +0x270 에 넣기만 한다(조건이 안 서면 +0x270 은 그대로). 팝업 · 비트는 105 둘째 틀(`pendingTitle`)
      const [midSeasonTitle] = midSeasonTitlesOf(career, achieved).filter((title) => !career.titleIds.includes(title))
      if (midSeasonTitle !== undefined) setHeldTitle(midSeasonTitle)
      setCareer({ ...career, lastMidSeasonGoalCount: achieved })
      return setScreen({ kind: '이벤트', eventId: midSeasonEventId(achieved), context: '관리' })
    }
    if (orderEventId !== null) setScreen({ kind: '이벤트', eventId: orderEventId, context: '관리' })
  }, [isManagementEntry, managementReentryCount, career, story, random, setScreen, shouldForgetRepeatable])


  /*
   * 140 진입 0x10df8 — 결과 이벤트를 틀며 대기 칸(g[0xec] · g[0xee] · g[0x11f] · g[0x144])을 지우고 전역기록을 저장한다(10f72).
   * 웹은 결과 이벤트('대결결과')가 열리는 자리면 어디서 왔든(대결을 마치고 · 105 진입에서) 칸을 지운다.
   */
  const isAceMatchResultScreen = screen.kind === '이벤트' && screen.context === '대결결과'
  useEffect(() => {
    if (!isAceMatchResultScreen) return
    aceMatchPendingRef.current.clear()
    // 대결(미션 장면)을 마치면 나리 장면 0x106 이 새로 선다(0xf684) — 105 진입에서 140 으로 온 길은 이어하기가 이미 세웠다(다시 해도 같다)
    setUpNariScene()
  }, [isAceMatchResultScreen, setUpNariScene])

  /**
   * 새 시즌 처리 `0x1b768` → 137 "N년차" → 105 관리 화면.
   * MVP 비트(career+0x1ca)는 여기서가 아니라 상태 131 이 375 를 틀기 전에 남긴다 (`enterSeasonEvent`).
   * 0x1b768 꼬리가 효과기 종류 1 · 장면+0x289 = 1 을 세우고, 부른 상태(114 · 134 · 141)의 틀이 효과기 끝에 137 을 예약한다
   * (`pages/management/lib/nariYearCover`). 난수는 1b86c 의 CPU 장비 굴림 하나뿐이고 137 은 난수를 안 쓴다.
   * `fromResume` 은 이어하기 100 진입 1c25e(S+0x50 == 0x11) · 1c308(0xa 갈래)이다 — 0x1b768 뒤 1c3be 로 빠져 137 을 바로
   * 예약하지 않지만, 100 → 1 → 100 → 1 → 105 → 115 → 114 로 가는 사이 남은 +0x289 를 연초 114 의 틀 0x1c014(1c0dc — 재생 중에도
   * 매 틀)가 효과기 끝(0x1b768 의 틀부터 9 틀째)에 받아 137 을 띄운다(r156 직접 뜸 — `nariYearCover` 의 이어하기 길).
   */
  const startNewSeason = (finished: PlayerCareer, fromResume = false, holdsPrevious = false, afterRelease = false) => {
    // 0x1b768 의 1b86c — CPU 장비 굴림 0x665e8 이 여기서 난수를 쓴다 (`nariCpuEquipment`).
    // `afterRelease` — 방출 141 의 이어하기(1be26)는 그 해 132 꼬리를 안 지났다 (`seasonStartCountersOf`, B-128)
    const next = startNextSeason(finished, random, afterRelease)
    setCareer(next)
    // 134(0x1b92c 1bb30~1bb64) · 141(0x1bbc4 1beb4~1beea)은 0x1b768 뒤에도 제 그리기를 돌며 효과기 끝을 기다린다 — 그 화면을 그대로 둔다
    if (holdsPrevious) return setYearCoverHeld(true)
    setScreen(fromResume ? { kind: '연차표지', fromResume: true } : { kind: '연차표지' })
  }

  /**
   * **116 경기 뒤 평가에 들어선다** — 진입 0x1278c 의 12c96~12cc6 이 +0x4a(평가 경기 인기도 변화)로 평가 징글 36 · 37 · 38 을
   * 낸다(`evaluationJingleIdOf`). 경기 뒤(정산 판을 나간 0x3f3 → 장면 0x106 → 100 → 116)와 이어하기(1c26a) 두 길 모두.
   * 승패 징글 31 · 32 는 경기 장면의 정산 0x19 진입이 따로 냈다 — 두 상태가 따로 서 소리도 따로다
   */
  const enterGameEvaluationScreen = (data: GameEvaluationScreenData) => {
    evaluationRewardsRef.current = null
    playSoundIds(audio, [evaluationJingleIdOf(data.evaluation.popularityChange)])
    setScreen({ kind: '경기평가', ...data })
  }

  /**
   * 시즌 끝 사슬 136 으로 — 116 끝(12b74~12bbe)이 S+0xb4 ≠ 0 이고 S+0xb2(g) == 0 이면 `0xbcb49(0x88)` · `0xbcb49(0x72)` 로
   * [114 → 136] 을 곧장 예약한다(45번째 경기 뒤 · 내 시리즈가 끝난 경기 뒤). 사이에 시즌 요약 화면은 없다 — 예전 웹 전용
   * '시즌종료' 화면(r71 에서 걷음)은 원본에 없었다. 136 진입 0x10bb0 = S+0x50 = 0xb · 0x1fded · 저장 0x22755 ·
   * 0x8bdc9(392 올해의 목표) · [114 → 130] (10bb0~10bf6). 그 해 성적은 원본에서 124 기록실 · 128 대진표 · 116 평가 창이 보인다.
   */
  const enterYearEndChain = (current: PlayerCareer) => {
    setCareer(enterSeasonEvent(current, GOAL_INTRO_EVENT_ID))
    setScreen({ kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID, context: '시즌' })
  }

  /**
   * 포스트시즌 대진 128 로 — 진입 0x120a4 가 정규시즌 우승 팝업(0xb)을 띄울지 정한다.
   * 원본은 131(MVP) 뒤와, 포스트시즌 경기 뒤(100 → 116 → 114 → 128)에 여기로 온다.
   */
  const enterPostseason = (current: PlayerCareer, fromReentry = false) => {
    // 진입 0x120a4 — S+0x50 = 0xf · 저장 (이어하기는 S+0xb4 갈래로 128 에 돌아온다)
    setCareer(current.seasonEndState === 128 ? current : { ...current, seasonEndState: 128 })
    // 이어하기(100 → 1 → 128)면 이전 상태가 1 이라 배경음 4 (`screenBgmOf`)
    setScreen({ kind: '포스트시즌', popup: regularSeasonPopupOnEnter(current), fromReentry })
  }

  /**
   * 128 이 끝났다 (팝업 7 · 8 닫힘 → 132 연말) — 연말 0x10c54 의 이벤트(501/504/502/380)를 튼다.
   * 132 진입이 S+0x50 = 9 · 저장(0x10c60) — 팝업 8 보상과 **같은 커리어 갱신**으로 적어 이어하기가 보상을 다시 주지 않는다.
   */
  const finishPostseason = (finished: PlayerCareer) => {
    setCareer({ ...finished, seasonEndState: 132 })
    setScreen({ kind: '이벤트', eventId: yearEndEventId(finished), context: '시즌' })
  }

  /**
   * 엔딩 141 로 — 번호는 141 진입 0x12300 의 `0xa3a85(S)` 판정이다. 진입은 S+0x50 = 6 을 메모리에만 쓰고 커리어를 저장하지 않는다
   * (저장은 엔딩 칸을 비운 채 — `savedCareerOf`). 보너스는 팝업 0x2b 를 닫을 때 준다(`receiveEndingBonus`)
   */
  const enterEnding = (viewed: PlayerCareer, endingIndex: number) => {
    setCareer({ ...viewed, endingIndex })
    setScreen({ kind: '엔딩', endingIndex })
  }

  const continueSeason = (viewed: PlayerCareer, viewedEventIds: readonly number[], endingRequested = false) => {
    // ── 국가대표 이벤트(461~464)는 연말 사슬 밖이다. 상태 133 이 따로 예약한 것이라 먼저 가른다 ──
    if (viewedEventIds.includes(NATIONAL_CUP_EVENT.출전)) {
      // 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 대회를 세우고 순위 화면 134 를 줄에 넣는다.
      // 134 의 틀 0x1b92c 머리가 들어온 첫 틀(장면+0x2c == 1)에 비트 8 이 없으면 칭호 8 "국가 대표" 팝업 — 화면이 띄우고
      // 확인(0x1b1e4)이 준다(`confirmCupTitle`). 진입 0x19f30 의 히든 팀 열기도 화면 몫이다(`syncOpenedHidden` 로 넣는다)
      // 0xb7bf0 대회 레코드 두 칸(+0xbc4 대표팀 · +0xbe0 첫날 상대) + 133 의 0xb53f1 — 대표팀 내 칸 t 에 내 선수 · 저장.
      // 463 보상 뒤 0x8cca2 — S+0x50 = 3(웹 null) · S+0x12c = 1 → 0x8cd44 저장: 대회 칸(L+0xa8~)째 파일에 든다(`nationalCup`)
      const entered = withNationalCupEntered(viewed)
      setCareer(entered)
      return setScreen({ kind: '국가대항전', cup: entered.nationalCup ?? createNationalCup() })
    }
    if (viewedEventIds.includes(NATIONAL_CUP_EVENT.거절) || viewedEventIds.includes(NATIONAL_CUP_EVENT.탈락)) {
      // 464 거절은 `S+0x12c = 0` 으로 바로 새 시즌이다 (P5 요약, 확정).
      // 462 탈락도 원본대로 새 시즌이다 — 114 틀 0x1c014 의 1c0a0~1c0b8 이 뒤 상태가 105 여도 관리자 +0x305/+0x306 이
      // 서 있으면 새 시즌 처리 `0x1b768` 로 간다(462 는 +0x306 갈래). 예전 "근사" 주석은 이 갈래를 못 본 것이다.
      return startNewSeason(viewed)
    }

    const step = nextSeasonStep(viewed, viewedEventIds, endingRequested)
    if (step.kind === '포스트시즌') return enterPostseason(viewed)
    if (step.kind === '이벤트') {
      // 상태 함수가 이벤트를 틀기 전에 하는 일 — 131 은 375 앞에서 MVP 비트를 남긴다
      setCareer(enterSeasonEvent(viewed, step.eventId))
      return setScreen({ kind: '이벤트', eventId: step.eventId, context: '시즌' })
    }
    if (step.kind === '엔딩') return enterEnding(viewed, step.endingIndex)
    if (step.kind === '새시즌') {
      // 연말 상태 132 → 133 국가대표 선발 판정 (`0x1a090`). 연차 idx 는 **끝난 해**의 것이라
      // 새 시즌을 올리기 전에 본다. 방출·13년차 은퇴는 위 '엔딩' 가지에서 이미 빠졌다.
      if (isCareerNationalCupYear(viewed.season - 1)) {
        setCareer(viewed)
        return setScreen({
          kind: '이벤트',
          eventId: careerNationalTeamEventId(achievedGoalCount(viewed, '연말')),
          context: '시즌',
        })
      }
      return startNewSeason(viewed)
    }
    setCareer(viewed)
    setScreen({ kind: '관리' })
  }

  /** 전역 기록의 히든 오픈 id 를 선수에게 옮긴다 — 더할 것이 없으면 그대로 둔다 */
  const syncOpenedHidden = useCallback((ids: readonly number[]) => {
    setCareer((previous) => {
      if (previous === null) return previous
      const missing = ids.filter((id) => !previous.openedHiddenIds.includes(id))
      return missing.length === 0 ? previous : { ...previous, openedHiddenIds: [...previous.openedHiddenIds, ...missing] }
    })
  }, [])

  /**
   * 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`).
   * **여기서야** 진루·아웃·득점이 경기 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다.
   *
   * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
   * 붙들어 둔 상태를 푼다 — 안 그러면 다음 타석이 영영 시작되지 않는다.
   */
  const finishDefensePlay = useCallback(
    (result?: DefensePlayResult) => {
      const current = progressRef.current
      const pending = current?.pendingDefensePlay ?? null
      if (current === null || pending === null) return

      const { bases } = current.game
      const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
      const played = result ?? runDefensePlay(pending)
      const isFoulPlay = foulPlayRef.current
      foulPlayRef.current = false
      // 파울 각 공 판을 낙구 전에 잡았다(파울 뜬공 아웃) — 이 타석에서 앞서 난 연속 파울 기록(32·33)을 정산과 함께 넘긴다
      const resolved = resolveDefensePlay(current, played, random, {
        foulRecordIds: isFoulPlay && played.foulEnded !== true ? pitchTallyRef.current.foulRecordIds : undefined,
        // 정산 0xa8024 의 타자 게이트 [sp+0x34] — 국가대항전 · 포스트시즌이면 거짓 (장내 홈런 a84d6 · 번트 안타 a8506)
        isRecorded: cupGameRef.current === null && careerRef.current?.postseason === null,
        // 파울로 닫힌 판 — 같은 틱 0x35108 이 0xb6b58 로 스트라이크를 먹인 뒤 다음 틱 0xf 진입이 교체 틱 굴림(0x344dc)을 본다.
        // 세션 카운트는 아래 `runner.applyPitch` 가 같은 규칙(`applyPitchResolution` 파울)으로 올린다
        countAfterFoul: countOf(applyPitchResolution(runner.atBatRef.current, { kind: '파울' })),
      })
      progressRef.current = resolved
      setProgress(resolved)
      if (played.foulEnded === true) {
        // 파울로 닫힌 판 — 0xae3e8 ae568 → 0xf(같은 타석 다음 공) · 0x35108 → 0xb6b58(스트라이크 ≤ 1 이면 +1).
        // 결과 코드 7 메시지 51c5c 의 연속 파울(0xa7dbc)과 파울 콜 25 가 이 판의 것이다 — 7 이 난 틱 b4562 가 0xbba 로 화면까지 가고
        // 같은 틱 0x35108 이 판을 닫는다(파울 판의 끝 틱이 곧 7 의 틱이다)
        runner.applyPitch({ kind: '파울' })
        pitchTallyRef.current = tallyPitch(pitchTallyRef.current, { kind: '파울' })
        // 파울 콜 25 는 결과 코드 7 메시지(51c5c)가 낸다 — 화면이 돌린 판이면 그 틱에 이미 났다(`DefensePlayback` 의 `tickSounds`)
        playSoundIds(audio, [
          result !== undefined ? null : inPlayCallSoundIdOf(pending.outcome, played),
          ...gameStepSoundIdsOf(current, resolved),
        ])
        runner.setIsPaused(false)
        return
      }
      // 파울 뜬공 아웃으로 타석이 끝났다 — 다음 타석은 새 카운터로 (타석 초기화 0xa5bcc 가 ctx+0x15f 를 지운다)
      if (isFoulPlay) pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
      // 배너·소리는 **판 끝 정산 0xa8024 가 낸 결과**로 낸다 — `pending.outcome` 은 판 앞 예측(`predictedOutcomeOf`)이라
      // 판이 다르게 끝나면(예: 예측 아웃인데 판에서 안타) 어긋난다. 타구 판이 아닌 결과(옛 호출)만 예측으로 남는다
      const outcome = played.outcome ?? pending.outcome
      // 판정 콜(결과 메시지 0xbba → 0x51a56)과 깊은 낙구 함성 60(슬롯 2 꼬리 52b62)은 원본처럼 판 안의 그 틱에 화면이 냈다
      // (`DefensePlayback` 의 `tickSounds`). 화면이 결과를 못 넘겨 여기서 돌린 판만 판 끝에 근사로 낸다. 진행 소리는 판 끝 그대로다
      const shownLive = result !== undefined
      playSoundIds(audio, [
        shownLive
          ? null
          : deepHitCheerSoundIdOf({
              outcome,
              carryDistance: carryDistanceOf(pending.trajectory),
              caughtOnTheFly: played.caughtOnTheFly,
            }),
        // 판정 11(2스트라이크 번트 파울)은 판 끝 결과 코드가 낸다(`played.buntFoulOut`) — 콜은 조건 없이 62 (0x51b20)
        shownLive ? null : inPlayCallSoundIdOf(outcome, played),
        ...gameStepSoundIdsOf(current, resolved),
      ])
      // 0x17 판 끝 → 판정 B 가 곧장 0xd
      finishAtBat(resolved, outcome, runnersOnBase, 0)
    },
    [audio, finishAtBat, random, runner],
  )

  /**
   * **사구의 0x12 대기 끝** (틱 31 갱신 0x4e6d4) — 화면이 대기를 센 뒤 부른다(`useHitByPitchWait`). 진행기 `judgeHitByPitch` 가
   * 4e74c 를 굴려 들어갔으면 붙든 채 두고(진입 0x3a5f0 은 다음 틀 `enterBenchClearing`), 안 들어갔으면 판정 A 0xae24c 의 보통 길
   * (밀어내기 판 · 정산) — 소리 · 타석 끝은 예전 공 도착 걸음의 볼넷 · 사구 그대로이고, 0xd 는 0x12 진입부터 32 그림 뒤라 남은 그림만 둔다.
   */
  const judgeHeldHitByPitch = useCallback(() => {
    const current = progressRef.current
    const pending = current?.pendingBenchClearing ?? null
    if (current === null || pending === null || pending.phase !== 'wait') return
    const { bases } = current.game
    const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
    const judged = judgeHitByPitch(current, random)
    progressRef.current = judged
    setProgress(judged)
    if (judged.pendingBenchClearing !== null) return
    playSoundIds(audio, [inPlayCallSoundIdOf(pending.outcome), ...gameStepSoundIdsOf(current, judged)])
    const endFrames = atBatEndFramesOf(pending.outcome, pending.arrivalPlay) - RESULT_WAIT_TICKS_AT_BAT_END
    finishAtBat(judged, pending.outcome, runnersOnBase, Math.max(0, endFrames))
  }, [audio, finishAtBat, random])

  /** **벤치 클리어링 진입** 0x3a5f0 — 판정이 0x1e 를 예약한 다음 틀에 화면이 부른다. 굴림 45 번 (`enterBenchClearing`) */
  const enterHeldBenchClearing = useCallback(() => {
    const current = progressRef.current
    if (current === null || current.pendingBenchClearing?.phase !== 'entry') return
    const entered = enterBenchClearing(current, random)
    progressRef.current = entered
    setProgress(entered)
  }, [random])

  /**
   * 벤치 클리어링 연출이 끝났다 (`BenchClearingScene` 의 `onDone`) — 출구 0xae24c 뒤 사구를 보통 길로 먹인다.
   * `reachedTargetTick` 이면 틱 10 의 굴림 8 번을 진행기가 먼저 낸다.
   */
  const finishBenchClearing = useCallback(
    (reachedTargetTick: boolean) => {
      const current = progressRef.current
      const pending = current?.pendingBenchClearing ?? null
      if (current === null || pending === null) return
      const { bases } = current.game
      const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
      const resolved = resolveBenchClearing(current, { reachedTargetTick }, random)
      progressRef.current = resolved
      setProgress(resolved)
      playSoundIds(audio, [inPlayCallSoundIdOf(pending.outcome), ...gameStepSoundIdsOf(current, resolved)])
      // 벤치 클리어링 출구 0xae24c → 밀어내기 판(0x17)을 대기 없이 바로 세우고(`useFreePassPlayStart`) 그 판 끝에서 0xd
      finishAtBat(resolved, pending.outcome, runnersOnBase, 0)
    },
    [audio, finishAtBat, random],
  )

  /**
   * CPU 견제 판을 먹인 뒤 — 판정 콜과 판에서 끊긴 타석. 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36).
   * 원본은 결과 코드가 선 플레이 틱(메시지 0xbba)에 낸다 — 화면이 실시간으로 돌린 판은 그 틱에 이미 냈으므로(`callShown`) 안 내고,
   * 미리 돌려 재생 칸에 넣은 판은 재생 화면이 기록된 틱에 낸다.
   */
  const afterCpuPickoff = (current: GameProgress, next: GameProgress, play: DefensePlayResult | null, callShown = false) => {
    // 미리 돌려 재생 칸에 새로 넣은 판은 재생 화면이 기록된 틱에 낸다(`replayCallsOnScreen`)
    const replayed = replayCallsOnScreen(current.lastDefensePlay, next.lastDefensePlay, play)
    playSoundIds(audio, [
      !callShown && !replayed && isPickoffPlayResult(play) ? pickoffCallSoundIdOf(play) : null,
      ...gameStepSoundIdsOf(current, next),
    ])
    const interrupted =
      next.game.isFinished || next.game.inning !== current.game.inning || next.game.half !== current.game.half
    if (!interrupted) return
    // 견제 판에서 반 이닝이 끝났거나(3아웃) 경기가 끝났다(끝내기 득점) — 내 타석이 끊긴다.
    // 다음 내 타석은 새 볼카운트·새 파울 카운터로 (타석 초기화 0xa5bcc)
    pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
    runner.resetAtBat()
    if (!next.game.isFinished) return
    endGame(next)
  }

  const actions = {
    syncOpenedHidden,
    /** 사구의 0x12 대기 끝 — 4e74c 판정 (`judgeHitByPitch`) */
    judgeHitByPitch: judgeHeldHitByPitch,
    /** 벤치 클리어링 진입 0x3a5f0 (`enterBenchClearing`) */
    enterBenchClearing: enterHeldBenchClearing,
    finishBenchClearing,

    /** 수비 화면이 끝났다 — 주자 처리를 이제 먹인다 */
    finishDefensePlay,

    /**
     * 재생 화면이 붙었다 — 붙어 있는 동안 재생 판으로 끝난 경기의 정산을 재생 뒤로 미룬다(`endGame`). 돌려준 함수로 뗀다.
     * 떼는 자리에서 미룬 정산이 남았으면 곧장 한다(화면이 그 판을 못 그리고 내려갔다)
     */
    attachReplayHost: () => {
      replayHostCountRef.current += 1
      return () => {
        replayHostCountRef.current -= 1
        if (replayHostCountRef.current > 0 || !isGameEndPendingRef.current) return
        const current = progressRef.current
        if (current !== null && current.game.isFinished) {
          replayedPlayRef.current = current.lastDefensePlay
          endGameRef.current(current)
        }
      }
    },

    /**
     * 중계 화면이 붙었다 — 붙어 있는 동안 경기를 끝낸 남은 중계(`autoRelay`)를 다 틀 때까지 정산을 미룬다(`endGame`, A-38). 돌려준 함수로 뗀다.
     * 떼는 자리에서 미룬 정산이 남았으면 곧장 한다(화면이 그 중계를 못 틀고 내려갔다)
     */
    attachRelayHost: () => {
      relayHostCountRef.current += 1
      return () => {
        relayHostCountRef.current -= 1
        if (relayHostCountRef.current > 0 || !isGameEndAwaitingRelayRef.current) return
        const current = progressRef.current
        if (current !== null && current.game.isFinished) {
          relayedRef.current = current.autoRelay ?? null
          endGameRef.current(current)
        }
      }
    },

    /** 중계 묶음(`autoRelay`)을 다 틀었다 — 0xc2198 이 거짓을 낸 틱. 미룬 정산이 있으면 이제 경기 끝 판 · 정산 */
    finishRelay: (relay: GameAutoRelay | null) => {
      relayedRef.current = relay
      if (!isGameEndAwaitingRelayRef.current) return
      const current = progressRef.current
      if (current !== null && current.game.isFinished) endGameRef.current(current)
    },

    /** 재생 판(`lastDefensePlay`)을 다 그렸다 — 그 판 실책(`recordFieldingErrors`)이 먼저 들어와 있다. 미룬 정산이 있으면 이제 한다 */
    finishReplay: (play: DefensePlayResult | null) => {
      replayedPlayRef.current = play
      if (!isGameEndPendingRef.current) return
      const current = progressRef.current
      if (current !== null && current.game.isFinished) endGameRef.current(current)
    },

    /**
     * 수비 그림(0x43278)이 올린 실책 +0x2e — 화면이 판 끝(`finishDefensePlay` 바로 앞)에 넘긴다. 난수 · 소리 없음.
     * 경기를 끝낸 재생 판도 정산이 재생 뒤라(`endGame` · `finishReplay`) 그 판의 실책이 요약에 든다.
     */
    recordFieldingErrors: (errors: readonly DrawnFieldingError[]) => {
      const current = progressRef.current
      if (current === null) return
      const next = recordDrawnFieldingErrors(current, errors)
      if (next === current) return
      progressRef.current = next
      setProgress(next)
    },

    /**
     * 도루 출발 (원본 키 '3' 1루 · '2' 2루 · '1' 3루 주자 → `0x53610` → 0x583 → `0xa9bd4`).
     * 주자를 출발시키고 같은 메시지의 CPU 송구 결정 0xafa60 을 한 번 돌린다(앞 판 수비가 공을 쥐었을 때만 굴림 — `startSteal`).
     * 판정은 공이 도착할 때 도루 판(종류 5)이 한다 (`arrivePitch`). 소리 없음.
     */
    stealBase: (base: StealBase) => {
      const current = progressRef.current
      if (current === null) return
      const next = startSteal(current, base, random)
      if (next === current) return
      progressRef.current = next
      setProgress(next)
    },

    /**
     * **CPU 투수의 견제** — 타석 화면(`BattingStage.onPickoff`)이 상대 투수 AI 가 목표점 대신 고른 루를 알려 준다
     * (0x345fc 종류 4 → 0x34848 → 메시지 0x10). 견제 판은 붙들어(`pendingRunnerPlay`) 수비 화면이 사람 주루 키를 받으며
     * 실시간으로 돌리고(GameRoute), 끝나면 같은 타석·같은 볼카운트로 다음 공이 이어진다 (0xae3e8 → 상태 0xf).
     * 판정 콜은 판 끝(`afterCpuPickoff`)에서 낸다.
     */
    cpuPickoff: (base: PickoffBase) => {
      const current = progressRef.current
      if (current === null) return
      const next = cpuPickoff(current, base, random, {
        isRecorded: cupGameRef.current === null && careerRef.current?.postseason === null,
        // 견제는 카운트를 안 바꾼다 — 판 끝 0xf 진입의 교체 틱 굴림(0x344dc)이 지금 카운트를 본다
        count: countOf(runner.atBatRef.current),
        // 견제 판(종류 4)은 사람 주루 키(0x5331c → 0x582 · 0x584 → 0xa9b04)와 OK 슬라이딩(0x585)을 받는다 — 붙들어 화면이
        // 실시간으로 돌리고, 판정 콜 · 끊긴 타석은 판 끝(`finishRunnerPlay`)에서 낸다
        live: true,
      })
      if (next === current) return
      progressRef.current = next
      setProgress(next)
      if (next.pendingRunnerPlay != null) {
        runner.setIsPaused(true)
        return
      }
      afterCpuPickoff(current, next, next.lastDefensePlay)
    },

    /**
     * 수비 화면이 사람 주루 키를 받으며 붙든 주자 판(도루 · 폭투 · CPU 견제 — `progress.pendingRunnerPlay`)을 다 돌렸다.
     * 결과를 못 받았으면 키 없이 끝까지 돌려서라도 붙든 상태를 푼다. 공 도착 판이면 그 공의 나머지(`continueAfterArrival`)를,
     * 견제 판이면 견제 뒤(`afterCpuPickoff`)를 잇는다.
     */
    finishRunnerPlay: (result?: DefensePlayResult) => {
      const current = progressRef.current
      const pending = current?.pendingRunnerPlay ?? null
      if (current === null || pending === null) return
      const played = result ?? runLiveRunnerPlayWithoutKeys(pending)
      const step = resolveRunnerPlay(current, played, random)
      runner.setIsPaused(false)
      if (pending.kind === 'pickoff') {
        progressRef.current = step.progress
        setProgress(step.progress)
        afterCpuPickoff(current, step.progress, played, result !== undefined)
        return
      }
      // 화면이 결과를 못 넘겨 여기서 돌린 판 — 판 안의 콜을 못 냈으니 판 끝에 낸다
      if (result === undefined) playSoundIds(audio, [step.play?.callSoundId ?? null])
      const context = arrivalContextRef.current
      arrivalContextRef.current = null
      if (context === null) {
        // 붙든 공의 값이 없다(세션이 다시 섰다) — 판만 먹이고 같은 타석으로 둔다
        progressRef.current = step.progress
        setProgress(step.progress)
        return
      }
      continueAfterArrival(current, step, context)
    },

    /** 필살 스윙이 나갔다 (`0x4e136`) — 줄인 남은 횟수를 진행기에 적는다. 난수·소리 없음 */
    spendSpecialSwing: (remaining: number) => {
      const current = progressRef.current
      if (current === null) return
      const next = spendMySpecialSwing(current, remaining)
      if (next === current) return
      progressRef.current = next
      setProgress(next)
    },

    /**
     * 돌발미션 결과 창을 닫았다 — 보상·페널티를 내 선수에게 얹고 판정을 치운다 (0x8e34c).
     * 나만의리그는 붙을 곳이 내 선수 레코드(0x1fa2d)라 커리어에 바로 얹는다.
     */
    closeBurstResult: () => {
      const current = progressRef.current
      const resolution = current?.lastBurstResolution ?? null
      if (current === null || resolution === null) return
      const cleared = { ...current, lastBurstResolution: null }
      progressRef.current = cleared
      setProgress(cleared)
      // 0x8e34c 는 내 선수 레코드(0x1fa2d)에 더하기만 하고 저장하지 않는다 — 경기 끝 정산 0x4ea0c 의 저장(4f3c0)이 함께 쓴다.
      // 경기 중 나가기(0x40140)는 저장이 없어 다시 들어오면(0x213c0 재적재) 이 보상이 없다 — StrGAME[0] "획득한 G포인트가 사라집니다"
      const player = rawCareerRef.current
      if (player === null) return
      const rewarded = applyBurstRewards(player, resolution.deltas)
      if (rewarded === player) return
      // 종류 1 사기는 0xa3a44 — 두 팀 레코드 +2 를 공마다 0xb570c 가 그 값으로 다시 덮어 다음 공부터 용량(0x66e44)이 본다.
      // 내 주력 0xb570d(ctx, 3, 나, 1, 0x5a, 1)도 그 칸으로 사기 감소를 다시 먹는다
      const moraleChanged = withGameTeamMorale(cleared, nariMoraleOf(rewarded))
      const runAbility = effectiveAbilityOf(withNariGameMorale(rewarded)).run
      const withMorale = moraleChanged === cleared || cleared.myRunAbility === undefined || cleared.myRunAbility === runAbility
        ? moraleChanged
        : { ...moraleChanged, myRunAbility: runAbility }
      if (withMorale !== cleared) {
        progressRef.current = withMorale
        setProgress(withMorale)
      }
      unsavedCareerRef.current = rewarded
      rawCareerRef.current = rewarded
      setCareer(rewarded)
    },
    /**
     * 보상 G — 미션 클리어(0x4ef72)·홈런더비 결과(0x4f6cc) 둘 다 원본은 **전역 +0x64** 에 쌓는다.
     * 지갑이 있으면 거기로 넣는다: 육성 선수가 안 올라온 화면에서도 G가 사라지지 않는다.
     * (지갑이 없는 자리는 예전처럼 커리어에 쌓고, 선수가 없으면 버린다.)
     */
    gainGamePoint: (amount: number) => {
      if (wallet !== undefined) return wallet.gain(amount)
      setCareer((current) => (current === null ? current : gainGamePoint(current, amount)))
    },
    startNewCareer: (name: string, profile: RookieProfile) => {
      // 104 등록 확정 0x10fb4 — 전역기록 +0x40 + 모드 = 1 · +0x4c + 모드 = 0 (0x112b2 · 0x112c0)
      nariGameSaveRef.current?.clear()
      saveGame.clear()
      // 104 → 100 — 나리 장면이 새로 선다(커서 0 · mgr+0x304 = 1 — 새 선수라 본 표시는 비어 있다)
      setUpNariScene()
      const created = createCareer(name, profile)
      setCareer(created)
      // 104 → 100 진입 끝 0x1c3be 가 이전 상태 104 를 보고 새 선수 플래그를 켠다 → 105 첫 틀에 오프닝 451
      newPlayerRef.current = true
      // 0x112d0~0x112dc 0xa4bd8(P, 0) · (P, 8) — 얻자마자 0xa4b04 → 0xb663c 가 켠 스킬 비트(+0xf4)도 세운다.
      // 새 선수는 아래 장착 비교 효과가 견주지 않으니(앞이 없거나 다른 선수) 여기서 적는다
      skillEquipStatEventsOf(BATTER_LEAGUE_MODE, [], created.equippedSkillIds).forEach(recordStat)
      setScreen({ kind: '관리' })
    },

    /** 환경설정 [나만의리그 초기화] — 저장을 지운다. 모드 저장 지우기 0x224ec(저장, 4) 가 +0x44 · +0x50 = 0 (0x225fa · 0x22602) */
    resetCareer: () => {
      nariGameSaveRef.current?.clear()
      saveGame.clear()
      setSavedCareer(null)
      setCareer(null)
    },

    /**
     * 이어하기 — 상태 100 진입 0x1c154 의 S+0x50 분기 (`resumePointOf`).
     * 시즌 끝 사슬 안이면 그 상태로 돌아가 그 상태가 진입에서 하는 일을 다시 한다 — 136·130·131·132 는 이벤트를 다시 틀고,
     * 128 은 진입 0x120a4 를 다시 밟는다(S+0x77 이 서 있으면 정규시즌 우승 팝업을 다시 안 띄운다).
     * 팝업 7·8 은 저장되지 않는다 — 원본도 128 [확인]이 우승 팀 발표부터 다시 띄우고, 팝업 8 보상은 132 진입과 함께 적힌다.
     *
     *
     * **S+0x50 == 2(1c26a) 면 116 을 다시 띄운다** (0x1278c 직접 떴다): 진입이 S+0x50 = 2 · 저장 뒤 S 의 칸(+7 · 사기 0xa3a25 ·
     * +0x4a 인기도 변화 · 인기도 0xb6e79 · +0x64 · +0x62 평판 · S+0x1d8 기록)으로 0x8a6fc(12b6e)를 불러 평가 내장 이벤트를 다시
     * 쌓고, 경기 뒤 카운터(12bc2~12c3c: +0x1c7 무력감 · +0x1c2 += +0x4a · 0xa4d09 · +0x1cd/+0x1c0 먹튀)를 **다시 쓴 뒤** 저장 →
     * [114 → 105/109/136/128]. 114 가 그 이벤트를 틀면 연속 기록 보상 명령도 다시 먹는다 — 이어하기마다 겹쳐 쌓인다(원본 버그 B-28 —
     * 고친 길은 카운터를 다시 쓰지 않는다. 웹의 보상 명령은 [확인] 한 번에만 먹으므로 겹치는 것은 카운터뿐이다).
     * 경기 정산(0x4ea0c — 승패 · G · 평가 0xa719c · 리그 하루)은 다시 안 돈다. 결과 판(상태 0x18)의 승패 징글도 없다.
     */
    continueSaved: () => {
      if (savedCareer === null) return
      // 장면 0x106 이 새로 선다 — 장면+0x288 = 0 (0xfb7c) · 반복 이벤트 · 커서 · mgr+0x304 (0xf684)
      setUpNariScene()
      // 100 진입 0x1c154 의 머리 1c15e `0x6e439` stopBgm — S+0x50 갈래보다 먼저 늘 부른다(r163 직접 뜸). 메인 메뉴 1 이 끊겨
      // 134 대진판 · 116 경기 결과처럼 배경음을 안 트는 자리는 소리 없이 선다. 105 · 109 · 128 · 141 은 화면 배경음 표가 이 뒤
      // 그리기에서 제 소리를 튼다(`useSceneBgm` — 번호가 1 에서 바뀐다)
      audio.stopBgm()
      const point = resumePointOf(savedCareer)
      // 1c24e — S+0x50 == 6|7 이 맨 앞 갈래다: 141 진입 0x12300 을 다시 밟는다. 보너스를 받은 뒤 저장이라(S+0x7b) 키 0x1220c 가
      // 보너스 팝업 없이 등록 팝업 0x2d 를 띄운다(`EndingScreen.isBonusReceived`)
      if (point.kind === '엔딩') {
        setCareer(savedCareer)
        return setScreen({ kind: '엔딩', endingIndex: point.endingIndex, fromResume: true })
      }
      const lastGame = savedCareer.lastGame
      if (savedCareer.seasonEndState === 116 && lastGame !== undefined) {
        // 116 진입 0x1278c 다시 — 원본은 카운터를 한 번 더 쓰고(겹쳐 쌓임, B-28) 평가 창을 다시 띄운다.
        // 고친 길(기본)은 첫 진입이 이미 센 저장 그대로 창만 다시 띄운다(굴림 없음 — 난수 차례 같음)
        const counted = isBugFixed('B-28')
          ? savedCareer
          : countGameForSkills(savedCareer, lastGame.evaluation.popularityChange)
        // 1299e 도 다시 — 비트가 이미 섰으면 팝업을 안 건다. 주는 것은 키 0x1b1e4 (`confirmGameResultTitle`)
        const dynamite = gameResultTitleOf(counted.titleIds, (lastGame.recordLine ?? lastGame.summary.stats).homeRuns)
        // 116 진입 — 평가 징글(12c96)까지. 경기 결과(경기 장면 0x18 · 0x19)는 다시 안 선다
        setCareer(counted)
        return enterGameEvaluationScreen({
          newTitles: dynamite === null ? [] : [dynamite],
          evaluation: lastGame.evaluation,
          streakNotices: streakEventOf(counted).notices,
          streakRewards: streakEventOf(counted).rewards,
        })
      }
      // 1c25e — S+0x50 == 0x11(464 거절 보상 뒤 끊김) · 1c308(0xa 갈래) → 새 시즌 처리 0x1b768 → 1c3be(0xbcb49(1)) — 남은 +0x289 를
      // 연초 114 틀이 9 틀째에 받아 137 을 띄운다(`startNewSeason` · `nariYearCover` 의 이어하기 길)
      if (point.kind === '새시즌') return startNewSeason(savedCareer, true)
      if (point.kind === '이벤트') {
        setCareer(enterSeasonEvent(savedCareer, point.eventId))
        return setScreen({ kind: '이벤트', eventId: point.eventId, context: '시즌' })
      }
      // 그 밖 갈래의 첫 줄 1c346~1c35a — S+0x12c(국가대항전 중)면 134 대진판. S+0xb4(끝난 포스트시즌)보다 먼저다(`resumePointOf`).
      // 463 끝이 S+0x50 = 3 으로 두므로 대회 중엔 늘 이 갈래다
      if (point.kind === '국가대항전') {
        // 134 의 틀 0x1b92c 머리 — 들어온 첫 틀에 비트 8 이 없으면 칭호 8 "국가 대표" 팝업. 이어하기로 들어와도 같다
        // (463 보상 뒤 끊겼으면 아직 없다 — 대회 중 끊겼으면 이미 있어 안 뜬다). 팝업 · 히든 팀 열기는 화면 몫이다
        setCareer(savedCareer)
        return setScreen({ kind: '국가대항전', cup: point.cup })
      }
      if (point.kind === '포스트시즌') return enterPostseason(savedCareer, true)
      setCareer(savedCareer)
      // 109 — 100 → 1(자원 적재) → 109 라 이전 상태가 1: 취소가 안 먹고 바닥 1, 배경음 4 (0x10d8c · 0x105f0)
      if (point.kind === '다음경기순위') return setScreen({ kind: '다음경기순위', fromManagement: false })
      setScreen({ kind: '관리' })
    },

    /**
     * **곧장 경기** — [14] 타자편·[최근게임](모드 4)의 0x327b8 모드 3·4 갈래(3288e~328b4): 전역기록 `+0x44 && +0x50` 이면
     * `0x213c0(앱, 4, 0)` 으로 타자편 저장을 올려 장면 0x104 → 셋업 0x39fdc 모드 3·4 갈래가 그 저장으로 경기를 새로 세운다
     * (나리 경기는 반 이닝 저장이 없어 그만둔 경기를 처음부터 — 같은 일정·142 가 명부에 넣은 마선수 그대로). 장면 0x106 을
     * 거치지 않아 142 진입(마선수 굴림)도 없다. 경기가 끝나면 나리 장면이 새로 서고 상태 100 0x1c154 로 이어진다.
     * 국가대항전 경기(S+0x12c)는 저장의 대회 칸과 대표팀 칸 두 개로 다시 세운다(대회가 없는 옛 웹 저장만 이어하기로).
     */
    resumeInterruptedGame: (match: NariGameMatch | null): void => {
      if (savedCareer === null) return
      // 경기 뒤 나리 장면이 새로 선다 — 장면+0x288 = 0
      matchPreparedRef.current = false
      if (match?.isNationalCup === true) {
        // 대회 경기 — 셋업 0x39fdc 모드 4 갈래가 올린 저장의 S+0x12c · 대회 칸(L+0xa8~)과 142 가 고쳐 둔 대표팀 칸 두 개로 그 경기를
        // 처음부터 다시 세운다(0x1f8f8 — 팀 10 → +0xbc4 · 그 밖 → +0xbe0). 142 를 안 거쳐 구장 굴림이 없다.
        // 대회가 없는 옛 웹 저장(대회를 저장하지 않던 때)이면 이어하기로 간다
        const cup = savedCareer.nationalCup
        const matchup = cup === undefined ? null : nationalCupMatchupOf(cup)
        if (cup === undefined || matchup === null) return actions.continueSaved()
        setCareer(savedCareer)
        return beginCupGame(savedCareer, matchup, cup)
      }
      // 마선수는 저장의 나리 팀 레코드에 있다(142 가 넣었다). 레코드가 없던 옛 저장이면 모드 저장 칸에 남겨 둔 그림자를 넣는다
      const loaded = savedCareer.nariTeams === undefined && match?.aces !== null && match?.aces !== undefined
        ? {
          ...savedCareer,
          nariTeams: seatNariMatchAces(nariTeamsOf(savedCareer), savedCareer.teamId, nextOpponentOf(savedCareer), match.aces),
        }
        : savedCareer
      setMatchAces(recordMatchAcesOf(nariTeamsOf(loaded), loaded.teamId, nextOpponentOf(loaded)))
      setCareer(loaded)
      beginGame(loaded)
    },

    runCommand: (command: ManagementCommand) => {
      if (career === null) return
      // 알림은 [확인] 을 눌러야 지워진다 — "다음경기 때까지 남긴다" 는 원본 근거가 없어 없앴다
      // [다음경기](105 칸 5) → 109 순위표 (R9). 확인하면 142 → 경기 (웹은 142 없이 곧바로 경기)
      if (command === '다음경기') return enterNextGameStandings(true)
      if (command === '휴식') {
        // 원작 [휴식] 커맨드 — 사기를 회복한다. 105 키 0x1261c 12682~126bc 는 사기 최고만 본다(행동함은 안 본다)
        if (restBlockReasonOf(career) !== null) return setManagementNotice(ORIGINAL_MODE_TEXT[91] ?? '') // StrMODE[91] (1269a)
        // 관리 화면은 팝업 0x2a "예" 뒤 127 연출(0x85230, `RestScene`)이 끝난 틀에 이 길을 부른다 — 0x19080 → 0x18e3c 의
        // 굴림 · 결과 창 · 저장이 연출 뒤라서다(연출에는 난수가 없어 굴림 차례는 그대로다)
        const rest = runRest(career, random)
        setCareer(rest.career)
        // StrMODE[24] "사기" + " " + 수치 + [83] (0x18e3c — 원문 표, 색 마크업 그대로)
        return setManagementDetail({
          before: career,
          after: rest.career,
          messages: [restResultTextOf(rest.moraleGain)],
          // 변화량 칸은 굴린 회복값 그대로 — 100 에서 잘리기 전 [sp+0x10] (0x18fb4)
          changes: restDetailChangesOf(rest.moraleGain),
          afterClose: { kind: '휴식' },
        })
      }
      if (command === '외출') {
        // B-26 — 105 에서 지도로 들어설 때의 행동함을 떠 둔다(취소 `leaveOutingMap` 이 되돌린다)
        outingEntryActedRef.current = career.hasActedThisCycle
        setOutingNotice('')
        setOutingResult(null)
        setOutingPresentation(null)
        // 112 진입 0x118e4 → 0x8cdc0 이 커서를 0 으로 되감은 **뒤에** 자동 발동 0x1cf9c 가 훑는다 — 웹은 그 훑기를 화면을
        // 바꾸기 전에 하므로 되감기를 먼저 한다
        story.rewindCursor()
        // trigger 1 — 외출 지도에 들어설 때 먼저 보는 이벤트. 0x1cf9c 는 112 에서도 105 와 같은 0x8be80 이라 무작위 조건까지
        // 굴린다(지금 trigger 1 이벤트에는 무작위 조건이 없어 굴림은 안 생긴다). 대결 대기 가드 1cfe4~1d008 도 같다(B-124)
        const event = isAutoScanHeldByAceMatch(aceMatchHoldRef.current) ? null : story.eventFor(career, EVENT_TRIGGER.외출, random)
        if (event !== null) return setScreen({ kind: '이벤트', eventId: event.id, context: '외출진입' })
        return setScreen({ kind: '외출' })
      }
    },

    /** [아이템] 하위 메뉴 → 그 탭의 상점 */
    openShop: (tab: string) => {
      setShopNotice('')
      setShopGpDetail(null)
      setScreen({ kind: '아이템', tab })
    },

    /**
     * [선수정보] 하위 메뉴 106 중 관리 화면이 직접 띄우지 않는 칸 — 키 0x13010 점프표 0xcc69c 칸 1 [장비착용] → 121
     * (장착 상점 '착용' 탭). 나머지 칸 0 기본정보 119 · 2 아이템/스킬 122 · 3 필살타법 123 · 4 기록실(팝업 0x80 → 124)은
     * 관리 화면이 스스로 띄운다(`useManagementMenu`). 예전 웹 임시 '성적' 화면(R9 500행)은 원본 106 의 다섯 칸에 없는
     * 화면이라 걷었다 — 그 화면이 보이던 시즌·통산 성적은 124 기록실, 능력치는 119/120, 칭호는 129 가 보인다.
     */
    openPlayerInfo: (itemId: string) => {
      if (itemId !== '장비착용') return
      setShopNotice('')
      setShopGpDetail(null)
      setScreen({ kind: '아이템', tab: '착용' })
    },

    /**
     * 칭호 목록(하위 상태 129)에서 하나를 골랐다 — 키 처리 0x11f78 의 확인 갈래.
     * 원본은 선수 +0x1c4 를 바꾸고 팝업(이름 + StrMODE[138])을 띄운 뒤 곧바로 저장한다(0x1fdec).
     * 웹은 커리어가 바뀌면 `useEffect` 가 저장하므로 여기서는 값만 쓴다.
     */
    equipTitle: (title: string) => {
      setCareer((current) => (current === null ? current : equipTitle(current, title)))
    },

    /**
     * 필살타법 창(상태 0x7b)에서 고른 번호(칸 + 1 = 1~4)를 선수 +0x18 에 쓴다 (틀 0x17bf4 의 0x17c64 `strb`).
     * 경기의 '0' 키(0x51e14)와 성공 확률(0x34c74)은 이 번호만 본다.
     */
    selectSpecialSwing: (number: number) => {
      setCareer((current) => (current === null ? current : selectSpecialSwingNumber(current, number)))
    },

    /** 스킬 창 대화 번호 4(장착)·3(해제) — 0x1483c `0xa4b04(P, s, on)`. 켜기 0xb663c 는 곧바로 저장(0x1f1e1)한다 — 웹은 커리어가 바뀌면 저장 효과가 돈다 */
    // 켠 스킬 통계(0xb663c)는 위 장착 목록 비교가 적는다
    equipSkill: (skillId: number, on: boolean) => {
      setCareer((current) => (current === null ? current : setSkillEquipped(current, skillId, on)))
    },

    /**
     * 스킬 창 대화 번호 6 — 슬롯 확장 (0x1484c). G 가 모자라면 아무것도 안 바뀐다(창이 StrMODE[65] 를 띄운다).
     * G 는 `career.gamePoint` 를 깎으면 지갑 다리(위 `walletBridgeRef`)가 전역 G 에 옮긴다.
     */
    expandSkillSlots: () => {
      if (career === null) return
      const result = expandSkillSlots(career)
      if (result.kind !== '확장') return
      setCareer(result.career)
      // 0x148d8 `0x22c29(모드 4 → 1, 비용)` — 타자편 소모 GP
      recordStat({ kind: 'G사용', usage: leagueUsageOf(BATTER_LEAGUE_MODE), amount: career.gamePoint - result.career.gamePoint })
    },

    /**
     * 정산 상태 0x19 진입 — 0x4ea0c 끝 4f41a~4f544: 0x4a350(이긴 칸이 사람 팀) ≠ 0 이면 31, 아니면 32 를 예약한다(무승부는 0xb6a0c 가
     * 측 0 을 이긴 칸으로 본다 — 선공 31 · 후공 32). 대회 경기도 같은 정산을 지난다
     */
    enterGameSettlement: () => {
      if (screen.kind !== '경기결과' && screen.kind !== '대회경기결과') return
      if (screen.settlementPlayerSide === undefined) return
      playSoundIds(audio, [gameResultSoundIdOf(screen.summary.result, screen.settlementPlayerSide)])
    },

    /**
     * 정산 판을 나갔다 — 키 0x407f0 의 40980~4098c `0xbfbac(+0x70, 0x3f3)`. 경기 장면 0x104 가 내려가고 나리 장면 0x106 이 서서
     * 상태 100 `0x1c154` 가 S+0x50 == 2(정산 0x4ea0c 4f03a 가 쓴 값)로 116 을 띄운다(1c26a → 진입 0x1278c)
     */
    leaveGameSettlement: () => {
      if (screen.kind !== '경기결과') return
      const { newTitles, evaluation, streakNotices, streakRewards } = screen
      enterGameEvaluationScreen(streakRewards === undefined
        ? { newTitles, evaluation, streakNotices }
        : { newTitles, evaluation, streakNotices, streakRewards })
    },

    /** 116 의 칭호 39 팝업 키 0x1b1e4 — 비트 · 곧바로 장착(+0x1c4) · 저장 (관리 화면 `confirmTitle` 과 같은 콜백) */
    confirmGameResultTitle: () => {
      if (career === null || screen.kind !== '경기평가') return
      const title = screen.newTitles[0]
      if (title === undefined || career.titleIds.includes(title)) return
      setCareer(awardTitles(career, [title]))
    },

    /**
     * 114 평가 이벤트의 보상 명령 창이 섰다 — 0x8c460 이 그 명령의 보상을 주고 끝에서 저장한다(0x8b0e4 · 0x8cd44 → 0x22755). 114 진입
     * 0x11d00 이 S+0x50 = 2 → 3(포스트시즌 g == 0 이면 0xb — 웹 null, 136 진입이 다시 쓴다)으로 둔 뒤라 그 저장부터 이어하기가 116 을
     * 다시 안 띄운다 — B-28 원본 길의 카운터 겹쳐 쌓임도 그 뒤로는 없다(Q-23). `count` 는 이제까지 준 명령 수
     */
    giveEvaluationRewards: (count: number) => {
      if (rawCareer === null || screen.kind !== '경기평가') return
      const held = evaluationRewardsRef.current
      if (held === null && rawCareer.seasonEndState !== 116) return
      const rewards = held?.rewards ?? screen.streakRewards ?? streakEventOf(rawCareer).rewards
      const given = held?.given ?? 0
      if (count <= given) return
      evaluationRewardsRef.current = { rewards, given: count }
      setCareer({ ...applyEventRewards(rawCareer, rewards.slice(given, count)), seasonEndState: null })
    },

    confirmGameResult: () => {
      if (rawCareer === null) return
      // 116 → 114: 0x8a6fc 가 쌓은 내장 이벤트를 114 가 틀며 보상 명령(연속 기록 평판 · 슬럼프 스킬)을 먹고, 114 진입 0x11d00 이
      // S+0x50 = 2 → 3 으로 둔다(웹 null — 포스트시즌 g == 0 의 0xb 는 136 진입이 다시 쓴다). 창이 선 명령은 이미 줬다
      // (`giveEvaluationRewards`) — 남은 몫만
      const held = evaluationRewardsRef.current
      evaluationRewardsRef.current = null
      const career = held !== null
        ? { ...applyEventRewards(rawCareer, held.rewards.slice(held.given)), seasonEndState: null }
        : rawCareer.seasonEndState === 116
          ? { ...streakEventOf(rawCareer).apply(rawCareer), seasonEndState: null }
          : rawCareer
      setCareer(career)
      // 경기 뒤 평가 116 의 끝(0x12b74~0x12b94) — S+0xb4(포스트시즌 중) ≠ 0 이면 **S+0xb2(= L+0x32) == 0 → [114 → 136],
      // 아니면 [114 → 128]** 이다. 관리 주기·중간평가를 안 탄다 (R9 116절).
      //   - 45번째 경기: 하루 끝 0xb818c 가 대진 0xb80a8 을 열며 L+0x32 = 0 → 136(392 목표 평가) 사슬.
      //   - 시리즈가 끝난 내 경기: 0xb76dc 의 0xb7724 가 L+0x32 = −1(b777a), 곧이어 하루 끝 0xb818c(0x4f29c)가 +1 → 0 이라
      //     **136 부터 사슬을 다시 돈다.** 136 진입 0x10bb0 은 0x8bdc9(392) 를 그대로 부르고, 0x8bdc8 → 0xae170 은
      //     레코드를 번호로 찾아 틀 뿐 본 표시를 보지 않는다 — 392 → 130(370) → 131(375) 가 보상째 다시 나오고 128 로 온다.
      //     원본 버그(B-05, 미션·대결 같은 반복 가드가 없는 자리다) — 고친 길(기본)은 대진이 막 열린 때만 사슬로 간다.
      //   - 그 밖 포스트시즌 경기: 128.
      //   116 끝은 0xbcb49(0x88 = 136) · 0xbcb49(0x72 = 114) 를 바로 예약한다(12b8c~12bbe) — 사이에 시즌 요약 화면이 없다.
      if (career.postseason !== null) {
        // B-05 고침이면 시리즈 끝(대진이 막 열린 때 말고)은 사슬을 다시 안 틀고 128 로 (`entersYearEndChainInPostseason`)
        if (leagueDayCounterOf(career) === 0 && entersYearEndChainInPostseason(career.postseason)) return enterYearEndChain(career)
        return enterPostseason(career)
      }
      if (isSeasonFinished(career)) return enterYearEndChain(career)
      // 22경기 뒤 중간 성적표 117 은 여기가 아니라 [114 → 105] 뒤 105 진입 곁가지(0x11910 11bda)가 세운다 — 22 는 짝수라 관리 주기다
      if (isManagementCycleOpen(career)) {
        return setScreen({ kind: '관리' })
      }
      // 관리 주기가 아니면 116 의 끝(0x12bb0)이 [114 → 109] 로 보낸다 — 이전 상태가 105 가 아니라 취소가 안 먹는다
      enterNextGameStandings(false)
    },

    /**
     * 대회 경기 결과 화면 [확인] — 정산 0x19 의 OK 가 나리 장면 0x106 을 새로 세우고 상태 100 `0x1c154` 가 S+0x12c 로 134 대진판에
     * 돌려보낸다(1c348~1c358). 134 진입 0x19f30 은 히든 팀을 열고(대한민국 · 우승이면 결승 상대) 대진판을 그린다.
     */
    confirmCupGameResult: () => {
      if (screen.kind !== '대회경기결과') return
      setScreen({ kind: '국가대항전', cup: screen.cup })
    },

    /** 109 순위표 확인(−5 · '5', 0x105f0) → 142 경기 준비 */
    confirmNextGameStandings: () => {
      if (career === null) return
      enterMatchPrepare()
    },

    /**
     * 142 확인(−5 · '5', 0x13cb6) — 저장 [모드+0x4c] = 1 · 저장 · 밀기 → 144 → 경기 장면 (0x15ce0).
     * 굴린 마선수(`matchAces`)는 진입이 이미 두 팀 명부에 넣었다(0xb88c8 · 0xb8870 — 마타자 명단 9번 · 마투수 투수 8번) —
     * 경기 장면이 같은 명부로 팀을 세우므로 경기에 그대로 실린다.
     * 저장 [모드+0x4c] = 1 은 전역기록(0x1f1d9) +0x4c + 모드 = "그 모드 경기가 중간 저장돼 있음" 칸이다 — 타자편은 +0x50
     * (`entities/mode-save` 의 `nariGames[4]`). 경기 장면 셋업 0x39fdc 의 모드 3·4 갈래(0x3a342)가 다시 1, 경기 끝 정산
     * 0x4f3d6 · 104 등록 0x112c0 · 모드 저장 지우기 0x224ec 가 0 으로 쓴다. ~~나리 칸은 읽는 곳이 없다~~(89a6b81 정정):
     * **0x327b8 의 모드 3·4 갈래(3289c~328b0)가 읽는다** — [14]·[최근게임] 에서 `+0x44 && +0x50` 이면 0x213c0(앱, 4, 0) 으로
     * 저장을 올려 곧장 경기 장면 0x104(`resumeInterruptedGame`), 아니면 장면 0x106. 89a6b81 의 전수는 0x327b8 을 +0x4d(모드 1
     * 갈래)로만 적었다 — 모드 2·3·4·8·9 갈래도 `기록 + m` 에 0x4c 를 더해 그 모드 칸을 읽는다. 나리 경기는 반 이닝 저장이 없어
     * (0x4f928 은 모드 1·2·8·9 만) 곧장 경기는 그 경기를 처음부터 다시 세운다.
     */
    confirmMatchPrepare: () => {
      if (career === null || screen.kind !== '경기준비') return
      // 0x13cca — 전역기록 +0x4c + 모드(+0x50) = 1 · 저장. 마선수는 커리어 저장의 나리 팀 레코드(`nariTeams`)가 들고 간다 —
      // 모드 저장 칸에는 국가대항전 여부(S+0x12c)만 남긴다(대회 칸은 커리어 저장의 `nationalCup`)
      nariGameSaveRef.current?.start({ aces: null, isNationalCup: screen.cup !== undefined })
      if (screen.cup !== undefined) return beginCupGame(career, screen.cup.matchup, screen.cup.cup)
      beginGame()
    },

    /**
     * 142 의 '4'/왼(−3) · '6'/오른(−4) — 장면+0x164 = 1/0 · 밀기(8, 0, 4/3, 1000) → **143 경기 전 엔트리 보기**(0x16af8).
     * 내 팀('4')이든 상대 팀('6')이든 보기 전용이다(0x5561c 셋째 인자 0 — `pages/management/lib/nariEntryView` 머리말).
     */
    openEntryView: (isMyTeam: boolean) => {
      if (career === null || screen.kind !== '경기준비') return
      const cup = screen.cup === undefined ? undefined : screen.cup.matchup
      setEntryView(batterNariEntryViewOf(career, isMyTeam, cup))
    },

    /** 143 키 0x1457c — 끝 코드 1 · 2(상대 팀) · 3(내 팀)이면 142 로. 142 진입은 이전이 143 이라 마선수를 다시 안 굴린다 */
    pressEntryViewKey: (key: EntryKey) => {
      if (entryView === null) return
      const pressed = pressNariEntryKey(entryView, key)
      if (!pressed.leaves) return setEntryView(pressed.view)
      setEntryView(null)
      // 142 진입 0x1c54a — 칸 번호 다시 매기기(보기 전용이라 바뀐 것이 없다)
      setCareer((current) => {
        if (current === null) return current
        const battingOrder = renumberedBattingOrderOf(current)
        return battingOrder === current.battingOrder ? current : { ...current, battingOrder }
      })
    },

    /** 웹 전용 — 143 줄을 눌러 커서를 옮긴다 */
    pointEntryViewCursor: (index: number) => {
      if (entryView !== null) setEntryView(pointNariEntryCursor(entryView, index))
    },

    /** 142 취소(−16, 0x13c72) — S+0xb4(포스트시즌) → 128 진입 0x120a4 를 다시, 그 밖 → 109 (이전 상태 142 라 취소가 안 먹는다) */
    cancelMatchPrepare: () => {
      if (career === null || screen.kind !== '경기준비') return
      const target = nariMatchCancelTargetOf({ isNationalCup: screen.cup !== undefined, isPostseason: career.postseason !== null })
      // S+0x12c → 135 (0x13c72). 135 는 진입 함수가 없어 순위표가 그대로 다시 선다
      if (target === '국가대항전' && screen.cup !== undefined) {
        return setScreen({ kind: '국가대항전', cup: screen.cup.cup, atStandings: true })
      }
      if (target === '포스트시즌') return enterPostseason(career, screen.postseasonFromReentry === true)
      enterNextGameStandings(false)
    },

    /** 109 순위표 취소(−16, 0x1060e) — 이전 상태가 105 일 때만 105 로. 그 밖에는 아무 일도 없다 */
    cancelNextGameStandings: () => {
      if (screen.kind !== '다음경기순위' || !screen.fromManagement) return
      // 105 진입 0x11910 이 S+0x50 = 3 · 저장(0x11990) — 109 의 4 를 덮는다 (웹 null)
      setCareer((current) => (current === null || current.seasonEndState !== 109 ? current : { ...current, seasonEndState: null }))
      setScreen({ kind: '관리' })
    },

    /**
     * [트레이닝] 하위 메뉴 — 연출이 끝난 뒤 불린다 (훈련 결과 0x17f5c).
     *
     * 칸 0~3(능력치 훈련)은 상세 결과 창(0x872a1)을 띄우고, 창의 키 처리(0x1d63c → 0x1b4c4)가 닫힐 때 부상을 굴린다.
     * **필살타법(칸 4)은 다른 길이다** — `0x18bd8` `[sp+0x40](칸) == 4` 면 결과 글([sp+0xfc]: StrMODE[87] 또는 [86]
     * `!N` 사기)을 **알림 창** `0xbbef8(글, 1, 코드 4, 1)`(OK 한 개)에 띄우고 곧장 공통 끝(0x18d66)으로 간다.
     * 그 창이 닫히면 상태 125 의 틀 `0x18dd8` 이 "팝업 닫힘 · 코드 4 · 결과 0/0x14" 를 보고 **105(관리 화면)** 로만 간다.
     * 부상 굴림 0x1b4c4 는 상세 창 콜백(0x1d63c)에서만 불리므로 **필살타법 뒤에는 부상을 굴리지 않는다.**
     * (0x1b4c4 안의 "칸 == 4 면 필살 확률" 갈래는 그래서 원본에서도 안 걸린다 — 그대로 둔다.)
     */
    runTrainingMenu: (menuId: string) => {
      const menu = TRAINING_MENUS.find((candidate) => candidate.id === menuId)
      if (career === null || menu === undefined) return

      const outcome = runTraining(career, menu, random)
      const trained = outcome.career
      setCareer(trained)
      const changes = trainingDetailChangesOf(outcome)
      // 필살타법 — 상세 창 대신 알림 창 하나(관리 화면 알림 상자, [확인] → 관리 화면).
      // 비용은 훈련 적용 0xa3bac 종류 4 가 G 를 빼고 0xa3cac `0x22c29(모드 4 → 1, |비용|)` 로 적는다
      if (changes === null) {
        recordStat({ kind: 'G사용', usage: leagueUsageOf(BATTER_LEAGUE_MODE), amount: specialSwingCostOf(career) })
        // 알림 창이 닫히면 125 틀 0x18dd8 이 105 로 — 그 105 진입(`dismissManagementNotice`)
        specialSwingNoticeRef.current = true
        return setManagementNotice(trainingOutcomeLinesOf(outcome, BATTING_TYPE_NAMES[career.battingTypeIndex]).join('!N'))
      }
      setManagementDetail({
        before: career,
        after: trained,
        messages: trainingOutcomeLinesOf(outcome, BATTING_TYPE_NAMES[career.battingTypeIndex]),
        // 변화량 칸은 굴린 값 그대로 — 훈련 칸 [sp+0x34] · 사기 칸 −[sp+0x38] (0x18d0e~0x18d38)
        changes,
        // 이 창은 칸 0~3 에서만 뜬다 — 0x1b4c4 가 보는 칸은 4 가 아니다
        afterClose: { kind: '훈련', isSpecialSwing: false },
      })
    },

    /** 결과 창을 닫는다 — 훈련은 부상(0x1b4c4), 휴식은 회복(0x1b308)을 이때 굴린다 */
    closeManagementDetail: () => {
      if (career === null || managementDetail === null) return
      const { afterClose } = managementDetail
      setManagementDetail(null)
      // 창을 닫으면 125(훈련 0x1b5b8) · 127(휴식 0x1b466)이 `0xbcb49(0x69)` 로 105 에 다시 들어온다 — 진입 · 자동 훑기
      reenterManagement(afterClose.kind === '훈련' ? NARI_STATE.훈련결과 : NARI_STATE.휴식)
      if (afterClose.kind === '훈련') {
        const injury = rollTrainingInjury(career, afterClose.isSpecialSwing, random)
        setCareer(injury.career)
        injuryNoticeRef.current = injury.notice !== null
        return setManagementNotice(injury.notice ?? '')
      }
      const recovery = recoverAfterRest(career, random)
      setCareer(recovery.career)
      setManagementNotice(recovery.recoveries.join(' · '))
    },

    /** 관리 화면 알림 상자 [확인] — 알림은 여기서만 지운다 (화면이 기억하면 같은 문구가 다시 안 뜬다) */
    dismissManagementNotice: () => {
      // 부상 0x28 을 닫았다 — 1af3c~1af7e 가 곧바로 0x29 StrMODE[212] 를 띄운다
      if (injuryNoticeRef.current) {
        injuryNoticeRef.current = false
        return setManagementNotice(INJURY_FOLLOW_UP_NOTICE)
      }
      setManagementNotice('')
      // 필살타법 결과 알림이면 125 틀 0x18dd8 이 105 로 — 105 진입
      if (specialSwingNoticeRef.current) {
        specialSwingNoticeRef.current = false
        reenterManagement(NARI_STATE.훈련결과)
      }
    },

    /** 화면이 '관리' 인 채 105 에 다시 들어온다 — 하위 메뉴 106 · 107 · 110 취소 (0x11910 진입 · 0x1cf9c 자동 훑기) */
    reenterManagement,

    /** 105 관리 메뉴 확인 키(−5 · '5') — 0x12654 가 메뉴 칸을 보기 전에 mgr+0x304 = 0 (490 쿨다운 검사가 다시 선다) */
    pressManagementConfirm: story.pressManagementConfirm,

    /** 칭호 팝업 확인 0x1b1e4 — 비트·곧바로 장착(+0x1c4)·저장 · +0x270 = −1, 다음 틀에 다시 판정 */
    confirmTitle: () => {
      if (career === null || pendingTitle === null) return
      setHeldTitle(null)
      setCareer(awardTitles(career, [pendingTitle]))
    },

    isRestBlocked: () => career === null || restBlockReasonOf(career) !== null,

    showTrainingBlocked: (menuId: string) => {
      const menu = TRAINING_MENUS.find((candidate) => candidate.id === menuId)
      if (career === null || menu === undefined) return
      const reason = blockReasonOf(career, menu)
      if (reason !== null) setManagementNotice(trainingBlockTextOf(reason, menu.name))
    },

    isTrainingBlocked: (menuId: string) => {
      const menu = TRAINING_MENUS.find((candidate) => candidate.id === menuId)
      return career === null || menu === undefined || blockReasonOf(career, menu) !== null
    },

    runOutingFunction: (functionId: string) => {
      const outingFunction = OUTING_PLACES.flatMap((place) => place.functions).find(
        (candidate) => candidate.id === functionId,
      )
      if (career === null || outingFunction === undefined) return
      // 113 가드 0x16cf0 — 막히면 원문 팝업(StrMODE[62]·[77]·[196]·[91])만 띄우고 113 에 남는다 (굴림 없음).
      // 앞서 웹은 판정 없이 runOuting 을 불러 막힌 기능을 고르면 예외가 났다.
      const reason = outingBlockReasonOf(career, outingFunction)
      if (reason !== null) return setOutingNotice(outingBlockTextOf(reason, outingFunction))

      // 113 → 126: 연출(0x85074 — event_ani · event_char_1 · event_char_0 세 겹, `outingPresentation`)이 끝난 틀에 효과(0x15234)를
      // 굴려 효과 팝업을 지도 위에 띄우고(`finishOutingPresentation`), 그 팝업이 닫히면 입원 회복(0x1575c)을 굴린다
      const place = OUTING_PLACES.find((candidate) => candidate.functions.includes(outingFunction))
      setOutingNotice('')
      setOutingPresentation({ functionId, place: (place?.frame ?? 1) - 1 })
    },

    /** 126 연출 끝(0x84e58 이 참인 틀) — 효과 0x15234 를 굴려 효과 팝업을 띄운다. 연출 동안 굴림은 없다 */
    finishOutingPresentation: () => {
      if (career === null || outingPresentation === null || outingResult !== null) return
      const outingFunction = OUTING_PLACES.flatMap((place) => place.functions).find(
        (candidate) => candidate.id === outingPresentation.functionId,
      )
      if (outingFunction === undefined) return
      const outcome = performOuting(career, outingFunction, random)
      setOutingResult({ effectText: outcome.effectText, recoveryText: outcome.recoveryText })
      setCareer(outcome.career)
    },

    /**
     * 113 취소 → 112 — 키 0x16c64 의 −16 이 `0xbcb49(0x70)`: 112 진입 0x118e4 가 [!] 를 다시 찍고(0x8cdc0 — 커서 0) 그 틀의 자동 발동
     * 0x1cf9c 가 화면 112 로 훑는다(0x8be80 — 무작위 조건까지 · 대결 대기 가드 B-124). 찾으면 [다음 114, 뒤 112] (Q-22)
     */
    reenterOutingMap: () => {
      if (career === null) return
      setOutingReentryCount((count) => count + 1)
      story.rewindCursor()
      const event = isAutoScanHeldByAceMatch(aceMatchHoldRef.current) ? null : story.eventFor(career, EVENT_TRIGGER.외출, random)
      if (event !== null) setScreen({ kind: '이벤트', eventId: event.id, context: '외출진입' })
    },

    /** 113 막힘 팝업(0xbbef9(글, 1, 1, 1)) [확인] — 상태는 113(말풍선) 그대로다 */
    closeOutingNotice: () => setOutingNotice(''),

    /**
     * 112 외출 지도 취소(CLR) → 105 — 키 0x13ba4 13bc0~13bca 가 **S+4(행동함) = 0** 으로 내린 뒤 0xbcb49(0x69) · 0x7ff21.
     * 원본 버그(B-26): 행동함 뒤 흑백 외출 칸으로 들어갔다 취소하면 트레이닝 · 휴식 · 외출 칸이 다시 켜진다 — 고친 길(기본)은 들어설 때 값으로.
     * 저장은 이 키가 아니라 이어지는 105 진입 0x11910(119a2)이 한다 — 웹은 커리어가 바뀌면 저장한다
     */
    leaveOutingMap: () => {
      // B-26 고침이면 들어설 때의 값으로 되돌린다 (`actedAfterOutingMapCancel`)
      const acted = career === null ? false : actedAfterOutingMapCancel(career.hasActedThisCycle, outingEntryActedRef.current)
      outingEntryActedRef.current = null
      if (career !== null && career.hasActedThisCycle !== acted) setCareer({ ...career, hasActedThisCycle: acted })
      setScreen({ kind: '관리' })
    },

    /**
     * 126 효과 팝업 [확인] — 틀 0x1575c: 입원이면 회복 글 팝업(코드 1)을 띄우고, 어느 쪽이든 **105(관리)** 로 간다.
     * 회복 팝업은 105 위에 남으므로 관리 화면 알림 상자로 띄운다.
     */
    closeOutingResult: () => {
      if (outingResult === null) return
      setOutingResult(null)
      setOutingPresentation(null)
      if (outingResult.recoveryText !== '') setManagementNotice(outingResult.recoveryText)
      setScreen({ kind: '관리' })
    },

    /** 상점에서 한 칸을 고른다 (장착·서브·GP — shopSelection) */
    purchase: (itemId: string) => {
      if (career === null) return
      const selection = selectShopItem(career, itemId, random)
      setShopNotice(selection.notice)
      setShopGpDetail(selection.detail ?? null)
      setCareer(selection.career)
      // 장비 구매 0x14a74 — 구매 완료 창 없이, 새로 연 컬렉터마다 0x62368 → 공용 창(구매 확인 창이 닫힌 뒤 대기 칸에서 선다)
      if (selection.openedHiddenIds !== undefined && selection.openedHiddenIds.length > 0) {
        announceHiddenOpen?.(selection.openedHiddenIds)
      }
      // GP 칸 구매가 확정됐으면(G 를 뺐으면) 0x14ffe `0x22e35(모드 4, 칸)` → 0x1501e `0x22c29(1, 가격)`
      const [tab, first] = itemId.split(':')
      if (tab === 'GP' && selection.career !== career) {
        const index = Number(first)
        recordStat({ kind: 'GP아이템구매', mode: BATTER_LEAGUE_MODE, index, price: BATTER_GP_ITEMS[index].price })
      }
    },

    /** GP 결과 창 닫기 — 콜백 0x1d649 는 팝업만 닫는다 (굴림 없음) */
    closeShopGpDetail: () => setShopGpDetail(null),

    /**
     * **마선수 대결로 나가는 장소 이벤트의 끝 처리** — 이벤트 관리자 0x8cf64 의 match(SYS 8, 0x8d734~0x8d904)는 미션
     * 장면으로 가는 전환(0xbdae9)을 걸고 0x8a380 으로 관리자를 비운 뒤 **1(끝남)** 을 돌려준다 — 보통 이벤트 끝(0x8d506 →
     * 0x8d8ee)과 같은 꼬리다. 그래서 같은 틀의 114 끝 처리 0x1c014 가 그 자리에서 돌아, 뒤 상태가 113(장소)이고
     * +0x167 == 0 이면 S+4 = 1(행동함) · S+0x6a(외출 수)++ · 105 · 저장(0x1fded · 0x22755)을 한다.
     * 결과 이벤트(140 → `[다음 114, 뒤 105]`)의 끝에서는 장소 끝 처리를 다시 하지 않는다 (`대결결과`).
     * match 는 빈 장소 이벤트(440~444, +0x167 = 1)에 없다.
     */
    settlePlaceForAceMatch: () => {
      if (career === null) return
      const visited = spendCycleAction({ ...career, outingsThisSeason: career.outingsThisSeason + 1 })
      setCareer(visited)
    },

    /**
     * **SYS 8 타자편 갈래**(0x8d782~0x8d7ce) — g[0xf7] = team − 1 · g[0xec]/g[0xee] = 결과 이벤트 · g[0x11f] = 1 · g[0x144] = 0 ·
     * g[0xf6] = 모드 → 전역기록 저장(8d84a) · 지금 이벤트 본 표시(8d85c) · 커리어 저장(8d870). match 가 끝남을 돌려 114 끝
     * 0x1c014 의 0x8b0e4 가 떠나온 줄도 본 표시 · 저장한다. 대결을 나가도(0x40140) 이 칸들은 저장에 남는다.
     */
    holdAceMatch: (resultEvents: readonly number[], viewedEventIds: readonly number[]) => {
      // 8d84a 전역기록 저장 — 대기 칸
      aceMatchPendingRef.current.hold(resultEvents)
      // 8d85c · 8d870 — 본 표시 · 커리어 저장
      setCareer((current) => current === null ? current : markRewardedEvent(current, null, viewedEventIds))
    },

    /**
     * [!] 장소에서 [들어가기] — 0x8ce58: 112 진입에 찍어 둔 그 장소 칸의 이벤트를 본다(다시 훑지 않는다).
     * 113 칸 0 (키 0x16c64 의 0x16c8a~0x16cee, 직접 떴다)에는 행동(S+4) · 인기도 가드가 없다(가드 0x16cf0 은 칸 1
     * 장소 기능 쪽). 모드 갈림도 없어 투수편 `enterOutingPlace` 와 같다. 이벤트를 고르는 데 굴림은 없다.
     */
    enterPlace: (place: OutingPlace) => {
      if (career === null) return
      // 칸이 비었으면 "특별한 일이 없다" (0x16ccc — 440 + 장소)
      const eventId = outingSlots.get(place.id) ?? emptyPlaceEventId(place.frame)
      setScreen({ kind: '이벤트', eventId, context: '장소' })
    },

    /**
     * 이벤트의 system 창(알림 · 올해의 목표)을 답 0 으로 닫았다 — 0x8d928~0x8d942 의 0x7fe90: S+0x1b7 = 1 · 저장(0x22755).
     * 하위와 상관없이 모든 system 창이다. 웹 저장은 커리어가 바뀔 때마다라 이미 켜져 있으면 바뀌는 것이 없다.
     */
    confirmEventSystemWindow: () => {
      setCareer((previous) => (previous === null || previous.hasSeenYearGoalWindow ? previous : { ...previous, hasSeenYearGoalWindow: true }))
    },

    /**
     * 이벤트의 보상 명령 7 하나를 그 자리에서 준다 — 0x8d4c4 가 글 · 창을 세운 그 갱신의 0x8c460(모드 4 갈래). 이벤트 번호는 그
     * 명령이 든 이벤트다(연차 보정 0x8d508 이 지금 이벤트를 본다). 재생 화면이 `StoryScreen.onReward` 로 부르면 `completeScene` 에
     * 오는 보상은 비어 있다. 종류 7 의 히든 오픈 알림(0x62368 → 공용 창)은 재생 화면이 그 명령의 알림 창으로 띄우고 확인까지
     * 기다린다(`rewardNoticeOf` — 기다림 0x8daa0) — 여기서 따로 띄우지 않는다.
     *
     * **저장**: 원본 0x8c460 은 항목을 다 준 뒤 본 표시 · 장소 행동함을 하고 **곧바로 저장한다**(0x8b0e4 → 0x22755, 나리면 다시
     * 0x8cd44 → 0x22755 · 0x1f1b9 — `markRewardedEvent`). 그래서 웹이 커리어가 바뀔 때마다 저장하는 것이 이 자리에서는 원본보다
     * 잦지 않다 — 다만 그 저장에 본 표시 · 행동함이 들어야 이벤트 도중에 끄고 이어할 때 같은 이벤트가 다시 서지 않는다(원본 그대로).
     */
    giveEventReward: (items: readonly EventReward[], eventId: number, viewedEventIds: readonly number[] = [eventId]) => {
      if (career === null || screen.kind !== '이벤트') return
      const rewarded = applyEventRewards(career, items, random, eventId)
      // 보상 19(0x8ca7e)는 타순 칸이 아니라 레코드를 고친다 — `0xb5d09(내 팀, 내 칸, 값 − 1)` 로 셋이 돈다
      const orderMoves = applyBattingOrderRewards(
        career,
        items.filter((reward) => reward.kind === EVENT_REWARD_KIND.타순).map((reward) => reward.value),
      )
      const given = orderMoves === null ? rewarded : { ...rewarded, ...orderMoves }
      // 이벤트 G 보상 0x8c6ac 는 한 줄마다 0x8c6e2 `0x22c7d(값, 전역 모드)` 로 적는다
      items
        .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
        .forEach((reward) => recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: reward.value }))
      const marked = markRewardedEvent(given, storyEvents?.find((event) => event.id === eventId) ?? null, viewedEventIds)
      // 8cc1a 0x8b0e4 의 0x8b12c — 112(외출 진입) · 113(장소)에서 연 이벤트면 440~444 를 빼고 행동함(S+4)을 켠 채 저장한다
      const acted = withOutingEventActed(marked, screen.context === '장소' || screen.context === '외출진입', eventId)
      // 8cc2e — 이벤트 번호로 이어하기 자리(S+0x50)를 고치고 8cd44 에서 다시 저장한다 (`withRewardResumePatch`)
      setCareer(withRewardResumePatch(acted, eventId, items))
    },

    /**
     * 선택지 확인 — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 · 112/113 에서 연 이벤트면 S+4(0x8b12c — 지금
     * 이벤트가 440~444 가 아니면) · 저장. 웹 저장은 커리어가 바뀌면 고리가 한다 — 안 바뀌면 원본 저장도 같은 내용이다.
     */
    confirmEventChoice: (eventId: number, leftEventIds: readonly number[]) => {
      if (career === null || screen.kind !== '이벤트') return
      const marked = markRewardedEvent(career, null, leftEventIds)
      const acted = withOutingEventActed(marked, screen.context === '장소' || screen.context === '외출진입', eventId)
      if (acted !== career) setCareer(acted)
    },

    /**
     * 재생 끝(114 끝 0x1c014). `endingEventId` 는 첫 종류 21 로 끝난 이벤트(0x8d4ce — [0x1552adc] = 1)다: 그 이벤트는 본 표시를
     * 안 하고(0x8cf8c 를 안 지난다) 거친 다른 이벤트는 0x8b0e4 가 본 표시한다. 엔딩은 그 칸으로 간다(`nextSeasonStep`).
     * 엔딩 이벤트(첫 종류 21 — 500 · 501 · 503 · 504, 모두 대상 0)를 트는 곳은 원본에서 둘이다: 시즌 끝 사슬(132 의 501 · 504 ·
     * 502 → 496 → 503)과 105 진입의 부상 엔딩 500(0x11b32 → 0x113e8). 1c088 은 뒤 상태가 113 이 아닌 114 끝마다 그 칸을 보고,
     * 틀 0x1cdec 의 1d056(105 · 112 에서 훑기가 비었을 때)은 113 끝이 남긴 칸을 보는데 장소에서는 종류 21 이벤트에 닿지 않는다.
     */
    completeScene: (rewards: readonly EventReward[], viewedEventIds: readonly number[], endingEventId: number | null = null) => {
      if (career === null || screen.kind !== '이벤트') return
      if (screen.context === '연초') {
        // 내장 이벤트라 본 표시·보상이 없다. 목표 창이 닫히면 0x7fe90 이 S+0x1b7 = 1 (해마다 한 번) → 뒤 105
        setCareer({ ...career, hasSeenYearGoalWindow: true })
        return setScreen({ kind: '관리' })
      }
      const seenIds = endingEventId === null ? viewedEventIds : viewedEventIds.filter((id) => id !== endingEventId)
      const rewarded = applyEventRewards(finishEvent(career, seenIds), rewards, random, screen.eventId)
      // 보상 19(0x8ca7e)는 타순 칸이 아니라 레코드를 고친다 — `0xb5d09(내 팀, 내 칸, 값 − 1)` 로 셋이 돈다
      const orderMoves = applyBattingOrderRewards(
        career,
        rewards.filter((reward) => reward.kind === EVENT_REWARD_KIND.타순).map((reward) => reward.value),
      )
      const viewed = orderMoves === null ? rewarded : { ...rewarded, ...orderMoves }
      // 이벤트 G 보상 0x8c6ac 는 한 줄마다 0x8c6e2 `0x22c7d(값, 전역 모드)` 로 적는다 (G 보상에는 연차 보정이 없다)
      rewards
        .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
        .forEach((reward) => recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: reward.value }))
      // 보상 종류 7 — 0x8c60e `0x62368(전역, |v|, 1)`: 셋째 인자 1 이라 이미 열렸어도 늘 공용 창(떠 있으면 대기 칸)
      const hiddenIds = rewards
        .filter((reward) => reward.kind === EVENT_REWARD_KIND.히든오픈)
        .map((reward) => Math.abs(reward.value))
        .filter((id) => hiddenOpenNoticeTextOf(id) !== null)
      if (hiddenIds.length > 0) announceHiddenOpen?.(hiddenIds)

      if (screen.context === '장소') {
        // 빈 장소(440~444)는 **행동·외출 횟수를 쓰지 않고** 장소 화면으로 돌아간다 (0x1c014, G-4).
        // 앞서 웹은 빈 장소에서도 행동을 썼다 — 원본과 반대였다.
        if (isEmptyPlaceEventId(screen.eventId)) {
          setCareer(viewed)
          // 1c07c — +0x167 을 지우고 113(그 장소 말풍선)으로. 112 진입이 아니라 [!] 다시 찍기 · 자동 발동이 없다(Q-22)
          const frame = emptyPlaceFrameOf(screen.eventId)
          const place = OUTING_PLACES.find((candidate) => candidate.frame === frame)
          return setScreen(place === undefined ? { kind: '외출' } : { kind: '외출', openPlaceId: place.id })
        }
        // 장소 이벤트도 외출이다 — 행동을 쓰고 외출 횟수(칭호 "1년간 외출")에 센다
        const visited = spendCycleAction({ ...viewed, outingsThisSeason: viewed.outingsThisSeason + 1 })
        setCareer(visited)
        return setScreen({ kind: '관리' })
      }
      if (screen.context === '시즌') return continueSeason(viewed, viewedEventIds, endingEventId !== null)
      // 114 끝 1c088 — 뒤 상태가 113(장소)이 아니면 [0x1552adc](첫 종류 21 로 끝남)를 지우고 141. 부상 엔딩 500(105 진입
      // 0x113e8)이 이 길이다. 장소(위)에서 끝난 종류 21 은 원본도 칸을 남겨 두고 105 · 112 틀 1d056 이 141 로 보내는데, 종류 21
      // 이벤트(500 · 501 · 503 · 504)는 대상 0 이라 훑기로 안 나오고 장소 이벤트의 선택지 · 예아니오 · 경기 결과도 그리로 안
      // 이어져(가리키는 곳은 496 → 503 하나) 원본 데이터로는 닿지 않는다.
      if (endingEventId !== null) return enterEnding(viewed, judgeEnding(viewed) ?? NO_ENDING_JUDGEMENT)
      if (screen.context === '외출진입') {
        // 114 끝 0x1c014 → 0x8b0e4(1c02e)의 0x8b12c — 112 에서 연 이벤트도 행동함(S+4)을 켜고 저장한다. 뒤 112 라 장소 끝
        // 처리(외출 수)는 없다. 지금 이벤트 번호는 연 이벤트로 본다(외출 진입 이벤트는 440~444 가 아니다)
        const acted = withOutingEventActed(viewed, true, screen.eventId)
        setCareer(acted)
        // 114 → 112 — 상태가 바뀐 틀이라 112 진입 0x118e4(0x8cdc0 이 커서를 0 으로) 뒤 자동 발동 0x1cf9c 가 화면 112 로 다시
        // 훑는다(0x8be80 — 무작위 조건까지). 찾으면 또 [다음 114, 뒤 112]
        story.rewindCursor()
        const again = isAutoScanHeldByAceMatch(aceMatchHoldRef.current) ? null : story.eventFor(acted, EVENT_TRIGGER.외출, random)
        if (again !== null) return setScreen({ kind: '이벤트', eventId: again.id, context: '외출진입' })
        return setScreen({ kind: '외출' })
      }
      setCareer(viewed)
      setScreen({ kind: '관리' })
    },

    /** 경기 중 [메뉴] → 나가기. StrGAME[0] "현재 이닝의 기록과 획득한 G포인트가 사라집니다" */
    quitGame: () => {
      // 상태 0x22 → 장면 0x103 은 전역 경기 상태를 안 지운다 — 나간 그 이닝이 +0x6b 에 남는다
      if (progressRef.current !== null) {
        setLiveGameInningIndex(progressRef.current.game.inning - 1)
        setLiveGameSides(liveGameSidesOf(progressRef.current, progressRef.current.game))
      }
      progressRef.current = null
      setProgress(null)
      runner.resetAtBat()
      pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
      foulPlayRef.current = false
      runner.setIsPaused(true)
      setScreen({ kind: '메인메뉴' })
    },

    finishLoading: () => {
      setLoadingTip(null)
      runner.setIsPaused(false)
      // 경기 시작 인트로 예약음 61 (상태 0xc). 웹에는 인트로 화면이 없어 로딩이 끝나는 자리다 — 근사
      playSoundIds(audio, [GAME_INTRO_SOUND])
    },

    /**
     * 대진 화면 128 [확인] — 키 0x13da0. 팝업이 떠 있으면 키가 안 먹는다(0x1d06a 의 0x754f9 검사).
     * 끝났으면 우승 팀 발표(팝업 7), 내 차례면 142 경기 준비(→ 144 → 경기 장면),
     * 아니면 CPU 끼리 돌려 바뀐 대진을 보여 주고 128 에 머문다.
     */
    pressPostseason: () => {
      if (career === null || career.postseason === null) return
      if (screen.kind !== '포스트시즌' || screen.popup !== null) return
      // 0x13da0 의 세 갈래 (`pressPostseasonBracket` 과 같은 차례) — CPU 끼리 경기(0xc2760)는 리그 표의 +0x2c 로 서고
      // 깎인 값을 남긴다(회복 없음). 그래서 CPU 갈래는 표를 잇는 `applyPostseasonCpuGames` 로 돌린다
      const series = career.postseason
      if (series.round === '종료') {
        return setScreen({ ...screen, popup: { kind: '우승발표', champion: series.champion ?? -1 } })
      }
      // 내 차례 → 142 경기 준비 (0x13da0)
      if (isMyTurn(series, career.teamId)) return enterMatchPrepare(screen.fromReentry === true)
      setCareer(applyPostseasonCpuGames(career, random, aceLevels))
    },

    /** 대진 화면 128 의 팝업 닫힘 — 틀 0x15984 */
    closePostseasonPopup: () => {
      if (career === null || screen.kind !== '포스트시즌' || screen.popup === null) return
      const popup = screen.popup
      if (popup.kind === '정규시즌우승') {
        // 팝업 0xb — 보상을 얹고 128 에 머문다
        const otherModes = readRegularSeasonOtherModes?.()
        const rewarded = applyRegularSeasonReward(career, REGULAR_SEASON_HIDDEN_ID.타자편, otherModes)
        setCareer(rewarded)
        // 0x15c4e · 0x15c76 의 0x62369 — 새로 열었으면 공용 창 알림 (0x29 먼저, 타자편 0x22 는 대기)
        announceHiddenOpen?.(regularSeasonOpenedHiddenIds(career, rewarded, otherModes))
        return setScreen({ ...screen, popup: null })
      }
      if (popup.kind === '우승발표') {
        const next = popupAfterChampion(career, popup.champion)
        if (next !== null) return setScreen({ ...screen, popup: next })
        return finishPostseason(career)
      }
      // 팝업 8 — 한국시리즈 우승 보상 뒤 132
      finishPostseason(applyKoreanSeriesReward(career))
    },

    /**
     * **웹 전용 디버그(시험용 진입점)** — 지금 커리어로 136 연말 사슬을 곧장 튼다. 화면은 이 길을 부르지 않는다:
     * 원본 길은 116 끝(`confirmGameResult`)이 [114 → 136] 으로 곧장 간다(`enterYearEndChain`).
     */
    beginYearEnd: () => {
      if (career === null) return
      enterYearEndChain(career)
    },

    /**
     * 매치업 화면(135) [확인](0x10680) → **경기 준비 142** → [확인] → 사람 경기.
     * `0x1c46c` 가 내 팀을 `0xb7614(L,n,0)`(= 대한민국)로 바꿔 끼우므로 팀 10 으로 친다. S+0x12c 라 마선수 넣기(1c5fe)를
     * 건너뛰고 장면+0x288 만 세운다. 이전 상태가 143 이 아니면 구장 `0x78664(무대, 홈 팀)` — 대회 팀은 10~13 이라
     * **rand(0, 10) 한 번**(취소로 135 에 갔다 다시 와도 또 굴린다).
     *
     * 경기는 **내 선수가 낀 대표팀 칸**(+0xbc4, 133 의 `0xb53f1`)과 그날 상대국 칸(+0xbe0)으로 선다 (`nariCupTeams`).
     * 같은 문(장면+0x288) 안에서 대회 날짜 g ≠ 0 이면 두 칸 투수를 한 칸 돌린다(1c574).
     */
    startCupGame: (matchup: NationalCupMatchup, cup: NationalCup) => {
      if (career === null) return
      // 142 진입 0x1c46c(0x1c47a) — +0x6b = 0
      resetLiveGameState()
      if (!matchPreparedRef.current) {
        // 1c574 — 대회 날짜 g ≠ 0 이면 대표팀·상대국 칸 투수 0~3 을 한 칸씩 돌린다(영구, 같은 문 안이라 한 번만)
        setCareer((current) => current === null
          ? current
          : { ...current, nariCupTeams: prepareNariCupMatch(cupTeamsOf(current, matchup.opponent), cup.day) })
      }
      matchPreparedRef.current = true
      // 홈 팀 = 후공 측(0xb7844 L+0xac 갈래 — 대진 칸 0). 대회 팀은 모두 > 9 라 어느 쪽이든 한 번 굴린다
      setMatchInfoStage(rollNariMatchInfoStage(random, {
        mode: BATTER_LEAGUE_MODE,
        myTeamId: matchup.myTeam,
        opponentTeamId: matchup.opponent,
        mySide: nationalCupSideOf(cup, matchup.myTeam),
        // 대회 중 나리 저장 +0xb2 = L+0x32 = 대회 날짜
        dayCounter: cup.day,
      }))
      setEntryView(null)
      setScreen({ kind: '경기준비', cup: { matchup, cup } })
    },

    /**
     * 대회 끝 — 결과 팝업(`0x25`)과 보상 팝업(`0x26`)을 모두 닫았을 때 (`0x1b92c`).
     * 보상은 커리어에 얹고, 그 뒤 원본대로 새 시즌 처리(`0x1b768`)다.
     *
     * 국가대항전 플래그(`S+0x12c` — 커리어 `nationalCup`)는 새 시즌 처리(`startNextSeason`, 1b774)가 내린다.
     */
    finishCup: (finish: NationalCupFinish) => {
      if (career === null) return
      const rewarded = applyEventRewards(career, careerNationalCupRewardItems(finish.reward), random)
      // 우승 보상 팝업 0x26 닫힘 0x1bb14 `0x22c7d(1000, 모드 4)` — 보상이 없는 갈래는 부르지 않는다
      if (finish.reward.gamePoint > 0) {
        recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: finish.reward.gamePoint })
      }
      // 히든 팀은 여기서 열지 않는다 — 134 에 들어올 때마다 진입 0x19f30 이 열었다(결승 승리 뒤 진입이 결승 상대까지)
      // 0x1bb28 0x1b768 뒤 134 는 대진판을 그리며 효과기 끝을 기다린다(1bb2c~1bb64) — 대진판 위에 아홉 틀 어두워진 뒤 137
      startNewSeason(rewarded, false, true)
    },

    /** 134 첫 틀 `0x1b92c` 의 칭호 8 팝업 확인 `0x1b1e4` — 비트 · 곧바로 장착 · 저장 (관리 화면 `confirmTitle` 과 같은 콜백) */
    confirmCupTitle: () => {
      if (career === null) return
      const nationalTitle = nationalCupStandingsTitleOf(career.titleIds)
      if (nationalTitle !== null) setCareer(awardTitles(career, [nationalTitle]))
    },

    /**
     * 엔딩 보너스 팝업 0x2b 를 닫았다 — 141 틀 0x1bbc4 의 1bbf4~1bc70: e = 0xa3a85(S) 로 보너스 0xcc40c[e] × 1000 을 전역 G 에
     * 더하고(99999 상한) `0x22c7d(보너스, 모드)` 통계 · 전역기록 저장 · **S+0x7b = 1** · 커리어 저장(141 진입이 메모리에 쓴 S+0x50
     * = 6 째 — 다시 켜면 141 로 돌아온다, `resumePointOf`) 뒤 등록 팝업 0x2d.
     */
    receiveEndingBonus: () => {
      if (career === null || career.endingIndex === null || career.endingBonusReceived === true) return
      const endingIndex = career.endingIndex
      setCareer({ ...applyEndingBonus(career, endingIndex), endingBonusReceived: true })
      recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: endingBonusOf(endingIndex) })
    },

    /**
     * 부상·방출 엔딩 뒤 5000 G포인트로 이어한다 (StrMODE[221]). 모자라면 false.
     * 팝업 0x32 예(0x1bdc6~) — 판정 0xa3a85(S) 가 0(부상)이면 부상 칸을 비우고 S+0x50 = 3 · 0xbcb49(0x69) 로 곧장 105(1bddc~1be1e),
     * 아니면(방출) 새 시즌 0x1b768(1be26) — 141 은 엔딩 판을 그리며 효과기 끝을 기다려(1beb4~1beea) 137 "N년차" 표지로 간다
     */
    continueAfterEnding: () => {
      if (career === null || career.endingIndex === null) return false
      if (!canContinueAfterEnding(career, career.endingIndex)) return false
      // 팝업 0x32 예 → 0x1bdc6 `0x22c29(모드 4 → 1, 5000)`
      recordStat({ kind: 'G사용', usage: leagueUsageOf(BATTER_LEAGUE_MODE), amount: CONTINUE_COST_GAME_POINT })
      if (career.endingIndex !== INJURY_ENDING_INDEX) {
        // 1be2a~1be40 — 두 갈래가 만나 소리를 끊고 4 를 튼다. 방출은 화면이 엔딩 그대로라 여기서 (`playEndingContinueBgm`)
        playEndingContinueBgm(audio)
        startNewSeason(continueAfterEndingPayment(career), false, true, true)
        return true
      }
      setCareer(continueAfterEnding(career, random))
      setScreen({ kind: '관리' })
      return true
    },

    /** 앞 상태(134 · 141)가 효과기 끝을 본 틀 — `0xbcb49(0x89)` 로 137 을 예약하고 효과기 종류 2 를 건다(1bb46~1bb64 · 1becc~1beea) */
    enterHeldYearCover: () => {
      if (!isYearCoverHeld) return
      setYearCoverHeld(false)
      setScreen({ kind: '연차표지', afterHold: true })
    },

    /**
     * 엔딩을 본 뒤 메인 메뉴로 (직접 떴다). 커리어 저장을 지우는 곳은 **명예의 전당 등록** 하나다 — 등록 0x62d80~0x62dc0 이
     * 선수 사본(0x1f681) 뒤 `0x224ec(저장, 4)`(모드 저장 지우기 — +0x44 · +0x50 = 0, 그 편 저장 칸을 비운다)를 부른다.
     * 팝업 0x2d "아니오"(1bd04~1bd28)와 0x32 "아니오"(1be46~1beae)는 `[this+0x278] = 1` · 화면 전환만 걸고, 그 끝 1bfa2~1bfe2 도
     * 밀기 · 0x375d · [0x140006c] = 5 · 장면 0x103(메인 메뉴)뿐이다 — 저장을 안 건드린다. 145 목록의 "나중에 등록"도 메인 메뉴뿐이다.
     * 그래서 등록하지 않으면 마지막 저장(`savedCareerOf` — 보너스를 받았으면 S+0x50 = 6 · 엔딩 칸, 아니면 엔딩 칸을 비운 그 앞)이
     * 남아 이어하기가 그 자리로 돌아온다.
     */
    finishEnding: (isRegistered: boolean) => {
      // 등록했으면 저장은 등록하는 순간 지웠다 (`eraseSaveForHallOfFame`) — 여기서는 떠나기만 한다
      if (isRegistered) isSaveErasedRef.current = false
      setCareer(null)
      // 141 끝 0x1bfd4 · 145 목록 0x1ca92 — 등록 여부와 상관없이 [0x140006c] = 5: 메인 메뉴를 게임시작 목록으로 바로 연다
      setScreen({ kind: '메인메뉴', openTier: 5 })
    },

    /**
     * 명예의 전당 등록이 된 그 순간 — 0x62dbe 의 `0x224ec(저장, 4)`: 모드 저장(경기 중간 저장 칸도)을 지운다. 등록 꼬리(0x62dc4~)는
     * G − 20000 · 전역 저장 0x1f1b9 · 0x1f1e1 뿐이라 모드 저장 0x22755 를 다시 부르지 않는다 — 웹은 엔딩을 떠날 때까지 커리어가
     * 바뀌어도(지갑 다리의 G) 저장하지 않는다. 등록 완료 창에서 앱을 꺼도 저장은 없다.
     */
    eraseSaveForHallOfFame: () => {
      isSaveErasedRef.current = true
      nariGameSaveRef.current?.clear()
      saveGame.clear()
      setSavedCareer(null)
    },
  }


  return {
    savedCareer,
    career,
    progress,
    shopNotice,
    /** 새 시즌 0x1b768 뒤 앞 상태(134 · 141)가 아직 그리는 아홉 틀 — 앱이 그 화면 위에 효과기를 칠한다 */
    isYearCoverHeld,
    shopGpDetail,
    outingNotice,
    outingResult,
    outingPresentation,
    managementNotice,
    managementDetail,
    pendingTitle,
    loadingTip,
    stadiumSkyRow,
    sceneStadium,
    matchInfoStage,
    matchAces,
    /** 143 경기 전 엔트리 보기 — 142(`경기준비`) 위에 선다 */
    entryView: screen.kind === '경기준비' ? entryView : null,
    storyEvents,
    eventPlaceIds,
    handlePitchResolved,
    preRollContact,
    actions,
  }
}

/**
 * 웹 화면 바뀜이 원본 112 진입(0x118e4)인가 — `outingSlots` 주석. 장소 이벤트에서 돌아온 '외출' 은 113 이라 아니다.
 */
function isOutingMapEntry(previous: Screen | null, next: Screen): boolean {
  if (next.kind === '이벤트') return next.context === '외출진입' || next.context === '대결결과'
  if (next.kind !== '외출') return false
  if (previous === null) return true
  if (previous.kind === '외출') return false
  return !(previous.kind === '이벤트' && previous.context === '장소')
}

/** 붙든 공 도착 판이 끝난 뒤 `continueAfterArrival` 이 쓰는 이 공의 값 (`handlePitchResolved` 가 받은 것) */
interface ArrivalContext {
  /** 이 공을 먹인 뒤의 타석 (`runner.applyPitch`) */
  readonly nextAtBat: ReturnType<AtBatRunner['applyPitch']>
  /** 이 공까지 센 공 수 · 연속 파울 */
  readonly tally: AtBatPitchTally
  /** 필살타법이 성공한 타구인가 (0x517e6 → 0x51800) */
  readonly isUncatchable: boolean | undefined
  /** 쏜 패턴 (0xb0930 덱) */
  readonly pattern: PitchOutcomeDetail['pattern']
  /** 장면 +0xfdc — 이 공의 번트 종류 */
  readonly buntKind: number
}

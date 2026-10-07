import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'
import { arrivePitch, cpuPickoff, resolveBenchClearing, resolveDefensePlay, spendMySpecialSwing, startGame, startPlayerOutcome, startSteal, summaryOf, throwOpponentPitch } from '@/features/play-game/model/gameFlow'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
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
  gainGamePoint,
  countGameForSkills,
  MAXIMUM_GAME_POINT,
  nariLastGameOf,
  nariRecordLineOf,
} from '@/entities/career/model/playerCareer'
import {
  applyKoreanSeriesReward,
  applyRegularSeasonReward,
  popupAfterChampion,
  regularSeasonPopupOnEnter,
  REGULAR_SEASON_HIDDEN_ID,
} from '@/entities/career/model/postseasonFlow'
import type { RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import { applyBurstRewards } from '@/entities/career/model/burstReward'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { selectSpecialSwingNumber, setSkillEquipped } from '@/entities/career/model/playerCareer'
import { expandSkillSlots } from '@/entities/career/model/skillEquip'
import {
  awardTitles, equipTitle, gameResultTitleOf, nationalCupStandingsTitleOf, nextTitleOf,
} from '@/entities/career/model/titles'
import { blockReasonOf, runTraining, specialSwingCostOf } from '@/entities/career/model/training'
import { trainingBlockTextOf, trainingOutcomeLinesOf } from '@/entities/career/model/trainingText'
import {
  outingBlockReasonOf,
  outingBlockTextOf,
  performOuting,
  recoverAfterRest,
  restBlockReasonOf,
  runRest,
} from '@/entities/career/model/outing'
import type { OutingResult } from '@/entities/career/model/outing'
import { EVENT_TRIGGER, finishEvent, placeTriggerOf } from '@/entities/story/model/storyScene'
import { selectShopItem } from '@/features/shop/model/shopSelection'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import {
  BATTER_LEAGUE_MODE, leagueUsageOf, skillEquipStatEventsOf,
} from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { EVENT_REWARD_KIND } from '@/entities/story/model/eventReward'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import { hiddenOpenTextOf } from '@/entities/career/model/equipment'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { useStorySchedule } from '@/app/model/useStorySchedule'
import { enterSeasonEvent, nextSeasonStep, resumePointOf } from '@/app/model/seasonEvents'
import {
  nariMatchCancelTargetOf, rollNariMatchAces, rollNariMatchStadium,
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
  GOAL_INTRO_EVENT_ID,
  MID_SEASON_GAME,
  midSeasonEventId,
  midSeasonTitlesOf,
  yearEndEventId,
} from '@/entities/career/model/seasonFlow'
import { forgetRepeatableEvents } from '@/entities/story/model/storyScene'
import { battingOrderEventId, emptyPlaceEventId, isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { applyEventRewards } from '@/entities/story/model/eventReward'
import { rollTrainingInjury } from '@/entities/career/model/condition'
import type { ManagementDetail } from '@/app/model/managementDetail'
import { restDetailChangesOf, trainingDetailChangesOf } from '@/pages/management/lib/detailPopup'
import { advanceStreaks, evaluateGame, managerCommentIndexOf, streakEventOf } from '@/entities/career/model/gameEvaluation'
import type { GameEvaluation } from '@/entities/career/model/gameEvaluation'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { ManagementCommand } from '@/pages/management/ui/ManagementScreen'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { pickLoadingTip } from '@/shared/config/loadingTips'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import { KOREA_TEAM_ID, createNationalCup, nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import {
  createNariCupTeams,
  nariCupBattingOrderOf,
  nariCupRecordOf,
  nextNariCupDayTeams,
  prepareNariCupMatch,
} from '@/entities/career/model/nariCupTeams'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
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
 * ⚠️ **근사인 곳은 우는 자리뿐이다.** 원본은 결과 화면과 평가 창이 따로인데 웹은 한 화면이라
 * 승패 징글(31·32) 바로 뒤에 이어 낸다 — 통로가 하나라 앞 소리가 끊긴다.
 */
const MY_LEAGUE_EVALUATION_THRESHOLD = 1
function evaluationJingleIdOf(popularityChange: number): number {
  if (popularityChange < 0) return 38
  return popularityChange > MY_LEAGUE_EVALUATION_THRESHOLD ? 36 : 37
}

/**
 * 저장의 국가대항전 대회 레코드 두 칸 — 없으면(대회 중 옛 저장) 대회 초기화 꼴로 세운다 (`createNariCupTeams`)
 */
function cupTeamsOf(career: PlayerCareer, opponentTeamId: number): NariCupTeams {
  return career.nariCupTeams ?? createNariCupTeams(renumberedBattingOrderOf(career) - 1, opponentTeamId)
}

/** 타자 스킬 22 압도 — 상대 투수 투구 스태미나 소모 ×2 (0xa5f0e) */
const INTIMIDATE_SKILL_ID = 22

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
}

const NO_STAT = () => {}

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
  openedAces = DEFAULT_NARI_OPENED_ACES,
  nariGameSave,
}: CareerSessionInput) {
  // 통로를 안 받으면 조용한 포트로 — 아래 자리들이 `sound` 가 있는지 매번 보지 않게 한다
  const silent = useMemo(() => createSilentSound(), [])
  const audio = sound ?? silent
  const [savedCareer, setSavedCareer] = useState<PlayerCareer | null>(() => saveGame.load())
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
  /** 상점 GP 결과 창 (0x872a1) — 칸 0~4·6 구매 뒤. 닫아도 굴림 없이 상점 그대로 (0x1d649) */
  const [shopGpDetail, setShopGpDetail] = useState<GpDetailOf<PlayerCareer> | null>(null)
  const [outingNotice, setOutingNotice] = useState('')
  /** 상태 126 결과 팝업 두 장 — 효과 글(0x15234)과 입원 회복 글(0x1575c). 효과 팝업이 떠 있지 않으면 null */
  const [outingResult, setOutingResult] = useState<OutingResult | null>(null)
  const [managementNotice, setManagementNotice] = useState('')
  /** 상세정보 결과 창 (0x8a0a4) — 닫을 때 훈련은 부상, 휴식은 회복을 굴린다 */
  const [managementDetail, setManagementDetail] = useState<ManagementDetail | null>(null)
  /** 경기 전 원작 로딩 화면에 띄울 팁. null 이면 로딩 중이 아니다. */
  const [loadingTip, setLoadingTip] = useState<string | null>(null)
  /** 142 진입 0x1c46c 가 이 장면에서 굴린 마선수 — 경기정보 마투수·마타자 줄이 읽는다 */
  const [matchAces, setMatchAces] = useState<NariMatchAces | null>(null)
  /** 143 경기 전 엔트리 보기 (진입 0x16af8 · 키 0x1457c) — 142 위에 선다. 없으면 null */
  const [entryView, setEntryView] = useState<NariEntryView | null>(null)
  /**
   * 장면+0x288 — 142 진입의 마선수 넣기를 **장면마다 한 번**만 하게 막는 칸 (1c566~1c572 · 1c668). 장면 셋업 0xfb7c 가
   * 0 으로 둔다 → 장면이 새로 서는 이어하기(`continueSaved`)와 경기 뒤(`finishGame`)에 내린다.
   */
  const matchPreparedRef = useRef(false)
  /** 전역기록 +0x50 손잡이 — 콜백 신원이 흔들리지 않게 ref 로 읽는다 */
  const nariGameSaveRef = useRef(nariGameSave)
  nariGameSaveRef.current = nariGameSave

  // 캔버스 루프에서 최신 값을 읽어야 한다 — useAtBatRunner의 atBatRef와 같은 이유다.
  const progressRef = useRef(progress)
  progressRef.current = progress
  const careerRef = useRef(career)
  careerRef.current = career
  /**
   * 지금 타석의 공 수·연속 파울 (`atBatPitchTally`). 타석 결과(`AtBatState`)에 남지 않아 따로 든다 —
   * 타석이 끝나거나 경기를 세우거나 나갈 때 비운다.
   */
  const pitchTallyRef = useRef<AtBatPitchTally>(EMPTY_AT_BAT_PITCH_TALLY)
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
  useEffect(() => {
    if (career === null) return
    saveGame.save(career)
    setSavedCareer(career)
  }, [career, saveGame])

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
    ) => {
      // 환경설정 "주루" 를 경기에 태운다 — 타자편은 사람이 늘 공격이라 설정이 그대로 먹는다 (0xae690)
      const started = startGame(
        random, ourTeamId, battingOrder, opponentTeamId, playerSide, dayCounter, runningModeManualRef.current, pitchers, aces,
        ourRecordLineup,
      )
      progressRef.current = started
      setProgress(started)
      runner.resetAtBat()
      pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
      runner.setBannerText('')
      runner.setIsPaused(true)
      setLoadingTip(pickLoadingTip(random))
      setScreen({ kind: '경기' })
    },
    [random, runner, setScreen],
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

  /** 경기가 끝났을 때 보상·칭호를 정산하고 결과 화면으로 넘어간다. */
  const finishGame = useCallback(
    (finished: GameProgress, currentCareer: PlayerCareer) => {
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 이 0 (다음 142 에서 다시 굴린다)
      matchPreparedRef.current = false
      // 정산 진입 0x4ea0c 의 0x4f3d6 — 전역기록 +0x4c + 모드(+0x50) = 0
      nariGameSaveRef.current?.clear()
      const summary = summaryOf(finished)
      // 경기 후 평가 — 인기도 → 평판 → 사기 (0xa719c), 이어서 연속 기록 (0x8a6fc)
      const thisEvaluation = evaluateGame(currentCareer, summary)
      const isEvaluated = isEvaluatedGame(currentCareer)
      /*
       * 116 이 읽는 S+0x4a · +0x64 · +7 · S+0x1d8 은 평가 0xa719c(정규시즌만, 0x4f268)가 쓰는 칸이라 **포스트시즌 경기 뒤에는 앞 평가
       * 경기 값**이다 — 평가 창 숫자 · 감독 글 · 징글 · 경기 뒤 카운터(+0x1c2 · 먹튀) · 칭호 39 모두. 옛 저장에 앞 값이 없으면 이 경기 값.
       */
      const previous = currentCareer.lastGame
      const staleEvaluation = isEvaluated || previous === undefined ? thisEvaluation : previous.evaluation
      const recordLine = isEvaluated || previous === undefined
        ? nariRecordLineOf(summary.stats)
        : previous.recordLine ?? nariRecordLineOf(previous.summary.stats)
      // 승리 31 · 패배 32 징글 (무승부는 원본이 어느 쪽을 내는지 문서에 없어 비워 둔다) →
      // 평가 창 징글 36·37·38 (12c96~: +0x4a). 원본은 두 화면이 따로지만 웹은 한 화면이라 이어서 낸다
      playSoundIds(audio, [
        gameResultSoundIdOf(summary.result),
        evaluationJingleIdOf(staleEvaluation.popularityChange),
      ])
      // 같은 날 나머지 네 경기도 원본대로 치러 순위표에 넣는다 (0xc2a48)
      // 45경기째면 하루 끝(0xb818c)이 정규시즌을 닫고 대진(0xb80a8)을 연다.
      // CPU 끼리의 포스트시즌 경기는 **여기서 돌리지 않는다** — 원본은 대진 화면 128 의 [확인](0x13da0)에서 돌린다
      // (`pressPostseasonBracket`).
      const settled = applySeasonEnd(
        applyLeagueDay(applyGameResult(currentCareer, summary), summary.ourTeamId, random, aceLevels),
      )
      const evaluated = applyGameEvaluation(settled, thisEvaluation, isEvaluated)
      // 116 감독 글은 진입이 +0x4a 와 **평가 뒤** 평판 +0x62 로 고른다 (0x128d2~0x12938 — 모드 4 표 39~74)
      const evaluation = {
        ...staleEvaluation,
        commentIndex: managerCommentIndexOf(evaluated, staleEvaluation.popularityChange),
      }
      // 스킬 조건용 경기 뒤 카운터 — 사기까지 반영된 뒤에 센다 (A-4). 116 쪽(0x12bc2~0x12c3c)이라 포스트시즌에도 돈다 — 그때
      // +0x4a 는 앞 평가 경기 값이다(위).
      //    ⚠️ 미해결: 포스트시즌엔 정산 0xa8024 의 [sp+0x34] = 0xa56dc(현재 타자) 가 거짓이라 내 타자 기록 칸 쓰기 아홉 곳
      //    (0xa8362·0xa8498·0xa84d6·0xa8538·0xa8578·0xa85c4·0xa8866·0xa895c …)이 막힌다 — 어느 칸이 웹 `applyGameResult`
      //    의 어느 줄인지 아직 다 짝짓지 못해 기록은 그대로 센다.
      const counted = countGameForSkills(evaluated, evaluation.popularityChange)
      // 연속 기록 칸을 잇는다. 116 의 0x8a6fc 는 그 칸을 읽어 알림 줄과 **보상 명령**(평판 · 슬럼프 스킬)을 내장 이벤트에
      // 쌓을 뿐이라, 보상은 114 가 이벤트를 틀 때(웹은 [확인] `confirmGameResult`) 먹는다 (`streakEventOf`)
      // 0xa4ce0 은 평가 0xa719c 안이라 포스트시즌 경기는 잇지 않는다 (0x4f268) — 116 은 지난 칸으로 알림·보상을 다시 쌓는다
      const advanced = isEvaluated ? advanceStreaks(counted, summary.stats) : counted
      // 부상은 경기 뒤가 아니라 훈련 결과 창을 닫을 때 굴린다 (0x1b4c4)
      // 경기 뒤 평가 116 진입 0x1278c 가 S+0x50 = 2 · 저장 — 이어하기가 116 을 다시 띄운다(`continueSaved`). S 의 +0x4a ·
      // +0x1d8 처럼 지난 경기 재료를 저장에 남긴다(`lastGame`).
      // 0x1a1c0 칭호는 여기서 주지 않는다(관리 화면 갱신 0x1aec4 `pendingTitle`) — 116 은 칭호 39 하나만 직접 띄운다
      // (1299e: 이 경기 홈런 > 3 · 비트 없음 → 0x1274c 팝업). 웹은 팝업 대신 결과 화면 칭호 칸으로 보이고 그 자리에서 준다
      // 칭호 39 는 S+0x1d8[3] 을 본다 — 포스트시즌 경기 뒤에는 앞 평가 경기의 홈런 수다
      const dynamite = gameResultTitleOf(advanced.titleIds, recordLine.homeRuns)
      const titled = dynamite === null ? advanced : awardTitles(advanced, [dynamite])
      setCareer({ ...titled, seasonEndState: 116, lastGame: nariLastGameOf(summary, evaluation, recordLine) })
      // 경기 끝 0x4ea0c: 기록 달성 G 합을 저장 G 에 더한 뒤 0x4ec82 `0x22c7d(액수, 모드 4)` 로 획득 GP 통계에 적는다
      recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: gamePointRewardOf(summary) })
      // 이어서 0x4ec8a `0x22e10` 이 이번 경기 기록 배열 40칸을 연감 달성 횟수 [+4+n] 에 더한다 (e48e922)
      recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
      setScreen({
        kind: '경기결과',
        summary,
        gamePointReward: gamePointRewardOf(summary),
        // 원본 116 은 0x1a1c0 칭호를 띄우지 않는다 — 얻은 칭호는 관리 화면에서 하나씩 팝업으로 받는다. 39 만 116 이 준다
        newTitles: dynamite === null ? [] : [dynamite],
        evaluation,
        streakNotices: streakEventOf(advanced).notices,
      })
    },
    [aceLevels, audio, random, recordStat, setScreen],
  )

  /**
   * 국가대항전 사람 경기가 끝났다 — 결과 장면 `0x4ea0c` 차례(내 경기 승패 기록 → 같은 라운드
   * CPU 경기 `0xc2dac` → 하루 끝 `0xb818c`)를 `advanceNationalCupDay` 가 그대로 한다.
   * 그 뒤 상태 101 재진입(`0x1c154`)이 `S+0x12c` 를 보고 순위 화면 134 로 돌려보낸다 (P5 1a·5절).
   *
   * ⚠️ **웹판 임시**: 원본은 대회 경기 뒤에도 경기 결과 화면을 한 번 보여 주는데, 웹 `경기결과`
   * 화면의 [확인]은 정규시즌 정산(`confirmGameResult`)에 묶여 있어 대회 경기에는 쓸 수 없다 —
   * 곧장 순위 화면으로 돌아간다.
   * 대회 경기는 커리어 기록(리그 승패·연속 기록·칭호·G포인트)을 건드리지 않는다. 원본도 국가대항전
   * 승패는 4국 칸(`L+0xb0`/`L+0xb4`)에만 넣고 "정규 기록은 건드리지 않는다"(P5 1a).
   */
  const finishCupGame = useCallback(
    (finished: GameProgress, cup: NationalCup) => {
      const summary = summaryOf(finished)
      // 무승부는 대한민국의 패로 친다 — 원본 CPU 경기(`0xc2f12`)도 동점이면 뒷 칸이 이긴다. **근사다**
      const won = summary.result === '승'
      const winner = won ? summary.ourTeamId : summary.opponentTeamId
      const loser = won ? summary.opponentTeamId : summary.ourTeamId
      cupGameRef.current = null
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 = 0
      matchPreparedRef.current = false
      // 대회 경기도 정산 진입 0x4ea0c 를 지난다 — 0x4f3d6 은 모드를 가리지 않고 +0x4c + 모드 = 0
      nariGameSaveRef.current?.clear()
      // 같은 날 CPU 경기 두 나라는 상대국 슬롯 레코드(base+0x934) 하나를 쓴다 — 사람 경기가 깎아 둔 그 레코드의
      // 투수 +0x2c 에서 선다 (701a7a9). 사람 경기 끝 상대 투수 칸별 값을 넘긴다
      const next = advanceNationalCupDay(cup, winner, loser, random, summary.pitcherStaminas?.opponent)
      // 하루 끝 b8216 — 다음 날 사람 경기 상대를 +0xbe0 에 마스터에서 새로 복사
      setCareer((current) => current === null || current.nariCupTeams === undefined
        ? current
        : { ...current, nariCupTeams: nextNariCupDayTeams(current.nariCupTeams, nationalCupMatchupOf(next)?.opponent ?? null) })
      setScreen({ kind: '국가대항전', cup: next })
    },
    [random, setCareer, setScreen],
  )

  /**
   * 타석 하나가 경기 상태에 다 먹은 뒤 — 결과 배너를 띄우고, 경기가 끝났으면 정산으로 넘긴다.
   * 인플레이 타구는 **수비 화면이 끝난 뒤에야** 여기까지 온다.
   */
  const finishAtBat = useCallback(
    (advanced: GameProgress, outcome: AtBatOutcome, runnersOnBase: number) => {
      runner.pauseWithBanner(describeOutcomeBanner(outcome, runnersOnBase), () => {
        if (!advanced.game.isFinished) {
          runner.setIsPaused(false)
          return
        }
        // 국가대항전 경기는 커리어 정산을 타지 않고 대회 하루를 넘긴다 (상태 142 → 101 → 134)
        const cup = cupGameRef.current
        if (cup !== null) return finishCupGame(advanced, cup)
        const currentCareer = careerRef.current
        if (currentCareer !== null) finishGame(advanced, currentCareer)
      })
    },
    [finishCupGame, finishGame, runner],
  )

  const handlePitchResolved = useCallback(
    (detail: PitchOutcomeDetail, _pitch?: unknown, isUncatchable?: boolean, buntKind?: number) => {
      // 공이 손을 떠날 때 상대 투수 투구 수·스태미나를 깎는다 (0x3dec6 → 0xa5e14(ctx, 구질)).
      // 타자 스킬 22 압도(0xb62b4(현재 타자, 22) — 장착 비트)면 소모 ×2
      const beforePitch = progressRef.current
      if (beforePitch !== null && detail.pitchTypeNumber !== undefined) {
        const thrown = throwOpponentPitch(beforePitch, detail.pitchTypeNumber, {
          batterIntimidates: careerRef.current?.equippedSkillIds.includes(INTIMIDATE_SKILL_ID) ?? false,
        })
        progressRef.current = thrown
        setProgress(thrown)
      }
      const nextAtBat = runner.applyPitch(detail.resolution)
      // 공마다 연속 파울(ctx+0x15f)을 센다 — 32·33 은 타석 결과와 함께 gameFlow 로 넘긴다 (0xa7dbc)
      const tally = tallyPitch(pitchTallyRef.current, detail.resolution)
      pitchTallyRef.current = tally
      // 타구음(0x515de~) → 심판 콜(0x51a94) 순서. 통로가 하나라 뒤 소리가 앞 소리를 끊는다
      playSoundIds(audio, [detail.contactSoundId, pitchCallSoundIdOf(detail.resolution, nextAtBat)])
      // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 출발한 도루(종류 5) 판을 연다 (`arrivePitch`)
      const beforeArrival = progressRef.current
      const arrival =
        beforeArrival === null
          ? null
          : arrivePitch(beforeArrival, { resolution: detail.resolution, outcomeAfter: nextAtBat.outcome }, random)
      if (beforeArrival !== null && arrival !== null && arrival.progress !== beforeArrival) {
        progressRef.current = arrival.progress
        setProgress(arrival.progress)
        // 판정 콜(도루 17 · 62/20, 폭투 17) 뒤 공수 교대 소리 — 원본은 판 안의 그 틱에 낸다 (견제와 같은 근사)
        playSoundIds(audio, [arrival.play?.callSoundId ?? null, ...gameStepSoundIdsOf(beforeArrival, arrival.progress)])
      }
      if (arrival !== null && arrival.interrupted) {
        // 판에서 반 이닝·경기가 끝났다 — 내 타석이 끊긴다 (견제사와 같은 길)
        pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
        runner.resetAtBat()
        if (!arrival.progress.game.isFinished) return
        const cup = cupGameRef.current
        if (cup !== null) return finishCupGame(arrival.progress, cup)
        const currentCareer = careerRef.current
        if (currentCareer !== null) finishGame(arrival.progress, currentCareer)
        return
      }
      if (!isAtBatFinished(nextAtBat) || nextAtBat.outcome === null) return

      // 타석이 끝났다 — 다음 타석은 새 카운터로 (타석 초기화 0xa5bcc 가 ctx+0x15f 를 지운다)
      pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY

      const currentProgress = progressRef.current
      if (currentProgress === null) return

      const { bases } = currentProgress.game
      const runnersOnBase = [bases.first, bases.second, bases.third].filter(Boolean).length
      // 타석 결과(안타/아웃 코드)만 먼저 정한다 — 인플레이 타구면 주자 처리는 화면 뒤로 미뤄진다.
      // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
      // 판정 11(2스트라이크 번트 파울 아웃)은 아웃 콜이 조건 없이 62 다 — 플레이 끝까지 실어 보낸다
      const advanced = startPlayerOutcome(currentProgress, nextAtBat.outcome, random, {
        isUncatchable,
        buntFoulOut: detail.isBuntFoulOut,
        foulRecordIds: tally.foulRecordIds,
        arrivalPlay: arrival?.play ?? null,
        // 이 공의 번트 종류(장면 +0xfdc) — 타구 판 시작 리드(0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더한다
        buntKind: buntKind ?? 0,
      })
      progressRef.current = advanced
      setProgress(advanced)

      // 수비 진행 중 — 화면이 틱을 돌리는 동안 타석을 멈춰 둔다. 원본도 상태 0x17 이 도는 동안
      // 0xf(타석 준비)로 돌아가지 않아 다음 투구가 나가지 않는다
      if (advanced.pendingDefensePlay !== null) {
        runner.setIsPaused(true)
        return
      }
      // 사구 뒤 벤치 클리어링 연출(상태 0x1e) — 화면이 연출을 끝낼 때(`finishBenchClearing`)까지 붙든다
      if (advanced.pendingBenchClearing !== null) {
        runner.setIsPaused(true)
        return
      }
      // 홈런·삼진·볼넷은 수비를 기다리지 않는다 — 홈런 함성(11)과 진행 소리를 여기서 낸다
      playSoundIds(audio, [
        inPlayCallSoundIdOf(nextAtBat.outcome),
        ...gameStepSoundIdsOf(currentProgress, advanced),
      ])
      finishAtBat(advanced, nextAtBat.outcome, runnersOnBase)
    },
    [audio, finishAtBat, finishCupGame, finishGame, random, runner],
  )

  const story = useStorySchedule(career)
  /**
   * 관리 화면에 들어설 때 trigger 0 이벤트를 본다. 경기를 마치고 들어올 때만 무작위 조건(질병)을 굴리고,
   * 이벤트 뒤 이어서 볼 때는 굴리지 않는다 — 반복 이벤트가 연달아 나오지 않게.
   */
  const [managementCheck, setManagementCheck] = useState<'무작위포함' | '고정' | null>(null)
  /**
   * **칭호 팝업 하나** — 관리 장면 this+0x270 (줄 칭호 번호, −1 = 없음). 판정 0x1a1c0 은 관리 장면 갱신 0x1aec4 끝
   * (0x1af90~0x1afc2)에서 `this+0x274 == 1`(관리 화면 105 에 들어와 두 번째 갱신 — 진입 0x11c64 가 0 으로 둔다)이고
   * +0x270 < 0 일 때만 돌고, 번호 차례로 **처음 맞는 하나만** 남겨 팝업 0x1274c 를 띄운다. 확인 0x1b1e4 가 비트를 켜고
   * 곧바로 장착(+0x1c4)·저장한 뒤 +0x270 = −1 · +0x274 = 1 로 다음 틀에 다시 판정한다 — 그래서 여러 개가 하나씩 이어진다.
   * 원본은 105 에 머무는 동안 커리어가 바뀌지 않는다(훈련·휴식·상점·외출은 다른 상태로 갔다 105 로 다시 들어온다).
   * 웹은 훈련 결과 따위를 관리 화면 위 알림으로 보이므로 "105 에 있고 진입 이벤트 검사가 끝났으면" 늘 판정한 값으로 둔다.
   */
  const pendingTitle = screen.kind === '관리' && managementCheck === null && career !== null ? nextTitleOf(career) : null
  // 저장을 불러오면 반복 이벤트를 다시 볼 수 있게 한다 (0xacf60) — 이벤트 본문이 도착한 뒤에
  const [shouldForgetRepeatable, setShouldForgetRepeatable] = useState(false)
  useEffect(() => {
    if (!shouldForgetRepeatable || career === null || story.events === null) return
    setShouldForgetRepeatable(false)
    setCareer(forgetRepeatableEvents(career, story.events))
  }, [shouldForgetRepeatable, career, story.events])
  useEffect(() => {
    if (managementCheck === null || screen.kind !== '관리' || career === null || story.events === null) return
    setManagementCheck(null)
    // 경기 뒤에는 타순 이벤트가 먼저다 (0x11910 → 상태 138)
    const orderEventId = managementCheck === '무작위포함' ? battingOrderEventId(career) : null
    if (orderEventId !== null) return setScreen({ kind: '이벤트', eventId: orderEventId, context: '관리' })
    const event = story.eventFor(career, EVENT_TRIGGER.관리, managementCheck === '무작위포함' ? random : undefined)
    if (event !== null) setScreen({ kind: '이벤트', eventId: event.id, context: '관리' })
  }, [managementCheck, screen.kind, career, story, random, setScreen])

  /**
   * 새 시즌 처리 `0x1b768` → 137 "N년차" → 105 관리 화면.
   * MVP 비트(career+0x1ca)는 여기서가 아니라 상태 131 이 375 를 틀기 전에 남긴다 (`enterSeasonEvent`).
   */
  const startNewSeason = (finished: PlayerCareer) => {
    const next = startNextSeason(finished)
    setCareer(next)
    setScreen({ kind: '관리' })
    setManagementCheck('고정')
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

  const continueSeason = (viewed: PlayerCareer, viewedEventIds: readonly number[]) => {
    // ── 국가대표 이벤트(461~464)는 연말 사슬 밖이다. 상태 133 이 따로 예약한 것이라 먼저 가른다 ──
    if (viewedEventIds.includes(NATIONAL_CUP_EVENT.출전)) {
      // 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 대회를 세우고 순위 화면 134 를 줄에 넣는다.
      // 134 의 틀 0x1b92c 머리가 들어온 첫 틀(장면+0x2c == 1)에 비트 8 이 없으면 칭호 8 "국가 대표" 를 준다 — 그 뒤다
      const nationalTitle = nationalCupStandingsTitleOf(viewed.titleIds)
      const titled = nationalTitle === null ? viewed : awardTitles(viewed, [nationalTitle])
      const cup = createNationalCup()
      // 0xb7bf0 대회 레코드 두 칸(+0xbc4 대표팀 · +0xbe0 첫날 상대) + 133 의 0xb53f1 — 대표팀 내 칸 t 에 내 선수 · 저장
      setCareer({
        ...titled,
        nariCupTeams: createNariCupTeams(
          renumberedBattingOrderOf(titled) - 1,
          nationalCupMatchupOf(cup)?.opponent ?? KOREA_TEAM_ID,
        ),
      })
      return setScreen({ kind: '국가대항전', cup })
    }
    if (viewedEventIds.includes(NATIONAL_CUP_EVENT.거절) || viewedEventIds.includes(NATIONAL_CUP_EVENT.탈락)) {
      // 464 거절은 `S+0x12c = 0` 으로 바로 새 시즌이다 (P5 요약, 확정).
      // 462 탈락은 원본이 상태 105(관리 화면)로만 적혀 있고 새 시즌 처리(`0x1b768`)가 안 보이는데,
      // 그러면 연말 사슬이 안 닫혀 웹에서는 그 해에 갇힌다. 대회 끝(`0x1b92c`)이 우승·탈락 두 갈래
      // **모두** `0x1b768` 로 가는 것과 짝을 맞춰 여기서도 새 시즌으로 넘긴다 — **근사다**.
      return startNewSeason(viewed)
    }

    const step = nextSeasonStep(viewed, viewedEventIds)
    if (step.kind === '포스트시즌') return enterPostseason(viewed)
    if (step.kind === '이벤트') {
      // 상태 함수가 이벤트를 틀기 전에 하는 일 — 131 은 375 앞에서 MVP 비트를 남긴다
      setCareer(enterSeasonEvent(viewed, step.eventId))
      return setScreen({ kind: '이벤트', eventId: step.eventId, context: '시즌' })
    }
    if (step.kind === '엔딩') {
      // 엔딩 보너스는 엔딩을 띄울 때 준다 (0x1220c). 부상·방출은 0 이다
      setCareer(applyEndingBonus({ ...viewed, endingIndex: step.endingIndex }, step.endingIndex))
      // 보너스 팝업이 닫힐 때 0x1bc4a `0x22c7d(보너스, 모드)` — 웹은 보너스를 이 자리에서 준다
      recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: endingBonusOf(step.endingIndex) })
      return setScreen({ kind: '엔딩', endingIndex: step.endingIndex })
    }
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
    setManagementCheck('무작위포함')
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
      const resolved = resolveDefensePlay(current, played, random)
      progressRef.current = resolved
      setProgress(resolved)
      // 플레이가 끝난 자리 — 아웃 콜(0x51b36)·세이프 콜(0x51c14)과 진행 소리는 여기서야 난다.
      // 함성 60 은 원본이 **낙구 틱**에 내는 것이라 이 자리는 근사다 (atBatSounds 주석)
      playSoundIds(audio, [
        deepHitCheerSoundIdOf({
          outcome: pending.outcome,
          carryDistance: carryDistanceOf(pending.trajectory),
          caughtOnTheFly: played.caughtOnTheFly,
        }),
        inPlayCallSoundIdOf(pending.outcome, { ...played, buntFoulOut: pending.buntFoulOut }),
        ...gameStepSoundIdsOf(current, resolved),
      ])
      finishAtBat(resolved, pending.outcome, runnersOnBase)
    },
    [audio, finishAtBat, random],
  )

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
      finishAtBat(resolved, pending.outcome, runnersOnBase)
    },
    [audio, finishAtBat, random],
  )

  const actions = {
    syncOpenedHidden,
    finishBenchClearing,

    /** 수비 화면이 끝났다 — 주자 처리를 이제 먹인다 */
    finishDefensePlay,

    /**
     * 도루 출발 (원본 키 '3' 1루 · '2' 2루 · '1' 3루 주자 → `0x53610` → 0x583 → `0xa9bd4`).
     * 주자를 출발만 시킨다 — 판정은 공이 도착할 때 도루 판(종류 5)이 한다 (`arrivePitch`). 난수·소리 없음.
     */
    stealBase: (base: StealBase) => {
      const current = progressRef.current
      if (current === null) return
      const next = startSteal(current, base)
      if (next === current) return
      progressRef.current = next
      setProgress(next)
    },

    /**
     * **CPU 투수의 견제** — 타석 화면(`BattingStage.onPickoff`)이 상대 투수 AI 가 목표점 대신 고른 루를 알려 준다
     * (0x345fc 종류 4 → 0x34848 → 메시지 0x10). 견제 판은 `lastDefensePlay` 로 재생되고(GameRoute),
     * 같은 타석·같은 볼카운트로 다음 공이 이어진다 (0xae3e8 → 상태 0xf).
     *
     * 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36).
     * ⚠️ 원본은 공이 잡히는 **틱**에 낸다. 웹은 판을 미리 다 돌려 재생하므로 판을 연 자리에서 낸다 (팀경기와 같은 근사).
     */
    cpuPickoff: (base: PickoffBase) => {
      const current = progressRef.current
      if (current === null) return
      const next = cpuPickoff(current, base, random)
      if (next === current) return
      progressRef.current = next
      setProgress(next)
      const play = next.lastDefensePlay
      playSoundIds(audio, [
        isPickoffPlayResult(play) ? pickoffCallSoundIdOf(play) : null,
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
      const cup = cupGameRef.current
      if (cup !== null) return finishCupGame(next, cup)
      const currentCareer = careerRef.current
      if (currentCareer !== null) finishGame(next, currentCareer)
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
      setCareer((player) => (player === null ? player : applyBurstRewards(player, resolution.deltas)))
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
      setCareer(createCareer(name, profile))
      setScreen({ kind: '관리' })
      setManagementCheck('고정')
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
     * [114 → 105/109/136/128]. 114 가 그 이벤트를 틀면 연속 기록 보상 명령도 다시 먹는다 — 이어하기마다 겹쳐 쌓인다(원본 그대로).
     * 경기 정산(0x4ea0c — 승패 · G · 평가 0xa719c · 리그 하루)은 다시 안 돈다. 결과 판(상태 0x18)의 승패 징글도 없다.
     */
    continueSaved: () => {
      if (savedCareer === null) return
      // 장면 0x106 이 새로 선다 — 장면+0x288 = 0 (0xfb7c)
      matchPreparedRef.current = false
      setShouldForgetRepeatable(true)
      const lastGame = savedCareer.lastGame
      if (savedCareer.seasonEndState === 116 && lastGame !== undefined) {
        // 116 진입 0x1278c 다시 — 카운터를 한 번 더 쓰고(겹쳐 쌓임) 평가 창을 다시 띄운다
        const counted = countGameForSkills(savedCareer, lastGame.evaluation.popularityChange)
        // 1299e 도 다시 — 비트가 이미 섰으면 안 준다
        const dynamite = gameResultTitleOf(counted.titleIds, (lastGame.recordLine ?? lastGame.summary.stats).homeRuns)
        const replayed = dynamite === null ? counted : awardTitles(counted, [dynamite])
        setCareer(replayed)
        playSoundIds(audio, [evaluationJingleIdOf(lastGame.evaluation.popularityChange)])
        return setScreen({
          kind: '경기결과',
          summary: lastGame.summary,
          // 원본 116 은 G 를 보이지 않는다 — 결과 판 0x18 · 정산 0x4ea0c 의 몫이라 다시 주지도 않는다
          gamePointReward: 0,
          newTitles: dynamite === null ? [] : [dynamite],
          evaluation: lastGame.evaluation,
          streakNotices: streakEventOf(replayed).notices,
        })
      }
      const point = resumePointOf(savedCareer)
      if (point.kind === '이벤트') {
        setCareer(enterSeasonEvent(savedCareer, point.eventId))
        return setScreen({ kind: '이벤트', eventId: point.eventId, context: '시즌' })
      }
      if (point.kind === '포스트시즌') return enterPostseason(savedCareer, true)
      setCareer(savedCareer)
      if (point.kind === '시즌종료') return setScreen({ kind: '시즌종료' })
      // 109 — 100 → 1(자원 적재) → 109 라 이전 상태가 1: 취소가 안 먹고 바닥 1, 배경음 4 (0x10d8c · 0x105f0)
      if (point.kind === '다음경기순위') return setScreen({ kind: '다음경기순위', fromManagement: false })
      setScreen({ kind: '관리' })
      setManagementCheck('고정')
    },

    /**
     * **곧장 경기** — [14] 타자편·[최근게임](모드 4)의 0x327b8 모드 3·4 갈래(3288e~328b4): 전역기록 `+0x44 && +0x50` 이면
     * `0x213c0(앱, 4, 0)` 으로 타자편 저장을 올려 장면 0x104 → 셋업 0x39fdc 모드 3·4 갈래가 그 저장으로 경기를 새로 세운다
     * (나리 경기는 반 이닝 저장이 없어 그만둔 경기를 처음부터 — 같은 일정·142 가 명부에 넣은 마선수 그대로). 장면 0x106 을
     * 거치지 않아 142 진입(마선수 굴림)도 없다. 경기가 끝나면 나리 장면이 새로 서고 상태 100 0x1c154 로 이어진다.
     * ⚠️ 웹 전용: 국가대항전 경기는 웹이 대회를 저장하지 않아 다시 세울 수 없다 — 이어하기(`continueSaved`)로 간다.
     */
    resumeInterruptedGame: (match: NariGameMatch | null): void => {
      if (savedCareer === null) return
      if (match?.isNationalCup === true) {
        actions.continueSaved()
        return
      }
      // 경기 뒤 나리 장면이 새로 선다 — 장면+0x288 = 0
      matchPreparedRef.current = false
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
        // 원작 [휴식] 커맨드 — 사기를 회복한다. 관리 주기마다 한 가지만 할 수 있다.
        const blockReason = restBlockReasonOf(career)
        if (blockReason !== null) {
          return setManagementNotice(
            blockReason === '사기최고'
              ? '사기 최고 상태입니다' // StrMODE[91]
              : '트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다',
          )
        }
        const rest = runRest(career, random)
        setCareer(rest.career)
        // StrMODE[24] "사기" + " " + 수치 + [83] (0x18e3c)
        return setManagementDetail({
          before: career,
          after: rest.career,
          messages: [`사기 ${rest.moraleGain} 상승하였습니다`],
          // 변화량 칸은 굴린 회복값 그대로 — 100 에서 잘리기 전 [sp+0x10] (0x18fb4)
          changes: restDetailChangesOf(rest.moraleGain),
          afterClose: { kind: '휴식' },
        })
      }
      if (command === '외출') {
        setOutingNotice('')
        setOutingResult(null)
        // trigger 1 — 외출 지도에 들어설 때 먼저 보는 이벤트
        const event = story.eventFor(career, EVENT_TRIGGER.외출)
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
     * [선수정보] 하위 메뉴 중 관리 화면이 직접 띄우지 않는 칸. 장비착용은 장착 상점으로, 나머지는 성적 화면으로
     * 보낸다 (임시). 아이템/스킬은 이제 관리 화면의 스킬 창(`equipSkill`)이 맡는다 — 아이템 쪽은 아직 없다.
     */
    openPlayerInfo: (itemId: string) => {
      if (itemId === '장비착용') {
        setShopNotice('')
        setShopGpDetail(null)
        return setScreen({ kind: '아이템', tab: '착용' })
      }
      setScreen({ kind: '성적' })
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
     * 필살타법 창(상태 0x7b)에서 고른 번호(표 값 1~4)를 선수 +0x18 에 쓴다 (0x1816c `strb`).
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

    confirmGameResult: () => {
      if (rawCareer === null) return
      // 116 → 114: 0x8a6fc 가 쌓은 내장 이벤트를 114 가 틀며 보상 명령(연속 기록 평판 · 슬럼프 스킬)을 먹고, 114 진입 0x11d00 이
      // S+0x50 = 2 → 3 으로 둔다(웹 null — 포스트시즌 g == 0 의 0xb 는 136 진입이 다시 쓴다)
      const career = rawCareer.seasonEndState === 116
        ? { ...streakEventOf(rawCareer).apply(rawCareer), seasonEndState: null }
        : rawCareer
      setCareer(career)
      // 경기 뒤 평가 116 의 끝(0x12b74~0x12b94) — S+0xb4(포스트시즌 중) ≠ 0 이면 **S+0xb2(= L+0x32) == 0 → [114 → 136],
      // 아니면 [114 → 128]** 이다. 관리 주기·중간평가를 안 탄다 (R9 116절).
      //   - 45번째 경기: 하루 끝 0xb818c 가 대진 0xb80a8 을 열며 L+0x32 = 0 → 136(392 목표 평가) 사슬.
      //   - 시리즈가 끝난 내 경기: 0xb76dc 의 0xb7724 가 L+0x32 = −1(b777a), 곧이어 하루 끝 0xb818c(0x4f29c)가 +1 → 0 이라
      //     **136 부터 사슬을 다시 돈다.** 136 진입 0x10bb0 은 0x8bdc9(392) 를 그대로 부르고, 0x8bdc8 → 0xae170 은
      //     레코드를 번호로 찾아 틀 뿐 본 표시를 보지 않는다 — 392 → 130(370) → 131(375) 가 보상째 다시 나오고 128 로 온다.
      //     원본 동작 그대로 옮긴다 (미션·대결 같은 반복 가드가 없는 자리다).
      //   - 그 밖 포스트시즌 경기: 128.
      if (career.postseason !== null) {
        if (leagueDayCounterOf(career) === 0) return setScreen({ kind: '시즌종료' })
        return enterPostseason(career)
      }
      if (isSeasonFinished(career)) return setScreen({ kind: '시즌종료' })
      // 22경기 뒤 중간평가 (0x11910 → 0x11e84)
      if (career.gamesPlayed === MID_SEASON_GAME) {
        const achieved = achievedGoalCount(career, '중간')
        const evaluated = awardTitles(career, midSeasonTitlesOf(career, achieved).filter((title) => !career.titleIds.includes(title)))
        setCareer({ ...evaluated, lastMidSeasonGoalCount: achieved })
        return setScreen({ kind: '이벤트', eventId: midSeasonEventId(achieved), context: '시즌' })
      }
      if (isManagementCycleOpen(career)) {
        setScreen({ kind: '관리' })
        return setManagementCheck('무작위포함')
      }
      // 관리 주기가 아니면 116 의 끝(0x12bb0)이 [114 → 109] 로 보낸다 — 이전 상태가 105 가 아니라 취소가 안 먹는다
      enterNextGameStandings(false)
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
      // 모드 저장 칸에는 국가대항전 여부(S+0x12c, 웹은 대회를 저장하지 않는다)만 남긴다
      nariGameSaveRef.current?.start({ aces: null, isNationalCup: screen.cup !== undefined })
      if (screen.cup !== undefined) {
        // 국가대항전 — 1c5fe 가 마선수를 안 넣었다. 경기가 끝나면 이 대회로 하루를 넘긴다 (`finishCupGame`)
        cupGameRef.current = screen.cup.cup
        // 경기 장면 0xb891c — 두 팀을 대회 레코드 두 칸으로 세운다: 타순 = 대표팀 타자 배열(내 선수 · 벤치로 간 선수),
        // 선발 = 두 칸 투수 0번(142 가 돌린 차례). 두 칸 스태미나는 날마다 10000(대표팀 b81e0 · 상대국 새 복사)
        const teams = cupTeamsOf(career, screen.cup.matchup.opponent)
        return startMatch(
          screen.cup.matchup.myTeam,
          nariCupBattingOrderOf(teams) ?? career.battingOrder,
          screen.cup.matchup.opponent,
          0,
          PLAYER_SIDE_LAST_BAT,
          {
            ourOrder: nariCupRecordOf(teams, screen.cup.matchup.myTeam).pitchers ?? UNSHUFFLED_PITCHER_ORDER,
            opponentOrder: nariCupRecordOf(teams, screen.cup.matchup.opponent).pitchers ?? UNSHUFFLED_PITCHER_ORDER,
          },
          undefined,
          nariQuickLineupOf(teams.korea),
        )
      }
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
        return setManagementNotice(trainingOutcomeLinesOf(outcome).join('!N'))
      }
      setManagementDetail({
        before: career,
        after: trained,
        messages: trainingOutcomeLinesOf(outcome),
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
      if (afterClose.kind === '훈련') {
        const injury = rollTrainingInjury(career, afterClose.isSpecialSwing, random)
        setCareer(injury.career)
        return setManagementNotice(injury.notice ?? '')
      }
      const recovery = recoverAfterRest(career, random)
      setCareer(recovery.career)
      setManagementNotice(recovery.recoveries.join(' · '))
    },

    /** 관리 화면 알림 상자 [확인] — 알림은 여기서만 지운다 (화면이 기억하면 같은 문구가 다시 안 뜬다) */
    dismissManagementNotice: () => setManagementNotice(''),

    /** 칭호 팝업 확인 0x1b1e4 — 비트·곧바로 장착(+0x1c4)·저장, 다음 틀에 다시 판정 */
    confirmTitle: () => {
      if (career === null || pendingTitle === null) return
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

      // 113 → 126: 원본은 연출(0x85074) 뒤 효과(0x15234)를 굴려 효과 팝업을 지도 위에 띄우고, 그 팝업이 닫히면
      // 입원 회복(0x1575c)을 굴린다. 그 사이 다른 굴림이 없어 여기서 한 번에 굴려도 차례가 같다.
      // ⚠️ 미해결: 126 연출 그림(0x84ea0 — event_ani · event_char_1 · event_char_0 세 겹)은 아직 옮기지 않았다.
      const outcome = performOuting(career, outingFunction, random)
      setOutingNotice('')
      setOutingResult({ effectText: outcome.effectText, recoveryText: outcome.recoveryText })
      setCareer(outcome.career)
    },

    /**
     * 126 효과 팝업 [확인] — 틀 0x1575c: 입원이면 회복 글 팝업(코드 1)을 띄우고, 어느 쪽이든 **105(관리)** 로 간다.
     * 회복 팝업은 105 위에 남으므로 관리 화면 알림 상자로 띄운다.
     */
    closeOutingResult: () => {
      if (outingResult === null) return
      setOutingResult(null)
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

    /** [!] 장소에서 [들어가기] — 그 장소(trigger 2~6)의 이벤트를 본다 */
    enterPlace: (place: OutingPlace) => {
      if (career === null || career.hasActedThisCycle) return
      // 이벤트가 없는 장소는 "특별한 일이 없다" (0x16ccc)
      const event = story.eventFor(career, placeTriggerOf(place.frame))
      const eventId = event?.id ?? emptyPlaceEventId(place.frame)
      setScreen({ kind: '이벤트', eventId, context: '장소' })
    },

    completeScene: (rewards: readonly EventReward[], viewedEventIds: readonly number[]) => {
      if (career === null || screen.kind !== '이벤트') return
      const rewarded = applyEventRewards(finishEvent(career, viewedEventIds), rewards, random, screen.eventId)
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
      // 보상 7 로 열린 히든 장비 알림 (StrCOMMON[139]+[143])
      const openTexts = viewed.openedHiddenIds
        .filter((id) => !career.openedHiddenIds.includes(id))
        .map(hiddenOpenTextOf)
        .filter((text): text is string => text !== null)
      if (openTexts.length > 0) setManagementNotice(openTexts.join(' · '))

      if (screen.context === '장소') {
        // 빈 장소(440~444)는 **행동·외출 횟수를 쓰지 않고** 장소 화면으로 돌아간다 (0x1c014, G-4).
        // 앞서 웹은 빈 장소에서도 행동을 썼다 — 원본과 반대였다.
        if (isEmptyPlaceEventId(screen.eventId)) {
          setCareer(viewed)
          return setScreen({ kind: '외출' })
        }
        // 장소 이벤트도 외출이다 — 행동을 쓰고 외출 횟수(칭호 "1년간 외출")에 센다
        const visited = spendCycleAction({ ...viewed, outingsThisSeason: viewed.outingsThisSeason + 1 })
        setCareer(visited)
        return setScreen({ kind: '관리' })
      }
      if (screen.context === '시즌') return continueSeason(viewed, viewedEventIds)
      setCareer(viewed)
      if (screen.context === '외출진입') return setScreen({ kind: '외출' })
      setScreen({ kind: '관리' })
      setManagementCheck('고정')
    },

    /** 경기 중 [메뉴] → 나가기. StrGAME[0] "현재 이닝의 기록과 획득한 G포인트가 사라집니다" */
    quitGame: () => {
      progressRef.current = null
      setProgress(null)
      runner.resetAtBat()
      pitchTallyRef.current = EMPTY_AT_BAT_PITCH_TALLY
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
        setCareer(applyRegularSeasonReward(career, REGULAR_SEASON_HIDDEN_ID.타자편, readRegularSeasonOtherModes?.()))
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

    /** 시즌 성적 화면 뒤 — 올해의 목표 결과(392)부터 연말 이벤트를 잇는다 */
    beginYearEnd: () => {
      if (career === null) return
      // 136 진입 0x10bb0 — S+0x50 = 0xb · 저장 뒤 392
      setCareer(enterSeasonEvent(career, GOAL_INTRO_EVENT_ID))
      setScreen({ kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID, context: '시즌' })
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
      if (!matchPreparedRef.current) {
        // 1c574 — 대회 날짜 g ≠ 0 이면 대표팀·상대국 칸 투수 0~3 을 한 칸씩 돌린다(영구, 같은 문 안이라 한 번만)
        setCareer((current) => current === null
          ? current
          : { ...current, nariCupTeams: prepareNariCupMatch(cupTeamsOf(current, matchup.opponent), cup.day) })
      }
      matchPreparedRef.current = true
      // 홈 팀 — 웹 대회 경기는 후공(내 팀이 홈)으로 친다. 대회 팀은 모두 > 9 라 어느 쪽이든 한 번 굴린다
      rollNariMatchStadium(random, matchup.myTeam)
      setEntryView(null)
      setScreen({ kind: '경기준비', cup: { matchup, cup } })
    },

    /**
     * 대회 끝 — 결과 팝업(`0x25`)과 보상 팝업(`0x26`)을 모두 닫았을 때 (`0x1b92c`).
     * 보상은 커리어에 얹고, 열린 히든 팀은 `openedHiddenIds` 에 넣는다 (웹은 이 칸 하나가
     * 전역 기록 `+0x70` 히든 팀 목록으로 흘러간다 — `App.tsx` 가 그렇게 넘긴다).
     * 그 뒤 원본대로 새 시즌 처리(`0x1b768`)다.
     *
     * 국가대항전 플래그(`S+0x12c`)는 커리어 저장에 자리가 없고 대회 레코드를 화면이 들고 있어,
     * 화면을 떠나면 그대로 없어진다 — 시즌모드의 "플래그가 안 내려가 다음 시즌이 막힌다" 는
     * 원본 버그와는 **무관하다** (그쪽 동작은 건드리지 않았다).
     */
    finishCup: (finish: NationalCupFinish) => {
      if (career === null) return
      const rewarded = applyEventRewards(career, careerNationalCupRewardItems(finish.reward), random)
      // 우승 보상 팝업 0x26 닫힘 0x1bb14 `0x22c7d(1000, 모드 4)` — 보상이 없는 갈래는 부르지 않는다
      if (finish.reward.gamePoint > 0) {
        recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: finish.reward.gamePoint })
      }
      const missing = finish.openedTeams.filter((id) => !rewarded.openedHiddenIds.includes(id))
      startNewSeason({ ...rewarded, openedHiddenIds: [...rewarded.openedHiddenIds, ...missing] })
    },

    /** 부상·방출 엔딩 뒤 5000 G포인트로 이어한다 (StrMODE[221]). 모자라면 false */
    continueAfterEnding: () => {
      if (career === null || career.endingIndex === null) return false
      if (!canContinueAfterEnding(career, career.endingIndex)) return false
      const continued = continueAfterEnding(career)
      setCareer(continued)
      // 팝업 0x32 예 → 0x1bdc6 `0x22c29(모드 4 → 1, 5000)`
      recordStat({ kind: 'G사용', usage: leagueUsageOf(BATTER_LEAGUE_MODE), amount: CONTINUE_COST_GAME_POINT })
      setScreen({ kind: '관리' })
      setManagementCheck(continued.season === career.season ? '무작위포함' : '고정')
      return true
    },

    /**
     * 엔딩을 본 뒤 — 선수를 지우고 메인 메뉴로 (등록한 선수는 수집 기록에 남는다). 명예의 전당 등록은 0x62dbe 에서
     * 모드 저장 지우기 0x224ec(저장, 4) 를 부른다 — +0x50 = 0. 등록 없이 끝나도 마지막 경기 정산이 이미 0 으로 두었다.
     */
    finishEnding: () => {
      nariGameSaveRef.current?.clear()
      saveGame.clear()
      setSavedCareer(null)
      setCareer(null)
      setScreen({ kind: '메인메뉴' })
    },
  }


  return {
    savedCareer,
    career,
    progress,
    shopNotice,
    shopGpDetail,
    outingNotice,
    outingResult,
    managementNotice,
    managementDetail,
    pendingTitle,
    loadingTip,
    matchAces,
    /** 143 경기 전 엔트리 보기 — 142(`경기준비`) 위에 선다 */
    entryView: screen.kind === '경기준비' ? entryView : null,
    storyEvents: story.events,
    eventPlaceIds: story.eventPlaceIds,
    handlePitchResolved,
    actions,
  }
}

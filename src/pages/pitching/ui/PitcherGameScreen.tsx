import { emitSubstitutionEntryParticle } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { useCallback, useEffect, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { isRivalryMatch } from '@/widgets/game-scene/lib/rivalryBand'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { useBurstObjectTicksReset } from '@/widgets/burst-mission/model/useBurstObjectTicksReset'
import { BurstBand } from '@/widgets/burst-mission/ui/BurstBand'
import { burstBandRoleOf } from '@/widgets/burst-mission/lib/burstBandLayout'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import { hiddenStealBasesOf, pitchSlotsFor, pitchersOfRecordOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type {
  PitcherGameOptions,
  PitcherGameProgress,
  PitcherGameSummary,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuOpenOnHide, useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import type { PitcherGameSession } from '@/pages/pitching/model/usePitcherGame'
import { GAME_LOADING_PRELOADS } from '@/pages/team-game/lib/gameLoadingPreloads'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { useSubstitutionScene } from '@/features/play-game/model/useSubstitutionScene'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { pitcherIntroBatterHandOf, pitcherMatchupCardsOf } from '@/pages/pitching/lib/pitcherMatchupCards'
import type { PitcherMatchupRecords } from '@/pages/pitching/lib/pitcherMatchupCards'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { PitchSlotPicker } from '@/pages/pitching/ui/PitchSlotPicker'
import type { PitchSlotChoice } from '@/pages/pitching/ui/PitchSlotPicker'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { ManagerHookWindow } from '@/pages/pitching/ui/ManagerHookWindow'
import { PressArea } from '@/shared/ui'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import { MENU_PRESS_RECT, TIME_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { useFreePassPlayStart } from '@/pages/defense/model/useFreePassPlayStart'
import { useWarmFieldBackgrounds } from '@/pages/defense/model/useWarmFieldBackgrounds'
import { isWalkPlayResult } from '@/features/defense-play/model/walkPlay'
import { DEFENSE_SCENE_START, type DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { useSceneScopedRef } from '@/pages/defense/model/useSceneScopedRef'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { activeSound } from '@/shared/api/audio/soundPort'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { hasGameIntro } from '@/widgets/game-scene/lib/introSchedule'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'
import { introStadiumNameFrameOf } from '@/widgets/game-scene/lib/introLayout'
import { fielderNamesByPosition, halfInningFieldOf } from '@/widgets/field-walk/lib/halfInningFieldInput'
import {
  type BenchClearingOffenseAces,
  aceRunnerBasesOf,
  benchClearingFieldOf,
} from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { useWalkerLineSeats } from '@/widgets/field-walk/lib/useWalkerLineSeats'
import { nariFieldersAfterPinchHits } from '@/entities/career/model/nariTeamRecord'
import { type PitcherFieldLineups, pitcherFieldAcesOf } from '@/pages/pitching/lib/pitcherFieldTeams'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { pitcherHalfInningCardsOf } from '@/pages/pitching/lib/pitcherHalfInningCards'
import { runScoreBoardSourceOf } from '@/pages/defense/lib/runScoreBoard'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { endBoardLineScoreOf, GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { useRecordAlert } from '@/widgets/game-scene/model/useRecordAlert'
import { useBatterPitchEnd } from '@/pages/game/model/useBatterPitchEnd'
import { RecordAlertScreenOverlay, RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { isGameEndRecord, leadingRecordCountOf } from '@/widgets/game-scene/lib/recordAlert'
import { passesRecordTeamGate, recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { SettlementBoard } from '@/pages/team-game/ui/SettlementBoard'
import { SettlementPressArea } from '@/pages/team-game/ui/SettlementPressArea'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { nariSceneStadium, sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { MAXIMUM_GAME_POINT, STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { AutoPlayRelayReplay } from '@/pages/auto-play-relay'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { resultWaitTicksOf } from '@/pages/game/lib/batterRecordAlert'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { pitcherAutoRelayStepsOf } from '@/pages/pitching/lib/pitcherAutoRelay'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  opponentBatterOf,
  opponentRunnerAcesOf,
  ourBenchPitcherCountOf,
  pitcherSceneSkillPanelOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { batterEquipmentOf, bodyTypeOf, NO_PITCHER_EQUIPMENT, pitcherEquipmentOf } from '@/widgets/batting-stage/lib/batterLayers'
import { stageWarmCastOf } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import { useWarmStageCast } from '@/widgets/batting-stage/model/useWarmStageCast'
import { teamBatters } from '@/entities/team/model/teamRoster'
import type { BatterEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { aceBatterProfileOf, batterHandOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import { PitcherSideStage } from '@/widgets/batting-stage/ui/PitcherSideStage'
import { passesHeldResult, pitchResultEntryDelayTicksOf, pitchSceneBusyTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { usePitcherHitScene } from '@/widgets/batting-stage/model/usePitcherHitScene'
import { usePitchArrivalHold } from '@/widgets/batting-stage/model/usePitchArrivalHold'
import { usePitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import { createSkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { useSkillCheerRestore } from '@/widgets/batting-stage/model/useSkillCheerRestore'
import { usePickoffTouchKeys } from '@/features/defense-play/model/pickoffTouchKeys'
import { publishScenePeek } from '@/shared/lib/scenePeek/scenePeek'

/**
 * 나만의리그 **투수편**(원본 모드 3) 경기 화면.
 *
 * 원본 경기 장면의 사람 조작 세 단계를 그대로 따른다 (I-controls 0절 · R10 2절):
 *   0xf  구질 고르기 — (2)(4)OK(6)(8) 다섯 자리 + '0' 마구, 틱 8 뒤 넘김 (`PitchSlotPicker`)
 *   0x10 조준 — 방향키로 흐르는 조준점, OK 확정 · CLR 은 0xf 로 (`AimCursor`)
 *   0x11 게이지 — OK 한 번, 틱 10 에 놓는다 (환경설정 "투구 게이지" 가 꺼져 있으면 이 단계가 없다)
 * 그리고 0xe·0xf 에서 `#` 를 누르면 "그만 던지시겠습니까?"(StrGAME[104]) 가 뜬다.
 *
 * 경기 장면 연출(`widgets/game-scene`, 타자편·팀 경기와 같은 부품):
 *   0xc  경기 시작 인트로 — 모드 3 도 적재 상태 8 끝에서 온다(54틱, OK·'5' 건너뛰기). 효과음 61 은 `usePitcherGame`.
 *   0x18 1회초 판 — 후공이고 오늘 선발일 때만 선다(진행기 `withHalfInningBoard`). 틱 2 에 징글 13.
 *   0x1e 벤치 클리어링 — 내가 던진 사구가 20/99 에 걸리면(소리 44·OK 건너뛰기).
 *   0x18 경기 끝 결과 판 — 점수 두 개와 승·패·세 세 줄, 10틱 입력 잠금 → OK → 정산(0x19, 아래 요약 화면).
 */
type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 덮는 하위 화면 — 경기 중 메뉴가 연다 */
type MenuOverlay = '조작방법' | '설정'

/** 나만의리그 투수편 = 원본 전역 모드 3 — 경기 중 메뉴 표 0xcfcfc 의 **행 2**(네 칸)다 */
const PITCHER_CAREER_MODE = 3

interface PitcherGameScreenProps {
  readonly options: PitcherGameOptions
  readonly random: RandomPort
  /** 경기가 끝나고 사용자가 확인을 누르면 부른다 */
  readonly onFinish: (summary: PitcherGameSummary) => void
  /** 경기 화면을 그냥 나갈 때 (원본 경기 중 메뉴 '*' 의 "나가기") */
  readonly onQuit?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 값. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * 내 투수 이름 — 경기 끝 결과 판의 승·패·세 줄이 내 이름을 적을 때 쓴다(진행기 옵션에는 이름이 없다).
   * 안 넘기면 내 줄은 이름 칸이 빈다.
   */
  readonly pitcherName?: string
  /**
   * 경기 전 보유 G [app+0x64] — 정산 판(0x4a384)의 "보유 GP" 줄. 정산 진입 0x4ea0c 가 이 경기 기록 달성 G 를 먼저 더하고(4ec5a,
   * 0~99999) 판을 그리므로 판은 더한 값을 보인다. 안 주면 그 줄 숫자를 비운다.
   */
  readonly gamePoint?: number
  /**
   * 상태 0xe 소개 판(0x44944)의 시즌 줄 출처 — 내 투수 시즌 줄과 리그 선수 기록표. 안 주면 방어율·탈삼진·타율·홈런·타점을
   * 비운다 (`pitcherMatchupCardsOf`).
   */
  readonly matchupRecords?: PitcherMatchupRecords
  /**
   * 내 투수의 장비 니블 (`PitcherCareer.equipmentLevels`) — 장면 셋업 0x108f8 이 모드 ≠ 4 면 세우는 투수 그림(0x79368)에
   * 0x10810 이 부위마다 0x79790 으로 장비 겹을 싣는다. 안 주면 맨몸 투수다.
   */
  readonly pitcherEquipmentLevels?: PitcherAbility
  /**
   * 내 투수의 피부 `(rec[0xb] >> 2) & 3` — 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림 적재 0x793b0 에 넘겨 794c2 가 `pitcher.pzx` 를
   * 피부 × 15 + 수비 팀(내 팀) 벌로 연다. 안 주면 0
   */
  readonly pitcherSkinIndex?: number
  /**
   * 두 팀의 레코드 타자 배열 차례 — 경기 장면 0x39fdc 가 `0xb891c(…, 모드 3, 팀)` 로 세운 나리 팀 레코드(국가대항전이면 대회 칸).
   * 공수 교대 판 이름표 0x40008 · +0xec(마선수 그림) · 벤치 클리어링이 이 차례로 훑는다. 안 주면 이름표는 투수만, 마선수 그림은 보통 그림
   */
  readonly fieldLineups?: PitcherFieldLineups
}

/**
 * 나리 투수편 경기 화면 — 경기 장면 0x104 하나. 생성자 0x3301c 가 33100 `0xbcb49(상태, 7)` 로 모드 갈래 없이 상태 7 을 예약해
 * 로딩 판(상태 7 · 9 · 8)을 먼저 지난다. 진행 칸 끝은 0x24(모드 3 ≠ 4 — 0x39f88 39f92~39f98), 팁은 0x53dbc 의 굴림(`usePitcherGame`
 * 의 맨 앞). 판이 다 그려지면(상태 8 끝 → 인트로 0xc) 경기 화면이 선다.
 * ⚠️ 근사(시간)(남김 — 단말 몫 · 바이너리 밖): 원본 판 길이는 단말의 적재 시간 — 웹은 나리 타자편 · 미션과 같은 `LoadingTip`(칸 하나 = 한 그림)
 */
export function PitcherGameScreen(props: PitcherGameScreenProps) {
  useBurstObjectTicksReset() // 경기 장면 생성 0x48658 — 돌발 객체 [+0x224] = 0
  const session = usePitcherGame(props.options, props.random, props.settings?.isVibrationOn)
  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.finishLoading} preloadRequests={GAME_LOADING_PRELOADS} />
      </RawScreen>
    )
  }
  return <PitcherGameScene {...props} session={session} />
}

function PitcherGameScene({
  options,
  random,
  onFinish,
  onQuit,
  settings,
  onSettingsChange,
  pitcherName,
  matchupRecords,
  gamePoint,
  pitcherEquipmentLevels,
  pitcherSkinIndex = 0,
  fieldLineups: recordFieldLineups,
  session,
}: PitcherGameScreenProps & { readonly session: PitcherGameSession }) {
  const { progress, canPitch, summary, actions } = session
  const audio = activeSound()
  /** 경기 시작 인트로(상태 0xc)가 끝났는가 — 모드 3 은 인트로가 선다 (`hasGameIntro`) */
  const [isIntroDone, setIntroDone] = useState(!hasGameIntro(PITCHER_CAREER_MODE))
  /** OK 로 닫은 마지막 공수 교대 판(상태 0x18 교대 가지)의 번호 */
  const [closedBoardSerial, setClosedBoardSerial] = useState(0)
  /** 경기 끝 결과 판(0x18)에서 OK 를 눌러 정산(0x19)으로 넘어갔는가 */
  const [isEndBoardClosed, setEndBoardClosed] = useState(false)
  /** 정산 배경 전용 난수 — 경기 난수를 건드리지 않는다 (팀경기 `TeamGameScreen` 정산 갈래와 같다) */
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /** 정산 효과 층(비 · 파티클) — 타석 배경과 정산 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  // 상대 타자 명단 · 내 투수의 칠하기를 미리 건다 — 원본은 타석 교대 0x47cc8 의 적재 때 칠해 첫 그림부터 제 색이다
  const stageWarmCast = pitcherGameWarmCastOf(progress, pitcherEquipmentLevels, pitcherSkinIndex)
  useWarmStageCast(stageWarmCast)
  /** 경기 장면 동안 남는 HOMERUN 글자 칸 · 표시 비거리 +0x36 — 수비 판 홈런 연출이 판마다 이어 쓴다 (`defenseHomeRunEffects`) */
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, options)
  /** 경기 스킬 표시 판의 함성 비트 칸 skin+0x44c(0x3301c 가 두 측 0x3ff) · 애니 7 · 8 — 경기 장면 수명 (`skillPanel`) */
  const skillPanelSceneRef = useSceneScopedRef(createSkillPanelScene(), options)
  // 교체 연출 0x16 진입 0x3d458 의 CPU 대타 가지 0x668cc (`SubstitutionScene.cheerRestore`)
  useSkillCheerRestore(progress.substitutionScene, skillPanelSceneRef)
  const board = progress.halfInningBoard
  const isHalfInningBoardOpen = board !== null && board.serial !== closedBoardSerial && summary === null
  /** 두 팀 레코드 차례 — 대타 0xaebe4 가 맞바꾼 자리 니블은 지금 명단으로 따라간다 (`nariFieldersAfterPinchHits`) */
  const fieldLineups: PitcherFieldLineups | undefined =
    recordFieldLineups === undefined
      ? undefined
      : {
          ours: nariFieldersAfterPinchHits(recordFieldLineups.ours, progress.ourLineup),
          opponent: nariFieldersAfterPinchHits(recordFieldLineups.opponent, progress.opponentLineup),
        }
  const benchOffense = progress.pendingBenchClearing === null ? null : pitcherBenchOffenseOf(progress, options, fieldLineups)
  const boardOurDefense = board !== null && (board.half === '초' ? 0 : 1) !== options.playerSide
  const ourFieldRecords = pitcherFieldAcesOf(progress, options, fieldLineups, true)?.records ?? null
  /**
   * 경기 장면 두 줄의 +0xec (`useWalkerLineSeats`) — 1회초 판 0x3fac4 · 수비 판 시작 0xb0fb4(투수편의 수비 판은 늘 내 팀 수비) ·
   * 벤치 클리어링 0x3a5f0
   */
  const walkerSeats = useWalkerLineSeats({
    sceneKey: options,
    playKey: progress.pendingDefensePlay ?? progress.pendingRunnerPlay ?? progress.lastDefensePlay,
    playDefenseRecords: ourFieldRecords,
    board:
      board === null || fieldLineups === undefined
        ? null
        : {
            key: board.serial,
            defense: boardOurDefense ? fieldLineups.ours : fieldLineups.opponent,
            offense: boardOurDefense ? fieldLineups.opponent : fieldLineups.ours,
          },
    benchClearing: progress.pendingBenchClearing === null ? null : { key: progress.pendingBenchClearing, offense: benchOffense },
  })
  const isBenchClearing = progress.pendingBenchClearing !== null
  /** 공용 키 0x498d4 의 상태 범위(0xd~0x15) 밖 — 인트로 0xc · 판 0x18 · 벤치 클리어링 0x1e */
  const isSceneShowing = !isIntroDone || isHalfInningBoardOpen || isBenchClearing || summary !== null

  const [phase, setPhase] = useState<PitchPhase>('구질')
  /** 구질 · 조준 · 게이지 그림 재료 — 장면이 그 위에 그린다 (0x4c4bc · 0x4d780 · 0x4d2ac) */
  const inputOverlayRef = usePitchInputOverlayRef()
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  /** 일시정지 팝업이 떠 있는가 — 경기 중 메뉴, 또는 그 하위 4 [조작방법] 뷰어 (둘 다 0x741a0 팝업이라 경기 키·갱신이 멈춘다) */
  const isPopupOpen = isMenuOpen || overlay === '조작방법'
  /** 이미 다 보여 준 수비 플레이 — 같은 플레이를 두 번 재생하지 않는다 */
  const [shownPlay, setShownPlay] = useState<DefensePlayResult | null>(null)
  const play = progress.lastDefensePlay
  const finishPlayback = useCallback(() => setShownPlay(play), [play])
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  /** 0x10 에서 확정한 조준점 `+0x10b8` — 게이지(0x11) 뒤 놓을 때 쓴다 */
  const [aim, setAim] = useState<WorldPoint | null>(null)
  /** 제안 대사를 이미 보여 준 돌발 행 */
  const [shownProposal, setShownProposal] = useState<BurstMissionRow | null>(null)
  /** `#` 강판 물음이 떠 있는가 */
  const [asksGiveUp, setAsksGiveUp] = useState(false)

  /**
   * 전역 경기 상태 +0x6b (`liveGameState`) — 이닝 넘김 0xb6b6c 가 경기 장면에서 그때그때 쓴다. 경기 중 나가기(0x40140)는 이 칸을
   * 안 지우므로 나간 그 이닝이 남는다(투수편 116 이어하기의 감독 글 38 이 본다). 0 으로 두는 것은 경기 셋업 0x3a200(세션)이다
   */
  const inningIndex = progress.game.inning - 1
  useEffect(() => {
    setLiveGameInningIndex(inningIndex)
  }, [inningIndex])

  // 타석·차례가 바뀌면 1단계로 되돌린다
  useEffect(() => {
    if (!canPitch) return
    if (progress.atBat.balls === 0 && progress.atBat.strikes === 0) setPhase('구질')
  }, [canPitch, progress.atBat.balls, progress.atBat.strikes])

  /**
   * 원본 공용 키 처리 `0x498d4` 의 '\*' — 경기 중 메뉴.
   * ('#' 는 이 모드에서 교체 화면이 아니라 "그만 던지시겠습니까"(StrGAME[104])로 간다 — I-controls 4b.)
   */
  // 단말 일시정지 0x463ac — '*' 가 받는 때이고 하위 창이 없으면 같은 메뉴를 연다
  useInGameMenuOpenOnHide(menu, !isSceneShowing && overlay === null)
  useEffect(() => {
    if (isSceneShowing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      event.preventDefault()
      menu.pressStar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSceneShowing, menu.pressStar, overlay])

  const burst = progress.burst
  const resolution = progress.lastBurstResolution
  const proposal =
    burst !== null && burst.current !== null && burst.current !== shownProposal ? burst.current : null
  const burstRow = resolution?.row ?? proposal
  const burstLines =
    burst === null || burstRow == null
      ? null
      : (ORIGINAL_BURST_TABLES[burst.table].lines[burstRow.index] ?? null)

  /**
   * **견제** — 구질 고르기(상태 0xf)에서만 '3' 1루 · '1' 2루 · '7' 3루 (0x53548, 설명서 <투구 조작>).
   * 코스·게이지 단계는 원본도 다른 상태(0x10·0x11)라 받지 않는다. 그 루에 주자가 없으면 진행기가 키를 먹고 끝낸다.
   */
  // 견제 판(또는 홈런 비행)을 재생하는 동안은 원본도 상태 0x17 이라 0xf 키를 안 받는다
  // 볼넷 · 사구 밀어내기 판(종류 2)은 0x12 대기(0x1f 틱) 뒤 판정 A 가 0x17 로 보낸다 — 그동안 타석 화면을 둔다
  const isReplayReady = useFreePassPlayStart(
    play !== null && play !== shownPlay ? play : null,
    progress.pendingBenchClearing !== null,
    isPopupOpen,
  )
  const isReplaying = play !== null && play !== shownPlay && play.ticks.length > 0 && isReplayReady
  /**
   * **자동진행 중계(상태 0x21)** — 사람 장면 사이에 돈 간이 엔진 틱들(우리 공격 · 강판 뒤 수비)을 틱마다 한 칸씩 튼다
   * (`progress.autoRelay`, 그리기는 미션과 같은 몫 — 모드 3 은 키 · 속도 · 배경음 · 연출 대기가 없다). 앞 판의 수비 재생 뒤, 0x18 · 0xe 앞.
   */
  const relay = progress.autoRelay ?? null
  const [shownRelaySerial, setShownRelaySerial] = useState(0)
  const finishRelay = useCallback(() => setShownRelaySerial(relay?.serial ?? 0), [relay])
  /**
   * 내 공의 0x12 대기 — 맞히지 못한 공은 갱신 0x4e6d4 가 상태 틱을 15(볼넷 · 사구 · 삼진이면 31) 까지 기다린 뒤 판정 A 가 다음
   * 상태(반 이닝이 끝났으면 0x21)로 보낸다. 웹 진행기는 공 하나에 자동진행까지 돌리므로 중계를 그 틱 뒤로 민다.
   * 웹 진행기는 놓는 순간(0x11 틱 10) 판정까지 내므로 남은 0x11 비행(공 틱 N + 1 까지)도 함께 센다(`pitchSceneBusyTicksOf`) —
   * 그동안은 원본도 0x11 · 0x12 라 다음 공의 구질 키 · 견제 · '#' · 0xe 의 OK 를 안 받는다.
   */
  const atBatBeforeThrowRef = useRef(progress.atBat)
  /**
   * **CPU 타자가 맞힌 공의 0x11 끝 · 0x13** — 진행기는 놓는 순간 수비 판(`pendingDefensePlay`)을 세우지만 원본은 판정 틀(스윙 F + 1 ·
   * 번트 N − 1)까지 공이 날고 0x13(큰 타구면 문턱 + 7 틱)을 지나 0x17 로 간다 — 그동안 타석 장면이 그리고 0x17 이 선 틀에 수비 판을 띄운다
   */
  const pitcherHitScene = usePitcherHitScene({
    play: progress.pendingDefensePlay,
    pitch: progress.lastPitch,
    cpuSwing: progress.lastCpuSwing ?? null,
    batterHand: stageBatterHandOf(progress),
    // 장면(`isFrozen` = `isPitchInputPaused`)과 같이 선다
    isFrozen: isPopupOpen || asksGiveUp,
  })
  const isHitSceneShowing = pitcherHitScene.isShowing
  /**
   * **공 도착 판(도루 · 폭투)의 0x11 끝 · 0x12 틱 0** — 진행기는 놓는 순간 주자 판(`pendingRunnerPlay`)을 세우지만 원본은 0x12 진입
   * 0x3dfac 이 판을 열어 0x17 을 예약한다 — 그 다음 그림까지 타석 장면을 두고 수비 화면을 띄운다 (`usePitchArrivalHold`)
   */
  const isArrivalHolding = usePitchArrivalHold({
    play: progress.pendingRunnerPlay?.kind === 'arrival' ? progress.pendingRunnerPlay : null,
    pitch: progress.lastPitch,
    isFrozen: isPopupOpen || asksGiveUp,
  })
  /**
   * **공 끝 0x4e600 의 때** — 0x12 끝(문턱 갱신 0x4e796) · 0x17 끝(0x52a60). 진행기는 놓는 순간(0x11 틱 10) 판정을 내므로 그 판정이
   * 든 그림에서 0x12 틱 0 까지(`pitchResultEntryDelayTicksOf`) 를 대기 앞에 붙인다. 맞은 공 · 공 도착 판(도루 · 폭투)은 그 판(0x13 을
   * 그리는 동안 포함)이 끝날 때, 견제 · 밀어내기 판도 그 판이 끝날 때다 (`useBatterPitchEnd` — 타자편과 같은 셈)
   */
  const pitchEnd = useBatterPitchEnd({
    isPlayShown: progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null || isReplaying,
    isFrozen: isPopupOpen || asksGiveUp,
  })
  const { notePitchResolved } = pitchEnd
  const [pitchWaitTicks, setPitchWaitTicks] = useState(0)
  /** 마지막 공의 0x12 길이 — 타석 장면(`PitcherSideStage`)이 공을 마지막 점에 두는 틱 수 */
  const [heldResultTicks, setHeldResultTicks] = useState(0)
  const lastResolution = progress.lastResolution
  const lastResolutionRef = useRef(lastResolution)
  useEffect(() => {
    if (lastResolutionRef.current === lastResolution) return
    lastResolutionRef.current = lastResolution
    if (lastResolution === null) return
    const waitTicks = resultWaitTicksOf(applyPitchResolution(atBatBeforeThrowRef.current, lastResolution).outcome)
    // 공 끝 — 이 그림(놓은 틱)에서 0x12 틱 0 까지 + 문턱. 판(맞은 공 · 공 도착 판)이 섰으면 그 판 끝이 공 끝이다
    notePitchResolved({
      isHit: progress.pendingDefensePlay !== null,
      waitTicks: pitchResultEntryDelayTicksOf(progress.lastPitch?.frameCount ?? 0) - 1 + waitTicks,
    })
    if (progress.pendingDefensePlay !== null) return
    // 공 도착 판 — 장면은 0x12 틱 0 까지 그린다(0x12 문턱은 그 그림의 판정 글자 틱만 본다). 키 막음은 판이 맡는다
    if (progress.pendingRunnerPlay?.kind === 'arrival' && passesHeldResult(lastResolution)) setHeldResultTicks(waitTicks)
    if (progress.pendingRunnerPlay != null) return
    if (lastResolution.kind === '타구') return
    setPitchWaitTicks(pitchSceneBusyTicksOf(progress.lastPitch?.frameCount ?? 0, waitTicks))
    setHeldResultTicks(waitTicks)
  }, [lastResolution, progress.pendingDefensePlay, progress.pendingRunnerPlay, progress.lastPitch, notePitchResolved])
  useSceneTick(() => setPitchWaitTicks((left) => Math.max(0, left - 1)), pitchWaitTicks > 0 && !isPopupOpen)
  /** 공이 날거나 0x12 인 동안 — 원본 상태 0x11 · 0x12 */
  const isPitchSceneBusy = pitchWaitTicks > 0
  /**
   * st[0x15 + i] — CPU 가 이번 공에 도루를 출발시킨 주자는 루에 안 그린다(`hiddenStealBasesOf`, 0x520de → 0xa9bd4).
   * 진행기가 같은 걸음에 다음 공의 0xf 진입까지 돌려도 원본 0xf 진입은 0x12 뒤라 공이 날거나 0x12 인 동안은 숨긴다 —
   * 던진 걸음의 첫 그림은 위 효과가 대기 틱을 세우기 전이라 새 판정(`lastResolution`)이 들어온 그림도 그동안으로 친다
   */
  /** 내 공이 날거나 0x12 인 동안(0x11 · 0x12) — 던진 걸음의 첫 그림은 위 효과가 대기 틱을 세우기 전이라 새 판정이 든 그림도 친다 */
  const isPitchFlightShown =
    isPitchSceneBusy || lastResolutionRef.current !== lastResolution || isHitSceneShowing || isArrivalHolding
  const hiddenRunnerBases = hiddenStealBasesOf(progress, isPitchFlightShown)
  const isRelaying = relay !== null && relay.serial !== shownRelaySerial && !isReplaying && pitchWaitTicks === 0
  /**
   * **상태 0xe — 내가 던지는 타석마다 사람 OK 를 기다린다** (`features/play-game/model/sceneConfirm`, 0x39e14 → 0x532b0 —
   * 0x532b0 은 조작 객체의 공수를 안 본다). 진입에서 감독 강판(0x504cc)이 참이면 0x23 이라 OK 를 기다리지 않고 0xd 두 그림 ·
   * 0xe 한 그림만 지난다(`hooksAtEntry`).
   * 인트로·교대 판·수비 화면·벤치 클리어링·경기 중 메뉴·조작방법·설정·강판 물음·돌발 결과 창·감독 대사 창이 덮으면 받지 않는다.
   * OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타)은 OK 를 받을 때 진행기가 돌린다 (`confirmScene`).
   */
  /**
   * **교체 연출 0x16** — 0xf 진입의 CPU 대타 뒤 진행기가 싣는다(`substitutionScene`). "CHANGE" 애니를 다 그린 뒤 0xd 두 그림 →
   * 0xe(진입 0x50674 의 감독 강판 판정 · 등판음 · OK 대기). 그동안은 0xe 대기 · 감독 대사 창을 세우지 않는다.
   */
  const substitution = useSubstitutionScene(
    progress.substitutionScene,
    progress.sceneConfirm,
    !isSceneShowing &&
      progress.pendingDefensePlay === null &&
      progress.pendingRunnerPlay == null &&
      !isReplaying &&
      !isRelaying &&
      !isPitchSceneBusy &&
      !isPopupOpen &&
      overlay === null &&
      !asksGiveUp &&
      resolution === null,
    // 0xe 첫 그림의 0x38b64 — 타석 캔버스가 그린 타자 자리에 대타 등판 파티클(ptc/003)
    (scene) => emitSubstitutionEntryParticle(scene.entryKind),
  )
  const sceneConfirm = useSceneConfirm(
    // 진행기가 OK 를 아직 안 받은 0xe 대기 — 또는 0xe 진입에서 감독 강판으로 빠지는 지나감(0xd 두 그림 · 0xe 한 그림, `hooksAtEntry`)
    progress.sceneConfirmPending === true || progress.managerHookText !== null ? progress.sceneConfirm : null,
    !isSceneShowing &&
      progress.pendingDefensePlay === null &&
      progress.pendingRunnerPlay == null &&
      !isReplaying &&
      !isRelaying &&
      !isPitchSceneBusy &&
      !isPopupOpen &&
      overlay === null &&
      !asksGiveUp &&
      // 타석이 끝나며 난 돌발 결과 창(0x1d)은 다음 0xd 보다 먼저다 (+0x1b6c)
      resolution === null &&
      !substitution.isShown,
    actions.confirmScene,
  )
  /**
   * 감독 강판의 0xd · 0xe 지나감 — 진입 0x50674 506ea 0x504cc 참이어도 앞선 0xd 두 그림 · 0xe 한 그림(0x4d9ec)은 그린다. 다 지나면
   * 다음 틀 0xbc9c8 이 0x23 으로 옮겨 강판 창이 선다
   */
  const isHookPassing = progress.managerHookText !== null && sceneConfirm.isAwaiting
  const isAwaitingConfirm = sceneConfirm.isAwaiting && (canPitch || isHookPassing)
  /** 돌발 제안 창(0x1b)은 0xe 의 OK 뒤 메시지 1 이 굴려 예약한다(0x50c42) — OK 전에는 안 띄운다. 결과 창은 0xe 앞이다 */
  const visibleBurstLines = resolution === null && isAwaitingConfirm ? null : burstLines
  /** 돌발 띠 0x8e858 의 [M+0xc] — 발동부터 결과 창을 닫을 때(0x8e5b8 8e7ee~8e800)까지 */
  const burstBandRow = burst?.current ?? resolution?.row ?? null
  const acceptsPickoff =
    canPitch &&
    !isAwaitingConfirm &&
    !isReplaying &&
    !isRelaying &&
    !isPitchSceneBusy &&
    !isSceneShowing &&
    phase === '구질' &&
    !isMenuOpen &&
    !asksGiveUp &&
    overlay === null &&
    burstLines === null &&
    progress.managerHookText === null
  const { pickoff } = actions
  useEffect(() => {
    if (!acceptsPickoff) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 견제 키 0x53548 — 다음 틀의 키 0x498d4 가 0xf 갱신보다 먼저 처리한다(구질 고르기 `PitchSlotPicker` 의 키 칸에 든다)
      const { key } = event
      pushSceneKey(() => pickoff(key))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsPickoff, pickoff])
  // 터치 기기 — 주자가 있는 루마다 "N루 견제" 상황 버튼(같은 키 사건을 쏜다)
  usePickoffTouchKeys(acceptsPickoff, progress.game.bases)

  /**
   * '#' — 공용 키 0x498d4 의 '#' 가지(0x4994a): 0x38984 참이고 경기 상태가 **0xe 또는 0xf** 면, 모드 3 은 StrGAME[104]
   * "그만 던지시겠습니까?" 물음(0xbbef8(…, 2, 0x1b, 1))만 띄운다. 0xe 의 OK 뒤 굴림은 OK 를 받을 때 진행기가 돌리므로
   * (`confirmScene`) 0xe 에서 "예" 하면 그 굴림이 아예 안 돈다. 0xd(대기가 보인 뒤 두 그림)·코스(0x10)·게이지(0x11)는 밖이다.
   */
  const acceptsGiveUpKey =
    canPitch &&
    !isSceneShowing &&
    !isPopupOpen &&
    overlay === null &&
    !asksGiveUp &&
    !isReplaying &&
    !isRelaying &&
    !isPitchSceneBusy &&
    progress.pendingDefensePlay === null &&
    progress.pendingRunnerPlay == null &&
    progress.managerHookText === null &&
    visibleBurstLines === null &&
    (isAwaitingConfirm ? sceneConfirm.isInConfirmState : phase === '구질')
  const acceptsGiveUpKeyRef = useRef(acceptsGiveUpKey)
  acceptsGiveUpKeyRef.current = acceptsGiveUpKey
  /** '#' 는 장면 키 칸에 든다 — 받은 다음 틀의 키 0x498d4(4994a)가 그 틀의 상태(0xe · 0xf)를 보고 물음을 띄운다 */
  const pressGiveUp = useCallback(() => {
    pushSceneKey(() => {
      if (acceptsGiveUpKeyRef.current) setAsksGiveUp(true)
    })
  }, [])
  useEffect(() => {
    if (!acceptsGiveUpKey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '#') return
      event.preventDefault()
      pressGiveUp()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsGiveUpKey, pressGiveUp])
  // 장면 바로가기 · e2e 가 기다릴 자리(웹 개발 도구 — `shared/lib/scenePeek`). 스위치는 그 자리에 둬야 배포 빌드에서 접힌다
  const isPitchSlotPickerShown =
    canPitch && !isSceneShowing && !isAwaitingConfirm && !isPitchSceneBusy && !isReplaying && !isRelaying && phase === '구질' &&
    progress.pendingDefensePlay === null && progress.pendingRunnerPlay == null
  const isDefensePlayShown = progress.pendingDefensePlay !== null && !isHitSceneShowing
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'e2e')) return
    publishScenePeek('pitcherGame', {
      isIntroDone, canPitch, isAwaitingConfirm, isPitchSlotPickerShown, acceptsGiveUpKey, isDefensePlayShown,
    })
  }, [isIntroDone, canPitch, isAwaitingConfirm, isPitchSlotPickerShown, acceptsGiveUpKey, isDefensePlayShown])
  useEffect(() => () => {
    if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') publishScenePeek('pitcherGame', null)
  }, [])

  const throwWith = (gaugeCell: number, throwAim: WorldPoint | null = aim) => {
    if (slot === null) return
    // 이 공으로 끝난 타석 결과를 0x12 대기 틱(`resultWaitTicksOf`)에 쓴다 — 던지기 전 카운트
    atBatBeforeThrowRef.current = progress.atBat
    actions.throwPitch({ typeNumber: slot.typeNumber, ...(throwAim === null ? {} : { aim: throwAim }), gaugeCell })
    setPhase('구질')
    setSlot(null)
    setAim(null)
  }
  /** 이 공이 게이지를 쓰는가 (`0x3f500` — 게이지 켬 ∧ 마구 아님). 안 써도 0x11 은 지나 틱 10 에 놓는다 */
  const showsGauge = options.gaugeSettingOn === true && slot?.isMagic !== true
  /** 투구 입력 단계를 가리는 팝업 — 원본은 그 동안 상태 틱이 멈추고(0x741a0) 단계 상태는 그대로다 */
  const isPitchInputPaused = isPopupOpen || asksGiveUp

  // 점수판 틀 0x41440 의 두 측 — 내 팀 PLAYER · 상대 COM
  const scoreboardSides = humanVsComputerSidesOf(options.playerSide, options.ourTeamId, options.opponentTeamId)
  /**
   * 구장 객체 — 셋업 0x39fdc 모드 3 갈래: 홈(측 1) 팀, 국가대항전이면 풀리그 2 · 결승 8. 굴림 없음.
   * 수비 재생 · 중계 바탕(0x35218)은 수비 구장 +0xc 줄, 정산 결과 배경은 타석 구장 +0x70 · +0xc 로 그린다
   */
  const sceneStadium = nariSceneStadium(
    options.playerSide === PLAYER_SIDE_FIRST_BAT ? options.opponentTeamId : options.ourTeamId,
    options.nationalCupStage ?? null,
  )
  const grassPalette = sceneFieldPaletteOf(sceneStadium)
  // 타석 바닥 · 수비 바탕을 미리 칠한다 — 원본은 구장 객체 적재 때 팔레트를 갈아 끼운다
  useWarmFieldBackgrounds(grassPalette)

  /**
   * **경기 중 기록 달성 알림 0x4e35c** — 프레임 0x52c50 이 상태 0x17(수비 인플레이)만 빼고 늘 그리므로 내가 던지는 화면에도 뜬다.
   * - 칸 채우기 0x4e600 은 공이 끝날 때(0x12 끝 · 0x17 끝) — 진행기가 그때마다 새로 세우는 칸(마지막 판정 · 마지막 수비 플레이 ·
   *   붙든 타구가 풀림)이 바뀌면 공 끝으로 본다. 견제 판도 0x17 이라 같은 자리다.
   * - 모드 3 의 우리 공격은 늘 자동진행(0x21, 0xc1eac) — 웹 진행기는 내 공 하나 뒤 우리 공격 반 이닝까지 한 걸음에 돌린다.
   *   내 공 몫은 수비 계열(0xa77f0 방향 게이트 — 사람 수비)이 앞에 오고 동료 타석 몫(공격 계열)이 뒤에 온다 → 앞의 수비 계열만
   *   이번 공 끝에 넣고 나머지는 다음 공 끝까지 줄에 둔다. 경기 끝 0xa7de8 몫(28~31·37~39)은 0x19 에서 쌓여 안 뜬다.
   * - 화면이 서기 전에 진행기가 첫 사람 타석까지 미리 돌린 자동 타석(선공 1회초 · 구원 등판 앞) 몫도 줄에 넣어 첫 공 끝에 띄운다.
   * - 강판 뒤(시뮬 +0 = `simpleEngineRunning`)에 0x4e600 이 불리면 줄을 버린다. 팝업(경기 중 메뉴 · 조작방법 · "그만
   *   던지시겠습니까?" 질문 창)이 떠 있으면 [0x140005c]+9 — 폭·시간·틱이 멈춘다.
   */
  const pitchEndSerial = pitchEnd.serial
  // 0x11 끝 · 0x13 · 공 도착 판의 0x12 틱 0 을 그리는 동안은 아직 0x17 이 아니다 — 알림을 그린다
  const isInPlayShown =
    (progress.pendingDefensePlay !== null && !isHitSceneShowing) ||
    (progress.pendingRunnerPlay != null && !isArrivalHolding) ||
    isReplaying
  const recordAlert = useRecordAlert(progress.recordIds, {
    isDrawing: !isInPlayShown,
    isFrozen: isPopupOpen || asksGiveUp,
    isSettled: progress.game.isFinished,
    // 상태 틱 [+0x2c] 의 0 점 — 화면 갈래(인트로 · 판 · 벤치 클리어링 · 0xd/0xe 대기 · 구질 0xf/코스 0x10/게이지 0x11 단계)가 바뀐 틱과,
    // 원본 상태 경계(사람 투구 장면이 적는 0x11 · 0x12 · 그 끝, 확인 대기가 적는 0xd · 0xe — `sceneStateEntries`) 가운데 늦은 쪽.
    // 공을 놓은 틱(0x11 틱 10)은 상태가 안 바뀐다 — 웹은 그때 입력 단계를 '구질' 로 되돌리지만 0x11 · 0x12 가 끝날 때까지는
    // '게이지' 갈래로 둔다(`isPitchFlightShown`)
    sceneStateKey: !isIntroDone
      ? 'intro'
      : isHalfInningBoardOpen
        ? `board-${board?.serial ?? 0}`
        : isBenchClearing
          ? 'benchClearing'
          : summary !== null
            ? isEndBoardClosed ? 'settlement' : 'endBoard'
            : isAwaitingConfirm
              ? `confirm-${pitchEndSerial}`
              : isPitchFlightShown
                ? '게이지'
                : phase,
    pitchEnd: {
      serial: pitchEndSerial,
      humanCountOf: (added) =>
        leadingRecordCountOf(
          added,
          (id) => !isGameEndRecord(id) && passesRecordTeamGate(id, { offenseIsHuman: false, defenseIsHuman: true }),
        ),
    },
    isPitcherRemoved: progress.simpleEngineRunning,
    queuesInitialRecords: true,
  })
  /** 경기 장면 위에 알림을 얹는다 — 화면과 형제 자리(`position: relative` 판)에 기둥으로 */
  const withRecordAlert = (screen: ReactNode) => (
    <div className={styles.frame}>
      {screen}
      <RecordAlertScreenOverlay frame={recordAlert} />
    </div>
  )
  /**
   * 내가 던진 공이 인플레이로 갔으면 **수비 화면을 먼저 보여 준다** (원본 상태 0x17).
   * 진행 중인 타구가 있으면 여기서 **실시간으로 한 틱씩** 돌린다 — 원본도 공이 멈출 때까지
   * 같은 루프를 돌며 매 갱신 눌린 키를 읽는다 (R10 · I 문서).
   *
   * ⭐ 투수편은 **사람이 수비**다 — 조작 표 0절이 "공격이면 0x5331c 주루 / 수비면 0x533c8 송구"
   * 라고 가른다. 이 칸이 차는 자리는 `startPitch` 뿐이고 그 앞에 `isPitchTurn`(내 투수가 마운드에
   * 있는 수비 반 이닝)이 있으므로, 여기 오는 타구는 **언제나** 내가 수비하는 타구다.
   * 우리 팀 공격 이닝은 아홉 칸 모두 간이 엔진이 돌려 수비 화면 자체가 뜨지 않는다.
   *
   * 다 돌면 `onDone` 이 그 결과를 경기 상태에 먹인다 — **주자 처리는 그때 처음 정해진다.**
   */
  /**
   * 경기 시작 인트로 — 적재(상태 8) 끝에서 모드 1~4 만 0xc 로 온다. 54틱 또는 OK 뒤 1회초 판(0x18)이나 첫 타석.
   * 진행기는 경기를 세울 때 이미 첫 사람 타석까지(등판이 없는 날은 경기 끝까지) 밀어 두었지만 인트로는 난수를 안 쓰므로
   * 차례는 같다. 등판 없이 끝난 경기도 원본은 인트로 → 0x18 → 0x21(자동) → 결과 판 순서로 지나므로 인트로부터 보인다.
   */
  if (!isIntroDone) {
    const side0Team = options.playerSide === 0 ? options.ourTeamId : options.opponentTeamId
    const side1Team = options.playerSide === 0 ? options.opponentTeamId : options.ourTeamId
    return (
      <GameIntro
        // 모드 3 은 홈(측 1) 팀 이름 + "스타디움" (0x418b6 의 0xb6bdc(st, 1))
        stadiumNameFrame={introStadiumNameFrameOf(PITCHER_CAREER_MODE, null, side1Team)}
        scoreboardSides={scoreboardSides}
        // 배경 고르기 0x40ff0 → 모드 3 은 0x78578 — 경기 장면의 타석 구장(0x39fdc 모드 3) 그대로
        backdrop={{
          skyRow: stadiumSkyRowOf({ mode: PITCHER_CAREER_MODE, dayCounter: options.dayCounter }) ?? 0,
          skyColumn: 0,
          stadium: sceneStadium.stadium,
          fieldPalette: grassPalette,
          ourTeamId: side0Team,
          opponentTeamId: side1Team,
          gameMode: PITCHER_CAREER_MODE,
          // 구장 +0x60 — 인트로 진입 0x3b084 가 3b108 에서 측 0 의 1번 타자 손을 쓴다(0 우타면 거울 길)
          side: pitcherIntroBatterHandOf(options),
        }}
        // 라이벌전 띠 0x3b80c — 적재 상태 8 의 0xb8f68(두 팀) (표 0xd8a90 의 짝)
        isRivalry={isRivalryMatch(side0Team, side1Team)}
        onDone={() => setIntroDone(true)}
      />
    )
  }

  if (progress.pendingDefensePlay !== null && !isHitSceneShowing) {
    return (
      <DefensePlayback
        input={progress.pendingDefensePlay}
        side="수비"
        grassPalette={grassPalette}
        // 수비 장면 득점 점수판 0x41a64 — 점수판 틀 두 측 · 플레이 시작 점수 · 공격 측 st[9]
        runScoreBoard={runScoreBoardSourceOf(progress.game, scoreboardSides)}
        sceneMemory={defenseSceneRef}
        // 그림 0x43278 이 올린 실책 +0x2e — 판 끝 정산보다 먼저 얹는다
        onFieldingErrors={actions.recordFieldingErrors}
        onDone={actions.finishDefensePlay}
      />
    )
  }
  // 내 수비의 주자 판(도루 · 폭투 · 견제) — 송구 키(+0x160)로 던지므로 실시간으로 한 틱씩 돌린다 (`liveRunnerPlay`)
  if (progress.pendingRunnerPlay != null && !isArrivalHolding) {
    return (
      <DefensePlayback
        runnerPlay={progress.pendingRunnerPlay}
        grassPalette={grassPalette}
        runScoreBoard={runScoreBoardSourceOf(progress.game, scoreboardSides)}
        onFieldingErrors={actions.recordFieldingErrors}
        onDone={actions.finishRunnerPlay}
      />
    )
  }
  // 홈런 비행처럼 조작할 것이 없는 장면만 예전대로 재생 갈래로 간다
  if (isReplaying) {
    return (
      <DefensePlayback
        ticks={play.ticks}
        onDone={finishPlayback}
        onFieldingErrors={actions.recordFieldingErrors}
        freePassPlay={isWalkPlayResult(play)}
        grassPalette={grassPalette}
      />
    )
  }
  // 자동진행 중계(0x21) — 굴려 둔 틱을 매 틱 한 칸씩 (모드 3: 키 · 속도 · 배경음 없음)
  if (isRelaying && relay !== null) {
    return withRecordAlert(
      <AutoPlayRelayReplay
        key={relay.serial}
        steps={pitcherAutoRelayStepsOf(relay.ticks, pitcherName ?? null)}
        sideTeams={
          options.playerSide === PLAYER_SIDE_FIRST_BAT
            ? [options.ourTeamId, options.opponentTeamId]
            : [options.opponentTeamId, options.ourTeamId]
        }
        humanSide={options.playerSide === PLAYER_SIDE_FIRST_BAT ? 0 : 1}
        grassPalette={grassPalette}
        onDone={finishRelay}
      />,
    )
  }

  // 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다. 진입 굴림 45 번은 진행기가 이미 썼다
  if (progress.pendingBenchClearing !== null) {
    return withRecordAlert(
      <BenchClearingScene
        // 그리기 0x43228 — 진입 굴림 45 번으로 선 18명. 타자 손은 사구를 맞은 상대 타자(타석 소개 판과 같은 값)
        field={benchClearingFieldOf({
          entryRolls: progress.pendingBenchClearing.entryRolls,
          half: progress.game.half,
          playerSide: options.playerSide,
          ourTeamId: options.ourTeamId,
          opponentTeamId: options.opponentTeamId,
          batterHand: pitcherMatchupCardsOf(progress, pitcherName).batterHand,
          bases: progress.game.bases,
          grassPalette,
          // 마선수 그림 0x79b48 — 수비 줄은 내 팀(내가 맞혔다), 공격 줄은 상대 팀
          defenseAces: pitcherFieldAcesOf(progress, options, fieldLineups, true),
          // 수비 줄 +0xec — 이 장면에서 마지막으로 적힌 값(1회초 판 · 내 수비 판 시작)
          defenseSeats: walkerSeats.benchDefense,
          offenseAces: benchOffense,
        })}
        // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
        random={random}
        onDone={actions.finishBenchClearing}
      />,
    )
  }

  /**
   * 공수 교대 판 — 진행기가 판을 세울 때 0x3fac4 의 굴림 36 개를 이미 썼다. 징글 13 은 판의 틱 2 (0x4f7ac).
   * 모드 3 에서는 1회초 판만 선다 (진행기 `withHalfInningBoard` 머리말).
   */
  if (isHalfInningBoardOpen && board !== null) {
    const isOurDefenseBoard = (board.half === '초' ? 0 : 1) !== options.playerSide
    return withRecordAlert(
      <HalfInningBoard
        key={board.serial}
        inning={board.inning}
        half={board.half}
        onTick={(tick) => {
          if (tick === HALF_INNING_JINGLE_TICK) audio.play(HALF_INNING_SOUND)
        }}
        scoreboardSides={scoreboardSides}
        // 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER")
        cards={pitcherHalfInningCardsOf(progress, pitcherName, board.half)}
        // 운동장 전경 0x4fb8c — 투수편 판은 경기 첫 판(1회초 — 인트로 0xc 바로 뒤)뿐이라 장면이 수비 줄 · 카메라를 아직 안 옮겼다
        // (`carry` 없음 = 0x3fac4 의 자리 합 0 갈래, `lib/fieldCarry`)
        field={halfInningFieldOf({
          rolls: board.fielderRolls,
          half: board.half,
          carry: null,
          playerSide: options.playerSide,
          ourTeamId: options.ourTeamId,
          opponentTeamId: options.opponentTeamId,
          grassPalette,
          // 이름표 — 칸 0 은 내 투수, 1~8 은 0x40008: 수비 팀(내 팀) 레코드 타자 배열 차례에서 자리 니블이 칸 + 1 인 첫 선수
          fielderNames: fielderNamesByPosition(pitcherName ?? null, isOurDefenseBoard ? fieldLineups?.ours ?? null : fieldLineups?.opponent ?? null),
          // 마선수 그림 0x79b48 — 수비 줄 · 공격 줄 팀 각각 (0x3fac4 가 +0xec · 두 그림을 싣는다)
          defenseAces: pitcherFieldAcesOf(progress, options, fieldLineups, isOurDefenseBoard),
          offenseAces: pitcherFieldAcesOf(progress, options, fieldLineups, !isOurDefenseBoard),
          seats: walkerSeats.boardBefore,
        })}
        onConfirm={() => setClosedBoardSerial(board.serial)}
      />,
    )
  }

  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        onChange={onSettingsChange}
        onResetCareer={() => {}}
        onBack={() => {
          // [설정]에서 CLR(0x3cb0e)도 하위 0 · 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로, 커서는 그대로
          setOverlay(null)
          menu.reopen()
        }}
      />
    )
  }

  // 경기 끝 결과 판(상태 0x18 경기 끝 가지) — OK 뒤에 정산(0x19) 자리인 아래 요약 화면으로 간다
  if (summary !== null && !isEndBoardClosed) {
    const names = pitchersOfRecordOf(progress, pitcherName ?? null)
    // 측 0(선공) 점수가 왼쪽 — 사람 팀은 `playerSide` 측에 앉는다
    const ourSide = progress.game.playerSide
    return withRecordAlert(
      <GameEndBoard
        side0Score={ourSide === 0 ? progress.game.ourScore : progress.game.opponentScore}
        side1Score={ourSide === 1 ? progress.game.ourScore : progress.game.opponentScore}
        names={[names.win, names.loss, names.save]}
        scoreboardSides={scoreboardSides}
        // 503d8 — 이닝별 점수판 0x41c18 (득점 0xb6a9c 가 쌓은 칸)
        lineScore={endBoardLineScoreOf(
          progress.game,
          ourSide === 0
            ? [progress.options.ourTeamId, progress.options.opponentTeamId]
            : [progress.options.opponentTeamId, progress.options.ourTeamId],
        )}
        onConfirm={() => {
          setEndBoardClosed(true)
          actions.enterSettlement()
        }}
      />,
    )
  }

  if (summary !== null) {
    // 정산 그리기 0x4a384 — 모드 3 은 5·6 이 아니라 팀경기와 같은 갈래 0x4a948(점수판 틀 · 점수 · 기본 화면/기록 판)이다.
    // 이겼나 = 0x4a350(0xb6c21(경기, 0xb6a0d) == 0 — 앞선 측이 사람 팀). 원본 경기는 동점으로 안 끝난다(0xb68fc)
    const isHumanWin = summary.result === '승'
    const ourSide = progress.game.playerSide
    // [+0x17f4] — 진입 0x4ea0c 4ebaa~4ec7c 가 기록 달성 횟수로 센 이번 경기 G (투수편 세션 `finishGame` 과 같은 식)
    const earned = recordGamePointsOf(summary.recordIds)
    return withRecordAlert(
      <RawScreen>
        {/*
          정산 그리기 0x4a384 — 구름 0x78448 과 배경 고르기 0x40ff0(장면, +0x17e2)을 먼저 그린다 (선수·공·HUD 없음, 모드를 안 가린다).
          +0x17e2 는 갱신 0x4b100 이 사람 팀이 이긴 판만 틱마다 3 씩 150 까지 올려 구장이 가라앉는다 (`settlementBackdropOffsetAt`).
          모드 3 은 시즌 홈·대전이 아니라 0x78578 갈래다 — 팀경기와 같은 `BattingStage` 결과 배경을 쓴다(시즌 구장 없음).
          감독 평가·변화 글은 경기 장면 밖 나리 상태 116(진입 0x1278c)의 몫이다 — 부르는 쪽(투수편 세션)이 띄운다
        */}
        {/* 결과 배경 — 타석 캔버스는 좌우 −10px 를 두므로 10px 밀어 원본 (0, 0) 에 맞춘다(`GameResultScreen.css` 의 backdrop) */}
        <div className={styles.settlementBackdrop}>
          <BattingStage
            // 결과 배경은 선수·공을 안 그려 능력치를 읽지 않는다 — 꼴을 채우는 기본값
            batterAbility={STARTING_ABILITY}
            pitcherAbility={DEFAULT_PITCHER_ABILITY}
            swingMode="일반"
            gameMode={PITCHER_CAREER_MODE}
            isEagleEyeEnabled={false}
            hud={null}
            acePitcher={null}
            isPaused
            isResultBackdrop
            resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isHumanWin)}
            // 하늘 줄 = 구장 +0x10 — 0x783b0 모드 3: 나리 저장 +0xb2(리그 날짜 g) mod 6, 굴림 없음. 배경 난수는 꼴만 채운다
            skyRow={stadiumSkyRowOf({ mode: PITCHER_CAREER_MODE, dayCounter: options.dayCounter }) ?? 0}
            // 결과 배경 0x40ff0 → 0x78578 — 경기 장면의 타석 구장 그대로(펜스 +0x70 · 바닥 줄 +0xc)
            stadium={sceneStadium.stadium}
            fieldPalette={grassPalette}
            random={backdropRandom}
            // 정산 효과 0x4ea0c(밤 승리 불꽃 · 패배 비)와 결과 그림 0x4a384 의 효과 · 파티클 틱은 경기 난수로 돈다
            settlement={{
              isWin: isHumanWin,
              side0Score: ourSide === 0 ? summary.ourScore : summary.opponentScore,
              side1Score: ourSide === 1 ? summary.ourScore : summary.opponentScore,
              inning: progress.game.inning,
              random,
              layers: settlementLayers,
            }}
            onPitchResolved={() => {}}
          />
        </div>
        <SettlementBoard
          mode={PITCHER_CAREER_MODE}
          isWin={isHumanWin}
          // 0xb69b0(st, 0/1) — 왼쪽이 측 0
          side0Score={ourSide === 0 ? summary.ourScore : summary.opponentScore}
          side1Score={ourSide === 1 ? summary.ourScore : summary.opponentScore}
          scoreboardSides={scoreboardSides}
          recordIds={summary.recordIds}
          gamePoints={earned}
          {...(gamePoint === undefined
            ? {}
            : { heldGamePoints: Math.min(MAXIMUM_GAME_POINT, Math.max(0, gamePoint + earned)) })}
          onExit={() => onFinish(summary)}
          effectLayers={settlementLayers}
        />
        {/* 원본에 없는 웹 [확인] 소프트키 대신 — 판 키 0x407f0 로 OK 를 보내는 투명 누름 칸 */}
        <SettlementPressArea />
      </RawScreen>,
    )
  }

  /** 장면 배치 — 타자 손(0xb63c0). 구질 목록 누름 칸이 투수 앵커 0xcfb18[이 값] 둘레에 선다 (`PitcherSideStage` 와 같은 값) */
  const stageBatter = stageBatterOf(progress)
  const stageSide = stageBatter.batterSide ?? (stageBatter.batterForm & 1)
  /** '*' 소프트키 — 공용 키 0x498d4 가 받는 동안(경기 장면 · 조작방법 뷰어가 아닐 때) */
  const acceptsMenuKey = !isSceneShowing && overlay !== '조작방법' && !asksGiveUp

  return (
    <div className={styles.frame}>
      {/*
        원본은 240×320 경기 장면 한 장이다 — 웹 제목줄 · 배지 · 소프트키 막대 · 아웃/루/점수 글자 · B/S 램프 · 체력 막대는 없다.
        HUD 는 장면의 0x4c4bc(0x373d0), 체력은 투수 위 지친 표시(0x38f68)가 그린다. 마우스 길은 장면 그림 자리의 투명한 누름 칸이다
      */}
      <RawScreen>
      <PitcherSideStage
        // 0xd 진입마다 투수 그림 객체를 상태 0 으로 (48ee4 — '#' 교체 창에서 곧장 선 0xe 는 0xd 가 없다)
        sceneDEntryMark={sceneConfirm.sceneDEntryMark}
        pitch={progress.lastPitch}
        resolution={progress.lastResolution}
        resultTicks={heldResultTicks}
        // 0x3dfac 낫아웃 갈래(3e0aa)가 판정 칸을 지웠으면 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다
        isJudgementCleared={progress.lastPitchJudgementCleared === true}
        cpuSwing={progress.lastCpuSwing ?? null}
        // CPU 타자가 맞힌 공 — 판정 틀까지 0x11, 이어 0x13 을 그리고 0x17 이 선 틀에 수비 판으로 넘긴다
        hitScene={pitcherHitScene.hitScene}
        onHitSceneEnd={pitcherHitScene.end}
        hud={{
          inning: progress.game.inning,
          half: progress.game.half,
          ourScore: progress.game.ourScore,
          opponentScore: progress.game.opponentScore,
          balls: progress.atBat.balls,
          strikes: progress.atBat.strikes,
          outs: progress.game.outs,
          bases: progress.game.bases,
          ourLogoUrl: smallLogoUrlOf(options.ourTeamId),
          opponentLogoUrl: smallLogoUrlOf(options.opponentTeamId),
          ourTeamId: options.ourTeamId,
          opponentTeamId: options.opponentTeamId,
          playerSide: progress.game.playerSide,
          // st[0x15 + i] — CPU 도루 출발 주자는 0xf 진입 전까지(공이 날거나 0x12 인 동안 포함) 루에 안 그린다
          hiddenRunnerBases,
        }}
        {...stageBatterOf(progress)}
        pitcherForm={options.repertoire.form}
        // 내 투수 손 0xb63c0 = 폼 & 1 (마투수 아님)
        pitcherHand={pitcherHandOf(options.repertoire.form, false)}
        // 내 투수가 마운드에 있을 때만 — 강판 뒤 마운드는 다른 투수다
        {...(pitcherEquipmentLevels === undefined || !progress.onMound
          ? {}
          : { pitcherEquipment: pitcherEquipmentOf(pitcherEquipmentLevels) })}
        // 마운드 바탕 벌 = 피부 × 15 + 내 팀 (482c0~482fc → 0x793b0 의 794c2).
        // ⚠️ 강판 뒤 마운드 투수의 피부는 명단 레코드를 아직 안 이어 0 으로 둔다(팀 색은 그대로 내 팀)
        pitcherSkinIndex={progress.onMound ? pitcherSkinIndex : 0}
        pitcherTeamIndex={options.ourTeamId}
        warmCast={stageWarmCast}
        // 타석 구장 +0x70 · 바닥 줄 +0xc — 셋업 0x39fdc 모드 3 갈래 (정산 배경과 같은 구장)
        stadium={sceneStadium.stadium}
        fieldPalette={grassPalette}
        // 하늘 줄 = 구장 +0x10 — 0x783b0 모드 3: 리그 날짜 g mod 6
        skyRow={stadiumSkyRowOf({ mode: PITCHER_CAREER_MODE, dayCounter: options.dayCounter }) ?? 0}
        gameMode={PITCHER_CAREER_MODE}
        {...(settings === undefined ? {} : { isScoreboardOn: settings.isScoreboardOn })}
        isPaused={isAwaitingConfirm}
        isFrozen={isPitchInputPaused}
        inputOverlayRef={inputOverlayRef}
        // 0x38f68 — 마운드 투수 체력% 로 지친 표시(player_effect 애니 9 · 10). 강판 뒤 마운드는 다른 투수라 싣지 않는다
        pitcherStaminaPercent={progress.onMound ? staminaPercentOf(progress.stamina) : null}
        // 실투 "!" 0x38d1c 38ee0 — 놓기 0x4dc78 4deae (강판 뒤 마운드 공은 이 화면이 그리지 않는다)
        isMistakePitch={progress.lastPitchIsMistake === true}
        // "#TIME" 0x4c92e — 0x38984 는 모드 3 을 안 막는다('#' 가 강판 물음을 연다). n = 수비팀(우리)[+0x33] 벤치 투수 수
        timeKeyCount={ourBenchPitcherCountOf(progress)}
        // 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 공격 측(st[9]) = 상대(CPU) 측
        skillPanel={{
          entryKey: progress.sceneConfirm ?? null,
          attackSide: progress.game.playerSide === 0 ? 1 : 0,
          scene: skillPanelSceneRef,
          ...pitcherSceneSkillPanelOf(progress),
        }}
      >
        {/* 돌발 띠 0x8e858 (0x4c4bc 4c522, 사람 수비 → 공 7) — 0xf 구질 목록이면 뒤의 빛 지도 4c5a6 이 같이 어둡게 한다 */}
        <BurstBand
          row={burstBandRow}
          role={burstBandRoleOf(progress.game.half, progress.game.playerSide)}
          isDimmed={canPitch && !isAwaitingConfirm && !isPitchSceneBusy && phase === '구질'}
        />
        {/* 일시정지 창 아래에도 남는다 — 0x52efe 가 장면 그리기를 건너뛰어 마지막 그림(소개 판 포함)이 그대로다 */}
        {isAwaitingConfirm && sceneConfirm.isInConfirmState && (
          <SceneMatchupCards {...pitcherMatchupCardsOf(progress, pitcherName, matchupRecords)} />
        )}
        {substitution.isShown && (
          <SubstitutionSceneOverlay key={substitution.serial} aceSlot={substitution.aceSlot} onDone={substitution.finish} />
        )}
      </PitcherSideStage>

        {/* 0xe — OK 하나를 받는다 (0x532b0). 원본 화면에 글자는 없다 — 마우스 길로 판 전체를 누름 칸으로 */}
        {isAwaitingConfirm && !isPopupOpen && !asksGiveUp && (
          <PressLayer testId="확인 누름 칸">
            <PressArea
              label="확인"
              isDisabled={!sceneConfirm.acceptsConfirm}
              onPress={sceneConfirm.confirm}
            />
          </PressLayer>
        )}

        {/* 0xf 구질 — 그림은 장면(0x4c4bc 4c528~)이 그리고 여기는 키 · 틱 · 누름 칸만 */}
        {canPitch && !isAwaitingConfirm && !isPitchSceneBusy && phase === '구질' && (
          <div hidden={isPitchInputPaused}>
            <PitchSlotPicker
              choices={slotChoices(progress.magicRemaining, pitchSlotsFor(progress))}
              isPaused={isPitchInputPaused}
              stageSide={stageSide}
              overlay={{
                ref: inputOverlayRef,
                typeNumbers: slotTypeNumbersOf(pitchSlotsFor(progress)),
                magicRemaining: progress.magicRemaining,
              }}
              onDecide={(chosen) => {
                const found = pitchSlotsFor(progress).find((candidate) => candidate.slot === chosen)
                if (found === undefined || !canSelectSlot(found, progress.magicRemaining)) return
                setSlot(found)
                setPhase('코스')
              }}
            />
          </div>
        )}

        {/* 0x10 조준 — 그림은 장면 0x4d780 */}
        {canPitch && phase === '코스' && (
          <div hidden={isPitchInputPaused}>
            <AimCursor
              side={progress.options.stageSide ?? 1}
              isPaused={isPitchInputPaused}
              overlay={{ ref: inputOverlayRef, typeNumber: slot?.typeNumber ?? 0 }}
              onConfirm={(confirmed) => {
                // OK(0x50e9c)는 늘 0x11 로 간다(0x50ed0) — 게이지를 안 쓰는 공(게이지 끔 · 마구 0x3f500 의 `구질 != 22`)도
                // 0x11 의 틱 10 에 놓는다(0x4e060). 게이지 그림만 0x4d3f8 에서 건너뛴다
                setAim(confirmed)
                setPhase('게이지')
              }}
              // CLR(0x50ee0) — 0xf 로 돌아가 0xf 진입 0x3d954 가 다시 돈다
              onCancel={() => {
                setPhase('구질')
                setSlot(null)
                actions.returnToPitchSelection()
              }}
            />
          </div>
        )}

        {/* 0x11 게이지 — 그림은 장면 0x4d2ac */}
        {canPitch && phase === '게이지' && (
          <div hidden={isPitchInputPaused}>
            <PitchGradeGauge
              isPaused={isPitchInputPaused}
              showsGauge={showsGauge}
              onRelease={(gaugeCell) => throwWith(gaugeCell)}
              {...(aim === null
                ? {}
                : {
                    overlay: {
                      ref: inputOverlayRef,
                      aim,
                      aimSide: progress.options.stageSide ?? 1,
                      gaugeSettingOn: options.gaugeSettingOn === true,
                      gameMode: PITCHER_CAREER_MODE,
                    },
                  })}
            />
          </div>
        )}

        {/*
          소프트키 — 장면이 그리는 "*MENU" · "#TIME" 글자 자리(0x4c8e0 · `softKeyLabels`)의 누름 칸. '*' 는 0x498d4 가 경기 중
          메뉴로(소프트키1 도 '*' 로 읽는다, 498e8), '#' 는 0xe · 0xf 에서 강판 물음(0x4994a → StrGAME[104])
        */}
        {acceptsMenuKey && (
          <PressLayer testId="소프트키 누름 칸" isOnTop>
            <PressArea rect={MENU_PRESS_RECT} label={isMenuOpen ? '닫기' : '메뉴'} onPress={menu.pressStar} />
            {acceptsGiveUpKey && <PressArea rect={TIME_PRESS_RECT} label="# 강판" onPress={pressGiveUp} />}
          </PressLayer>
        )}

        {isMenuOpen && (
          <div className={styles.popupLayer}>
            <InGameMenu
              // 나만의리그 투수편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다
              mode={PITCHER_CAREER_MODE}
              cursor={menu.cursor}
              slidesIn={menu.slidesIn}
              opening={menu.opening}
              bindCloser={menu.bindCloser}
              onCursorChange={menu.setCursor}
              onContinue={menu.close}
              onQuit={onQuit}
              onOpenHelp={() => {
                menu.close()
                setOverlay('조작방법')
              }}
              onOpenSettings={
                settings === undefined || onSettingsChange === undefined
                  ? undefined
                  : () => {
                      menu.close()
                      setOverlay('설정')
                    }
              }
            />
          </div>
        )}

        {/*
          "그만 던지시겠습니까?" — 공용 키 0x498d4 의 '#' 가지 0x4994a: 모드 3([+0x1104] == 3)이면 0x49968 에서
          `0xbbef8(0x702b5(StrGAME, 104), 종류 2(예/아니오), 팝업 id 0x1b, 1)` 로 시스템 예/아니오 팝업을 띄운다.
          답은 프레임 0x52c50 의 52c62~52c90 이 읽는다 — 팝업 id 0x1b 이고 답 칸 [창+0x21c] == 0(예)이면 0xc1b48(스스로 강판).
          아니오는 아무 일 없이 닫힌다. 처음 커서는 첫 칸 "예"(0x749d5 없음)
        */}
        {!isPopupOpen && asksGiveUp && (
          <MessageBox
            text={GIVE_UP_CONFIRM_TEXT}
            buttons={['예', '아니오']}
            onAnswer={(index) => {
              setAsksGiveUp(false)
              if (index === 0) actions.giveUp()
            }}
          />
        )}

        {visibleBurstLines !== null && (
          <BurstMissionWindow
            lines={visibleBurstLines}
            judgement={resolution?.judgement ?? null}
            row={resolution?.row ?? null}
            // 0xb63c0(지금 타자) — 타석 장면이 그리는 타자 손
            isBatterLeftHanded={stageSide !== 0}
            onClose={
              resolution !== null ? actions.closeBurst : () => setShownProposal(proposal)
            }
          />
        )}

        {/* 0x16 → 0xd → 0xe 진입 0x50674 의 감독 강판 — 연출 뒤다 */}
        {progress.managerHookText !== null && !substitution.isShown && !isHookPassing && (
          <ManagerHookWindow
            userEventIndex={progress.managerHookText}
            onConfirm={actions.confirmManagerHook}
          />
        )}

        {/* 경기 장면 프레임 0x52c50 의 덧그림 0x4e35c (0x53066) — 그리기 표 다음. 판 안이라 기둥 없이 */}
        <RecordAlertStageOverlay frame={recordAlert} />
      </RawScreen>

      {overlay === '조작방법' && (
        <HelpScreen
          onBack={() => {
            // 뷰어를 닫으면(0x3ca36: 0x637d0 ≠ 0) 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로,
            // 메뉴 객체는 안 건드려 커서가 그대로다
            setOverlay(null)
            menu.reopen()
          }}
        />
      )}
    </div>
  )
}

/** StrGAME[104] (`base/extracted/StrGAME.json` 원문 그대로) — '#' 가지 0x49968 이 0x702b5(StrGAME, 0x68) 로 꺼낸다 */
const GIVE_UP_CONFIRM_TEXT = '!C그만 던지시겠습니까?'

/** 장면 판 전체 — 0xe 의 OK 누름 칸 */
/** 작은 팀 로고 (team_logo_ini) — 팀 경기 HUD 와 같은 그림 */
const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

/**
 * 타석에 선 상대 타자의 그림 재료 — 폼 `rec[0xb] >> 4`(몸통 · 자세 · 손) · 피부 `(rec[0xb] >> 2) & 3` · 팀(헬멧 · 몸통 벌).
 * 마타자는 XlsACE_BAT_DATA 레코드 +0xb(`aceBatterProfileOf`)의 폼 · 피부, 손은 표 0xd88b0.
 * 마타자는 순번 0xb63a0 을 타석 교대 0x47dd6 이 몸통 적재 0x78ab0 에 넘겨 `ace/batter_*` 한 장을 싣는다(`aceBatterOrder`).
 */
/** 장면 배치의 타자 손(0xb63c0, 장면 +0x17e1) — `PitcherSideStage` 가 그리는 손과 같은 값 */
function stageBatterHandOf(progress: Parameters<typeof opponentBatterOf>[0]): number {
  const batter = stageBatterOf(progress)
  return batter.batterSide ?? batter.batterForm & 1
}

/**
 * **나리 투수편 타석의 곧 설 그림** (`StageWarmCast`) — 상대 팀 붙박이 타자 명단 전부(덮개 니블이 있으면 그것 — `opponentBatterOf` 와
 * 같은 칸)와 마운드의 내 투수(피부 × 15 + 내 팀 · 장비 0x79790). 마타자는 구운 그림이라 칠할 것이 없다
 */
function pitcherGameWarmCastOf(
  progress: Parameters<typeof opponentBatterOf>[0],
  equipmentLevels: PitcherAbility | undefined,
  skinIndex: number,
): StageWarmCast {
  const teamIndex = progress.options.opponentTeamId
  const batters = teamBatters(teamIndex).map((player, slot) => {
    const profile = player.profile
    const nibbles = progress.options.opponentEquipment?.batters?.[slot] ?? player.equipment
    return {
      bodyType: bodyTypeOf(profile >> 4),
      skinIndex: (profile >> 2) & 3,
      teamIndex,
      equipment: batterEquipmentOf({ hit: nibbles[0] ?? 0, power: nibbles[1] ?? 0, run: nibbles[3] ?? 0 }),
    }
  })
  const pitcher = {
    skinIndex: progress.onMound ? skinIndex : 0,
    teamIndex: progress.options.ourTeamId,
    equipment: equipmentLevels === undefined || !progress.onMound ? NO_PITCHER_EQUIPMENT : pitcherEquipmentOf(equipmentLevels),
  }
  return stageWarmCastOf(batters, [pitcher])
}

function stageBatterOf(progress: Parameters<typeof opponentBatterOf>[0]): {
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  readonly batterSide?: number
  readonly aceBatterOrder?: number
  readonly batterEquipment?: BatterEquipment
} {
  const batter = opponentBatterOf(progress)
  const teamIndex = progress.options.opponentTeamId
  if (batter.aceIndex !== undefined) {
    const profile = aceBatterProfileOf(batter.aceIndex)
    return {
      batterForm: profile >> 4,
      batterSkinIndex: (profile >> 2) & 3,
      batterTeamIndex: teamIndex,
      batterSide: batterHandOf(profile, batter.aceIndex),
      aceBatterOrder: batter.aceIndex,
    }
  }
  const profile = batter.profile ?? 0
  const nibbles = batter.equipment
  return {
    batterForm: profile >> 4,
    batterSkinIndex: (profile >> 2) & 3,
    batterTeamIndex: teamIndex,
    // 타석 교대 0x47cc8 47e80~47eb6 — 마타자가 아니면 레코드 +0x19 · +0x1a 니블 − 1 로 장비 겹(0x78fd8). 부위 2(밴드)는 그림이 없다
    ...(nibbles === undefined
      ? {}
      : { batterEquipment: batterEquipmentOf({ hit: nibbles[0] ?? 0, power: nibbles[1] ?? 0, run: nibbles[3] ?? 0 }) }),
  }
}

/** 칸 0..5 의 구질 번호 (경기 +0xfac + 4·칸) — 장면 위 구질 목록 재료 */
function slotTypeNumbersOf(slots: readonly PitchSlot[]): number[] {
  const numbers = [0, 0, 0, 0, 0, 0]
  for (const slot of slots) if (slot.slot >= 0 && slot.slot < numbers.length) numbers[slot.slot] = slot.typeNumber
  return numbers
}

/** 칸 5 는 '0' 키 자리다 (0x534d8 의 메시지 7). 빈 칸(구질 0)은 그리지 않는다 */
function slotChoices(magicRemaining: number, slots: readonly PitchSlot[]): PitchSlotChoice[] {
  return slots
    .filter((slot) => slot.typeNumber !== 0)
    .map((slot) => ({
      slot: slot.slot,
      name: slot.name,
      ...(slot.isMagic
        ? { detail: `마구 · 남은 ${magicRemaining}회${magicRemaining === 0 ? ' (못 던짐)' : ''}` }
        : {}),
      isBlocked: !canSelectSlot(slot, magicRemaining),
    }))
}

/**
 * 투수편 벤치 클리어링 공격 줄(상대 팀) 재료 — 3a97e: 사구를 맞은 지금 타자가 마타자면 그 레코드(자리 니블은 대타 뒤 레코드 줄의 값)를
 * 타자 칸과 맞바꾼다. 3aa1a: 루 위 마선수 주자(+0x9c)는 수비 판 재료 `opponentRunnerAcesOf` 그대로
 */
function pitcherBenchOffenseOf(
  progress: PitcherGameProgress,
  options: PitcherGameOptions,
  fieldLineups: PitcherFieldLineups | undefined,
): BenchClearingOffenseAces | null {
  const offense = pitcherFieldAcesOf(progress, options, fieldLineups, false)
  if (offense === null) return null
  const batterAce = opponentBatterOf(progress).aceIndex
  const aceRow = batterAce === undefined ? undefined : fieldLineups?.opponent.find((row) => row.ace === batterAce)
  return {
    ...offense,
    batter: batterAce === undefined ? null : { position: aceRow?.position ?? 0, ace: batterAce },
    aceRunnerBases: aceRunnerBasesOf(opponentRunnerAcesOf(progress), progress.game.bases),
  }
}

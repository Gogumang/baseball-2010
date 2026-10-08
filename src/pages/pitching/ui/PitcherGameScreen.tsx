import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Hint, MenuList, Panel, PixelScreen } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import { pitchSlotsFor, pitchersOfRecordOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type {
  PitcherGameOptions,
  PitcherGameSummary,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { pitcherMatchupCardsOf } from '@/pages/pitching/lib/pitcherMatchupCards'
import type { PitcherMatchupRecords } from '@/pages/pitching/lib/pitcherMatchupCards'
import { CourseGrid } from '@/pages/pitching/ui/CourseGrid'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { ManagerHookWindow } from '@/pages/pitching/ui/ManagerHookWindow'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { DEFENSE_SCENE_START, type DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { useSceneScopedRef } from '@/pages/defense/model/useSceneScopedRef'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { TEAMS } from '@/shared/config/original/teams'
import { activeSound } from '@/shared/api/audio/soundPort'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { hasGameIntro } from '@/widgets/game-scene/lib/introSchedule'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { pitcherHalfInningCardsOf } from '@/pages/pitching/lib/pitcherHalfInningCards'
import { runScoreBoardSourceOf } from '@/pages/defense/lib/runScoreBoard'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { usePitchEndSerial, useRecordAlert } from '@/widgets/game-scene/model/useRecordAlert'
import { RecordAlertScreenOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { isGameEndRecord, leadingRecordCountOf } from '@/widgets/game-scene/lib/recordAlert'
import { passesRecordTeamGate, recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { SettlementBoard } from '@/pages/team-game/ui/SettlementBoard'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { MAXIMUM_GAME_POINT, STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'

/**
 * 나만의리그 **투수편**(원본 모드 3) 경기 화면.
 *
 * 원본 경기 장면의 사람 조작 세 단계를 그대로 따른다 (I-controls 0절 · R10 2절):
 *   0xf  구질 고르기 — (2)(4)OK(6)(8) 다섯 자리 + '0' 마구
 *   0x10 코스 고르기 — 방향키
 *   0x11 게이지 — OK 한 번 (환경설정 "투구 게이지" 가 꺼져 있으면 이 단계가 없다)
 * 그리고 0xe·0xf 에서 `#` 를 누르면 "그만 던지시겠습니까?"(StrGAME[104]) 가 뜬다.
 *
 * ⚠️ 원본 코스 커서의 칸 수·좌표는 해독 문서에 없다 — 설명서 <투구 조작> 2단계를 따라 3×3 격자로 둔다
 * (`features/play-pitcher-game/model/pitcherPitch.courseTargetOf` 주석 참조).
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
}

export function PitcherGameScreen({
  options,
  random,
  onFinish,
  onQuit,
  settings,
  onSettingsChange,
  pitcherName,
  matchupRecords,
  gamePoint,
}: PitcherGameScreenProps) {
  const session = usePitcherGame(options, random, settings?.isVibrationOn)
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
  /** 경기 장면 동안 남는 HOMERUN 글자 칸 · 표시 비거리 +0x36 — 수비 판 홈런 연출이 판마다 이어 쓴다 (`defenseHomeRunEffects`) */
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, options)
  const board = progress.halfInningBoard
  const isHalfInningBoardOpen = board !== null && board.serial !== closedBoardSerial && summary === null
  const isBenchClearing = progress.pendingBenchClearing !== null
  /** 공용 키 0x498d4 의 상태 범위(0xd~0x15) 밖 — 인트로 0xc · 판 0x18 · 벤치 클리어링 0x1e */
  const isSceneShowing = !isIntroDone || isHalfInningBoardOpen || isBenchClearing || summary !== null

  const [phase, setPhase] = useState<PitchPhase>('구질')
  const menu = useInGameMenuState()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  /** 일시정지 팝업이 떠 있는가 — 경기 중 메뉴, 또는 그 하위 4 [조작방법] 뷰어 (둘 다 0x741a0 팝업이라 경기 키·갱신이 멈춘다) */
  const isPopupOpen = isMenuOpen || overlay === '조작방법'
  /** 이미 다 보여 준 수비 플레이 — 같은 플레이를 두 번 재생하지 않는다 */
  const [shownPlay, setShownPlay] = useState<DefensePlayResult | null>(null)
  const play = progress.lastDefensePlay
  const finishPlayback = useCallback(() => setShownPlay(play), [play])
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  const [courseCell, setCourseCell] = useState(4)
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
  useEffect(() => {
    if (isSceneShowing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      event.preventDefault()
      menu.toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSceneShowing, menu.toggle, overlay])

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
  const isReplaying = play !== null && play !== shownPlay && play.ticks.length > 0
  /**
   * **상태 0xe — 내가 던지는 타석마다 사람 OK 를 기다린다** (`features/play-game/model/sceneConfirm`, 0x39e14 → 0x532b0 —
   * 0x532b0 은 조작 객체의 공수를 안 본다). 진입에서 감독 강판(0x504cc)이 참이면 0x23 이라 기다리지 않는다.
   * 인트로·교대 판·수비 화면·벤치 클리어링·경기 중 메뉴·조작방법·설정·강판 물음·돌발 결과 창·감독 대사 창이 덮으면 받지 않는다.
   * OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타)은 OK 를 받을 때 진행기가 돌린다 (`confirmScene`).
   */
  const sceneConfirm = useSceneConfirm(
    // 진행기가 OK 를 아직 안 받은 0xe 대기
    progress.sceneConfirmPending === true ? progress.sceneConfirm : null,
    !isSceneShowing &&
      progress.pendingDefensePlay === null &&
      !isReplaying &&
      !isPopupOpen &&
      overlay === null &&
      !asksGiveUp &&
      // 타석이 끝나며 난 돌발 결과 창(0x1d)은 다음 0xd 보다 먼저다 (+0x1b6c)
      resolution === null &&
      progress.managerHookText === null,
    actions.confirmScene,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && canPitch
  /** 돌발 제안 창(0x1b)은 0xe 의 OK 뒤 메시지 1 이 굴려 예약한다(0x50c42) — OK 전에는 안 띄운다. 결과 창은 0xe 앞이다 */
  const visibleBurstLines = resolution === null && isAwaitingConfirm ? null : burstLines
  const acceptsPickoff =
    canPitch &&
    !isAwaitingConfirm &&
    !isReplaying &&
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
      pickoff(event.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsPickoff, pickoff])

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
    progress.pendingDefensePlay === null &&
    progress.managerHookText === null &&
    visibleBurstLines === null &&
    (isAwaitingConfirm ? sceneConfirm.isInConfirmState : phase === '구질')
  useEffect(() => {
    if (!acceptsGiveUpKey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '#') return
      event.preventDefault()
      setAsksGiveUp(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsGiveUpKey])

  const throwWith = (gaugeCell: number) => {
    if (slot === null) return
    actions.throwPitch({ typeNumber: slot.typeNumber, courseCell, gaugeCell })
    setPhase('구질')
    setSlot(null)
  }

  // 점수판 틀 0x41440 의 두 측 — 내 팀 PLAYER · 상대 COM
  const scoreboardSides = humanVsComputerSidesOf(options.playerSide, options.ourTeamId, options.opponentTeamId)

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
  const pitchEndSerial = usePitchEndSerial([
    progress.lastResolution,
    progress.lastDefensePlay,
    progress.pendingDefensePlay === null,
  ])
  const isInPlayShown = progress.pendingDefensePlay !== null || isReplaying
  const recordAlert = useRecordAlert(progress.recordIds, {
    isDrawing: !isInPlayShown,
    isFrozen: isPopupOpen || asksGiveUp,
    isSettled: progress.game.isFinished,
    // ⚠️ 근사: 상태 틱 [+0x2c] 의 경계를 웹 화면 갈래(인트로 · 판 · 벤치 클리어링 · 0xe · 구질/코스/게이지 단계)로 가른다
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
              : `${phase}-${pitchEndSerial}`,
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
        awayName={TEAMS[side0Team]?.name ?? ''}
        homeName={TEAMS[side1Team]?.name ?? ''}
        scoreboardSides={scoreboardSides}
        onDone={() => setIntroDone(true)}
      />
    )
  }

  if (progress.pendingDefensePlay !== null) {
    return (
      <DefensePlayback
        input={progress.pendingDefensePlay}
        side="수비"
        // 수비 장면 득점 점수판 0x41a64 — 점수판 틀 두 측 · 플레이 시작 점수 · 공격 측 st[9]
        runScoreBoard={runScoreBoardSourceOf(progress.game, scoreboardSides)}
        sceneMemory={defenseSceneRef}
        onDone={actions.finishDefensePlay}
      />
    )
  }
  // 홈런 비행처럼 조작할 것이 없는 장면만 예전대로 재생 갈래로 간다
  if (isReplaying) {
    return <DefensePlayback ticks={play.ticks} onDone={finishPlayback} />
  }

  // 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다. 진입 굴림 45 번은 진행기가 이미 썼다
  if (progress.pendingBenchClearing !== null) {
    return withRecordAlert(<BenchClearingScene onDone={actions.finishBenchClearing} />)
  }

  /**
   * 공수 교대 판 — 진행기가 판을 세울 때 0x3fac4 의 굴림 36 개를 이미 썼다. 징글 13 은 판의 틱 2 (0x4f7ac).
   * 모드 3 에서는 1회초 판만 선다 (진행기 `withHalfInningBoard` 머리말).
   */
  if (isHalfInningBoardOpen && board !== null) {
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
        onConfirm={() => setClosedBoardSerial(board.serial)}
      />,
    )
  }

  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        hasSavedCareer={false}
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
      <PixelScreen
        title="경기 결과"
        leftKey={{ label: '확인', onPress: () => onFinish(summary) }}
      >
        {/*
          정산 그리기 0x4a384 — 구름 0x78448 과 배경 고르기 0x40ff0(장면, +0x17e2)을 먼저 그린다 (선수·공·HUD 없음, 모드를 안 가린다).
          +0x17e2 는 갱신 0x4b100 이 사람 팀이 이긴 판만 틱마다 3 씩 150 까지 올려 구장이 가라앉는다 (`settlementBackdropOffsetAt`).
          모드 3 은 시즌 홈·대전이 아니라 0x78578 갈래다 — 팀경기와 같은 `BattingStage` 결과 배경을 쓴다(시즌 구장 없음).
          감독 평가·변화 글은 경기 장면 밖 나리 상태 116(진입 0x1278c)의 몫이다 — 부르는 쪽(투수편 세션)이 띄운다
        */}
        <div className={styles.matchupFrame}>
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
            // ⚠️ 웹 타석 그림이 세울 때 굴리는 하늘 줄 rand(0, 6)(추정 대체)이 경기 난수에 새지 않게 따로 든 난수로 세운다
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
        </div>
      </PixelScreen>,
    )
  }

  return (
    <div className={styles.frame}>
      <PixelScreen
        title={`${progress.game.inning}회${progress.game.half}`}
        badge={`${staminaPercentOf(progress.stamina)}%`}
        leftKey={
          isAwaitingConfirm && !isPopupOpen
            ? // 0xe — OK 를 받는다 (0x532b0). 강판 물음은 '#' 키로 연다 (위 `acceptsGiveUpKey`)
              { label: '확인', onPress: sceneConfirm.confirm, isDisabled: !sceneConfirm.acceptsConfirm }
            : canPitch && !isPopupOpen
              ? { label: '# 강판', onPress: () => setAsksGiveUp(true) }
              : undefined
        }
        rightKey={{
          label: isMenuOpen ? '닫기' : '메뉴',
          onPress: menu.toggle,
        }}
      >
        <div className={styles.hud}>
          <span>
            아웃 {progress.game.outs} · 투구 {progress.pitchCount}
          </span>
          <span className={styles.bases}>
            <span className={progress.game.bases.first ? styles.baseOn : undefined}>1</span>
            <span className={progress.game.bases.second ? styles.baseOn : undefined}>2</span>
            <span className={progress.game.bases.third ? styles.baseOn : undefined}>3</span>
          </span>
          <span className={styles.score}>
            {progress.game.ourScore} : {progress.game.opponentScore}
          </span>
        </div>

        <div className={styles.count}>
          <span>
            B{' '}
            {[0, 1, 2].map((index) => (
              <span key={index} className={styles.lamp} data-on={progress.atBat.balls > index}>
                ●
              </span>
            ))}
          </span>
          <span>
            S{' '}
            {[0, 1].map((index) => (
              <span key={index} className={styles.lamp} data-on={progress.atBat.strikes > index}>
                ●
              </span>
            ))}
          </span>
          <span>상대 {progress.opponentOrderIndex + 1}번</span>
        </div>

        <div className={styles.staminaTrack}>
          <div
            className={styles.staminaFill}
            style={{ width: `${staminaPercentOf(progress.stamina)}%` }}
            data-low={staminaPercentOf(progress.stamina) <= 20}
          />
        </div>

        {isMenuOpen && (
          <InGameMenu
            // 나만의리그 투수편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다
            mode={PITCHER_CAREER_MODE}
            cursor={menu.cursor}
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
        )}

        {!isPopupOpen && asksGiveUp && (
          <>
            {/* StrGAME[104] "그만 던지시겠습니까?" — 모드 3 은 교체 화면 대신 이 물음만 뜬다 */}
            <Panel heading="그만 던지시겠습니까?" />
            <MenuList
              items={[
                { id: '예', label: '예' },
                { id: '아니오', label: '아니오' },
              ]}
              onSelect={(id) => {
                setAsksGiveUp(false)
                if (id === '예') actions.giveUp()
              }}
            />
          </>
        )}

        {/*
          0xe — 구질 고르기(0xf)는 OK 뒤다. 0xd 두 그림 뒤 0x4d9ec 가 투수·타자 소개 판 0x44944 를 그린다(모드 검사 없음).
          내가 던지므로 투수 PLAYER · 타자 COM. ⚠️ 원본은 판 아래 0xd 그리기(타석 장면)가 깔리지만 웹 투구 화면엔 그 캔버스가 없다.
          값은 `pitcherMatchupCardsOf` (내 투수 · 상대 타자).
        */}
        {!isPopupOpen && isAwaitingConfirm && sceneConfirm.isInConfirmState && (
          <div className={styles.matchupFrame}>
            <SceneMatchupCards {...pitcherMatchupCardsOf(progress, pitcherName, matchupRecords)} />
          </div>
        )}
        {!asksGiveUp && !isPopupOpen && canPitch && !isAwaitingConfirm && phase === '구질' && (
          <>
            <Panel heading="1. 구질 선택" />
            <MenuList
              items={slotItems(progress.magicRemaining, pitchSlotsFor(progress))}
              onSelect={(id) => {
                const found = pitchSlotsFor(progress).find((candidate) => slotIdOf(candidate) === id)
                if (found === undefined || !canSelectSlot(found, progress.magicRemaining)) return
                setSlot(found)
                setPhase('코스')
              }}
            />
          </>
        )}

        {!asksGiveUp && !isPopupOpen && canPitch && phase === '코스' && (
          <>
            <Panel heading={<>2. 코스 선택 — {slot?.name}</>} />
            <CourseGrid
              selectedCell={courseCell}
              onSelect={(cell) => {
                setCourseCell(cell)
                // 마구는 게이지를 쓰지 않고 등급이 늘 5 다 (0x3f500 의 `구질 != 22`)
                if (options.gaugeSettingOn && slot?.isMagic !== true) {
                  setPhase('게이지')
                  return
                }
                if (slot === null) return
                actions.throwPitch({ typeNumber: slot.typeNumber, courseCell: cell, gaugeCell: 0 })
                setPhase('구질')
                setSlot(null)
              }}
            />
            <Hint>노릴 코스를 고르세요</Hint>
          </>
        )}

        {!asksGiveUp && !isPopupOpen && canPitch && phase === '게이지' && (
          <>
            <Panel heading="3. 투구 결정" />
            <PitchGradeGauge onPress={throwWith} />
          </>
        )}

        <ul className={styles.log}>
          {progress.log.slice(0, 6).map((entry) => (
            <li key={entry.id} className={styles.logLine} data-mine={entry.isMine}>
              {entry.text}
            </li>
          ))}
        </ul>
      </PixelScreen>

      {visibleBurstLines !== null && (
        <BurstMissionWindow
          lines={visibleBurstLines}
          judgement={resolution?.judgement ?? null}
          onClose={
            resolution !== null ? actions.closeBurst : () => setShownProposal(proposal)
          }
        />
      )}

      {progress.managerHookText !== null && (
        <ManagerHookWindow
          userEventIndex={progress.managerHookText}
          onConfirm={actions.confirmManagerHook}
        />
      )}

      {/* 경기 장면 프레임 0x52c50 의 덧그림 0x4e35c (0x53066) — 그리기 표 다음 */}
      <RecordAlertScreenOverlay frame={recordAlert} />

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

function slotIdOf(slot: PitchSlot): string {
  return `${slot.slot}-${slot.typeNumber}`
}

/** 칸 5 는 '0' 키 자리다 (0x534d8 의 메시지 7) */
function slotItems(magicRemaining: number, slots: readonly PitchSlot[]): MenuItem[] {
  return slots
    .filter((slot) => slot.typeNumber !== 0)
    .map((slot) => ({
      id: slotIdOf(slot),
      label: slot.name,
      detail: slot.isMagic
        ? `마구 · 남은 ${magicRemaining}회${magicRemaining === 0 ? ' (못 던짐)' : ''}`
        : undefined,
    }))
}

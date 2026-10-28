import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import type { LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import { emitSubstitutionEntryParticle } from '@/widgets/batting-stage/lib/substitutionEntryParticle'
import { useEffect, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import type { MutableRefObject } from 'react'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { gameStageAcePitcherOf } from '@/pages/game/lib/gameStageAcePitcher'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { PressArea, RawScreen } from '@/shared/ui'
import { MENU_PRESS_RECT, stealPressRectOf } from '@/features/play-game/model/stagePressAreas'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuOpenOnHide, useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { withNariGameMorale } from '@/entities/career/model/nariMorale'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import { fielderNamesByPosition, halfInningFieldOf } from '@/widgets/field-walk/lib/halfInningFieldInput'
import { gameBenchOffenseOf, gameFieldTeamsOf } from '@/pages/game/lib/gameFieldTeams'
import type { WalkerLineSeats, WalkerSeat } from '@/widgets/field-walk/lib/walkerAces'
import { benchClearingFieldOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { BurstBand } from '@/widgets/burst-mission/ui/BurstBand'
import { burstBandRoleOf } from '@/widgets/burst-mission/lib/burstBandLayout'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { RecordAlertFrame } from '@/widgets/game-scene/lib/recordAlert'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { outsShownDuringResultWait } from '@/features/play-game/model/benchClearingScene'
import { confirmedCountOf, useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { useSubstitutionScene } from '@/features/play-game/model/useSubstitutionScene'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { gameMatchupCardsOf } from '@/pages/game/lib/gameMatchupCards'
import { gameStageWarmCastOf } from '@/pages/game/lib/gameStageWarmCast'
import { useWarmStageCast } from '@/widgets/batting-stage/model/useWarmStageCast'
import { gameHalfInningCardsOf } from '@/pages/game/lib/gameHalfInningCards'
import { activeSound } from '@/shared/api/audio/soundPort'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import {
  hiddenStealBasesOf,
  mySpecialSwingRemainingOf,
  opponentMoundStaminaPercentOf,
  opponentPitcherEquipmentOf,
  opponentPitcherSkinIndexOf,
  ourRunnerAcesOf,
  runnerRunAbilitiesOf,
  stealableBasesOf,
} from '@/features/play-game/model/gameFlow'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { RUTHLESS_SKILL_ID } from '@/entities/batting/model/specialSwing'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const smallLogoUrlOf = (teamId: number) => assetUrl(`./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`)

interface GameScreenProps {
  readonly career: PlayerCareer
  readonly progress: GameProgress
  /** 경기 장면 두 줄의 +0xec — 교대 판 앞 값 · 벤치 클리어링 때 수비 줄 (`useWalkerLineSeats`, 수비 재생을 건너 남아야 해 GameRoute 가 든다) */
  readonly walkerSeats?: { readonly boardBefore: WalkerLineSeats; readonly benchDefense: readonly WalkerSeat[] }
  readonly atBat: AtBatState
  readonly pitcherAbility: PitcherAbility
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`, 격자 칸 → 0~4). 상대 마투수의 마구 횟수
   * 0xd8509[레벨] (0xaebe4) 이 이 칸을 본다 — 안 넘기면 Lv1(3 회).
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /** 수비 팀 +0x28 · 공 +0x10 — 진행기가 경기 내내 드는 CPU 마구 두 칸 (`BattingStage.cpuMagic`) */
  readonly cpuMagic?: { readonly remaining: number; readonly ballMagicNumber: number }
  readonly isPaused: boolean
  readonly bannerText: string
  readonly random: RandomPort
  /** 세 번째 인자는 **필살타법이 성공한 타구인가** (0x51800) */
  /** 넷째 인자는 이 공의 번트 종류(장면 +0xfdc, `BattingStage.onPitchResolved`) — 타구 판 리드(0x3d7b8)가 본다 */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number) => PitchResolvedReply | void
  /** 맞은 판정 틀 — 메시지 0x11 굴림 묶음을 미리 굴린 쏜 공 (`BattingStage.onContact`, A-37) */
  readonly onContact?: (detail: PitchOutcomeDetail, buntKind: number) => LaunchedShot | null | undefined
  /** 경기를 그만두고 메인 메뉴로 (이 경기 기록은 사라진다) */
  readonly onQuit: () => void
  /**
   * **도루 출발** (원본 0x53610 → 메시지 0x583 → 0xa9bd4). 인자는 대상 주자가 선 루다 —
   * 키 '3' 1루 주자 · '2' 2루 주자 · '1' 3루 주자(홈으로). 판정은 공이 도착할 때 도루 판이 한다.
   * 안 넘기면 도루 입구가 뜨지 않는다.
   */
  readonly onSteal?: (base: StealBase) => void
  /**
   * **CPU 투수의 견제** — 상대 투수 AI 가 목표점 대신 견제(종류 4, 0x34848)를 고르면 타석 화면이 공을 안 던지고
   * 그 루를 알려 준다. 원본 0x345fc 는 홈런더비(모드 7)만 갈라 타자편(모드 4)도 견제한다.
   * 안 넘기면 견제가 꺼진다(종류 4 → 1, `selectPitch` 주석).
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 값. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * 벤치 클리어링 연출(상태 0x1e)이 끝났다 — `progress.pendingBenchClearing` 이 연출 단계(`'scene'`)인 동안 타석 대신 연출을 띄운다.
   * 인자는 틱 10 의 갱신이 돌았는가 (진행기 `resolveBenchClearing` 이 그 굴림 8 번을 낸다).
   */
  readonly onBenchClearingDone?: (reachedTargetTick: boolean) => void
  /**
   * 필살 스윙이 나간 틱(`0x4e136`)에 줄인 남은 횟수를 받는다 — 진행기(`spendMySpecialSwing`)가 든다.
   * 안 넘기면 횟수를 줄여도 받아 줄 곳이 없어 경기 내내 처음 횟수로 남는다.
   */
  readonly onSpecialSwingUsed?: (remaining: number) => void
  /**
   * 이 공 앞의 장면 +0xfdc(마지막으로 쓴 번트 종류) — 타석 화면(`BattingStage.sceneBuntKind`)이 사람 키로 고치고 판정된 공의
   * `onPitchResolved` 넷째 인자로 돌려준다. 부르는 쪽이 경기 장면 동안 들고 있다가 다시 넘긴다. 안 주면 타석 화면이 스스로 든다.
   */
  readonly sceneBuntKind?: number
  /** 루상 주자 애니 시계 — 경기 장면 수명(`BattingStage.runnerAnimationClock`). 안 주면 타석 화면이 사는 동안만 센다 */
  readonly runnerAnimationClock?: MutableRefObject<RunnerAnimationClock>
  /** 경기 스킬 표시 판의 장면 칸(함성 29 비트 칸 skin+0x44c · 애니 7 · 8) — 경기 장면 수명. 안 주면 타석 화면이 사는 동안만 */
  readonly skillPanelScene?: MutableRefObject<SkillPanelScene>
  /**
   * 이 경기 구장의 하늘 줄 +0x10 (0x783b0 모드 4 — 나리 저장 +0xb2 mod 6). 경기를 세울 때 정한 값을 경기 내내 넘긴다 —
   * 수비 재생으로 화면이 내려갔다 다시 서도 같은 줄이다. 안 주면 타석 화면이 그림을 세울 때 굴린다(예전 근사)
   */
  readonly skyRow?: number
  /**
   * 이 경기의 타석 구장 객체 — 셋업 0x39fdc 모드 4 갈래(`nariSceneStadium`): +0x70 펜스 프레임 · +0xc 바닥 팔레트 줄.
   * 안 주면 0번 구장 · 기본색
   */
  readonly sceneStadium?: SceneStadium | null
  /** 경기 중 기록 달성 알림 0x4e35c 의 이번 그림 (`useRecordAlert`, 부르는 쪽이 든다). 안 넘기면 안 그린다 */
  readonly recordAlert?: RecordAlertFrame
  /** 알림을 든 쪽에 이 화면의 팝업 · 장면 갈래를 알린다 (`RecordAlertScene`) — 바뀔 때마다 */
  readonly onRecordAlertSceneChange?: (scene: RecordAlertScene) => void
  /**
   * 타석 HUD 돌발 띠 0x8e858 의 지금 돌발 행 [M+0xc] — 발동부터 결과 창을 닫을 때까지(0x8e5b8 · 0x8f628 만 −1 로 되돌린다).
   * 모드 4 는 사람 장면이 늘 내 타석이라 아이콘은 방망이(공격)다
   */
  readonly burstRow?: BurstMissionRow | null
  /** 돌발 제안 창(0x1b, 그리기 0x4a198)이 섰다 — 타석 캔버스가 HUD 0x4c4bc 를 안 그린다(`BattingStage.isHudOmitted`) */
  readonly isHudOmitted?: boolean
}

/**
 * 기록 달성 알림을 든 쪽(`app/ui/GameRoute`)이 이 화면에서 알아야 할 것.
 * - `isFrozen`: 팝업 관리자 [0x140005c]+9 — 경기 중 메뉴 · 그 하위(조작방법 · 설정)가 떠 있으면 0x52cc6 이 장면 갱신을 막아
 *   알림의 폭 · 시간 · 상태 틱과 0x12 대기 틱이 안 오른다.
 * - `key`: 상태 틱 [+0x2c] 를 0 부터 다시 세는 화면 갈래(벤치 클리어링 0x1e · 판 0x18 · 0xd/0xe 대기 · 타석). 타석 안의 원본 상태
 *   경계(0xf · 0x10 · 0x11 · 0x12 · 0x13)와 0xd → 0xe 는 그 상태를 세우는 부품이 장면 틱으로 적는다(`sceneStateEntries`).
 */
export interface RecordAlertScene {
  readonly isFrozen: boolean
  readonly key: string
}

/** 나만의리그 타자편 = 원본 전역 모드 4 — 경기 중 메뉴 표 0xcfcfc 의 **행 2**(네 칸)다 */
const BATTER_CAREER_MODE = 4
/** 경기 화면을 덮는 하위 화면 */
type MenuOverlay = '조작방법' | '설정'

export function GameScreen({
  career,
  progress,
  walkerSeats,
  atBat,
  pitcherAbility,
  aceLevels,
  cpuMagic,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  onContact,
  onQuit,
  onSteal,
  onPickoff,
  settings,
  onSettingsChange,
  onBenchClearingDone,
  onSpecialSwingUsed,
  sceneBuntKind,
  runnerAnimationClock,
  skillPanelScene,
  skyRow,
  sceneStadium = null,
  recordAlert,
  onRecordAlertSceneChange,
  burstRow = null,
  isHudOmitted = false,
}: GameScreenProps) {
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  // 내 선수 · 상대 투수 명단의 칠하기를 미리 건다 — 원본은 타석 교대 0x47cc8 의 적재 때 칠해 첫 그림부터 제 색이다(`gameStageWarmCastOf`)
  const stageWarmCast = gameStageWarmCastOf(progress, career)
  useWarmStageCast(stageWarmCast)
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  const isEagleEyeEnabled = career.eagleEyeGamesRemaining > 0
  // 마운드 마투수 그림 — 마선수 대결 투수 · 142 가 8번 칸에 넣은 마투수 (`gameStageAcePitcherOf`, 0x793b0 의 793c2)
  const acePitcherFrames = gameStageAcePitcherOf(progress)
  /** 운동장 전경 · 벤치 클리어링의 두 팀 — 레코드 타자 배열 차례 · 지금 투수 마선수 (`gameFieldTeamsOf`) */
  const fieldTeams = gameFieldTeamsOf(career, progress)

  /** 지금 출발시킬 수 있는 루 — `canStartSteal`(0xa9924 앞길 검사). 이번 공에 이미 출발한 주자는 빠진다 */
  const stealableBases = onSteal === undefined ? [] : stealableBasesOf(progress)
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  /** `event` — 누름 칸의 사건(닿은 시각이 붙어 있다 — `PressArea`). 키는 창 잡기 단계가 이미 사건 시각으로 칸을 넣었다 */
  const stealIfFlying = (base: StealBase, event?: Event) => {
    // 도루 키는 장면 키 칸에 든다 — 다음 틀의 키 0x498d4 → 0x53670 → 0x53610 이 그 틀의 상태(0x11)를 보고 출발시킨다
    pushSceneKey(
      () => {
        if (flightProbeRef.current?.() !== true) return
        onSteal?.(base)
      },
      'press',
      event === undefined ? undefined : inputTimeOf(event),
    )
  }

  // 벤치 클리어링 연출(상태 0x1e) — 붙든 사구가 0x12 대기 · 진입 앞이면 아직 타석 화면이 0x12 를 그린다(A-22)
  const isBenchClearing = progress.pendingBenchClearing?.phase === 'scene'
  /** OK 로 1회초 판을 닫았는가 */
  const [isBoardClosed, setBoardClosed] = useState(false)
  const board = progress.halfInningBoard ?? null
  const isHalfInningBoardOpen = !isBoardClosed && board !== null && isAtFirstPitchOf(progress, atBat)
  /**
   * **상태 0xe — 내 타석마다 사람 OK 를 기다린다** (`features/play-game/model/sceneConfirm`, 0x39e14 → 0x532b0).
   * 타석 결과 연출·돌발 창·1회초 판·벤치 클리어링·경기 중 메뉴·조작방법·설정이 덮고 있으면 받지 않는다.
   * 받은 OK 는 진행기가 실은 대기 객체에 남아, 수비 화면을 갔다 와 이 화면이 다시 서도 다시 묻지 않는다.
   * 돌발 제안 창(0x1b)은 원본처럼 OK 뒤에 선다 — 그 창을 띄우는 `app/ui/GameRoute` 가 대기가 끝나기를 기다린다.
   */
  /** 상태 0xe 소개 판 값 (0x44944) */
  const matchup = gameMatchupCardsOf(progress, career)
  const isSceneUncovered = !isPaused && bannerText === '' && !isMenuOpen && overlay === null && !isBenchClearing && !isHalfInningBoardOpen
  /**
   * **교체 연출 0x16** — 진행기가 0xe 확인 뒤 0xf 진입의 CPU 투수 교체를 실어 두면(`progress.substitutionScene`) 그 OK 를 받은 뒤
   * "CHANGE" 애니를 그린다. 그동안은 0xd · 0xe 가 아니라 다음 대기를 세지 않는다(0x16 → 0xd → 0xe).
   * 타석 중간(볼 · 스트라이크 · 파울 · 판 끝 · 견제 끝의 0xf 진입, be9a27f)이면 진행기가 새 대기(entries 1)와 `confirmsBefore` 0
   * 연출을 싣는다 — 곧장 서고, 카운트는 그대로(0xd 가 앞 상태 0x16 이라 타석 초기화를 건너뜀, 48e94) 0xe 의 OK 를 기다린다.
   */
  const substitution = useSubstitutionScene(
    progress.substitutionScene,
    progress.sceneConfirm,
    isSceneUncovered,
    // 0xe 첫 그림의 0x38b64 — 타석 캔버스가 그린 투수 · 타자 자리에 등판 파티클
    (scene) => emitSubstitutionEntryParticle(scene.entryKind),
  )
  const sceneConfirm = useSceneConfirm(progress.sceneConfirm, isSceneUncovered && !substitution.isShown)
  // 단말 일시정지 0x463ac — '*' 가 열리는 때(벤치 클리어링 · 1회초 판 밖)이고 하위 창이 없으면 같은 메뉴를 연다
  useInGameMenuOpenOnHide(menu, !isBenchClearing && !isHalfInningBoardOpen && overlay === null)
  /** 원본 공용 키 처리 0x498d4 — '*' 메뉴 · 도루 '3'/'2'/'1' */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 벤치 클리어링(0x1e)·1회초 판(0x18) 중에는 공용 키가 안 열린다 (0x498d4 의 상태 범위 밖)
      if (isBenchClearing || isHalfInningBoardOpen) return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      if (event.key === '*') {
        event.preventDefault()
        return menu.pressStar()
      }
      if (isMenuOpen || overlay !== null) return
      const base = stealBaseOfKey(event.key)
      if (base !== null && stealableBases.includes(base)) {
        event.preventDefault()
        // 공이 나는 동안(상태 0x11)만 — 그 밖의 키는 원본도 먹고 끝난다
        stealIfFlying(base)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isBenchClearing, isHalfInningBoardOpen, isMenuOpen, menu.pressStar, onSteal, overlay, stealableBases])

  // 기록 달성 알림의 팝업 멈춤 · 장면 갈래를 알림을 든 쪽에 알린다 (`RecordAlertScene`)
  const isAlertFrozen = isMenuOpen || overlay !== null
  const alertSceneKey = isBenchClearing
    ? 'benchClearing'
    : isHalfInningBoardOpen
      ? `board-${board?.serial ?? 0}`
      : sceneConfirm.isAwaiting
        ? 'confirm'
        : 'play'
  useEffect(() => {
    onRecordAlertSceneChange?.({ isFrozen: isAlertFrozen, key: alertSceneKey })
  }, [alertSceneKey, isAlertFrozen, onRecordAlertSceneChange])

  // 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다. 공용 키 '*'·도루도 0x1e 에서는 안 열린다
  if (progress.pendingBenchClearing?.phase === 'scene' && onBenchClearingDone !== undefined) {
    return (
      <BenchClearingScene
        // 그리기 0x43228 — 진입 굴림 45 번으로 선 18명 (사구를 맞은 타자는 나다)
        field={benchClearingFieldOf({
          entryRolls: progress.pendingBenchClearing.entryRolls,
          half: progress.game.half,
          playerSide: progress.game.playerSide,
          ourTeamId: progress.ourTeamId,
          opponentTeamId: progress.opponentTeamId,
          batterHand: career.battingSide,
          bases: progress.game.bases,
          grassPalette: sceneFieldPaletteOf(sceneStadium),
          // 마선수 그림 0x79b48 — 공격 줄은 내 팀(사구를 맞은 타자는 나 — 마선수가 아니다), 수비 줄은 상대 팀
          defenseAces: fieldTeams.opponent.aces,
          // 수비 줄 +0xec — 이 장면에서 마지막으로 적힌 값(1회초 판 · 내 타석의 수비 판 시작)
          defenseSeats: walkerSeats?.benchDefense ?? null,
          // 사구를 맞은 지금 타자는 내 선수 — 마선수가 아니라 3a97e 의 맞바꿈이 없다. 루 위 마선수 주자는 3aa1a
          offenseAces: gameBenchOffenseOf(fieldTeams.ours, progress),
        })}
        // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
        random={random}
        onDone={onBenchClearingDone}
      />
    )
  }

  /**
   * 1회초 판(상태 0x18) — 선공·1번 타자일 때만 진행기가 세운다(`gameFlow.withFirstInningBoard`, 굴림 36 개는 그때 썼다).
   * 징글 13 은 판의 틱 2 (0x4f7ac). OK → 0xae3a0 → 0xd → 첫 타석.
   */
  if (isHalfInningBoardOpen && board !== null) {
    const isOurOffense = (board.half === '초' ? 0 : 1) === progress.game.playerSide
    const boardDefense = isOurOffense ? fieldTeams.opponent : fieldTeams.ours
    const boardOffense = isOurOffense ? fieldTeams.ours : fieldTeams.opponent
    return (
      <HalfInningBoard
        inning={board.inning}
        half={board.half}
        onTick={(tick) => {
          if (tick === HALF_INNING_JINGLE_TICK) activeSound().play(HALF_INNING_SOUND)
        }}
        // 점수판 틀 0x41440 의 두 측 — 내 팀 PLAYER · 상대 COM
        scoreboardSides={humanVsComputerSidesOf(progress.game.playerSide, progress.ourTeamId, progress.opponentTeamId)}
        // 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER")
        cards={gameHalfInningCardsOf(progress, career, board.half)}
        // 운동장 전경 0x4fb8c — 타자편 판은 경기 첫 판(1회초 — 인트로 0xc 바로 뒤)뿐이라 장면이 수비 줄 · 카메라를 아직 안 옮겼다
        // (`carry` 없음 = 0x3fac4 의 자리 합 0 갈래, `lib/fieldCarry`)
        field={halfInningFieldOf({
          rolls: board.fielderRolls,
          half: board.half,
          carry: null,
          playerSide: progress.game.playerSide,
          ourTeamId: progress.ourTeamId,
          opponentTeamId: progress.opponentTeamId,
          grassPalette: sceneFieldPaletteOf(sceneStadium),
          // 이름표 — 칸 0 은 상대 마운드, 1~8 은 0x40008: 상대 팀 레코드 타자 배열 차례(나리 팀 레코드 · 대회 칸)에서 자리 니블이 칸 + 1 인 첫 선수
          fielderNames: fielderNamesByPosition(gameHalfInningCardsOf(progress, career, board.half).pitcherName, boardDefense.lineup),
          // 마선수 그림 0x79b48 — 수비 줄은 수비 팀, 공격 줄은 공격 팀 (0x3fac4 가 +0xec · 두 그림을 싣는다)
          defenseAces: boardDefense.aces,
          offenseAces: boardOffense.aces,
          seats: walkerSeats?.boardBefore ?? null,
        })}
        onConfirm={() => setBoardClosed(true)}
      />
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

  return (
    <>
      <RawScreen>
        {/* 타석 캔버스 — RawScreen 판 (0, 0) 에 맞춘다(`stageScreen.css`) */}
        <div className={stageScreen.canvasSlot}>
          {/*
            원본 타석 화면에는 글자 안내가 없다 — 마선수 등판은 컷인 0x473f0 · 판정은 game_judge 애니뿐이라
            웹 전용 "등판!" 띠 · 조작 안내(Hint) · 큰 결과 글자(BigResult)를 걷어 냈다
          */}
          <BattingStage
            isHudOmitted={isHudOmitted}
            // 0xb570c 의 사기 감소는 b5768 이 넘겨 받은 팀 레코드 +2 에 쓴 0xa3a24 값을 읽는다 — 국가대항전 중이면 상대국 칸 +2
            // (원본 버그, `withNariGameMorale`)
            batterAbility={effectiveAbilityOf(withNariGameMorale(career))}
            // 번트 '7'/'8'/'9' — 0x535a4 → 0x6a7 → 0x51e48 은 모드를 안 본다. 타자편은 내 선수가 쳐서 마선수(0xb633c)가 아니다
            canBunt
            swingMode="나만의리그"
            gameMode={BATTER_CAREER_MODE}
            // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
            isScoreboardOn={settings?.isScoreboardOn}
            // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
            isVibrationOn={settings?.isVibrationOn}
            // 타자 폼 = 원본 rec[0xb] 윗니블 `2 × 타입 + 손` (C 5절 0x16f9a) — 장타형이면 sluger 몸통이 나온다
            batterForm={career.battingTypeIndex * 2 + career.battingSide}
            // 고른 피부(0 황인 · 1 백인 · 2 흑인)와 장비를 타석 그림에 입힌다 —
            // 안 넘기면 구운 벌(피부 0)과 맨몸으로 나간다
            batterSkinIndex={career.skinIndex}
            batterEquipmentLevels={career.equipmentLevels}
            // 스윙 결과 0xab214 는 0xb62b4 = 장착 비트(+0x14)만 본다 — 보유 전부가 아니다
            batterSkillIds={career.equippedSkillIds}
            recentAtBatCodes={progress.recentAtBatCodes}
            // 투수 스킬 31 의 0xb6394(내 선수) — 0xb53f1 이 내 선수를 칸 +0xa & 0x1f 에 앉히고 0xb8768 이 그 첨자로 다시 매긴다
            // (142 진입 0x1c54a 도 타순 = 레코드 안 내 줄 첨자 + 1 로 읽는다) — 곧 내 타순 칸.
            // 국가대항전도 같다(직접 떴다): 0x39fdc 3a0f0~3a162 가 S+0x12c 면 두 팀을 대진 0xb7614(L, L+0xad, 0/1)로 고르고 팀 10 을 우리
            // 쪽(r6)에 두며, 0xb891c → 0xb8680(모드 4) → 0x1f989 → 0x1f8f8 이 팀 10 을 대표팀 칸 +0xbc4 로 읽는다. 3a2fa 0xb8768 이
            // 그 배열을 다시 매기므로 내 칸 = 대표팀 안 내 첨자 = `nariCupBattingOrderOf` − 1 = playerOrderIndex
            batterRecordSlot={progress.game.playerOrderIndex}
            pitcherAbility={pitcherAbility}
            // 마운드 상대 투수 레코드 +0x19 · +0x1a 니블 → 장비 겹 (타석 교대 0x47cc8 의 48138~4816a, 마투수면 없음)
            pitcherEquipmentNibbles={opponentPitcherEquipmentOf(progress)}
            // 마운드 바탕 벌 = 피부 × 15 + 수비 팀(482c0~482fc → 0x793b0 의 794c2) — 수비 팀 = 상대
            pitcherSkinIndex={opponentPitcherSkinIndexOf(progress)}
            pitcherTeamIndex={progress.opponentTeamId}
            warmCast={stageWarmCast}
            // 마선수 대결의 상대 마투수 마구 횟수 = 0xd8509[mgr[0x13a + 순번]] (0xaebe4)
            aceLevels={aceLevels}
            {...(cpuMagic === undefined ? {} : { cpuMagic })}
            hud={{
              inning: progress.game.inning,
              half: progress.game.half,
              ourScore: progress.game.ourScore,
              opponentScore: progress.game.opponentScore,
              balls: atBat.balls,
              strikes: atBat.strikes,
              // 붙든 삼진(0x12 대기)은 진입 3e1a6 이 이미 올린 아웃으로 그린다 (r298)
              outs: outsShownDuringResultWait(progress.game.outs, progress.pendingBenchClearing),
              bases: progress.game.bases,
              // HUD 팀 아이콘은 작은 로고 ui/team_logo_ini (0x373d0) — 적재 0x48a38 이 경기[0x28 + 측] 팀(0xb6bdd)으로 싣는다.
              // 국가대항전이면 0x39fdc(3a148~3a22a)가 우리 측에 대한민국(10)을 앉히므로 시즌 팀(career.teamId)이 아니다
              ourLogoUrl: smallLogoUrlOf(progress.ourTeamId),
              opponentLogoUrl: smallLogoUrlOf(progress.opponentTeamId),
              ourTeamId: progress.ourTeamId,
              opponentTeamId: progress.opponentTeamId,
              // 위 줄 = 측 0(선공) — 사람 팀이 앉은 측 (0x373d0)
              playerSide: progress.game.playerSide,
              // 0x35b94 상태 0xe 주루 칸 — 루에 선 주자의 신원(원본 주자 목록)대로 그 주자 주력, 내가면 내 능력치
              runnerRunAbilities: runnerRunAbilitiesOf(progress),
              // st[0x15 + i] — 이번 공에 도루를 출발한 주자는 루에 안 그린다 (0xa9bd4 가 세우고 0xf 진입 · 타구 판 시작이 지운다).
              // 새 타석의 0xf 진입은 0xe 의 첫 OK 뒤라 받은 OK 수를 넘긴다
              hiddenRunnerBases: hiddenStealBasesOf(progress, confirmedCountOf(progress.sceneConfirm)),
            }}
            // 루상 주자 0x35b94 — 주자 +0x9c ≠ −1(마선수)이면 타석 교대 0x483a0 이 +0x1c 에 실은 ace/defender 그림 (수비 판과 같은 값)
            runnerAces={ourRunnerAcesOf(progress)}
            // 투수 그리기 0x38d1c — 상대 마운드 체력% ≤ 34 면 지친 눈(모드 4 도 그린다 — 38ed6 은 모드 7 만 거른다). 마투수면 null
            pitcherStaminaPercent={opponentMoundStaminaPercentOf(progress)}
            isEagleEyeEnabled={isEagleEyeEnabled}
            acePitcher={acePitcherFrames}
            // 조작방법 뷰어 동안도 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
            // 0xe(OK 대기)에서도 공이 안 나간다 — 타석 장면(0xd 그리기)만 선다
            isPaused={isPaused || isMenuOpen || overlay !== null || sceneConfirm.isAwaiting}
            // 좌우 이동 +0xfe4 는 0xd 진입 48f88 에서만 지운다 — 같은 타석의 다음 공(0xf)과 결과 연출 동안은 남는다(A-02)
            shiftResetSerial={sceneConfirm.sceneDEntryMark}
            {...(skyRow === undefined ? {} : { skyRow })}
            // 구장 객체(0x39fdc 모드 4 — 홈 팀 · 대회 2/8) — 펜스 프레임 +0x70 · 바닥 팔레트 줄 +0xc
            {...(sceneStadium === null ? {} : { stadium: sceneStadium.stadium })}
            fieldPalette={sceneFieldPaletteOf(sceneStadium)}
            random={random}
            // 필살타법 '0' (0x535a4 → 0x51dee → 0x34c74). 레벨이 아니라 **고른 번호**(+0x18)를 넘긴다 —
            // 0 이면(아직 안 고름) '0' 키가 무시된다
            specialSwingNumber={career.specialSwingNumber}
            // 한 경기 횟수 s8 team[+0x29 + 타순] — 0xaebe4 가 표 0xd84f0[+0x18] (+ 스킬 23 무자비 1)로 채운다
            specialSwingRemaining={mySpecialSwingRemainingOf(progress, {
              swingNumber: career.specialSwingNumber,
              hasRuthlessSkill: career.equippedSkillIds.includes(RUTHLESS_SKILL_ID),
            })}
            onSpecialSwingUsed={onSpecialSwingUsed}
            sceneBuntKind={sceneBuntKind}
            {...(runnerAnimationClock === undefined ? {} : { runnerAnimationClock })}
            // 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 사람 팀이 공격 측(st[9])
            skillPanel={{
              entryKey: progress.sceneConfirm ?? null,
              attackSide: progress.game.playerSide,
              ...(skillPanelScene === undefined ? {} : { scene: skillPanelScene }),
            }}
            // 0xab214 의 내 선수 보너스 — 모드 4 에서 rec = 0x1f8d4(저장, 4) = [저장+0xbc]+0x11c 의 rec[0xa] 비트7(육성)이
            // 서고(0xb6389, ab3d6), 연차 idx 는 같은 레코드 +0xb3 (ab3f2) — 커리어 연차는 1부터라 1 을 뺀다
            isBatterOwnPlayer
            careerYearIndex={career.season - 1}
            onPitchResolved={onPitchResolved}
            onContact={onContact}
            flightProbeRef={flightProbeRef}
            onPickoff={onPickoff}
          />
        </div>
        {/* 타석 공용 그리기 0x4c4bc 4c510~4c524 — 점수판 바로 뒤 돌발 띠 0x8e858 (모드 2~4 · 돌발 객체가 있을 때) */}
        <BurstBand row={burstRow} role={burstBandRoleOf(progress.game.half, progress.game.playerSide)} />
        {/*
          0xe 그리기 0x4d9ec — 0xd 두 그림 뒤 타석 장면 위에 투수·타자 소개 판 0x44944. 팀 글자는 0xb6c20: 내 팀 PLAYER · 상대 COM.
          값은 `gameMatchupCardsOf` (내 레코드 · 상대 마운드).
        */}
        {sceneConfirm.isAwaiting && sceneConfirm.isInConfirmState && <SceneMatchupCards {...matchup} />}
        {/* 교체 연출 0x16 — 그리기 0x4da30 이 타석 그림 위에 game_ui 애니 9 "CHANGE" 를 얹는다 */}
        {substitution.isShown && <SubstitutionSceneOverlay key={substitution.serial} aceSlot={substitution.aceSlot} onDone={substitution.finish} />}
        {/* 경기 장면 프레임 0x52c50 의 덧그림 0x4e35c — 그리기 표 다음(53066), 팝업 0x746cd 앞. 겹 `RECORD_ALERT` 라 돌발 창(장면 창)
            위, 경기 중 메뉴가 떠 있으면 메뉴 층 아래 */}
        {recordAlert !== undefined && <RecordAlertStageOverlay frame={recordAlert} isUnderMenu={isMenuOpen} />}

        {/*
          웹 제목줄 · 배지(G 누계 · 이글아이)는 걷었다 — 원본 240×320 장면 한 장뿐이다. G 누계는 기록 달성 알림 0x4e35c 가
          판 머리에 그리고(위 `RecordAlertPanel`), 이글아이 남은 경기는 경기 화면에 안 그린다(상태판 0x7d34c 의 아이콘뿐, P4).
          마우스 · 터치 길은 투명한 누름 칸으로 남긴다 — 0xe 의 OK(화면 전체) · '*' 메뉴("*MENU" 자리) · 도루(점수판 루 그림 자리)
        */}
        {sceneConfirm.isAwaiting && !isMenuOpen && (
          // 0xe — OK 하나만 받는다 (0x532b0)
          <PressArea label="확인" onPress={sceneConfirm.confirm} isDisabled={!sceneConfirm.acceptsConfirm} />
        )}
        {!sceneConfirm.isAwaiting &&
          !isMenuOpen &&
          stealableBases.map((base) => (
            <PressArea key={base} label={`도루 ${base}루`} rect={stealPressRectOf(base)} onPress={(event) => stealIfFlying(base, event)} />
          ))}
        <PressArea label={isMenuOpen ? '닫기' : '메뉴'} rect={MENU_PRESS_RECT} onPress={menu.pressStar} />

        {isMenuOpen ? (
          <div className={stageScreen.menuLayer}>
            <InGameMenu
              // 나만의리그 타자편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다
              mode={BATTER_CAREER_MODE}
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
        ) : null}
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
    </>
  )
}

/**
 * 판이 아직 OK 를 기다리는 자리인가 — 경기 첫 타석의 첫 공 전(아웃·주자·점수 없고 볼카운트 0-0).
 * 이 화면은 수비 재생 동안 앱이 내렸다 다시 올리므로(닫힘 상태가 사라진다) 판이 다시 서지 않게
 * 경기가 한 걸음이라도 나갔으면 판을 안 띄운다. 1회초 판은 경기 첫 장면에만 서므로 이것으로 충분하다.
 */
function isAtFirstPitchOf(progress: GameProgress, atBat: AtBatState): boolean {
  const { game } = progress
  return (
    game.inning === 1 &&
    game.outs === 0 &&
    game.ourScore === 0 &&
    game.opponentScore === 0 &&
    !game.bases.first &&
    !game.bases.second &&
    !game.bases.third &&
    atBat.balls === 0 &&
    atBat.strikes === 0
  )
}

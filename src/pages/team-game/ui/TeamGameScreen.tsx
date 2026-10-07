import { useCallback, useEffect, useRef, useState } from 'react'
import { BigResult, Hint, MenuList, Panel, PixelScreen, StatGrid } from '@/shared/ui'
import type { MenuItem, StatEntry } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import {
  autoProgressCostOf,
  canAutoProgress,
  currentBatterAbility,
  currentBatterEntry,
  currentPitcherAbility,
  currentPitcherAceIndex,
  opponentMagicStateOf,
  pitchSlotsFor,
  pitchersOfRecordOf,
  specialSwingRemainingAt,
  substitutionDetailAbilities,
} from '@/features/play-team-game/model/teamGameFlow'
import { GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { hasGameIntro } from '@/widgets/game-scene/lib/introSchedule'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { teamMatchupCardsOf } from '@/pages/team-game/lib/teamMatchupCards'
import type { TeamMatchupRecords } from '@/pages/team-game/lib/teamMatchupCards'
import type {
  TeamEntryBatter,
  TeamEntryPitcher,
} from '@/features/play-team-game/model/teamGameRoster'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import type {
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
} from '@/features/play-team-game/model/teamGameFlow'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
import { PITCHER_CHANGE_SOUND } from '@/pages/team-game/model/teamGameSounds'
import { activeSound } from '@/shared/api/audio/soundPort'
// 조작방법·환경설정 화면은 메인 메뉴 쪽에 이미 있다 — 경기 중 메뉴도 **같은 화면**을 연다
// (원본 0x3c212 는 StrHOWTO 뷰어, 0x3c326 은 StrMAINMENU 쪽 설정 페이지를 그대로 부른다).
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
// 투수 조작 부품 두 개는 투수편 화면이 이미 원본 규칙대로 만들어 둔 것을 **그대로 빌려 쓴다**
// (같은 상태 0x10·0x11 의 조작이라 화면을 따로 만들 이유가 없다).
import { CourseGrid } from '@/pages/pitching/ui/CourseGrid'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import * as styles from '@/pages/team-game/ui/TeamGameScreen.css'

/**
 * **팀 경기 화면** — 원본 게임 모드 1 일반 · 2 시즌 · 8·9 대전 이 쓰는 경기 장면(0x104)이다.
 *
 * 한 화면에서 공수를 번갈아 돈다:
 *   - 우리 공격 → 타석 화면(`widgets/batting-stage`, 상태 0xf~0x13)
 *   - 우리 수비 → 투구 세 단계(구질 0xf → 코스 0x10 → 게이지 0x11)
 *   - 어느 쪽이든 **인플레이 타구가 뜨면 수비 화면**(상태 0x17)으로 넘어가 공이 멈출 때까지
 *     매 갱신 키를 읽는다 — 공격이면 주루(0x5331c), 수비면 송구(0x533c8)다
 *   - 그 밖(경기진행 설정이 "자동" 이라고 한 타석) → 진행기가 간이 엔진으로 넘긴 뒤 다음 사람 차례에서 멈춘다
 *
 * 경기 중 조작은 원본 `0x498d4` 를 따른다:
 *   - **'\*'** 경기 중 메뉴 (표 0xcfcfc 행 0: 계속·자동진행·조작방법·설정·나가기 — I-controls 4c)
 *   - **'#'** 교체 화면 (상태 0xb, 투구 전·구질 고르기 — I-controls 4b · R4 1a).
 *     **수비 중이면 투수 교체, 공격 중이면 대타**다 (갈림길 `0x49598`)
 *   - **'3'/'2'/'1'** 도루 출발 (공격 중, 메시지 0x583 → 0xa9bd4 — I-controls 0절). 판정은 공이 도착할 때 도루 판이 한다
 *
 * 교체 연출(상태 0x16)은 **소리만** 잇는다 — 대타 등판음·"Time!" 22 는 `useTeamGame` 걸음 끝이 낸다(1e1f5f2).
 * 그 연출 그림(0x4da30)은 없다.
 * 원본에 있고 여기 없는 것: 교체 연출 0x16 의 그림, 자동진행 **중계 화면**(상태 0x21),
 * 공수 교대 판(0x18 교대 가지)의 그림 — 흐름·굴림·징글만 `HalfInningBoard` 로 잇는다.
 * 경기가 끝나면 상태 0x18 의 **경기 끝 결과 판**(`widgets/game-scene` `GameEndBoard`)을 먼저 띄우고,
 * OK 뒤에 정산(0x19) 자리인 요약 화면으로 간다.
 */
const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 통째로 덮는 하위 화면 — 경기 중 메뉴가 연다 */
type MenuOverlay = '조작방법' | '설정'

interface TeamGameScreenProps {
  readonly options: TeamGameOptions
  readonly random: RandomPort
  /** 경기가 끝나고 사용자가 확인을 누르면 부른다 — 시즌 세션은 이 요약으로 하루를 정산한다 */
  readonly onFinish: (summary: TeamGameSummary) => void
  /** 경기 화면을 그냥 나갈 때 (원본 경기 중 메뉴 '*' 의 "나가기") */
  readonly onQuit?: () => void
  /**
   * 지금 가진 G포인트(`저장+0x64`). **안 넘기면 자동진행 칸이 잠긴다** —
   * 비용을 검사할 수 없기 때문이다.
   */
  readonly gamePoint?: number
  /** 자동진행 비용만큼 G포인트를 깎아 달라는 알림 (모드 8·9 는 100, 그 밖은 30) */
  readonly onSpendGamePoint?: (cost: number) => void
  /** 환경설정 값. 안 넘기면 경기 중 메뉴의 "설정" 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * **시즌 홈경기 구장** — 장착한 관중석·전광판과 관중 수 그림 단계다.
   * 넘기면 타석 배경이 시즌 구장(0x77494)으로 그려진다.
   *
   * 원본 배경 고르기 `0x40ff0` 은 **모드 2 이고 `0xb6bdc(경기, 1) == SR[1]`**(= 내 팀이 홈)
   * 이거나 **모드 8·9(대전)** 일 때만 이 길로 간다 — 시즌 **원정**이면 안 넘겨야 원본과 같다.
   * 값을 만드는 것은 부르는 쪽(`SeasonRoute`)이다.
   */
  readonly seasonStadium?: SeasonStadium
  /**
   * **이어하기** — 저장된 진행에서 다시 세운다 (`useTeamGame` 넷째 인자). 인트로(0xc)는 새 경기처럼 다시 선다 —
   * 원본도 장면 0x104 를 처음부터 들어가 상태 8 → 0xc 를 지난다.
   */
  readonly resumeFrom?: TeamGameProgress
  /**
   * **이어하기 저장을 썼다** — 진행의 `halfInningSave` 가 바뀔 때마다(경기를 세운 첫 진행 포함) 부른다.
   * 원본 0x4f928 → 0x22754(저장, 1) 자리다. 받는 쪽이 저장소에 담는다. 안 넘기면 아무 데도 안 남는다(시즌·대전).
   */
  readonly onHalfInningSave?: (save: TeamGameProgress) => void
  /**
   * **정산(0x19)에 들어섰다** — 경기 끝 결과 판의 OK. 원본 0x4ea0c 가 이 자리에서 정산을 다 하고(기록 달성 G · 모드별 정산 ·
   * 저장) 전역기록 +0x4c+모드 를 0 으로 지운다(0x4f3d6). 그래서 요약을 함께 넘긴다 — `onFinish` 는 결과 화면 확인이다.
   */
  readonly onSettlementEnter?: (summary: TeamGameSummary) => void
  /**
   * 상태 0xe 소개 판(0x44944)의 시즌 줄 출처 — 시즌 레코드 +0x20~ 의 웹 자리인 리그 선수 기록표와, 이 경기 줄을 더할지
   * (기록 게이트 0xa56dc). 안 주면 방어율·탈삼진·타율·홈런·타점 칸을 비운다 (`teamMatchupCardsOf`).
   */
  readonly matchupRecords?: TeamMatchupRecords
}

export function TeamGameScreen({
  options,
  random,
  onFinish,
  onQuit,
  gamePoint,
  onSpendGamePoint,
  settings,
  onSettingsChange,
  seasonStadium,
  resumeFrom,
  onHalfInningSave,
  onSettlementEnter,
  matchupRecords,
}: TeamGameScreenProps) {
  const session = useTeamGame(options, random, settings?.isVibrationOn, resumeFrom)
  const { progress, canBat, canPitch, summary, actions } = session
  // 이어하기 저장 0x4f928 — 진행기가 새 저장 진행을 담을 때마다 한 번씩 넘긴다
  const halfInningSave = progress.halfInningSave ?? null
  const onHalfInningSaveRef = useRef(onHalfInningSave)
  onHalfInningSaveRef.current = onHalfInningSave
  useEffect(() => {
    if (halfInningSave !== null) onHalfInningSaveRef.current?.(halfInningSave)
  }, [halfInningSave])
  /** 지금 마운드에 선 상대 투수가 마투수면 그 선수 (0xb88c8 로 8번 칸에 앉은 그것) */
  const opposingAcePitcher = ACE_PITCHERS[currentPitcherAceIndex(progress)] ?? null

  const [phase, setPhase] = useState<PitchPhase>('구질')
  const [slot, setSlot] = useState<PitchSlot | null>(null)
  const [courseCell, setCourseCell] = useState(4)
  const menu = useInGameMenuState()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  /** 경기 끝 결과 판(0x18)에서 OK 를 눌러 정산(0x19)으로 넘어갔는가 */
  const [isEndBoardClosed, setEndBoardClosed] = useState(false)
  /** 경기 시작 인트로(상태 0xc)를 다 봤는가 — 모드 1·2 만 선다 (대전 8·9 는 없다) */
  const [isIntroDone, setIntroDone] = useState(!hasGameIntro(options.mode))
  /** OK 로 닫은 마지막 공수 교대 판(상태 0x18 교대 가지)의 번호 */
  const [closedBoardSerial, setClosedBoardSerial] = useState(0)
  const board = progress.halfInningBoard
  const isHalfInningBoardOpen = board !== null && board.serial !== closedBoardSerial && summary === null
  /** 인트로·교대 판·벤치 클리어링이 화면을 덮고 있는가 — 경기 키(0x498d4)가 안 먹는다 */
  const isSceneCovering = !isIntroDone || isHalfInningBoardOpen || progress.pendingBenchClearing !== null
  /** 이미 다 보여 준 수비 플레이 — 같은 플레이를 두 번 재생하지 않는다 */
  const [shownPlay, setShownPlay] = useState<DefensePlayResult | null>(null)
  const play = progress.lastDefensePlay
  const finishPlayback = useCallback(() => setShownPlay(play), [play])
  /** `#` 교체 화면(경기 상태 0xb)이 떠 있는가 — 수비 중이면 투수 교체, 공격 중이면 대타 */
  const [changeWindow, setChangeWindow] = useState<'투수' | '대타' | null>(null)
  const isChangingPitcher = changeWindow === '투수'
  // 교체 화면에 **들어설 때** "Time!" 22 (상태 0xb 진입 0x3ae08 → 0x3af06) — 대타도 같은 화면이다
  const audio = activeSound()
  useEffect(() => {
    if (changeWindow === null) return
    audio.play(PITCHER_CHANGE_SOUND)
  }, [audio, changeWindow])
  /**
   * 교체 창 닫기 — 원본 `0x495fc` 의 '#'·CLR 가지는 예약을 지우고 경기 상태 **0xe** 로 간다. 0xe 의 메시지 1 이
   * 돌발 굴림 0x8f158 과 0xf 진입 0x3d954 를 다시 돌리므로 진행기에도 알린다 (`cancelSubstitution`).
   */
  const closeChangeWindow = useCallback(() => {
    if (changeWindow === null) return
    setChangeWindow(null)
    actions.cancelSubstitution()
  }, [actions, changeWindow])
  /** 제안 대사를 이미 보여 준 돌발 행 번호 */
  const [shownProposal, setShownProposal] = useState<number | null>(null)

  // 타석·차례가 바뀌면 투구 1단계로 되돌린다
  useEffect(() => {
    if (!canPitch) return
    if (progress.atBat.balls === 0 && progress.atBat.strikes === 0) setPhase('구질')
  }, [canPitch, progress.atBat.balls, progress.atBat.strikes])

  /**
   * 원본 공용 키 처리 `0x498d4` — '\*' 경기 중 메뉴 · '#' 교체 · 도루 '3'/'2'/'1'.
   * (CLR 은 웹에서 Escape·Backspace 로 받는다 — 원본 키 코드 −16.)
   */
  const isStealable = session.stealableBases
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  const isDefenseInPlay = session.pendingDefensePlay !== null
  /** 상태 0xe 에서 OK 를 기다리는 중인가 — 아래 `useSceneConfirm` 이 매 그리기마다 채운다 */
  const isAwaitingConfirmRef = useRef(false)
  /** 대기 중 0xd 두 그림을 지나 0xe 에 들어섰는가 — '#' 는 0xe·0xf 에서만 열린다 */
  const isInConfirmStateRef = useRef(false)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 공수 교대 판(0x18)에는 공용 키 0x498d4 의 '*'·'#'·도루가 안 열린다 (그 상태 범위 밖)
      if (isSceneCovering) return
      // 수비 진행 중(상태 0x17)에는 이 키들이 원본에서도 안 먹는다 — '*' 는 경기 상태 0xd~0x15,
      // '#' 는 0xe·0xf 일 때만 열리고(0x498d4), 그 사이 키는 주루·송구가 가져간다
      if (isDefenseInPlay) return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      if (event.key === '*') {
        event.preventDefault()
        // 교체 창(상태 0xb)에서는 '*' 가 안 먹는다 — 0x498d4 의 '*' 가지(4991c)는 상태 0xd~0x15 만 받고,
        // 0xb 의 키 함수 0x495fc 는 '2'·'8'·'#'·'0'·'5' 만 본다. 창을 닫지도 메뉴를 열지도 않는다
        if (changeWindow !== null && !isMenuOpen) return
        return menu.toggle()
      }
      if (isMenuOpen || overlay !== null) {
        // 교체 화면과 메뉴에서 CLR 은 닫기다 (0x495fc 의 '#'·CLR 가지)
        if (event.key === 'Escape' || event.key === 'Backspace') {
          event.preventDefault()
          menu.close()
        }
        return
      }
      if (event.key === '#') {
        event.preventDefault()
        // 0x495fc 의 '#' 는 교체 화면을 닫는다(취소). 그 밖에서는 0x49598 의 갈림길 그대로 —
        // 공격이 사람이면 대타(0xaf06c), 아니면 투수 교체(0xaf09c)다
        if (changeWindow !== null) return closeChangeWindow()
        // '#' 가지(0x4994a)는 0xe·0xf 에서 열린다 — 0xe 의 OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 진행기가
        // OK 를 받을 때 돌리므로(`confirmScene`), 0xe 에서 열어 확정·취소해도 다시 선 0xe 의 OK 뒤 한 번뿐이다.
        // 0xd(대기가 보인 뒤 두 그림)는 0x4994a 의 상태 범위 밖이라 안 열린다
        if (isAwaitingConfirmRef.current && !isInConfirmStateRef.current) return
        if (session.canChangePitcher) return setChangeWindow('투수')
        if (session.canPinchHit) return setChangeWindow('대타')
        return
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (changeWindow !== null) {
          event.preventDefault()
          return closeChangeWindow()
        }
        // 코스 고르기(상태 0x10)의 CLR(−16)은 구질 고르기(0xf)로 되돌린다 (0x50ee0~0x50ee6) — 0xf 진입 0x3d954 가 다시 돈다
        if (canPitch && phase === '코스') {
          event.preventDefault()
          setPhase('구질')
          setSlot(null)
          actions.returnToPitchSelection()
        }
        return
      }
      // 도루 출발 0x53610 — '3' 1루 주자 · '2' 2루 주자 · '1' 3루 주자(홈으로)
      const stealBase = stealBaseOfKey(event.key)
      if (stealBase !== null && isStealable.includes(stealBase)) {
        event.preventDefault()
        // 공이 나는 동안(상태 0x11)만 — 그 밖의 키는 원본도 먹고 끝난다
        if (flightProbeRef.current?.() === true) actions.steal(stealBase)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    actions,
    canPitch,
    changeWindow,
    closeChangeWindow,
    isDefenseInPlay,
    isSceneCovering,
    isMenuOpen,
    isStealable,
    menu.close,
    menu.toggle,
    overlay,
    phase,
    session.canChangePitcher,
    session.canPinchHit,
  ])

  const burst = progress.burst
  const resolution = progress.lastBurstResolution
  const proposal =
    burst !== null && burst.current !== null && burst.current.index !== shownProposal
      ? burst.current
      : null
  const burstRow = resolution?.row ?? proposal
  const burstLines =
    burst === null || burstRow == null
      ? null
      : (ORIGINAL_BURST_TABLES[burst.table].lines[burstRow.index] ?? null)

  /**
   * **견제** — 구질 고르기(상태 0xf)에서 사람이 수비일 때만 '3' 1루 · '1' 2루 · '7' 3루 (0x53548).
   * 코스·게이지 단계는 원본도 다른 상태(0x10·0x11)라 받지 않는다. 그 루에 주자가 없으면 진행기가 키를 먹고 끝낸다.
   * 견제 판(또는 홈런 비행)을 재생하는 동안은 원본도 상태 0x17 이라 0xf 키를 안 받는다.
   * ('3' 은 공격 중이면 도루 키지만 도루는 사람이 칠 차례에만 열려 서로 겹치지 않는다 — `stealableBases`.)
   */
  const isReplaying = play !== null && play !== shownPlay && play.ticks.length > 0
  /**
   * **상태 0xe — 사람 OK 를 기다린다** (`features/play-game/model/sceneConfirm`). 새 타석·반 이닝 시작·교체 연출 뒤·교체 창
   * 취소 뒤마다 진행기가 대기를 싣는다. 공격이든 수비든 같다 — 0x532b0 은 조작 객체의 공수(+0xc)를 안 본다.
   * 인트로·교대 판·수비 화면·벤치 클리어링·경기 중 메뉴·조작방법·설정·교체 창이 덮고 있으면 받지 않는다.
   * OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 OK 를 받을 때 진행기가 돌린다 (`confirmScene`).
   */
  const sceneConfirm = useSceneConfirm(
    // 진행기가 OK 를 아직 안 받은 0xe 대기 (OK 를 받으면 `confirmScene` 이 그 뒤 굴림을 돌린다)
    progress.sceneConfirmPending === true ? progress.sceneConfirm : null,
    isIntroDone &&
      summary === null &&
      !isHalfInningBoardOpen &&
      progress.pendingBenchClearing === null &&
      !isDefenseInPlay &&
      !isReplaying &&
      !isMenuOpen &&
      overlay === null &&
      changeWindow === null &&
      // 타석이 끝나며 난 돌발 결과 창(0x1d)은 다음 0xd 보다 먼저다 (+0x1b6c) — 닫은 뒤에야 0xe 다
      resolution === null,
    actions.confirmScene,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && (canBat || canPitch)
  /** 정산 배경 전용 난수 — 경기 난수를 건드리지 않는다 (정산 갈래 주석) */
  const [backdropRandom] = useState(() => createSeededRandom(0))
  isAwaitingConfirmRef.current = isAwaitingConfirm
  isInConfirmStateRef.current = sceneConfirm.isInConfirmState
  /** 0xd 두 그림을 지나 0xe 에 들어섰으면 소개 판을 그린다 (0x4d9ec → 0x44944) */
  const isMatchupShown = isAwaitingConfirm && sceneConfirm.isInConfirmState
  /**
   * 소개 판 값 — 투수 `0xae83c(수비 팀)` · 타자 `0xae89c(공격 팀)` 레코드에서 (`teamMatchupCardsOf`).
   * 팀 글자는 `0xb6c20(st, 측)`(사람 팀 PLAYER · CPU 팀 COM): 우리가 치면 타자가 PLAYER, 던지면 투수가 PLAYER.
   */
  const matchup = teamMatchupCardsOf(progress, matchupRecords)
  const matchupCards = (
    <SceneMatchupCards batterHand={matchup.batterHand} pitcher={matchup.pitcher} batter={matchup.batter} />
  )
  /**
   * 띄울 돌발 창 — 결과 창(0x1d)은 0xe 앞이라 늘 띄우고, 제안 창(0x1b)은 0xe 의 OK 뒤 메시지 1 이 0x8f158 을 굴려
   * 예약하므로(0x50c42) OK 를 받은 뒤에만 띄운다
   */
  const visibleBurstLines = resolution === null && isAwaitingConfirm ? null : burstLines
  const acceptsPickoff =
    canPitch &&
    !isAwaitingConfirm &&
    !isReplaying &&
    !isSceneCovering &&
    !isDefenseInPlay &&
    phase === '구질' &&
    !isMenuOpen &&
    overlay === null &&
    changeWindow === null &&
    burstLines === null
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

  const game = progress.game
  const staminaPercent = staminaPercentOf(progress.stamina)

  /**
   * 경기 시작 인트로 — 적재(상태 8) 끝에서 모드 1~4 만 0xc 로 온다. 54틱 또는 OK 뒤 1회초 판(0x18)이나 첫 타석.
   * 효과음 61 은 진입 예약음이라 `useTeamGame` 이 경기를 세울 때 낸다.
   */
  if (!isIntroDone && summary === null) {
    const side0Team = options.playerSide === 0 ? options.ourTeamId : options.opponentTeamId
    const side1Team = options.playerSide === 0 ? options.opponentTeamId : options.ourTeamId
    return (
      <GameIntro
        awayName={TEAMS[side0Team]?.name ?? ''}
        homeName={TEAMS[side1Team]?.name ?? ''}
        onDone={() => setIntroDone(true)}
      />
    )
  }
  if (summary !== null && !isEndBoardClosed) {
    const names = pitchersOfRecordOf(progress)
    // 측 0(선공) 점수가 왼쪽 — 사람 팀은 `playerSide` 측에 앉는다
    const ourSide = progress.game.playerSide
    return (
      <GameEndBoard
        side0Score={ourSide === 0 ? game.ourScore : game.opponentScore}
        side1Score={ourSide === 1 ? game.ourScore : game.opponentScore}
        names={[names.win, names.loss, names.save]}
        onConfirm={() => {
          setEndBoardClosed(true)
          // 정산 0x19 진입 — 승리 31 · 패배 32 징글 (0x4ea0c). 같은 진입이 +0x4c+모드 를 지운다(0x4f3d6)
          actions.enterSettlement()
          onSettlementEnter?.(summary)
        }}
      />
    )
  }
  if (summary !== null) {
    // 정산 갱신 0x4b100 의 r7 — 사람 팀(우리)이 이겼나. 비기면 거짓
    const isHumanWin = summary.result === '승'
    return (
      <PixelScreen
        title="경기 결과"
        leftKey={{ label: '확인', onPress: () => onFinish(summary) }}
      >
        {/*
          정산 그리기 0x4a384 — 결과 판보다 먼저 구름 0x78448 과 배경 고르기 0x40ff0(장면, +0x17e2)만 그린다 (선수·공·HUD 없음).
          +0x17e2 는 이긴 판만 틱마다 3 씩 150 까지 올라 구장이 가라앉는다 (`settlementBackdropOffsetAt`).
          ⚠️ 판 위 글자·숫자(0x4a404 진 판 · 0x4a448 이긴 판 갈래)는 아직 웹 요약 그대로다.
        */}
        <div className={styles.stageArea}>
          <BattingStage
            batterAbility={currentBatterAbility(progress)}
            pitcherAbility={currentPitcherAbility(progress)}
            swingMode="일반"
            gameMode={options.mode}
            isEagleEyeEnabled={false}
            // 결과 뒤 배경은 HUD·선수를 안 그린다
            hud={null}
            acePitcher={null}
            // 시즌 홈경기·대전이면 배경 고르기 0x40ff0 이 시즌 구장으로 간다 — 타석과 같은 규칙
            seasonStadium={seasonStadium}
            isPaused
            isResultBackdrop
            resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isHumanWin)}
            // ⚠️ 웹 타석 화면은 그림을 세울 때 하늘 줄을 rand(0, 6) 으로 고른다(원본은 구장 팀 데이터 +0xb2, 추정 대체) —
            //    경기가 끝난 뒤 그 굴림이 경기 난수에 새지 않게 이 배경은 따로 든 난수로 세운다
            random={backdropRandom}
            onPitchResolved={() => {}}
          />
        </div>
        <BigResult>
          {summary.ourScore} : {summary.opponentScore} {summary.result}
        </BigResult>
        <StatGrid entries={summaryEntries(summary)} />
        <Hint>
          {TEAMS[summary.ourTeamId]?.name ?? ''} vs {TEAMS[summary.opponentTeamId]?.name ?? ''}
        </Hint>
      </PixelScreen>
    )
  }

  /**
   * 사람이 조작하는 갈래가 먼저다 — 진행 중인 타구가 있으면 **실시간으로 한 틱씩** 돌린다.
   * 원본은 타구가 뜬 순간 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며 매 갱신 키를 읽고,
   * 사람이 **공격이면 주루**(0x5331c), **수비면 송구**(0x533c8)를 잡는다 (I 0절 상태 0x17 표).
   * 팀 경기는 공수를 모두 사람이 맡으니 그 쪽이 이닝마다 갈린다 — 진행기가 붙들 때 적어 둔 값을 그대로 쓴다.
   * 다 돌면 `onDone` 이 그 결과를 경기 상태에 먹인다 — **주자 처리는 그때 처음 정해진다.**
   */
  const pending = session.pendingDefensePlay
  if (pending !== null) {
    return (
      <DefensePlayback
        input={pending.input}
        side={pending.side}
        grassPalette={seasonStadium?.grassPalette ?? null}
        onDone={actions.finishDefensePlay}
      />
    )
  }
  /**
   * 홈런 비행처럼 조작할 것이 없는 장면은 **미리 만들어 둔 틱을 재생만** 한다 (원본도 같은 0x17 이다).
   * 이게 없으면 배트에 맞은 공이 어디로 갔는지 화면에 아예 안 나온다.
   */
  if (isReplaying) {
    return (
      <DefensePlayback
        ticks={play.ticks}
        grassPalette={seasonStadium?.grassPalette ?? null}
        onDone={finishPlayback}
      />
    )
  }

  // 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다 (진입 굴림 45 번은 진행기가 이미 썼다)
  if (progress.pendingBenchClearing !== null) {
    return <BenchClearingScene onDone={actions.finishBenchClearing} />
  }

  /**
   * 공수 교대 판 — 그 반 이닝을 끝낸 플레이(0x17)를 다 본 뒤, 다음 사람 타석(0xd → 0xf) 앞에 선다.
   * 진행기가 판을 세울 때 0x3fac4 의 굴림 36 개를 이미 썼다. 징글 13 은 판의 틱 2 (0x4f7ac).
   */
  if (isHalfInningBoardOpen && board !== null) {
    return (
      <HalfInningBoard
        key={board.serial}
        inning={board.inning}
        half={board.half}
        onTick={(tick) => {
          if (tick === HALF_INNING_JINGLE_TICK) audio.play(HALF_INNING_SOUND)
        }}
        onConfirm={() => setClosedBoardSerial(board.serial)}
      />
    )
  }

  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        // 경기 중 "설정" 은 작은 판(skin+0x125)이라 모드 초기화 줄이 아예 없다 — mainMenu 를 안 넘기면 그렇게 그린다
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

  const throwWith = (gaugeCell: number) => {
    if (slot === null) return
    actions.throwPitch({ typeNumber: slot.typeNumber, courseCell, gaugeCell })
    setPhase('구질')
    setSlot(null)
  }

  return (
    <div className={styles.frame}>
      <PixelScreen
        title={`${game.inning}회${game.half}`}
        badge={canPitch ? `${staminaPercent}%` : `${game.ourScore} : ${game.opponentScore}`}
        leftKey={
          changeWindow !== null
            ? { label: '취소', onPress: closeChangeWindow }
            : isAwaitingConfirm
              ? // 0xe — OK 를 받는다 (0x532b0). '#' 교체는 키로 연다 (위 '#' 주석)
                { label: '확인', onPress: sceneConfirm.confirm, isDisabled: !sceneConfirm.acceptsConfirm }
            : session.canChangePitcher
              ? { label: '# 교체', onPress: () => setChangeWindow('투수') }
              : session.canPinchHit
              ? { label: '# 대타', onPress: () => setChangeWindow('대타') }
              : isStealable.length > 0
                ? {
                    label: `도루 ${isStealable[0]}루`,
                    onPress: () => {
                      if (flightProbeRef.current?.() === true) actions.steal(isStealable[0])
                    },
                  }
                : undefined
        }
        rightKey={{
          label: isMenuOpen ? '닫기' : '메뉴',
          // 소프트키1 도 0x498d4 가 '*' 로 읽는다(498e8) — 교체 창(0xb)에서는 안 먹는다
          isDisabled: changeWindow !== null && !isMenuOpen,
          onPress: menu.toggle,
        }}
      >
        <div className={styles.hud}>
          <span>아웃 {game.outs}</span>
          <span className={styles.bases}>
            <span className={game.bases.first ? styles.baseOn : undefined}>1</span>
            <span className={game.bases.second ? styles.baseOn : undefined}>2</span>
            <span className={game.bases.third ? styles.baseOn : undefined}>3</span>
          </span>
          <span className={styles.score}>
            {game.ourScore} : {game.opponentScore}
          </span>
        </div>

        {isMenuOpen ? (
          <InGameMenu
            mode={options.mode}
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
            autoProgressCost={autoProgressCostOf(options.mode)}
            canAutoProgress={canAutoProgress(progress)}
            gamePoint={gamePoint}
            onAutoProgress={
              onSpendGamePoint === undefined
                ? undefined
                : (cost) => {
                    onSpendGamePoint(cost)
                    actions.autoProgress()
                    menu.close()
                  }
            }
          />
        ) : overlay === '조작방법' ? (
          // 뷰어 동안은 메뉴를 띄웠을 때처럼 타석을 내려 둔다 — 다시 올리면 타석이 새로 서며 굴림이 샌다
          null
        ) : isChangingPitcher ? (
          <PitcherChangeWindow
            entry={progress.ourPitcherEntry}
            currentIndex={progress.ourPitcherIndex}
            benchIndexes={session.benchPitchers}
            abilitiesOf={(index) => substitutionDetailAbilities(progress, '투수', index)}
            onSelect={(benchIndex) => {
              actions.changePitcher(benchIndex)
              setChangeWindow(null)
            }}
          />
        ) : changeWindow === '대타' ? (
          <PinchHitWindow
            entry={progress.ourEntry}
            currentSlot={game.battingOrderIndex}
            benchIndexes={session.benchBatters}
            abilitiesOf={(index) => substitutionDetailAbilities(progress, '대타', index)}
            onSelect={(benchIndex) => {
              actions.pinchHit(benchIndex)
              setChangeWindow(null)
            }}
          />
        ) : canBat ? (
          // 0xe 에서 화면을 누르면 OK 로 본다 (터치용 웹판 편의 — 캔버스 탭이 스윙인 것과 같은 자리)
          <div className={styles.stageArea} onClick={sceneConfirm.acceptsConfirm ? sceneConfirm.confirm : undefined}>
            <Panel heading="타석" />
            <div className={styles.matchupFrame}>
            <BattingStage
              batterAbility={currentBatterAbility(progress)}
              // 마타자가 대타로 올라오면 필살 연출 점프표(0xd01e4)가 이 순번을 본다
              aceBatterIndex={currentBatterEntry(progress)?.aceIndex ?? -1}
              // 번트 '7'/'8'/'9' — 0x535a4 → 0x6a7 → 0x51e48 은 모드를 안 본다. 마타자(0xb633c)면 위젯이 거른다
              canBunt
              // 팀 경기(모드 1·2·8·9)는 판정 묶음 '일반' — "내 선수" 보너스(모드 3·4)도 타자 미션 +100(모드 6)도 없다 (0xab214)
              swingMode="일반"
              // 타순 칸별 이 경기 남은 필살 횟수 s8 팀[+0x29 + 타순] (0xaea30) — 진행기가 든다. 0xaebe4 처럼 칸이 비면
              // 그 타자로 채운 값이다: 마타자 0xd84fa[레벨], 그 밖은 +0x18 == 0 이라 0 ('0' 키 무시, 0x51e14)
              specialSwingRemaining={specialSwingRemainingAt(progress, '우리')}
              onSpecialSwingUsed={(remaining) => actions.specialSwingUsed(remaining)}
              // ⚠️ 미해결: `batterSkillIds` 를 안 넘긴다 — 팀 경기 명단(`TeamEntryBatter`)·로스터 표에 선수 스킬 비트(+0x14)가
              //    없다. 그래서 실투 판정 0x33cbc 의 타자 비트 22 압도(+5)와 0xa5e14 의 압도 ×2 가 늘 거짓이다
              gameMode={options.mode}
              // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
              isScoreboardOn={settings?.isScoreboardOn}
              // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
              isVibrationOn={settings?.isVibrationOn}
              pitcherAbility={currentPitcherAbility(progress)}
              hud={{
                inning: game.inning,
                half: game.half,
                ourScore: game.ourScore,
                opponentScore: game.opponentScore,
                balls: progress.atBat.balls,
                strikes: progress.atBat.strikes,
                outs: game.outs,
                bases: game.bases,
                ourLogoUrl: smallLogoUrlOf(options.ourTeamId),
                opponentLogoUrl: smallLogoUrlOf(options.opponentTeamId),
                ourTeamId: options.ourTeamId,
                opponentTeamId: options.opponentTeamId,
              }}
              isEagleEyeEnabled={false}
              // 상대 팀 마투수(0xb88c8)가 교체로 올라오면 그림도 마선수 것이다
              acePitcher={
                opposingAcePitcher === null
                  ? null
                  : {
                      framesUrl: opposingAcePitcher.framesUrl,
                      frameCount: opposingAcePitcher.frameCount,
                      stillUrl: opposingAcePitcher.stillUrl,
                    }
              }
              // 시즌 홈경기에서만 차 있다 — 차 있으면 배경이 시즌 구장(0x77494)으로 갈린다
              seasonStadium={seasonStadium}
              // 상대 마투수의 마구 횟수 0xd8509[mgr[0x13a + 순번]] (0xaebe4) — 전역 마선수 레벨 칸
              aceLevels={options.aceLevels}
              // 상대 팀+0x28 과 공+0x10 은 진행기가 든다 — 공 객체는 경기에 하나라 사람 투구와 칸을 함께 쓴다
              cpuMagic={opponentMagicStateOf(progress)}
              // 0xe 에서는 공이 안 나간다 — 타석 장면(0xd 그리기)만 선다
              isPaused={visibleBurstLines !== null || isAwaitingConfirm}
              random={random}
              onPitchResolved={(detail, _pitch, isUncatchable, buntKind) =>
                actions.resolvePitch(detail, isUncatchable, buntKind)
              }
              flightProbeRef={flightProbeRef}
              // CPU 투수 견제 (0x345fc 종류 4 → 0x34848 → 메시지 0x10) — 루가 정해진 뒤는 진행기가 판을 돌린다
              onPickoff={(base) => actions.cpuPickoff(base)}
            />
            {/* 0xe 그리기 0x4d9ec — 타석 장면 위에 투수·타자 소개 판 0x44944 */}
            {isMatchupShown && matchupCards}
            </div>
            <Hint>
              {(game.battingOrderIndex % 9) + 1}번 {currentBatterEntry(progress)?.name ?? '타자'} ·
              탭·Space·5 스윙 · ←→(4·6) 타자 이동
              {(currentBatterEntry(progress)?.aceIndex ?? -1) < 0 && ' · 8·7·9(Shift)·길게 눌러 번트'}
              {isStealable.includes(1) && ' · 3 도루(1루)'}
              {isStealable.includes(2) && ' · 2 도루(2루)'}
              {isStealable.includes(3) && ' · 1 도루(3루)'}
            </Hint>
          </div>
        ) : canPitch ? (
          <>
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
                style={{ width: `${staminaPercent}%` }}
                data-low={staminaPercent <= 20}
              />
            </div>

            {/*
              0xe — 구질 고르기(0xf)는 OK 뒤다. 그 동안은 투수·타자 소개 판 0x44944 를 띄운다.
              ⚠️ 원본은 판 아래에 0xd 그리기(타석 장면)가 깔린다 — 웹 투구 화면에는 그 캔버스가 없어 판만 놓는다
            */}
            {isMatchupShown && <div className={styles.matchupFrame}>{matchupCards}</div>}
            {phase === '구질' && !isAwaitingConfirm && (
              <>
                <Panel heading="1. 구질 선택" />
                {(game.bases.first || game.bases.second || game.bases.third) && (
                  <Hint>견제 3·1·7 (1·2·3루)</Hint>
                )}
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

            {phase === '코스' && (
              <>
                <Panel heading={<>2. 코스 선택 — {slot?.name}</>} />
                <CourseGrid
                  selectedCell={courseCell}
                  onSelect={(cell) => {
                    setCourseCell(cell)
                    // 마구는 게이지를 쓰지 않고 등급이 늘 5 다 (0x3f500 의 `구질 != 22`)
                    if (options.gaugeSettingOn === true && slot?.isMagic !== true) {
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

            {phase === '게이지' && (
              <>
                <Panel heading="3. 투구 결정" />
                <PitchGradeGauge onPress={throwWith} />
              </>
            )}
          </>
        ) : (
          <Hint>자동 진행 중…</Hint>
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
            resolution !== null
              ? actions.closeBurst
              : () => setShownProposal(proposal?.index ?? null)
          }
        />
      )}

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

interface PitcherChangeWindowProps {
  readonly entry: readonly TeamEntryPitcher[]
  readonly currentIndex: number
  readonly benchIndexes: readonly number[]
  /** 그 명단 칸의 상세 창 능력치 네 칸 — `0xb6414(rec, 칸, 1)` (`substitutionDetailAbilities`) */
  readonly abilitiesOf: (index: number) => readonly [number, number, number, number] | null
  readonly onSelect: (benchIndex: number) => void
}

/**
 * **투수 교체 화면** — 원본 경기 상태 0xb (진입 0x3ae08 · 그리기 0x384b8, R4 1b).
 *
 * 원본은 192×210 창에 제목 "투수 교체"(img_text 150 "투수" + 299 "교체"), 그 아래 **현재 선수 칸** 하나와
 * **벤치 목록 6줄**을 놓고, 칸마다 딱지 **이름 · 보직 · 방어 · 삼진**(딱지 표 0xcfe7e = img_text 27·28·171·181 —
 * 두 글자 그림, S10 5절)을 적는다. 값은 방어율·탈삼진이다. OK 가 확정(상태 0x16 연출), '#'·CLR 이 취소(→ 0xe)다.
 *
 * ⚠️ **근사**: 웹 로스터에는 보직(`+0xb`)도 시즌 기록(방어율 0xb6ce8·탈삼진)도 없다 —
 * 대신 원본이 '0' 상세 창에만 적는 능력치(`0xb6414(rec, 칸, 1)` — 마선수 레벨 배율 포함,
 * `substitutionDetailAbilities`)를 목록 줄에 붙여 적는다. 창 배치도 웹 껍데기 그대로다.
 */
function PitcherChangeWindow({
  entry,
  currentIndex,
  benchIndexes,
  abilitiesOf,
  onSelect,
}: PitcherChangeWindowProps) {
  const describe = (index: number) => {
    const player = entry[index]
    const ability = abilitiesOf(index)
    if (player === undefined || ability === null) return { label: `${index + 1}번`, detail: undefined }
    return {
      label: player.aceIndex >= 0 ? `${player.name} (마투수)` : player.name,
      detail: `제구 ${ability[0]} · 구속 ${ability[1]} · 체력 ${ability[3]}`,
    }
  }
  const current = describe(currentIndex)

  return (
    <>
      <Panel heading="투수 교체" />
      <Hint>
        지금 투수 — {current.label}
        {current.detail === undefined ? '' : ` (${current.detail})`}
      </Hint>
      {benchIndexes.length === 0 ? (
        <Hint>벤치에 남은 투수가 없습니다</Hint>
      ) : (
        <MenuList
          items={benchIndexes.map((index) => ({ id: String(index), ...describe(index) }))}
          onSelect={(id) => onSelect(Number(id))}
        />
      )}
      <Hint># · CLR 취소</Hint>
    </>
  )
}

interface PinchHitWindowProps {
  readonly entry: readonly TeamEntryBatter[]
  readonly currentSlot: number
  readonly benchIndexes: readonly number[]
  /** 그 명단 칸의 상세 창 능력치 네 칸 — `0xb6414(rec, 칸, 1)` (`substitutionDetailAbilities`) */
  readonly abilitiesOf: (index: number) => readonly [number, number, number, number] | null
  readonly onSelect: (benchIndex: number) => void
}

/**
 * **대타 화면** — 투수 교체와 **같은 경기 상태 0xb** 다 (진입 0x3ae08 · 그리기 0x384b8, R4 1b).
 * 원본은 같은 192×210 창에 제목만 **"타자 교체"**(img_text 149 "타자" + 299 "교체" — 규칙은 대타지만 화면 글자는
 * "타자", S10 4절 · 도움말 "타자 교체 : (#)")로 바꿔 그리고, 칸마다 딱지 **이름 · 보직 · 타율 · 홈런**
 * (0xcfe7e = img_text 27·28·172·61, S10 5절)을 적는다. 보직 칸은 수비 위치, 타율은 0xb8e3c(안타 +0x22 ×1000 /
 * 타수 +0x20, 1000 상한), 홈런은 레코드 +0x28 이다.
 *
 * ⚠️ **근사**: 웹 명단(`TeamEntryBatter`)에는 시즌 기록(타수·안타·홈런)이 없다 — 대신 원본이 '0' 상세 창에만 적는
 * 능력치(`0xb6414(rec, 칸, 1)`, `substitutionDetailAbilities`) 히트·파워·주루를 목록 줄에 붙여 적는다.
 * 창 배치도 웹 껍데기 그대로다.
 * 고른 선수는 **옛 타자의 수비 자리를 받고, 빠진 선수는 벤치에서 지워진다**(재출장 없음, 0xaebe4).
 */
function PinchHitWindow({ entry, currentSlot, benchIndexes, abilitiesOf, onSelect }: PinchHitWindowProps) {
  const describe = (index: number) => {
    const player = entry[index]
    const ability = abilitiesOf(index)
    if (player === undefined || ability === null) return { label: `${index + 1}번`, detail: undefined }
    return {
      label: player.aceIndex >= 0 ? `${player.name} (마타자)` : player.name,
      detail: `히트 ${ability[0]} · 파워 ${ability[1]} · 주루 ${ability[3]}`,
    }
  }
  const current = describe(currentSlot)

  return (
    <>
      <Panel heading="타자 교체" />
      <Hint>
        지금 타자 — {current.label}
        {current.detail === undefined ? '' : ` (${current.detail})`}
      </Hint>
      {benchIndexes.length === 0 ? (
        <Hint>벤치에 남은 타자가 없습니다</Hint>
      ) : (
        <MenuList
          items={benchIndexes.map((index) => ({ id: String(index), ...describe(index) }))}
          onSelect={(id) => onSelect(Number(id))}
        />
      )}
      <Hint># · CLR 취소</Hint>
    </>
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

function summaryEntries(summary: TeamGameSummary): StatEntry[] {
  const outs = summary.pitching.outsRecorded
  return [
    { label: '이닝', value: `${Math.trunc(outs / 3)}${['', '⅓', '⅔'][outs % 3]}` },
    { label: '피안타', value: String(summary.pitching.hitsAllowed) },
    { label: '볼넷', value: String(summary.pitching.walksAllowed) },
    { label: '실점', value: String(summary.pitching.runsAllowed) },
  ]
}

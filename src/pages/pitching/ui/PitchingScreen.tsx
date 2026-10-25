import { useEffect, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import type { MutableRefObject } from 'react'
import { RawScreen } from '@/shared/ui'
import { MissionHud } from '@/pages/mission-play/ui/MissionHud'
import { PressArea } from '@/shared/ui'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import { MENU_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { PitchSlotPicker } from '@/pages/pitching/ui/PitchSlotPicker'
import type { PitchSlotChoice } from '@/pages/pitching/ui/PitchSlotPicker'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { AimDirection } from '@/features/play-pitcher-game/model/pitchAim'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { MissionResultBoard } from '@/pages/mission-play/ui/MissionResultBoard'
import type { MissionResultBoardProps } from '@/pages/mission-play/ui/MissionResultBoard'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuOpenOnHide, useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { cpuSideOf, humanSideOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import { PitcherSideStage } from '@/widgets/batting-stage/ui/PitcherSideStage'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { passesHeldResult, pitchSceneBusyTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { usePitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { useSkillCheerRestore } from '@/widgets/batting-stage/model/useSkillCheerRestore'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { MAGIC_TYPE_NUMBER } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { usePickoffTouchKeys } from '@/features/defense-play/model/pickoffTouchKeys'
import { publishScenePeek } from '@/shared/lib/scenePeek/scenePeek'

/**
 * 투수 미션 타석 장면(`PitcherSideStage`)의 재료 — 세션이 든 마지막 공과 마운드 · 타석 그림 값.
 * 미션 장면도 경기 장면 0x104 라 같은 그리기 표 0xd05a0 을 탄다. 구장은 생성자 값 0(모드 5 는 셋업 0x39fdc 가 안 채운다).
 */
export interface PitchingStageSource {
  readonly lastThrow: {
    readonly pitch: Pitch
    readonly resolution: PitchResolution
    readonly resultTicks: number
    /** CPU 타자의 스윙 프레임 · 번트 종류 (휘두르지 않았으면 null) */
    readonly cpuSwing?: CpuSwingPose | null
    /** 공 도착 0x3dfac 의 낫아웃 갈래(3e0aa)가 판정 칸을 지웠나 — 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다 */
    readonly judgementCleared?: boolean
  } | null
  readonly pitcherForm: number
  readonly pitcherHand: number
  /** 미션 투수 장비 겹 (0x10810 → 0x79790) — 없으면 맨몸 */
  readonly pitcherEquipment?: PitcherEquipment
  /** 미션 투수 피부 `(rec[0xb] >> 2) & 3` — 마운드 바탕 벌 = 피부 × 15 + 사람 칸 팀(0x47cc8 482c0~482fc → 0x793b0 의 794c2) */
  readonly pitcherSkinIndex?: number
  readonly batterForm: number
  /** 타자 손 0xb63c0 — 마타자는 표 0xd88b0. 없으면 폼의 낮은 비트 */
  readonly batterSide?: number
  /** 마타자 순번 0xb63a0 (0~4) — 마타자 그림 `ace/batter_*`(0x78ab0) · 자세표(0xb905c). 없으면 일반 타자 */
  readonly aceBatterOrder?: number
  /** 지금 타자 레코드의 장비 겹 (타석 교대 0x47cc8 47e80 → 0x78fd8) — 없으면 맨몸 */
  readonly batterEquipment?: BatterEquipment
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  /** 마운드 미션 투수의 체력% (0xaebb1 — +0x2c ÷ 100). 지친 표시 0x38d1c(player_effect 애니 9 · 10)를 고른다. 안 주면 안 그린다 */
  readonly pitcherStaminaPercent?: number
  /**
   * 경기 스킬 표시 판 재료 — 지금 CPU 타자 · 미션 투수 레코드 · 공격 측 st[9] (`missionPitchingSkillPanelOf`). 0xd 진입 열쇠는 이 화면의
   * 0xe 대기(`sceneConfirm`), 장면 칸은 `skillPanelScene`. 없으면 판을 안 그린다
   */
  readonly skillPanel?: {
    readonly attackSide: number
    readonly batterSkillIds: readonly number[]
    readonly batterRecordSlot: number
    readonly pitcherSkillIds: readonly number[]
    readonly recentAtBatCodes: readonly number[]
  }
  /**
   * CPU 타자가 맞힌 마지막 공의 0x11 끝 · 0x13 재료 (`usePitcherHitScene`) — 장면이 그리고 0x17 이 선 틀에 `onHitSceneEnd` 를 부른다.
   * 그동안 부르는 쪽은 수비 판을 안 띄운다
   */
  readonly hitScene?: PitcherHitScene | null
  readonly onHitSceneEnd?: () => void
  /**
   * 판(맞은 공 · 공 도착 판)이 섰지만 아직 0x17 전 — 장면이 0x11 끝 · 0x13 · 0x12 틱 0 을 그리는 동안. 원본은 그동안 상태 0x11 · 0x12 ·
   * 0x13 이라 구질 키 · 견제 · 0xe 의 OK 를 안 받는다('*' 는 0xd~0x15 라 받는다)
   */
  readonly isBeforePlay?: boolean
}

/**
 * 투구 화면. 원본 경기 상태 셋을 그대로 따른다 (나리 투수편 `PitcherGameScreen` 과 같다):
 *   0xf 구질 — 칸마다 정해진 키, 틱 8 뒤 넘김 (`PitchSlotPicker`)
 *   0x10 조준 — 방향키로 흐르는 조준점, OK 확정 · CLR 은 0xf 로 (`AimCursor`). 투수 미션은 매 틱 흔들린다(0x39c5c)
 *   0x11 게이지 — OK 로 칸을 정하고 틱 10 에 놓는다 (`PitchGradeGauge`)
 *
 * 게이지가 넘겨 주는 것은 **누른 칸 g(0~9)** 하나다 — 원본에는 PERFECT/GOOD/BAD 라는
 * 글자도 판정도 없다 (S5 U-15 확정, 누름 0x50e08). 등급 t = max(g−4, 1) 은 부르는 쪽
 * (`pitcherPitch.pitchGradeOf`)이 원본 자리에서 뽑는다. 나리 투수편 `PitcherGameScreen` 과 같다.
 *
 * 기록 달성 알림 0x4e35c 는 붙이지 않는다 — 프레임 0x52c50 이 미션(모드 5·6)에서도 부르지만 지급 0xa77f0 이
 * a780a(`state[1] ∈ {5,6,7}` → 끝)에서 막아 줄도 G 누계도 늘 비어 있다(R8 1절) → 원본도 판이 안 선다.
 */
type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 덮는 하위 화면 — 경기 중 메뉴가 연다 */
type MenuOverlay = '조작방법' | '설정'
/**
 * 미션 투수편 = 원본 전역 모드 **5** (XlsPITCHER_MISSION, Q2-mission-rewards 1-0) — 경기 중 메뉴 표 0xcfcfc 의 **행 1**
 * (모드 5~7 → 1: 자동진행 자리에 다시하기). 미션 장면도 경기 장면 0x104 라 '*' 가 같은 메뉴를 연다.
 */
const MISSION_PITCHER_MODE = 5
/** `team_logo_ini` 작은 로고 — 팀 경기 · 타자편 화면과 같은 경로 */
const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

interface PitchingScreenProps {
  readonly run: PitcherRun
  readonly repertoire: readonly PitchTypeInfo[]
  /**
   * `repertoire` 항목마다 구질 칸 번호 0~5 (0xb6d2c, `modePitchSlotNumbersOf`) — 구질 키 0x534d8 이 이 칸을 고른다.
   * 안 넘기면 항목 차례를 칸으로 본다.
   */
  readonly repertoireSlots?: readonly number[]
  /** 환경설정 [투구] 가 게이지일 때만 3단계 게이지가 뜬다 (설정 +0x2d, 0x3f500) */
  readonly usesGauge: boolean
  readonly atBat: AtBatState
  readonly bannerText: string
  /**
   * 이 판의 **남은 마구 횟수** = 팀+0x28 (0xaea10). `isMagicType` 과 함께 넘기면 마구 칸을 원본처럼 막는다:
   * 키 '0' → 메시지 7 → 0x50da8 이 `구질 == 22` 면 `0xaea10 > 0` 일 때만 받고(0x50db8 `bgt`), 아니면 그대로
   * 빠진다(0x523aa) — 구질이 안 바뀌고 다음 단계로도 안 간다. 안 넘기면 막지 않는다.
   */
  readonly magicRemaining?: number
  /** 메뉴 항목이 마구 칸(구질 22)인가 — 구질 표 `PitchTypeInfo` 에 마구 자리가 없어 부르는 쪽이 가른다 */
  readonly isMagicType?: (type: PitchTypeInfo) => boolean
  /**
   * 던진다. `gaugeCell` 은 게이지에서 **누른 칸 0~9**(안 눌렀거나 게이지를 안 쓰면 0),
   * `gaugeSettingOn` 은 환경설정 [투구]가 게이지인가다 — 꺼져 있으면 원본이 제구·체력
   * 확률표 0xd896c 로 등급을 뽑는다 (0x4dbac).
   */
  readonly onThrow: (
    type: PitchTypeInfo,
    /** 0x10 에서 확정한 조준점 x · y · z (0x4dc78 이 그대로 목표로 쓴다) */
    aim: WorldPoint,
    gaugeCell: number,
    gaugeSettingOn: boolean,
  ) => void
  /** 조준점의 존 중심 칸(0xcfbcc) — 세션이 공을 만들 때 쓰는 side 와 같다. 기본 1 */
  readonly aimSide?: number
  /**
   * 0x10 의 틱 하나(0x39c5c) — 투수 미션은 세션이 경기 난수로 흔들림까지 넣는다(`useMissionSession.aimTick`).
   * 안 넘기면 걸음 · 자르기만 한다
   */
  readonly onAimTick?: (aim: WorldPoint, direction: AimDirection) => WorldPoint
  /** 조준(0x10)의 CLR — 0xf 진입 0x3d954 를 다시 돌린다(`useMissionSession.returnToPitchSelection`) */
  readonly onReturnToPitchSelection?: () => void
  /** 경기 중 메뉴 **"나가기"** (표 0xcfcfc 행 1 칸 4 — StrGAME[0]/[1] 확인 뒤 0x22 → 0x40140) */
  readonly onGiveUp: () => void
  /** 결과 판에서 미션 목록으로(0x140006c = 1) — 마선수 대결이면 대결 끝 */
  readonly onFinish: () => void
  /**
   * 결과 판에서 "예"(0x140006c = 3) — 같은 미션을 곧바로 다시. 안 넘기면 `onFinish` 와 같다.
   * 마선수 대결(`resultBoard.aceMatch`)은 어느 키든 `onFinish` 다.
   */
  readonly onRetry?: () => void
  /** 결과 판 0x4a384(모드 5·6) 의 값 — 번 G [+0x17f4] · 보유 G g[0x64] · 마선수 대결 칸 */
  readonly resultBoard?: Pick<MissionResultBoardProps, 'earnedGamePoint' | 'heldGamePoint' | 'aceMatch'>
  /**
   * 경기 중 메뉴 **"다시하기"** (표 0xcfcfc 행 1 · StrGAME[7], `0x3c706`) — 미션·홈런더비 행만 자동진행 자리에 이 칸이 온다.
   * 안 넘기면 칸이 잠긴다.
   */
  readonly onRestart?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * **사람 견제 키** — 구질 고르기(상태 0xf)에서 누른 키를 그대로 넘긴다. '3' 1루 · '1' 2루 · '7' 3루 (0x53548 → 메시지 0x10).
   * 원본 0x53580 은 수비면 구질 0x534d8 뒤에 견제 0x53548 을 늘 이어 부른다 — 모드 5(투수 미션)도 막지 않는다.
   * 코스·게이지 단계는 원본도 다른 상태(0x10·0x11)라 받지 않는다. 그 루에 주자가 없으면 부르는 쪽이 키를 먹고 끝낸다.
   * 안 넘기면 견제 키가 없다.
   */
  readonly onPickoffKey?: (key: string) => void
  /**
   * **상태 0xe 의 OK 대기** — 세션이 새 타석마다 싣는다 (`useMissionSession.sceneConfirm`). 안 넘기면 기다리지 않는다
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  /** 0xe 의 OK 하나를 받을 때마다 — 세션이 0xf 진입(CPU 대타 0xac228)을 이때 묻는다 (`useMissionSession.confirmScene`) */
  readonly onSceneConfirm?: () => void
  /**
   * **교체 연출 0x16** — 서 있으면 "CHANGE" 애니(0x4da30)를 그리고 0xe 대기를 세지 않는다. 다 그리면 `onSubstitutionSceneDone`.
   */
  readonly substitutionScene?: SubstitutionScene | null
  readonly onSubstitutionSceneDone?: () => void
  /** 하늘 줄 — 구장 +0x10 (0x783b0). 미션은 장면마다 한 번 굴린 rand(0, 6) — 세션이 든다. 안 넘기면 타석 그림이 굴린다 */
  readonly skyRow?: number
  /**
   * **경기 난수** — 결과 판(경기 상태 0x19)의 배경 · 정산 효과(0x4ea0c 꼬리: 성공이면 밤하늘일 때 불꽃, 실패면 비)와 그림마다
   * 효과 · 파티클 틱이 쓴다. 안 넘기면 결과 판에 배경 · 효과가 없다.
   */
  readonly random?: RandomPort
  /**
   * 일시정지 팝업 0x741a0(메뉴 · 조작방법 · 설정)이 떠 있는지 바뀔 때마다 — 그동안 0x12 상태 틱이 멈춘다(0x52cc6).
   * 밀어내기 판의 0x1f 틱 대기(`useFreePassPlayStart`)를 든 쪽(MissionRoutes)이 받는다
   */
  readonly onPopupFrozenChange?: (isFrozen: boolean) => void
  /** 타석 장면 재료 — 있으면 구질 · 조준 · 게이지 위에 캔버스 장면을 깐다(소개 판 · "CHANGE" 는 그 위). 없으면 예전 패널만 */
  readonly stage?: PitchingStageSource
  /**
   * 상태 0xe 소개 판 0x44944 의 값 — 부르는 쪽(미션 라우트)이 지금 투수 · 타자 레코드로 만든다
   * (`pages/mission-play/lib/missionMatchupCards`). 안 넘기면 팀 글자만 그린다
   */
  readonly matchupCards?: {
    readonly batterHand: number
    readonly pitcher: MatchupPitcherCard
    readonly batter: MatchupBatterCard
  }
  /**
   * st[0x15 + i] — 이번 공에 CPU 가 도루를 출발시킨 주자의 루(세션 `pitcherStealDisplay`, 0x520de → 0xa9bd4). 그 주자는 루에 안
   * 그린다(0x35b94 의 주자 그리기가 같은 칸을 본다 — 타자 미션 화면과 같다). 0xf 진입 · 타구 판 시작이 지운다.
   * 세션은 같은 타석 다음 공의 0xf 진입을 공을 먹인 걸음에 바로 적으므로(`selectionEntered`), 공이 날거나 0x12 인 동안은 계속 숨긴다
   */
  readonly stealDisplay?: { readonly bases: readonly number[]; readonly selectionEntered: boolean } | null
  /** 경기 스킬 표시 판의 장면 칸(함성 비트 칸 skin+0x44c · 애니 7 · 8) — 미션 장면 수명. 안 주면 이 화면이 사는 동안만 */
  readonly skillPanelScene?: MutableRefObject<SkillPanelScene>
}

export function PitchingScreen({
  run,
  matchupCards: matchupCardValues,
  repertoire,
  repertoireSlots,
  usesGauge,
  atBat,
  bannerText,
  magicRemaining,
  isMagicType,
  onThrow,
  aimSide = 1,
  onAimTick,
  onReturnToPitchSelection,
  onGiveUp,
  onFinish,
  onRetry,
  resultBoard,
  onPickoffKey,
  sceneConfirm: sceneConfirmWait,
  onSceneConfirm,
  substitutionScene = null,
  onSubstitutionSceneDone,
  skyRow,
  random,
  onPopupFrozenChange,
  onRestart,
  settings,
  onSettingsChange,
  stage,
  stealDisplay = null,
  skillPanelScene,
}: PitchingScreenProps) {
  // 교체 연출 0x16 진입 0x3d458 의 CPU 대타 가지 0x668cc (`SubstitutionScene.cheerRestore`)
  useSkillCheerRestore(substitutionScene, skillPanelScene)
  /**
   * 전역 경기 상태 +0x6b (`liveGameState`) — 미션 준비 0xaa57c 가 0xb6814 로 0 을 둔 뒤(0xaa5fc) 곧바로 0xaa698 이
   * `min(레코드 +3 아래 4비트, 0x63)` = 시작 이닝 인덱스를 쓴다(`start.inning` − 1). 재도전 · 다시하기도 같은 준비를 다시 돈다.
   * 미션 경기 안의 이닝 넘김(0xb6b6c)은 판의 이닝 칸 `run.game.inning` 이 따라간다(`flipMissionHalf` · 자동진행 중계 틱의 st[0x6b]) —
   * 이 효과가 바뀔 때마다 전역 칸에 다시 싣는다.
   */
  const missionInningIndex = run.game.inning
  useEffect(() => {
    setLiveGameInningIndex(missionInningIndex)
  }, [run.mission, missionInningIndex])

  const [phase, setPhase] = useState<PitchPhase>('구질')
  /** 구질 · 조준 · 게이지 그림 재료 — 장면이 그 위에 그린다 (0x4c4bc · 0x4d780 · 0x4d2ac) */
  const inputOverlayRef = usePitchInputOverlayRef()
  const [pitchType, setPitchType] = useState<PitchTypeInfo | null>(null)
  /** 0x10 에서 확정한 조준점 — 게이지(0x11) 뒤 놓을 때 쓴다 */
  const [aim, setAim] = useState<WorldPoint | null>(null)
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  /** 일시정지 팝업(0x741a0)이 떠 있는가 — 경기 중 메뉴 또는 그 하위 [조작방법] 뷰어. 경기 키가 안 간다 */
  const isPopupOpen = isMenuOpen || overlay !== null
  useEffect(() => {
    onPopupFrozenChange?.(isPopupOpen)
  }, [isPopupOpen, onPopupFrozenChange])
  const isRunning = run.status === '진행중'
  /**
   * 공이 날거나 0x12 인 동안 남은 틱 — 원본은 그동안 상태 0x11 · 0x12 라 다음 공의 구질 키 · 견제 · 0xe 의 OK 를 안 받는다.
   * 세션은 놓는 순간 판정까지 내므로 놓은 뒤 남은 비행 + 0x12 대기를 센다 (`pitchSceneBusyTicksOf`). 장면이 없으면 0
   */
  const lastThrow = stage?.lastThrow ?? null
  const [busyTicks, setBusyTicks] = useState(0)
  const [busyThrow, setBusyThrow] = useState(lastThrow)
  if (busyThrow !== lastThrow) {
    setBusyThrow(lastThrow)
    setBusyTicks(
      lastThrow !== null && passesHeldResult(lastThrow.resolution)
        ? pitchSceneBusyTicksOf(lastThrow.pitch.frameCount, lastThrow.resultTicks)
        : 0,
    )
  }
  useSceneTick(() => setBusyTicks((left) => Math.max(0, left - 1)), busyTicks > 0 && !isPopupOpen)
  // 판이 섰지만 아직 0x17 전(0x11 끝 · 0x13 · 공 도착 판의 0x12 틱 0)도 0x11 · 0x12 · 0x13 이다
  const isPitchSceneBusy = busyTicks > 0 || stage?.isBeforePlay === true
  // 결과 배경 캔버스의 난수 — 하늘 줄은 세션이 장면마다 한 번 굴린 `skyRow` 를 넘기므로 여기서 굴리지 않는다(넘기지 않은
  // 화면만 이 따로 든 난수로 굴린다 — 경기 난수에 새지 않게)
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /** 정산 효과 층(비 · 파티클) — 결과 배경 타석 캔버스와 미션 결과 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()

  /**
   * 원본 공용 키 처리 `0x498d4` 의 '\*'(소프트키1 −6 도 '\*' 로 읽는다, 498e8) — 경기 상태 0xd~0x15 면 경기 중 메뉴를 연다.
   * 미션 장면도 같은 경기 장면 0x104 라 그대로다. 결과 화면(끝난 미션)에서는 안 열린다.
   */
  // 단말 일시정지 0x463ac — '*' 가 받는 때이고 하위 창이 없으면 같은 메뉴를 연다
  useInGameMenuOpenOnHide(menu, isRunning && overlay === null)
  useEffect(() => {
    if (!isRunning) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      event.preventDefault()
      menu.pressStar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRunning, menu.pressStar, overlay])
  /**
   * **상태 0xe — 새 타석마다 사람 OK 를 기다린다** (0x39e14 → 0x532b0 — 공수·모드 갈림 없음). 결과 연출 동안은 받지 않는다.
   * 0xe 그리기 0x4d9ec 가 0xd 그리기 위에 얹는 소개 판 0x44944 는 아래 `SceneMatchupCards` 가 그린다.
   */
  // 교체 연출 0x16 동안은 0xd · 0xe 가 아니다 — 연출이 끝난 뒤부터 0xd 두 그림을 센다
  const sceneConfirm = useSceneConfirm(
    sceneConfirmWait,
    isRunning && bannerText === '' && !isPopupOpen && substitutionScene === null && !isPitchSceneBusy,
    onSceneConfirm,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && run.status === '진행중'

  // 견제 — 구질 고르기(0xf)에서만. 끝난 미션(결과 화면)·0xe(OK 대기)는 키를 안 받는다
  const acceptsPickoff =
    onPickoffKey !== undefined &&
    phase === '구질' &&
    isRunning &&
    !isAwaitingConfirm &&
    !isPopupOpen &&
    !isPitchSceneBusy
  useEffect(() => {
    if (!acceptsPickoff || onPickoffKey === undefined) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 견제 키 0x53548 — 다음 틀의 키 0x498d4 가 0xf 갱신보다 먼저 처리한다(구질 고르기 `PitchSlotPicker` 의 키 칸에 든다)
      const { key } = event
      pushSceneKey(() => onPickoffKey(key))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsPickoff, onPickoffKey])
  // 터치 기기 — 주자가 있는 루마다 "N루 견제" 상황 버튼(같은 키 사건을 쏜다)
  usePickoffTouchKeys(acceptsPickoff, run.bases)

  const teamIds = missionTeamIdsOf(run)

  // 장면 바로가기 · e2e 가 기다릴 자리(웹 개발 도구 — `shared/lib/scenePeek`). 스위치는 그 자리에 둬야 배포 빌드에서 접힌다
  const peekPitchSlotPicker = isRunning && !isPopupOpen && phase === '구질' && !isAwaitingConfirm && !isPitchSceneBusy
  const peekResultShown = !isRunning
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'e2e')) return
    publishScenePeek('mission', {
      side: '투수', isAwaitingConfirm, isPitchSlotPickerShown: peekPitchSlotPicker, isResultShown: peekResultShown,
    })
  }, [isAwaitingConfirm, peekPitchSlotPicker, peekResultShown])
  useEffect(() => () => {
    if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') publishScenePeek('mission', null)
  }, [])

  if (run.status !== '진행중') {
    // [미션+0xbc] — 0x4ea0c 4ef2a · 0x4a384 4a3ea 의 "이겼나"
    const isSuccess = run.status === '성공'
    return (
      <RawScreen>
        {/*
          경기 상태 0x19 — 미션 결과 판 0x4a384(모드 5·6) · 키 0x407f0. 0x4a384 는 HUD(0x373d0 — 그 꼬리가 미션 판 0x36714)를
          안 그리므로 목표 판도 없다. 웹 제목줄도 원본에 없다
        */}
        <div className={styles.matchupFrame}>
          {/*
            0x4a384 머리 — 모드를 안 가리고 구름 0x78448 · 배경 0x40ff0(+0x17e2)을 먼저 그린다(선수 · 공 · HUD 없음). 갱신 0x4b100 은
            모드 5·6 이면 r7 = [미션+0xbc] — 성공한 판만 구장이 틱마다 3 씩 가라앉는다. 정산 효과 0x4ea0c 꼬리(4f41a~)는 경기 난수로
          */}
          {random !== undefined && (
            <BattingStage
              skyRow={skyRow}
              // 결과 배경은 선수·공을 안 그려 능력치를 읽지 않는다 — 꼴을 채우는 기본값
              batterAbility={STARTING_ABILITY}
              pitcherAbility={DEFAULT_PITCHER_ABILITY}
              swingMode="일반"
              gameMode={MISSION_PITCHER_MODE}
              isEagleEyeEnabled={false}
              hud={null}
              acePitcher={null}
              isPaused
              isResultBackdrop
              resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isSuccess)}
              random={backdropRandom}
              settlement={{
                isWin: isSuccess,
                // 경기 상태 두 측 점수 0xb69b0 — 허용 실점 · 자동진행 반 이닝 득점이 모두 든 경기 칸(`run.game.scores`). 차이만 쓴다
                side0Score: run.game.scores[0],
                side1Score: run.game.scores[1],
                // 하늘 칸 — 경기 이닝 st[0x6b]
                inning: run.game.inning + 1,
                random,
                layers: settlementLayers,
              }}
              onPitchResolved={() => {}}
            />
          )}
          <MissionResultBoard
            isSuccess={isSuccess}
            {...(random === undefined ? {} : { effectLayers: settlementLayers })}
            earnedGamePoint={resultBoard?.earnedGamePoint ?? 0}
            {...(resultBoard?.heldGamePoint === undefined ? {} : { heldGamePoint: resultBoard.heldGamePoint })}
            {...(resultBoard?.aceMatch === undefined ? {} : { aceMatch: resultBoard.aceMatch })}
            onExit={(exit) => {
              if (resultBoard?.aceMatch === undefined && exit === '다시' && onRetry !== undefined) onRetry()
              else onFinish()
            }}
          />
        </div>
      </RawScreen>
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

  /** 이 공이 게이지를 쓰는가 (`0x3f500` — 게이지 켬 ∧ 마구 아님). 안 써도 0x11 은 지나 틱 10 에 놓는다 */
  const showsGauge = usesGauge && pitchType !== null && isMagicType?.(pitchType) !== true

  /** 게이지가 놓을 때(틱 10) 정한 칸 g 를 그대로 넘긴다 (0x50e08 — 못 정했으면 0) */
  const throwPitch = (gaugeCell: number) => {
    if (pitchType === null || aim === null) return
    onThrow(pitchType, aim, showsGauge ? gaugeCell : 0, showsGauge)
    setPhase('구질')
    setPitchType(null)
    setAim(null)
  }

  /** 마구 칸인데 남은 횟수가 0 이하 — 0x50db8 이 키를 버린다 */
  const isBlockedMagic = (type: PitchTypeInfo): boolean =>
    magicRemaining !== undefined && isMagicType?.(type) === true && magicRemaining <= 0

  /** 구질 번호 t (이름표 칸 + 1, 마구 22) — 장면 위 그림 재료 */
  const typeNumberOf = (type: PitchTypeInfo | null): number => {
    if (type === null) return 0
    if (isMagicType?.(type) === true) return MAGIC_TYPE_NUMBER
    return PITCH_TYPES.findIndex((candidate) => candidate === type || candidate.name === type.name) + 1
  }
  const slotTypeNumbers = [0, 0, 0, 0, 0, 0]
  repertoire.forEach((type, index) => {
    const slot = repertoireSlots?.[index] ?? index
    if (slot >= 0 && slot < slotTypeNumbers.length) slotTypeNumbers[slot] = typeNumberOf(type)
  })

  const slotChoices: PitchSlotChoice[] = repertoire.map((type, index) => ({
    slot: repertoireSlots?.[index] ?? index,
    name: type.name,
    detail:
      isMagicType?.(type) === true && magicRemaining !== undefined
        ? `마구 · 남은 ${magicRemaining}회${magicRemaining <= 0 ? ' (못 던짐)' : ''}`
        : `구속 ${Math.round(type.speed * 100)} · 변화 ${Math.round(
            (Math.abs(type.horizontalBreak) + Math.abs(type.verticalBreak)) * 100,
          )}`,
    isBlocked: isBlockedMagic(type),
  }))

  /** 장면 배치 — 타자 손(0xb63c0). 구질 목록 누름 칸이 투수 앵커 0xcfb18[이 값] 둘레에 선다 (`PitcherSideStage` 와 같은 값) */
  const stageSide = stage === undefined ? 1 : (stage.batterSide ?? stage.batterForm & 1)
  /** 0xf 구질 목록이 실린 동안 — 빛 지도(4c5a6)가 HUD 까지 어둡게 한다 */
  const isPitchMenuShown = phase === '구질' && !isAwaitingConfirm && !isPitchSceneBusy

  return (
    <div className={styles.frame}>
    {/*
      원본은 240×320 경기 장면 한 장이다 — 웹 제목줄 · 남은 시간 배지 · 소프트키 막대 · 카운트 글자는 없다(카운트는 장면 HUD 0x373d0).
      목표는 HUD 꼬리의 미션 판 0x36714 가 장면 오른쪽 위에 그린다(`MissionGoalPanel`). 마우스 길은 장면 그림 자리의 투명한 누름 칸이다
    */}
    <RawScreen>
        {(() => {
          const substitutionOverlay = isRunning && substitutionScene !== null && (
            <SubstitutionSceneOverlay
              key={substitutionScene.serial}
              aceSlot={substitutionScene.aceSlot ?? null}
              onDone={() => onSubstitutionSceneDone?.()}
            />
          )
          // 일시정지 창 아래에도 남는다 — 0x52efe 가 장면 그리기를 건너뛰어 마지막 그림(소개 판 포함)이 그대로다
          const matchupCards = isAwaitingConfirm && sceneConfirm.isInConfirmState && (
            <SceneMatchupCards
              {...(matchupCardValues ?? { batterHand: 0, pitcher: { isComputer: false }, batter: { isComputer: true } })}
            />
          )
          if (stage === undefined) {
            return (
              <>
                {substitutionOverlay && <div className={styles.matchupFrame}>{substitutionOverlay}</div>}
                {matchupCards && <div className={styles.matchupFrame}>{matchupCards}</div>}
              </>
            )
          }
          return (
            <PitcherSideStage
              // 0xd 진입마다 투수 그림 객체를 상태 0 으로 (48ee4 — '#' 교체 창에서 곧장 선 0xe 는 0xd 가 없다)
              sceneDEntryMark={sceneConfirm.sceneDEntryMark}
              pitch={stage.lastThrow?.pitch ?? null}
              resolution={stage.lastThrow?.resolution ?? null}
              resultTicks={stage.lastThrow?.resultTicks ?? 0}
              isJudgementCleared={stage.lastThrow?.judgementCleared === true}
              cpuSwing={stage.lastThrow?.cpuSwing ?? null}
              // CPU 타자가 맞힌 공 — 판정 틀까지 0x11, 이어 0x13 을 그리고 0x17 이 선 틀에 수비 판으로 넘긴다 (투수편과 같다)
              hitScene={stage.hitScene ?? null}
              {...(stage.onHitSceneEnd === undefined ? {} : { onHitSceneEnd: stage.onHitSceneEnd })}
              // 경기 칸(이닝 st[0x6b] · 공격 측 st[9] · 점수 0xb69b0 · 팀 st[0x28 + 칸]) — 타자 미션 화면과 같다
              hud={{
                inning: run.game.inning + 1,
                half: run.game.offenseSide === 0 ? '초' : '말',
                ourScore: run.game.scores[humanSideOf(run.mission)],
                opponentScore: run.game.scores[cpuSideOf(run.mission)],
                balls: atBat.balls,
                strikes: atBat.strikes,
                outs: run.outs,
                bases: run.bases,
                // 경기[0x28 + 칸] 팀의 작은 로고 (0x48658 48a38~48a74 → 장면+0x1054 · +0x1058) — 사람 칸 · CPU 칸 (`missionTeamIdsOf`)
                ourLogoUrl: smallLogoUrlOf(teamIds.human),
                opponentLogoUrl: smallLogoUrlOf(teamIds.cpu),
                // 루상 주자 팔레트(0x35b94 — 주자 +0xac 팀) · 펜스 아이콘(0x77974 — 모드 5 · 6 은 77ae4~77af0 에서 늘 11)
                ourTeamId: teamIds.human,
                opponentTeamId: teamIds.cpu,
                playerSide: humanSideOf(run.mission),
                // st[0x15 + i] — CPU 가 이번 공에 도루를 출발시킨 주자는 0xf 진입 전까지(공이 날거나 0x12 인 동안 포함) 루에 안 그린다
                hiddenRunnerBases:
                  stealDisplay !== null && (!stealDisplay.selectionEntered || isPitchSceneBusy) ? stealDisplay.bases : [],
              }}
              batterForm={stage.batterForm}
              batterSkinIndex={stage.batterSkinIndex}
              batterTeamIndex={stage.batterTeamIndex}
              pitcherForm={stage.pitcherForm}
              pitcherHand={stage.pitcherHand}
              {...(stage.pitcherEquipment === undefined ? {} : { pitcherEquipment: stage.pitcherEquipment })}
              {...(stage.pitcherSkinIndex === undefined ? {} : { pitcherSkinIndex: stage.pitcherSkinIndex })}
            {...(stage.pitcherStaminaPercent === undefined ? {} : { pitcherStaminaPercent: stage.pitcherStaminaPercent })}
              {...(stage.batterSide === undefined ? {} : { batterSide: stage.batterSide })}
              {...(stage.aceBatterOrder === undefined ? {} : { aceBatterOrder: stage.aceBatterOrder })}
              {...(stage.batterEquipment === undefined ? {} : { batterEquipment: stage.batterEquipment })}
              // 미션은 구장 생성자 값 0 · 바닥 줄 기본 — 타자 미션 화면(`MissionPlayScreen`)과 같다
              stadium={0}
              fieldPalette={null}
              skyRow={skyRow ?? 0}
              gameMode={MISSION_PITCHER_MODE}
              {...(settings === undefined ? {} : { isScoreboardOn: settings.isScoreboardOn })}
              isPaused={isAwaitingConfirm}
              isFrozen={isPopupOpen}
              inputOverlayRef={inputOverlayRef}
              // "#TIME" 없음 — '#' 교체 검사 0x38984 가 미션(모드 5 · 6)을 막는다(38984~38a20)
              timeKeyCount={null}
              // 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체
              {...(stage.skillPanel === undefined
                ? {}
                : {
                    skillPanel: {
                      ...stage.skillPanel,
                      entryKey: sceneConfirmWait ?? null,
                      ...(skillPanelScene === undefined ? {} : { scene: skillPanelScene }),
                    },
                  })}
            >
              {matchupCards}
              {substitutionOverlay}
            </PitcherSideStage>
          )
        })()}

      {stage !== undefined && (
        // 점수판 0x373d0 꼬리 0x378f0 → 0x36cb8(모드 5) → 0x36714 — 장면 오른쪽 위 미션 판 (타자 미션과 같은 그리기, 모드 5 갈래)
        <MissionHud
          mode={MISSION_PITCHER_MODE}
          mission={run.mission}
          progress={run.progress}
          limits={{
            plateAppearanceLimit: run.mission.plateAppearanceLimit,
            plateAppearancesUsed: run.mission.plateAppearanceLimit - (run.remainingPlateAppearances ?? run.mission.plateAppearanceLimit),
            swingLimit: 0,
            swingsUsed: 0,
            // 행[9] 아랫 4비트 · P+0x1c
            pitches: {
              limit: run.mission.pitchLimit,
              thrown: run.mission.pitchLimit - Math.max(0, run.remainingPitches ?? run.mission.pitchLimit),
            },
          }}
          remainingSeconds={run.remainingSeconds}
          allowedRuns={run.allowed.runs}
          isFrozen={isPopupOpen}
          isDimmed={isPitchMenuShown}
        />
      )}

      {/* 0xe — OK 하나만 받는다 (0x532b0). 원본 화면에 글자는 없다 — 마우스 길로 판 전체를 누름 칸으로 */}
      {isAwaitingConfirm && !isMenuOpen && (
        <PressLayer testId="확인 누름 칸">
          <PressArea
            label="확인"
            isDisabled={!sceneConfirm.acceptsConfirm}
            onPress={sceneConfirm.confirm}
          />
        </PressLayer>
      )}

      {/* 0xf 구질 — 그림은 장면(0x4c4bc 4c528~)이 그리고 여기는 키 · 틱 · 누름 칸만 */}
      {isPitchMenuShown && (
        <div hidden={isPopupOpen}>
          <PitchSlotPicker
            choices={slotChoices}
            isPaused={isPopupOpen}
            stageSide={stageSide}
            {...(stage === undefined
              ? {}
              : { overlay: { ref: inputOverlayRef, typeNumbers: slotTypeNumbers, magicRemaining: magicRemaining ?? 0 } })}
            onDecide={(chosen) => {
              const index = slotChoices.findIndex((choice) => choice.slot === chosen)
              const found = repertoire[index]
              if (found === undefined || isBlockedMagic(found)) return
              setPitchType(found)
              setPhase('코스')
            }}
          />
        </div>
      )}

      {/* 0x10 조준 — 그림은 장면 0x4d780 */}
      {phase === '코스' && (
        <div hidden={isPopupOpen}>
          <AimCursor
            side={aimSide}
            isPaused={isPopupOpen}
            {...(stage === undefined ? {} : { overlay: { ref: inputOverlayRef, typeNumber: typeNumberOf(pitchType) } })}
            {...(onAimTick === undefined ? {} : { onTick: onAimTick })}
            onConfirm={(confirmed) => {
              // OK(0x50e9c)는 늘 0x11 로 간다(0x50ed0) — 게이지를 안 쓰는 공(게이지 끔 · 마구 0x3f500 의 `구질 != 22`)도
              // 0x11 의 틱 10 에 놓는다(0x4e060). 그때 등급은 제구·체력 표로 뽑힌다 (0x4dbac)
              if (pitchType !== null) {
                setAim(confirmed)
                setPhase('게이지')
              }
            }}
            // CLR(0x50ee0) — 0xf 로 돌아가 0xf 진입 0x3d954 가 다시 돈다
            onCancel={() => {
              setPhase('구질')
              setPitchType(null)
              onReturnToPitchSelection?.()
            }}
          />
        </div>
      )}

      {/* 0x11 게이지 — 그림은 장면 0x4d2ac. 원본에는 결과 글자가 없다 (S5 U-15) */}
      {phase === '게이지' && (
        <div hidden={isPopupOpen}>
          <PitchGradeGauge
            isPaused={isPopupOpen}
            showsGauge={showsGauge}
            onRelease={throwPitch}
            {...(stage === undefined || aim === null
              ? {}
              : { overlay: { ref: inputOverlayRef, aim, aimSide, gaugeSettingOn: usesGauge, gameMode: MISSION_PITCHER_MODE } })}
          />
        </div>
      )}

      {/*
        소프트키 — 장면이 그리는 "*MENU" 글자 자리(0x4c8e0)의 누름 칸. 소프트키1 도 0x498d4 가 '*' 로 읽는다(498e8) — 경기 중 메뉴.
        "#TIME" 은 없다 — '#' 교체 검사 0x38984 가 미션(모드 5 · 6)을 막는다
      */}
      {overlay !== '조작방법' && (
        <PressLayer testId="소프트키 누름 칸" isOnTop>
          <PressArea rect={MENU_PRESS_RECT} label={isMenuOpen ? '닫기' : '메뉴'} onPress={menu.pressStar} />
        </PressLayer>
      )}

      {isMenuOpen && (
        <div className={styles.popupLayer}>
          <InGameMenu
            // 미션 투수편 = 모드 5 — 표 0xcfcfc 행 1(계속·다시하기·조작방법·설정·나가기)
            mode={MISSION_PITCHER_MODE}
            cursor={menu.cursor}
            slidesIn={menu.slidesIn}
            opening={menu.opening}
            bindCloser={menu.bindCloser}
            onCursorChange={menu.setCursor}
            onContinue={menu.close}
            onQuit={onGiveUp}
            onRestart={onRestart}
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

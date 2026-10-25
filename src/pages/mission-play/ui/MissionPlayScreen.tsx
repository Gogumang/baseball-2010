import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import { useEffect, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import type { MutableRefObject } from 'react'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { PressArea, RawScreen } from '@/shared/ui'
import { MENU_PRESS_RECT, stealPressRectOf } from '@/features/play-game/model/stagePressAreas'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import { MissionHud } from '@/pages/mission-play/ui/MissionHud'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuOpenOnHide, useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { MissionResultBoard } from '@/pages/mission-play/ui/MissionResultBoard'
import type { MissionResultBoardProps } from '@/pages/mission-play/ui/MissionResultBoard'
import { setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { cpuSideOf, humanSideOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'

interface MissionPlayScreenProps {
  readonly run: MissionRun
  readonly ability: BatterAbility
  /**
   * 지금 타자 이름 — 마스터 타순 차례(미션 타자가 아닌 사람 칸 타자)면 그 줄 이름(0xb62c0). 0xe 소개 판 0x44944 의 타자 칸.
   * 안 넘기면 비운다(미션 타자 — 웹 미션 상태에 이름 칸이 없다).
   */
  readonly batterName?: string
  /**
   * 치는 선수의 **장착** 스킬 (0xb62b4 — 선수 기록 +0x14). 미션은 나리 타자편 저장을 올리므로 그 선수 것이다.
   * 압도 22 면 CPU 실투율 +5 (0x33d52). 안 넘기면 스킬 없음.
   */
  readonly batterSkillIds?: readonly number[]
  /** 타자 레코드 칸 0xb6394 (투수 스킬 31) — `missionStageBatterOf().recordSlot`. 안 넘기면 0 */
  readonly batterRecordSlot?: number
  /**
   * 지금 타자 레코드 +0xb 의 폼 · 피부 (`missionStageBatterOf().look`) — 타석 교대 0x47d98~0x47dd6 이 그림 적재 0x78ab0 에
   * 폼 `rec[0xb] >> 4` · 피부 `(rec[0xb] >> 2) & 3` · 손 0xb63c0 을 넘기고, 0x47d58~0x47d70 이 같은 손을 장면 +0x17e1(배치 side)에
   * 쓴다(모드 갈림 없음 — 미션 6 도 같다). 손은 스윙 판정 0xab214 · CPU 투구도 본다. 안 넘기면 폼 0(타격형 · 우타) · 피부 0
   */
  readonly batterLook?: { readonly form: number; readonly skinIndex: number }
  /**
   * 상태 0xe 소개 판 0x44944 의 값 — 부르는 쪽(미션 라우트)이 지금 투수 · 타자 레코드로 만든다
   * (`pages/mission-play/lib/missionMatchupCards`). 안 넘기면 팀 글자만 그린다
   */
  readonly matchupCards?: {
    readonly batterHand: number
    readonly pitcher: MatchupPitcherCard
    readonly batter: MatchupBatterCard
  }
  readonly pitcherAbility: PitcherAbility
  /** 마투수 미션의 상대. 일반 투수면 null */
  readonly opponent: AcePlayer | null
  /** 마운드 투수 레코드 +0x19 · +0x1a 장비 니블 — 마투수면 안 넘긴다 (`BattingStage.pitcherEquipmentNibbles`) */
  readonly pitcherEquipmentNibbles?: readonly number[] | undefined
  /** 마운드 투수 레코드 피부 `(rec[0xb] >> 2) & 3` (`BattingStage.pitcherSkinIndex`) — 팀은 hud 의 CPU 칸 팀 */
  readonly pitcherSkinIndex?: number
  readonly atBat: AtBatState
  readonly isPaused: boolean
  readonly bannerText: string
  readonly random: RandomPort
  /** 셋째 인자는 필살타법이 성공한 타구인가 · 넷째는 번트 종류 장면 +0xfdc (`BattingStage.onPitchResolved` 그대로) */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number) => PitchResolvedReply | void
  /**
   * 치는 선수의 **고른 필살 번호** (레코드 +0x18) — '0' 키 0x51dee 가 S+0x10 에 싣는다. 안 넘기면 0 = '0' 키 무시.
   */
  readonly specialSwingNumber?: number
  /** 이 미션 한 판의 남은 필살 횟수 (0xaea30). 안 넘기면 횟수 제한 없이 번호만 본다 (`BattingStage` 기본) */
  readonly specialSwingRemaining?: number
  /** 필살 스윙이 나가 남은 횟수가 줄었다 (0x4e136) — 인자는 줄인 뒤 값 */
  readonly onSpecialSwingUsed?: (remaining: number) => void
  /**
   * 이 공 앞의 장면 +0xfdc(마지막으로 쓴 번트 종류) — 타석 화면(`BattingStage.sceneBuntKind`)이 사람 키로 고치고 판정된 공의
   * `onPitchResolved` 넷째 인자로 돌려준다. 부르는 쪽이 경기 장면 동안 들고 있다가 다시 넘긴다. 안 주면 타석 화면이 스스로 든다.
   */
  readonly sceneBuntKind?: number
  readonly onGiveUp: () => void
  /** 결과 판에서 미션 목록으로(0x140006c = 1) — 마선수 대결이면 대결 끝(결과 이벤트로) */
  readonly onFinish: () => void
  /**
   * 결과 판에서 "예"(0x140006c = 3) — 같은 미션을 곧바로 다시. 안 넘기면 `onFinish` 와 같다.
   * 마선수 대결(`resultBoard.aceMatch`)은 어느 키든 `onFinish` 다(0x4b100 이 원래 모드로 돌려보낸다).
   */
  readonly onRetry?: () => void
  /**
   * 결과 판 0x4a384(모드 5·6) 의 값 — 번 G [+0x17f4] · 보유 G g[0x64] · 마선수 대결 칸. 안 넘기면 번 G 0 · 보유 칸 비움
   */
  readonly resultBoard?: Pick<MissionResultBoardProps, 'earnedGamePoint' | 'heldGamePoint' | 'aceMatch'>
  /**
   * 마선수 레벨 열 칸 (`useAceLevels` 의 `levels`) — `BattingStage` 로 그대로 넘긴다.
   * 상대 마투수의 마구 횟수가 `0xd8509[레벨]` = [3,4,5,6,7] 을 따른다 (타석 교대 0xaebe4). 안 넘기면 Lv1 = 3회.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /** CPU 팀 +0x28 · 공 +0x10 — 세션이 미션 한 판 내내 드는 CPU 마구 두 칸 (`BattingStage.cpuMagic`) */
  readonly cpuMagic?: { readonly remaining: number; readonly ballMagicNumber: number }
  /**
   * **CPU 투수의 견제** — `BattingStage.onPickoff` 로 그대로 넘긴다. 미션(모드 6)도 견제 길에 모드·미션 갈림이 없다
   * (0x50f28 · 0x345fc 의 갈림은 홈런더비 하나). 안 넘기면 견제가 꺼진다.
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /**
   * **도루 출발** (원본 키 '3' 1루 · '2' 2루 · '1' 3루 주자 → `0x53610` → 0x583 → `0xa9bd4`). 인자는 대상 주자가 선 루다.
   * 판정은 공이 도착할 때 도루 판(종류 5)이 한다.
   */
  readonly onSteal: (base: StealBase) => void
  /** 지금 출발시킬 수 있는 루 (`canStartSteal`). 안 넘기면 도루 입구가 없다 */
  readonly stealableBases?: readonly StealBase[]
  /**
   * 루별 주자 주력 — 타석 화면 0x35b94 상태 0xe 주루 칸(35f74 `0xb570d(ctx, 3, 주자, 1, 90, 1)`). 루에 선 주자의 신원(사람 칸 팀
   * 타순 칸)대로 세션이 셈한다. 안 넘기면 주루 칸을 안 그린다
   */
  readonly runnerRunAbilities?: Partial<Record<'first' | 'second' | 'third', number>>
  /** st[0x15 + i] — 이번 공에 도루를 출발한 주자의 루(세션 `stealingFrom`). 그 주자는 루에 안 그린다 */
  readonly stealingFrom?: readonly number[]
  /**
   * 타자 · 루 주자의 마선수 번호(주자 +0x9c, 세션 `missionRunnerAces`) — 루상 주자 0x35b94 가 마선수 주자를 타석 교대 0x483a0 이
   * +0x1c 에 실은 ace/defender 그림으로 그린다. 안 넘기면 모두 defender 그림이다
   */
  readonly runnerAces?: RunnerAces
  /**
   * 마운드 투수 체력% (`0xaebb1(수비 팀)`, 세션 `opponentStaminaPercent`) — 투수 그리기 0x38d1c 가 34 이하면 지친 눈을 그린다.
   * 모드 6 도 그린다(38ed6 은 모드 7 만 거른다). 마투수는 타석 화면이 거른다(38f56). 안 넘기면 안 그린다
   */
  readonly pitcherStaminaPercent?: number | null
  /** 루상 주자 애니 시계 — 미션 장면 수명(`BattingStage.runnerAnimationClock`) */
  readonly runnerAnimationClock?: MutableRefObject<RunnerAnimationClock>
  /** 경기 스킬 표시 판의 장면 칸(함성 비트 칸 · 애니 7 · 8) — 미션 장면 수명. 안 주면 타석 화면이 사는 동안만 */
  readonly skillPanelScene?: MutableRefObject<SkillPanelScene>
  /**
   * 경기 중 메뉴 **"다시하기"** (표 0xcfcfc 행 1 · StrGAME[7], `0x3c706`).
   * 미션·홈런더비 행만 자동진행 자리에 이 칸이 온다. 안 넘기면 칸이 잠긴다.
   */
  readonly onRestart?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * **상태 0xe 의 OK 대기** — 세션이 새 타석마다 싣는다 (`useMissionSession.sceneConfirm`). 안 넘기면 기다리지 않는다
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  /** 0xe 의 OK 하나를 받을 때마다 — 세션이 0xf 진입(CPU 투수 교체 0xac428)을 이때 묻는다 (`useMissionSession.confirmScene`) */
  readonly onSceneConfirm?: () => void
  /**
   * **교체 연출 0x16** — 서 있으면 타석을 멈추고 "CHANGE" 애니(0x4da30)를 얹으며 0xe 대기를 세지 않는다.
   * 다 그리면 `onSubstitutionSceneDone`.
   */
  readonly substitutionScene?: SubstitutionScene | null
  readonly onSubstitutionSceneDone?: () => void
  /** 하늘 줄 — 구장 +0x10 (0x783b0). 미션은 장면마다 한 번 굴린 rand(0, 6) — 세션이 든다. 안 넘기면 타석 그림이 굴린다 */
  readonly skyRow?: number
  /**
   * 경기 중 메뉴 · 조작방법 · 설정(일시정지 팝업 0x741a0)이 떠 있는지 바뀔 때마다 — 그동안 0x12 상태 틱이 멈춘다(0x52cc6).
   * 밀어내기 판의 0x1f 틱 대기(`useFreePassPlayStart`)를 든 쪽이 받는다 (나만의리그 `GameScreen` 의 `RecordAlertScene.isFrozen` 과 같다)
   */
  readonly onPopupFrozenChange?: (isFrozen: boolean) => void
}

/**
 * 미션 타자편 = 원본 전역 모드 **6** — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(다시하기가 있는 줄).
 * 모드 5 가 XlsPITCHER_MISSION 을 올리는 투수편이다 (Q2-mission-rewards 1-0 확정).
 * 행은 "모드 5~7 → 1" 이라 5·6 어느 쪽이든 같은 칸이 나온다.
 */
const MISSION_BATTER_MODE = 6
/** `team_logo_ini` 작은 로고 — 팀 경기 · 타자편 화면과 같은 경로 */
const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

type MenuOverlay = '조작방법' | '설정'

export function MissionPlayScreen({
  run,
  ability,
  batterName,
  batterSkillIds,
  batterRecordSlot,
  batterLook,
  matchupCards,
  pitcherAbility,
  opponent,
  pitcherEquipmentNibbles,
  pitcherSkinIndex = 0,
  atBat,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  specialSwingNumber,
  specialSwingRemaining,
  onSpecialSwingUsed,
  sceneBuntKind,
  aceLevels,
  cpuMagic,
  onPickoff,
  onGiveUp,
  onFinish,
  onRetry,
  resultBoard,
  onSteal,
  stealableBases = [],
  runnerRunAbilities,
  stealingFrom,
  runnerAces,
  pitcherStaminaPercent,
  runnerAnimationClock,
  skillPanelScene,
  onRestart,
  settings,
  onSettingsChange,
  sceneConfirm: sceneConfirmWait,
  onSceneConfirm,
  substitutionScene = null,
  onSubstitutionSceneDone,
  skyRow,
  onPopupFrozenChange,
}: MissionPlayScreenProps) {
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
  /** 경기 점수판 0xb69b0(st[0x7e] · st[0x7f]) — 사람 칸 · CPU 칸. 타석 득점 · 자동진행 반 이닝 득점이 모두 든다(`run.game.scores`) */
  const teamIds = missionTeamIdsOf(run)
  const humanScore = run.game.scores[humanSideOf(run.mission)]
  const cpuScore = run.game.scores[cpuSideOf(run.mission)]

  const menu = useInGameMenuState()

  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)

  useMarksGameScene()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  // 일시정지 팝업 0x741a0(메뉴 · 그 하위 조작방법 · 설정)이 떠 있으면 0x12 상태 틱이 멈춘다 (0x52cc6) — 든 쪽에 알린다
  const isPopupFrozen = isMenuOpen || overlay !== null
  useEffect(() => {
    onPopupFrozenChange?.(isPopupFrozen)
  }, [isPopupFrozen, onPopupFrozenChange])
  const isOver = run.status !== '진행중'
  /** [미션+0xbc] — 결과 판 · 정산 효과의 "이겼나" (0x4ea0c 4ef2a · 0x4a384 4a3ea) */
  const isSuccess = run.status === '성공'
  /** 정산 효과 층(비 · 파티클) — 결과 배경 타석 캔버스와 미션 결과 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  /**
   * **상태 0xe — 새 타석마다 사람 OK 를 기다린다** (0x39e14 → 0x532b0, 모드 갈림 없음). 결과 연출·메뉴·조작방법·설정이 덮으면
   * 받지 않는다. 0xe 그리기 0x4d9ec 가 0xd 그리기 위에 얹는 소개 판 0x44944 는 아래 `SceneMatchupCards` 가 그린다.
   */
  const isSubstituting = !isOver && substitutionScene !== null
  // 교체 연출 0x16 동안은 0xd · 0xe 가 아니다 — 연출이 끝난 뒤부터 0xd 두 그림을 센다
  const sceneConfirm = useSceneConfirm(
    sceneConfirmWait,
    !isOver && !isPaused && bannerText === '' && !isMenuOpen && overlay === null && !isSubstituting,
    onSceneConfirm,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && !isOver
  /**
   * 번트 키 '7'/'8'/'9' — 원본은 미션 목표와 상관없이 받는다. 타격 키 0x535a4 는 모드를 안 보고 0x6a7 을 보내고,
   * 받는 0x51e48 은 상태 0x11 · S+4(스윙 받을 준비) · 지금 타자(0xae89c)가 마선수(0xb633c, +0xa 비트6)가 아님만 본다.
   * 미션은 나리 타자편 저장의 선수가 치므로 마선수가 아니다 → 늘 켠다.
   */
  const canBunt = true
  // 도루 출발 — 사람 공격이고 앞길이 열린 주자가 있을 때 (`canStartSteal`). 목표에 도루가 없어도 키는 먹는다
  const canSteal = !isOver && stealableBases.length > 0
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  const stealIfFlying = (base: StealBase) => {
    // 도루 키는 장면 키 칸에 든다 — 다음 틀의 키 0x498d4 → 0x53670 → 0x53610 이 그 틀의 상태(0x11)를 보고 출발시킨다
    pushSceneKey(() => {
      if (flightProbeRef.current?.() === true) onSteal(base)
    })
  }
  // 원본 공용 키 처리 0x498d4 — '*' 메뉴 · 도루 '3'/'2'/'1' (공이 나는 동안만, 그 밖의 키는 먹고 끝난다)
  const { pressStar } = menu
  // 단말 일시정지 0x463ac — 끝난 미션(결과 판) 밖이고 하위 창이 없으면 같은 메뉴를 연다
  useInGameMenuOpenOnHide(menu, !isOver && overlay === null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // '*'(소프트키1 −6 도 '*', 498e8)는 상태 0xd~0x15 에서 경기 중 메뉴 0x3c02c 를 연다(4991c~49922 — 모드를 안 본다).
      // 미션 장면도 경기 장면 0x104 다. 결과 판(끝난 미션)은 범위 밖 · 조작방법 뷰어의 키는 뷰어 0x637d0 만 받는다(0x3ca36)
      if (event.key === '*') {
        if (isOver || overlay === '조작방법') return
        event.preventDefault()
        return pressStar()
      }
      if (isMenuOpen || overlay !== null) return
      const base = stealBaseOfKey(event.key)
      if (base !== null && stealableBases.includes(base)) {
        event.preventDefault()
        stealIfFlying(base)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen, isOver, onSteal, overlay, stealableBases, pressStar])

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
          <BattingStage
            skyRow={skyRow}
            batterAbility={ability}
            batterSkillIds={batterSkillIds}
            batterRecordSlot={batterRecordSlot}
            // 그 타순 칸의 오늘 타석 결과 링 — 공격(사람 칸) 팀 + 타순(팀+0x32)×0x18 + 0x34 (0x445cc 4477a~4478c · 0xab214 aba8e~abaac).
            // 스윙 판정의 16 상승세 · 17 하락세와 스킬 판 비트 16 · 17 이 같은 링을 읽는다 (사람 타석 결과는 `afterHumanPlateAppearance` 가 넣는다)
            recentAtBatCodes={
              run.game.humanBatting.lineup.records[lineupSlotOf(run.game.humanBatting.order)]?.results ?? []
            }
            // 타자 그림 · 손 — 레코드 +0xb (사람 칸에 마타자는 없어 손 = 폼 & 1, 0xb63c0)
            batterForm={batterLook?.form ?? 0}
            batterSkinIndex={batterLook?.skinIndex ?? 0}
            batterHand={batterSideOfForm(batterLook?.form ?? 0)}
            // 판정 묶음 '미션' = 모드 6(타자 미션) — 공격(사람) +100 (0xab5c0)
            swingMode="미션"
            // 미션은 나리 타자편 저장의 선수(등록 타자 rec[0xa] 0xa0 — 비트7)가 친다. 내 선수 보너스는 모드 3·4 에서만
            // 켜지므로(sp40) 판정 값은 안 바뀐다 — 연차도 그 갈래에서만 읽혀 넘기지 않는다
            isBatterOwnPlayer
            specialSwingNumber={specialSwingNumber}
            specialSwingRemaining={specialSwingRemaining}
            onSpecialSwingUsed={onSpecialSwingUsed}
            sceneBuntKind={sceneBuntKind}
            {...(runnerAnimationClock === undefined ? {} : { runnerAnimationClock })}
            // 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 사람이 앉은 측이 공격 측(st[9])
            skillPanel={{
              entryKey: sceneConfirmWait ?? null,
              attackSide: humanSideOf(run.mission),
              ...(skillPanelScene === undefined ? {} : { scene: skillPanelScene }),
            }}
            gameMode={MISSION_BATTER_MODE}
            // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
            isScoreboardOn={settings?.isScoreboardOn}
            // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
            isVibrationOn={settings?.isVibrationOn}
            pitcherAbility={pitcherAbility}
            // 마운드 투수 장비 겹 — 타석 교대 0x47cc8 의 48138~4816a (모드 6 도 같다)
            pitcherEquipmentNibbles={opponent === null ? pitcherEquipmentNibbles : undefined}
            // 마운드 바탕 벌 = 피부 × 15 + 수비 팀(hud CPU 칸 팀) — 482c0~482fc → 0x793b0 의 794c2
            pitcherSkinIndex={pitcherSkinIndex}
            {...(runnerAces === undefined ? {} : { runnerAces })}
            pitcherStaminaPercent={pitcherStaminaPercent ?? null}
            isEagleEyeEnabled={false}
            // 경기 칸(이닝 st[0x6b] · 공격 측 st[9] · 점수 0xb69b0 · 팀 st[0x28 + 칸])을 HUD 에 보인다
            hud={{
              inning: run.game.inning + 1,
              half: run.game.offenseSide === 0 ? '초' : '말',
              ourScore: humanScore,
              opponentScore: cpuScore,
              balls: atBat.balls,
              strikes: atBat.strikes,
              outs: run.outs,
              bases: run.bases,
              ...(runnerRunAbilities === undefined ? {} : { runnerRunAbilities }),
              ...(stealingFrom === undefined ? {} : { hiddenRunnerBases: stealingFrom }),
              // 경기[0x28 + 칸] 팀의 작은 로고 (0x48658 48a38~48a74 → 장면+0x1054 · +0x1058) — 사람 칸 · CPU 칸 (`missionTeamIdsOf`)
              ourLogoUrl: smallLogoUrlOf(teamIds.human),
              opponentLogoUrl: smallLogoUrlOf(teamIds.cpu),
              // 루상 주자 팔레트(0x35b94 — 주자 +0xac 팀) · 펜스 아이콘(0x77974 — 모드 5 · 6 은 77ae4~77af0 에서 늘 11)
              ourTeamId: teamIds.human,
              opponentTeamId: teamIds.cpu,
              // 위 줄 = 측 0(선공) · 아래 줄 = 측 1 (0x373d0 — 점수 0xb69b1(st, 0) · (st, 1)). 사람은 미션의 측에 앉는다
              playerSide: humanSideOf(run.mission),
            }}
            acePitcher={opponent === null ? null : acePitcherFramesOf(opponent)}
            canBunt={canBunt}
            // 조작방법 뷰어 동안은 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
            // 0xe(OK 대기)에서도 공이 안 나간다
            // 교체 연출 0x16 에는 갱신이 없다(R10 표 — 진입 0x3d458 · 그리기 0x4da30 뿐)
            isPaused={isPaused || isOver || overlay !== null || isAwaitingConfirm || isSubstituting}
            random={random}
            /*
              경기 상태 0x19 — 결과 그림 0x4a384 는 모드를 안 가리고 구름 0x78448 · 배경 0x40ff0(+0x17e2)만 그린다(선수 · 공 · HUD 없음).
              갱신 0x4b100 은 모드 5·6 이면 r7 = [미션+0xbc] — 성공한 판만 구장이 틱마다 3 씩 150 까지 가라앉는다.
              정산 진입 0x4ea0c 꼬리(4f41a~)는 모드를 안 가린다 — 성공(4ef36 [sp+0x50] = 1)이면 밤하늘일 때 불꽃, 실패(4efb4 = 0)면
              비(|0xb69b0(0) − (1)| × 30). 효과 · 파티클 틱은 경기 난수로 그림마다 돈다
            */
            isResultBackdrop={isOver}
            resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isSuccess)}
            {...(!isOver
              ? {}
              : {
                  settlement: {
                    isWin: isSuccess,
                    // 경기 상태 두 측 점수 0xb69b0 — 위 HUD 와 같은 점수판(`run.game.scores`, 견제 · 도루 · 폭투 판 득점도 든다). 차이의 절댓값만 쓴다
                    side0Score: run.game.scores[0],
                    side1Score: run.game.scores[1],
                    // 하늘 칸 — 경기 이닝 st[0x6b]
                    inning: run.game.inning + 1,
                    random,
                    layers: settlementLayers,
                  },
                })}
            aceLevels={aceLevels}
            {...(cpuMagic === undefined ? {} : { cpuMagic })}
            onPitchResolved={onPitchResolved}
            onPickoff={onPickoff}
            flightProbeRef={flightProbeRef}
          />
        </div>

        {/*
          미션 HUD 0x36714 — 점수판 0x373d0 끝(0x378f0 → 0x36cb8, 모드 5 · 6)에서 그린다: 오른쪽 위 판에 목표 글 한 줄 · 노란
          "지금/목표" · 타석 · 스윙 한도 띠, 시간 제한이면 왼쪽 시계. 결과(0x19) 그림 0x4a384 는 점수판을 안 그려 HUD 도 없다.
          웹 제목줄(미션 이름) · 배지(남은 초 · 타석 · 스윙)와 껍데기 목표 띠(옛 GoalBar, 지금은 지웠다)는 걷었다 — 그 값은 이 판이 그린다.
        */}
        {!isOver && (
          <MissionHud
            mission={run.mission}
            progress={run.progress}
            limits={{
              plateAppearanceLimit: run.mission.plateAppearanceLimit,
              plateAppearancesUsed: run.mission.plateAppearanceLimit - (run.remainingPlateAppearances ?? run.mission.plateAppearanceLimit),
              swingLimit: run.mission.swingLimit,
              swingsUsed: run.mission.swingLimit - (run.remainingSwings ?? run.mission.swingLimit),
            }}
            remainingSeconds={run.remainingSeconds}
          />
        )}

        {/*
          0xe 그리기 0x4d9ec — 0xd 두 그림 뒤 투수·타자 소개 판 0x44944 (모드 검사 없음). 사람이 치므로 타자 PLAYER · 투수 COM.
          값은 미션 라우트가 `missionMatchupCards` 로 지금 투수 · 타자 레코드에서 채워 넘긴다(`matchupCards`). 안 넘기면(시험)
          팀 글자와 이름만 — 타자 손은 레코드 +0xb 의 0xb63c0.
        */}
        {/* 교체 연출 0x16 — 그리기 0x4da30 이 타석 그림 위에 game_ui 애니 9 "CHANGE" 를 얹는다 */}
        {isSubstituting && substitutionScene !== null && (
          <SubstitutionSceneOverlay
            key={substitutionScene.serial}
            aceSlot={substitutionScene.aceSlot ?? null}
            onDone={() => onSubstitutionSceneDone?.()}
          />
        )}

        {isAwaitingConfirm && sceneConfirm.isInConfirmState && (
          <SceneMatchupCards
            {...(matchupCards ?? {
              batterHand: batterSideOfForm(batterLook?.form ?? 0),
              pitcher: { isComputer: true, ...(opponent === null ? {} : { name: opponent.name }) },
              batter: { isComputer: false, ...(batterName === undefined ? {} : { name: batterName }) },
            })}
          />
        )}

        {/* 원본 타석 화면에는 글자 안내가 없다 — 웹 전용 조작 안내(Hint) · 큰 결과 글자(BigResult)를 걷어 냈다 */}

        {/* 경기 상태 0x19 — 미션 결과 판 0x4a384(모드 5·6) · 키 0x407f0 */}
        {isOver && (
          <MissionResultBoard
            isSuccess={isSuccess}
            effectLayers={settlementLayers}
            earnedGamePoint={resultBoard?.earnedGamePoint ?? 0}
            {...(resultBoard?.heldGamePoint === undefined ? {} : { heldGamePoint: resultBoard.heldGamePoint })}
            {...(resultBoard?.aceMatch === undefined ? {} : { aceMatch: resultBoard.aceMatch })}
            onExit={(exit) => {
              if (resultBoard?.aceMatch === undefined && exit === '다시' && onRetry !== undefined) onRetry()
              else onFinish()
            }}
          />
        )}

        {/*
          마우스 · 터치 길 — 투명한 누름 칸: 0xe 의 OK(화면 전체) · '*' 메뉴("*MENU" 자리) · 도루(점수판 루 그림 자리).
          결과 판(0x19)은 제 키(0x407f0)를 받아 여기 칸을 안 둔다.
        */}
        {isAwaitingConfirm && !isMenuOpen && (
          // 0xe — OK 하나만 받는다 (0x532b0)
          <PressArea label="확인" onPress={sceneConfirm.confirm} isDisabled={!sceneConfirm.acceptsConfirm} />
        )}
        {!isAwaitingConfirm && !isMenuOpen && canSteal &&
          stealableBases.map((base) => (
            <PressArea key={base} label={`도루 ${base}루`} rect={stealPressRectOf(base)} onPress={() => stealIfFlying(base)} />
          ))}
        {!isOver && <PressArea label={isMenuOpen ? '닫기' : '메뉴'} rect={MENU_PRESS_RECT} onPress={menu.pressStar} />}

        {isMenuOpen && (
          <div className={stageScreen.menuLayer}>
            <InGameMenu
              // 미션 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1)
              mode={MISSION_BATTER_MODE}
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
    </>
  )
}

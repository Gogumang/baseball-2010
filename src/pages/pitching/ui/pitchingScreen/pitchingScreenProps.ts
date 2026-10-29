import type { MutableRefObject } from 'react'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import type { AimDirection } from '@/features/play-pitcher-game/model/pitchAim'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import type { outsShownDuringResultWait } from '@/features/play-game/model/benchClearingScene'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import type { MissionResultBoardProps } from './otherSlices'

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
  } | null
  /**
   * 마지막 공의 공 도착 0x3dfac 의 낫아웃 갈래(3e0aa)가 판정 칸을 지웠나 — 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다. 세션은 못 맞힌 공의
   * 공 도착을 0x12 진입 틀에 돌리므로 공(`lastThrow`)과 따로 그 틀에 선다
   */
  readonly isJudgementCleared?: boolean
  /** 붙든 볼넷 · 사구 · 삼진(세션 `pendingBenchClearing`) — 0x12 대기 중 삼진이면 HUD 아웃을 진입 3e1a6 이 올린 값으로 그린다 (r298) */
  readonly resultHold?: Parameters<typeof outsShownDuringResultWait>[1]
  readonly pitcherForm: number
  /** 미션 투수 레코드 +0x18 (마구 번호) — 놓기 전 0x11 그림의 마구 공 파티클 갈래(0x3b2f4 3b4dc · Q-09). 안 주면 0 */
  readonly pitcherMagicNumber?: number
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
  /** 판정 틀 — 메시지 0x11 굴림 묶음을 미리 굴리고 표시 패턴의 0x13 재료를 돌려준다 (`usePitcherHitScene.judge`, A-37) */
  readonly onHitJudged?: () => PitcherHitScene | null
  /**
   * 판(맞은 공 · 공 도착 판)이 섰지만 아직 0x17 전 — 장면이 0x11 끝 · 0x13 · 0x12 틱 0 을 그리는 동안. 원본은 그동안 상태 0x11 · 0x12 ·
   * 0x13 이라 구질 키 · 견제 · 0xe 의 OK 를 안 받는다('*' 는 0xd~0x15 라 받는다)
   */
  readonly isBeforePlay?: boolean
}

export interface PitchingScreenProps {
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
  /** 하늘 줄 — 구장 +0x10 (0x783b0). 미션은 장면마다 한 번 굴린 rand(0, 6) — 세션이 든다. 안 넘기면 0 줄(타석 그림은 굴리지 않는다) */
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

import type { MutableRefObject } from 'react'
import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import type { LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import type { MissionResultBoardProps } from '@/pages/mission-play/ui/MissionResultBoard'

export interface MissionPlayScreenProps {
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
  /** 맞은 판정 틀 — 메시지 0x11 굴림 묶음을 미리 굴린 쏜 공 (`BattingStage.onContact`, A-37) */
  readonly onContact?: (detail: PitchOutcomeDetail, buntKind: number) => LaunchedShot | null | undefined
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
  /** 하늘 줄 — 구장 +0x10 (0x783b0). 미션은 장면마다 한 번 굴린 rand(0, 6) — 세션이 든다. 안 넘기면 0 줄(타석 그림은 굴리지 않는다) */
  readonly skyRow?: number
  /**
   * 경기 중 메뉴 · 조작방법 · 설정(일시정지 팝업 0x741a0)이 떠 있는지 바뀔 때마다 — 그동안 0x12 상태 틱이 멈춘다(0x52cc6).
   * 밀어내기 판의 0x1f 틱 대기(`useFreePassPlayStart`)를 든 쪽이 받는다 (나만의리그 `GameScreen` 의 `RecordAlertScene.isFrozen` 과 같다)
   */
  readonly onPopupFrozenChange?: (isFrozen: boolean) => void
}

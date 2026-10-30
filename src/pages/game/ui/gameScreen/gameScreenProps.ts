import type { MutableRefObject } from 'react'
import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import type { LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import type { WalkerLineSeats, WalkerSeat } from '@/widgets/field-walk/lib/walkerAces'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import type { RecordAlertFrame } from '@/widgets/game-scene/lib/recordAlert'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { GameSettings } from '@/entities/settings/model/gameSettings'

export interface GameScreenProps {
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
export const BATTER_CAREER_MODE = 4
/** 경기 화면을 덮는 하위 화면 */
export type MenuOverlay = '조작방법' | '설정'

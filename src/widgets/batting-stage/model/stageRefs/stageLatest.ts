import type { BatterAbility } from '@/entities/batting/model/batter'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import type { LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import type { HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { StageParticleShot } from '@/widgets/batting-stage/lib/homeRunEffects'
import type { StageMissionStrip, StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import type { AcePitcherFrames, StageHud } from '@/widgets/batting-stage/model/stageRefs/stagePhase'
import type { SettlementEffectSource, SkillPanelSource } from '@/widgets/batting-stage/model/stageRefs/stageSources'
import type { MutableRefObject } from 'react'

/** 매 프레임 최신 값을 읽어야 하는 props 묶음. */
export interface StageLatest {
  readonly batterAbility: BatterAbility
  /**
   * **타석 준비 0xd 진입 번호** — 좌우 이동 +0xfe4 를 0 으로 되돌리는 곳은 0xd 진입 0x48d50 의 48f88 하나다(쓰는 곳은 그것과 키 0x50f86 뿐,
   * 리터럴 0xfe4 를 읽는 다섯 곳 3d504 · 48f7a · 49ef0 · 50f86 · 51250 전수). 이 값이 바뀔 때만 이동을 되돌리고 쉬는 동안(`isPaused`)은
   * 그대로 둔다 — 같은 타석의 다음 공은 0xae3e8 → 0xf 로 곧장 가므로(더비 ae4ea · 그 밖 ae568 · ae592) 공 사이에 이동이 남는다.
   * 사람이 치는 화면(나만의리그 · 시즌 · 팀 · 미션)은 `sceneDEntryMark`, 더비는 `sceneDSerial` 을 넘긴다(A-02)
   */
  readonly shiftResetSerial?: number
  readonly pitcherAbility: PitcherAbility
  readonly isEagleEyeEnabled: boolean
  readonly hud: StageHud | null
  /**
   * 마운드 투수 체력 % — 34 이하면 투수 자리에 체력 그림(player_effect 애니 9 · 10, 0x38d1c)을 그린다. 안 넘기면 안 그린다
   */
  readonly pitcherStaminaPercent?: number | null
  /**
   * 타자 · 루 주자의 마선수 번호(0~4, 주자 +0x9c) — 루상 마선수 주자를 실린 ace/defender 그림으로 그린다(0x35c62 · 0x79da9,
   * `renderBattingStage` 의 같은 이름). 안 넘기면 모두 defender 그림이다
   */
  readonly runnerAces?: RunnerAces
  /**
   * 루상 주자 애니 시계 — 경기 장면 수명의 칸(`useSceneScopedRef`)을 넘기면 타석 화면이 다시 서도 이어진다 (`RunnerAnimationClock`).
   * 안 넘기면 이 화면이 사는 동안만 센다
   */
  readonly runnerAnimationClock?: MutableRefObject<RunnerAnimationClock>
  readonly acePitcher: AcePitcherFrames | null
  /** 마운드 투수 장비 겹 (`BattingStage` 의 `pitcherEquipmentNibbles` 주석) — 없으면 맨몸 */
  readonly pitcherEquipment?: PitcherEquipment
  /** 마운드 투수 바탕 그림 벌 = 피부 × 15 + 팀 (적재 0x793b0 의 794c2 · `StageScene.pitcherTeamIndex` 주석). 팀이 없으면 구운 벌 */
  readonly pitcherSkinIndex?: number
  readonly pitcherTeamIndex?: number | null
  /** 곧 설 선수들의 생김새 — 그림마다 칠하기를 미리 건다 (`StageScene.warmCast`) */
  readonly warmCast?: StageWarmCast
  readonly canBunt: boolean
  /** 타자 폼 (원본 rec[0xb] 윗니블 = 2 × 타입 + 손). 몸통·자세표를 `폼 >> 1` 로 고른다 */
  readonly batterForm: number
  /** 타자 손 0xb63c0 (0 우타 · 1 좌타) — `BattingStage` 의 같은 이름 props 주석. 없으면 폼 & 1 */
  readonly batterHand?: number
  /** 마타자 순번 0xb63a0 (0~4) — 마타자 그림 `ace/batter_*`(0x78ab0) · 자세표(0xb905c 의 u ≤ 4 갈래). 음수면 일반 타자 */
  readonly aceBatterOrder?: number
  /** 타자 그림 팔레트 재료 — 몸통 피부×15+팀 · 헬멧 팀 (0x78be8·0x78c14) */
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  /** 장착 장비의 등급 순번 (부위별 −1 = 미장착) — 머리·손·다리 그림 슬롯을 채운다 */
  readonly batterEquipment: BatterEquipment
  /**
   * 시즌 구장 세 값 (관중석 칸·관중 단계·전광판 칸). 차 있으면 배경을 시즌 구장 0x77494 로 그린다 —
   * 원본은 모드 2 의 **홈경기**(0x40ff0 `내 팀 == 홈팀`)와 대전 모드 8·9 에서만 그 길로 간다.
   */
  readonly seasonStadium?: SeasonStadium
  /** 구장 번호 (구장 객체 +0x70) — `BattingStage` 의 같은 이름 props 주석 참고. 없으면 0 */
  readonly stadium?: number
  /** 바닥 팔레트 줄 (구장 객체 +0xc) — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly fieldPalette?: number | null
  /** 게임 모드(전역 `0x1552d10`) — 하늘 조명 0x78490 이 모드 5·6·7 에서 안 그린다 */
  readonly gameMode?: number
  /** 홈런더비(모드 7) 구질 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly derbyPitchType?: number
  /** 환경설정 전광판(저장 +0x3a) — 거짓이면 전광판 흐르는 글자를 안 그린다 (0x77726). 없으면 켬 */
  readonly isScoreboardOn?: boolean
  /** 환경설정 진동(저장 +0x3b) — 거짓이면 0x3a44 가 안 울린다. 없으면 켬 */
  readonly isVibrationOn?: boolean
  /**
   * 마선수 레벨 열 칸 (`mgr[0x13a..0x143]`, 칸 → 0~4) — 마투수 마구 횟수 0xd8509[레벨] (0xaebe4).
   * 없으면 모두 Lv1(0) 이다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /** 부르는 쪽이 드는 CPU 마구 상태 (팀+0x28 · 공+0x10) — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly cpuMagic?: { readonly remaining: number; readonly ballMagicNumber: number }
  readonly isPaused: boolean
  /** 참이면 결과 창 뒤 배경만 그린다 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly isResultBackdrop?: boolean
  /**
   * 공용 창 [0x140005c] 이 떠 있다 — 경기 장면 0x52c50 이 52cc6 에서 상태 바꿈 · 키 · 갱신을 건너뛰고 그리기만 한다
   * (`shared/lib/commonWindow`). 결과 배경 +0x17e2 (갱신 0x4b100) 가 그동안 안 오른다. 없으면 거짓
   */
  readonly isSceneFrozen?: boolean
  /** 부르는 쪽이 모는 HOMERUN 글자 창 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly homeRunText?: HomeRunTextWindow | null
  /** 효과를 치운 시각 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly effectsClearedAt?: number | null
  /** 홈런더비 판(0x17)의 필드 화면이 밑에 깔렸다 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly isFieldPlay?: boolean
  /** HUD 를 안 그리는 상태(0x1b · 0x23) — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly isHudOmitted?: boolean
  /** 필드 화면 그리기(0x46c88)가 그 장면 틱에 쏘는 파티클 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly fieldPlayShotsAt?: (sceneTick: number) => readonly StageParticleShot[]
  /** 경기 정산 효과 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly settlement?: SettlementEffectSource
  /** 결과 창 뒤 배경의 틱별 +0x17e2 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly resultBackdropOffsetOf?: (tick: number) => number
  /** 하늘 줄(구장 +0x10) — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly skyRow?: number
  /** 미션 HUD 띠 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly missionStrips?: readonly StageMissionStrip[]
  readonly random: RandomPort
  readonly swingMode: SwingMode
  readonly batterSkillIds: readonly number[]
  /** 최근 타석 기록 코드 — 스킬 16·17 조건 */
  readonly recentAtBatCodes: readonly number[]
  /** 타자 레코드 칸 `0xb6394` = +0xa & 0x1f — 투수 스킬 31(0xabcd8)이 본다 (`BattingStageProps.batterRecordSlot`) */
  readonly batterRecordSlot: number
  /** 세 번째 인자는 **필살타법이 성공한 타구인가** (0x51800) */
  readonly onPitchResolved: (
    detail: PitchOutcomeDetail,
    pitch: Pitch,
    isUncatchable?: boolean,
    buntKind?: number,
    sceneTick?: number,
  ) => PitchResolvedReply | void
  /** 맞은 판정 틀 — 메시지 0x11 굴림 묶음을 미리 굴린 쏜 공 (`BattingStage` 의 같은 이름 props 주석 참고) */
  readonly onContact?: (detail: PitchOutcomeDetail, buntKind: number) => LaunchedShot | null | undefined
  /**
   * CPU 투수가 공 대신 **견제**를 걸었다 (0x34848 → 메시지 0x10). 없으면 CPU 견제가 꺼진다 —
   * `BattingStage` 의 같은 이름 props 주석 참고.
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /** "#TIME" 의 벤치 수 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly timeKeyCount?: number
  /** 교체 창(상태 0xb)이 떠 있는가 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly isSubstitutionWindowOpen?: boolean
  /** 지금 타자의 남은 필살 횟수 0xaea30 — `BattingStage` 의 같은 이름 props 주석 참고. 없으면 표시(0x38a30)를 안 그린다 */
  readonly specialSwingRemaining?: number
  /** 경기 스킬 표시 판(0x4b5b4) 재료 — `BattingStage` 의 같은 이름 props 주석 참고. 없으면 판을 안 그린다 */
  readonly skillPanel?: SkillPanelSource
}

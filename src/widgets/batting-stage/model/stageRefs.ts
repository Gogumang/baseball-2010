import { useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { sceneParticleScene } from '@/widgets/particles/model/sceneParticles'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import { RESULT_PHASE_TICKS } from '@/widgets/batting-stage/lib/stagePhaseTicks'
import type { RunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import type { SpecialSwingStageEffect } from '@/widgets/batting-stage/lib/specialSwingEffect'

/** 원본 경기 상태 — 대기·투구중 0xf/0x11 · **타격 0x13** · 결과 0x12/0x17 */
export type StagePhase = '대기' | '투구중' | '타격' | '결과'

export type StageHud = StageScene['hud']

export interface AcePitcherFrames {
  readonly framesUrl: string
  readonly frameCount: number
  readonly stillUrl: string
  /**
   * 마투수 순번 `0xb63a0(투수)` (0~4) — 0x35650 이 투수 그림 객체 +0x24 에 적어 단계 표(유지 0xd73fa · 프레임 0xd7483 ·
   * 마지막 0xd744f)와 놓는 단계(0xcfbe4)를 고른다 (`stageScenery` 의 투수 그림 객체)
   */
  readonly order: number
}

/** 마투수 한 명의 그림 재료 — 순번은 `ACE_PITCHERS`(XlsACE_PIT_DATA 줄 차례 = 0xb63a0) 의 칸이다 */
export function acePitcherFramesOf(player: AcePlayer): AcePitcherFrames {
  return {
    framesUrl: player.framesUrl,
    frameCount: player.frameCount,
    stillUrl: player.stillUrl,
    order: ACE_PITCHERS.indexOf(player),
  }
}

/** 번트 자세 — 종류와 누른 순간의 공 프레임 (0x53670 토글) */
export interface BuntStance {
  readonly kind: number
  readonly frame: number
}

/**
 * **스윙 예약** — 0x51db6 · 0x51dee 가 적는 경기+0xfe0 = 1 · +0xfd8 = 키 틱 F · S+0x10(필살).
 * 다음 갱신(F + 1, 0x4e0ce)에서 풀려 스윙이 나가고, F + 2 에 깊이를 보고 판정(0x6aa)한다.
 */
export interface SwingReservation {
  /** 키 틱 F (+0xfd8) — 판정 타이밍 0x34be0 이 읽는다 */
  readonly frame: number
  /** 필살 스윙(S+0x10 ≠ 0) */
  readonly isSpecial: boolean
  /** 스윙이 나갔다(0xb9374) */
  readonly isReleased: boolean
  /** 판정 틱에 공이 타자 근처가 아니어서 0x6aa 를 안 탄 헛스윙(0x4e21c) */
  readonly isUnjudgedWhiff: boolean
}

/**
 * 상태 0x13 동안 손에 들고 있는 타격 결과 — 이 단계가 끝나야 인플레이(0x17)로 넘긴다.
 * 결과 문구·HOMERUN 글자도 여기서 꺼내므로 붙잡아 두는 동안에는 화면에 뜨지 않는다.
 */
export interface PendingHit {
  /** 붙잡아 둘 틱 수 (0x406a4 문턱 또는 틱 8) */
  readonly ticks: number
  readonly detail: PitchOutcomeDetail
  readonly pitch: Pitch
  readonly isUncatchable: boolean
  readonly isHomeRun: boolean
  /**
   * 큰 타구 멈춤이 풀리는 0x13 그림(틱 7)에 쏠 파티클의 화면 좌표 (0x4cb1c → 0x4cd14 의 `016.ptc`, `hitPause.HIT_STOP_TICKS`).
   * 감상 플래그 `+0x199a` 가 꺼진 타구면 null 이라 그 그리기 갈래(4cb76)를 안 탄다.
   */
  readonly bigHitAt: { readonly x: number; readonly y: number } | null
  /** 감상 플래그 `+0x199a` — 켜졌을 때만 OK·'5' 로 건너뛴다 (0x406e8 40708) */
  readonly watchesBigHit: boolean
  readonly resultText: string
  /** 이 공의 번트 종류 장면 +0xfdc (0 스윙 · 1~3 번트) — 인플레이로 넘길 때 함께 알린다 */
  readonly buntKind: number
  /**
   * 필살 스윙 연출 그림(0x49aec) — 상태 0x13 동안 타격점에 그림 애니 · 미라지 타자를 그린다 (`specialSwingEffect`).
   * 필살 갈래를 안 타는 스윙이면 null
   */
  readonly specialEffect?: (SpecialSwingStageEffect & { readonly x: number; readonly y: number }) | null
}

/** 매 프레임 최신 값을 읽어야 하는 props 묶음. */
export interface StageLatest {
  readonly batterAbility: BatterAbility
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
  /** 경기 정산 효과 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly settlement?: SettlementEffectSource
  /** 결과 창 뒤 배경의 틱별 +0x17e2 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly resultBackdropOffsetOf?: (tick: number) => number
  /** 하늘 줄(구장 +0x10) — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly skyRow?: number
  readonly random: RandomPort
  readonly swingMode: SwingMode
  readonly batterSkillIds: readonly number[]
  /** 최근 타석 기록 코드 — 스킬 16·17 조건 */
  readonly recentAtBatCodes: readonly number[]
  /** 타자 레코드 칸 `0xb6394` = +0xa & 0x1f — 투수 스킬 31(0xabcd8)이 본다 (`BattingStageProps.batterRecordSlot`) */
  readonly batterRecordSlot: number
  /** 세 번째 인자는 **필살타법이 성공한 타구인가** (0x51800) */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number) => void
  /**
   * CPU 투수가 공 대신 **견제**를 걸었다 (0x34848 → 메시지 0x10). 없으면 CPU 견제가 꺼진다 —
   * `BattingStage` 의 같은 이름 props 주석 참고.
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /** "#TIME" 의 벤치 수 — `BattingStage` 의 같은 이름 props 주석 참고 */
  readonly timeKeyCount?: number
  /** 지금 타자의 남은 필살 횟수 0xaea30 — `BattingStage` 의 같은 이름 props 주석 참고. 없으면 표시(0x38a30)를 안 그린다 */
  readonly specialSwingRemaining?: number
  /** 경기 스킬 표시 판(0x4b5b4) 재료 — `BattingStage` 의 같은 이름 props 주석 참고. 없으면 판을 안 그린다 */
  readonly skillPanel?: SkillPanelSource
}

/** 경기 스킬 표시 판 재료 (`widgets/batting-stage/lib/skillPanel`) */
export interface SkillPanelSource {
  /**
   * **0xd 진입마다 새 값** — 그 타석의 0xe 대기 객체(`SceneConfirmWait`)를 넘긴다. 바뀐 뒤 첫 0xf 진입에서 0xd 진입 0x48d50 처럼
   * 두 비트를 다시 정한다(0xd · 0xe 동안은 판이 안 그려지고 상황도 안 바뀐다). null 은 무시한다
   */
  readonly entryKey: unknown
  /** st[9] — 공격 측(사람 타석이라 사람 팀 측). 함성 29 의 비트 칸을 고른다 */
  readonly attackSide: number
  /** 경기 장면 수명의 칸(`useSceneScopedRef`) — 비트 칸 skin+0x44c · 애니 7 · 8. 없으면 이 타석 화면이 사는 동안만 */
  readonly scene?: MutableRefObject<SkillPanelScene>
  /** 0xb6c20(st, st[0xa]) — 수비 측이 CPU 인가. 없으면 참(사람 타석) */
  readonly isDefenseCpu?: boolean
}

/**
 * 사람이 던지는 타석의 판 재료 (`PitcherSideStage.skillPanel`) — 지금 CPU 타자 레코드 · 마운드의 사람 투수 레코드.
 * 0xd 진입 0x445cc · 0x3d160 · 함성 29 는 사람이 치는 타석과 같은 함수다(모드 · 조작 갈래 없음 — 445cc · 3d160 · 4c26a).
 * `attackSide` 는 CPU 공격 측(st[9]), `isDefenseCpu` 는 없으면 거짓(투수 아이콘 칸 앵커 y − 0x4e, 4c098)
 */
export interface PitcherSideSkillPanelSource extends SkillPanelSource {
  /** 지금 CPU 타자 레코드 +0x14 의 장착 스킬 번호 (`0xb62b4(타자, n)`) */
  readonly batterSkillIds: readonly number[]
  /** 0xb6394(타자) = rec[0xa] & 0x1f — 투수 스킬 15 · 함성 비트 칸 */
  readonly batterRecordSlot: number
  /** 마운드 사람 투수 레코드 +0x14 의 장착 스킬 번호(비트 + 16) */
  readonly pitcherSkillIds: readonly number[]
  /** 그 타순 칸의 오늘 타석 결과 링(팀 + 타순×0x18 + 0x34, 0x53100) — 타자 스킬 16 · 17 */
  readonly recentAtBatCodes: readonly number[]
}

/** 경기 정산 0x4ea0c 의 효과를 고르는 재료 */
export interface SettlementEffectSource {
  /** 0x4a350 — 사람 팀이 이겼나 */
  readonly isWin: boolean
  /** 0xb69b0(st, 0) · (st, 1) */
  readonly side0Score: number
  readonly side1Score: number
  /** 하늘 표 칸(구장객체 +0x14) — 타석 하늘과 같은 이닝 */
  readonly inning: number
  /** 경기 난수 — 효과 깔기 · 틱 · 파티클 틱 */
  readonly random: RandomPort
  /**
   * 효과를 그릴 **판 쪽 캔버스 두 장** (`useSettlementEffectLayers`). 원본 그리기 차례 0x4a384 는
   * 배경(0x40ff0) → 진 판 덮개(4a404) → **효과 틱 0x4a452(비)** → 띠 · 승패 그림 · 판(4a448~) → 프레임 끝 **0x6dd69(파티클)** 라
   * 비는 덮개 위 · 띠 아래, 파티클(불꽃)은 판 맨 위다. 판이 DOM 이라 그 사이에 끼울 캔버스를 판이 깔고 타석 캔버스는 배경만 그린다.
   * 안 넘기면 둘 다 배경 캔버스(판 아래)에 그린다.
   */
  readonly layers?: SettlementEffectLayers
}

/** 정산 효과 층 — `rain` 은 진 판 덮개 바로 위, `particles` 는 판 맨 위에 판이 까는 240×320 캔버스 */
export interface SettlementEffectLayers {
  readonly rain: RefObject<HTMLCanvasElement>
  readonly particles: RefObject<HTMLCanvasElement>
}

export interface StageRefs {
  readonly canvasRef: RefObject<HTMLCanvasElement>
  readonly pitchRef: MutableRefObject<Pitch | null>
  /** 지금 날아가는 공의 구질 번호 1~22 (`game+0xfc8`) — `pitchRef` 와 함께 세운다. 판정 detail 에 실어 보낸다 */
  readonly pitchTypeNumberRef: MutableRefObject<number | null>
  readonly phaseRef: MutableRefObject<StagePhase>
  /**
   * 지금 단계가 선 **경기 장면 틱**(`gameSceneTickOf`) — 단계 안 틱은 (지금 장면 틱 − 이 값)이다. 원본 상태 틱 [장면+0x2c] 를
   * 0 으로 적는 틀(0xbc9c8 bc9ec)과 같은 틀이다(`commonWindow` 의 `gameSceneTickOf` 머리말)
   */
  readonly phaseStartTickRef: MutableRefObject<number>
  /**
   * **예약한 다음 단계** — 갱신이 0xbcb48 로 예약한 상태는 그 틀이 아니라 다음 틀 머리 0xbc9c8 에서 틱 0 으로 선다(bc9e8~bc9f4).
   * 판정 0x6aa → 0x13 · 공 끝 0x4e24e(4e26c `movs r1, #0x12` → 0xbcb49) · 0x13 끝 40786(→ 0xbcb49) 이 이 길이다 — 고리가 예약한 틀은
   * 아직 0x11 · 0x13 으로 그리고, 루프가 `tick` 에 닿은 틀 머리에서 단계를 세운다. 없으면 null
   */
  readonly phaseEntryRef: MutableRefObject<{ readonly phase: StagePhase; readonly tick: number } | null>
  /** 0x13 건너뛰기 키(OK · '5')를 읽는 갱신 틱 — 키는 다음 틀의 0x13 갱신 0x406e8(40708)이 [장면+0x40] 으로 읽는다. 없으면 null */
  readonly hitSkipKeyTickRef: MutableRefObject<number | null>
  readonly resultTextRef: MutableRefObject<string>
  /**
   * 홈런 글자 연출(원본 켜짐 칸 +0x1960)이 켜진 장면 틱. null 이면 꺼짐.
   * 원본은 홈런 판정 가지에서 켜고 다음 플레이가 지울 때까지 돌리므로,
   * 웹도 결과 문구 시간과 따로 두고 **다음 투구가 시작할 때** 끈다.
   */
  readonly homeRunStartTickRef: MutableRefObject<number | null>
  /** 스윙이 나간 장면 틱(F + 1, 0xb9374). null 이면 대기 자세 */
  readonly swingStartTickRef: MutableRefObject<number | null>
  /**
   * 투수 그림 객체가 상태 1 에 든 장면 틱 — 0x11 진입 0x3de10 이 걸고 다음 0xf 진입(0x3d954 → 0x340c0)이 상태 0 으로 되돌린다.
   * null 이면 상태 0(선 자세). 공이 끝난 0x12 · 0x13 동안에도 남아 투수가 마지막 단계 자세에 머문다
   */
  readonly pitcherStartTickRef: MutableRefObject<number | null>
  readonly shiftRef: MutableRefObject<number>
  readonly buntRef: MutableRefObject<BuntStance | null>
  readonly deckRef: MutableRefObject<PatternDeck | null>
  /** 상태 0x13 이 붙잡고 있는 타격 결과. 없으면 이 단계가 아니다 */
  readonly pendingHitRef: MutableRefObject<PendingHit | null>
  /** 이 공의 스윙 예약 · 스윙 (`SwingReservation`). 없으면 null — 새 공(0x11 진입의 memset)마다 지운다 */
  readonly swingRef: MutableRefObject<SwingReservation | null>
  /** 이 공이 판정됐나 — 경기+0xfe5 (0x4e18a · 0x4e216) */
  readonly pitchJudgedRef: MutableRefObject<boolean>
  /** 판정은 났지만 공 끝(0x12)까지 기다리는 결과(헛스윙 · 번트 헛맞음) — 공 끝에서 부른다 */
  readonly heldResultRef: MutableRefObject<((tick: number) => void) | null>
  /** '결과' 단계(0x12)가 서 있을 그림 수 — 결과를 세울 때 정한다 (`resultPhaseTicksOf`) */
  readonly resultTicksRef: MutableRefObject<number>
  /** 지금 '결과' 가 맞은 공 뒤 인플레이(0x17) 자리인가 — 아니면 상태 0x12 (`StagePhaseSnapshot.isInPlay`) */
  readonly isInPlayResultRef: MutableRefObject<boolean>
  /** 살아 있는 파티클 이미터 목록 — 앱 전역 관리자 [0x1400068] 하나(`widgets/particles` 의 `sceneParticleScene`) */
  readonly particlesRef: MutableRefObject<ParticleScene>
  /**
   * 맞은 공이 0x13 을 끝내고 0x17(인플레이)로 넘어간 장면 틱(`commitHit`) — 0x17 진입 0x46418 의 4673e 가 파티클 관리자를 갈래 없이
   * 비운다(0x6dee4). 그 틱 뒤 첫 틱에서 지우고 null 로 되돌린다
   */
  readonly inPlayEnteredTickRef: MutableRefObject<number | null>
  readonly pointerDownAtRef: MutableRefObject<number>
  readonly latestRef: MutableRefObject<StageLatest>
}

/**
 * 타석 연출의 가변 상태를 전부 ref로 든다.
 * 매 프레임 최신 값을 읽어야 하고, props가 바뀌어도 애니메이션 루프를
 * 다시 시작하면 안 되기 때문이다.
 */
export function useStageRefs(latest: StageLatest): StageRefs {
  const latestRef = useRef(latest)
  latestRef.current = latest

  return {
    canvasRef: useRef<HTMLCanvasElement>(null),
    pitchRef: useRef<Pitch | null>(null),
    pitchTypeNumberRef: useRef<number | null>(null),
    phaseRef: useRef<StagePhase>('대기'),
    phaseStartTickRef: useRef(0),
    phaseEntryRef: useRef<{ readonly phase: StagePhase; readonly tick: number } | null>(null),
    hitSkipKeyTickRef: useRef<number | null>(null),
    resultTextRef: useRef(''),
    homeRunStartTickRef: useRef<number | null>(null),
    swingStartTickRef: useRef<number | null>(null),
    pitcherStartTickRef: useRef<number | null>(null),
    shiftRef: useRef(0),
    buntRef: useRef<BuntStance | null>(null),
    deckRef: useRef<PatternDeck | null>(null),
    pendingHitRef: useRef<PendingHit | null>(null),
    swingRef: useRef<SwingReservation | null>(null),
    pitchJudgedRef: useRef(false),
    heldResultRef: useRef<((tick: number) => void) | null>(null),
    resultTicksRef: useRef(RESULT_PHASE_TICKS),
    isInPlayResultRef: useRef(false),
    particlesRef: useRef<ParticleScene>(sceneParticleScene()),
    inPlayEnteredTickRef: useRef<number | null>(null),
    pointerDownAtRef: useRef(0),
    latestRef,
  }
}

/**
 * 공 프레임 F — 투수 애니가 놓는 단계(평범 6 · 마투수 0xcfbe4[순번])에 닿은 뒤부터 매 틱 +1 (0x3f378).
 * `phaseTicks` 는 0x11 에 든 뒤 흐른 장면 틱이다. 그 전에는 음수라 공을 그리지 않는다. `aceOrder` 는 마운드 마투수 순번(없으면 평범한 투수)
 */
export function ballFrameOf(phaseTicks: number, aceOrder?: number | null): number {
  return phaseTicks - pitcherReleaseTicksOf(aceOrder)
}

/** 공 프레임 F 가 서는 장면 틱 — `ballFrameOf` 의 거꾸로 (`phaseStartTick` = 0x11 에 든 장면 틱) */
export function ballFrameStartTick(frame: number, phaseStartTick: number, aceOrder?: number | null): number {
  return phaseStartTick + frame + pitcherReleaseTicksOf(aceOrder)
}

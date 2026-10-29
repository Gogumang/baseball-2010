/**
 * 타석 화면 한 그림의 재료 — 부르는 쪽(`BattingStage` · `PitcherSideStage` · 판들)이 채워 `renderBattingStage` 에 넘긴다.
 * 칸마다 원본 근거는 그 칸의 주석에 있다.
 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { SceneRain } from '@/entities/batting/model/settlementEffect'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery'
import type { PitcherResultCodeClock } from '@/widgets/batting-stage/lib/pitcherFatigue'
import type { HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import type { SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import type { SpecialSwingStageEffect } from '@/widgets/batting-stage/lib/specialSwingEffect'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { BigHitScreen } from '@/widgets/batting-stage/lib/bigHitScreen'
import type { HitBallPath } from '@/widgets/batting-stage/lib/hitBallPath'
import type { StageCamera } from '@/widgets/batting-stage/lib/hitCamera'
import type { StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage/warmCast'

export interface StageScene {
  readonly pitch: Pitch | null
  /** 공 프레임 F (0 = 릴리스). 공이 아직 손을 떠나지 않았으면 음수 */
  readonly frame: number
  /**
   * 0x11 진입(투수 그림 객체 상태 1, 0x3de10) 뒤 흐른 그림 수 — 다음 0xd · 0xf 진입(상태 0, 0x35650 → 0x340c0)까지 센다.
   * 투수 곁 그림(바람 줄 · 홈런 갈래)의 그림 수 시계다. null 이면 상태 0(선 자세) 또는 대기 동작
   */
  readonly pitcherTick: number | null
  /**
   * 0x11 의 마지막 갱신 틱(`pitcherTick` 셈) — 단계(0x9e004)는 0x11 갱신에서만 오르므로 그 뒤 0x12 · 0x13 은 이 틱의 단계에 굳는다.
   * 아직 0x11 이면 null · 안 주면 null
   */
  readonly pitcherTickEnd?: number | null
  /** 빈 구질 칸 키(0x50de8 → 상태 2) 뒤 흐른 틱 — 대기 동작 한 바퀴. 안 주면 없음 */
  readonly pitcherIdleTick?: number | null
  /** 0xf 의 마지막 갱신 틱(`pitcherIdleTick` 셈) — 0x10 에 들면 대기 동작이 굳는다. 아직 0xf 면 null · 안 주면 null */
  readonly pitcherIdleTickEnd?: number | null
  /**
   * 투수 그리기 0x38d1c 의 홈런 갈래(0x3908a)가 보는 것: 결과 코드 [경기+0xfd4](24~26 이면 0x357e0 참 — 0x6aa 가 쓰고 0x11 진입
   * 3deea 가 공마다 0 으로 지운다, `PitcherResultCodeClock`) · 큰 타구 감상 플래그 +0x199a(0x392ac). 투수를 안 그리는 상태면 null · 안 주면 없음
   */
  readonly pitcherHitMark?: (PitcherResultCodeClock & { readonly isBigHit: boolean }) | null
  /** 화면이 열린 뒤 흐른 틱 — 대기 동작 · 전광판 글자 (구름은 `scenery.cloudCalls`) */
  readonly tick: number
  /**
   * 창이 선 첫 그림([창+0x250] — 52efe 가 갱신 없이 그리기 표를 한 번 더 돈 그림)이 든 장면 틱(`tick` 과 같은 격자). 그 그림은 그리기
   * 쪽에서 넘기는 애니(루상 주자 · 투수 덧그림 · 필살 스윙 그림 · 판정 글자 · 램프 확대 · 하늘 조명)를 한 칸 더 넘긴다(`stageRedraws`).
   * 안 주면 없음
   */
  readonly redrawTicks?: readonly number[]
  /**
   * 루상 주자 애니 1 · 2 · 3 루의 지금 진행 수 — 장면에 남는 애니 시계(`stepRunnerAnimationClock`). 안 주면 `tick`(시험 · 옛 호출)
   */
  readonly runnerAnimationSteps?: readonly (number | null)[]
  /** 판정 글자가 뜬 뒤 흐른 틱 */
  readonly resultTick: number
  readonly scenery: Omit<SceneryState, 'tick' | 'skyColumn' | 'ourTeamId' | 'opponentTeamId'>
  /** 타자 좌우 이동 fe4 — 타자 그림 x 에 더한다 */
  readonly shift: number
  /** 이글아이 아이템 사용 시 공의 도착 지점을 미리 보여준다. */
  readonly isEagleEyeEnabled: boolean
  readonly resultText: string
  /**
   * 홈런 연출(HOMERUN 글자, 원본 +0x1960)이 켜졌는가. 켜지면 판정 문구 대신 이 연출이 나간다.
   * 글자 문구로 판정하지 않도록 타석 결과가 따로 채운다.
   */
  readonly isHomeRun: boolean
  /** 홈런 연출이 켜진 뒤 흐른 틱 */
  readonly homeRunTick: number
  /**
   * 부르는 쪽이 칸을 들고 모는 HOMERUN 글자의 이번 그림(`BattingStage` 의 `homeRunText`). 있으면 `isHomeRun` 대신 이것을 그린다.
   * null 이면 이 그림에는 글자가 없다(관문이 닫혔거나 아직 홈런 틱 전). undefined 면 예전 길(`isHomeRun`)이다.
   */
  readonly homeRunFrame?: HomeRunTextFrame | null
  /**
   * 살아 있는 파티클. 없으면 안 그린다.
   * 그리는 자리는 장면 그리기 0x52c50 이 상태 그리기 표(0x50828 따위)를 부른 **뒤** 53050~53060 에서
   * 파티클 관리자 [0x1400068] 의 0x6de85 · 0x6dd69 를 부르는 곳 — 전광판·판정 글자·HOMERUN 글자까지 다 그린 위,
   * 그 뒤 0x4e35c(기록 알림·팝업) 아래다.
   */
  readonly particles?: ParticleScene | null
  /** 타자 자세 f (0xb905c) — 레이어마다 가산값을 더해 그린다 */
  readonly swingFrame: number
  /** 타자 몸통 종류 t = 폼 >> 1 (0 balancer · 1 sluger, 0x78ab0) */
  readonly bodyType: number
  /**
   * 마타자 순번 `0xb63a0(타자)` (0~4) — 있으면 몸통 적재 0x78ab0 이 `ace/batter_*` 를 싣고 그리기 0x78cfc 가 그 한 장만 그린다
   * (`aceBatterLayersOf`). 없거나 음수면 일반 타자 겹
   */
  readonly aceBatterOrder?: number
  /**
   * 타자 그림의 대체 팔레트 재료 — 몸통 = **피부 × 15 + 팀** · 헬멧 = **팀** (0x78be8·0x78c14, C-1).
   * 원본은 그림 객체를 세울 때 선수 레코드 `rec[0xb]` 의 피부(bit2-3)와 팀 번호를 같이 넘긴다 (0x10810).
   */
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  /** 장착 장비 등급 순번 (부위별 −1 = 미장착) — 머리·손·다리 레이어 (0x78fd8) */
  readonly batterEquipment: BatterEquipment
  /**
   * 타자 손 = 폼 & 1 (0 우타 · 1 좌타, 0xb63c0). 안 넘기면 좌타 배치다.
   * 우타면 타자 그림과 구장이 좌우로 뒤집히고 앵커·존도 표의 우타 칸을 쓴다 (R6 4절).
   */
  readonly side?: number
  /** 마운드에 그릴 마선수. 없으면 평범한 투수라 그리지 않는다. */
  /** 화면에 겹쳐 그릴 경기 상황 */
  readonly hud: HudState | null
  /**
   * 타자 · 루 주자의 마선수 번호(0~4, 주자 +0x9c) — 마선수 주자는 실린 ace/defender 그림으로 그린다(0x35c62 · 0x79da9).
   * 안 넘기면 모두 defender 그림이다
   */
  readonly runnerAces?: RunnerAces
  /**
   * 마운드에 선 투수의 **장착 장비 등급** (0x79790 적재 · 0x79524 여섯 칸).
   * 안 넘기면 맨몸 투수라 지금까지와 똑같이 바탕 f · f+22 두 겹만 그린다.
   *
   * 타석 화면(타자편)은 원본에도 채울 자리가 아니다 — 원본 경기 장면(0x108f8)은 그림 한 칸만 세우고 모드로 갈린다:
   * 모드 4(타자편)면 타자 그림, **아니면 투수 그림**이다. 그러니 장비를 입은 투수 그림은 **모드 3 투수편의 "내 투수"** 뿐이고,
   * 타석 화면 마운드의 상대 투수는 그 객체가 아니다 (`batterLayers.pitcherEquipmentOf` 주석).
   * 채우는 곳: 투수편 경기 화면의 타석 장면 `PitcherSideStage` — `pitcherEquipmentOf(career.equipmentLevels)`.
   *
   * *(정정 2026-10-14)* 경기 장면 마운드 그림(장면 +0xf1c)은 타석 교대 0x47cc8 이 따로 다시 싣는다 — 마운드 투수가 마투수가 아니면
   * 48138~4816a 가 **그 투수 레코드**의 니블 − 1 로 0x79790 을 부른다(모드를 안 가린다). 그래서 팀 경기 사람 수비 장면도 명단 투수
   * 니블로 채운다(`teamPitcherSideStageOf`). 사람 타석(`BattingStage`)도 상대 마운드 투수 레코드의 니블을 넘긴다
   * (`BattingStage.pitcherEquipmentNibbles` — 팀 경기 · 나리 타자편 · 미션 · 홈런더비).
   */
  readonly pitcherEquipment?: PitcherEquipment
  /**
   * 마운드 투수 레코드의 **폼** `rec[0xb] >> 4` (0xb6e24). 투구 단계 표 0x9e0b8 이 투구 객체 `[게임+0xf98]+0xc` 로 보는 값 —
   * 타석 교대 0x48d50 이 0x48f34 에서 `0xb6e24(현재 투수 0xae83d)` 를 거기 쓴다. 표는 `폼 >> 1` 로 갈린다. 없으면 0.
   */
  readonly pitcherForm?: number
  /**
   * 마운드 투수의 **손** 0xb63c0 (0 우투 · 1 좌투). 투수 그림 적재 vt8(0x793b0) 의 다섯째 인자로 그림 객체 +0x3c 에 들어가고
   * (타석 교대 0x482c8~0x482fc), 그리기 0x79524 가 ≠ 0 이면 효과 0x11(좌우 뒤집기)로 그린다. 투수 x 는 좌투면 +1 이다
   * (0x38dac~0x38db8 → 0x38e6c 그림 객체 +4). 없으면 0.
   */
  readonly pitcherHand?: number
  /**
   * 마운드 투수 바탕 그림(`pitcher.pzx`)의 팔레트 재료 — 벌 = **피부 × 15 + 팀** (적재 0x793b0 의 794c2).
   * 타석 교대 0x47cc8 의 482c0~482fc 가 팀 = 수비 팀 0xb6c08(게임) · 피부 = 투수 레코드 `(rec[0xb] >> 2) & 3` 으로 싣는다(모드 무관).
   * 팀이 없으면(null · 안 넘김) 예전처럼 구운 벌 그대로 그린다(장비 등급 줄만 칠한다). 피부는 없으면 0
   */
  readonly pitcherSkinIndex?: number
  readonly pitcherTeamIndex?: number | null
  /**
   * 마운드 투수 체력 % (0xaebb1(수비 팀)) — 34 이하면 투수 그리기 0x38d1c 가 player_effect 애니 9 · 10 을 투수 자리에 그린다
   * (`pitcherFatigue`). 안 넘기면 안 그린다
   */
  readonly pitcherStaminaPercent?: number | null
  /**
   * 실투 공을 놓은 틱부터 센 그림 수(1 부터) — 1~4 면 투수 그리기 0x38d1c 가 머리 위에 player_effect 애니 13 "!" 를 그린다
   * (투구 객체 +8, 놓기 0x4dc78 의 4deae · `pitcherFatigue` 의 실투 "!"). 안 넘기거나 null 이면 안 그린다
   */
  readonly pitcherMistakeMarkDraw?: number | null
  readonly acePitcher: {
    readonly framesUrl: string
    readonly frameCount: number
    readonly stillUrl: string
    /** 마투수 순번 0xb63a0 (0~4) — 단계 표 0xd7483 의 줄 (`AcePitcherFrames.order`) */
    readonly order: number
  } | null
  /**
   * 차 있으면 **결과 창 뒤 배경**만 그린다 — `0x45c18` 의 0x78448(구름) · 0x78578(구장, 이 값, 1).
   * 값은 장면 +0x17e2(구장·바닥을 내리는 y). 선수·공·파티클·HUD·판정 글자는 그리지 않는다.
   */
  readonly resultBackdropOffsetY?: number | null
  /** 경기 정산 비(종류 0) — 결과 배경 위에 빗방울 선 · 튐 점을 그린다 (0x8f8ec · 0x8fb08) */
  readonly rain?: SceneRain | null
  /**
   * 하늘 칸(구장객체 +0x14, 0부터)을 HUD 이닝 대신 이 값으로 — 정산 결과 배경이 쓴다(HUD 가 없다). 이기면 경기 끝 이닝의 칸 그대로,
   * 지면 정산 진입 0x4ea0c 가 0x76fc5 로 12 칸에 둔다. 없으면 HUD 이닝의 칸(`skyColumnOfInning`, HUD 가 없으면 1회 = 칸 0).
   */
  readonly skyColumn?: number | null
  /** 웹 타석 단계 — 공용 그리기 0x4c4bc 의 상태 갈래(소프트키 글자 따위)가 본다. 없으면 그 그림들을 안 그린다 */
  readonly stagePhase?: StagePhaseSnapshot
  /**
   * "#TIME" 의 벤치 수 n (0x4c940 — 사람 공격이면 팀[+0x28c], 사람 수비면 팀[+0x33]). '#' 교체 검사 0x38984 가 참인 화면만 넘긴다 —
   * 없거나 null 이면 "#TIME" 을 안 그린다 (`softKeyLabels`).
   */
  readonly timeKeyCount?: number | null
  /**
   * 교체 창(경기 상태 0xb) 뒤 배경인가 — 0x4c8e0 의 상태 문턱(0xd ~ 0x15) 밖이라 "*MENU" · "#TIME" 을 안 그린다 (`softKeyLabels`)
   */
  readonly isSubstitutionState?: boolean
  /** 필살 남은 횟수 0xaea30(공격 팀) — 0x38a30 이 타자 옆에 "0:SP×n" 을 그린다 (`specialSwingBadge`). 없거나 null 이면 안 그린다 */
  readonly specialSwingRemaining?: number | null
  /** 경기 스킬 표시 판(0x4b5b4) 이 그림의 모습 — 상태 0xf ~ 0x11 이고 수명이 남았을 때만 (`skillPanel`) */
  readonly skillPanel?: SkillPanelView | null
  /**
   * 미션 HUD 0x36714 의 반투명 띠(trainning 합성 프레임 13 · 효과 1 · 10) — 점수판 0x373d0 끝(0x378f0 → 0x36cb8)에서 그린다.
   * 띠 위 글 · 숫자 · 판은 DOM(`MissionHud`)이 그리고, 띠만 이 캔버스 화면에 원본 식으로 섞는다(Q-03 r301). 없거나 null 이면 안 그린다
   */
  readonly missionStrips?: readonly StageMissionStrip[] | null
  /**
   * 필살 스윙 연출 그림 (0x49aec) — 타격점 (x, y) 에 그림 애니 0 의 `drawCall` 번째 부름 칸, 미라지면 반대쪽 타석의 타자 그림.
   * 맞은 틀(0x11)과 상태 0x13 동안만 부르는 쪽이 채운다 (`specialSwingEffect`). 없거나 null 이면 안 그린다
   */
  readonly specialSwingEffect?: (SpecialSwingStageEffect & { readonly x: number; readonly y: number; readonly drawCall: number }) | null
  /**
   * 보통 타격 불꽃 (0x49e64 49faa~4a0a2 — `batterOverlayMarks`) — game_effect 애니 2 · 3 을 타격점 (x, y) 에, 그 애니의 `drawCall` 번째
   * 부름 칸. 필살 그림 갈래 · 큰 타구가 아닌 맞은 공의 맞은 틀(0x11)과 0x13 동안만 부르는 쪽이 채운다. 없거나 null 이면 안 그린다
   */
  readonly hitFlame?: { readonly animation: number; readonly x: number; readonly y: number; readonly drawCall: number } | null
  /**
   * 사구 표시 (0x49e64 4a0ce~4a12e — `batterOverlayMarks`) — player_effect 애니 14 의 몇 번째 부름인가(장면 틱으로 센 값). 사구 0x12 의
   * 틱 0~7 만 부르는 쪽이 채운다. 없거나 null 이면 안 그린다
   */
  readonly hitByPitchMarkDraw?: number | null
  /**
   * 사람 투구 UI (구질 목록 0xf · 조준 0x10 · 게이지 0x11) — 상태 그리기가 장면 위에 그리는 것 (`pitchInputOverlay`).
   * 구질 목록이면 존 자리(0x4c53c)에 존 대신 그린다
   */
  readonly pitchInput?: PitchInputOverlay | null
  /**
   * 큰 타구 0x13 의 화면 연출(0x4cb1c 4cb76~4ce0e — `bigHitScreen`): 멈춤 갈래는 확대 · 흐리기 · 번쩍임 · 검은 테두리, 뒤 갈래는 흐리기 ·
   * game_effect 애니 3. 상태 0x13 이고 감상 플래그가 선 타구에만 부르는 쪽이 채운다. 없거나 null 이면 안 그린다
   */
  readonly bigHitScreen?: BigHitScreen | null
  /**
   * 상태 0x13 의 **타구 공** — 0x33e34 가 [경기+0xf2c] 공으로 다시 채운 경로(`hitBallPath`)와 이 그림의 공 틱 [+0x1098],
   * 꼬리선(0x3b188 — 강한 타구 0x35988 · 결과 코드 24~26 일 때만)을 긋는가. 0x13('타격') 그림에만 부르는 쪽이 채운다.
   * 없거나 null 이면 0x13 공을 안 그린다
   */
  readonly hitBall?: { readonly path: HitBallPath; readonly ballTick: number; readonly showsTrail: boolean } | null
  /**
   * 상태 0x13 의 **타석 카메라** [경기+0x1ec] 지금 자리 — 틀 머리 0x3f060 3f1dc~3f2d8 이 공을 따라 옮긴다(`hitCamera`). 0x41230 이 이 값으로
   * (+0xff4, +0xff8) 을 적어 구장 배경(+0xf10)과 그 카메라를 더하는 그림(투수 · 타자 · 주자 · 공 · 존 · 판정 글자 · 필살 표시 · 큰 타구
   * 애니 3)이 함께 옮겨진다. 점수판 HUD · 하늘 조명 · 소프트키 · 확대 연출은 화면 자리라 그대로다. 없거나 null 이면 가운데(120, 70)
   */
  readonly camera?: StageCamera | null
  /**
   * 홈런더비 판(0x17)의 **필드 화면이 타석 캔버스 밑에 깔린 동안** — 0x17 그리기 0x46c88 은 타석 그림(0x4c4bc)을 안 부른다.
   * 캔버스는 비우고 HOMERUN 글자(0x40b18)와 파티클(프레임 끝 0x6dd69)만 그린다 — 필드는 `pages/home-run-derby` 의 필드 층이 그린다
   */
  readonly isFieldPlay?: boolean
  /**
   * **HUD 를 안 그리는 상태** — 돌발 제안 창 0x1b 의 그리기 0x4a198 과 강판 감독 대사 0x23 의 그리기 0x50828 은 타석 공용 묶음 넷
   * (0x38d1c 투수 · 0x49e64 타자 · 0x35b94 루상 주자 · 0xbe6a1 그리기 목록)만 부르고 0x42f2c(더비 투구 기계) · 0x4c4bc(점수판 HUD ·
   * 램프 · 미션 띠 · 존/구질 목록 · "*MENU" "#TIME" · 구속 판 · 필살 남은 횟수 · 스킬 판)를 안 부른다(0xd 0x4db2c · 0xb 0x4db68 ·
   * 0x16 0x4da30 은 부른다 — r334 직접 뜸). 참이면 그 몫을 건너뛴다
   */
  readonly omitsHud?: boolean
  /**
   * 곧 타석 · 마운드에 설 수 있는 선수들(타순 다음 · 벤치 대타 · 교체 투수)의 그림 생김새 — 그림마다 그 칠하기를 미리 건다
   * (`warmStageCast`). 원본은 타석 교대 0x47cc8 이 적재(타자 0x78ab0 · 투수 0x793b0) 때 팔레트를 갈아 끼우므로 새 타자 · 투수의
   * 첫 그림부터 제 색이다. 웹은 칠하기가 비동기라 교대 직후 첫 그림에 구운 벌이 비치던 것을 막는다. 그림 · 차례 · 난수는 안 바꾼다
   */
  readonly warmCast?: StageWarmCast | null
}

/** 미션 HUD 띠 한 장 — 그림(원점 (0, 0) 합성 프레임) · 화면 자리 · 효과 1 의 인자 */
export interface StageMissionStrip {
  readonly src: string
  readonly x: number
  readonly y: number
  readonly level: number
}

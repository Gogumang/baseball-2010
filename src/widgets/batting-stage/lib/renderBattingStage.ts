import type { Pitch } from '@/entities/pitching/model/pitch'
import { BALL_FRAMES_PER_KIND } from '@/entities/pitching/model/pitchCurve'
import { ballFrameIndexAt, ballPixelAt, eagleEyePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import { drawFrameAt, frameAnimations, GAME_EFFECT_FRAMES, JUDGE_FRAMES, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { drawScenery } from '@/widgets/batting-stage/lib/renderScenery'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery'
import {
  judgeAnimationOf,
  judgeFrameAt,
  pitcherAnimationAt,
  pitcherPoseOf,
  skyColumnOfInning,
} from '@/widgets/batting-stage/lib/stageScenery'
import type { PitcherAnimation } from '@/widgets/batting-stage/lib/stageScenery'

import { heldBallTickOf } from '@/widgets/batting-stage/lib/heldBall'
import { magicBallEffectFolderOf, magicBallEffectFrameAt } from '@/widgets/batting-stage/lib/magicBallEffect'
import {
  ACE_EFFECT_BLEND_WEIGHT,
  EFFECT_PITCHER_FRAMES,
  aceMagicAnimationDrawOf,
  aceMagicScaledDrawOf,
  aceMagicScaledOriginOf,
  effectPitcherFrameAt,
  type AcePitcherEffectInput,
} from '@/widgets/batting-stage/lib/acePitcherEffect'
import {
  FASTBALL_FLAME_ANIMATION,
  fastballFlameBallTickOf,
  fastballFlameFrameAt,
  hasFastballFlame,
} from '@/widgets/batting-stage/lib/fastballFlame'
import { drawParticles } from '@/widgets/particles/lib/renderParticles'
import { rainDrawingOf, type SceneRain } from '@/entities/batting/model/settlementEffect'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { drawHud } from '@/widgets/batting-stage/lib/renderHud'
import { DRAW_EFFECT, drawImageScaledBlend, recoloredImageOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { drawSoftKeyLabels } from '@/widgets/batting-stage/lib/softKeyLabels'
import {
  BASE_WINDOW_IMAGE,
  RUNNER_FRAMES,
  RUN_PIP_IMAGE,
  aceRunnerFramesOf,
  baseRunnerDrawsOf,
  loopingAnimationStepAt,
  runPipDrawsOf,
  runnerBoxAnchorOf,
  showsBaseRunners,
  type BaseKey,
} from '@/widgets/batting-stage/lib/baseRunners'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { loadedRunnerAceOf } from '@/features/defense-play/model/runnerAces'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import { drawSpecialSwingBadge } from '@/widgets/batting-stage/lib/specialSwingBadge'
import { drawSkillPanel } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import { drawPitchSpeedReadout } from '@/widgets/batting-stage/lib/pitchSpeedReadout'
import { drawDerbyPitchingMachine } from '@/widgets/batting-stage/lib/derbyPitchingMachine'
import { drawHomeRunBanner, drawHomeRunTextFrame } from '@/widgets/batting-stage/lib/renderHomeRunBanner'
import type { HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'
import { aceBatterLayersOf, batterLayersOf, isAceBatterOrder, layerPaletteIndexOf, NO_PITCHER_EQUIPMENT, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'

import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { GAUGE_TARGET_FRAME, drawPitchInputSprites, drawPitchInputUnderlay, drawPitchMenu } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { BATTER_SIDE, STAGE_SIDE, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { specialSwingEffectFrameAt } from '@/widgets/batting-stage/lib/specialSwingEffect'
import {
  MISTAKE_MARK_ANIMATION,
  MISTAKE_MARK_OFFSET_Y,
  PLAYER_EFFECT_FRAMES,
  pitcherFatigueAnimationOf,
  pitcherFatigueFrameAt,
  pitcherHomeRunMarksOf,
  type PitcherResultCodeClock,
  pitchWindDrawCallOf,
  PITCH_WIND_ANIMATION,
  PITCH_WIND_OFFSET_X,
  HOME_RUN_PITCHER_ANIMATION,
  showsPitcherFatigue,
  showsPitcherMistakeMark,
} from '@/widgets/batting-stage/lib/pitcherFatigue'
import type { SpecialSwingStageEffect } from '@/widgets/batting-stage/lib/specialSwingEffect'
import { UI_COLORS } from '@/shared/config/design'

export { STAGE_HEIGHT, STAGE_WIDTH, toPixel, toZoneCoordinate } from '@/widgets/batting-stage/lib/stageLayout'

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
  /** 필살 남은 횟수 0xaea30(공격 팀) — 0x38a30 이 타자 옆에 "0:SP×n" 을 그린다 (`specialSwingBadge`). 없거나 null 이면 안 그린다 */
  readonly specialSwingRemaining?: number | null
  /** 경기 스킬 표시 판(0x4b5b4) 이 그림의 모습 — 상태 0xf ~ 0x11 이고 수명이 남았을 때만 (`skillPanel`) */
  readonly skillPanel?: SkillPanelView | null
  /**
   * 필살 스윙 연출 그림 (0x49aec) — 타격점 (x, y) 에 그림 애니 0 의 `drawCall` 번째 부름 칸, 미라지면 반대쪽 타석의 타자 그림.
   * 상태 0x13 동안만 부르는 쪽이 채운다 (`specialSwingEffect`). 없거나 null 이면 안 그린다
   */
  readonly specialSwingEffect?: (SpecialSwingStageEffect & { readonly x: number; readonly y: number; readonly drawCall: number }) | null
  /**
   * 사람 투구 UI (구질 목록 0xf · 조준 0x10 · 게이지 0x11) — 상태 그리기가 장면 위에 그리는 것 (`pitchInputOverlay`).
   * 구질 목록이면 존 자리(0x4c53c)에 존 대신 그린다
   */
  readonly pitchInput?: PitchInputOverlay | null
}

export function renderBattingStage(
  context: CanvasRenderingContext2D,
  scene: StageScene,
): void {
  const side = scene.side ?? STAGE_SIDE
  const backdropOffsetY = scene.resultBackdropOffsetY ?? null
  drawScenery(context, {
    ...scene.scenery,
    tick: scene.tick,
    side,
    // 하늘 칸 = 경기 상태 +0x6b(0부터 세는 이닝) — 1회가 칸 0
    skyColumn: scene.skyColumn ?? skyColumnOfInning(scene.hud?.inning ?? 1),
    ourTeamId: scene.hud?.ourTeamId ?? null,
    opponentTeamId: scene.hud?.opponentTeamId ?? null,
    offsetY: backdropOffsetY ?? 0,
  })
  if (backdropOffsetY !== null) {
    // 결과 그림 0x4a384 — 배경 뒤 효과 틱 0x4a452 가 비를 그리고, 프레임 끝 0x6dd69 가 파티클(불꽃)을 그린다
    if (scene.rain !== null && scene.rain !== undefined) drawRain(context, scene.rain)
    if (scene.particles !== null && scene.particles !== undefined) drawParticles(context, scene.particles)
    return
  }
  const pitchInput = scene.pitchInput ?? null
  // 0x4d780 이 바로 그리는 판 · 덮개 — 그리기 목록(선수)보다 먼저
  drawPitchInputUnderlay(context, pitchInput, side)
  const aceEffect = acePitcherEffectInputOf(scene)
  // 마투수 effect_pitcher(+0x1044) — 0x38d1c 꼬리 39258 이 깊이 24499 로 넣는다. 같은 깊이의 루상 주자(0x35b94)보다 먼저 넣어 그 밑이다
  drawEffectPitcher(context, aceEffect, side)
  // 루상 주자 0x35b94 — 그리기 목록에 깊이 24499(투수판 z − 1)로 들어가 투수·타자보다 먼저(뒤에) 그려진다 (유력)
  if (scene.hud !== null && showsBaseRunners(scene.stagePhase)) {
    drawBaseRunners(context, scene.hud, side, scene.tick, isRunPipState(scene.stagePhase), scene.runnerAnimationSteps, scene.runnerAces)
  }
  const pitcherAnimation = pitcherAnimationAt(
    {
      pitchTick: scene.pitcherTick,
      pitchEndTick: scene.pitcherTickEnd ?? null,
      idleTick: scene.pitcherIdleTick ?? null,
      idleEndTick: scene.pitcherIdleTickEnd ?? null,
    },
    scene.acePitcher?.order ?? null,
  )
  // 0x38dc6 바람 줄(애니 11) — 투수와 같은 깊이 24500 이지만 먼저 넣어 투수 밑에 그려진다
  drawPitchWind(context, scene, side, pitcherAnimation)
  drawPitcher(context, scene.acePitcher, pitcherAnimation, side, scene.pitcherEquipment, scene.pitcherForm ?? 0, scene.pitcherHand ?? 0)
  // 0x38d1c 의 실투 "!"(38ee0) · 체력 그림(38f42) · 홈런 갈래(0x3908a) — 같은 깊이(24500)로 투수 다음에 이 차례로 들어간다
  drawPitcherMistakeMark(context, scene, side)
  drawPitcherFatigue(context, scene, side, pitcherAnimation)
  drawPitcherHomeRunMarks(context, scene, side, pitcherAnimation)
  // 0x46fa8(장면, 0) 붕붕머신 · 발렌타인 — 깊이 24501 이라 투수 덧그림(24500)들 다음 · 타자(29705) 앞이다
  drawAceMagicAnimation(context, aceEffect, side)
  const special = scene.specialSwingEffect ?? null
  // 0x49aec 의 그림은 그리기 목록 깊이로 줄 선다 — 깊이 29704(플레임 · 어거지죠)는 타자(29705) 아래
  if (special !== null && special.isBehindBatter) drawSpecialSwingPicture(context, special)
  drawBatter(context, scene.swingFrame, scene.shift, scene.bodyType, side, scene.batterSkinIndex, scene.batterTeamIndex, scene.batterEquipment, scene.aceBatterOrder)
  // 미라지(49c9c~49d40) — 같은 타자 그림을 반대쪽 타석 앵커(0xcfb34 / 0xcfb2c)에 반대 손 자세로, 좌우 이동(+0xfe4) 없이 한 장 더
  if (special !== null && special.showsMirage) {
    drawBatter(context, scene.swingFrame, 0, scene.bodyType, side === BATTER_SIDE.우타 ? BATTER_SIDE.좌타 : BATTER_SIDE.우타, scene.batterSkinIndex, scene.batterTeamIndex, scene.batterEquipment)
  }
  if (special !== null && !special.isBehindBatter) drawSpecialSwingPicture(context, special)
  if (scene.pitch !== null && scene.isEagleEyeEnabled) {
    drawEagleEyeMarker(context, eagleEyePixelOf(scene.pitch))
  }
  if (scene.pitch !== null && scene.frame >= 0 && scene.frame < scene.pitch.frameCount) {
    drawBall(context, scene.pitch, scene.frame)
    // 마구 이펙트는 원본에서도 공 **다음**에 그려 공 위에 얹힌다 (0x3b422 공 → 0x3b546 이펙트)
    drawMagicBallEffect(context, scene.pitch, scene.frame)
  } else if (scene.pitch !== null) {
    // 0x12 그리기 0x4ce9c 도 0x3b2f4 를 불러 공을 마지막 점에 그대로 둔다 — 0x11 이 아니라 마구 이펙트는 없다 (`heldBall`)
    const heldTick = heldBallTickOf(scene.stagePhase, scene.pitch.frameCount)
    if (heldTick !== null) drawBall(context, scene.pitch, heldTick)
  }
  // 강속구 불꽃 0x3b6e4 — 같은 공 그리기 0x3b2f4 의 꼬리라 공 · 마구 이펙트 다음이다. 공이 다 온 틱(N)부터라
  // 0x12 에서도 마지막 점의 공 위에 돈다 (`fastballFlame`)
  if (scene.pitch !== null) drawFastballFlame(context, scene.pitch, scene.frame, scene.stagePhase)
  // 그리기 목록을 비운 뒤(0xbe6a1) · HUD(0x4c4bc) 앞 — 홈런더비 투구 기계 0x42f2c (`derbyPitchingMachine`)
  drawDerbyPitchingMachine(context, scene.scenery.gameMode, side, scene.pitcherHand ?? 0)
  // 0x4d780 · 0x4d2ac 의 그리기 목록 몫(애니 0 · 이름 · 게이지) — ⚠️ 깊이 정렬 대신 선수 다음
  drawPitchInputSprites(context, pitchInput, side)
  // 0x46fa8(장면, 1) 싸이커 · 드래고나 — 목록 비우기(0x4d744) 뒤 · HUD(0x4c4bc) 앞에 화면에 바로 섞어 그린다
  drawAceMagicScaled(context, aceEffect, side, pitcherPoseOf(pitcherAnimation, scene.pitcherForm ?? 0, scene.acePitcher?.order ?? null))
  if (scene.hud !== null) {
    // 틱을 넘기는 까닭 = 새 램프 확대 연출(0x37828)이 5틱 동안 배율을 줄인다
    drawHud(context, scene.hud, scene.tick)
  }
  // 0x4c4bc 가 HUD(0x4c50c) 다음 0x4c53c 에서 존 0x35ae8 을 부른다 — 그리기 목록(투수·타자·공, 0xbe6a1) 위다
  // 4c528 — 상태 0xf 이고 사람 수비면 존 대신 구질 목록(빛 지도 · 고리 · 칸)
  if (pitchInput?.kind === '구질') drawPitchMenu(context, pitchInput, side)
  else if (showsStrikeZone(scene.stagePhase)) drawStrikeZone(context, side)
  // 0x4c4bc 꼬리 0x4c8e0 — "*MENU" · "#TIME" (`softKeyLabels`)
  if (scene.stagePhase !== undefined) drawSoftKeyLabels(context, scene.stagePhase, scene.timeKeyCount ?? null)
  // 0x4c4bc 의 0x4c9fc — 상태 0x12 의 "Km" 판 · 표시 구속 [+0x19a0] (`pitchSpeedReadout`)
  if (scene.stagePhase !== undefined) drawPitchSpeedReadout(context, scene.stagePhase, scene.pitch?.displaySpeedKmh)
  // 0x4c4bc 꼬리 0x4cace — 필살 남은 횟수 0x38a30 (`specialSwingBadge`)
  if (scene.stagePhase !== undefined) drawSpecialSwingBadge(context, scene.stagePhase, scene.specialSwingRemaining ?? null, side)
  // 0x4c4bc 꼬리 0x4cad4 — 경기 스킬 표시 판 0x4b5b4 (`skillPanel`)
  if (scene.skillPanel !== undefined && scene.skillPanel !== null) drawSkillPanel(context, scene.skillPanel)
  // 홈런은 판정 글자(game_judge)가 없고 HOMERUN 글자 연출이 대신 나간다 (R2 3-2, 7절 표의 v = 8·12)
  if (scene.homeRunFrame !== undefined) {
    if (scene.homeRunFrame !== null) drawHomeRunTextFrame(context, scene.homeRunFrame)
    else if (!scene.isHomeRun && scene.resultText !== '') drawResultText(context, scene.resultText, scene.resultTick, side)
  } else if (scene.isHomeRun) {
    drawHomeRunBanner(context, scene.homeRunTick)
  } else if (scene.resultText !== '') {
    drawResultText(context, scene.resultText, scene.resultTick, side)
  }
  // 파티클은 상태 그리기가 다 끝난 뒤 — 장면 그리기 0x52c50 의 53050~53060(0x6de85 · 0x6dd69), 그 뒤 0x4e35c(기록 알림 따위)
  if (scene.particles !== null && scene.particles !== undefined) {
    drawParticles(context, scene.particles)
  }
}

/** 공격 팀 번호 — 초(측 0) · 말(측 1) 중 공격 측이 사람 측(`playerSide`, 기본 1)이면 우리 팀 */
export function offenseTeamIdOf(hud: HudState): number | null {
  const offenseSide = hud.half === '말' ? 1 : 0
  const teamId = offenseSide === (hud.playerSide ?? 1) ? hud.ourTeamId : hud.opponentTeamId
  return teamId ?? null
}

/** defender.mpl 은 팀 번호가 곧 벌 번호(15벌) — 범위 밖이면 구운 벌 (`pages/defense` 의 `defenderPaletteIndexOf` 와 같은 규칙) */
const DEFENDER_TEAM_COUNT = 15
function runnerPaletteIndexOf(teamId: number | null): number | null {
  if (teamId === null || !Number.isInteger(teamId) || teamId < 0 || teamId >= DEFENDER_TEAM_COUNT) return null
  return teamId
}

/**
 * 주루 칸을 그리는 상태 0xe — 웹은 쉬는 '대기'(0xd · 0xe 확인 대기 · 메뉴)로 본다 (⚠️ 근사: 0xd 를 못 가른다, `softKeyLabels` 와 같은 한계)
 */
function isRunPipState(phase: StagePhaseSnapshot | undefined): boolean {
  return phase?.kind === '대기' && phase.isPaused
}

const RUNNER_BASE_OF_ANIMATION: readonly BaseKey[] = ['first', 'second', 'third']

function drawBaseRunners(
  context: CanvasRenderingContext2D,
  hud: HudState,
  side: number,
  tick: number,
  showsRunPips: boolean,
  runnerAnimationSteps?: readonly (number | null)[],
  runnerAces?: RunnerAces,
): void {
  const paletteIndex = runnerPaletteIndexOf(offenseTeamIdOf(hud))
  const loadedAce = runnerAces === undefined ? null : loadedRunnerAceOf(runnerAces, hud.bases)
  // st[0x15 + i] — 도루를 출발한 주자의 루는 창도 주자도 안 그린다 (35c4a 가 그 루의 몸통을 통째로 건너뛴다)
  const hidden = hud.hiddenRunnerBases ?? []
  const shownBases = {
    first: hud.bases.first && !hidden.includes(1),
    second: hud.bases.second && !hidden.includes(2),
    third: hud.bases.third && !hidden.includes(3),
  }
  for (const draw of baseRunnerDrawsOf(shownBases, side)) {
    if (draw.kind === 'window') {
      const image = sprite(BASE_WINDOW_IMAGE)
      if (image === null) continue
      if (!draw.isMirrored) {
        context.drawImage(image, draw.x, draw.y)
        continue
      }
      // 효과 0x11 · 인자 0 — 제 상자 안에서 좌우 뒤집기
      context.save()
      context.translate(draw.x * 2 + image.width, 0)
      context.scale(-1, 1)
      context.drawImage(image, draw.x, draw.y)
      context.restore()
      continue
    }
    const base = RUNNER_BASE_OF_ANIMATION[draw.animation]
    const aceOfBase = base === undefined ? undefined : runnerAces?.[base]
    const aceFolder = aceRunnerFramesOf(aceOfBase !== undefined && aceOfBase !== null && aceOfBase >= 0, loadedAce)
    const folder = aceFolder ?? RUNNER_FRAMES
    const entries = frameAnimations(folder)?.[draw.animation]
    const clockStep = runnerAnimationSteps === undefined ? tick : runnerAnimationSteps[draw.animation]
    const step = entries === undefined || clockStep === null || clockStep === undefined ? null : loopingAnimationStepAt(entries, clockStep)
    if (step === null) continue
    // 0x79da9 — 마선수 그림(+0x1c)은 팔레트 없이, defender(+0xc)는 공격 팀 팔레트(+0x10)로
    const placed = placedFrame(folder, step.frame, aceFolder === null ? paletteIndex : null)
    if (placed === null) continue
    const x = draw.x + step.dx + placed.offsetX
    const y = draw.y + step.dy + placed.offsetY
    if (draw.isSilhouette) drawHalfShaded(context, placed.image, x, y)
    else context.drawImage(placed.image, x, y)
    // 35f4e~3604c — 같은 애니 칸의 상자(0x93e7d)를 상자 점에서 잡아 주루 칸을 잇따라 넣는다
    const runAbility = base === undefined ? undefined : hud.runnerRunAbilities?.[base]
    if (!showsRunPips || base === undefined || runAbility === undefined) continue
    const anchor = runnerBoxAnchorOf(base, side)
    const box = {
      x: anchor.x + step.dx + placed.offsetX,
      y: anchor.y + step.dy + placed.offsetY,
      width: placed.image.width,
      height: placed.image.height,
    }
    drawRunPips(context, runPipDrawsOf(base, box, runAbility))
  }
}

function drawRunPips(context: CanvasRenderingContext2D, pips: ReturnType<typeof runPipDrawsOf>): void {
  const image = sprite(RUN_PIP_IMAGE)
  if (image === null) return
  for (const pip of pips) {
    if (!pip.isEmpty) context.drawImage(image, pip.x, pip.y)
    else drawGrayed(context, image, pip.x, pip.y)
  }
}

/** 효과 0xa — 그림을 픽셀마다 원본 회색 식(0x97f01)으로 바꿔 그린다 (공용 `pixelEffect`) */
function drawGrayed(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number): void {
  context.drawImage(recoloredImageOf(image, DRAW_EFFECT.GRAY, 0), x, y)
}

/** 효과 0xc · 인자 0 — 픽셀마다 원본 반반 섞기(0x98351)로 채널을 반으로 (공용 `pixelEffect`) */
function drawHalfShaded(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number): void {
  context.drawImage(recoloredImageOf(image, DRAW_EFFECT.HALF_MIX, 0), x, y)
}

function drawPitcherMistakeMark(context: CanvasRenderingContext2D, scene: StageScene, side: number): void {
  const drawCall = scene.pitcherMistakeMarkDraw ?? null
  if (!showsPitcherMistakeMark(scene.scenery.gameMode, drawCall) || drawCall === null) return
  const entries = frameAnimations(PLAYER_EFFECT_FRAMES)?.[MISTAKE_MARK_ANIMATION]
  const step = entries === undefined ? null : pitcherFatigueFrameAt(entries, drawCall)
  const placed = step === null ? null : placedFrame(PLAYER_EFFECT_FRAMES, step.frame)
  if (step === null || placed === null) return
  // 38f24 x = 투수 x(좌투면 + 1) · 38f22 y = 투수 y − 0x34 · 효과 0 — 좌투도 안 뒤집는다
  const anchor = stageLayoutOf(side).pitcherAnchor
  const { axisX } = pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0)
  context.drawImage(placed.image, axisX + step.dx + placed.offsetX, anchor.y + MISTAKE_MARK_OFFSET_Y + step.dy + placed.offsetY)
}

function drawPitcherFatigue(context: CanvasRenderingContext2D, scene: StageScene, side: number, pitcherAnimation: PitcherAnimation): void {
  const stamina = scene.pitcherStaminaPercent
  if (stamina === null || stamina === undefined) return
  const shows = showsPitcherFatigue({
    gameMode: scene.scenery.gameMode,
    isAcePitcher: scene.acePitcher !== null,
    // 38f42 — 투구 객체 +0x14 == 0(선 자세)일 때만. 투구 뒤 마지막 자세(상태 1) · 대기 동작(상태 2)에는 안 그린다
    isThrowing: pitcherAnimation.state !== 0,
  })
  const animation = pitcherFatigueAnimationOf(stamina)
  if (!shows || animation === null) return
  const entries = frameAnimations(PLAYER_EFFECT_FRAMES)?.[animation]
  const step = entries === undefined ? null : pitcherFatigueFrameAt(entries, (scene.stagePhase?.tick ?? scene.tick) + 1)
  const placed = step === null ? null : placedFrame(PLAYER_EFFECT_FRAMES, step.frame)
  if (step === null || placed === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  const { axisX, isMirrored } = pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0)
  context.save()
  if (isMirrored) {
    context.translate(axisX * 2, 0)
    context.scale(-1, 1)
  }
  context.drawImage(placed.image, axisX + step.dx + placed.offsetX, anchor.y + step.dy + placed.offsetY)
  context.restore()
}

/** 좌투(손 1) — 그림을 뒤집고 x 를 1 옮긴다 (0x79524 효과 0x11 · 0x38db8) */
const LEFT_HANDED_PITCHER = 1

/** 투수 그림의 거울 축 x 와 뒤집기 — 좌투면 앵커 + 1 (0x38db8) 을 축으로 뒤집는다 (0x79524 효과 0x11) */
export function pitcherMirrorOf(anchorX: number, hand: number): { readonly axisX: number; readonly isMirrored: boolean } {
  const isMirrored = hand === LEFT_HANDED_PITCHER
  return { axisX: anchorX + (isMirrored ? 1 : 0), isMirrored }
}

/** 0x79524 의 마투수 순번 +0x3d — 2 는 ace/pitcher_bbmachine.pzx (적재 0x793b0 의 점프표 0xd3d64 · 이름 0xd3da8) */
const BBMACHINE_ACE_ORDER = 2

/**
 * 마투수 그림을 뒤집는가 — 그리기 0x79524 의 79568 갈래(그리기 목록이 있을 때):
 * ```
 * 79570  +0x3d == 2(bbmachine) 이면 효과 = 마지막 스택 인자 [sp+0x84] ≠ 0 ? 0 : 0x11       ; 손 +0x3c 는 안 본다
 * 795b4  그 밖 마투수는 효과 [sp+0x28] = +0x3c(손) ≠ 0 ? 0x11 : 0
 * ```
 * 경기 장면 0x38d1c 는 투수가 bbmachine(0xb63a1 == 2, 38e82)일 때만 그 인자를 `[장면+0x17e1](배치 = 타자 손) == 0 ? 1 : 0`
 * (38e9c~38eac)으로 넘긴다 — 곧 **bbmachine 은 투수 손과 상관없이 좌타(배치 1) 앞에서만 뒤집힌다**. x 의 좌투 + 1(0x38db8)은 그대로다.
 */
export function acePitcherMirrorsOf(aceOrder: number, isLeftHanded: boolean, side: number): boolean {
  if (aceOrder === BBMACHINE_ACE_ORDER) return side !== 0
  return isLeftHanded
}

/**
 * 투수 그림 객체의 그리기 0x79524. 마투수(+0x3d ≥ 0)는 79568 에서 갈려 실린 ace/pitcher_*.pzx 의 프레임 하나만 효과 0x11(좌투)로
 * 그리고, 평범한 투수는 바탕 · 장비 · 덧그림 여섯 칸을 쌓는다. 프레임은 0x9e0b8 이 상태 · 단계로 고른다 (`pitcherPoseOf`).
 */
function drawPitcher(
  context: CanvasRenderingContext2D,
  ace: StageScene['acePitcher'],
  animation: PitcherAnimation,
  side: number,
  equipment: PitcherEquipment = NO_PITCHER_EQUIPMENT,
  form = 0,
  hand = 0,
): void {
  // 투수 앵커 (프레임 원점 = 발밑) — 원본 표 0xcfb18 의 side 칸
  const { x: MOUND_CENTER_X, y: MOUND_BOTTOM_Y } = stageLayoutOf(side).pitcherAnchor
  const index = pitcherPoseOf(animation, form, ace?.order ?? null)
  // 좌투면 x + 1 (0x38db8) 자리를 축으로 거울을 놓는다 — 타자 그림과 같은 축 잡기(근사, `drawBatter` 주석)
  const { axisX, isMirrored } = pitcherMirrorOf(MOUND_CENTER_X, hand)

  if (ace === null) {
    context.save()
    if (isMirrored) {
      context.translate(axisX * 2, 0)
      context.scale(-1, 1)
    }
    // 원본 0x79524 는 바탕 프레임 f · 머리 · 몸 · **바탕 f+22** · 손 · 다리 여섯 칸을 이 차례로 쌓는다.
    // f+22 에 몸통·던지는 팔·글러브 안 공이 들어 있다 (PITCHER_OVERLAY_FRAME_OFFSET 주석).
    // 장비 칸은 등급 줄(.mpl)로 색만 갈리므로 타자와 같은 `layerPaletteIndexOf` 를 그대로 쓴다 —
    // 투수 폴더는 피부·팀 벌이 없어 뒤 두 인자는 무시된다 (`batterLayerPaletteIndex` 가 null).
    for (const layer of pitcherLayersOf(index, equipment)) {
      const frame = placedFrame(layer.folder, layer.frame, layerPaletteIndexOf(layer, 0, 0))
      if (frame === null) continue
      context.drawImage(frame.image, axisX + frame.offsetX, MOUND_BOTTOM_Y + frame.offsetY)
    }
    context.restore()
    return
  }

  // 마투수 — 단계 표 0xd7483 의 프레임 (ace/pitcher_*.pzx 의 프레임 번호 = frames/NNN.png, 원점 origins.json)
  if (ace.frameCount === 0) {
    // 프레임 합성이 안 된 캐릭터는 정지 그림이라도 세운다 — 다섯 마투수 모두 프레임이 있어 지금은 안 탄다
    const image = ace.stillUrl === '' ? null : sprite(ace.stillUrl)
    if (image !== null) context.drawImage(image, MOUND_CENTER_X - image.width / 2, MOUND_BOTTOM_Y - image.height)
    return
  }
  const mirrors = acePitcherMirrorsOf(ace.order, isMirrored, side)
  context.save()
  if (mirrors) {
    context.translate(axisX * 2, 0)
    context.scale(-1, 1)
  }
  // 효과 0 이면 프레임 0xc9f98 이 파트 효과를 따른다 — 드래고나 프레임 5~7 의 0x67 파트(b = 255)는 화면에 더한다.
  // 효과 0x11(뒤집기)은 ca074 갈래라 파트 효과 없이 모두 복사한다(`drawFrameAt` 의 partEffects)
  drawFrameAt(context, ace.framesUrl, index, axisX, MOUND_BOTTOM_Y, { partEffects: !mirrors })
  context.restore()
}

/** 투구 바람 줄(0x38dc6~0x38e5e)을 `pitchWindDrawCallOf` 로 보고 player_effect 애니 11 을 투수 점 옆 8 에 그린다 */
function drawPitchWind(context: CanvasRenderingContext2D, scene: StageScene, side: number, animation: PitcherAnimation): void {
  const drawCall = pitchWindDrawCallOf({
    state: animation.state,
    step: animation.step,
    pitcherTick: scene.pitcherTick,
    aceOrder: scene.acePitcher?.order ?? null,
  })
  if (drawCall === null) return
  const entries = frameAnimations(PLAYER_EFFECT_FRAMES)?.[PITCH_WIND_ANIMATION]
  const frameIndex = entries === undefined ? null : judgeFrameAt(entries, drawCall)
  const placed = frameIndex === null ? null : placedFrame(PLAYER_EFFECT_FRAMES, frameIndex)
  if (placed === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  // 38df0 — 좌투면 x − 8 · 효과 0x11: 투수 점(좌투 + 1)을 축으로 한 거울 안에서 x + 8
  const { axisX, isMirrored } = pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0)
  context.save()
  if (isMirrored) {
    context.translate(axisX * 2, 0)
    context.scale(-1, 1)
  }
  context.drawImage(placed.image, axisX + PITCH_WIND_OFFSET_X + placed.offsetX, anchor.y + placed.offsetY)
  context.restore()
}

/** 홈런 갈래(0x3908a)를 `pitcherHomeRunMarksOf` 로 보고 애니 12(평범한 투수) · 13 "!"(감상 플래그)를 그린다 */
function drawPitcherHomeRunMarks(
  context: CanvasRenderingContext2D,
  scene: StageScene,
  side: number,
  animation: PitcherAnimation,
): void {
  const mark = scene.pitcherHitMark ?? null
  const marks =
    mark === null || scene.pitcherTick === null
      ? null
      : pitcherHomeRunMarksOf({
          ...mark,
          pitcherTick: scene.pitcherTick,
          step: animation.step,
          aceOrder: scene.acePitcher?.order ?? null,
        })
  if (marks === null) return
  const animations = frameAnimations(PLAYER_EFFECT_FRAMES)
  if (animations === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  // 390d4 · 39136 — 좌투(0xb63c1)면 효과 0x11 로 투수 점(좌투 + 1)을 축으로 뒤집는다
  const { axisX, isMirrored } = pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0)
  const draw = (frameIndex: number, dx: number, dy: number) => {
    const placed = placedFrame(PLAYER_EFFECT_FRAMES, frameIndex)
    if (placed === null) return
    context.save()
    if (isMirrored) {
      context.translate(axisX * 2, 0)
      context.scale(-1, 1)
    }
    context.drawImage(placed.image, axisX + dx + placed.offsetX, anchor.y + dy + placed.offsetY)
    context.restore()
  }
  if (marks.showsPitcherAnimation) {
    const entries = animations[HOME_RUN_PITCHER_ANIMATION]
    const frameIndex = entries === undefined ? null : judgeFrameAt(entries, marks.drawCall)
    if (frameIndex !== null) draw(frameIndex, 0, 0)
  }
  if (marks.showsBang) {
    const entries = animations[MISTAKE_MARK_ANIMATION]
    const step = entries === undefined ? null : pitcherFatigueFrameAt(entries, marks.drawCall)
    if (step !== null) draw(step.frame, step.dx, MISTAKE_MARK_OFFSET_Y + step.dy)
  }
}

/**
 * 필살 그림 애니 0 의 지금 칸 (0xbe8a5 종류 2 → 0x93c45). 효과 0x11 · b 0 은 점 x 를 축으로 거울(R6 3b — x' = X − (dx + 폭))
 */
function drawSpecialSwingPicture(
  context: CanvasRenderingContext2D,
  special: NonNullable<StageScene['specialSwingEffect']>,
): void {
  const entries = frameAnimations(special.folder)?.[0]
  const frameIndex = entries === undefined ? null : specialSwingEffectFrameAt(entries, special.drawCall)
  if (frameIndex === null) return
  const x = Math.round(special.x)
  const y = Math.round(special.y) + special.offsetY
  context.save()
  if (special.isMirrored) {
    context.translate(x * 2, 0)
    context.scale(-1, 1)
  }
  // 0xbe8a5(…, 애니 0, 효과 0 | 0x11, …) — 효과 0 이면 medica_effect · effect_power 의 0x67 파트를 화면에 더한다(0xc9f98 ca198).
  // 0x11 이면 ca074 갈래 — 파트 효과 없이 복사
  drawFrameAt(context, special.folder, frameIndex, x, y, { partEffects: !special.isMirrored })
  context.restore()
}

/**
 * 원작 타자는 그림자·몸통·헬멧·배트·몸통 앞·다리를 자세마다 다른 순서로 겹친다 (0x78cfc).
 * 그림은 **좌타 자세로 그려져 있어** 우타(+0x3c == 0)면 효과 0x11 로 좌우를 뒤집는다 (R6 4절).
 * 앵커는 표 0xcfb2c 의 side 칸이고, 뒤집을 때는 그 앵커를 축으로 거울을 놓는다.
 *
 * 레이어마다 대체 팔레트 벌(`layerPaletteIndexOf`)을 붙여 그린다 — 몸통·헬멧은 피부×15+팀
 * (0x78be8·0x78c14), 장비 손·다리는 **등급 줄**(0x790f6·0x79252·0x7927e)이다.
 * 그림자·기본 배트는 .mpl 이 없어 원본도 구운 색 그대로다.
 */
function drawBatter(
  context: CanvasRenderingContext2D,
  swingFrame: number,
  shift: number,
  bodyType: number,
  side: number,
  skinIndex: number,
  teamIndex: number,
  equipment: BatterEquipment,
  aceOrder?: number,
): void {
  const anchor = stageLayoutOf(side).batterAnchor
  // 좌우 이동(fe4)은 원본도 객체 x(+4)에 그대로 더하므로 거울 축을 그 자리로 옮겨 방향을 지킨다.
  // 원본 엔진이 파트 상자 안에서 뒤집는지 그림 안에서 뒤집는지는 못 봤다 — 축 잡기는 **근사**다.
  const axisX = anchor.x + shift
  context.save()
  if (side === BATTER_SIDE.우타) {
    context.translate(axisX * 2, 0)
    context.scale(-1, 1)
  }
  const layers = isAceBatterOrder(aceOrder) ? aceBatterLayersOf(swingFrame, aceOrder) : batterLayersOf(swingFrame, bodyType, equipment)
  for (const layer of layers) {
    const frame = placedFrame(layer.folder, layer.frame, layerPaletteIndexOf(layer, skinIndex, teamIndex))
    if (frame === null) continue
    context.drawImage(frame.image, axisX + frame.offsetX, anchor.y + frame.offsetY)
  }
  context.restore()
}

/**
 * 존 표시 0x35ae8 (직접 떴다) — 선이 아니라 slt_pitch 프레임 0x49(73, 빨간 모서리)를 찍는다.
 * ```
 * 35aea  상태 [+0x1c] ∈ {0xd, 0xe, 0x13} 이면 안 그린다
 * 35b06  (w, h) = 0xba815(slt_pitch, 0x49, 종류 1)            ; 프레임 상자 37 × 37
 * 35b12  t = 표 0xcfb7c[+0x17e1] (타자 좌우)
 * 35b2c  x = 카메라 x + t.x + (w >> 1) − 2 ; y = 카메라 y + t.y + (h >> 1) − 2
 * 35b68  0xba759(slt_pitch, 0x49, 종류 1, x, y)               ; 프레임 원점(−18, −18)대로
 * ```
 * 카메라 (−120, −70) → 앵커 우타 (122, 256) · 좌타 (117, 256), 그림 왼쪽 위 우타 (104, 238) · 좌타 (99, 238).
 */
const ZONE_FRAME_FOLDER = './sprites/slt_pitch/frames'
const ZONE_FRAME_INDEX = 0x49
const ZONE_ANCHOR_INSET = 2

/** 존을 그리는 단계인가 — 0xd · 0xe(웹 '대기' 의 쉬는 동안, 근사) · 0x13('타격')에선 안 그린다. 단계를 모르면 그린다 */
export function showsStrikeZone(phase: StagePhaseSnapshot | undefined): boolean {
  if (phase === undefined) return true
  if (phase.kind === '타격') return false
  return !(phase.kind === '대기' && phase.isPaused)
}

/** 존 그림의 앵커 (프레임 원점을 더하기 전) — 존 표 왼쪽 위 + (상자 >> 1) − 2 */
export function strikeZoneAnchorOf(side: number, frameSize: { readonly width: number; readonly height: number }): { x: number; y: number } {
  const { zoneLeft, zoneTop } = stageLayoutOf(side)
  return {
    x: zoneLeft + (frameSize.width >> 1) - ZONE_ANCHOR_INSET,
    y: zoneTop + (frameSize.height >> 1) - ZONE_ANCHOR_INSET,
  }
}

function drawStrikeZone(context: CanvasRenderingContext2D, side: number): void {
  const frame = placedFrame(ZONE_FRAME_FOLDER, ZONE_FRAME_INDEX)
  if (frame === null) return
  const anchor = strikeZoneAnchorOf(side, frame.image)
  context.drawImage(frame.image, anchor.x + frame.offsetX, anchor.y + frame.offsetY)
}

/**
 * 이글아이 — 원본은 0x11 그리기 0x4d2ac 가 목표점에 ui/slt_pitch 프레임 0x23 을 넣는다(모드 4 · 레코드 +0x54 > 0, 0x4d380 ·
 * `pitchInputOverlay.showsGaugeTargetFrameOf`). 예전 웹이 그리던 원 · 십자는 원본에 없다.
 * 놓은 뒤에도 오차 전 0x10 목표점(+0x10b8)이다 — `eagleEyePixelOf`. ⚠️ +0xff4/+0xff8 흔들림은 안 얹는다.
 */
function drawEagleEyeMarker(context: CanvasRenderingContext2D, center: { x: number; y: number }): void {
  const frame = placedFrame(ZONE_FRAME_FOLDER, GAUGE_TARGET_FRAME)
  if (frame === null) return
  context.drawImage(frame.image, Math.round(center.x) + frame.offsetX, Math.round(center.y) + frame.offsetY)
}

/** 마투수 이펙트 재료 — 0x11 그림 수는 0x11 진입 뒤 그림 수가 그 마지막 갱신 틱을 넘지 않을 때만(0x12 · 0x13 은 0x11 이 아니다) */
function acePitcherEffectInputOf(scene: StageScene): AcePitcherEffectInput {
  const tick = scene.pitcherTick
  const end = scene.pitcherTickEnd ?? null
  return {
    aceOrder: scene.acePitcher?.order ?? null,
    pitch: scene.pitch,
    pitchStateDraw: tick !== null && tick >= 0 && (end === null || tick <= end) ? tick : null,
  }
}

/** effect_pitcher 애니 0 — 투수 앵커(뒤집기 · 좌투 +1 없음, 0x391c4) */
function drawEffectPitcher(context: CanvasRenderingContext2D, input: AcePitcherEffectInput, side: number): void {
  const entries = frameAnimations(EFFECT_PITCHER_FRAMES)?.[0]
  if (entries === undefined) return
  const frame = effectPitcherFrameAt(input, entries)
  const placed = frame === null ? null : placedFrame(EFFECT_PITCHER_FRAMES, frame)
  if (placed === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  context.drawImage(placed.image, anchor.x + placed.offsetX, anchor.y + placed.offsetY)
}

/** 0x47250 붕붕머신 · 발렌타인 애니 0 — 투수 앵커 */
function drawAceMagicAnimation(context: CanvasRenderingContext2D, input: AcePitcherEffectInput, side: number): void {
  const draw = aceMagicAnimationDrawOf(input, (folder) => frameAnimations(folder)?.[0] ?? null)
  const placed = draw === null ? null : placedFrame(draw.framesFolder, draw.frame)
  if (placed === null) return
  const anchor = stageLayoutOf(side).pitcherAnchor
  context.drawImage(placed.image, anchor.x + placed.offsetX, anchor.y + placed.offsetY)
}

/** 0x472ba · 0x47368 — 그림 0번 이미지를 s 배로 키워 투수 앵커 가운데에 반반 섞기 (0xbb91d 종류 0x12) */
function drawAceMagicScaled(context: CanvasRenderingContext2D, input: AcePitcherEffectInput, side: number, pose: number): void {
  const draw = aceMagicScaledDrawOf(input, pose)
  const image = draw === null ? null : sprite(draw.imageUrl)
  if (draw === null || image === null) return
  const origin = aceMagicScaledOriginOf(stageLayoutOf(side).pitcherAnchor, draw.scale, image.width, image.height)
  drawImageScaledBlend(context, image, origin.x, origin.y, draw.scale * 10, ACE_EFFECT_BLEND_WEIGHT)
}

/** ball.pzx 합성 프레임 — 원점이 공 가운데라 투영 좌표에 원점대로 놓는다 */
const BALL_FRAMES = './sprites/ball/frames'

function drawBall(context: CanvasRenderingContext2D, pitch: Pitch, frame: number): void {
  const position = ballPixelAt(pitch, frame)
  const ballFrame = ballFrameIndexAt(pitch, frame)
  const placed = placedFrame(BALL_FRAMES, ballFrame)

  if (placed === null) {
    context.fillStyle = UI_COLORS.ball
    context.beginPath()
    // 그림이 없을 때의 대체 동그라미 — 프레임 번호에서 종류(11칸 묶음)를 덜고 크기만 쓴다
    context.arc(position.x, position.y, 1 + (ballFrame % BALL_FRAMES_PER_KIND) / 2, 0, Math.PI * 2)
    context.fill()
    return
  }
  context.drawImage(placed.image, Math.round(position.x) + placed.offsetX, Math.round(position.y) + placed.offsetY)
}

/**
 * 마구 공 이펙트 (경기+0x1040, 0x3b546) — **공과 같은 화면 좌표**에 겹친다.
 * 무엇을 언제 그리는지는 전부 `magicBallEffect.ts` 가 들고 있다.
 */
function drawMagicBallEffect(context: CanvasRenderingContext2D, pitch: Pitch, frame: number): void {
  const folder = magicBallEffectFolderOf(pitch)
  if (folder === null) return
  // 원본이 쓰는 애니는 0 번 한 벌뿐이다 (effect_fire·effect_shinning 둘 다 [0,1,2,3])
  const entries = frameAnimations(folder)?.[0]
  if (entries === undefined) return
  const frameIndex = magicBallEffectFrameAt(entries, frame)
  if (frameIndex === null) return
  const placed = placedFrame(folder, frameIndex)
  if (placed === null) return

  const position = ballPixelAt(pitch, frame)
  context.drawImage(placed.image, Math.round(position.x) + placed.offsetX, Math.round(position.y) + placed.offsetY)
}

/** 강속구 불꽃 (R2 3-1) — game_effect 애니 1 을 공 화면 자리(마지막 점으로 잘린 0x35820)에 */
function drawFastballFlame(
  context: CanvasRenderingContext2D,
  pitch: Pitch,
  frame: number,
  phase: StagePhaseSnapshot | undefined,
): void {
  const ballTick = fastballFlameBallTickOf(phase, frame, pitch.frameCount)
  if (ballTick === null || !hasFastballFlame(pitch)) return
  const entries = frameAnimations(GAME_EFFECT_FRAMES)?.[FASTBALL_FLAME_ANIMATION]
  if (entries === undefined) return
  const frameIndex = fastballFlameFrameAt(entries, ballTick, pitch.frameCount)
  if (frameIndex === null) return
  const position = ballPixelAt(pitch, ballTick)
  // 3b7ce 0xbe8a5(…, 애니 1, 효과 0, …) — 칸 12~17 은 모두 0x67 파트라 화면에 더한다(0xc9f98 ca198 · 효과 2)
  drawFrameAt(context, GAME_EFFECT_FRAMES, frameIndex, Math.round(position.x), Math.round(position.y))
}

/**
 * 판정 글자 — game_judge 애니를 존 표 0xcfb7c[+0x17e1] 에서 잡은 원점(우타 (122,224) · 좌타 (117,224))에 재생한다
 * (0x39504 → 0x393b4). 애니가 없는 판정은 그리지 않는다 — 0x393b4 의 표 0xcfe90 은 v = 6 · 8 · 12 를 0x394d6 으로 건너뛰고
 * 원본 타석 화면에는 웹 글꼴 같은 큰 결과 글자가 없다 (F 노트 587~589). 홈런은 HOMERUN 연출(`isHomeRun`)이 대신 나간다.
 */
function drawResultText(context: CanvasRenderingContext2D, text: string, resultTick: number, side: number): void {
  const { x: centerX, y: centerY } = stageLayoutOf(side).judgeCenter
  const animation = judgeAnimationOf(text)
  if (animation === null) return
  const entries = frameAnimations(JUDGE_FRAMES)?.[animation]
  const frameIndex = entries === undefined ? null : judgeFrameAt(entries, resultTick)
  // 0x39474 0xba759(그림, 애니, 종류 2, x, y, 효과 0, …) — 애니 0 · 9 의 칸 20~29 에 든 0x67 파트는 화면에 더한다(0xc9f98 ca198)
  if (frameIndex !== null) drawFrameAt(context, JUDGE_FRAMES, frameIndex, centerX, centerY)
}

/**
 * 정산 효과 층 한 장 — 판이 깐 캔버스(`SettlementEffectLayers`)를 비우고 비 또는 파티클을 그린다.
 * 비 층은 효과 틱 0x4a452 자리(진 판 덮개 위 · 띠 아래), 파티클 층은 프레임 끝 0x6dd69 자리(판 맨 위)다.
 */
export function renderSettlementLayer(
  context: CanvasRenderingContext2D,
  content: { readonly rain?: SceneRain | null; readonly particles?: ParticleScene | null },
): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  if (content.rain !== null && content.rain !== undefined) drawRain(context, content.rain)
  if (content.particles !== null && content.particles !== undefined) drawParticles(context, content.particles)
}

/** 비 그리기 — 빗방울 0x8f8ec(선, 0xc7c7c7 · 짙기 +0xe) · 튐 0x8fb08(흰 점, 수명 3 은 가로선 ±2 도) */
function drawRain(context: CanvasRenderingContext2D, rain: SceneRain): void {
  const { lines, dots, bars } = rainDrawingOf(rain)
  context.save()
  context.lineWidth = 1
  context.strokeStyle = '#c7c7c7'
  for (const line of lines) {
    context.globalAlpha = line.alpha / 255
    context.beginPath()
    context.moveTo(line.x0 + 0.5, line.y0 + 0.5)
    context.lineTo(line.x1 + 0.5, line.y1 + 0.5)
    context.stroke()
  }
  context.globalAlpha = 1
  context.strokeStyle = '#ffffff'
  context.fillStyle = '#ffffff'
  for (const bar of bars) context.fillRect(bar.x - 2, bar.y, 5, 1)
  for (const dot of dots) context.fillRect(dot.x, dot.y, 1, 1)
  context.restore()
}


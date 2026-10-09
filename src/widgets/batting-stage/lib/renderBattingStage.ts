import type { Pitch } from '@/entities/pitching/model/pitch'
import { BALL_FRAMES_PER_KIND } from '@/entities/pitching/model/pitchCurve'
import { ballFrameIndexAt, ballPixelAt, platePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import { frameAnimations, GAME_EFFECT_FRAMES, JUDGE_FRAMES, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { drawScenery } from '@/widgets/batting-stage/lib/renderScenery'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery'
import { judgeAnimationOf, judgeFrameAt, pitcherFrameAt, pitcherIdleFrameAt, skyColumnOfInning } from '@/widgets/batting-stage/lib/stageScenery'

import { heldBallTickOf } from '@/widgets/batting-stage/lib/heldBall'
import { magicBallEffectFolderOf, magicBallEffectFrameAt } from '@/widgets/batting-stage/lib/magicBallEffect'
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
import { drawSoftKeyLabels } from '@/widgets/batting-stage/lib/softKeyLabels'
import {
  BASE_WINDOW_IMAGE,
  RUNNER_FRAMES,
  RUN_PIP_IMAGE,
  baseRunnerDrawsOf,
  grayRunPipPixel,
  loopingAnimationStepAt,
  runPipDrawsOf,
  runnerBoxAnchorOf,
  showsBaseRunners,
  type BaseKey,
} from '@/widgets/batting-stage/lib/baseRunners'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { drawSpecialSwingBadge } from '@/widgets/batting-stage/lib/specialSwingBadge'
import { drawPitchSpeedReadout } from '@/widgets/batting-stage/lib/pitchSpeedReadout'
import { drawDerbyPitchingMachine } from '@/widgets/batting-stage/lib/derbyPitchingMachine'
import { drawHomeRunBanner, drawHomeRunTextFrame } from '@/widgets/batting-stage/lib/renderHomeRunBanner'
import type { HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner'
import { batterLayersOf, layerPaletteIndexOf, NO_PITCHER_EQUIPMENT, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'

import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { BATTER_SIDE, STAGE_SIDE, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { UI_COLORS } from '@/shared/config/design'
import { PIXEL_FONT_FAMILY } from '@/app/styles/theme.css'

export { STAGE_HEIGHT, STAGE_WIDTH, toPixel, toZoneCoordinate } from '@/widgets/batting-stage/lib/stageLayout'

export interface StageScene {
  readonly pitch: Pitch | null
  /** 공 프레임 F (0 = 릴리스). 공이 아직 손을 떠나지 않았으면 음수 */
  readonly frame: number
  /** 투구 시작 뒤 흐른 틱. 투구 중이 아니면 null — 투수는 대기 동작 */
  readonly pitcherTick: number | null
  /** 화면이 열린 뒤 흐른 틱 — 대기 동작 · 구름 */
  readonly tick: number
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
   * 마운드에 선 투수의 **장착 장비 등급** (0x79790 적재 · 0x79524 여섯 칸).
   * 안 넘기면 맨몸 투수라 지금까지와 똑같이 바탕 f · f+22 두 겹만 그린다.
   *
   * ⚠️ 지금 이 칸을 채워 주는 화면이 **하나도 없고, 타석 화면은 원본에도 채울 자리가 아니다.**
   * 원본 경기 장면(0x108f8)은 그림 한 칸만 세우고 모드로 갈린다 — 모드 4(타자편)면 타자 그림,
   * **아니면 투수 그림**이다. 그러니 장비를 입은 투수 그림은 **모드 3 투수편의 "내 투수"** 뿐이고,
   * 타석 화면 마운드의 상대 투수는 그 객체가 아니다 (`batterLayers.pitcherEquipmentOf` 주석).
   *
   * 웹에서 이 칸을 채우려면 먼저 두 가지가 있어야 한다:
   *   1. 투수편 상점 — **이제 있다**: 투수편 장비 상점·장비착용(d15c14d, `features/shop/model/pitcherShopSelection`)이
   *      `PitcherCareer.equipmentLevels` 니블을 채운다.
   *   2. **투수편 경기 화면의 투수 그림** — `pages/pitching/PitcherGameScreen` 은 캔버스 없이
   *      패널로만 그려서 `BattingStage` 를 아예 쓰지 않는다. 남은 것은 이것 하나다.
   * 그것이 생기면 `batterLayers.pitcherEquipmentOf(career.equipmentLevels)` 한 줄이면 된다.
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
  readonly acePitcher: {
    readonly framesUrl: string
    readonly frameCount: number
    readonly stillUrl: string
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
  const progress = scene.pitch === null || scene.frame < 0 ? -1 : scene.frame / scene.pitch.frameCount
  // 루상 주자 0x35b94 — 그리기 목록에 깊이 24499(투수판 z − 1)로 들어가 투수·타자보다 먼저(뒤에) 그려진다 (유력)
  if (scene.hud !== null && showsBaseRunners(scene.stagePhase)) {
    drawBaseRunners(context, scene.hud, side, scene.tick, isRunPipState(scene.stagePhase))
  }
  drawPitcher(context, scene.acePitcher, progress, scene.pitcherTick, scene.tick, side, scene.pitcherEquipment, scene.pitcherForm ?? 0, scene.pitcherHand ?? 0)
  drawBatter(context, scene.swingFrame, scene.shift, scene.bodyType, side, scene.batterSkinIndex, scene.batterTeamIndex, scene.batterEquipment)
  if (scene.pitch !== null && scene.isEagleEyeEnabled) {
    drawEagleEyeMarker(context, platePixelOf(scene.pitch))
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
  if (scene.hud !== null) {
    // 틱을 넘기는 까닭 = 새 램프 확대 연출(0x37828)이 5틱 동안 배율을 줄인다
    drawHud(context, scene.hud, scene.tick)
  }
  // 0x4c4bc 가 HUD(0x4c50c) 다음 0x4c53c 에서 존 0x35ae8 을 부른다 — 그리기 목록(투수·타자·공, 0xbe6a1) 위다
  if (showsStrikeZone(scene.stagePhase)) drawStrikeZone(context, side)
  // 0x4c4bc 꼬리 0x4c8e0 — "*MENU" · "#TIME" (`softKeyLabels`)
  if (scene.stagePhase !== undefined) drawSoftKeyLabels(context, scene.stagePhase, scene.timeKeyCount ?? null)
  // 0x4c4bc 의 0x4c9fc — 상태 0x12 의 "Km" 판 · 표시 구속 [+0x19a0] (`pitchSpeedReadout`)
  if (scene.stagePhase !== undefined) drawPitchSpeedReadout(context, scene.stagePhase, scene.pitch?.displaySpeedKmh)
  // 0x4c4bc 꼬리 0x4cace — 필살 남은 횟수 0x38a30 (`specialSwingBadge`)
  if (scene.stagePhase !== undefined) drawSpecialSwingBadge(context, scene.stagePhase, scene.specialSwingRemaining ?? null, side)
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
): void {
  const paletteIndex = runnerPaletteIndexOf(offenseTeamIdOf(hud))
  for (const draw of baseRunnerDrawsOf(hud.bases, side)) {
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
    const entries = frameAnimations(RUNNER_FRAMES)?.[draw.animation]
    const step = entries === undefined ? null : loopingAnimationStepAt(entries, tick)
    if (step === null) continue
    const placed = placedFrame(RUNNER_FRAMES, step.frame, paletteIndex)
    if (placed === null) continue
    const x = draw.x + step.dx + placed.offsetX
    const y = draw.y + step.dy + placed.offsetY
    if (draw.isSilhouette) drawSilhouette(context, placed.image, x, y, '#000000')
    else context.drawImage(placed.image, x, y)
    // 35f4e~3604c — 같은 애니 칸의 상자(0x93e7d)를 상자 점에서 잡아 주루 칸을 잇따라 넣는다
    const base = RUNNER_BASE_OF_ANIMATION[draw.animation]
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

/** 효과 0xa — 그림을 픽셀마다 원본 회색 식(0x97f01)으로 바꿔 그린다 (`grayRunPipPixel`) */
function drawGrayed(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number): void {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const layer = canvas.getContext('2d')
  if (layer === null) return
  layer.drawImage(image, 0, 0)
  const pixels = layer.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue
    const gray = grayRunPipPixel(data[offset], data[offset + 1], data[offset + 2])
    data[offset] = gray.r
    data[offset + 1] = gray.g
    data[offset + 2] = gray.b
  }
  layer.putImageData(pixels, 0, 0)
  context.drawImage(canvas, x, y)
}

/** 효과 0xc · 인자 색 — 그림 모양대로 한 색으로 칠한다(R2: 섞는 식은 미해결, 레이저 반짝임과 같은 근사) */
function drawSilhouette(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, color: string): void {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const layer = canvas.getContext('2d')
  if (layer === null) return
  layer.drawImage(image, 0, 0)
  layer.globalCompositeOperation = 'source-in'
  layer.fillStyle = color
  layer.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(canvas, x, y)
}

/** 좌투(손 1) — 그림을 뒤집고 x 를 1 옮긴다 (0x79524 효과 0x11 · 0x38db8) */
const LEFT_HANDED_PITCHER = 1

/** 투수 그림의 거울 축 x 와 뒤집기 — 좌투면 앵커 + 1 (0x38db8) 을 축으로 뒤집는다 (0x79524 효과 0x11) */
export function pitcherMirrorOf(anchorX: number, hand: number): { readonly axisX: number; readonly isMirrored: boolean } {
  const isMirrored = hand === LEFT_HANDED_PITCHER
  return { axisX: anchorX + (isMirrored ? 1 : 0), isMirrored }
}

function drawPitcher(
  context: CanvasRenderingContext2D,
  ace: StageScene['acePitcher'],
  progress: number,
  pitcherTick: number | null,
  tick: number,
  side: number,
  equipment: PitcherEquipment = NO_PITCHER_EQUIPMENT,
  form = 0,
  hand = 0,
): void {
  // 투수 앵커 (프레임 원점 = 발밑) — 원본 표 0xcfb18 의 side 칸
  const { x: MOUND_CENTER_X, y: MOUND_BOTTOM_Y } = stageLayoutOf(side).pitcherAnchor
  const ratio = progress < 0 ? 0 : Math.min(1, progress)

  if (ace === null) {
    // 투구 단계 표 (0x9e0b8, 폼 >> 1 로 갈린다) · 대기 동작 (state 2)
    const index = pitcherTick === null ? pitcherIdleFrameAt(tick) : pitcherFrameAt(form, pitcherTick)
    // 좌투면 x + 1 (0x38db8) 자리를 축으로 거울을 놓는다 — 타자 그림과 같은 축 잡기(근사, `drawBatter` 주석)
    const { axisX, isMirrored } = pitcherMirrorOf(MOUND_CENTER_X, hand)
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

  // 마선수 단계 표(0xd7483)는 아직 옮기지 않아 합성 프레임을 진행률로 돌린다 (추정).
  // 프레임 합성이 안 된 캐릭터는 정지 그림이라도 세운다 — 아무것도 안 그리는 것보다 낫다.
  let image: HTMLImageElement | null
  if (ace.frameCount === 0) {
    image = ace.stillUrl === '' ? null : sprite(ace.stillUrl)
  } else {
    const index = Math.min(ace.frameCount - 1, Math.floor(ratio * ace.frameCount))
    image = sprite(`${ace.framesUrl}/${String(index).padStart(3, '0')}.png`)
  }
  if (image === null) return

  context.drawImage(image, MOUND_CENTER_X - image.width / 2, MOUND_BOTTOM_Y - image.height)
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
  for (const layer of batterLayersOf(swingFrame, bodyType, equipment)) {
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

function drawEagleEyeMarker(context: CanvasRenderingContext2D, center: { x: number; y: number }): void {
  context.strokeStyle = UI_COLORS.eagleEye
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(center.x, center.y, 8, 0, Math.PI * 2)
  context.stroke()
  context.beginPath()
  context.moveTo(center.x - 11, center.y)
  context.lineTo(center.x + 11, center.y)
  context.moveTo(center.x, center.y - 11)
  context.lineTo(center.x, center.y + 11)
  context.stroke()
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
  const placed = placedFrame(GAME_EFFECT_FRAMES, frameIndex)
  if (placed === null) return
  const position = ballPixelAt(pitch, ballTick)
  context.drawImage(placed.image, Math.round(position.x) + placed.offsetX, Math.round(position.y) + placed.offsetY)
}

/**
 * 판정 글자 — game_judge 애니를 존 표 0xcfb7c[+0x17e1] 에서 잡은 원점(우타 (122,224) · 좌타 (117,224))에 재생한다
 * (0x39504 → 0x393b4). 해당 애니가 없는 문구는 글자로 쓴다
 */
function drawResultText(context: CanvasRenderingContext2D, text: string, resultTick: number, side: number): void {
  const { x: centerX, y: centerY } = stageLayoutOf(side).judgeCenter
  const animation = judgeAnimationOf(text)
  if (animation !== null) {
    const entries = frameAnimations(JUDGE_FRAMES)?.[animation]
    const frameIndex = entries === undefined ? null : judgeFrameAt(entries, resultTick)
    const frame = frameIndex === null ? null : placedFrame(JUDGE_FRAMES, frameIndex)
    if (frame !== null) context.drawImage(frame.image, centerX + frame.offsetX, centerY + frame.offsetY)
    return
  }

  // 원본 글꼴 웹폰트를 정수 2배(22px)로 쓴다 — 11 의 정수배여야 도트가 안 뭉갠다.
  // 캔버스 `ctx.font` 는 CSS 변수를 못 읽어 `PIXEL_FONT_FAMILY` 상수를 직접 끼운다.
  // 굵게(bold)는 빼 둔다 — 비트맵 글꼴에 굵은 자형이 없어 브라우저가 억지로 번지게 그린다.
  context.font = `22px '${PIXEL_FONT_FAMILY}', 'Galmuri11', sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = 4
  context.strokeStyle = UI_COLORS.resultOutline
  context.strokeText(text, centerX, centerY)
  context.fillStyle = UI_COLORS.resultText
  context.fillText(text, centerX, centerY)
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


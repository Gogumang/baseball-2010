import type { Pitch } from '@/entities/pitching/model/pitch'
import { BALL_FRAMES_PER_KIND } from '@/entities/pitching/model/pitchCurve'
import { ballFrameIndexAt, ballPixelAt, platePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import { frameAnimations, JUDGE_FRAMES, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { drawScenery } from '@/widgets/batting-stage/lib/renderScenery'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery'
import { judgeAnimationOf, judgeFrameAt, pitcherFrameAt, pitcherIdleFrameAt } from '@/widgets/batting-stage/lib/stageScenery'

import { magicBallEffectFolderOf, magicBallEffectFrameAt } from '@/widgets/batting-stage/lib/magicBallEffect'
import { drawParticles } from '@/widgets/particles/lib/renderParticles'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import { drawHud } from '@/widgets/batting-stage/lib/renderHud'
import { drawFieldMap } from '@/widgets/batting-stage/lib/renderFieldMap'
import { drawHomeRunBanner } from '@/widgets/batting-stage/lib/renderHomeRunBanner'
import { batterLayersOf, layerPaletteIndexOf, NO_PITCHER_EQUIPMENT, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'

import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { BATTER_SIDE, STAGE_SIDE, stageLayoutOf, toPixel } from '@/widgets/batting-stage/lib/stageLayout'
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
  readonly scenery: Omit<SceneryState, 'tick' | 'inning' | 'ourTeamId' | 'opponentTeamId'>
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
   * 살아 있는 파티클. 없으면 안 그린다.
   * ⚠️ 그리는 **순서**는 근사다 — 원본 파티클 관리자의 그리기가 타석 화면 묶음(0x50828)의
   * 어느 자리에서 도는지 못 봤다. 여기서는 선수·공 위, 전광판·판정 글자 아래에 둔다.
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
   *   1. **투수편 상점** — `PitcherCareer.equipmentLevels` 를 0 말고 다른 값으로 만드는 곳이
   *      아직 없다 (타자편 `features/shop` 만 이식됐다).
   *   2. **투수편 경기 화면의 투수 그림** — `pages/pitching/PitcherGameScreen` 은 캔버스 없이
   *      패널로만 그려서 `BattingStage` 를 아예 쓰지 않는다.
   * 둘이 생기면 `batterLayers.pitcherEquipmentOf(career.equipmentLevels)` 한 줄이면 된다.
   */
  readonly pitcherEquipment?: PitcherEquipment
  readonly acePitcher: {
    readonly framesUrl: string
    readonly frameCount: number
    readonly stillUrl: string
  } | null
}

export function renderBattingStage(
  context: CanvasRenderingContext2D,
  scene: StageScene,
): void {
  const side = scene.side ?? STAGE_SIDE
  drawScenery(context, {
    ...scene.scenery,
    tick: scene.tick,
    side,
    inning: scene.hud?.inning ?? 1,
    ourTeamId: scene.hud?.ourTeamId ?? null,
    opponentTeamId: scene.hud?.opponentTeamId ?? null,
  })
  const progress = scene.pitch === null || scene.frame < 0 ? -1 : scene.frame / scene.pitch.frameCount
  drawPitcher(context, scene.acePitcher, progress, scene.pitcherTick, scene.tick, side, scene.pitcherEquipment)
  drawBatter(context, scene.swingFrame, scene.shift, scene.bodyType, side, scene.batterSkinIndex, scene.batterTeamIndex, scene.batterEquipment)
  drawStrikeZone(context, side)
  if (scene.pitch !== null && scene.isEagleEyeEnabled) {
    drawEagleEyeMarker(context, platePixelOf(scene.pitch))
  }
  if (scene.pitch !== null && scene.frame >= 0 && scene.frame < scene.pitch.frameCount) {
    drawBall(context, scene.pitch, scene.frame)
    // 마구 이펙트는 원본에서도 공 **다음**에 그려 공 위에 얹힌다 (0x3b422 공 → 0x3b546 이펙트)
    drawMagicBallEffect(context, scene.pitch, scene.frame)
  }
  if (scene.particles !== null && scene.particles !== undefined) {
    drawParticles(context, scene.particles)
  }
  if (scene.hud !== null) {
    // 틱을 넘기는 까닭 = 새 램프 확대 연출(0x37828)이 5틱 동안 배율을 줄인다
    drawHud(context, scene.hud, scene.tick)
    // 전광판과 별개로 원본이 타석 중에 그리는 작은 지도 (0x395f4) — 루상 주자가 여기 보인다
    drawFieldMap(context, scene.hud.bases)
  }
  // 홈런은 판정 글자(game_judge)가 없고 HOMERUN 글자 연출이 대신 나간다 (R2 3-2, 7절 표의 v = 8·12)
  if (scene.isHomeRun) {
    drawHomeRunBanner(context, scene.homeRunTick)
  } else if (scene.resultText !== '') {
    drawResultText(context, scene.resultText, scene.resultTick)
  }
}

/** 일반 투수 폼 — 원본 투수 명단 첫 선수의 폼(0)으로 둔다 (추정). 홀수 폼이면 좌우 반전이다 */
const PITCHER_FORM = 0

function drawPitcher(
  context: CanvasRenderingContext2D,
  ace: StageScene['acePitcher'],
  progress: number,
  pitcherTick: number | null,
  tick: number,
  side: number,
  equipment: PitcherEquipment = NO_PITCHER_EQUIPMENT,
): void {
  // 투수 앵커 (프레임 원점 = 발밑) — 원본 표 0xcfb18 의 side 칸
  const { x: MOUND_CENTER_X, y: MOUND_BOTTOM_Y } = stageLayoutOf(side).pitcherAnchor
  const ratio = progress < 0 ? 0 : Math.min(1, progress)

  if (ace === null) {
    // 투구 단계 표 (0x9e0b8) · 대기 동작 (state 2)
    const index = pitcherTick === null ? pitcherIdleFrameAt(tick) : pitcherFrameAt(PITCHER_FORM, pitcherTick)
    // 원본 0x79524 는 바탕 프레임 f · 머리 · 몸 · **바탕 f+22** · 손 · 다리 여섯 칸을 이 차례로 쌓는다.
    // f+22 에 몸통·던지는 팔·글러브 안 공이 들어 있다 (PITCHER_OVERLAY_FRAME_OFFSET 주석).
    // 장비 칸은 등급 줄(.mpl)로 색만 갈리므로 타자와 같은 `layerPaletteIndexOf` 를 그대로 쓴다 —
    // 투수 폴더는 피부·팀 벌이 없어 뒤 두 인자는 무시된다 (`batterLayerPaletteIndex` 가 null).
    for (const layer of pitcherLayersOf(index, equipment)) {
      const frame = placedFrame(layer.folder, layer.frame, layerPaletteIndexOf(layer, 0, 0))
      if (frame === null) continue
      context.drawImage(frame.image, MOUND_CENTER_X + frame.offsetX, MOUND_BOTTOM_Y + frame.offsetY)
    }
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

/** 존 표시는 선이 아니라 slt_pitch 프레임 73(빨간 모서리)을 존 가운데에 찍는다 (0x35ae8) */
const ZONE_FRAME_FOLDER = './sprites/slt_pitch/frames'
const ZONE_FRAME_INDEX = 73

function drawStrikeZone(context: CanvasRenderingContext2D, side: number): void {
  const frame = placedFrame(ZONE_FRAME_FOLDER, ZONE_FRAME_INDEX)
  if (frame === null) return
  const center = toPixel({ x: 0, y: 0 }, side)
  context.drawImage(frame.image, Math.round(center.x) + frame.offsetX, Math.round(center.y) + frame.offsetY)
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

/** 판정 글자 — game_judge 애니를 (117,224) 원점에 재생한다 (0x39504 → 0x393b4). 해당 애니가 없는 문구는 글자로 쓴다 */
function drawResultText(context: CanvasRenderingContext2D, text: string, resultTick: number): void {
  const { x: centerX, y: centerY } = stageLayoutOf().judgeCenter
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

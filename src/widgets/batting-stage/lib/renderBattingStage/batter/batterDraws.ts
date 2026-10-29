/** 타자 쪽 그림을 그리기 목록에 — 필살 그림 · 타자(0x49e64) · 미라지 · 타격 불꽃 · 사구 표시 · 이글아이 · 투구 UI 몫 */
import { eagleEyePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import { drawPitchInputSprites } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { BATTER_SIDE } from '@/widgets/batting-stage/lib/stageLayout'
import { drawCallWithRedraws } from '@/widgets/batting-stage/lib/stageRedraws'
import { DRAW_DEPTH, HIT_FLAME_DEPTH_STEP, type StageDrawList } from '@/widgets/batting-stage/lib/renderBattingStage/drawList'
import { drawBatter, type BatterLook } from '@/widgets/batting-stage/lib/renderBattingStage/batter/drawBatter'
import { drawHitByPitchMark, drawHitFlame, drawSpecialSwingPicture } from '@/widgets/batting-stage/lib/renderBattingStage/batter/batterMarks'
import { drawEagleEyeMarker } from '@/widgets/batting-stage/lib/renderBattingStage/strikeZone'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

type SpecialSwing = NonNullable<StageScene['specialSwingEffect']>

/** 49d50 애니 0 은 그림마다 한 칸 — 부르는 쪽은 장면 틱으로 센 수를 넘기고 창 첫 그림은 여기서 더한다(`stageRedraws`) */
function specialSwingOf(scene: StageScene): SpecialSwing | null {
  const tickSpecial = scene.specialSwingEffect ?? null
  if (tickSpecial === null) return null
  return { ...tickSpecial, drawCall: drawCallWithRedraws(tickSpecial.drawCall, scene.tick, scene.redrawTicks) }
}

function batterLookOf(scene: StageScene): BatterLook {
  return {
    swingFrame: scene.swingFrame,
    shift: scene.shift,
    bodyType: scene.bodyType,
    skinIndex: scene.batterSkinIndex,
    teamIndex: scene.batterTeamIndex,
    equipment: scene.batterEquipment,
    aceOrder: scene.aceBatterOrder,
  }
}

export function addBatterDraws(context: CanvasRenderingContext2D, drawList: StageDrawList, scene: StageScene, side: number): void {
  const special = specialSwingOf(scene)
  const look = batterLookOf(scene)
  // 0x49aec 의 그림은 그리기 목록 깊이로 줄 선다 — 깊이 29704(플레임 · 어거지죠)는 타자(29705) 아래
  if (special?.isBehindBatter === true) drawList.add(DRAW_DEPTH.타자 - 1, () => drawSpecialSwingPicture(context, special))
  drawList.add(DRAW_DEPTH.타자, () => drawBatter(context, look, side))
  // 미라지(49c9c~49d40) — 같은 타자 그림을 반대쪽 타석 앵커(0xcfb34 / 0xcfb2c)에 반대 손 자세로, 좌우 이동(+0xfe4) 없이 한 장 더
  if (special?.showsMirage === true) {
    const mirageSide = side === BATTER_SIDE.우타 ? BATTER_SIDE.좌타 : BATTER_SIDE.우타
    drawList.add(DRAW_DEPTH.타자, () => drawBatter(context, { ...look, shift: 0, aceOrder: undefined }, mirageSide))
  }
  if (special?.isBehindBatter === false) drawList.add(DRAW_DEPTH.타자, () => drawSpecialSwingPicture(context, special))
  addBatterMarkDraws(context, drawList, scene, side)
}

/** 타자 뒤에 넣는 표시 — 타격 불꽃 · 사구 표시 · 이글아이 · 투구 UI 의 그리기 목록 몫 */
function addBatterMarkDraws(context: CanvasRenderingContext2D, drawList: StageDrawList, scene: StageScene, side: number): void {
  // 0x49e64 꼬리 — 보통 타격 불꽃(깊이 타자 + 10) · 사구 표시(타자 깊이, 타자 뒤에 넣는다). 둘 다 그림마다 한 칸(4a0a0 · 4a12a 0x93d91)
  // — 창 첫 그림도 센다(`stageRedraws`)
  drawList.add(DRAW_DEPTH.타자 + HIT_FLAME_DEPTH_STEP, () => drawHitFlame(context, scene))
  drawList.add(DRAW_DEPTH.타자, () => drawHitByPitchMark(context, scene, side))
  // 0x4d2ac 4d3ee — 이글아이 프레임 0x23 은 깊이 [0xcfa8c + 0x14] = 29705
  if (scene.pitch !== null && scene.isEagleEyeEnabled) {
    const marker = eagleEyePixelOf(scene.pitch)
    drawList.add(DRAW_DEPTH.타자, () => drawEagleEyeMarker(context, marker))
  }
  // 0x4d780 · 0x4d2ac 의 그리기 목록 몫(애니 0 · 이름 · 게이지) — 깊이 29705(타자와 같다), 타자(0x49e64) 다음 · 공(0x3b2f4) 앞에 넣는다
  drawList.add(DRAW_DEPTH.타자, () => drawPitchInputSprites(context, scene.pitchInput ?? null, side))
}

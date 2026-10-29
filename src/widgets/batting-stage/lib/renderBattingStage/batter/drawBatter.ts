/** 타자 그림 객체의 그리기 0x78cfc 와 그 겹의 미리 칠하기 */
import { placedFrame, warmRecoloredFrames } from '@/widgets/batting-stage/lib/spriteLoader'
import {
  aceBatterLayersOf,
  batterLayersOf,
  batterPoseFramesOf,
  isAceBatterOrder,
  layerPaletteIndexOf,
} from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { BATTER_SIDE, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { drawMirroredAt } from '@/widgets/batting-stage/lib/renderBattingStage/mirror'

/**
 * 이 타자가 그릴 수 있는 자세(대기 · 스윙 · 번트, `batterPoseFramesOf`)의 다시 칠할 겹을 미리 칠해 둔다 — 처음 스윙하는 틱에
 * 칠하기를 걸면 칠이 끝날 때까지 구운 벌이 비친다(`warmRecoloredFrame`). 원점 · 팔레트가 다 와서 다 걸면 다시 안 본다.
 */
export function warmBatterRecolors(bodyType: number, skinIndex: number, teamIndex: number, equipment: BatterEquipment): boolean {
  return warmRecoloredFrames(`batter|${bodyType}|${skinIndex}|${teamIndex}|${JSON.stringify(equipment)}`, () =>
    batterPoseFramesOf(bodyType).flatMap((pose) =>
      batterLayersOf(pose, bodyType, equipment).map((layer) => ({
        folder: layer.folder,
        frame: layer.frame,
        paletteIndex: layerPaletteIndexOf(layer, skinIndex, teamIndex),
      })),
    ),
  )
}

/** 타자 한 장의 재료 — 자세 f · 좌우 이동 fe4 · 몸통 · 피부 · 팀 · 장비 · 마타자 순번 */
export interface BatterLook {
  readonly swingFrame: number
  readonly shift: number
  readonly bodyType: number
  readonly skinIndex: number
  readonly teamIndex: number
  readonly equipment: BatterEquipment
  readonly aceOrder?: number
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
export function drawBatter(context: CanvasRenderingContext2D, look: BatterLook, side: number): void {
  const anchor = stageLayoutOf(side).batterAnchor
  // 좌우 이동(fe4)은 원본도 객체 x(+4)에 그대로 더하므로 거울 축을 그 자리로 옮겨 방향을 지킨다.
  // 원본 엔진이 파트 상자 안에서 뒤집는지 그림 안에서 뒤집는지는 못 봤다 — 축 잡기는 **근사**다.
  const axisX = anchor.x + look.shift
  // 우타는 파트 프레임 vt+0x10 을 효과 0x11 로 부른다(78d16 · 78d80) — 0xc9f98 ca07c 갈래라 0x66 반투명 파트(머리 장비 3~6)도
  // 섞지 않고 복사한다(`placedFrame` 의 복사판). 좌타(효과 0)는 구운 프레임(반투명 L/16 의 알파 근사)
  const isFlipped = side === BATTER_SIDE.우타
  drawMirroredAt(context, axisX, isFlipped, () => {
    const { aceOrder } = look
    const layers = isAceBatterOrder(aceOrder)
      ? aceBatterLayersOf(look.swingFrame, aceOrder)
      : batterLayersOf(look.swingFrame, look.bodyType, look.equipment)
    if (!isAceBatterOrder(aceOrder)) warmBatterRecolors(look.bodyType, look.skinIndex, look.teamIndex, look.equipment)
    for (const layer of layers) {
      const frame = placedFrame(layer.folder, layer.frame, layerPaletteIndexOf(layer, look.skinIndex, look.teamIndex), isFlipped)
      if (frame === null) continue
      context.drawImage(frame.image, axisX + frame.offsetX, anchor.y + frame.offsetY)
    }
  })
}

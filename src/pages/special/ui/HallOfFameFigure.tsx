import { useEffect, useRef } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { outfitPaletteIndex, useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import {
  batterEquipmentOf, batterLayersOf, bodyTypeOf, layerPaletteIndexOf, pitcherEquipmentOf, pitcherLayersOf,
} from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import {
  HALL_OF_FAME_FIGURE, INITIAL_FIGURE_ENTRY, INITIAL_FIGURE_LIST_MEMORY, drawListFigureTimes, figureHandOf, pitcherImageDxOf,
} from '@/pages/special/lib/hallOfFameFigure'
import type {
  FigureDrawing, FigureEntryState, FigureListMemory, FigureSlotInput, HallOfFameFigureLook,
} from '@/pages/special/lib/hallOfFameFigure'
import * as styles from '@/pages/special/ui/SpecialScreen.css'

/**
 * A 자리 몸 그림 (`lib/hallOfFameFigure.ts` 머리말).
 * - 타자: 겹침 타자 그림 vt+0x10 = 0x78cfd 를 (A.x, A.y + 0x2d) 에 바로. 그림자 끔(0x652d6 `그림+0x48 = 0`).
 *   잔상(batter_ghost)은 공용 생성자 0x767ec 가 +0x2c 에 늘 싣고 0x78eca 가 자세 8·9 에 끼우므로 그대로 둔다.
 *   우타(손 0)면 그림 x 를 축으로 뒤집는다(0x78d0c 효과 0x11 — 축은 타석 그림과 같은 근사).
 * - 투수: 54×75 이미지 [0x1552ae0] 를 (A.x − (손 ? 0x32 : 0x3b), A.y − 0x61) 에 — 그 안 (27, 62) 에 단일 PZX 투수 그림
 *   0x79525(바탕 pitcher.pzx 팔레트 피부 × 15 + 팀 0x794c2 · 장비 여섯 칸 `pitcherLayersOf`). 좌완(손 ≠ 0)이면 뒤집는다(0x79544).
 *   이미지 밖은 잘린다(54×75 만 떠 둔다). 마젠타 투명 키라 빈 곳은 비친다.
 */
export function HallOfFameFigure({ drawing, ax, ay }: {
  readonly drawing: FigureDrawing
  readonly ax: number
  readonly ay: number
}) {
  if (drawing.kind === '타자') {
    const { look, pose } = drawing
    const [hit, power, , run] = look.equipment
    const layers = batterLayersOf(pose, bodyTypeOf(look.form), batterEquipmentOf({ hit, power, run }), false)
    return <FigureLayers layers={layers} x={ax} y={ay + HALL_OF_FAME_FIGURE.batterDy} isMirrored={figureHandOf(look) === 0}
      paletteOf={(layer) => layerPaletteIndexOf(layer, look.skin, look.team)} testId="명전-타자그림" />
  }
  if (drawing.kind === '투수') {
    const { image } = HALL_OF_FAME_FIGURE
    return (
      <div className={styles.hofFigureImage} data-testid="명전-투수그림" data-hand={drawing.hand}
        style={{
          left: ax + pitcherImageDxOf(drawing.hand), top: ay + HALL_OF_FAME_FIGURE.imageDy,
          width: image.width, height: image.height,
        }}>
        {drawing.image !== null && <PitcherFigure look={drawing.image.look} pose={drawing.image.pose} />}
      </div>
    )
  }
  return null
}

function PitcherFigure({ look, pose }: { readonly look: HallOfFameFigureLook; readonly pose: number }) {
  const [control, velocity, breaking, stamina] = look.equipment
  const layers = pitcherLayersOf(pose, pitcherEquipmentOf({ control, velocity, breaking, stamina }))
  const { figureX, figureY } = HALL_OF_FAME_FIGURE.image
  return <FigureLayers layers={layers} x={figureX} y={figureY} isMirrored={figureHandOf(look) !== 0}
    paletteOf={(layer) => layer.gradePaletteRow
      ?? (layer.folder === PITCHER_FRAMES ? outfitPaletteIndex(look.skin, look.team) : null)} testId="명전-투수몸" />
}

function FigureLayers({ layers, x, y, isMirrored, paletteOf, testId }: {
  readonly layers: readonly BatterLayer[]
  readonly x: number
  readonly y: number
  readonly isMirrored: boolean
  readonly paletteOf: (layer: BatterLayer) => number | null
  readonly testId: string
}) {
  return (
    <div className={styles.hofFigureAxis} data-testid={testId} data-mirrored={isMirrored ? 'true' : undefined}
      style={{ left: x, transform: isMirrored ? 'scaleX(-1)' : undefined }}>
      {layers.map((layer, index) => (
        <FigureLayer key={`${layer.folder}#${index}`} layer={layer} y={y} paletteIndex={paletteOf(layer)} />
      ))}
    </div>
  )
}

function FigureLayer({ layer, y, paletteIndex }: {
  readonly layer: BatterLayer
  readonly y: number
  readonly paletteIndex: number | null
}) {
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, paletteIndex)
  const origin = useFrameOrigins(layer.folder)?.[key]
  if (origin === undefined) return null
  return <img className={styles.sprite} style={{ left: origin.x, top: y + origin.y }} src={src} alt="" />
}

/**
 * 목록 객체 — 메인 메뉴 스킨 [this+0x120](하위 16 홈런더비 · 17 미션 · 27 스페셜 명전이 같이 쓴다) · 나리 [this+0xd8](상태 145 등록) ·
 * 시즌 [this+0xa8](0xe2 선수영입). 그린 수·머무름·자세는 이 객체 칸이라 화면을 건너 잇는다.
 */
export type HallOfFameListOwner = '메뉴' | '나리' | '시즌'

const listMemories = new Map<HallOfFameListOwner, FigureListMemory>()
/** 앱을 새로 띄운 것과 같다 — 테스트용 */
export const resetHallOfFameFigureMemory = () => listMemories.clear()

/**
 * 갱신 한 번에 그림 한 번 — 그린 **뒤** 목록 칸을 굳힌다(그림이 나간 뒤 effect). 건너뛴 갱신은 그만큼 앞당겨 그린다.
 * 그림·애니 객체는 진입마다 새로 만들므로 이 훅(화면)마다 따로 든다.
 */
export function useHallOfFameFigure(owner: HallOfFameListOwner, input: FigureSlotInput): FigureDrawing {
  const tick = useUpdateCounter()
  const committed = useRef<{ tick: number; entry: FigureEntryState }>({ tick: tick - 1, entry: INITIAL_FIGURE_ENTRY })
  const memory = listMemories.get(owner) ?? INITIAL_FIGURE_LIST_MEMORY
  const frame = drawListFigureTimes(memory, committed.current.entry, input, tick - committed.current.tick)
  useEffect(() => {
    if (committed.current.tick === tick) return
    listMemories.set(owner, frame.memory)
    committed.current = { tick, entry: frame.entry }
  })
  return frame.drawing
}

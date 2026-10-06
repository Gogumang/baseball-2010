import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import { batterLayersOf, bodyTypeOf, layerPaletteIndexOf, NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import type { BatterEquipment, BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

/**
 * 훈련 팝업의 육성 타자 (binary.mod 0x78ab0 설정 · 0x78cfc 그리기, 서브 에이전트 B 확인).
 *
 * 겹치기는 타석 그림과 **같은 함수**(0x78cfc)라 `batterLayersOf` 를 그대로 쓴다 —
 * 훈련 팝업 캐릭터 `[gfx+0x16c]` 는 0x108f8 이 모드 4(타자편)일 때 만든 **겹침 타자 객체**
 * (0x109e6 `movs r0,#0x54` · 생성자 0x789f0)이고, 그 자리에서 바로 0x10810 으로 적재된다
 * (0x10a10 `ldr r1,[r5] ; bl 0x10810`). 그리기는 vtbl+0x10 = 0x78cfd 로 기본정보 카드와 같다.
 *
 * - 그림자는 팝업에서 끈다 — 0x1085c 가 `fig+0x48 = 0` 으로 두고 0x78dc6 이 그 칸을 본다
 *   (`batterLayersOf` 넷째 인자 false).
 *   (적재 0x78ab0 은 그림자·잔상 파일을 아예 안 읽는다 — 몸통·헬멧·배트만 읽는다.)
 * - 잔상(batter_ghost)은 0x78eca 가 자세 8·9 에서 끼우지만 이 팝업에서 슬롯이 차는지
 *   확정하지 못해 예전처럼 뺀다.
 * - **몸통 종류·좌우** — 0x10810 이 적재 vt8 에 `r2 = rec[0xb] >> 4`(폼, 0x1081a)와
 *   `[sp] = 0xb63c0(rec)`(손, 0x10820)을 넘긴다. 적재 0x78ab0 이 몸통을 `폼 >> 1` 로 고르고(0 balancer · 그 밖 sluger,
 *   `bodyTypeOf`), 손은 그림 +0x3c 에 들어가 그리기 0x78cfc 가 **우타(+0x3c == 0)면 효과 0x11 로 뒤집는다**(R6 4절).
 *   거울 축은 그림 x 로 둔다 — 타석 그림(`drawBatter`)과 같은 근사다.
 * - 겹침 순서는 표 0xd3a54[자세] 로 바뀐다 (`batterLayersOf` 의 `ORDER_RULES`).
 *
 * **장착 아이템**(item_bat_*)은 0x10810 의 니블 루프(0x10866 — 부위 0~3, `rec[0x19]`·`rec[0x1a]`
 * 니블, `n = 니블 − 1`, 미장착이면 건너뜀 → vtbl+0x14 = 0x78fd9)가 넣어 주므로 여기서도 입는다.
 *
 * **몸통·헬멧 팔레트** — 기본정보 카드(8ab32a0)와 같은 적재 0x10810 → 0x78ab0 이다 (C-1):
 *   r1 = `[[this+0xb0]+1]`(내 팀) · r3 = `rec[0xb]` bit2-3(피부)
 *   78be8: 몸통 팔레트 = 피부 × 15 + 팀 · 78c14: 헬멧 팔레트 = 팀
 * 장비 손·다리는 등급 줄이 먼저다 (`layerPaletteIndexOf`).
 *
 */

/** 우타 — 그림이 좌타 자세로 그려져 있어 뒤집는다 (0x78d0c) */
const RIGHT_HANDED = 0

/** 이 팝업에서 빼는 겹 — 잔상(미확정). 그림자는 `batterLayersOf(…, false)` 가 뺀다 */
const OMITTED = ['/batter_ghost/']

interface TrainingFigureProps {
  readonly pose: number
  readonly x: number
  readonly y: number
  /** 장착 장비 등급 순번. 안 넘기면 맨몸이다 */
  readonly equipment?: BatterEquipment
  /** 피부 번호(`rec[0xb]` bit2-3) · 내 팀 — 몸통(피부 × 15 + 팀)·헬멧(팀) 팔레트. 안 넘기면 구운 색 그대로 */
  readonly skinIndex?: number
  readonly teamIndex?: number
  /** 폼 `rec[0xb] >> 4` = 2 × 타입 + 손 — 몸통 종류(폼 >> 1)와 뒤집기(손 0 = 우타)를 고른다. 안 넘기면 좌타 타격형(폼 1) */
  readonly form?: number
}

export function TrainingFigure({ pose, x, y, equipment = NO_EQUIPMENT, skinIndex, teamIndex, form = 1 }: TrainingFigureProps) {
  const layers = batterLayersOf(pose, bodyTypeOf(form), equipment, false)
    .filter((layer) => !OMITTED.some((folder) => layer.folder.includes(folder)))
  const isMirrored = batterSideOfForm(form) === RIGHT_HANDED
  // 겹들을 그림 x 에 놓은 폭 0 상자 안에 두고 그 상자를 뒤집는다 — 축 = 그림 x
  return (
    <div className={styles.figureAxis} style={{ left: x, transform: isMirrored ? 'scaleX(-1)' : undefined }}
      data-mirrored={isMirrored ? 'true' : undefined}>
      {layers.map((layer, index) => (
        <FigureLayer key={`${layer.folder}#${index}`} layer={layer} x={0} y={y}
          paletteIndex={skinIndex === undefined || teamIndex === undefined
            ? layer.gradePaletteRow ?? null
            : layerPaletteIndexOf(layer, skinIndex, teamIndex)} />
      ))}
    </div>
  )
}

interface FigureLayerProps {
  readonly layer: BatterLayer
  readonly x: number
  readonly y: number
  readonly paletteIndex: number | null
}

/**
 * 겹 하나. 장비 손·다리는 **등급 줄(.mpl)** 로 갈아 끼워야 색이 맞는다 —
 * 장비 폴더는 `palette.json` 의 `baked` 가 null 이라 줄 0 도 갈아 끼운다 (`batterLayers` 주석).
 */
function FigureLayer({ layer, x, y, paletteIndex }: FigureLayerProps) {
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, paletteIndex)
  const origin = useFrameOrigins(layer.folder)?.[key]
  if (origin === undefined) return null
  return (
    <img className={styles.sprite} style={{ left: x + origin.x, top: y + origin.y }} src={src} alt="" />
  )
}

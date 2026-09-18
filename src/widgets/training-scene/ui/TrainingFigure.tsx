import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

/**
 * 훈련 팝업의 육성 타자 (binary.mod 0x78ab0 설정 · 0x78cfc 그리기, 서브 에이전트 B 확인).
 *
 * - 몸통 bat/batter_balancer (타입 0~1, 2~3 이면 batter_sluger) 프레임 `동작`
 * - 헬멧 bat/batter_helmet 프레임 `동작`
 * - 배트 bat/batter_batter 프레임 `동작`
 * - 몸통 앞부분 = 몸통 프레임 `동작 + 14` (balancer 기준)
 * - 그림자는 팝업에서 끈다 (0x10810 fig+0x48 = 0). 뒤집지 않는다.
 * - 겹침 순서는 표 0xd3a54[동작] 로 바뀐다.
 *
 * **아직 반영 안 한 것**: 장착 아이템 레이어(item_bat_*) · 타입별 sluger · 피부 팔레트(.mpl).
 */
const BODY = '/sprites/batter_balancer/frames'
const HELMET = '/sprites/batter_helmet/frames'
const BAT = '/sprites/batter_batter/frames'
/** balancer 의 몸통 앞부분 프레임 차이 (sluger 는 13) */
const BODY_FRONT_OFFSET = 14

/** 0xd3a54: 동작별 겹침 순서 종류 */
const ORDER_KIND = [1, 1, 1, 1, 0, 0, 1, 1, 2, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1, 1, 3, 0]

type Layer = 'body' | 'helmet' | 'bat' | 'bodyFront'

/** 슬롯 L1 몸통 · L2 헬멧 · L4 배트 · L5 몸통앞 을 종류에 따라 다시 늘어놓는다. */
const ORDERS: Readonly<Record<number, readonly Layer[]>> = {
  0: ['body', 'helmet', 'bat', 'bodyFront'],
  1: ['body', 'helmet', 'bodyFront', 'bat'],
  2: ['bat', 'body', 'helmet', 'bodyFront'],
  3: ['bat', 'bodyFront', 'body', 'helmet'],
}

interface TrainingFigureProps {
  readonly pose: number
  readonly x: number
  readonly y: number
}

export function TrainingFigure({ pose, x, y }: TrainingFigureProps) {
  const order = ORDERS[ORDER_KIND[pose] ?? 0]
  return (
    <>
      {order.map((layer) => (
        <FigureLayer key={layer} layer={layer} pose={pose} x={x} y={y} />
      ))}
    </>
  )
}

function folderAndFrameOf(layer: Layer, pose: number): readonly [string, number] {
  if (layer === 'helmet') return [HELMET, pose]
  if (layer === 'bat') return [BAT, pose]
  if (layer === 'bodyFront') return [BODY, pose + BODY_FRONT_OFFSET]
  return [BODY, pose]
}

interface FigureLayerProps {
  readonly layer: Layer
  readonly pose: number
  readonly x: number
  readonly y: number
}

function FigureLayer({ layer, pose, x, y }: FigureLayerProps) {
  const [folder, frame] = folderAndFrameOf(layer, pose)
  const key = String(frame).padStart(3, '0')
  const origin = useFrameOrigins(folder)?.[key]
  if (origin === undefined) return null
  return (
    <img className={styles.sprite} style={{ left: x + origin.x, top: y + origin.y }} src={`${folder}/${key}.png`} alt="" />
  )
}

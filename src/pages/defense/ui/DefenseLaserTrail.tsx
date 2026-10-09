import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { laserTrailStampsOf } from '@/pages/defense/lib/laserTrail'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

/** 효과 1 의 단계 → 그림 무게 (단계/16, R6 3a — 작은 지도 `MAP_OPACITY` 와 같은 읽기) */
const LEVEL_SCALE = 16

/**
 * 레이저 잔상 (0x37076~0x3724a) — 공과 같은 깊이로 공 **뒤에**(위에) 넣는다(그리기 목록에 공 그림 0x36f70 이 먼저 들어간다).
 * 공이 화면에서 떠 있을 때(높이 투영 > 0)와 공 바닥점이 화면 위쪽 1 이상일 때만(0x36fc0 · 0x36fce) 그린다.
 */
export function DefenseLaserTrail({
  folder,
  frame,
  from,
  ball,
  ballHeight,
  ballGroundY,
}: {
  readonly folder: string
  /** 지금 공 그림 프레임 — 잔상도 같은 그림이다 */
  readonly frame: number
  /** 궤적 첫 점의 화면 자리 (높이 뺀 것) */
  readonly from: { readonly x: number; readonly y: number }
  /** 공 그림 자리 */
  readonly ball: { readonly x: number; readonly y: number }
  /** 높이 투영 h */
  readonly ballHeight: number
  /** 공 바닥점 화면 y */
  readonly ballGroundY: number
}) {
  const origins = useFrameOrigins(folder)
  const width = origins?.[String(frame).padStart(3, '0')]?.width
  if (width === undefined || ballHeight <= 0 || ballGroundY < 1) return null
  return (
    <>
      {laserTrailStampsOf(from, ball, width).map((stamp, index) => (
        <div
          key={index}
          className={styles.actor}
          style={{ left: stamp.x, top: stamp.y, opacity: stamp.level / LEVEL_SCALE }}
          data-testid="defense-laser-trail"
          data-level={stamp.level}
        >
          <FrameSprite folder={folder} frame={frame} origins={origins} x={0} y={0} />
        </div>
      ))}
    </>
  )
}

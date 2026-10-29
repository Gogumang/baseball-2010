import { FrameSprite, InsetBox } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  MISSION_GP_FRAME,
  MISSION_POINT_BOX,
  MISSION_POINT_GP_X,
  MISSION_POINT_LABEL_X,
  MISSION_POINT_ROWS,
  MISSION_POINT_VALUE,
} from '@/pages/mission-play/lib/missionResultBoard'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')

/** 번 G · 보유 G 칸 — 이름(img_text) · "G" · 숫자 판. 보유 G 를 모르면 그 줄 숫자를 비운다 */
export function MissionPointBox({
  earnedGamePoint,
  heldGamePoint,
  textOrigins,
}: {
  readonly earnedGamePoint: number
  readonly heldGamePoint: number | undefined
  readonly textOrigins: FrameOrigins | null
}) {
  return (
    <>
      {/* 4a67e 칸 0xbb28d(W/2, H/2 − 0x33, 162, 0x3d, 정렬 2) */}
      <InsetBox x={MISSION_POINT_BOX.x} y={MISSION_POINT_BOX.y} width={MISSION_POINT_BOX.width} height={MISSION_POINT_BOX.height} />
      {MISSION_POINT_ROWS.map((row, index) => {
        const value = index === 0 ? earnedGamePoint : heldGamePoint
        return (
          <div key={row.name}>
            <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.label} origins={textOrigins} x={MISSION_POINT_LABEL_X} y={row.labelY} />
            <FrameSprite folder={IMG_TEXT_FRAMES} frame={MISSION_GP_FRAME} origins={textOrigins} x={MISSION_POINT_GP_X} y={row.labelY} />
            {value !== undefined && (
              <GamePointBadge
                testId={`미션-${row.name}-G`}
                value={value}
                x={MISSION_POINT_VALUE.x}
                y={row.valueY}
                width={MISSION_POINT_VALUE.width}
                align={MISSION_POINT_VALUE.align}
                plus={row.plus}
                plate={MISSION_POINT_VALUE.plate}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

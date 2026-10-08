import type { CSSProperties } from 'react'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { FrameSprite } from '@/shared/ui'
import {
  CURSOR_ANIMATION, MAP_FRAME, MAP_FRAMES, NIGHT_WINDOW_FRAME, OUTING_PLACES, PLACE_LABEL_FRAMES,
} from '@/shared/config/outingPlaces'
import { outingMapUnderlayLayoutOf } from '@/pages/management/lib/outingMapUnderlay'

/** 효과 1 · 인자 7 — 고르지 않은 건물은 7/16 (R6 3a) */
const UNSELECTED_OPACITY = 7 / 16
/** 0x7ec04 · 0x7e300 의 단색 찍기 자리 — 건물은 네 방향, 글자 테두리는 여덟 방향(표 0xd48c8 · 0xd48e8) */
const FOUR_WAYS: readonly (readonly [number, number])[] = [[-1, 0], [0, -1], [1, 0], [0, 1]]
const EIGHT_WAYS: readonly (readonly [number, number])[] = [[-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, -1], [1, 1], [-1, 1]]

export interface SeasonOutingMapProps {
  /** 고른 칸 p (this+0xf8) */
  readonly selected: number
  /** 시간대 [gfx+0x1c] 를 고를 시각 */
  readonly hour: number
}

/**
 * 시즌 외출 지도 `0x7ea64(gfx, p, 0)` (`lib/seasonOutingMap` 머리말) — 0xd1 · 0xe3 의 밑그림.
 * 지도 원점 · 이름 자리 · 밤은 나리 밑그림과 같은 식(`outingMapUnderlayLayoutOf`)이다.
 */
export function SeasonOutingMap({ selected, hour }: SeasonOutingMapProps) {
  const origins = useFrameOrigins(MAP_FRAMES)
  const labelOrigins = useFrameOrigins(PLACE_LABEL_FRAMES)
  const animations = useAnimations(MAP_FRAMES)
  const update = useUpdateCounter()
  const layout = outingMapUnderlayLayoutOf(hour)
  const selectedPlace = OUTING_PLACES[selected]
  const selectedLabel = layout.labels[selected]
  const cursorStep = animationStepAt(animations?.[CURSOR_ANIMATION] ?? [], update)

  return (
    <div data-testid="시즌-외출지도" data-selected={selected}
      style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320, background: '#000', overflow: 'hidden', pointerEvents: 'none' }}>
      <FrameSprite folder={MAP_FRAMES} frame={MAP_FRAME} origins={origins} x={layout.mapX} y={layout.mapY} />
      {OUTING_PLACES.map((place, index) => index === selected ? null : (
        <FrameSprite key={place.id} folder={MAP_FRAMES} frame={place.frame} origins={origins} x={layout.mapX} y={layout.mapY}
          style={{ opacity: UNSELECTED_OPACITY }} />
      ))}
      {layout.labels.map((label, index) => index === selected ? null : (
        <img key={label.frame} alt="" src={`./sprites/management/map_label_${label.frame}.png`}
          style={{ position: 'absolute', left: label.left, top: label.top, imageRendering: 'pixelated' }} />
      ))}
      {layout.isNight && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `rgba(0, 0, 0, ${layout.nightDim})` }} />
          <FrameSprite folder={MAP_FRAMES} frame={NIGHT_WINDOW_FRAME} origins={origins} x={layout.mapX} y={layout.mapY} />
        </>
      )}
      {selectedPlace !== undefined && (
        <>
          {FOUR_WAYS.map(([dx, dy]) => (
            <SolidStamp key={`${dx},${dy}`} folder={MAP_FRAMES} frame={selectedPlace.frame} origins={origins}
              x={layout.mapX + dx} y={layout.mapY + dy} color="#FFFFFF" />
          ))}
          <FrameSprite folder={MAP_FRAMES} frame={selectedPlace.frame} origins={origins} x={layout.mapX} y={layout.mapY} />
        </>
      )}
      {selectedPlace !== undefined && selectedLabel !== undefined && (
        // 이름 그림(map_label_*)은 1px 테두리를 둘러 글자보다 1px 왼쪽 위에서 시작한다 — 글자 자리는 +1
        <>
          {EIGHT_WAYS.map(([dx, dy]) => (
            <SolidStamp key={`label${dx},${dy}`} folder={PLACE_LABEL_FRAMES} frame={selectedPlace.labelFrame} origins={labelOrigins}
              x={selectedLabel.left + 1 + dx} y={selectedLabel.top + 1 + dy} color="#FFFF00" />
          ))}
          <SolidStamp folder={PLACE_LABEL_FRAMES} frame={selectedPlace.labelFrame} origins={labelOrigins}
            x={selectedLabel.left + 1} y={selectedLabel.top + 1} color="#000000" />
        </>
      )}
      {selectedPlace !== undefined && cursorStep !== null && (
        <FrameSprite folder={MAP_FRAMES} frame={cursorStep.frame} origins={origins}
          x={layout.mapX + selectedPlace.cursorBox.x + Math.trunc(selectedPlace.cursorBox.width / 2) + cursorStep.dx}
          y={layout.mapY + selectedPlace.cursorBox.y + cursorStep.dy} />
      )}
    </div>
  )
}

/** 효과 0xb(단색) — 프레임의 그림 꼴을 한 색으로 찍는다 */
function SolidStamp({ folder, frame, origins, x, y, color }: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly x: number
  readonly y: number
  readonly color: string
}) {
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  const mask = `url(${folder}/${key}.png)`
  const style: CSSProperties = {
    position: 'absolute', left: x + origin.x, top: y + origin.y, width: origin.width, height: origin.height,
    background: color, maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%',
  }
  return <div style={style} />
}

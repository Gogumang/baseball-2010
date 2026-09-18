import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import {
  CURSOR_ANIMATION,
  EVENT_MARKER_ANIMATION,
  MAP_FRAME,
  MAP_FRAMES,
  OUTING_PLACES,
  PLACE_LABEL_FRAMES,
  ROAD_FRAME,
} from '@/shared/config/outingPlaces'
import type { MapBox, OutingPlace } from '@/shared/config/outingPlaces'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { FrameSprite } from '@/shared/ui'
import * as styles from '@/pages/outing-map/ui/OutingMapScreen.css'

/** 박스 가운데 아래를 애니메이션 원점으로 쓴다 — [!] 프레임 원점이 (−10, −15) 라 박스에 꼭 맞는다 (추정) */
const markerAnchorOf = (box: MapBox) => ({ x: box.x + 10, y: box.y + 15 + styles.MAP_TOP })
/** 선택 화살표 애니메이션은 dx −11 로 당겨 그린다 — 박스 왼쪽 위 + 11 이 원점 (추정) */
const cursorAnchorOf = (box: MapBox) => ({ x: box.x + 11, y: box.y + 7 + styles.MAP_TOP })

interface OutingMapProps {
  readonly selectedPlaceId: string
  readonly eventPlaceIds: ReadonlySet<string>
  readonly noticeText: string
  readonly onOpen: (place: OutingPlace) => void
  readonly onBack: () => void
}

/** 원작 외출 지도 — event_map 프레임 그대로 (건물·이름·[!]·선택 화살표) */
export function OutingMap({ selectedPlaceId, eventPlaceIds, noticeText, onOpen, onBack }: OutingMapProps) {
  const origins = useFrameOrigins(MAP_FRAMES)
  const labelOrigins = useFrameOrigins(PLACE_LABEL_FRAMES)
  const animations = useAnimations(MAP_FRAMES)
  const update = useUpdateCounter()

  const animated = (animation: number, anchor: { x: number; y: number }, key: string) => {
    const step = animationStepAt(animations?.[animation] ?? [], update)
    if (step === null) return null
    return (
      <FrameSprite key={key} folder={MAP_FRAMES} frame={step.frame} origins={origins}
        x={anchor.x + step.dx} y={anchor.y + step.dy} />
    )
  }

  return (
    <RawScreen>
      <FrameSprite folder={MAP_FRAMES} frame={MAP_FRAME} origins={origins} x={0} y={styles.MAP_TOP} />
      <FrameSprite folder={MAP_FRAMES} frame={ROAD_FRAME} origins={origins} x={0} y={styles.MAP_TOP} />

      {OUTING_PLACES.map((place) => {
        const frameOrigin = origins?.[String(place.frame).padStart(3, '0')]
        const label = labelOrigins?.[String(place.labelFrame).padStart(3, '0')]
        return (
          <div key={place.id}>
            {frameOrigin !== undefined && (
              <button type="button" className={styles.placeButton} aria-label={place.name}
                style={{ left: frameOrigin.x, top: frameOrigin.y + styles.MAP_TOP, width: frameOrigin.width, height: frameOrigin.height }}
                onClick={() => onOpen(place)}>
                <img className={styles.sprite} style={{ left: 0, top: 0 }}
                  src={`${MAP_FRAMES}/${String(place.frame).padStart(3, '0')}.png`} alt="" />
              </button>
            )}
            {label !== undefined && (
              <FrameSprite folder={PLACE_LABEL_FRAMES} frame={place.labelFrame} origins={labelOrigins}
                x={place.nameBox.x + Math.round((place.nameBox.width - label.width) / 2)}
                y={place.nameBox.y + Math.round((place.nameBox.height - label.height) / 2) + styles.MAP_TOP} />
            )}
            {eventPlaceIds.has(place.id) && animated(EVENT_MARKER_ANIMATION, markerAnchorOf(place.markerBox), `${place.id}-event`)}
            {place.id === selectedPlaceId && animated(CURSOR_ANIMATION, cursorAnchorOf(place.cursorBox), `${place.id}-cursor`)}
          </div>
        )
      })}

      <button type="button" className={styles.cornerButton} onClick={onBack}>
        ‹ 관리
      </button>
      <div className={styles.noticeLine}>
        {noticeText !== '' ? noticeText : eventPlaceIds.size > 0 ? '[!] 장소에서 들어가기 · 건물을 누르세요' : '건물을 누르세요'}
      </div>
    </RawScreen>
  )
}

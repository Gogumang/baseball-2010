import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import {
  CURSOR_ANIMATION,
  EVENT_MARKER_ANIMATION,
  MAP_FRAME,
  MAP_FRAMES,
  OUTING_PLACES,
  PLACE_LABEL_FRAMES,
} from '@/shared/config/outingPlaces'
import type { MapBox, OutingPlace } from '@/shared/config/outingPlaces'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { Button, FrameSprite } from '@/shared/ui'
import * as styles from '@/pages/outing-map/ui/OutingMapScreen.css'

/**
 * [!] 표시 기준점 (0x7ed6c, F-2 2-6 확정) — `mapX + bx + (bw >> 1)`, `mapY + by`.
 * 앞서 웹은 y 를 15px 더 내려 잡고 있었다. 애니 2 프레임 11 의 원점이 (−5,−15) 라
 * 원본대로면 [!] 가 박스 **위로** 15px 올라간다.
 */
const markerAnchorOf = (box: MapBox) => ({ x: box.x + (box.width >> 1), y: box.y + styles.MAP_TOP })
/**
 * 선택 화살표 기준점 (0x7ecfc, F-2 2-5 확정) — `mapX + bx + (bw / 2)`, `mapY + by`.
 * 애니 0 은 dx −11 · dy −7→−3 으로 까딱인다. 앞서 웹은 2px 오른쪽·7px 아래였다.
 */
const cursorAnchorOf = (box: MapBox) => ({ x: box.x + Math.trunc(box.width / 2), y: box.y + styles.MAP_TOP })

/** 효과 1·인자 7 — 그림 무게가 7/16 이다 (R6 3a) */
const UNSELECTED_OPACITY = 7 / 16

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
      {/*
        프레임 6 은 길 점선이 아니라 **창문 불빛**이고, 원본은 **밤(시간대 2 = 20~5시)에만** 그린다.
        그것도 화면 전체를 단계 9 로 어둡게 한 뒤에 얹는다 (0x7eba2, F-2 2-3 확정).
        웹에는 아직 시간대가 없어 늘 낮이므로 그리지 않는다 — 앞서는 항상 그리고 있었다.
      */}

      {OUTING_PLACES.map((place) => {
        const frameOrigin = origins?.[String(place.frame).padStart(3, '0')]
        const label = labelOrigins?.[String(place.labelFrame).padStart(3, '0')]
        return (
          <div key={place.id}>
            {frameOrigin !== undefined && (
              <button type="button" className={styles.placeButton} aria-label={place.name}
                style={{ left: frameOrigin.x, top: frameOrigin.y + styles.MAP_TOP, width: frameOrigin.width, height: frameOrigin.height }}
                onClick={() => onOpen(place)}>
                {/* 고르지 않은 건물은 효과 1·인자 7 = 7/16 반투명 겹치기다 (0x7eb0a · R6 3a 확정) */}
                <img className={styles.sprite}
                  style={{ left: 0, top: 0, opacity: place.id === selectedPlaceId ? 1 : UNSELECTED_OPACITY }}
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

      <Button variant="corner" className={styles.cornerButton} onClick={onBack}>
        ‹ 관리
      </Button>
      <div className={styles.noticeLine}>
        {noticeText !== '' ? noticeText : eventPlaceIds.size > 0 ? '[!] 장소에서 들어가기 · 건물을 누르세요' : '건물을 누르세요'}
      </div>
    </RawScreen>
  )
}

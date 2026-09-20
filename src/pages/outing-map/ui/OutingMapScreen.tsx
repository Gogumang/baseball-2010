import { useState } from 'react'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { OutingMap } from '@/pages/outing-map/ui/OutingMap'
import { PlaceBubble } from '@/pages/outing-map/ui/PlaceBubble'

interface OutingMapScreenProps {
  readonly career: PlayerCareer
  readonly noticeText: string
  readonly onRun: (activityId: string) => void
  readonly onBack: () => void
  /** 원작: [!] 장소에서 [들어가기]를 고르면 특별 이벤트가 발생한다 — 이벤트가 기다리는 장소 */
  readonly eventPlaceIds: ReadonlySet<string>
  readonly onEnter: (place: OutingPlace) => void
}

/**
 * 원작 외출 — 도시 지도에서 장소를 고른다 (StrHOWTO[16]).
 * 지도는 원본 프레임 배치 그대로다. 장소를 고르면 **지도 위 말풍선**(박스 3, 70×42)에
 * [들어가기]/[기능] 두 칸만 띄운다 (0x7ee1a, F-2 2-7) — 전체 화면 목록이 아니다.
 */
export function OutingMapScreen({ career, noticeText, onRun, onBack, eventPlaceIds, onEnter }: OutingMapScreenProps) {
  const [openPlace, setOpenPlace] = useState<OutingPlace | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState(OUTING_PLACES[0].id)

  return (
    <OutingMap
      selectedPlaceId={selectedPlaceId}
      eventPlaceIds={eventPlaceIds}
      noticeText={noticeText}
      onOpen={(place) => {
        setSelectedPlaceId(place.id)
        setOpenPlace(place)
      }}
      onBack={openPlace === null ? onBack : () => setOpenPlace(null)}
    >
      {openPlace !== null && (
        <PlaceBubble
          place={openPlace}
          // StrMODE[48] [들어가기] — 이번 주기에 이미 행동했으면 못 한다
          canEnter={!career.hasActedThisCycle}
          onEnter={() => onEnter(openPlace)}
          onRun={(activityId) => {
            onRun(activityId)
            setOpenPlace(null)
          }}
          onClose={() => setOpenPlace(null)}
        />
      )}
    </OutingMap>
  )
}

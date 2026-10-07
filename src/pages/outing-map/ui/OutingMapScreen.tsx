import { useState } from 'react'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { OutingMap } from '@/pages/outing-map/ui/OutingMap'
import { PlaceBubble } from '@/pages/outing-map/ui/PlaceBubble'
import { MessageBox } from '@/shared/ui'

interface OutingMapScreenProps {
  readonly noticeText: string
  readonly onRun: (activityId: string) => void
  readonly onBack: () => void
  /** 원작: [!] 장소에서 [들어가기]를 고르면 특별 이벤트가 발생한다 — 이벤트가 기다리는 장소 */
  readonly eventPlaceIds: ReadonlySet<string>
  readonly onEnter: (place: OutingPlace) => void
  /**
   * 상태 126 효과 팝업 글 (0x15234 끝 `0xbbef8(글, 1, 코드 3, 1)`) — 지도 위에 뜬다 (126 그리기 0x16874 가
   * 지도 0x7ea64 를 그대로 그린다). null 이면 팝업 없음. [확인] 으로 닫으면 `onCloseResult`.
   */
  readonly resultText?: string | null
  readonly onCloseResult?: () => void
}

/**
 * 원작 외출 — 도시 지도에서 장소를 고른다 (StrHOWTO[16]).
 * 지도는 원본 프레임 배치 그대로다. 장소를 고르면 **지도 위 말풍선**(박스 3, 70×42)에
 * [들어가기]/[기능] 두 칸만 띄운다 (0x7ee1a, F-2 2-7) — 전체 화면 목록이 아니다.
 */
export function OutingMapScreen({
  noticeText, onRun, onBack, eventPlaceIds, onEnter, resultText = null, onCloseResult,
}: OutingMapScreenProps) {
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
          onEnter={() => onEnter(openPlace)}
          onRun={(activityId) => {
            onRun(activityId)
            setOpenPlace(null)
          }}
          onClose={() => setOpenPlace(null)}
        />
      )}
      {resultText !== null && (
        <MessageBox text={resultText} buttons={['확인']} onAnswer={() => onCloseResult?.()} />
      )}
    </OutingMap>
  )
}

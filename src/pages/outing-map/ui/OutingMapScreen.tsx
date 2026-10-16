import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { OutingMap } from '@/pages/outing-map/ui/OutingMap'
import { PlaceBubble } from '@/pages/outing-map/ui/PlaceBubble'
import { MessageBox } from '@/shared/ui'
import { moveOutingMapCursor, outingMapDirectionOf } from '@/shared/lib/outingMap/outingMapCursor'

interface OutingMapScreenProps {
  /**
   * 113 가드 0x16cf0 의 막힘 글(StrMODE[62] · [77] · [196] · [91]) — 원본은 공용 팝업 `0xbbef9(글, 1, 1, 1)`(0x16dc6~0x16dce)로
   * 띄우고 상태를 113 에 둔다(말풍선이 그대로 남는다). '' 이면 팝업 없음. [확인] 으로 닫으면 `onCloseNotice`.
   */
  readonly noticeText: string
  readonly onCloseNotice: () => void
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
  /**
   * 상태 126 연출 판 (그리기 0x16874 = 지도 0x7ea64(gfx, 고른 장소, 0) → 가운데 정렬판 0x84ea0) — 지도 위, 효과 팝업 아래에 깐다.
   * 연출 중에는 지도가 키를 받지 않는다(126 키 0x105c8 은 건너뛰기뿐).
   */
  readonly presentation?: ReactNode
}

/**
 * 원작 외출 — 도시 지도에서 장소를 고른다 (StrHOWTO[16]).
 * 지도는 원본 프레임 배치 그대로다. 장소를 고르면 **지도 위 말풍선**(박스 3, 70×42)에
 * [들어가기]/[기능] 두 칸만 띄운다 (0x7ee1a, F-2 2-7) — 전체 화면 목록이 아니다.
 */
export function OutingMapScreen({
  noticeText, onCloseNotice, onRun, onBack, eventPlaceIds, onEnter, resultText = null, onCloseResult, presentation = null,
}: OutingMapScreenProps) {
  const [openPlace, setOpenPlace] = useState<OutingPlace | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState(OUTING_PLACES[0].id)

  /**
   * 키 0x13ba4 (직접 떴다):
   * ```
   * −5 · '5'(0x35) → [gfx+0x184] = 칸 · 113 (장소 말풍선)
   * −16 (CLR)      → 105
   * 그 밖          → [this+0xac] = 0x7f3e4(gfx, [this+0xac], 키)   ; 방향 이동 표 0xd491c
   * ```
   * 말풍선(113) · 효과 팝업 · 126 연출이 떠 있으면 그쪽이 키를 받는다. 앞서 웹은 이 키를 안 받아 지도가 마우스로만 움직였다 (r82)
   */
  const isMapKeyOn = openPlace === null && resultText === null && presentation === null && noticeText === ''
  const latest = useRef({ selectedPlaceId, onBack })
  latest.current = { selectedPlaceId, onBack }
  useEffect(() => {
    if (!isMapKeyOn) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      const cursor = Math.max(OUTING_PLACES.findIndex((place) => place.id === current.selectedPlaceId), 0)
      if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        event.preventDefault()
        return setOpenPlace(OUTING_PLACES[cursor])
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        return current.onBack()
      }
      const direction = outingMapDirectionOf(event.key)
      if (direction === null) return
      event.preventDefault()
      setSelectedPlaceId(OUTING_PLACES[moveOutingMapCursor(cursor, direction)]?.id ?? current.selectedPlaceId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMapKeyOn])

  return (
    <OutingMap
      selectedPlaceId={selectedPlaceId}
      eventPlaceIds={eventPlaceIds}
      onOpen={(place) => {
        setSelectedPlaceId(place.id)
        setOpenPlace(place)
      }}
      onBack={openPlace === null ? onBack : () => setOpenPlace(null)}
    >
      {/*
        말풍선은 0x7ee1a 가 [gfx+0x174] == 0x71(113) 일 때만 그린다 — 기능이 막히면 113 에 남아 팝업 밑에 그대로 있고,
        통과하면 126(연출 · 효과 팝업)이라 사라진다(0x16dd4~0x16ddc)
      */}
      {openPlace !== null && presentation === null && resultText === null && (
        <PlaceBubble
          place={openPlace}
          isKeyEnabled={noticeText === ''}
          onEnter={() => onEnter(openPlace)}
          onRun={onRun}
          onClose={() => setOpenPlace(null)}
        />
      )}
      {presentation}
      {noticeText !== '' && <MessageBox text={noticeText} buttons={['확인']} onAnswer={onCloseNotice} />}
      {resultText !== null && (
        <MessageBox text={resultText} buttons={['확인']} onAnswer={() => onCloseResult?.()} />
      )}
    </OutingMap>
  )
}

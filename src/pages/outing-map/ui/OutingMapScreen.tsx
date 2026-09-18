import { useState } from 'react'
import { Hint, MenuList, PixelScreen, StatusBar } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { outingBlockReasonOf } from '@/entities/career/model/outing'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { OutingMap } from '@/pages/outing-map/ui/OutingMap'

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
 * 지도는 원본 프레임 배치 그대로다. 장소 기능 목록의 원본 틀(말풍선 박스 3)은 아직 옮기지 않았다.
 */
export function OutingMapScreen({ career, noticeText, onRun, onBack, eventPlaceIds, onEnter }: OutingMapScreenProps) {
  const [openPlace, setOpenPlace] = useState<OutingPlace | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState(OUTING_PLACES[0].id)

  if (openPlace === null) {
    return (
      <OutingMap
        selectedPlaceId={selectedPlaceId}
        eventPlaceIds={eventPlaceIds}
        noticeText={noticeText}
        onOpen={(place) => {
          setSelectedPlaceId(place.id)
          setOpenPlace(place)
        }}
        onBack={onBack}
      />
    )
  }

  const items: MenuItem[] = openPlace.functions.map((activity) => {
    const blockReason = outingBlockReasonOf(career, activity)
    return {
      id: activity.id,
      label: activity.name,
      detail: blockReason === null ? activity.description : `${blockReason} — 지금은 못 합니다`,
      cost:
        activity.effect.moneyCost < 0
          ? `+${-activity.effect.moneyCost}만`
          : activity.effect.moneyCost > 0
            ? `${activity.effect.moneyCost}만`
            : '무료',
      isDisabled: blockReason !== null,
    }
  })

  return (
    <PixelScreen
      title={openPlace.name}
      // StrMODE[48] [들어가기] — [!] 가 없는 장소는 "특별한 일이 없다" 이벤트를 본다. 이번 주기에 행동했으면 막힌다
      leftKey={career.hasActedThisCycle ? undefined : { label: '들어가기', onPress: () => onEnter(openPlace) }}
      rightKey={{ label: '지도로', onPress: () => setOpenPlace(null) }}
    >
      <StatusBar career={career} />
      <MenuList
        items={items}
        onSelect={(id) => {
          onRun(id)
          setOpenPlace(null)
        }}
      />
      <Hint>소지금 {career.money}만 · 사기 {career.morale}</Hint>
    </PixelScreen>
  )
}

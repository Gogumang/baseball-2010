import { MessageBox } from '@/shared/ui'
import type { OriginalMission } from '@/shared/config/original/missions'
import { EVENT_MISSION_EMPTY_TEXT } from '@/pages/mission-select/lib/missionSelectLayout'
import { EventMissionWindow } from '@/pages/mission-select/ui/EventMissionWindow'
import type { EventMissionAnswer } from '@/pages/mission-select/ui/EventMissionWindow'
import { LOCKED_MISSION_TEXT, challengeTextOf } from './missionSelectAssets'
import type { EventMissionWindowKind } from './useEventMissionAnswer'

/** OK 팝업 — [60] 잠긴 칸 알림 · [61] 도전 확인 */
export type MissionPopup = { readonly kind: '잠김' } | { readonly kind: '도전'; readonly mission: OriginalMission } | null

/**
 * 판 위의 창 — 이벤트 미션 창(`EventMissionWindow`) · 잠긴 칸 알림 StrMAINMENU[60] · 도전 확인 [61](예면 곧바로 경기) ·
 * 받은 미션이 없다는 알림 `EVENT_MISSION_EMPTY_TEXT`
 */
export function MissionPopups({
  eventWindow,
  isEventRunSelected,
  popup,
  onToggleEventRun,
  onEventKey,
  onCloseEventWindow,
  onClosePopup,
  onSelect,
}: {
  readonly eventWindow: EventMissionWindowKind
  readonly isEventRunSelected: boolean
  readonly popup: MissionPopup
  readonly onToggleEventRun: () => void
  readonly onEventKey: (answer: EventMissionAnswer) => void
  readonly onCloseEventWindow: () => void
  readonly onClosePopup: () => void
  readonly onSelect: (mission: OriginalMission) => void
}) {
  return (
    <>
      {eventWindow === '창' && (
        <EventMissionWindow isRunSelected={isEventRunSelected} onToggle={onToggleEventRun} onKey={onEventKey} onClosed={onCloseEventWindow} />
      )}
      {popup?.kind === '잠김' && <MessageBox text={LOCKED_MISSION_TEXT} buttons={['OK']} onAnswer={onClosePopup} />}
      {popup?.kind === '도전' && (
        <MessageBox
          text={challengeTextOf(popup.mission.name)}
          buttons={['예', '아니오']}
          onAnswer={(answer) => {
            onClosePopup()
            if (answer === 0) onSelect(popup.mission)
          }}
        />
      )}
      {eventWindow === '알림' && <MessageBox text={EVENT_MISSION_EMPTY_TEXT} buttons={['OK']} onAnswer={onCloseEventWindow} />}
    </>
  )
}

import { MessageBox } from '@/shared/ui'
import type { MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'
import { CONFIRM_BUTTONS, CONFIRM_TEXT, NOTICE_BUTTONS, NO_DETAIL_TEXT } from '@/pages/match-settings/lib/matchSettingsText'

/** 확인창(예/아니오) · 상세 없음 알림 — `onAnswer(예인가)`. 알림은 늘 아니오로 닫는다 */
export function SettingsPopups({
  popup,
  onAnswer,
}: {
  readonly popup: MatchSettingsWindowState['popup']
  readonly onAnswer: (isYes: boolean) => void
}) {
  return (
    <>
      {popup === '확인' && <MessageBox text={CONFIRM_TEXT} buttons={CONFIRM_BUTTONS} onAnswer={(index) => onAnswer(index === 0)} />}
      {popup === '상세없음' && <MessageBox text={NO_DETAIL_TEXT} buttons={NOTICE_BUTTONS} onAnswer={() => onAnswer(false)} />}
    </>
  )
}

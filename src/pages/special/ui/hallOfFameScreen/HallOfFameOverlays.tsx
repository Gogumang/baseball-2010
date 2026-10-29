import { MessageBox } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { SpecialBands } from '@/pages/special/ui/specialScreen/SpecialBands'
import { popupTextOf } from '@/pages/special/ui/hallOfFameScreen/hallOfFameText'
import type { HallOfFamePopup } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

/** 머리띠 — `frame` 을 받으면 그 제목 · G포인트, 안 받으면 미끄러지는 제목 0 띠 */
export function HallOfFameFrame({
  frame,
  onBack,
}: {
  readonly frame: { readonly title: ScreenFrameTitle; readonly gamePoint: number } | undefined
  readonly onBack: () => void
}) {
  if (frame === undefined) return <SpecialBands onBack={onBack} slides />
  return <ScreenFrame title={frame.title} gamePoint={frame.gamePoint} onBack={onBack} />
}

/** 팝업 창 — 히든 알림은 앱의 공용 창이 그려 아무것도 없다 */
export function HallOfFamePopupBox({ popup, onAnswer }: { readonly popup: HallOfFamePopup | null; readonly onAnswer: (index: number) => void }) {
  const popupView = popup === null ? null : popupTextOf(popup)
  if (popupView === null) return null
  return (
    <MessageBox
      text={popupView.text}
      buttons={popupView.buttons}
      {...(popupView.initialSelected === undefined ? {} : { initialSelected: popupView.initialSelected })}
      onAnswer={onAnswer}
      // 창이 떠 있으면 0x62568 이 격자를 건너 날 키를 0x5550c 에 넘긴다(625a6~625be) — 화살표면 [skin+0x8c] 에 남는다(Q-10)
      onRawKey={noteSkinShakeKey}
    />
  )
}

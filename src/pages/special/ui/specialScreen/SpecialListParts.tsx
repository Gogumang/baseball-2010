import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { PressArea } from '@/shared/ui/PressArea/PressArea'
import { MENU_DESCRIPTION_PANEL } from '@/pages/special/ui/specialScreen/otherSlices'
import { SpecialBands } from '@/pages/special/ui/specialScreen/SpecialBands'

/** 설명 판 자리 투명 누름 칸 = OK (바닥띠 되돌아가기 x 206~ 는 비워 둔다) */
export function SpecialOpenArea({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <PressArea
      label={label}
      onPress={onPress}
      rect={{
        x: MENU_DESCRIPTION_PANEL.x,
        y: MENU_DESCRIPTION_PANEL.y,
        width: 200 - MENU_DESCRIPTION_PANEL.x,
        height: 320 - MENU_DESCRIPTION_PANEL.y,
      }}
    />
  )
}

/** 머리띠 0x54d95(skin, 0, 5) — G포인트를 받으면 `ScreenFrame`(안 미끄러짐), 안 받으면 제목 0 띠만 */
export function SpecialListFrame({ gamePoint, onBack }: { readonly gamePoint: number | undefined; readonly onBack: () => void }) {
  if (gamePoint === undefined) return <SpecialBands onBack={onBack} />
  return <ScreenFrame title="2010프로야구" gamePoint={gamePoint} onBack={onBack} slides={false} />
}

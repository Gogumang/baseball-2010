import { PressArea } from '@/shared/ui'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import { AimSection, GaugeSection, SlotSection } from './PitchInputs'
import { isPitchMenuShownOf, type PitchingViewModel } from './pitchingViewModel'

/** 0xe — OK 하나만 받는다 (0x532b0). 원본 화면에 글자는 없다 — 마우스 길로 판 전체를 누름 칸으로 */
export function ConfirmPressLayer({ model }: { readonly model: PitchingViewModel }) {
  if (!model.isAwaitingConfirm || model.menuState.menu.isOpen) return null
  return (
    <PressLayer testId="확인 누름 칸">
      <PressArea label="확인" isDisabled={!model.sceneConfirm.acceptsConfirm} onPress={model.sceneConfirm.confirm} />
    </PressLayer>
  )
}

/** 투구 세 단계 — 0xf 구질 · 0x10 조준 · 0x11 게이지. 그림은 장면이 그리고 여기는 키 · 틱 · 누름 칸만 */
export function PitchingInputsLayer({ model }: { readonly model: PitchingViewModel }) {
  return (
    <>
      {isPitchMenuShownOf(model) && <SlotSection model={model} />}
      {model.phase === '코스' && <AimSection model={model} />}
      {model.phase === '게이지' && <GaugeSection model={model} />}
    </>
  )
}

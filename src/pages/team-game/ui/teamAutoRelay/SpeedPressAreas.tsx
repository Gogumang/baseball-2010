import { PressArea } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { ARROW_Y, GUIDE_FRAME, SCREEN_HEIGHT, SCREEN_WIDTH } from './relayLayout'

/**
 * 웹 덧붙임 — 속도 화살(5×8, 깜박임) 위 투명 칸: 원본 ← · → 키 한 번(속도 −1 · +1). 같은 키를 상황 버튼으로 또 내지 않는다(필요한 버튼만).
 * "CLR 중단" 글자(game_ui 92, 위 안내 그림) 자리 — 원본 CLR 키 한 번(중단 질문). r186 — 늘 있던 뒤로 버튼을 걷었다
 */
export function SpeedPressAreas({ labelWidth, gameUiOrigins }: { readonly labelWidth: number; readonly gameUiOrigins: FrameOrigins | null }) {
  const guide = gameUiOrigins?.[String(GUIDE_FRAME).padStart(3, '0')]
  return (
    <>
      <PressArea
        label="속도 느리게"
        onPress={() => tapKey('ArrowLeft')}
        rect={{ x: SCREEN_WIDTH / 2 - Math.trunc(labelWidth / 2) - 13, y: ARROW_Y - 4, width: 14, height: 16 }}
      />
      <PressArea
        label="속도 빠르게"
        onPress={() => tapKey('ArrowRight')}
        rect={{ x: SCREEN_WIDTH / 2 + Math.trunc(labelWidth / 2) - 1, y: ARROW_Y - 4, width: 14, height: 16 }}
      />
      {guide !== undefined && (
        <PressArea
          label="CLR 중단"
          onPress={() => tapKey('Escape')}
          rect={{ x: SCREEN_WIDTH / 2 - Math.trunc(guide.width / 2), y: SCREEN_HEIGHT - guide.height - 1, width: guide.width, height: guide.height }}
        />
      )}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'
import { stopSkinFrameSlide } from '@/shared/lib/skinFrameSlide/skinFrameSlide'
import { FRAME_SLIDE_BODY_FIRST_DRAW } from '@/widgets/screen-frame/lib/frameSlide'
import {
  HELP_PANEL_FULL_HEIGHT,
  HELP_PANEL_OPEN_HEIGHTS,
  helpPanelCloseHeightsFrom,
  helpPanelHeightAfterCloseDraw,
  helpPanelHeightAfterOpenDraw,
} from '@/pages/help/lib/helpLayout'

/** 닫기 연출 — CLR 을 받은 본문 그리기 번호와 그 뒤 그릴 높이들 */
interface HelpClosing {
  readonly from: number
  readonly heights: readonly number[]
}

/** 이 그림의 판 높이 — 닫는 중이면 닫기 걸음 칸, 아니면 열기 걸음 칸(다 열렸으면 끝 높이) */
function panelHeightOf(closing: HelpClosing | null, closingStep: number | null, bodyTick: number): number {
  if (closing !== null && closingStep !== null) return closing.heights[Math.min(closingStep, closing.heights.length - 1)]
  return HELP_PANEL_OPEN_HEIGHTS[Math.max(0, bodyTick)] ?? HELP_PANEL_FULL_HEIGHT
}

/**
 * **뷰어 판의 여닫기 · 깜빡임** — 판은 열 때 4프레임에 걸쳐 커지고, 메인 메뉴에서는 CLR 로 닫을 때 4프레임에 걸쳐 줄어든다
 * (`HELP_PANEL_*_HEIGHTS`). 경기 중은 `[뷰어+0x125]` 라 CLR 이 곧장 닫는다(`isOverGame`).
 *
 * 경기 중 [조작방법] — 0x3c158 이 뷰어를 0x63689(skin, 0) 로 열자마자(+0x84 = 1) 3c26a 에서 [skin+0x84] = 0 으로 지운다.
 * 머리띠가 없는 화면이라 미끄러짐 없이 바로 본문이고, 전역 칸은 내려온 채가 된다 (r168). 들어옴은 첫 그림보다 앞이다
 */
export function useHelpPanel(isOverGame: boolean, onBack: () => void) {
  useState(() => {
    if (isOverGame) stopSkinFrameSlide()
    return null
  })
  /** 그린 횟수 — 깜빡임(+0x410)이 센다 */
  const tick = useUpdateCounter()
  /**
   * 본문 몇째 그림인가 — 메인 메뉴 7 · 10 은 뷰어 열기 0x63688 이 [skin+0x84] = 1 · [+0x86] = 1 을 써(63728~63730) 머리띠가
   * 미끄러지고, 그리기 0x58d10 은 [skin+0x84] ≠ 0 이면(58d54~58d60) 판도 글도 없이 593aa 로 끝난다 — 깜빡임 +0x410 은 그 앞
   * 58d14 에서 오른다. 판 여닫기(+0x90)도 본문에서만 걸음을 가므로 본문 첫 그림부터 센다 (r168).
   */
  const bodyTick = isOverGame ? tick : tick - FRAME_SLIDE_BODY_FIRST_DRAW
  /**
   * 닫기 연출 (메인 메뉴만). CLR 을 다시 받으면 그때 높이 칸에서 걸음 1 로 다시 줄인다(0x6385c · 0x6388a — U-86, `helpPanelCloseHeightsFrom`)
   */
  const [closing, setClosing] = useState<HelpClosing | null>(null)
  const closingStep = closing === null ? null : Math.max(0, bodyTick - closing.from)
  const panelHeight = panelHeightOf(closing, closingStep, bodyTick)
  const isAnimating = panelHeight < HELP_PANEL_FULL_HEIGHT
  /** [skin+0x410] — 0x58d14 가 그릴 때마다 올린 뒤의 값으로 본다 (앱에 하나, U-90) */
  const blinkCounter = useSkinBlinkCounter(tick)

  const hasClosedRef = useRef(false)
  useEffect(() => {
    if (closing === null || closingStep === null || closingStep < closing.heights.length || hasClosedRef.current) return
    // 닫기 끝(+0x98)이 선 다음 갱신에 0x637d0 이 1 을 돌려준다
    hasClosedRef.current = true
    onBack()
  }, [closing, closingStep, onBack])

  /** 0x63850 · 0x6387e — `+0x125`(경기 장면)면 곧장 닫고, 아니면 닫기 연출을 건다 */
  const close = () => {
    if (isOverGame) return onBack()
    setClosing((previous) => {
      // 지금 그림 뒤의 높이 칸 — 여는 중 · 다 열린 판이면 열기 걸음 뒤, 닫는 중이면 닫기 걸음 뒤(끝이 섰으면 바닥 10)
      const start =
        previous === null
          ? helpPanelHeightAfterOpenDraw(bodyTick)
          : helpPanelHeightAfterCloseDraw(previous.heights, Math.max(0, bodyTick - previous.from))
      return { from: Math.max(0, bodyTick), heights: helpPanelCloseHeightsFrom(start) }
    })
  }

  return {
    isBodyShown: bodyTick >= 0,
    isClosing: closingStep !== null,
    panelHeight,
    isAnimating,
    isBlinkOn: !isAnimating && blinkCounter % 8 <= 3,
    close,
  }
}

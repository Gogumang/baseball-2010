import { PressArea } from '@/shared/ui'
import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { HELP_VIEWER } from '@/pages/help/lib/helpLayout'
import { HELP_SCROLL_BAR, helpScrollKnobTopOf, helpScrollMetricsOf } from '@/pages/help/lib/helpPages'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { SLT_FRAME, imageSrc } from './helpScreenAssets'

/** 스크롤 막대 0x58c10 — 바탕 · 위아래 화살(slt_frame 이미지 78) · 흰 손잡이. `lineCount` = 이 쪽의 줄 수 */
export function HelpScrollBar({
  lineCount,
  scrollTop,
  isChoosingChapter,
}: {
  readonly lineCount: number
  readonly scrollTop: number
  readonly isChoosingChapter: boolean
}) {
  const knobTop = helpScrollKnobTopOf(lineCount, scrollTop)
  const { knobLength, maxTop } = helpScrollMetricsOf(lineCount)
  return (
    <>
      <div
        className={styles.scrollTrack}
        style={{ left: HELP_SCROLL_BAR.x, top: HELP_SCROLL_BAR.y, width: HELP_SCROLL_BAR.width, height: HELP_SCROLL_BAR.height }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, HELP_VIEWER.scrollCap.image)}
        style={{ left: HELP_SCROLL_BAR.x, top: HELP_SCROLL_BAR.y - 4 }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, HELP_VIEWER.scrollCap.image)}
        style={{ left: HELP_SCROLL_BAR.x, top: HELP_SCROLL_BAR.y + HELP_SCROLL_BAR.trackLength + 1, transform: 'scaleY(-1)' }}
      />
      {/* 웹 덧붙임 — 막대 위 · 아래 끝 화살(7×5) 위 투명 칸: 원본 ↑ · ↓ 키 한 번. 같은 키를 상황 버튼으로 또 내지 않는다(필요한 버튼만) */}
      {maxTop > 0 && !isChoosingChapter && (
        <>
          <PressArea
            label="위 줄"
            onPress={() => tapKey('ArrowUp')}
            rect={{ x: HELP_SCROLL_BAR.x - 4, y: HELP_SCROLL_BAR.y - 10, width: 15, height: 14 }}
          />
          <PressArea
            label="아래 줄"
            onPress={() => tapKey('ArrowDown')}
            rect={{ x: HELP_SCROLL_BAR.x - 4, y: HELP_SCROLL_BAR.y + HELP_SCROLL_BAR.trackLength - 2, width: 15, height: 14 }}
          />
        </>
      )}
      <div
        className={styles.scrollKnob}
        data-testid="스크롤손잡이"
        style={{ left: HELP_SCROLL_BAR.x + 1, top: HELP_SCROLL_BAR.y + knobTop + 1, width: 4, height: knobLength }}
      />
    </>
  )
}

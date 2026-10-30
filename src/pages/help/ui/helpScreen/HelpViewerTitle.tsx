import type { CSSProperties } from 'react'
import { HELP_VIEWER } from '@/pages/help/lib/helpLayout'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { IMG_TEXT_FRAMES, SLT_FRAMES, imageSrc } from './helpScreenAssets'

/**
 * 장 머리 — 잠긴 뷰어(장 6)는 띠 없이 img_text 프레임 26 (0x58e3c~0x58e8a), 아니면 장 띠 slt_frame 프레임 55~60 + 그 상자 안 장 이름
 * img_text (0x58f22~0x5908c) + 장 테두리 프레임 61 — 쪽 보기면 늘, 장 고르기면 깜빡인다 (0x59090~0x590ec).
 * 이름 글자는 **팔레트 3** 으로 찍는다(`namePaletteStyle` — `useImgTextPalette3`)
 */
export function HelpViewerTitle({
  section,
  isChapterLocked,
  showsHighlight,
  namePaletteStyle,
}: {
  readonly section: number
  readonly isChapterLocked: boolean
  readonly showsHighlight: boolean
  readonly namePaletteStyle: CSSProperties | undefined
}) {
  const tabBox = HELP_VIEWER.tabBoxes[section]
  const name = HELP_VIEWER.names[section]
  if (isChapterLocked || tabBox === undefined || name === undefined) {
    const locked = HELP_VIEWER.lockedTitle
    return (
      <img
        className={styles.sprite}
        alt="게임문의"
        src={imageSrc(IMG_TEXT_FRAMES, locked.frame)}
        style={{ ...namePaletteStyle, left: locked.x - Math.trunc(locked.width / 2), top: locked.y }}
      />
    )
  }
  const { x0, y0 } = HELP_VIEWER
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAMES, HELP_VIEWER.tab.firstFrame + section)}
        style={{ left: HELP_VIEWER.tab.x, top: HELP_VIEWER.tab.y }}
      />
      <img
        className={styles.sprite}
        alt={`장 ${section + 1}`}
        src={imageSrc(IMG_TEXT_FRAMES, name.frame)}
        style={{ ...namePaletteStyle, left: x0 + tabBox[0] + Math.trunc((tabBox[2] - name.width) / 2), top: y0 + tabBox[1] + 2 }}
      />
      {showsHighlight && (
        <img
          className={styles.sprite}
          alt=""
          data-testid="장테두리"
          src={imageSrc(SLT_FRAMES, HELP_VIEWER.highlightFrame)}
          style={{ left: x0 + tabBox[0], top: y0 + tabBox[1] - 2 }}
        />
      )}
    </>
  )
}

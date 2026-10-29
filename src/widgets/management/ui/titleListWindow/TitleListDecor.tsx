import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TITLE_HEADER_FRAME, TITLE_HEADER_OX, TITLE_LIST_BOXES, TITLE_LIST_FRAME, centeredTopOf } from '@/widgets/management/lib/titleListLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import { IMG_TEXT, MODE_UI, pad } from '@/widgets/management/ui/titleListWindow/titleListAssets'

const { header: headerBox } = TITLE_LIST_BOXES

/** 박스 1 — img_text 279 "닉네임" 팔레트 3 · 정렬 0x21 · ox 28 */
export function TitleHeader({ textOrigins, filterId }: { readonly textOrigins: FrameOrigins | null; readonly filterId: string }) {
  const header = textOrigins?.[pad(TITLE_HEADER_FRAME)]
  if (header === undefined) return null
  return (
    <img
      className={styles.layer}
      alt="닉네임"
      data-testid="칭호-머리"
      src={`${IMG_TEXT}/${pad(TITLE_HEADER_FRAME)}.png`}
      style={{
        left: headerBox.x + TITLE_HEADER_OX + header.x,
        top: centeredTopOf(headerBox, header.height) + header.y,
        filter: `url(#${filterId})`,
      }}
    />
  )
}

/** 프레임 63 의 ▲▼ */
export function TitleArrows({ modeUiOrigins }: { readonly modeUiOrigins: FrameOrigins | null }) {
  const arrows = modeUiOrigins?.[pad(TITLE_LIST_FRAME.arrows)]
  if (arrows === undefined) return null
  return <img className={styles.layer} alt="" src={`${MODE_UI}/${pad(TITLE_LIST_FRAME.arrows)}.png`} style={{ left: arrows.x, top: arrows.y }} />
}

import { FrameSprite } from '@/shared/ui'
import { PAGE_TITLE, TOTAL_ROW } from '@/pages/record/lib/recordAnnalsLayout'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { IMG_TEXT, SLT_FRAME, SLT_FRAMES, imageSrc } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { Origins } from '@/pages/record/ui/recordAnnals/annalsAssets'

/** 아래 합계 줄 — 프레임 15 + 노란 네모 38 + img_text 269 "전체합계", 값은 노랑 */
export function TotalRow({
  frames,
  textFrames,
  value,
  isRightAligned = false,
}: {
  readonly frames: Origins
  readonly textFrames: Origins
  readonly value: string
  readonly isRightAligned?: boolean
}) {
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, PAGE_TITLE.bulletImage)}
        style={{ left: TOTAL_ROW.bulletX, top: TOTAL_ROW.y + TOTAL_ROW.bulletDy }}
      />
      <FrameSprite folder={IMG_TEXT} frame={TOTAL_ROW.labelFrame} origins={textFrames} x={TOTAL_ROW.labelX} y={TOTAL_ROW.y + TOTAL_ROW.labelDy} />
      <FrameSprite folder={SLT_FRAMES} frame={TOTAL_ROW.frame} origins={frames} x={TOTAL_ROW.frameX} y={TOTAL_ROW.y} />
      <div
        className={styles.totalValue}
        style={{
          left: TOTAL_ROW.value.x,
          top: TOTAL_ROW.y + TOTAL_ROW.value.dy,
          width: TOTAL_ROW.value.width,
          textAlign: isRightAligned ? 'right' : undefined,
        }}
      >
        {value}
      </div>
    </>
  )
}

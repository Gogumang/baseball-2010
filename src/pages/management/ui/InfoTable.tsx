import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { INFO_COLUMNS, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP } from '@/pages/management/lib/basicInfoLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

const IMG_TEXT = '/sprites/img_text/frames'

/** 정보 칸 (0x7c450) — 이름표는 img_text 오른쪽 정렬, 값은 시스템 글꼴 가운데. 타순만 노란 숫자 */
export function InfoTable({ values, battingOrder }: { readonly values: readonly string[]; readonly battingOrder: number }) {
  const origins = useFrameOrigins(IMG_TEXT)
  const widthOf = (frame: number) => origins?.[String(frame).padStart(3, '0')]?.width ?? 0
  let valueIndex = 0
  return (
    <>
      {INFO_COLUMNS.map((column, columnIndex) =>
        column.labelFrames.map((frame, row) => {
          const top = INFO_TOP + row * INFO_ROW_STEP
          const isBattingOrder = columnIndex === 1 && row === column.labelFrames.length - 1
          const value = isBattingOrder ? String(battingOrder) : values[valueIndex++]
          return (
            <div key={frame}>
              <img className={styles.layer} alt="" src={`${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`}
                style={{ left: column.label.x + column.label.width - widthOf(frame), top: top + 3 }} />
              <div className={styles.infoValue}
                style={{ left: column.value.x, top, width: column.value.width, height: INFO_ROW_HEIGHT, color: isBattingOrder ? ORIGINAL_COLORS.highlightYellow : ORIGINAL_COLORS.text }}>
                {value}
              </div>
            </div>
          )
        }),
      )}
    </>
  )
}

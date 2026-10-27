import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { INFO_COLUMNS, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP } from '@/pages/management/lib/basicInfoLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')

/**
 * 정보 칸 (0x7c450) — 이름표는 img_text 오른쪽 정렬, 값은 시스템 글꼴 가운데. 타순만 노란 숫자.
 *
 * 숫자도 **시스템 글꼴**이다 — ui/num 숫자 그림(numBox 0xba719)은 시즌(모드 2, 0x7b998) 갈래에서만 부른다
 * (0x7c8ea 좌석 · 0x7cdc2 우승 · 0x7ceae 순위, 시즌 구단정보 `SeasonTeamInfoScreen`). 나리 타자편(모드 4) 타순은
 * 0x7cf58~0x7cfa0: 값 = 0xb6395(선수) + 1, 색 0x1400748(255, 255, 0) 노랑, 0xba44d(x, y, 값, 정렬 0x22, 색) →
 * sprintf "%d"(0xcbb80) → 글 그리기 0xba410. 나머지 칸도 모두 0xba411(글) 이다.
 */
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

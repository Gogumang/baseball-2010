import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { MenuWheelUnderlayImage, TOP_ENTRIES, menuWheelLabelTopLeftOf, menuWheelRestingLabelsOf } from '@/pages/special/ui/specialScreen/otherSlices'
import { IMG_TEXT_FRAMES, imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'

/** [스페셜] 칸 — 윗단 배열 `[0x1552d4c]` 를 이 칸이 0번(0°)에 오도록 돈 커서 */
const SPECIAL_WHEEL_CURSOR = TOP_ENTRIES.findIndex((entry) => entry.id === '스페셜')

/**
 * 반원 바퀴 0x24b1c 의 칸 — 자리 5 → 0 차례로 main_ui 이미지 0 밑판을 찍고 그 위에 img_text 프레임 글자를 기준점 가운데
 * (0x24fc4: x − w/2, y − h/2)에. 하위 6 은 키가 바퀴를 안 돌려 누를 수 없는 그림이다(메인 메뉴 아랫단의 `disabled` 칸과 같다).
 */
export function SpecialWheelLabels() {
  const origins = useFrameOrigins(IMG_TEXT_FRAMES)
  return (
    <>
      {[...menuWheelRestingLabelsOf(SPECIAL_WHEEL_CURSOR)].reverse().map((label) => {
        const underlay = <MenuWheelUnderlayImage key={`${label.entryIndex}-밑판`} underlay={label.underlay} />
        const size = origins?.[String(label.frame).padStart(3, '0')]
        if (size === undefined) return underlay
        const topLeft = menuWheelLabelTopLeftOf(label.point, size.width, size.height)
        return [
          underlay,
          <img
            key={label.entryIndex}
            className={styles.sprite}
            alt=""
            data-wheel-label={TOP_ENTRIES[label.entryIndex]?.id}
            src={imageSrc(IMG_TEXT_FRAMES, label.frame)}
            style={{ left: topLeft.x, top: topLeft.y }}
          />,
        ]
      })}
    </>
  )
}

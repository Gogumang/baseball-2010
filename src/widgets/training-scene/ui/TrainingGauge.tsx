import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

/**
 * 훈련 게이지 (binary.mod 0x847e0(1, 137)).
 * mode_ui 프레임 58(틀)을 (1, 137) 에 그리고, 채운 칸 수만큼 프레임 59(13×1)를
 * x = 6, y = 133 부터 한 줄씩 위로 쌓는다. 60칸이면 가득 찬다.
 */
const FOLDER = './sprites/mode_ui/frames'
const FRAME = { key: '058', x: 1, y: 137 }
const FILL = { key: '059', x: 6, bottomY: 133 }

export function TrainingGauge({ filled }: { readonly filled: number }) {
  const origins = useFrameOrigins(FOLDER)
  const frame = origins?.[FRAME.key]
  const fill = origins?.[FILL.key]
  const count = Math.max(0, Math.min(TRAINING_POPUP_UPDATES, filled))

  return (
    <>
      {frame !== undefined && (
        <img className={styles.sprite} style={{ left: FRAME.x + frame.x, top: FRAME.y + frame.y }} src={`${FOLDER}/${FRAME.key}.png`} alt="" />
      )}
      {fill !== undefined &&
        Array.from({ length: count }, (_unused, index) => (
          <img
            key={index}
            className={styles.sprite}
            style={{ left: FILL.x + fill.x, top: FILL.bottomY - index + fill.y }}
            src={`${FOLDER}/${FILL.key}.png`}
            alt=""
          />
        ))}
    </>
  )
}

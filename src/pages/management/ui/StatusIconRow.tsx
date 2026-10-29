import { Fragment } from 'react'
import { STATUS_BOXES, STATUS_ICON_STEP } from '@/pages/management/lib/managementLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { EAGLE_EYE_FRAME, eagleEyeDigitsOf, statusIconFramesFrom } from '@/pages/management/lib/statusIcons'
import type { StatusIconState } from '@/pages/management/lib/statusIcons'

const iconImageOf = (frame: number) => assetUrl(`./sprites/mode_ui/frames/${String(frame).padStart(3, '0')}.png`)

interface StatusIconRowProps {
  readonly state: StatusIconState
  /** 줄의 원점 — 기본은 화면 원점(박스 11 을 그대로 쓴다) */
  readonly originX?: number
  readonly originY?: number
}

/** 아이콘을 박스 11 자리부터 22px 씩 늘어놓는다. 감싸는 요소가 position 기준이 된다 */
export function StatusIconRow({ state, originX = 0, originY = 0 }: StatusIconRowProps) {
  const box = STATUS_BOXES.statusIcons
  return (
    <>
      {statusIconFramesFrom(state).map((frame, index) => {
        const slot = { ...box, x: originX + box.x + index * STATUS_ICON_STEP, y: originY + box.y }
        return (
          <Fragment key={frame}>
            <img className={styles.layer} src={iconImageOf(frame)} alt="" style={{ left: slot.x, top: slot.y }} />
            {frame === EAGLE_EYE_FRAME &&
              eagleEyeDigitsOf(state.eagleEyeGamesRemaining, slot).map((digit, digitIndex) => (
                <img
                  key={digitIndex}
                  className={styles.layer}
                  src={assetUrl(`./sprites/num/${String(digit.frame).padStart(3, '0')}.png`)}
                  alt=""
                  style={{ left: digit.left, top: digit.top }}
                />
              ))}
          </Fragment>
        )
      })}
    </>
  )
}

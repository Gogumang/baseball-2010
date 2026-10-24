import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/ScreenOverlay/ScreenOverlay.css'

/**
 * 게임 화면 위에 덮개를 얹는다.
 *
 * 덮개를 화면과 형제로 그릴 때 이걸로 감싸면 **240×320 기둥 안에** 갇힌다.
 * 감싸지 않으면 `position: absolute; inset: 0` 이 창 전체를 덮어 구석에 그려진다.
 */
export function ScreenOverlay({ children, zIndex }: {
  readonly children: ReactNode
  /** 겹 차례 — 주면 덮개 전체가 그 차례로 화면 겹들 위에 선다(`SCREEN_LAYERS`). 안 주면 안쪽 겹이 제 값으로 화면 겹과 겨룬다 */
  readonly zIndex?: number
}) {
  return (
    <div className={styles.layer} style={zIndex === undefined ? undefined : { zIndex }}>
      <div className={styles.column}>{children}</div>
    </div>
  )
}

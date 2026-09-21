import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/ScreenOverlay/ScreenOverlay.css'

/**
 * 게임 화면 위에 덮개를 얹는다.
 *
 * 덮개를 화면과 형제로 그릴 때 이걸로 감싸면 **240×320 기둥 안에** 갇힌다.
 * 감싸지 않으면 `position: absolute; inset: 0` 이 창 전체를 덮어 구석에 그려진다.
 */
export function ScreenOverlay({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.layer}>
      <div className={styles.column}>{children}</div>
    </div>
  )
}

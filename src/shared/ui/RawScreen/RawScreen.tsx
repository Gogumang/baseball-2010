import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/RawScreen/RawScreen.css'

interface RawScreenProps {
  readonly children: ReactNode
  /** 화면 아무 곳이나 누르면 불린다 — 원작 "PRESS ANY KEY" 같은 곳에 쓴다. */
  readonly onPress?: () => void
}

/** 원작 240×320 캔버스 한 장. 안쪽은 전부 절대 좌표로 배치한다. */
export function RawScreen({ children, onPress }: RawScreenProps) {
  return (
    <div className={styles.screen} onClick={onPress}>
      <div className={styles.stage}>{children}</div>
    </div>
  )
}

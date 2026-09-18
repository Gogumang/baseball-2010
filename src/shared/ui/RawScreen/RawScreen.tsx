import { useState } from 'react'
import type { ReactNode } from 'react'
import { SheetHostContext } from '@/shared/ui/BottomSheet/sheetHost'
import * as styles from '@/shared/ui/RawScreen/RawScreen.css'

interface RawScreenProps {
  readonly children: ReactNode
  /** 화면 아무 곳이나 누르면 불린다 — 원작 "PRESS ANY KEY" 같은 곳에 쓴다. */
  readonly onPress?: () => void
}

/** 원작 240×320 캔버스 한 장. 안쪽은 전부 절대 좌표로 배치하고, 바텀시트도 여기에 붙는다. */
export function RawScreen({ children, onPress }: RawScreenProps) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null)

  return (
    <div className={styles.screen} onClick={onPress}>
      <div ref={setStage} className={styles.stage}>
        <SheetHostContext.Provider value={stage}>{children}</SheetHostContext.Provider>
      </div>
    </div>
  )
}

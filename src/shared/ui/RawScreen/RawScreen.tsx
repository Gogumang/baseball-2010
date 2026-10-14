import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { leaveFrame } from '@/shared/lib/leftFrame/leftFrame'
import * as styles from '@/shared/ui/RawScreen/RawScreen.css'

interface RawScreenProps {
  readonly children: ReactNode
  /** 화면 아무 곳이나 누르면 불린다 — 원작 "PRESS ANY KEY" 같은 곳에 쓴다. */
  readonly onPress?: () => void
}

/** 원작 240×320 캔버스 한 장. 안쪽은 전부 절대 좌표로 배치한다. */
export function RawScreen({ children, onPress }: RawScreenProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const stage = stageRef.current
    // 내려갈 때 판을 남긴다 — 다음 화면이 첫 틀에 아무것도 안 그리면 원본 화면 버퍼에 이 그림이 남아 있다 (`leftFrame`)
    return () => {
      if (stage !== null) leaveFrame(stage)
    }
  }, [])
  return (
    <div className={styles.screen} onClick={onPress}>
      {/* 원작 240×320 화면 버퍼 자리 — 화면 전체 흔들기(`useWholeScreenOffset`)가 이 틀로 자른다 */}
      <div ref={stageRef} className={styles.stage} data-original-screen="">{children}</div>
    </div>
  )
}

import type { ReactNode } from 'react'
import * as styles from '@/pages/pitching/ui/PressLayer.css'

/**
 * 장면 240×320 을 덮는 누름 칸 판 — 안에 투명한 누름 칸(`shared/ui/PressArea`)을 둔다. 투구 단계마다 판 하나라
 * 단계 판을 통째로 숨기거나(`hidden`) 시험이 판(testid)으로 단계를 가를 수 있다.
 */
export function PressLayer({
  children,
  testId,
  isOnTop = false,
}: {
  readonly children: ReactNode
  readonly testId?: string
  /** 팝업 판보다 위 (소프트키) */
  readonly isOnTop?: boolean
}) {
  return (
    <div
      className={isOnTop ? `${styles.layer} ${styles.layerOnTop}` : styles.layer}
      {...(testId === undefined ? {} : { 'data-testid': testId })}
    >
      {children}
    </div>
  )
}

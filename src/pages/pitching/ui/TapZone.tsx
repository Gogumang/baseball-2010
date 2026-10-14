import type { ReactNode } from 'react'
import type { TapRect } from '@/pages/pitching/lib/pitchInputTapZones'
import * as styles from '@/pages/pitching/ui/TapZone.css'

interface TapZoneProps {
  readonly rect: TapRect
  /** 읽기 보조 이름 — 화면에는 글자가 없다(그림은 장면이 그린다) */
  readonly label: string
  readonly onPress: () => void
  readonly isDisabled?: boolean
  readonly isPressed?: boolean
  readonly testId?: string
}

/** 장면 그림 위 투명한 누름 칸 하나 — 마우스 · 터치 길 (`pitchInputTapZones`) */
export function TapZone({ rect, label, onPress, isDisabled = false, isPressed, testId }: TapZoneProps) {
  return (
    <button
      type="button"
      className={styles.zone}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      aria-label={label}
      {...(isPressed === undefined ? {} : { 'aria-pressed': isPressed })}
      {...(testId === undefined ? {} : { 'data-testid': testId })}
      disabled={isDisabled}
      onClick={(event) => {
        // 장면 판의 다른 누름(확인 칸 따위)으로 번지지 않게
        event.stopPropagation()
        onPress()
      }}
    />
  )
}

/** 장면 240×320 을 덮는 칸 판 */
export function TapLayer({
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

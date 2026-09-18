import type { ReactNode } from 'react'
import * as styles from '@/shared/ui/PixelScreen/PixelScreen.css'

interface SoftKey {
  readonly label: string
  readonly onPress: () => void
  readonly isDisabled?: boolean
}

interface PixelScreenProps {
  readonly title: string
  readonly badge?: string
  readonly children: ReactNode
  readonly leftKey?: SoftKey
  readonly rightKey?: SoftKey
}

/** 피처폰 화면 한 장. 타이틀바 · 본문 · 소프트키의 3단 구성을 강제한다. */
export function PixelScreen({ title, badge, children, leftKey, rightKey }: PixelScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.titleBar}>
        <span>{title}</span>
        {badge !== undefined && <span className={styles.badge}>{badge}</span>}
      </header>

      <div className={styles.body}>{children}</div>

      {(leftKey !== undefined || rightKey !== undefined) && (
        <footer className={styles.softKeys}>
          {leftKey !== undefined && (
            <button
              type="button"
              className={styles.softKey}
              onClick={leftKey.onPress}
              disabled={leftKey.isDisabled === true}
            >
              {leftKey.label}
            </button>
          )}
          {rightKey !== undefined && (
            <button
              type="button"
              className={styles.softKey}
              onClick={rightKey.onPress}
              disabled={rightKey.isDisabled === true}
            >
              {rightKey.label}
            </button>
          )}
        </footer>
      )}
    </div>
  )
}

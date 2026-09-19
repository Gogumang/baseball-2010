import { useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * 피처폰 화면 한 장. 타이틀바 · 본문 · 소프트키의 3단 구성을 강제한다.
 *
 * 본문은 넘치면 스크롤되지만 240px 폭을 지키려고 스크롤바를 숨긴다. 그러면 글이 그냥 잘린 것처럼
 * 보여서, 아래에 더 있을 때만 화살표를 띄운다 (원본에 없는 웹판 표시 — 이 화면들 자체가 웹판 껍데기다).
 */
export function PixelScreen({ title, badge, children, leftKey, rightKey }: PixelScreenProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)

  const checkOverflow = useCallback(() => {
    const body = bodyRef.current
    if (body === null) return
    // 1px 은 소수점 높이 때문에 생기는 오차를 넘긴다
    setHasMoreBelow(body.scrollTop + body.clientHeight < body.scrollHeight - 1)
  }, [])

  useEffect(() => {
    checkOverflow()
    const body = bodyRef.current
    if (body === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(checkOverflow)
    observer.observe(body)
    for (const child of Array.from(body.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [checkOverflow, children])

  return (
    <div className={styles.screen}>
      <header className={styles.titleBar}>
        <span>{title}</span>
        {badge !== undefined && <span className={styles.badge}>{badge}</span>}
      </header>

      <div className={styles.bodyWrapper}>
        <div ref={bodyRef} className={styles.body} onScroll={checkOverflow}>
          {children}
        </div>
        {hasMoreBelow && (
          <span className={styles.moreBelow} aria-label="아래에 더 있습니다">
            ▼
          </span>
        )}
      </div>

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

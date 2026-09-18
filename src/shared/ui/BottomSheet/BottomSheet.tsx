import { useContext, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { SheetHostContext } from '@/shared/ui/BottomSheet/sheetHost'
import * as styles from '@/shared/ui/BottomSheet/BottomSheet.css'

interface BottomSheetProps {
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
}

/**
 * 아래에서 올라오는 시트 (토스 TDS 의 BottomSheet 동작).
 * 바깥을 누르거나 Esc 를 누르면 닫힌다. 화면(SheetHostContext)이 있으면 그 화면 전체를 덮는다.
 */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const host = useContext(SheetHostContext)
  const sheet = (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.grabber} />
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
      </div>
    </>
  )

  return host === null ? sheet : createPortal(sheet, host)
}

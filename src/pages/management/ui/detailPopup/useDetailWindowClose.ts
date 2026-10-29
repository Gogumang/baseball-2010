import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'

/** 공용 창이 가져가는 닫는 키 — OK(−5) · '5' · CLR(−16) */
const CLOSE_KEYS = ['Enter', ' ', '5', 'Escape', 'Backspace']

/**
 * 결과 창 펼침 · 닫기 — 공용 창 0x741a0(높이 0)으로 띄운 창은 펼치는 갱신에 키를 막고, 닫는 키를 잡는 단계에서 가져가 그 자리에서 치운다.
 * 훅 차례(겉 ref · 레이아웃 재기 · 펼침 · 최신 onClose · 키)는 옛 몸통 그대로.
 */
export function useDetailWindowClose(opensAsCommonPopup: boolean, onClose: () => void) {
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 펼침 틀을 건너뛴다
  const overlayRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((overlayRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  const motion = usePopupWindowMotion({
    targetHeight: 0,
    skipsMotion: !opensAsCommonPopup || hasNoLayout,
    isCommonWindow: opensAsCommonPopup,
  })
  // 닫힘 연출이 끝난 뒤에 부를 최신 `onClose` — 커밋 때 적는다(연출 끝은 rAF 라 그 뒤다)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })
  const close = () => {
    if (!opensAsCommonPopup) return onClose()
    motion.close('바로', () => onCloseRef.current())
  }
  useEffect(() => {
    if (!opensAsCommonPopup) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 펼치는 갱신에는 키 콜백을 안 부른다 — 뒤 화면 리스너(시즌 결과의 글 넘김 따위)까지 막는다
      if (!motion.acceptsKeys()) {
        if (!motion.isClosed) event.stopImmediatePropagation()
        return
      }
      // 닫는 키는 창이 가져간다 — 그 밖의 키(시즌 결과 0xf2c8 의 위 · 아래)는 부른 쪽 리스너가 본다
      if (!CLOSE_KEYS.includes(event.key)) return
      event.stopImmediatePropagation()
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })
  return { overlayRef, motion, close }
}

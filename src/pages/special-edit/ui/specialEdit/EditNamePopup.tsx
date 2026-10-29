import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import * as styles from '@/pages/special-edit/ui/SpecialEditScreen.css'
import { POPUP_HEIGHT } from '@/pages/special-edit/ui/specialEdit/editNamePopupLayout'
import { EditNameFields } from '@/pages/special-edit/ui/specialEdit/EditNameFields'

interface EditNamePopupProps {
  readonly onConfirm: (name: string) => void
  readonly onCancel: () => void
}

/** 이름 창 확정 — OK(Enter) · 지우기/취소 — CLR(Escape) */
const EDIT_NAME_CONFIRM_OFFER: TouchKeyOffer = { key: 'Enter', label: '확정' }
const EDIT_NAME_CLEAR_OFFER: TouchKeyOffer = { key: 'Escape', label: '지우기·취소' }

/**
 * **이름 입력 창** — 팝업 0x741a1(popup, 0x6e, 그리기·확인 0x32b7d, 키 0x32b5d) · 입력기 켜기 0x54145(skin, 3 한글, 8 바이트, 1, 1).
 * 켜기가 버퍼를 비우므로(0x670d5) 늘 빈 칸으로 열린다.
 * ```
 * 32b5d  키 → 입력기 0x54279 (글자 · CLR 은 글자가 있으면 한 글자 지우기 0x66fd5)
 * 32cf6  CLR(−16) && strlen(버퍼) == 0 → 결과 −1 (취소)
 * 32d14  OK(−5)  && strlen(버퍼) != 0 → 결과 0  (확인) — 빈 이름은 확인이 안 된다
 * ```
 * 원본 입력기([0x1552d00], 모드 A·a·1·가 를 좌우로 바꾸고 한글 조합은 폰 플랫폼이 한다 — R11 2절)는
 * 웹 입력 칸으로 대신하고 CP949 8 바이트 검사만 원본대로 둔다. Escape = CLR, Enter = OK.
 *
 * **CLR 이 마지막 한 글자를 지우면 같은 그림에 곧장 취소된다** (U-91 닫음, 직접 뜸): 메뉴 틀 0x32fa0 은 한 그림에
 *    0xbca05(키 → [장면+0x40], 그림마다 새로 적는다) → 갱신 0x32634(0x754f9 → 종류 8 이면 키 콜백 0x32b5d → 0x54279: CLR 이고
 *    버퍼가 있으면 0x66fd5 한 글자 지우기) → 그리기 0x32dd8(끝의 0x746cd → 그리기 콜백 0x32b7c) 차례다. 0x32b7c 는 키를 인자가
 *    아니라 [장면+0x40] 으로 읽으므로(32cf6) 같은 그림에서 CLR 과 방금 빈 버퍼를 보고 0x74361(창, −1) 로 닫는다.
 */
export function EditNamePopup({ onConfirm, onCancel }: EditNamePopupProps) {
  const [name, setName] = useState('')
  const nameRef = useRef(name)
  const handlersRef = useRef({ onConfirm, onCancel })
  useLayoutEffect(() => {
    nameRef.current = name
    handlersRef.current = { onConfirm, onCancel }
  })
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 펼침을 건너뛴다
  const bandRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((bandRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  /**
   * 0x741a0 펼침 6 → 12 → 24 → 48 → 96 → 110 — 그동안 키 콜백 0x32b5d 도, 확인 · 취소를 보는 그리기 콜백 0x32b7d 도 안 불린다
   * (0x75556 · 0x7479c). 확인 · 취소는 0x74361(창, 0 / −1) 이 [창+9] = 0 으로 그 자리에서 치운다(닫힘 애니 없음 — `popupWindow`).
   */
  const motion = usePopupWindowMotion({ targetHeight: POPUP_HEIGHT, skipsMotion: hasNoLayout })
  const motionRef = useRef(motion)
  useLayoutEffect(() => {
    motionRef.current = motion
  })

  useEffect(() => {
    // 창이 떠 있는 동안 키는 창 것이다 — 뒤의 엔트리 화면(window 리스너)이 숫자·* 키를 가로채지 않게 잡는 단계에서 멈춘다
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (!motionRef.current.acceptsKeys()) {
        event.preventDefault()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (nameRef.current.length > 0) motionRef.current.close('바로', () => handlersRef.current.onConfirm(nameRef.current))
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (nameRef.current.length === 0) return void motionRef.current.close('바로', () => handlersRef.current.onCancel())
        // 갱신의 키 콜백 0x32b5d 가 한 글자를 지운 뒤 같은 그림의 0x32b7c 가 [장면+0x40] = CLR 과 빈 버퍼를 보면 곧장 취소한다 (U-91)
        const next = [...nameRef.current].slice(0, -1).join('')
        nameRef.current = next
        setName(next)
        if (next.length === 0) motionRef.current.close('바로', () => handlersRef.current.onCancel())
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const isOpening = motion.openingHeight !== null
  // 터치 기기 — 창 그림에 소프트키 글자가 없어 OK(확정) · CLR(지우기, 비면 취소)을 상황 버튼으로 낸다(r186 — 늘 있던 확인 · 뒤로 버튼을
  // 걷었다). 버튼은 누르는 동안 초점을 안 빼앗아 키 사건이 입력칸으로 가고, 위 잡기 단계 듣는 곳이 받는다
  useTouchKeyOffer(isOpening ? null : EDIT_NAME_CONFIRM_OFFER)
  useTouchKeyOffer(isOpening ? null : EDIT_NAME_CLEAR_OFFER)
  // 펼치는 동안 칸은 visibility: hidden 이라 autoFocus 가 초점을 못 잡는다 — 다 펼쳐진 그 그림에 초점을 준다
  // (안 그러면 키보드 · 화면 자판 글자가 칸에 안 들어간다)
  const fieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!isOpening) fieldRef.current?.focus()
  }, [isOpening])

  if (motion.isClosed) return null
  const bandHeight = motion.openingHeight ?? POPUP_HEIGHT

  return (
    <div className={styles.dim} role="dialog" aria-label="이름 입력">
      {/* 판 0x744c4 — y = (H − 그리는 높이) / 2 */}
      <div className={styles.band} ref={bandRef} style={{ top: (320 - bandHeight) >> 1, height: bandHeight }} />
      <EditNameFields name={name} isOpening={isOpening} fieldRef={fieldRef} onName={setName} />
    </div>
  )
}

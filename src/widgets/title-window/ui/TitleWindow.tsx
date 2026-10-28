import { useEffect, useRef } from 'react'
import { MarkupText } from '@/shared/ui'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import { TITLE_WINDOW, titleWindowLinesOf } from '@/widgets/title-window/lib/titleWindow'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')

/**
 * **칭호 팝업** 0x1274c — 그리기 0x1afe8 · 키 0x1b1e4 (`TITLE_WINDOW` 주석).
 * 판 · 열림(높이 6 에서 ×2)은 공용 0x741a0 창과 같다. 펼치는 동안은 키를 안 받는다 — 키 갱신 0x754f8 은 [창+0x214](펼침) 동안
 * 높이만 두 배로 하고 1 을 돌려준다(0x75556~0x75588). 키 콜백은 다 펼친 종류 8 창에서만 부른다(0x756c2~0x756e0).
 * **닫힘 애니가 없다**: 키 0x1b1e4 는 [창+0x215](닫힘 · 폭 ÷2)를 켜지 않고 0x742a9 를 바로 불러 [창+9] = 0 으로 그 자리에서
 * 치운다(0x1b1f0~0x1b1f8 → 0x742a8~0x742b0). 0x75440(대기 칸 다시 띄우기)도 안 부른다.
 * 그래서 닫히는 동안 글을 자르는지는 물을 것이 없다 — 키를 받은 그 그림부터 창이 없다.
 * 뒤 어둡게: 나리 장면 0xf684 가 [창+0x24f] = 0 · [창+0x24c] = 1 이라 떠 있는 그리기마다 6/16 (`POPUP_DIM_OPACITY`).
 * 화면 전체가 투명한 누름 칸 "확인" 이다 — 마우스 · 터치로 OK 를 누르는 길.
 * 칭호가 여럿이면 부르는 쪽이 `key={칭호}` 로 새 창을 세운다 — 원본은 키 뒤 다음 갱신 0x1aec4 가 다시 판정해 새로 띄운다.
 */
export function TitleWindow({
  title,
  onKey,
  onClose,
}: {
  readonly title: string
  /** 키 0x1b1e4 를 받은 그 자리 — 칭호 비트 · 장착 · 저장 */
  readonly onKey?: () => void
  /** 창이 치워졌다 — 키와 같은 자리(닫힘 애니 없음) */
  readonly onClose?: () => void
}) {
  const motion = usePopupWindowMotion({ targetHeight: TITLE_WINDOW.height })
  const onKeyRef = useRef(onKey)
  onKeyRef.current = onKey
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const close = () =>
    motion.close('바로', () => {
      onKeyRef.current?.()
      onCloseRef.current?.()
    })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 팝업이 떠 있는 동안은 팝업 관리자가 키를 다 먹는다
      event.stopImmediatePropagation()
      // 0x1b1e4 — OK(−5 · Enter · Space) · '5' 만. CLR 은 안 받는다
      if (!['Enter', ' ', '5'].includes(event.key)) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  const lines = titleWindowLinesOf(title)
  const boxTop = (SCREEN_HEIGHT - TITLE_WINDOW.height) / 2
  const textStyle = { position: 'absolute', left: TITLE_WINDOW.textLeft, marginLeft: 0, width: TITLE_WINDOW.textWidth } as const

  // 키를 받은 그 자리에서 치운다 — 부르는 쪽이 아직 내리지 않았어도 다시 그리지 않는다
  if (motion.isClosed) return null
  const isOpening = motion.openingHeight !== null

  return (
    <div
      className={boxStyles.dim}
      role="dialog"
      aria-label="칭호"
      data-testid="칭호-창"
      style={{ background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }}
    >
      <div
        className={boxStyles.box}
        style={{
          height: motion.openingHeight ?? TITLE_WINDOW.height,
          padding: 0,
          left: 0,
          width: SCREEN_WIDTH,
          overflow: 'hidden',
        }}
      >
        {/* 펼치는 동안에는 안을 안 그린다 (0x7479c). 0x1afe8 은 판이 아니라 화면 기준 좌표로 그린다 */}
        <div style={{ visibility: isOpening ? 'hidden' : undefined, position: 'absolute', top: 0, left: 0, width: SCREEN_WIDTH }}>
          <img
            src={`${IMG_TEXT_FRAMES}/${String(TITLE_WINDOW.headerFrame).padStart(3, '0')}.png`}
            alt=""
            data-frame={TITLE_WINDOW.headerFrame}
            style={{
              position: 'absolute',
              left: Math.trunc((SCREEN_WIDTH - TITLE_WINDOW.headerWidth) / 2),
              top: TITLE_WINDOW.headerTop - boxTop,
              imageRendering: 'pixelated',
            }}
          />
          {lines !== null && (
            <>
              <div className={boxStyles.text} data-part="조건" style={{ ...textStyle, top: TITLE_WINDOW.conditionTop - boxTop }}>
                <MarkupText raw={lines.conditionRaw} />
              </div>
              <div className={boxStyles.text} data-part="이름" style={{ ...textStyle, top: TITLE_WINDOW.nameTop - boxTop }}>
                <MarkupText raw={lines.nameRaw} />
              </div>
            </>
          )}
        </div>
      </div>
      {/* 투명한 누름 칸 — OK */}
      <button
        type="button"
        aria-label="확인"
        onClick={close}
        style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
      />
    </div>
  )
}

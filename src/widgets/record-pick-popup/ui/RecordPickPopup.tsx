import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import {
  RECORD_PICK_CELL_SIZE, RECORD_PICK_CELLS, RECORD_PICK_DIM_LABEL_COLOR, RECORD_PICK_LABEL_GAP, RECORD_PICK_POPUP_HEIGHT,
  RECORD_PICK_POPUP_START_HEIGHT, RECORD_PICK_TITLE_ID, nextRecordPickPopupHeightOf, recordPickIconOffsetOf, recordPickLabelXOf,
  recordPickPopupTopOf,
} from '@/widgets/record-pick-popup/lib/recordPickPopup'

const IMG_TEXT = './sprites/img_text/frames'
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`
const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

/** `ui/mode_icon.pzx` 그림 · 33×33. mpl 첫 벌(주황)로 칠한 사본은 tools/generate_management_sprites.py 가 만든다 */
const MODE_ICON_SIZE = 33
const modeIconOf = (frame: number) => `./sprites/mode_icon/${String(frame).padStart(3, '0')}.png`
const selectedModeIconOf = (frame: number) => `./sprites/management/icon_selected_${frame}.png`

const pixel = { position: 'absolute', pointerEvents: 'none' } as const

export interface RecordPickCell {
  /** 칸 이름 (접근성) */
  readonly label: string
  /** 칸 글 img_text 프레임 */
  readonly labelFrame: number
}

export interface RecordPickPopupProps {
  /** 창 이름 (접근성) */
  readonly ariaLabel: string
  /** 칸 그림의 data-testid 머리 — `${머리}-칸-${0 | 1}` */
  readonly testIdPrefix: string
  /** 왼쪽 칸 0 (프레임 6) · 오른쪽 칸 1 (프레임 10) */
  readonly cells: readonly [RecordPickCell, RecordPickCell]
  /** 고른 칸 */
  readonly selected: 0 | 1
  /** 좌·우(−3 · −4) · '4' · '6' */
  readonly onToggle: () => void
  /** 확인(−5 · '5') */
  readonly onConfirm: () => void
  /** 취소 */
  readonly onCancel: () => void
}

/**
 * **두 칸 고르기 팝업 0x80** — 시즌 기록순위 0xf334 · 나리 기록실 0x19448 공용 그림(`recordPickPopup` 머리말).
 * 키는 잡는 단계에서 다 가져간다(뒤 메뉴가 같은 키를 받지 않게).
 * 판은 공용 창 [0x140005c] 의 띠 판 0x744c4(폭 240 · 높이 0x80, 펼침 6 → 128)이고, 뒤는 그리는 틀마다 검정 단계 5 로 덮는다 —
 * 나리 0xf684 · 시즌 0x3b14 장면이 [창+0x24f] = 0 · [창+0x24c] = 1 을 세운다(`popupDim`).
 * ⚠️ 미확인: 닫힐 때 [+0x215] 가로 줄임을 이 팝업 키 0xf5d4 · 0x196ec 가 타는지는 안 떠서 웹은 곧바로 닫는다.
 */
export function RecordPickPopup({ ariaLabel, testIdPrefix, cells, selected, onToggle, onConfirm, onCancel }: RecordPickPopupProps) {
  const latest = useRef({ onToggle, onConfirm, onCancel })
  latest.current = { onToggle, onConfirm, onCancel }
  /** 그리는 높이 [창+0x212] — 다 펼쳤으면 목표 0x80 */
  const [height, setHeight] = useState(RECORD_PICK_POPUP_START_HEIGHT)
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 펼침을 건너뛰고 다 펼친 판에서 시작한다
  const boxRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if ((boxRef.current?.offsetHeight ?? 0) <= 0) setHeight(RECORD_PICK_POPUP_HEIGHT)
  }, [])
  const isOpening = height < RECORD_PICK_POPUP_HEIGHT
  const isOpeningRef = useRef(isOpening)
  isOpeningRef.current = isOpening
  useEffect(() => {
    if (!isOpening) return
    const timer = window.setTimeout(
      () => setHeight((current) => nextRecordPickPopupHeightOf(current) ?? RECORD_PICK_POPUP_HEIGHT),
      millisecondsPerFrame(),
    )
    return () => window.clearTimeout(timer)
  }, [isOpening, height])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      // 펼치는 동안은 창이 키를 잡기만 하고 보지 않는다 (0x754f8 → 0x75556 갈래)
      if (isOpeningRef.current) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (isCancelKey(event.key)) current.onCancel()
      else if (['ArrowLeft', 'ArrowRight', '4', '6'].includes(event.key)) current.onToggle()
      else if (event.key === 'Enter' || event.key === '5') current.onConfirm()
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const labelOrigins = useFrameOrigins(IMG_TEXT)
  const icon = recordPickIconOffsetOf(MODE_ICON_SIZE, MODE_ICON_SIZE)
  const labelTop = RECORD_PICK_CELL_SIZE + RECORD_PICK_LABEL_GAP
  return (
    <div role="dialog" aria-label={ariaLabel}>
      {/* 0x746cc — 뒤 어둡게(단계 5) 뒤 판 0x744c4 (0, (H − 높이) >> 1, 240, 높이) */}
      <div style={{ ...pixel, left: 0, top: 0, width: 240, height: 320, background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }} />
      <div className={boxStyles.box} data-testid={`${testIdPrefix}-판`} ref={boxRef}
        style={{ top: recordPickPopupTopOf(height), transform: 'none', height, padding: 0 }} />
      {!isOpening && (<>
      {/* "!C보고 싶은 기록을!N선택해주세요" — 두 줄 가운데 */}
      <div className={styles.title} style={{ left: 120 - 0x54, top: 160 - 0x28, width: 0x54 * 2, whiteSpace: 'normal' }}>
        <MarkupText raw={ORIGINAL_MODE_TEXT[RECORD_PICK_TITLE_ID] ?? ''} />
      </div>
      {cells.map((cell, index) => {
        const geometry = RECORD_PICK_CELLS[index]
        const isOn = index === selected
        const labelSrc = frameSrc(cell.labelFrame)
        const labelSize = labelOrigins?.[String(cell.labelFrame).padStart(3, '0')]
        const labelX = labelSize === undefined ? 0 : recordPickLabelXOf(labelSize.width)
        return (
          <button key={cell.label} type="button" aria-pressed={isOn} aria-label={cell.label}
            className={windowStyles.layer}
            style={{
              left: geometry.x, top: geometry.y, width: RECORD_PICK_CELL_SIZE, height: labelTop + (labelSize?.height ?? 0),
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', pointerEvents: 'auto', overflow: 'visible',
            }}
            onClick={() => (isOn ? onConfirm() : onToggle())}>
            <img alt="" data-testid={`${testIdPrefix}-칸-${index}`}
              src={isOn ? selectedModeIconOf(geometry.iconFrame) : modeIconOf(geometry.iconFrame)}
              style={{ ...pixel, left: icon.x, top: icon.y }} />
            {isOn || labelSize === undefined
              ? <img alt="" src={labelSrc} style={{ ...pixel, left: labelX, top: labelTop }} />
              : (
                // 효과 0xb 단색 — 그림을 마스크로 쓰고 회색을 칠한다
                <span style={{
                  ...pixel, left: labelX, top: labelTop, width: labelSize.width, height: labelSize.height,
                  background: RECORD_PICK_DIM_LABEL_COLOR, maskImage: `url(${labelSrc})`, WebkitMaskImage: `url(${labelSrc})`,
                  maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                }} />
              )}
          </button>
        )
      })}
      </>)}
    </div>
  )
}

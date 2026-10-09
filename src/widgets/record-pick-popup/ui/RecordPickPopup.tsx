import { useEffect, useRef } from 'react'
import { MarkupText } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import {
  RECORD_PICK_CELL_SIZE, RECORD_PICK_CELLS, RECORD_PICK_DIM_LABEL_COLOR, RECORD_PICK_LABEL_GAP, RECORD_PICK_TITLE_ID,
  recordPickIconOffsetOf, recordPickLabelXOf,
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
 */
export function RecordPickPopup({ ariaLabel, testIdPrefix, cells, selected, onToggle, onConfirm, onCancel }: RecordPickPopupProps) {
  const latest = useRef({ onToggle, onConfirm, onCancel })
  latest.current = { onToggle, onConfirm, onCancel }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
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
      <div className={windowStyles.window} style={{ left: 120 - 0x54 - 6, top: 160 - 0x28 - 8, width: 0x54 * 2 + 12, height: 100 }} />
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
    </div>
  )
}

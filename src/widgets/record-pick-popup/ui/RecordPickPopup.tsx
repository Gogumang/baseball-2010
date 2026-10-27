import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FOOTER_BACK_PRESS_RECT, MarkupText, PressArea } from '@/shared/ui'
import { CANCEL_KEY_OFFER, tapKey, useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { popupBoxStyleOf, usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import type { PopupCloseKind } from '@/shared/lib/commonWindow/popupWindow'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import {
  RECORD_PICK_CELL_SIZE, RECORD_PICK_CELLS, RECORD_PICK_DIM_LABEL_COLOR, RECORD_PICK_LABEL_GAP, RECORD_PICK_POPUP_HEIGHT,
  RECORD_PICK_TITLE_ID, RECORD_PICK_TITLE_X, RECORD_PICK_TITLE_Y, recordPickIconOffsetOf,
  recordPickLabelXOf, recordPickPopupTopOf,
} from '@/widgets/record-pick-popup/lib/recordPickPopup'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { measuredTitleCenterXOf } from '@/shared/lib/font'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`
const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

/** `ui/mode_icon.pzx` 그림 · 33×33. mpl 첫 벌(주황)로 칠한 사본은 tools/generate_management_sprites.py 가 만든다 */
const MODE_ICON_SIZE = 33
const modeIconOf = (frame: number) => assetUrl(`./sprites/mode_icon/${String(frame).padStart(3, '0')}.png`)
const selectedModeIconOf = (frame: number) => assetUrl(`./sprites/management/icon_selected_${frame}.png`)

const pixel = { position: 'absolute', pointerEvents: 'none' } as const

const TITLE_RAW = ORIGINAL_MODE_TEXT[RECORD_PICK_TITLE_ID] ?? ''
/** 제목 가운데 x — 0x1949c (W/2 − 0x54) + (0x9c52c 폭 >> 1) */
const TITLE_CENTER_X = measuredTitleCenterXOf(RECORD_PICK_TITLE_X, TITLE_RAW)

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
  /**
   * 확인(−5 · '5'). `'바로'` 면 창이 치워진 그 자리, `'줄임'` 이면 키를 받은 **다음 갱신** — 나리 0x196ec 는 확인한 그 자리에서
   * 0xbcb49(장면+0x18, 124) 를 걸어(0x19736~0x19750) 다음 틀 머리(0x1cdec 의 1ce00)에 124 가 들어서고, 창은 그 위에서 줄어든다
   */
  readonly onConfirm: () => void
  /** 취소 — 창이 치워진 때 (나리 CLR 0x196f4 는 [창+0x215] 만 쓰고 상태는 그대로다) */
  readonly onCancel: () => void
  /** 확인 뒤 창이 다 치워졌다 (`'줄임'` 에서 아래 화면이 이미 갈린 뒤) */
  readonly onClosed?: () => void
  /**
   * 키 콜백이 창을 닫는 길 (`popupWindow` 머리말) — 시즌 0xf5d4 는 0x742a9 를 바로 불러 `'바로'`,
   * 나리 0x196ec 는 [창+0x215] = 1 이라 `'줄임'`(폭 240 → 120 → 닫힘).
   */
  readonly closeKind: PopupCloseKind
}

/**
 * **두 칸 고르기 팝업 0x80** — 시즌 기록순위 0xf334 · 나리 기록실 0x19448 공용 그림(`recordPickPopup` 머리말).
 * 키는 잡는 단계에서 다 가져간다(뒤 메뉴가 같은 키를 받지 않게).
 * 판은 공용 창 [0x140005c] 의 띠 판 0x744c4(폭 240 · 높이 0x80, 펼침 6 → 128)이고, 뒤는 그리는 틀마다 검정 단계 5 로 덮는다 —
 * 나리 0xf684 · 시즌 0x3b14 장면이 [창+0x24f] = 0 · [창+0x24c] = 1 을 세운다(`popupDim`).
 * 닫힘은 키 콜백마다 다르다 (2026-10-14 직접 뜸, `closeKind`): 시즌 0xf5d4 는 CLR(0xf5e2) · 확인(0xf614) 모두 0x742a9 를 바로 불러
 * 그 자리에서 치우고, 나리 0x196ec 는 CLR(0x196f4~0x196fc) · 확인(0x19758) 모두 [창+0x215] = 1 — 다음 갱신부터 판 폭 240 → 120 → 닫힘.
 * 줄이는 동안에도 그리기 0x19448 은 돌아 제목 · 칸은 그대로 그려지고(판만 가운데로 준다, 0x744c4) 키는 안 받는다.
 * 나리 확인은 원본 차례대로 키를 받은 다음 갱신에 `onConfirm`(124 가 들어선다)이고 창은 그 위에서 줄어든 뒤 `onClosed`.
 */
export function RecordPickPopup({
  ariaLabel, testIdPrefix, cells, selected, closeKind, onToggle, onConfirm, onCancel, onClosed,
}: RecordPickPopupProps) {
  const latest = useRef({ onToggle, onConfirm, onCancel, onClosed })
  latest.current = { onToggle, onConfirm, onCancel, onClosed }
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 펼침 · 줄임을 건너뛴다
  const boxRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((boxRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  const motion = usePopupWindowMotion({ targetHeight: RECORD_PICK_POPUP_HEIGHT, skipsMotion: hasNoLayout })
  const closeKindRef = useRef(closeKind)
  closeKindRef.current = closeKind
  /** 확인 — `'바로'` 는 치운 자리에서, `'줄임'` 은 다음 갱신에 `onConfirm` · 다 닫히면 `onClosed` */
  const confirm = () => {
    if (closeKindRef.current === '바로') return motion.close('바로', () => latest.current.onConfirm())
    return motion.close('줄임', () => latest.current.onClosed?.(), () => latest.current.onConfirm())
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      const isToggle = ['ArrowLeft', 'ArrowRight', '4', '6'].includes(event.key)
      const isConfirm = event.key === 'Enter' || event.key === '5'
      const isCancel = isCancelKey(event.key)
      // 펼치는 동안 · 줄이는 동안은 창이 키를 잡기만 하고 키 콜백을 부르지 않는다 (0x754f8 → 0x75556 · 0x7558a 갈래)
      if (!motion.acceptsKeys()) {
        if (motion.isClosed) return
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (isCancel) motion.close(closeKindRef.current, current.onCancel)
      else if (isToggle) current.onToggle()
      else if (isConfirm) confirm()
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [motion])

  const labelOrigins = useFrameOrigins(IMG_TEXT)
  // 창 그림 0x19448 은 제목 · 칸 둘만 그려 CLR 글자 자리가 없다(아래 바닥띠 표시는 뒤 어둡게에 덮인다) — 키를 받는 동안 '취소' 상황
  // 버튼을 낸다(r194). Escape 키 사건이라 위 듣는 곳과 같은 길이다
  useTouchKeyOffer(!motion.isClosed && motion.openingHeight === null && motion.closingWidth === null ? CANCEL_KEY_OFFER : null)
  if (motion.isClosed) return null
  /** 판 0x744c4 — 펼치는 동안 높이 [창+0x212], 줄이는 동안 폭 [창+0x210] 을 가로 가운데로 */
  const box = popupBoxStyleOf(motion, RECORD_PICK_POPUP_HEIGHT)
  const icon = recordPickIconOffsetOf(MODE_ICON_SIZE, MODE_ICON_SIZE)
  const labelTop = RECORD_PICK_CELL_SIZE + RECORD_PICK_LABEL_GAP
  return (
    <div role="dialog" aria-label={ariaLabel}>
      {/* 0x746cc — 뒤 어둡게(단계 5) 뒤 판 0x744c4 (0, (H − 높이) >> 1, 240, 높이) */}
      <div style={{ ...pixel, left: 0, top: 0, width: 240, height: 320, background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }} />
      <div className={boxStyles.box} data-testid={`${testIdPrefix}-판`} ref={boxRef}
        style={{ ...box, top: recordPickPopupTopOf(box.height), bottom: 'auto', padding: 0 }} />
      {motion.openingHeight === null && (<>
      {/* "!C보고 싶은 기록을!N선택해주세요" — 0xba269 폭 −1: 날 글 전체를 잰 폭(서식 넉 자 포함, 165)의 반을 두 줄 모두의 가운데로
          (`measuredTitleCenterXOf`) — 가운데 x = 0x24 + 82 = 118 이라 화면 가운데보다 2px 왼쪽이다 */}
      <div className={styles.title} style={{ left: TITLE_CENTER_X - 120, top: RECORD_PICK_TITLE_Y, width: 240, whiteSpace: 'nowrap' }}>
        <MarkupText raw={TITLE_RAW} />
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
            onClick={() => {
              if (!motion.acceptsKeys()) return
              if (isOn) confirm()
              else onToggle()
            }}>
            <img alt="" data-testid={`${testIdPrefix}-칸-${index}`}
              src={isOn ? selectedModeIconOf(geometry.iconFrame) : modeIconOf(geometry.iconFrame)}
              style={{ ...pixel, left: icon.x, top: icon.y }} />
            {isOn || labelSize === undefined
              ? <img alt="" src={labelSrc} style={{ ...pixel, left: labelX, top: labelTop }} />
              : (
                // 효과 0xb 단색 — 그림을 마스크로 쓰고 회색을 칠한다
                <span style={{
                  ...pixel, left: labelX, top: labelTop, width: labelSize.width, height: labelSize.height,
                  background: solidColorCss(RECORD_PICK_DIM_LABEL_COLOR), maskImage: spriteMaskImage(labelSrc), WebkitMaskImage: spriteMaskImage(labelSrc),
                  maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                }} />
              )}
          </button>
        )
      })}
      {/* CLR — 창 아래 106 화면이 그대로 그리는 바닥띠 되돌아가기 표시 자리(웹 전용 누름 칸, r186). 키와 같은 길(위 듣는 곳) */}
      <div style={{ pointerEvents: 'auto' }}>
        <PressArea label="취소" rect={FOOTER_BACK_PRESS_RECT} onPress={() => tapKey('Escape')} />
      </div>
      </>)}
    </div>
  )
}

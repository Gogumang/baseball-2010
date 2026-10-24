import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FOOTER_BACK_PRESS_RECT, MarkupText, PressArea, ScreenOverlay } from '@/shared/ui'
import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { popupBoxStyleOf, usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import {
  RECORD_PICK_CELL_SIZE, RECORD_PICK_LABEL_GAP, recordPickIconOffsetOf, recordPickLabelXOf,
  recordPickPopupTopOf,
} from '@/widgets/record-pick-popup/lib/recordPickPopup'
import { PITCH_WINDOW_CHOICES } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'
import { measuredTitleCenterXOf } from '@/shared/lib/font'
import { spriteMaskImage } from '@/shared/lib/sprite/spriteMask'

const IMG_TEXT = './sprites/img_text/frames'
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

/** `ui/mode_icon.pzx` 그림 · 33×33 ([장면+0xe0] — 나리 기록실 0x19448 과 같은 그림 객체). 고른 칸은 mpl 첫 벌(주황) 사본 */
const MODE_ICON_SIZE = 33
const modeIconOf = (frame: number) => `./sprites/mode_icon/${String(frame).padStart(3, '0')}.png`
const selectedModeIconOf = (frame: number) => `./sprites/management/icon_selected_${frame}.png`

const pixel = { position: 'absolute', pointerEvents: 'none' } as const

/** 0x12dd6 · 0x130ac `movs r1, #0x78` — 0x741a1 의 목표 높이 */
export const PITCH_CHOICE_POPUP_HEIGHT = 0x78
/** 제목 StrMODE[59] "!C원하는 항목을 선택해주세요" — 0x19128 `movs r1, #0x3b` */
export const PITCH_CHOICE_TITLE_ID = 0x3b
/** 제목 0xba269(글, W/2 − 0x46, H/2 − 0x1e, …) — 0x1914c `subs r1, #0x46` · 0x19150 `subs r2, #0x1e` */
const TITLE_BACK = 0x46
const TITLE_RISE = 0x1e
const TITLE_RAW = ORIGINAL_MODE_TEXT[PITCH_CHOICE_TITLE_ID] ?? ''
/** 제목 가운데 x — (W/2 − 0x46) + (0x9c52c 폭 >> 1) */
const TITLE_CENTER_X = measuredTitleCenterXOf(120 - TITLE_BACK, TITLE_RAW)
/**
 * 칸 둘 — 0x19162~0x19170 칸 0 (W/2 − 0x38, H/2, 0x20, 0x20) 프레임 0x13 · 0x19272~0x19284 칸 1 (W/2 + 0x18, H/2, 0x20, 0x20)
 * 프레임 0x12 를 0x858fd([장면+0xe0], 칸, 프레임, 팔레트) 로 (0x1919c · 0x192a4). 칸 글은 img_text +0x4d0(308 "마구") ·
 * +0x4d4(309 "변화구") 를 (칸 x + (0x20 − 글 폭)/2, 칸 y + 0x20 + 4) 에.
 */
export const PITCH_CHOICE_CELLS: readonly { readonly x: number; readonly y: number; readonly iconFrame: number; readonly labelFrame: number }[] = [
  { x: 120 - 0x38, y: 160, iconFrame: 0x13, labelFrame: 308 },
  { x: 120 + 0x18, y: 160, iconFrame: 0x12, labelFrame: 309 },
]
/** 아닌 칸 글 — 효과 0xb 단색 0x1400748(0x7f, 0x7f, 0x77) (0x19248~0x19264 · 0x19342~0x1935e) */
export const PITCH_CHOICE_DIM_LABEL_COLOR = '#7f7f77'

const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

interface PitchChoicePopupProps {
  /** [장면+0x166] — 0 이면 칸 0(마구), 아니면 칸 1(구질) */
  readonly selected: number
  readonly onMove: (index: number) => void
  /** 확인 키가 고른 칸 — 원본은 **키를 받은 그 갱신**에 탭 · 상태(108 / 123)를 바꾼다 */
  readonly onChoose: (index: number) => void
  /** 창이 다 닫혔다 (확인 · 취소 모두) */
  readonly onClosed: () => void
}

/**
 * **투수 구질 두 갈래 팝업 0x78** — 106 칸 3 · 107 칸 4 가 띄우는 `0x741a1([0x140005c], 0x78, 그리기 0x1d5f5 → 0x190f8,
 * 키 0x1d601 → 0x19398, 장면)` (0x12dd4~0x12dee · 0x130a6~0x130be — 띄운 뒤 [장면+0x166] = 0).
 * 그림 0x190f8 은 나리 기록실 0x19448(`RecordPickPopup`)과 같은 꼴이고 다른 것은 제목 · 칸 그림 · 칸 글 · 아닌 칸 글 색뿐이다:
 * ```
 *                0x190f8(구질)                         0x19448(기록실)
 * 제목           StrMODE[59] (W/2 − 0x46, H/2 − 0x1e)   StrMODE[74] (W/2 − 0x54, H/2 − 0x28)
 * 칸 그림        0x13 · 0x12                            6 · 10
 * 칸 글          308 "마구" · 309 "변화구"               106 · 360
 * 아닌 칸 글      0x1400748(0x7f, 0x7f, 0x77)            (0xb2, 0xb2, 0xb2)
 * 고른 칸         [장면+0x166] == 0 → 칸 0 (두 함수 같다 — 팔레트 0 · 아닌 칸 −1)
 * ```
 * 키 0x19398: ← → · '4' · '6' 은 +0x166 뒤집기(193ae~193be), OK(−5) · '5' 는 [[장면+0xe0]+0x188] = +0x166 ? 2 : 1 을 적고
 * 그 자리에서 0xbcb49(장면+0x18, 상태 107 이면 0x6c(108) 아니면 0x7b(123))로 상태를 바꾼 뒤(193ca~19426) [창+0x215] = 1,
 * CLR(−16)은 [창+0x215] = 1 만(1942a~19434). 그래서 확인하면 **새 상태(108 · 123)가 그 갱신에 서고 창은 그 위에서 줄어든다** —
 * 폭 240 → 120 → 닫힘(`popupWindow` '줄임'). 줄이는 동안에도 그리기 0x190f8 은 돌아 칸이 그대로 그려진다.
 * 뒤는 그리는 틀마다 검정 단계 5 로 덮는다(나리 장면 0xf684 가 [창+0x24f] = 0 · [창+0x24c] = 1, `popupDim`).
 * 창이 떠 있는 동안(펼침 · 줄임 포함) 장면 키는 0x754f9 가 막는다 — 웹은 창이 잡는 단계에서 키를 멈춘다.
 */
export function PitchChoicePopup({ selected, onMove, onChoose, onClosed }: PitchChoicePopupProps) {
  const latest = useRef({ selected, onMove, onChoose, onClosed })
  latest.current = { selected, onMove, onChoose, onClosed }
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 펼침 · 줄임을 건너뛴다
  const boxRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((boxRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  const motion = usePopupWindowMotion({ targetHeight: PITCH_CHOICE_POPUP_HEIGHT, skipsMotion: hasNoLayout })

  /** 확인 — 상태를 먼저 바꾸고(0xbcb49) 창을 줄인다([창+0x215]) */
  const confirm = (index: number) => {
    if (!motion.acceptsKeys()) return
    latest.current.onChoose(index)
    motion.close('줄임', () => latest.current.onClosed())
  }
  const confirmRef = useRef(confirm)
  confirmRef.current = confirm

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      // 펼치는 동안 · 줄이는 동안은 창이 키를 잡기만 하고 키 콜백을 부르지 않는다 (0x754f8 → 0x75556 · 0x7558a 갈래)
      if (!motion.acceptsKeys()) {
        if (motion.isClosed) return
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (['ArrowLeft', 'ArrowRight', '4', '6'].includes(event.key)) current.onMove(current.selected === 0 ? 1 : 0)
      else if (event.key === 'Enter' || event.key === ' ' || event.key === '5') confirmRef.current(current.selected === 0 ? 0 : 1)
      else if (isCancelKey(event.key)) motion.close('줄임', () => latest.current.onClosed())
      else return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [motion])

  const labelOrigins = useFrameOrigins(IMG_TEXT)
  if (motion.isClosed) return null
  /** 판 0x744c4 — 펼치는 동안 높이 [창+0x212], 줄이는 동안 폭 [창+0x210] 을 가로 가운데로 */
  const box = popupBoxStyleOf(motion, PITCH_CHOICE_POPUP_HEIGHT)
  const icon = recordPickIconOffsetOf(MODE_ICON_SIZE, MODE_ICON_SIZE)
  const labelTop = RECORD_PICK_CELL_SIZE + RECORD_PICK_LABEL_GAP
  return (
    <ScreenOverlay>
      {/* 240×320 화면 버퍼 자리 — 상태가 바뀌어 뒤 화면(108 · 123)이 갈려도 창은 그대로 줄어든다 */}
      <div role="dialog" aria-label="구질 고르기"
        style={{ position: 'absolute', left: 0, top: 'calc(50% - 160px)', width: 240, height: 320, pointerEvents: 'none' }}>
        {/* 0x746cc — 뒤 어둡게(단계 5) 뒤 판 0x744c4 (0, (H − 높이) >> 1, 240, 높이) */}
        <div style={{ ...pixel, left: 0, top: 0, width: 240, height: 320, background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }} />
        <div className={boxStyles.box} data-testid="구질고르기-판" ref={boxRef}
          style={{ ...box, top: recordPickPopupTopOf(box.height), transform: 'none', padding: 0 }} />
        {/* 펼치는 동안은 판만 긋는다(0x7479c) — 줄이는 동안은 그리기 0x190f8 이 그대로 돈다 */}
        {motion.openingHeight === null && (<>
          {/* 0xba269 넷째 인자 −1(폭) = **글 폭을 재서 쓴다**(직접 떴다): 0xba268 이 폭을 0x6ef4c 의 다섯째 인자로 넘기고, 6efb0 이
              −1 이면 0x9c52c 로 날 글을 재 그 값을 폭으로 쓴다. 0x9c52c 는 '!' 서식을 거르지 않아 "!C" 두 자(12px)까지 들어간다(143) —
              그래서 글은 x 에서 시작하지 않고 가운데 x + (143 >> 1) 에 맞춘다(`measuredTitleCenterXOf`, r114 의 "x 에서 시작" 을 고친다) */}
          <div className={styles.title}
            style={{ left: TITLE_CENTER_X - 120, top: 160 - TITLE_RISE, width: 240, whiteSpace: 'nowrap' }}>
            <MarkupText raw={TITLE_RAW} />
          </div>
          {PITCH_CHOICE_CELLS.map((cell, index) => {
            const isOn = index === (selected === 0 ? 0 : 1)
            const labelSrc = frameSrc(cell.labelFrame)
            const labelSize = labelOrigins?.[String(cell.labelFrame).padStart(3, '0')]
            const labelX = labelSize === undefined ? 0 : recordPickLabelXOf(labelSize.width)
            const label = PITCH_WINDOW_CHOICES[index] ?? ''
            return (
              <button key={label} type="button" aria-pressed={isOn} aria-label={label}
                className={windowStyles.layer}
                style={{
                  left: cell.x, top: cell.y, width: RECORD_PICK_CELL_SIZE, height: labelTop + (labelSize?.height ?? 0),
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', pointerEvents: 'auto', overflow: 'visible',
                }}
                // 웹판 마우스 길 — 칸을 누르면 그 칸으로 옮기고 확인한다
                onClick={() => {
                  if (!motion.acceptsKeys()) return
                  if (!isOn) latest.current.onMove(index)
                  confirm(index)
                }}>
                {/* 읽기 보조 — 칸 이름은 그림이다 */}
                <span style={{ display: 'none' }}>{label}</span>
                <img alt="" data-testid={`구질고르기-칸-${index}`}
                  src={isOn ? selectedModeIconOf(cell.iconFrame) : modeIconOf(cell.iconFrame)}
                  style={{ ...pixel, left: icon.x, top: icon.y }} />
                {isOn || labelSize === undefined
                  ? <img alt="" src={labelSrc} style={{ ...pixel, left: labelX, top: labelTop }} />
                  : (
                    // 효과 0xb 단색 — 그림을 마스크로 쓰고 회색을 칠한다
                    <span style={{
                      ...pixel, left: labelX, top: labelTop, width: labelSize.width, height: labelSize.height,
                      background: solidColorCss(PITCH_CHOICE_DIM_LABEL_COLOR), maskImage: spriteMaskImage(labelSrc), WebkitMaskImage: spriteMaskImage(labelSrc),
                      maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
                    }} />
                  )}
              </button>
            )
          })}
          {/* CLR — 창 아래 106 · 107 화면이 그대로 그리는 바닥띠 되돌아가기 표시 자리(웹 전용 누름 칸, r186). 키와 같은 길(위 듣는 곳) */}
          <div style={{ pointerEvents: 'auto' }}>
            <PressArea label="취소" rect={FOOTER_BACK_PRESS_RECT} onPress={() => tapKey('Escape')} />
          </div>
        </>)}
      </div>
    </ScreenOverlay>
  )
}

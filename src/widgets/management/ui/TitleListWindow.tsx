import { useEffect, useId, useState } from 'react'
import { CommonPanel, MessageBox } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import {
  currentTitleOf, equipTitleNoticeOf, titleListOf, TITLE_ROWS_PER_PAGE,
} from '@/entities/career/model/titles'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  TITLE_CURSOR_BOX, TITLE_HEADER_FRAME, TITLE_HEADER_OX, TITLE_LIST_BOXES, TITLE_LIST_COLORS, TITLE_LIST_FRAME,
  TITLE_NUMBER_HEIGHT, TITLE_ROW_STEP, centeredTopOf, titleListTopAfter, titleNumberLeftOf, titleNumberWidthOf,
  titleScrollBarRectsOf,
} from '@/widgets/management/lib/titleListLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/management/ui/TitleListWindow.css'

interface TitleListWindowProps {
  readonly career: PlayerCareer
  /** 확인 키로 칭호를 바꿨다 — 세션이 `equipTitle` 로 선수 +0x1c4 를 쓰고 저장한다 */
  readonly onEquip: (title: string) => void
  readonly onClose: () => void
  /**
   * 목록 객체의 윗줄 +0x30 — 장면 생성자(0x6c1e8)만 0 으로 두고 129 진입 0x104cc 는 커서만 (0, 0) 으로 돌린다.
   * 그래서 다시 열면 **지난번 윗줄이 그대로** 남는다(키를 누르기 전까지 커서 0 이 안 보일 수 있다 — 원본 그대로).
   * 부르는 쪽이 들고 있다가 넘긴다. 안 주면 0
   */
  readonly initialTop?: number
  readonly onTopChange?: (top: number) => void
}

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'
const pad = (frame: number) => String(frame).padStart(3, '0')
/** 0xca911(틱, 10) ≠ 0 — 고른 줄 테두리 깜박임 */
const BLINK_PERIOD = 10
/** 흰 글자(R=G=B) → img_text 팔레트 3 두 색. 255 → 41·73·165, 239 → 16·36·107 이 되는 1차식 (국가대항전 표와 같다) */
const PALETTE_THREE_MATRIX = '1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'

/**
 * 칭호(닉네임) 목록 — 나만의리그 관리 장면 **하위 상태 129** (P3 10-1 확정).
 *
 *   목록 0x104cc — 얻은 칭호를 **번호 오름차순**으로 (얻은 순서가 아니다). 한 화면 `min(개수, 9)` 줄.
 *   그리기 0x198fc — 이름 StrNICKNAME[i], **지금 장착한 것**(선수+0x1c4 == 목록값)만 다른 색.
 *   키 0x11f78 — 확인(−5/'5') 이면 +0x1c4 = sel 로 장착하고 팝업(이름 + StrMODE[138]) 뒤 저장.
 *                '*'(−16/0x2a) 면 하위 상태 0x77 = **119**(기본정보) 로 돌아간다.
 *
 * 그림은 0x198fc 그대로다 — mode_ui 프레임 63 박스 · 줄 막대 64/65 · 머리 img_text 279(팔레트 3) (`titleListLayout.ts`).
 * 진입 0x104cc: 목록 vt+0x1c(1열, 개수 줄, 숫자키 꼴 1, 꼴 0x230) → 바탕 0x6bfe0 이 vt+0x14(0, 0) — **커서는 늘 첫 줄**(장착한 칭호가
 * 아니다) · +0x34 = 1 · +0x38 = min(개수, 9). 윗줄은 한 줄씩 굴린다(`titleListTopAfter`).
 */
export function TitleListWindow({ career, onEquip, onClose, initialTop = 0, onTopChange }: TitleListWindowProps) {
  const titles = titleListOf(career.titleIds)
  const equipped = currentTitleOf(career)
  const [cursor, setCursor] = useState(0)
  const [top, setTop] = useState(initialTop)
  const [notice, setNotice] = useState<string | null>(null)
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const isBlinkOn = useUpdateCounter() % BLINK_PERIOD !== 0
  const headerFilterId = `title-palette3-${useId().replace(/:/g, '')}`

  /** 보이는 줄 — 그리기 0x198fc 는 윗줄 +0x30 부터 9 줄 */
  const pageTop = top
  const page = titles.slice(pageTop, pageTop + TITLE_ROWS_PER_PAGE)
  const visibleRows = Math.min(titles.length, TITLE_ROWS_PER_PAGE)

  // 터치 기기 — 9줄을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건). 보이는 줄은 눌러서 고르지만 그 밖의 줄은 커서로만 닿는다
  useTouchScrollKeys(notice === null && titles.length > TITLE_ROWS_PER_PAGE)

  /** 확인 키 — 이미 장착한 것이면 원본도 **아무 일도 하지 않는다** (0x11fd6 의 `!=` 검사) */
  const confirm = (index: number) => {
    const picked = titles[index]
    if (picked === undefined || picked === equipped) return
    onEquip(picked)
    setNotice(equipTitleNoticeOf(picked))
  }

  useEffect(() => {
    // 팝업이 떠 있으면 MessageBox 가 먼저 키를 가져간다
    if (notice !== null) return
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        if (titles.length === 0) return
        const next = (cursor + step + titles.length) % titles.length
        const nextTop = titleListTopAfter(top, next, visibleRows)
        setCursor(next)
        if (nextTop !== top) {
          setTop(nextTop)
          onTopChange?.(nextTop)
        }
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        confirm(cursor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const header = textOrigins?.[pad(TITLE_HEADER_FRAME)]
  const arrows = modeUiOrigins?.[pad(TITLE_LIST_FRAME.arrows)]
  const { window: windowBox, header: headerBox, scrollBar, number: numberBox, name: nameBox } = TITLE_LIST_BOXES

  return (
    <div className={notice !== null ? `${styles.overlay} ${styles.overlayWithPopup}` : styles.overlay} role="dialog" aria-label="칭호" onClick={onClose}>
      {/* 박스 0 — 19974 공용 판 0x55e61(skin, 박스 0 x · y · w · h, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)
          (1993a~19974 직접 뜸 — 박스 0 은 그림 자료 +0xfc = mode_ui 프레임 63). 제목 탭이 서서 위 띠는 안 본다 */}
      <CommonPanel x={windowBox.x} y={windowBox.y} width={windowBox.width} height={windowBox.height}
        topBand={0x10} titleTab testId="칭호-판" />

      {/* 박스 1 — img_text 279 "닉네임" 팔레트 3 · 정렬 0x21 · ox 28 */}
      {header !== undefined && (
        <img className={styles.layer} alt="닉네임" data-testid="칭호-머리"
          src={`${IMG_TEXT}/${pad(TITLE_HEADER_FRAME)}.png`}
          style={{
            left: headerBox.x + TITLE_HEADER_OX + header.x, top: centeredTopOf(headerBox, header.height) + header.y,
            filter: `url(#${headerFilterId})`,
          }} />
      )}

      {/* 박스 2 칠 · 프레임 63(▲▼) · 줄 막대 아홉 */}
      <svg className={local.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        <rect x={scrollBar.x} y={scrollBar.y} width={scrollBar.width} height={scrollBar.height} fill={TITLE_LIST_COLORS.scrollTrack} />
      </svg>
      {arrows !== undefined && (
        <img className={styles.layer} alt="" src={`${MODE_UI}/${pad(TITLE_LIST_FRAME.arrows)}.png`}
          style={{ left: arrows.x, top: arrows.y }} />
      )}
      {Array.from({ length: TITLE_ROWS_PER_PAGE }, (_unused, row) => {
        const title = page[row]
        const isEquipped = title !== undefined && title === equipped
        const frames = isEquipped ? [TITLE_LIST_FRAME.row, TITLE_LIST_FRAME.equippedRow] : [TITLE_LIST_FRAME.row]
        return frames.map((frame) => (
          <img key={`${row}-${frame}`} className={styles.layer} alt="" data-testid={`칭호-막대-${row}-${frame}`}
            src={`${MODE_UI}/${pad(frame)}.png`}
            style={{ left: numberBox.x, top: numberBox.y + TITLE_ROW_STEP * row }} />
        ))
      })}

      {/*
        목록이 비면 글이 하나도 없다 — 원본도 개수 0 이면 막대만 그린다.
        0번 "이름 없는 신인" 을 첫 관리 화면에서 얻으니 실제로 빈 목록을 볼 일은 거의 없다.
      */}
      {page.map((title, row) => {
        const index = pageTop + row
        const dy = TITLE_ROW_STEP * row
        const isEquipped = title === equipped
        let digitLeft = titleNumberLeftOf(index + 1)
        return (
          <span key={title}>
            {[...String(index + 1)].map((digit, digitIndex) => {
              const left = digitLeft
              digitLeft += titleNumberWidthOf(digit)
              return (
                <img key={digitIndex} className={styles.layer} alt="" src={`./sprites/num/${pad(Number(digit))}.png`}
                  style={{ left, top: centeredTopOf(numberBox, TITLE_NUMBER_HEIGHT) + dy }} />
              )
            })}
            <button type="button"
              aria-current={isEquipped ? 'true' : undefined}
              className={local.row}
              style={{
                left: nameBox.x, top: nameBox.y + dy, width: nameBox.width, height: nameBox.height,
                color: isEquipped ? TITLE_LIST_COLORS.equippedText : TITLE_LIST_COLORS.text,
              }}
              onClick={(event) => { event.stopPropagation(); setCursor(index); confirm(index) }}>
              {title}
            </button>
            {index === cursor && isBlinkOn && (
              <svg className={local.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges"
                data-testid="칭호-커서">
                {/* 0xb9ed5 노랑 테두리 — 0x6a978 이 폭·높이에 1 을 더해 플랫폼 0x14006d8 에 넘겨 (w + 1) × (h + 1) 칸을 덮는다(U-113 확정) */}
                <rect x={TITLE_CURSOR_BOX.x + 0.5} y={TITLE_CURSOR_BOX.y + dy + 0.5}
                  width={TITLE_CURSOR_BOX.width} height={TITLE_CURSOR_BOX.height}
                  fill="none" stroke={TITLE_LIST_COLORS.cursor} strokeWidth={1} />
              </svg>
            )}
          </span>
        )
      })}

      <svg className={local.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        {titleScrollBarRectsOf(titles.length, pageTop, TITLE_ROWS_PER_PAGE).map((rect, index) => (
          <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
        ))}
      </svg>
      <svg className={local.hiddenSvg} aria-hidden>
        <filter id={headerFilterId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={PALETTE_THREE_MATRIX} />
        </filter>
      </svg>

      {/* 알림의 [확인] 클릭이 창 바깥 클릭(닫기)으로 번지지 않게 막는다 — 키(Enter)처럼 알림만 닫힌다 (SkillWindow 와 같다, r186) */}
      <div onClick={(event) => event.stopPropagation()}>
        {notice !== null && (
          <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
        )}
      </div>
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CommonPanel, FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { glyphsWidthOf, numberGlyphsOf } from '@/pages/management/lib/managementLayout'
import {
  CHANGE_ARROW_FRAMES, DETAIL_CHANGE_X, DETAIL_CURRENT_DX, DETAIL_HEADER, DETAIL_LABEL_BOX, DETAIL_MAXIMUM_DX,
  DETAIL_MESSAGE_LINE_HEIGHT, DETAIL_SLASH_FRAME, DETAIL_TABLE_FRAME,
  DETAIL_SCROLL_BAR_COLORS, DETAIL_TITLE_FRAME, DETAIL_VALUE_BOX, DETAIL_WINDOW, DETAIL_Y_OFFSET, detailRowsOf,
  detailMessageBoxOf, detailRowTopOf, detailScrollBarOf,
} from '@/pages/management/lib/detailPopup'
import type { DetailResult, DetailRow, ScrollBarRect } from '@/pages/management/lib/detailPopup'
import * as styles from '@/pages/management/ui/DetailPopup.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
const imageOf = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`
const ROW_HEIGHT = 15
/** 화살표는 3갱신마다 1px 흔들린다 */
const ARROW_SWAY_UPDATES = 3
const NUM = './sprites/num'
/** 넷째 칸(보너스) 부호 — num 105 "+" · 128 "−" (0x875fa~0x8760c: 글자판 +0x1a4 / +0x200) */
const BONUS_SIGN_FRAMES = { plus: 105, minus: 128 }
/** 부호 그림 높이 (num 105 = 6px · 128 = 2px) — 세로 자리는 미확인이라 줄 가운데에 둔다 (추정) */
const BONUS_SIGN_HEIGHTS = { plus: 6, minus: 2 }
/**
 * 보너스 칸 자리 — 원본은 변화량 숫자를 dx 4, 보너스 숫자를 dx 22(0x16), 부호를 dx 14(0xe) 에 그린다(같은 기준점).
 * 기준점 자체는 변화량처럼 미확인이라, 변화량 숫자 왼쪽(아래 `CHANGE_LEFT`)에서 그 차이(+18 · +10)만큼 민다.
 */
const CHANGE_LEFT = DETAIL_CHANGE_X + 15
const BONUS_NUMBER_DX = 22 - 4
const BONUS_SIGN_DX = 14 - 4

interface DetailPopupProps {
  readonly result: DetailResult
  readonly onClose: () => void
}

/** 타자편 결과 — 줄을 세워 `DetailWindow` 에 넘긴다 */
export function DetailPopup({ result, onClose }: DetailPopupProps) {
  return (
    <DetailWindow
      rows={detailRowsOf(result.before, result.after, result.changes)}
      messages={result.messages}
      onClose={onClose}
      // 훈련 0x17f5c(0x18d5e) · 휴식 0x18e3c(0x18fd2) 결과 — 0x741a0(높이 0)
      opensAsCommonPopup
    />
  )
}

interface DetailWindowProps {
  readonly rows: readonly DetailRow[]
  readonly messages: readonly string[]
  readonly onClose: () => void
  /**
   * 글 상자 첫 줄 — 창 +0x380. 0x8a0a4 는 이 줄부터 끝까지 16px 간격으로 그리고 상자 밖은 잘린다(0x8a148~0x8a180).
   * 능력치 상세(120)만 0x8a044 로 민다. 안 주면 0.
   */
  readonly scrollOffset?: number
  /** 0x872d4 의 dy — 표 · 글 상자를 이만큼 내린다. 나리 0x8a0a4 는 −4, 시즌 훈련 결과 0xf25c 는 0 */
  readonly tableYOffset?: number
  /**
   * 글이 비면 글 · 스크롤 막대를 안 그린다 — 0x872d4 는 0x1552af4 가 빈 글이면(0x87700 strlen == 0) 끝으로 건너뛴다.
   * 나리 상세 창은 0x8a0a4 가 막대를 따로 늘 그리므로 거짓으로 둔다.
   */
  readonly hidesEmptyMessages?: boolean
  /**
   * 뒤 어둡게의 검정 몫 — 창을 공용 창 0x741a0 으로 띄우는 자리(시즌 훈련 결과)는 0x746cc 가 덮는다(`POPUP_DIM_OPACITY`).
   * 안 주면 안 덮는다(지금까지와 같다).
   */
  readonly dimOpacity?: number
  /**
   * 공용 창 [0x140005c] 의 0x741a0(높이 0)으로 띄운 결과 창 — 나리 훈련 0x17f5c(키 0x1b4c4) · 휴식 0x18e3c(키 0x1b308) ·
   * 장비 구매 확정 0x14a74(키 0x1d648) · 시즌 팀 트레이닝 결과 0xc074(키 0xf2c8). 2026-10-14 직접 뜸:
   * 띄운 그림은 펼침([창+0x214])이라 글을 안 그리고(0x7479c — 뒤 어둡게만), 다음 갱신 0x75556 이 높이 6 → 목표 0 으로 펼침을 끝내며
   * 그 갱신의 키는 안 본다. 네 키 콜백 모두 OK(−5) · '5' · CLR(−16) 에 0x742a9 를 바로 불러 그 자리에서 치운다(닫힘 애니 없음).
   * 참이면 이 창이 닫는 키(OK · '5' · CLR)를 잡는 단계에서 가져가고, 펼치는 갱신에는 모든 키를 막는다.
   */
  readonly opensAsCommonPopup?: boolean
}

/**
 * 상세정보 창 — 표와 메시지 줄. 누르면 닫힌다. 창 = 0x871f8 의 공용 판 `0x55e60(skin, x, y, w, h, 0, 정렬 0x11, 0x10, 0, 제목 탭 1, 0)`
 * (0x8720c~0x87232) — 제목 탭이 서 있어 위 띠 0x10 은 안 쓰인다. 모양은 `CommonPanel` 이 원본 선 목록대로 그린다.
 * 두 모드 공용 창(0x872d4)이라 줄(이름표 포함)만 받는다 — 투수편은 이름표 340~343 으로 세운 줄을 넘긴다.
 */
export function DetailWindow({
  rows, messages, onClose, scrollOffset = 0, tableYOffset = DETAIL_Y_OFFSET, hidesEmptyMessages = false, dimOpacity,
  opensAsCommonPopup = false,
}: DetailWindowProps) {
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 펼침 틀을 건너뛴다
  const overlayRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((overlayRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  const motion = usePopupWindowMotion({ targetHeight: 0, skipsMotion: !opensAsCommonPopup || hasNoLayout })
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
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
      if (!['Enter', ' ', '5', 'Escape', 'Backspace'].includes(event.key)) return
      event.stopImmediatePropagation()
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })
  const messageBox = detailMessageBoxOf(tableYOffset)
  const showsMessages = !hidesEmptyMessages || messages.length > 0
  const origins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sway = Math.floor(useUpdateCounter() / ARROW_SWAY_UPDATES) % 2
  const widthOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0
  const valueCenter = DETAIL_VALUE_BOX.x + Math.trunc(DETAIL_VALUE_BOX.width / 2)
  const centered = (value: number, center: number, top: number) => {
    const glyphs = numberGlyphsOf(value)
    return <SpriteNumber glyphs={glyphs} right={center + Math.ceil(glyphsWidthOf(glyphs) / 2)} boxTop={top} boxHeight={ROW_HEIGHT} />
  }

  if (motion.isClosed) return null
  return (
    <div className={styles.overlay} role="dialog" aria-label="상세정보" onClick={close} ref={overlayRef}
      style={dimOpacity === undefined ? undefined : { background: `rgba(0, 0, 0, ${dimOpacity})` }}>
      {/* 띄운 그림은 펼침이라 그리기 콜백을 안 부른다(0x7479c) — 뒤 어둡게만 */}
      <div style={{ visibility: motion.openingHeight !== null ? 'hidden' : undefined }}>
      <CommonPanel x={DETAIL_WINDOW.x} y={DETAIL_WINDOW.y} width={DETAIL_WINDOW.width} height={DETAIL_WINDOW.height} titleTab />
      <img className={styles.layer} alt="" src={`./sprites/management/label_navy_${DETAIL_TITLE_FRAME}.png`}
        style={{ left: DETAIL_WINDOW.x + Math.trunc((85 - widthOf(DETAIL_TITLE_FRAME)) / 2), top: DETAIL_WINDOW.y + 5 }} />
      <FrameSprite folder={MODE_UI} frame={DETAIL_TABLE_FRAME} origins={origins} x={0} y={tableYOffset} />
      <img className={styles.layer} alt="" src={imageOf(IMG_TEXT, DETAIL_HEADER.frame)}
        style={{ left: valueCenter - Math.trunc(widthOf(DETAIL_HEADER.frame) / 2), top: DETAIL_HEADER.box.y + 3 }} />
      {rows.map((row, index) => {
        const top = detailRowTopOf(index, tableYOffset)
        return (
          <div key={row.labelFrame}>
            <img className={styles.layer} alt="" src={imageOf(IMG_TEXT, row.labelFrame)}
              style={{ left: DETAIL_LABEL_BOX.x + DETAIL_LABEL_BOX.width - widthOf(row.labelFrame), top: top + 3 }} />
            {centered(row.current, valueCenter + DETAIL_CURRENT_DX, top)}
            <img className={styles.layer} alt="" src={imageOf(IMG_TEXT, DETAIL_SLASH_FRAME)}
              style={{ left: valueCenter - Math.trunc(widthOf(DETAIL_SLASH_FRAME) / 2), top: top + 3 }} />
            {centered(row.maximum, valueCenter + DETAIL_MAXIMUM_DX, top)}
            {row.change !== 0 && (
              <>
                <img className={styles.layer} alt=""
                  src={imageOf(MODE_UI, row.change > 0 ? CHANGE_ARROW_FRAMES.up : CHANGE_ARROW_FRAMES.down)}
                  style={{ left: DETAIL_CHANGE_X, top: top + 2 - (row.change > 0 ? sway : -sway) }} />
                {/* |값| 을 dx +4 — 기준(정렬)은 미확인이라 화살표 오른쪽에 둔다 (추정) */}
                <SpriteNumber glyphs={numberGlyphsOf(Math.abs(row.change))} right={CHANGE_LEFT + glyphsWidthOf(numberGlyphsOf(Math.abs(row.change)))} boxTop={top} boxHeight={ROW_HEIGHT} />
                {/* 넷째 칸 — 변화량이 0 이 아닐 때만 본다 (0x87548 이 변화량 0 이면 줄 끝으로 건너뛴다) */}
                {row.bonus !== 0 && (
                  <>
                    <img className={styles.layer} alt=""
                      src={imageOf(NUM, row.bonus > 0 ? BONUS_SIGN_FRAMES.plus : BONUS_SIGN_FRAMES.minus)}
                      style={{ left: CHANGE_LEFT + BONUS_SIGN_DX, top: top + Math.trunc((ROW_HEIGHT - (row.bonus > 0 ? BONUS_SIGN_HEIGHTS.plus : BONUS_SIGN_HEIGHTS.minus)) / 2) }} />
                    <SpriteNumber glyphs={numberGlyphsOf(Math.abs(row.bonus))} right={CHANGE_LEFT + BONUS_NUMBER_DX + glyphsWidthOf(numberGlyphsOf(Math.abs(row.bonus)))} boxTop={top} boxHeight={ROW_HEIGHT} />
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
      {showsMessages && (<>
      <div className={styles.messages} style={{ left: messageBox.x, top: messageBox.y, width: messageBox.width, height: messageBox.height }}>
        {/* 글은 0xba269 가 색 마크업(!c)을 읽으며 그린다 — 능력치 상세(120)의 "[!cFFFF00이름!cFFFFFF]" */}
        {messages.slice(scrollOffset).map((message, index) => (
          <div key={scrollOffset + index} style={{ height: DETAIL_MESSAGE_LINE_HEIGHT }}>
            {parseGameMarkup(message).flatMap((line) => line.segments).map((segment, segmentIndex) => (
              <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>{segment.text}</span>
            ))}
          </div>
        ))}
      </div>
      {/* 오른쪽 스크롤 막대 (0x8a182~0x8a2a4) — 줄 수 ≤ 3 이면 가득, 아니면 4줄 몫 손잡이 */}
      <svg className={styles.layer} style={{ left: 0, top: 0 }} viewBox="0 0 240 320" width={240} height={320}
        shapeRendering="crispEdges" data-testid="상세스크롤막대">
        {scrollBarRects(detailScrollBarOf(messages.length, scrollOffset, tableYOffset)).map(([name, rect, fill]) => (
          <rect key={name} data-part={name} x={rect.x} y={rect.y} width={rect.width} height={Math.max(rect.height, 0)} fill={fill} />
        ))}
      </svg>
      </>)}
      </div>
    </div>
  )
}

const scrollBarRects = (bar: ReturnType<typeof detailScrollBarOf>): readonly (readonly [string, ScrollBarRect, string])[] => [
  ['track', bar.track, DETAIL_SCROLL_BAR_COLORS.track],
  ['thumb', bar.thumb, DETAIL_SCROLL_BAR_COLORS.thumb],
  ['thumbInner', bar.thumbInner, DETAIL_SCROLL_BAR_COLORS.thumbInner],
]

import { CommonPanel, FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import {
  DETAIL_HEADER,
  DETAIL_TABLE_FRAME,
  DETAIL_TITLE_FRAME,
  DETAIL_VALUE_BOX,
  DETAIL_WINDOW,
  DETAIL_Y_OFFSET,
  detailRowsOf,
  detailRowTopOf,
} from '@/pages/management/lib/detailPopup'
import type { DetailResult, DetailRow } from '@/pages/management/lib/detailPopup'
import * as styles from '@/pages/management/ui/DetailPopup.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { ARROW_SWAY_UPDATES, IMG_TEXT, MODE_UI, frameNameOf, imageOf } from './detailPopup/detailAssets'
import { DetailRowView } from './detailPopup/DetailRowView'
import { DetailMessages } from './detailPopup/DetailMessages'
import { useDetailWindowClose } from './detailPopup/useDetailWindowClose'

const VALUE_CENTER = DETAIL_VALUE_BOX.x + Math.trunc(DETAIL_VALUE_BOX.width / 2)

/** 뒤 어둡게 — 몫을 안 주면 안 덮는다 */
const dimStyleOf = (dimOpacity: number | undefined) => (dimOpacity === undefined ? undefined : { background: `rgba(0, 0, 0, ${dimOpacity})` })
/** 글이 비면 글 · 막대를 숨기는 창(0x87700 strlen == 0)인가 */
const showsMessagesOf = (hidesEmptyMessages: boolean, messages: readonly string[]) => !hidesEmptyMessages || messages.length > 0
/** 펼치는 동안은 그림을 숨긴다 — 띄운 그림은 펼침이라 그리기 콜백을 안 부른다(0x7479c) */
const openingStyleOf = (openingHeight: number | null) => ({ visibility: openingHeight !== null ? ('hidden' as const) : undefined })

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
  rows,
  messages,
  onClose,
  scrollOffset = 0,
  tableYOffset = DETAIL_Y_OFFSET,
  hidesEmptyMessages = false,
  dimOpacity,
  opensAsCommonPopup = false,
}: DetailWindowProps) {
  const { overlayRef, motion, close } = useDetailWindowClose(opensAsCommonPopup, onClose)
  const showsMessages = showsMessagesOf(hidesEmptyMessages, messages)
  const origins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sway = Math.floor(useUpdateCounter() / ARROW_SWAY_UPDATES) % 2
  const widthOf = (frame: number) => textOrigins?.[frameNameOf(frame)]?.width ?? 0

  if (motion.isClosed) return null
  return (
    <div className={styles.overlay} role="dialog" aria-label="상세정보" onClick={close} ref={overlayRef} style={dimStyleOf(dimOpacity)}>
      <div style={openingStyleOf(motion.openingHeight)}>
        <CommonPanel x={DETAIL_WINDOW.x} y={DETAIL_WINDOW.y} width={DETAIL_WINDOW.width} height={DETAIL_WINDOW.height} titleTab />
        <img
          className={styles.layer}
          alt=""
          src={assetUrl(`./sprites/management/label_navy_${DETAIL_TITLE_FRAME}.png`)}
          style={{ left: DETAIL_WINDOW.x + Math.trunc((85 - widthOf(DETAIL_TITLE_FRAME)) / 2), top: DETAIL_WINDOW.y + 5 }}
        />
        <FrameSprite folder={MODE_UI} frame={DETAIL_TABLE_FRAME} origins={origins} x={0} y={tableYOffset} />
        <img
          className={styles.layer}
          alt=""
          src={imageOf(IMG_TEXT, DETAIL_HEADER.frame)}
          style={{ left: VALUE_CENTER - Math.trunc(widthOf(DETAIL_HEADER.frame) / 2), top: DETAIL_HEADER.box.y + 3 }}
        />
        {rows.map((row, index) => (
          <DetailRowView
            key={row.labelFrame}
            row={row}
            top={detailRowTopOf(index, tableYOffset)}
            valueCenter={VALUE_CENTER}
            sway={sway}
            widthOf={widthOf}
          />
        ))}
        {showsMessages && <DetailMessages messages={messages} scrollOffset={scrollOffset} tableYOffset={tableYOffset} />}
      </div>
    </div>
  )
}

import { useId, useState } from 'react'
import { CommonPanel, MessageBox } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { currentTitleOf, equipTitleNoticeOf, titleListOf, TITLE_ROWS_PER_PAGE } from '@/entities/career/model/titles'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { TITLE_LIST_BOXES, TITLE_LIST_COLORS, titleScrollBarRectsOf } from '@/widgets/management/lib/titleListLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/management/ui/TitleListWindow.css'
import { BLINK_PERIOD, IMG_TEXT, MODE_UI, PALETTE_THREE_MATRIX } from '@/widgets/management/ui/titleListWindow/titleListAssets'
import { TitleArrows, TitleHeader } from '@/widgets/management/ui/titleListWindow/TitleListDecor'
import { TitleRow, TitleRowBars } from '@/widgets/management/ui/titleListWindow/TitleRows'
import { useTitleListKeys } from '@/widgets/management/ui/titleListWindow/useTitleListKeys'

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

  useTitleListKeys({
    isActive: notice === null,
    count: titles.length,
    cursor,
    top,
    visibleRows,
    onMove: (next, nextTop) => {
      setCursor(next)
      if (nextTop === top) return
      setTop(nextTop)
      onTopChange?.(nextTop)
    },
    onConfirm: () => confirm(cursor),
  })

  const { window: windowBox, scrollBar } = TITLE_LIST_BOXES

  return (
    <div
      className={notice !== null ? `${styles.overlay} ${styles.overlayWithPopup}` : styles.overlay}
      role="dialog"
      aria-label="칭호"
      onClick={onClose}
    >
      {/* 박스 0 — 19974 공용 판 0x55e61(skin, 박스 0 x · y · w · h, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)
          (1993a~19974 직접 뜸 — 박스 0 은 그림 자료 +0xfc = mode_ui 프레임 63). 제목 탭이 서서 위 띠는 안 본다 */}
      <CommonPanel x={windowBox.x} y={windowBox.y} width={windowBox.width} height={windowBox.height} topBand={0x10} titleTab testId="칭호-판" />

      <TitleHeader textOrigins={textOrigins} filterId={headerFilterId} />

      {/* 박스 2 칠 · 프레임 63(▲▼) · 줄 막대 아홉 */}
      <svg className={local.pixels} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        <rect x={scrollBar.x} y={scrollBar.y} width={scrollBar.width} height={scrollBar.height} fill={TITLE_LIST_COLORS.scrollTrack} />
      </svg>
      <TitleArrows modeUiOrigins={modeUiOrigins} />
      <TitleRowBars page={page} equipped={equipped} />

      {/*
        목록이 비면 글이 하나도 없다 — 원본도 개수 0 이면 막대만 그린다.
        0번 "이름 없는 신인" 을 첫 관리 화면에서 얻으니 실제로 빈 목록을 볼 일은 거의 없다.
      */}
      {page.map((title, row) => (
        <TitleRow
          key={title}
          title={title}
          index={pageTop + row}
          row={row}
          isEquipped={title === equipped}
          isCursorShown={pageTop + row === cursor && isBlinkOn}
          onPick={(index) => {
            setCursor(index)
            confirm(index)
          }}
        />
      ))}

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
        {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
      </div>
    </div>
  )
}

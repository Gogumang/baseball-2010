import { useEffect, useState } from 'react'
import type { MapBox, OutingPlace } from '@/shared/config/outingPlaces'
import * as styles from '@/pages/outing-map/ui/OutingMapScreen.css'
import * as local from '@/pages/outing-map/ui/PlaceBubble.css'

/**
 * 장소 기능 말풍선 (0x7ee1a~0x7f03a, F-2 2-7 확정).
 *
 * 원본은 장소를 고르면 **지도 위 고른 건물 옆 70×42 말풍선**에 칸 두 개만 띄운다:
 *   칸1 = StrMODE[48] "들어가기" · 칸2 = 나만의리그 StrMODE[49 + 장소] (팬미팅·외식·입원·야구교실·CF촬영)
 * 비용도 설명도 없다. 앞서 웹은 전체 화면 목록(소지금 줄·소프트키·설명)으로 바꾸고 있었다.
 *
 * 배치:
 * ```
 * 바탕 = 박스 3, 둥글기 1, #2E4694
 * 칸1 = (R.x + 4, R.y + 4, R.w − 8, (R.h − 12) >> 1)   ; 70×42 이면 62×15
 * 칸2 = 칸1 과 같은 x·w·h, y = 칸1.y + 칸1.h + 4
 * 칸 바탕 = 둥글기 1, #213473 · 고른 칸은 (x−1,y−1,w+2,h+2) 노랑 테두리 + 노랑 글씨
 * 글 = 가로·세로 가운데 정렬
 * ```
 */
const CELL_INSET = 4
const CELL_GAP = 4
const BUBBLE_COLOR = '#2E4694'
const CELL_COLOR = '#213473'
const SELECTED_COLOR = '#FFFF00'
const CELL_TEXT_COLOR = '#FFFFFF'
/** 둥글기 1 (0x6b7d5 의 인자) */
const CORNER_RADIUS = 1

interface PlaceBubbleProps {
  readonly place: OutingPlace
  /**
   * 칸 0 [들어가기] — 113 키 0x16c64 의 OK 갈래(0x16c8a~0x16cee)는 칸 번호가 0 이면 곧장 0x8ce59(배정 이벤트) · 없으면
   * 0x8bdc9(440 + 장소) 를 부른다. 행동(S+4) · 인기도 가드가 없다 — 가드 0x16cf0 은 칸 1 장소 기능 쪽이다 (직접 떴다).
   */
  readonly onEnter: () => void
  readonly onRun: (functionId: string) => void
  readonly onClose: () => void
}

function cellsOf(box: MapBox) {
  const width = box.width - CELL_INSET * 2
  const height = (box.height - CELL_INSET * 3) >> 1
  const first = { x: box.x + CELL_INSET, y: box.y + CELL_INSET, width, height }
  return [first, { ...first, y: first.y + height + CELL_GAP }]
}

export function PlaceBubble({ place, onEnter, onRun, onClose }: PlaceBubbleProps) {
  const [selected, setSelected] = useState(0)
  const activity = place.functions[0]
  const labels = ['들어가기', activity?.name ?? '']
  const cells = cellsOf(place.bubbleBox)

  const answer = (index: number) => {
    if (index === 0) return onEnter()
    if (activity !== undefined) onRun(activity.id)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        return setSelected((previous) => (previous + step + labels.length) % labels.length)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return answer(selected)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  return (
    <div
      className={local.bubble}
      style={{
        left: place.bubbleBox.x,
        top: place.bubbleBox.y + styles.MAP_TOP,
        width: place.bubbleBox.width,
        height: place.bubbleBox.height,
        background: BUBBLE_COLOR,
        borderRadius: CORNER_RADIUS,
      }}
    >
      {cells.map((cell, index) => {
        const isSelected = index === selected
        return (
          <button
            key={labels[index]}
            type="button"
            className={local.cell}
            style={{
              left: cell.x - place.bubbleBox.x,
              top: cell.y - place.bubbleBox.y,
              width: cell.width,
              height: cell.height,
              background: CELL_COLOR,
              borderRadius: CORNER_RADIUS,
              color: isSelected ? SELECTED_COLOR : CELL_TEXT_COLOR,
              // 고른 칸은 칸을 1px 씩 둘러싼 노랑 사각 테두리다 (0x6a979)
              outline: isSelected ? `1px solid ${SELECTED_COLOR}` : undefined,
            }}
            onMouseEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
            onClick={() => answer(index)}
          >
            {labels[index]}
          </button>
        )
      })}
    </div>
  )
}

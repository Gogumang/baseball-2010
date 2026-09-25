import { useEffect, useRef, useState } from 'react'
import * as styles from '@/shared/ui/MenuList/MenuList.css'
import { popupLabel } from '@/shared/ui/PixelNumber/PixelNumber.css'

export interface MenuItem {
  readonly id: string
  readonly label: string
  /** 있으면 글자 대신 이 그림을 쓴다 (원본 라벨 스프라이트) */
  readonly labelSpriteUrl?: string
  /** 항목 왼쪽에 붙는 원본 아이콘 */
  readonly iconUrl?: string
  readonly detail?: string
  readonly cost?: string
  readonly isDisabled?: boolean
}

interface MenuListProps {
  readonly items: readonly MenuItem[]
  readonly onSelect: (id: string) => void
  /**
   * 커서를 그리는 방식.
   *   `'목록'`   — 웹판 기본. 왼쪽에 ▶ 를 찍고 고른 줄 배경을 바꾼다.
   *   `'선택지'` — **원본 대사 창의 선택지 갈래**(0x7fd22): 화살표도 배경도 없고
   *                고른 줄 글자만 노랑 RGB(255,255,0) 으로 칠한다 (R14 3-4 표 dlg+0xe4).
   */
  readonly cursorStyle?: '목록' | '선택지'
}

/**
 * 원작의 커서 메뉴.
 * 키보드(↑↓ + Enter)와 터치(탭)를 같은 동작으로 다룬다 — 데스크탑과 모바일에서
 * 조작 방식만 다를 뿐 화면은 동일하다.
 */
export function MenuList({ items, onSelect, cursorStyle = '목록' }: MenuListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const selectedIndexRef = useRef(selectedIndex)
  selectedIndexRef.current = selectedIndex

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  /**
   * 메뉴 **구성이 바뀌면** 커서를 첫 항목으로 되돌린다.
   *
   * ⚠️ 배열 자체(`items`)를 의존성으로 쓰면 안 된다 — 부르는 쪽이 매 렌더 새 배열을 만드는
   *    곳이 있어(`usePitcherManagementMenu` 의 `itemsOf` 등) **커서를 내려 둔 채 부모가 다시
   *    그려지기만 해도 0 으로 튄다**. 그래서 **칸 이름을 이어 붙인 값**으로 견준다.
   */
  const itemsKey = items.map((item) => item.id).join('\u0000')
  useEffect(() => {
    setSelectedIndex(0)
  }, [itemsKey])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const currentItems = itemsRef.current
      if (currentItems.length === 0) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setSelectedIndex(
          (previous) => (previous + step + currentItems.length) % currentItems.length,
        )
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const selected = currentItems[selectedIndexRef.current]
        if (selected !== undefined && selected.isDisabled !== true) {
          onSelectRef.current(selected.id)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <ul className={cursorStyle === '선택지' ? styles.choiceList : styles.list} role="listbox">
      {items.map((item, index) => (
        <li key={item.id}>
          <button
            type="button"
            className={cursorStyle === '선택지' ? styles.choiceItem : styles.item}
            role="option"
            aria-selected={index === selectedIndex}
            disabled={item.isDisabled === true}
            onPointerEnter={() => setSelectedIndex(index)}
            onClick={() => {
              setSelectedIndex(index)
              onSelect(item.id)
            }}
          >
            {/* 원본 선택지 갈래는 화살표를 안 그린다 — 고른 줄 색만 바뀐다 (0x7fd22) */}
            {cursorStyle === '목록' && (
              <span className={styles.cursor}>{index === selectedIndex ? '▶' : ''}</span>
            )}
            {item.iconUrl !== undefined && (
              <img className={styles.icon} src={item.iconUrl} alt="" aria-hidden />
            )}
            <span className={styles.label}>
              {item.labelSpriteUrl === undefined ? (
                item.label
              ) : (
                <img className={popupLabel} src={item.labelSpriteUrl} alt={item.label} />
              )}
              {item.detail !== undefined && <span className={styles.detail}>{item.detail}</span>}
            </span>
            {item.cost !== undefined && <span className={styles.cost}>{item.cost}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

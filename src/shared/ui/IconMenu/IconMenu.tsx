import { useEffect, useRef, useState } from 'react'
import * as styles from '@/shared/ui/IconMenu/IconMenu.css'

/**
 * 원작 메뉴.
 *
 * 원본 ui/slt_frame.pzx 에 파란 채움 상자(39×38)와 노란 테두리 프레임(42×42)이
 * 짝으로 들어있고 ui/mode_icon.pzx 에 33×33 아이콘이 있다. 즉 원작 메뉴는
 * 글자 목록이 아니라 **아이콘 상자 격자에 노란 프레임이 얹히는** 형태다.
 */

const SLOT_BACKGROUND = './sprites/slt_frame/000.png'
const SELECTION_FRAME = './sprites/slt_frame/001.png'

export interface IconMenuItem {
  readonly id: string
  readonly label: string
  readonly iconUrl: string
  readonly detail?: string
  readonly isDisabled?: boolean
}

interface IconMenuProps {
  readonly items: readonly IconMenuItem[]
  readonly columns?: number
  readonly onSelect: (id: string) => void
}

export function IconMenu({ items, columns = 3, onSelect }: IconMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const itemsRef = useRef(items)
  itemsRef.current = items
  const selectedRef = useRef(selectedIndex)
  selectedRef.current = selectedIndex
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = itemsRef.current
      if (current.length === 0) return

      // 격자라서 좌우는 한 칸, 위아래는 한 줄만큼 움직인다.
      const step =
        event.key === 'ArrowRight' ? 1
        : event.key === 'ArrowLeft' ? -1
        : event.key === 'ArrowDown' ? columnsRef.current
        : event.key === 'ArrowUp' ? -columnsRef.current
        : 0

      if (step !== 0) {
        event.preventDefault()
        setSelectedIndex(
          (previous) => (previous + step + current.length) % current.length,
        )
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const item = current[selectedRef.current]
        if (item !== undefined && item.isDisabled !== true) onSelectRef.current(item.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selected = items[selectedIndex]

  return (
    <div>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, 39px)` }}>
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={styles.slot}
            aria-selected={index === selectedIndex}
            aria-label={item.label}
            disabled={item.isDisabled === true}
            onPointerEnter={() => setSelectedIndex(index)}
            onClick={() => {
              setSelectedIndex(index)
              onSelect(item.id)
            }}
          >
            <img className={styles.slotBack} src={SLOT_BACKGROUND} alt="" aria-hidden />
            <img className={styles.slotIcon} src={item.iconUrl} alt="" aria-hidden />
            {index === selectedIndex && (
              <img className={styles.slotFrame} src={SELECTION_FRAME} alt="" aria-hidden />
            )}
          </button>
        ))}
      </div>

      {selected !== undefined && (
        <div className={styles.caption}>
          <strong>{selected.label}</strong>
          {selected.detail !== undefined && <span>{selected.detail}</span>}
        </div>
      )}
    </div>
  )
}

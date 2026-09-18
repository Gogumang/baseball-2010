import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '@/shared/ui/BottomSheet/BottomSheet'
import { stepEnabledIndex } from '@/shared/ui/SelectBox/selectNavigation'
import type { SelectOption } from '@/shared/ui/SelectBox/selectNavigation'
import * as styles from '@/shared/ui/SelectBox/SelectBox.css'

interface SelectBoxProps {
  readonly label: string
  readonly value: string | null
  readonly options: readonly SelectOption[]
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  /** 시트가 열리고 닫힐 때 알려준다 — 화면 쪽 키 입력과 겹치지 않게 하려는 것이다. */
  readonly onOpenChange?: (isOpen: boolean) => void
}

/**
 * 누르면 바텀시트에서 고르는 선택 상자 (토스 TDS Select 동작).
 * 키보드: 필드에서 Enter/Space 로 열고, ↑↓ 로 옮기고, Enter 로 고르고, Esc 로 닫는다.
 */
export function SelectBox({ label, value, options, onChange, placeholder = '선택해 주세요', onOpenChange }: SelectBoxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  const changeOpen = (next: boolean) => {
    setIsOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div>
      <span className={styles.fieldLabel}>{label}</span>
      <button
        type="button"
        className={styles.field}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => changeOpen(true)}
      >
        <span className={selected === undefined ? styles.placeholder : styles.fieldValue}>
          {selected?.label ?? placeholder}
        </span>
        <span className={styles.chevron} aria-hidden>▼</span>
      </button>

      {isOpen && (
        <OptionSheet
          title={label}
          options={options}
          value={value}
          onPick={(picked) => {
            onChange(picked)
            changeOpen(false)
          }}
          onClose={() => changeOpen(false)}
        />
      )}
    </div>
  )
}

interface OptionSheetProps {
  readonly title: string
  readonly options: readonly SelectOption[]
  readonly value: string | null
  readonly onPick: (value: string) => void
  readonly onClose: () => void
}

function OptionSheet({ title, options, value, onPick, onClose }: OptionSheetProps) {
  const selectedIndex = options.findIndex((option) => option.value === value)
  const [highlighted, setHighlighted] = useState(Math.max(0, selectedIndex))

  const highlightedRef = useRef(highlighted)
  highlightedRef.current = highlighted
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlighted(stepEnabledIndex(options, highlightedRef.current, event.key === 'ArrowDown' ? 1 : -1))
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const option = options[highlightedRef.current]
        if (option !== undefined && option.isDisabled !== true) onPickRef.current(option.value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [options])

  return (
    <BottomSheet title={title} onClose={onClose}>
      <div role="listbox" aria-label={title}>
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="option"
            className={styles.option}
            aria-selected={option.value === value}
            data-highlighted={index === highlighted}
            disabled={option.isDisabled === true}
            onPointerEnter={() => setHighlighted(index)}
            onClick={() => onPick(option.value)}
          >
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>{option.label}</span>
              {option.description !== undefined && (
                <span className={styles.optionDescription}>{option.description}</span>
              )}
            </span>
            <span className={styles.check} aria-hidden>{option.value === value ? '✓' : ''}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

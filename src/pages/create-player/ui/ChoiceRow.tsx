import { Button, Hint, Panel } from '@/shared/ui'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'

interface ChoiceRowProps {
  readonly heading: string
  /** StrMODE 설명 원문 */
  readonly hint: string
  readonly options: readonly string[]
  readonly selected: number
  readonly onSelect: (index: number) => void
}

export function ChoiceRow({ heading, hint, options, selected, onSelect }: ChoiceRowProps) {
  return (
    <Panel heading={heading}>
      <div className={styles.choices} role="radiogroup" aria-label={heading}>
        {options.map((option, index) => (
          <Button key={option} variant="segment" role="radio" aria-checked={index === selected}
            onClick={() => onSelect(index)}>
            {option}
          </Button>
        ))}
      </div>
      <Hint>{hint}</Hint>
    </Panel>
  )
}

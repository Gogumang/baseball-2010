import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import * as styles from '@/shared/ui/MarkupText/MarkupText.css'

interface MarkupTextProps {
  readonly raw: string
  /** %s 를 순서대로 채울 값 (보통 선수 이름, 팀 이름) */
  readonly replacements?: readonly string[]
}

/** 원본 텍스트 마크업을 그대로 화면에 그린다. */
export function MarkupText({ raw, replacements = [] }: MarkupTextProps) {
  const lines = parseGameMarkup(raw, replacements)

  return (
    <>
      {lines.map((line, lineIndex) => (
        <p
          key={lineIndex}
          className={styles.dialogueText}
          style={line.isCentered ? { textAlign: 'center' } : undefined}
        >
          {line.segments.map((segment, segmentIndex) => (
            <span
              key={segmentIndex}
              style={segment.color === null ? undefined : { color: segment.color }}
            >
              {segment.text}
            </span>
          ))}
          {line.segments.length === 0 && ' '}
        </p>
      ))}
    </>
  )
}

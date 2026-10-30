import { HELP_TEXT_BOX, type HelpTextAlign, type wrapHelpText } from '@/pages/help/lib/helpPages'
import * as styles from '@/pages/help/ui/HelpScreen.css'

const TEXT_ALIGN: Readonly<Record<HelpTextAlign, 'left' | 'center' | 'right'>> = { 왼: 'left', 가운데: 'center', 오른: 'right' }

/** 본문 글 — 원본 줄 나누기(한글 9·영문 5·자간 1)로 나눈 줄들 중 보이는 11줄을 웹 글꼴로 그린다. `firstLine` = 스크롤 위 줄 */
export function HelpTextLines({ lines, firstLine }: { readonly lines: ReturnType<typeof wrapHelpText>; readonly firstLine: number }) {
  return lines.map((line, index) => (
    <div
      key={firstLine + index}
      className={styles.textLine}
      style={{
        left: HELP_TEXT_BOX.x,
        top: HELP_TEXT_BOX.y + index * HELP_TEXT_BOX.lineHeight,
        width: HELP_TEXT_BOX.width,
        textAlign: TEXT_ALIGN[line.align],
      }}
    >
      {line.segments.map((segment, segmentIndex) => (
        <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
          {segment.text}
        </span>
      ))}
    </div>
  ))
}

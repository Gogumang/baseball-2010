import { wrapHelpText } from './otherSlices'
import { DESCRIPTION_LINE_HEIGHT } from '@/pages/match-settings/lib/matchSettingsLayout'
import type { DescriptionLayout } from '@/pages/match-settings/lib/matchSettingsLayout'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'

/** 설명 칸 0xbb28c + 글 0xba268 — 글은 0x6ef4c 줄 나누기(`wrapHelpText`, 같은 앱 전역 글꼴)로 편다 */
export function Description({ layout, raw }: { readonly layout: DescriptionLayout; readonly raw: string }) {
  const lines = raw === '' ? [] : wrapHelpText(raw, layout.text.width)
  return (
    <>
      <div className={styles.descriptionBox} style={{ left: layout.box.x, top: layout.box.y, width: layout.box.width, height: layout.box.height }} />
      {lines.map((line, index) => (
        <div
          key={index}
          className={styles.descriptionLine}
          style={{
            left: layout.text.x,
            top: layout.text.y + index * DESCRIPTION_LINE_HEIGHT,
            width: layout.text.width,
            textAlign: line.align === '가운데' ? 'center' : line.align === '오른' ? 'right' : 'left',
          }}
        >
          {line.segments.map((segment, segmentIndex) => (
            <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </>
  )
}

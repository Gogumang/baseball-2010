import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { InsetBox } from '@/shared/ui'
import { ACE_LEVEL_UP_TEXT } from '@/entities/mission/model/aceLevel'
import { ACE_LEVEL_UP_COST_BOX, ACE_LEVEL_UP_COST_TEXT } from '@/widgets/ace-level-up/lib/aceLevelUpLayout'
import * as styles from '@/widgets/ace-level-up/ui/AceLevelUpWindow.css'

/** 5f878 안쪽 칸 · 5f8de 비용 줄 0xba269(…, (38, 196), 폭 164) — StrCOMMON[49] 에 비용을 넣는다 */
export function AceLevelUpCost({ cost }: { readonly cost: number }) {
  const costLines = parseGameMarkup(ACE_LEVEL_UP_TEXT.confirm.replace('%d', String(cost)))
  return (
    <>
      <InsetBox
        x={ACE_LEVEL_UP_COST_BOX.x}
        y={ACE_LEVEL_UP_COST_BOX.y}
        width={ACE_LEVEL_UP_COST_BOX.width}
        height={ACE_LEVEL_UP_COST_BOX.height}
        testId="레벨업-비용-칸"
      />
      <div
        className={styles.cost}
        data-testid="레벨업-비용"
        style={{ left: ACE_LEVEL_UP_COST_TEXT.x, top: ACE_LEVEL_UP_COST_TEXT.y, width: ACE_LEVEL_UP_COST_TEXT.width }}
      >
        {costLines.map((line, lineIndex) => (
          <div key={lineIndex} style={{ textAlign: line.isCentered ? 'center' : 'left' }}>
            {line.segments.map((segment, segmentIndex) => (
              <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
                {segment.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

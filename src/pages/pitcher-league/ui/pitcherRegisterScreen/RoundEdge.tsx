import { useMemo } from 'react'
import { PaintedRects } from '@/shared/ui'
import { roundEdgePaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import type { RegisterBox } from '@/pages/pitcher-league/lib/pitcherRegisterLayout'

/** 둥근 테두리 0xba015 — (w + 1) × (h + 1) */
export function RoundEdge({ box, color, testId }: { readonly box: RegisterBox; readonly color: string; readonly testId?: string }) {
  const paints = useMemo(() => roundEdgePaintsOf(box.width, box.height, color), [box.width, box.height, color])
  return <PaintedRects x={box.x} y={box.y} width={box.width + 1} height={box.height + 1} paints={paints} testId={testId} />
}

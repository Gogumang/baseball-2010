import { ARROW, arrowTopLeftOf, INFO_CELLS } from '@/pages/create-player/lib/createPlayerLayout'
import type { CreatePlayerRowId } from '@/pages/create-player/lib/createPlayerLayout'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'

/** 값 칸 화살표 — mode_ui 프레임 24 (ARROW 주석) */
export function ArrowButton({
  rowId,
  step,
  onPress,
}: {
  readonly rowId: CreatePlayerRowId
  readonly step: number
  readonly onPress: (rowId: CreatePlayerRowId, step: number) => void
}) {
  const box = INFO_CELLS.find((cell) => cell.id === rowId)?.value
  if (box === undefined) return null
  const at = arrowTopLeftOf(box, step)
  return (
    <button
      type="button"
      className={styles.arrowButton}
      aria-label={`${rowId} ${step < 0 ? '이전' : '다음'}`}
      style={{ left: at.x, top: at.y, width: ARROW.width, height: ARROW.height }}
      onClick={() => onPress(rowId, step)}
    >
      {/* 글줄 기준선에 얹히지 않게 블록으로 — 그림 윗변이 단추 윗변(= 화살 자리)에 붙는다 */}
      <img alt="" src={ARROW.image} style={{ display: 'block', transform: step < 0 ? undefined : 'scaleX(-1)' }} />
    </button>
  )
}

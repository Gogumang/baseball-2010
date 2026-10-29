import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { matchInfoValueCellDy, type MatchInfoValueRows } from '@/pages/management/lib/matchInfoEntry'
import { MATCH_INFO_LAYOUT, matchInfoRowY, prepareStyles as styles, type MatchInfoLine } from './otherSlices'
import { SLT_IMAGE, imageSrc } from './matchInfoAssets'

export interface MatchInfoValueCellsProps {
  /** 다섯 줄 값 — 0x5dcc0 (시즌 · 나리 같은 함수 `seasonMatchInfoLines`) */
  readonly lines: readonly MatchInfoLine[]
  readonly imgTextOrigins: FrameOrigins | null
  /** 공용 목록 깜빡 [sp+0xd4] */
  readonly isBob: boolean
  /** 값 줄 펼침 — 펼친 칸 수 · 다 펼쳤나([skin+0xe4]) */
  readonly valueRows: MatchInfoValueRows
  /** 재굴림 중에는 값 칸을 안 그린다 */
  readonly areValueCellsHidden: boolean
  /** 값 칸 testid 머리 — `시즌경기정보` · `나리경기정보` */
  readonly testIdPrefix: string
}

const cell = MATCH_INFO_LAYOUT.valueCell
const half = MATCH_INFO_LAYOUT.halfCircle

/** 값 칸 하나 — 유저는 slt_frame 이미지 10 그대로, CPU 는 뒤집어 */
function ValueCell({
  x,
  y,
  text,
  testId,
  isFlipped,
}: {
  readonly x: number
  readonly y: number
  readonly text: string
  readonly testId: string
  readonly isFlipped: boolean
}) {
  return (
    <>
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, cell.image)}
        style={{ left: x, top: y, transform: isFlipped ? 'scaleX(-1)' : undefined }}
      />
      <span className={styles.centeredText} data-testid={testId} style={{ left: x, top: y + cell.textDy, width: cell.width }}>
        {text}
      </span>
    </>
  )
}

/**
 * 값 칸 0x5dcc0 — 딱지 뒤에 칸 i = 0 … 9 (짝 유저 · 홀 CPU) 차례로. 유저 slt_frame 이미지 10 (16, y + 3) · CPU 뒤집어 (138, y − 3),
 * 펼치는 동안은 아랫줄 칸이 첫 줄 자리에서 떨어져 내려온다(`matchInfoValueCellDy`). 재굴림 중에는 안 그린다.
 * 노랑 반원 두 쪽 — 값 줄이 다 펼쳤다고 돌려줬고([skin+0xe4]) 깜빡일 때만 (0x65078~0x65108).
 */
export function MatchInfoValueCells({ lines, isBob, valueRows, areValueCellsHidden, testIdPrefix }: MatchInfoValueCellsProps) {
  return (
    <>
      {!areValueCellsHidden &&
        lines.map((line, index) => {
          const y = matchInfoRowY(index)
          const userY = y + cell.userDy + matchInfoValueCellDy(valueRows.unfold, 2 * index)
          const cpuY = y + cell.cpuDy + matchInfoValueCellDy(valueRows.unfold, 2 * index + 1)
          return (
            <span key={line.label}>
              <ValueCell x={cell.userX} y={userY} text={line.user} testId={`${testIdPrefix}-${line.label}-유저`} isFlipped={false} />
              <ValueCell x={cell.cpuX} y={cpuY} text={line.cpu} testId={`${testIdPrefix}-${line.label}-CPU`} isFlipped />
            </span>
          )
        })}
      {valueRows.isReady && isBob && (
        <>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, half.image)} style={{ left: half.leftX, top: half.y }} />
          <img
            className={styles.layer}
            alt=""
            src={imageSrc(SLT_IMAGE, half.image)}
            style={{ left: half.rightX, top: half.y, transform: 'scaleX(-1)' }}
          />
        </>
      )}
    </>
  )
}

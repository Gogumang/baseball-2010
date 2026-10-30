import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { MATCH_INFO_LAYOUT, matchInfoRowY } from '@/pages/general-mode/lib/prepareLayout'
import type { MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { IMG_TEXT_FRAME, SLT_IMAGE, imageSrc } from './matchInfoFigure'
import { matchInfoValueCellDy } from './otherSlices'
import type { MatchInfoValueRows } from './otherSlices'

interface MatchInfoRowsProps {
  readonly lines: readonly MatchInfoLine[]
  readonly valueRows: MatchInfoValueRows
  /** 재굴림 중에는 값 칸을 안 그린다 */
  readonly areValueCellsHidden: boolean
  readonly isBob: boolean
  readonly imgTextOrigins: FrameOrigins | null
}

/** 본문 0x64d30 의 줄 다섯 — 가운데 딱지 · 값 칸 0x5dcc0 · 노랑 반원 두 쪽 */
export function MatchInfoRows({ lines, valueRows, areValueCellsHidden, isBob, imgTextOrigins }: MatchInfoRowsProps) {
  return (
    <>
      {/* 줄 다섯 — 가운데 딱지 (0x64d30 본문) */}
      {lines.map((line, index) => {
        const y = matchInfoRowY(index)
        return (
          <span key={line.label}>
            <img
              className={styles.layer}
              alt=""
              src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.labelBar.image)}
              style={{ left: MATCH_INFO_LAYOUT.labelBar.x, top: y }}
            />
            {/* 가운데 딱지 막대(이미지 18)도 116 과 같은 흰 막대다 — 글자는 팔레트 3(짙은 파랑)으로 구웠다 */}
            <FrameSprite
              folder={IMG_TEXT_FRAME}
              frame={line.labelFrame}
              origins={imgTextOrigins}
              x={MATCH_INFO_LAYOUT.labelBar.x}
              y={y + MATCH_INFO_LAYOUT.labelBar.textDy}
            />
          </span>
        )
      })}

      {/*
    값 칸 0x5dcc0 — 딱지 뒤에 칸 i = 0 … 9 (짝 유저 · 홀 CPU) 차례로. 유저 slt_frame 이미지 10 (16, y + 3) · CPU 뒤집어 (138, y − 3),
    펼치는 동안은 아랫줄 칸이 첫 줄 자리에서 떨어져 내려온다(`matchInfoValueCellDy`). 재굴림 중에는 안 그린다.
  */}
      {!areValueCellsHidden &&
        lines.map((line, index) => {
          const y = matchInfoRowY(index)
          const userY = y + MATCH_INFO_LAYOUT.valueCell.userDy + matchInfoValueCellDy(valueRows.unfold, 2 * index)
          const cpuY = y + MATCH_INFO_LAYOUT.valueCell.cpuDy + matchInfoValueCellDy(valueRows.unfold, 2 * index + 1)
          return (
            <span key={line.label}>
              <img
                className={styles.layer}
                alt=""
                src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
                style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: userY }}
              />
              <span
                className={styles.centeredText}
                data-testid={`경기정보-${line.label}-유저`}
                style={{
                  left: MATCH_INFO_LAYOUT.valueCell.userX,
                  top: userY + MATCH_INFO_LAYOUT.valueCell.textDy,
                  width: MATCH_INFO_LAYOUT.valueCell.width,
                }}
              >
                {line.user}
              </span>
              <img
                className={styles.layer}
                alt=""
                src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
                style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: cpuY, transform: 'scaleX(-1)' }}
              />
              <span
                className={styles.centeredText}
                data-testid={`경기정보-${line.label}-CPU`}
                style={{
                  left: MATCH_INFO_LAYOUT.valueCell.cpuX,
                  top: cpuY + MATCH_INFO_LAYOUT.valueCell.textDy,
                  width: MATCH_INFO_LAYOUT.valueCell.width,
                }}
              >
                {line.cpu}
              </span>
            </span>
          )
        })}

      {/* 노랑 반원 두 쪽 — 값 줄 0x5dcc0 이 다 펼쳤다고 돌려줬고([skin+0xe4]) 깜빡일 때만 (0x65078~0x65108) */}
      {valueRows.isReady && isBob && (
        <>
          <img
            className={styles.layer}
            alt=""
            src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
            style={{ left: MATCH_INFO_LAYOUT.halfCircle.leftX, top: MATCH_INFO_LAYOUT.halfCircle.y }}
          />
          <img
            className={styles.layer}
            alt=""
            src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
            style={{ left: MATCH_INFO_LAYOUT.halfCircle.rightX, top: MATCH_INFO_LAYOUT.halfCircle.y, transform: 'scaleX(-1)' }}
          />
        </>
      )}
    </>
  )
}

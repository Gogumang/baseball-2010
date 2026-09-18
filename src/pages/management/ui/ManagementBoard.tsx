import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  BOARD_COLOR, BOARD_POLYGON, MORALE_GAUGE_BACKGROUND, MORALE_LABEL_FRAME, NAME_BAND, STADIUM_BAND,
  STATUS_BOXES, backgroundFrameOf, moraleGaugeColumnsOf, moraleGaugeFrameOf,
} from '@/pages/management/lib/managementLayout'
import { StatusValues } from '@/pages/management/ui/StatusValues'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

const MODE_UI = '/sprites/mode_ui/frames'
const MODE_BACK = '/sprites/mode_back/frames'
const IMG_TEXT = '/sprites/img_text/frames'
const STATUS_FRAME = 11
const SCREEN_WIDTH = 240

interface ManagementBoardProps {
  readonly career: PlayerCareer
  readonly titleName: string
  readonly hour: number
}

/** 상태판 0x7d34c — 계단형 판 · 경기장 띠 · 이름/칭호 띠 · 사기 게이지 · 값 칸 · 메시지줄 */
export function ManagementBoard({ career, titleName, hour }: ManagementBoardProps) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const backOrigins = useFrameOrigins(MODE_BACK)
  const gauge = STATUS_BOXES.moraleGauge
  const columns = moraleGaugeColumnsOf(career.morale)
  const band = NAME_BAND
  const bandBottom = band.top + band.height - 1

  return (
    <>
      <svg className={styles.board} viewBox="0 0 240 320" shapeRendering="crispEdges">
        {/* 선을 픽셀 칸 가운데에 맞추려고 반 칸 옮긴다 (원본은 정수 좌표 픽셀에 긋는다) */}
        <polygon points={BOARD_POLYGON} transform="translate(0.5 0.5)" fill={BOARD_COLOR.fill} stroke={BOARD_COLOR.edge} strokeWidth={1} />
        {/* 위 세 변은 y+1 에 밝은 선, 아래 세 변은 y+1 에 어두운 선 (0x76724) */}
        <polyline points="0,55.5 141,55.5 160,36.5 240,36.5" transform="translate(0.5 0)" fill="none" stroke={BOARD_COLOR.highlight} />
        <polyline points="0,226.5 141,226.5 160,207.5 240,207.5" transform="translate(0.5 0)" fill="none" stroke={BOARD_COLOR.edge} />
        <rect x={0} y={STADIUM_BAND.top} width={SCREEN_WIDTH} height={STADIUM_BAND.height} fill={ORIGINAL_COLORS.black} />
        <rect x={0} y={band.top} width={SCREEN_WIDTH} height={band.height} fill={band.colors.outer} />
        <rect x={0} y={band.top + 1} width={SCREEN_WIDTH} height={band.height - 2} fill={band.colors.inner} />
        {Array.from({ length: 19 }, (_unused, index) => (
          <g key={index}>
            <rect x={band.split + index} y={bandBottom - index} width={1} height={1} fill={band.colors.outer} />
            <rect x={band.split + index + 1} y={bandBottom - index} width={1} height={1} fill={band.colors.light} />
          </g>
        ))}
        <rect x={band.split + 19} y={band.top + 1} width={SCREEN_WIDTH - band.split - 19} height={1} fill={band.colors.light} />
        <rect x={gauge.x} y={gauge.y} width={gauge.width} height={gauge.height} fill={MORALE_GAUGE_BACKGROUND} />
        <rect x={gauge.x + gauge.width} y={gauge.y + 1} width={1} height={gauge.height - 2} fill={MORALE_GAUGE_BACKGROUND} />
      </svg>

      <div className={styles.layer} style={{ left: STADIUM_BAND.imageLeft, top: STADIUM_BAND.imageTop, width: SCREEN_WIDTH - 1, height: STADIUM_BAND.imageHeight, overflow: 'hidden' }}>
        <FrameSprite folder={MODE_BACK} frame={backgroundFrameOf(hour)} origins={backOrigins} x={0} y={0} />
      </div>

      <div className={styles.nameText} style={{ left: band.nameBox.x, top: band.top, width: band.nameBox.width }}>{career.name}</div>
      <div className={styles.nameText} style={{ left: band.titleBox.x, top: band.top, width: band.titleBox.width }}>{titleName}</div>

      <FrameSprite folder={MODE_UI} frame={STATUS_FRAME} origins={uiOrigins} x={0} y={0} />
      {/* "사기" 20×10 을 박스 (33×15) 가운데에 */}
      <img className={styles.layer} style={{ left: STATUS_BOXES.moraleLabel.x + 6, top: STATUS_BOXES.moraleLabel.y + 3 }}
        src={`${IMG_TEXT}/${String(MORALE_LABEL_FRAME).padStart(3, '0')}.png`} alt="" />
      {Array.from({ length: columns }, (_unused, index) => (
        <img key={index} className={styles.layer} style={{ left: gauge.x + 1 + index, top: gauge.y + 1 }}
          src={`${MODE_UI}/${String(moraleGaugeFrameOf(career.morale)).padStart(3, '0')}.png`} alt="" />
      ))}

      <StatusValues career={career} />
    </>
  )
}

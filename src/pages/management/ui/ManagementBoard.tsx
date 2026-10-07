import type { ReactNode } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  BOARD_COLOR, BOARD_POLYGON, MORALE_GAUGE_BACKGROUND, MORALE_LABEL_FRAME, NAME_BAND, STADIUM_BAND,
  STATUS_BOXES, backgroundFrameOf, moraleGaugeColumnsOf, moraleGaugeFrameOf, nameBandSplitOf,
} from '@/pages/management/lib/managementLayout'
import { StatusValues } from '@/pages/management/ui/StatusValues'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

const MODE_UI = './sprites/mode_ui/frames'
const MODE_BACK = './sprites/mode_back/frames'
const IMG_TEXT = './sprites/img_text/frames'
const STATUS_FRAME = 11
const SCREEN_WIDTH = 240
/** 띠의 비스듬한 끝 — 19 칸 계단 (0x7cfc8) */
const BAND_SLOPE = 19

interface StatusBoardBaseProps {
  readonly hour: number
  /** 이름 띠가 꺾이는 x (`nameBandSplitOf`) */
  readonly nameBandSplit: number
  /** 사기 막대 값 — 나만의리그 0xa3a25(S) · 시즌 팀 레코드 +2 (0x7d768~0x7d798) */
  readonly morale: number
  /** 이름 띠 박스 1·2 에 얹는 것 (모드마다 다르다) */
  readonly nameContent: ReactNode
  /** 사기 이름표 · 막대(박스 0 · 1)의 y 보정 — 투수편(모드 3, 0x7b984)은 −3 (0x7d652 · 0x7d706) */
  readonly moraleOffsetY?: number
}

/**
 * 상태판 0x7d34c 의 모드 공통 부분 (직접 떴다, 0x7d34c~0x7d800):
 * ```
 * 0x76725([win+0x134])                         ; 계단형 판
 * 프레임 10 박스 0 검정 · 0x7b9ac(win, x+1, y+1, 0) ; 경기장 띠 (mode_back[시간대])
 * 0x7cfc8(win, 박스 1 ∪ 박스 2, nameBandSplit)   ; 이름 띠
 * 박스 1 · 박스 2                                ; nameContent — 모드마다 다르다
 * 0xba19d(프레임 11, 0, 0)                       ; 값 칸 바탕
 * 박스 0 img_text 84 "사기" (정렬 0x22) · 박스 1 #18216B 채움 + 오른쪽 세로줄 · 사기 × (w−1)/100 열 (mode_ui 12·13·14)
 * ```
 * 투수편(모드 3)은 사기 박스 둘을 y −3 에 그리고(`moraleOffsetY`) 그 아래에 스태미나 막대를 더한다(`PitcherStatusPanel`).
 */
export function StatusBoardBase({ hour, nameBandSplit, morale, nameContent, moraleOffsetY = 0 }: StatusBoardBaseProps) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const backOrigins = useFrameOrigins(MODE_BACK)
  const gauge = { ...STATUS_BOXES.moraleGauge, y: STATUS_BOXES.moraleGauge.y + moraleOffsetY }
  const moraleLabelY = STATUS_BOXES.moraleLabel.y + moraleOffsetY
  const columns = moraleGaugeColumnsOf(morale)
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
        {Array.from({ length: BAND_SLOPE }, (_unused, index) => (
          <g key={index}>
            <rect x={nameBandSplit + index} y={bandBottom - index} width={1} height={1} fill={band.colors.outer} />
            <rect x={nameBandSplit + index + 1} y={bandBottom - index} width={1} height={1} fill={band.colors.light} />
          </g>
        ))}
        <rect x={nameBandSplit + BAND_SLOPE} y={band.top + 1} width={SCREEN_WIDTH - nameBandSplit - BAND_SLOPE} height={1} fill={band.colors.light} />
        <rect x={gauge.x} y={gauge.y} width={gauge.width} height={gauge.height} fill={MORALE_GAUGE_BACKGROUND} />
        <rect x={gauge.x + gauge.width} y={gauge.y + 1} width={1} height={gauge.height - 2} fill={MORALE_GAUGE_BACKGROUND} />
      </svg>

      <div className={styles.layer} style={{ left: STADIUM_BAND.imageLeft, top: STADIUM_BAND.imageTop, width: SCREEN_WIDTH - 1, height: STADIUM_BAND.imageHeight, overflow: 'hidden' }}>
        <FrameSprite folder={MODE_BACK} frame={backgroundFrameOf(hour)} origins={backOrigins} x={0} y={0} />
      </div>

      {nameContent}

      <FrameSprite folder={MODE_UI} frame={STATUS_FRAME} origins={uiOrigins} x={0} y={0} />
      {/* "사기" 20×10 을 박스 (33×15) 가운데에 */}
      <img className={styles.layer} style={{ left: STATUS_BOXES.moraleLabel.x + 6, top: moraleLabelY + 3 }}
        src={`${IMG_TEXT}/${String(MORALE_LABEL_FRAME).padStart(3, '0')}.png`} alt="" />
      {Array.from({ length: columns }, (_unused, index) => (
        <img key={index} className={styles.layer} style={{ left: gauge.x + 1 + index, top: gauge.y + 1 }}
          src={`${MODE_UI}/${String(moraleGaugeFrameOf(morale)).padStart(3, '0')}.png`} alt="" />
      ))}
    </>
  )
}

interface ManagementBoardProps {
  readonly career: PlayerCareer
  readonly titleName: string
  readonly hour: number
  /** 0x7d34c 둘째 인자 [이벤트+0xb] — 메시지줄 경기 번호 −1 (`StatusValues`) */
  readonly isPreviousGame?: boolean
}

/** 상태판 0x7d34c (나만의리그 타자편) — 계단형 판 · 경기장 띠 · 이름/칭호 띠 · 사기 게이지 · 값 칸 · 메시지줄 */
export function ManagementBoard({ career, titleName, hour, isPreviousGame = false }: ManagementBoardProps) {
  const band = NAME_BAND
  return (
    <>
      <StatusBoardBase hour={hour} nameBandSplit={nameBandSplitOf(false)} morale={career.morale}
        nameContent={(
          <>
            <div className={styles.nameText} style={{ left: band.nameBox.x, top: band.top, width: band.nameBox.width }}>{career.name}</div>
            <div className={styles.nameText} style={{ left: band.titleBox.x, top: band.top, width: band.titleBox.width }}>{titleName}</div>
          </>
        )} />
      <StatusValues career={career} isPreviousGame={isPreviousGame} />
    </>
  )
}

import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEAMS } from '@/shared/config/original/teams'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { abilityChartFrameOf, abilityChartVerticesOf } from '@/pages/create-player/lib/teamSelectLayout'
import { ABILITY_TITLE, INFO_BOARD, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP, RADAR_CENTER, RADAR_RADIUS } from '@/pages/management/lib/basicInfoLayout'
import { TEAM_INFO_LEFT_ROWS, TEAM_NAME_FRAME_BASE } from '@/pages/season/lib/seasonTeamInfo'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

const IMG_TEXT = './sprites/img_text/frames'
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

/** mode_ui 프레임 3 박스 — 판 (21,176,197,83) · 이름표 1 (30,·,25) · 값 2 (60,·,81) · 이름표 3 (147,·,25) · 값 4 (176,·,32) */
const BOARD_WIDTH = 197
const COLUMNS = [
  { label: { x: 30, width: 25 }, value: { x: 60, width: 81 } },
  { label: { x: 147, width: 25 }, value: { x: 176, width: 32 } },
] as const
/** 로고 team_logo 77×76 — (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) */
const LOGO = { x: 120 - 38 - 0x3e, y: 160 - 38 - 0x32, width: 77, height: 76 } as const
/** ⚠️ 근사: 팀 이름 판(gfx+0x168 쪽 그림)의 자리는 안 풀었다 — 로고 가운데 아래에 둔다 */
const NAME_Y = LOGO.y + LOGO.height + 4
const LOGO_CENTER_X = LOGO.x + LOGO.width / 2

export interface SeasonTeamInfoScreenProps {
  readonly teamId: number
  /** 팀 레코드 +4 · +6 · +8 · +0xa — 팀 도형 0x5aefc 종류 0 */
  readonly teamAbilities: readonly number[]
  /** 정보 칸 일곱 줄 — `seasonTeamInfoRowsOf` */
  readonly rows: readonly TeamInfoRow[]
  readonly gamePoint?: number
  /** 0x4884 — 취소(−16) → 0xcd */
  readonly onBack: () => void
}

function valueOf(row: TeamInfoRow) {
  const { value } = row
  if (value.kind === '그림') return <img alt="" src={frameSrc(value.frame)} style={{ verticalAlign: 'middle' }} />
  if (value.kind === '숫자') {
    return (
      <>
        {value.value}
        {value.suffixFrame !== undefined && <img alt="" src={frameSrc(value.suffixFrame)} style={{ verticalAlign: 'middle' }} />}
      </>
    )
  }
  return value.text
}

/**
 * **구단정보 0xd5** — 카드 0x7ba44(로고 · 팀 이름 · ABILITY · 팀 도형) + 정보 칸 0x7c450(일곱 줄).
 * 값과 차례는 `pages/season/lib/seasonTeamInfo.ts` 머리 주석(직접 떴다).
 *
 * ⚠️ 근사: 카드 판(mode_ui 프레임 0 박스)·팀 이름 판·로고 위 덧그림 [gfx+0x168]("PLAYER" 딱지 쪽)은 그림 자리를 다 풀지 않았다.
 * 구장 줄의 흐르는 글 0x5a8c8 은 넘치면 잘린 한 줄로 둔다.
 */
export function SeasonTeamInfoScreen({ teamId, teamAbilities, rows, gamePoint = 0, onBack }: SeasonTeamInfoScreenProps) {
  const latestBack = useRef(onBack)
  latestBack.current = onBack
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return
      event.preventDefault()
      latestBack.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const team = TEAMS[teamId]
  const points = (list: readonly { readonly x: number; readonly y: number }[]) => list.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <RawScreen>
      <div role="group" aria-label="구단정보">
        {team !== undefined && (
          <img className={styles.layer} alt={team.name} src={team.logoUrl}
            style={{ left: LOGO.x, top: LOGO.y, width: LOGO.width, height: LOGO.height }} />
        )}
        <img className={styles.layer} alt="" data-testid="구단정보-팀이름" data-frame={TEAM_NAME_FRAME_BASE + teamId}
          src={frameSrc(TEAM_NAME_FRAME_BASE + teamId)}
          style={{ left: LOGO_CENTER_X, top: NAME_Y, transform: 'translateX(-50%)' }} />

        <img className={styles.layer} alt="" src={frameSrc(ABILITY_TITLE.frame)}
          style={{ left: ABILITY_TITLE.centerX, top: ABILITY_TITLE.y, transform: 'translateX(-50%)' }} />
        <svg className={styles.board} viewBox="0 0 240 320" shapeRendering="crispEdges">
          <polygon points={points(abilityChartFrameOf(RADAR_CENTER))} fill="none" stroke={ORIGINAL_COLORS.radarAxis} />
          <polygon points={points(abilityChartVerticesOf(RADAR_CENTER, teamAbilities, RADAR_RADIUS))}
            fill={ORIGINAL_COLORS.radarFill} fillOpacity={0xb4 / 0xff} stroke={ORIGINAL_COLORS.radarEdge} />
        </svg>

        <div className={styles.layer}
          style={{ left: INFO_BOARD.x, top: INFO_BOARD.y, width: BOARD_WIDTH, height: INFO_BOARD.height, background: INFO_BOARD.color }} />
        {rows.map((row, index) => {
          const column = COLUMNS[index < TEAM_INFO_LEFT_ROWS ? 0 : 1]
          const top = INFO_TOP + (index < TEAM_INFO_LEFT_ROWS ? index : index - TEAM_INFO_LEFT_ROWS) * INFO_ROW_STEP
          // 구장 줄은 값 칸 너비가 w × 2 − 14 (0x7c9b2)
          const width = row.value.kind === '흐르는글' ? column.value.width * 2 - 14 : column.value.width
          return (
            <div key={row.labelFrame} data-testid={`구단정보-줄-${index}`}>
              <img className={styles.layer} alt="" data-frame={row.labelFrame} src={frameSrc(row.labelFrame)}
                style={{ left: column.label.x + column.label.width, top: top + 3, transform: 'translateX(-100%)' }} />
              <div className={styles.infoValue} data-testid={`구단정보-값-${index}`}
                style={{ left: column.value.x, top, width, height: INFO_ROW_HEIGHT, color: ORIGINAL_COLORS.text }}>
                {valueOf(row)}
              </div>
            </div>
          )
        })}
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} />
    </RawScreen>
  )
}

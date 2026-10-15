import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FrameSprite, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { TEAMS } from '@/shared/config/original/teams'
import { SKIN_TICKER_CLIP_INSET, skinTickerTextXOf, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { abilityAxisMaximumLengthOf, abilityChartFrameOf } from '@/pages/create-player/lib/teamSelectLayout'
import { AbilityGrowthPolygon } from '@/pages/create-player/ui/AbilityGrowthPolygon'
import { ABILITY_TITLE, INFO_BOARD, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP, RADAR_CENTER, RADAR_RADIUS } from '@/pages/management/lib/basicInfoLayout'
import { TEAM_INFO_LEFT_ROWS } from '@/pages/season/lib/seasonTeamInfo'
import { SEASON_CARD_LOGO } from '@/pages/season/lib/seasonPlayerCard'
import { SeasonCardBadge, SteppedBoard } from '@/pages/season/ui/SeasonPlayerCard'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

/** mode_ui 프레임 3 박스 — 판 (21,176,197,83) · 이름표 1 (30,·,25) · 값 2 (60,·,81) · 이름표 3 (147,·,25) · 값 4 (176,·,32) */
const BOARD_WIDTH = 197
const COLUMNS = [
  { label: { x: 30, width: 25 }, value: { x: 60, width: 81 } },
  { label: { x: 147, width: 25 }, value: { x: 176, width: 32 } },
] as const

export interface SeasonTeamInfoScreenProps {
  readonly teamId: number
  /** 팀 레코드 +4 · +6 · +8 · +0xa — 팀 도형 0x5aefc 종류 0 */
  readonly teamAbilities: readonly number[]
  /** 정보 칸 일곱 줄 — `seasonTeamInfoRowsOf` */
  readonly rows: readonly TeamInfoRow[]
  readonly gamePoint?: number
  /** 딱지 [gfx+0x168] — 이 장면에서 팀 고르기 0xca · 트레이드 0xe4 를 거쳤는가 (`seasonPlayerCard.ts` 머리말) */
  readonly hasCardBadge?: boolean
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
 * 카드 0x7ba44 의 0xd5 갈래 (직접 떴다):
 * ```
 * 0x76725([gfx+0x134])                      ; 계단형 판 — 들어옴 0x5324 가 0x76705([장면+0xc4], 0x67, 0x38, 0) (0x53c6~0x53d4)
 * 로고 [gfx+0x140] (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) 0xba1d5(…, 0, 0, 0)   ; 0xd9 · 0xdc 밖이라 효과 0 (0x7bb20~0x7bb70)
 * [gfx+0x168] 이 있으면 로고 아래 · 위 딱지 — 팀 이름은 이 안에서만 그린다 (0x7bbca~0x7bdca, `SEASON_CARD_BADGE`)
 * mode_ui 8 (W/2 + 0x3a − w/2, H/2 − 0x6b) · img_text 159 (…, H/2 − 0x42 − 0x25)   ; 0x7bdce~0x7bea4
 * 0x5aefd(skin, W/2 + 0x3a, H/2 − 0x42 + 10, 종류 0, 팀 레코드, …, 0x1e)         ; 0x7becc 상태 0xd5 → 0x7bf9c
 * ```
 * 구장 줄은 흐르는 글 0x5a8c8 (`StadiumTicker`).
 */
export function SeasonTeamInfoScreen({
  teamId, teamAbilities, rows, gamePoint = 0, hasCardBadge = false, onBack,
}: SeasonTeamInfoScreenProps) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
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
      {/* 공통 앞그림 0xb810 — 0xd5 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label="구단정보">
        <SteppedBoard />
        {team !== undefined && (
          <img className={styles.layer} alt={team.name} data-testid="구단정보-로고" src={team.logoUrl}
            style={{ left: SEASON_CARD_LOGO.x, top: SEASON_CARD_LOGO.y, width: SEASON_CARD_LOGO.width, height: SEASON_CARD_LOGO.height }} />
        )}
        {team !== undefined && hasCardBadge && <SeasonCardBadge teamId={teamId} />}

        <FrameSprite folder={MODE_UI} frame={8} origins={modeUiOrigins} x={ABILITY_TITLE.plate.x} y={ABILITY_TITLE.plate.y} />
        <img className={styles.layer} alt="" src={frameSrc(ABILITY_TITLE.frame)}
          style={{ left: ABILITY_TITLE.centerX - 19, top: ABILITY_TITLE.y }} />
        <svg className={styles.board} viewBox="0 0 240 320" shapeRendering="crispEdges">
          <polygon points={points(abilityChartFrameOf(RADAR_CENTER))} fill="none" stroke={ORIGINAL_COLORS.radarAxis} />
          {/* 카드 0x7ba44 의 팀 갈래 0x7bf9c → 0x5aefd(…, 종류 0, 팀 레코드, 반지름 30) — 레이더 [skin+0xd4] 의 자라는 애니.
              들어옴 0x5324 가 +0xad = 0 으로 두어(0x534c~0x5356) 0 에서 자란다 */}
          <AbilityGrowthPolygon center={RADAR_CENTER} targets={teamAbilities} maximumLength={abilityAxisMaximumLengthOf(RADAR_RADIUS)} />
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
              {row.value.kind === '흐르는글'
                ? <StadiumTicker text={row.value.text} index={index} box={{ x: column.value.x, y: top + 2, width, height: INFO_ROW_HEIGHT }} />
                : (
                  <div className={styles.infoValue} data-testid={`구단정보-값-${index}`}
                    style={{ left: column.value.x, top, width, height: INFO_ROW_HEIGHT, color: ORIGINAL_COLORS.text }}>
                    {valueOf(row)}
                  </div>
                )}
            </div>
          )
        })}
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} slides={false} />
    </RawScreen>
  )
}

/**
 * 구장 줄 0x7ca7e — `0x5a8c8(skin, 글, 상자 x, y + 2, w, h, 1, 1, 1)`: 자르기 (x + 2, y, w − 4, h) ·
 * 글 왼쪽 = x + w − [skin+0x284] % (글폭 + w) · 그린 뒤 3 올린다 (`shared/lib/skinTicker` — 앱에 하나인 카운터).
 */
function StadiumTicker({ text, index, box }: {
  readonly text: string
  readonly index: number
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}) {
  const tick = useUpdateCounter()
  const counter = useSkinTickerCounter(tick)
  const textRef = useRef<HTMLSpanElement>(null)
  const [textWidth, setTextWidth] = useState(0)
  useLayoutEffect(() => setTextWidth(textRef.current?.offsetWidth ?? 0), [text])
  const clipLeft = box.x + SKIN_TICKER_CLIP_INSET
  return (
    <div className={styles.layer} data-testid={`구단정보-값-${index}`}
      style={{
        left: clipLeft, top: box.y, width: box.width - SKIN_TICKER_CLIP_INSET * 2, height: box.height, overflow: 'hidden',
      }}>
      <span ref={textRef} className={styles.infoValue}
        style={{
          left: skinTickerTextXOf(box.x, box.width, counter, textWidth) - clipLeft, top: 0, width: 'auto', whiteSpace: 'nowrap',
          color: ORIGINAL_COLORS.text,
        }}>
        {text}
      </span>
    </div>
  )
}

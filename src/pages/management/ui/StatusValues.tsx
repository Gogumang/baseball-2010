import { SpriteNumber } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_MONEY_UNIT } from '@/entities/career/model/playerCareer'
import { GAMES_PER_SEASON } from '@/entities/career/model/playerCareer'
import {
  MESSAGE_COLORS, SLASH_FRAME, STATUS_BOXES, STATUS_ICON_FRAMES, STATUS_ICON_STEP,
  moneyGlyphsOf, numberGlyphsOf, seasonGameOf,
} from '@/pages/management/lib/managementLayout'
import type { Box } from '@/pages/management/lib/managementLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

const IMG_TEXT = './sprites/img_text/frames'
const LABEL_HEIGHT = 10
/** 값 숫자는 박스 오른쪽 끝에서 2px 안쪽 */
const VALUE_INSET = 2
const YEAR_WIDTH = 9
const GAME_WIDTH = 19
const SLASH_WIDTH = 5
const DIGIT_STEP = 6

const imageOf = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`
const valueRight = (box: Box) => box.x + box.width - VALUE_INSET

/** 값 칸 네 개 · 이름표 · 메시지줄 "N년 G/45경기" · 상태 아이콘 */
export function StatusValues({ career }: { readonly career: PlayerCareer }) {
  const { popularity, money, reputation, salary, message, statusIcons } = STATUS_BOXES
  const messageTop = message.y
  const gameGlyphs = numberGlyphsOf(seasonGameOf(career.gamesPlayed))
  const totalGlyphs = numberGlyphsOf(GAMES_PER_SEASON)
  // 0x7d120: 박스 오른쪽 끝에서 dx 를 줄여 가며 오른쪽부터 "경기" → 45 → "/" → 경기 번호 → "년" → 연차
  const messageRight = message.x + message.width
  let dx = -5
  const gameLabelLeft = messageRight + dx - GAME_WIDTH
  dx -= GAME_WIDTH + 2
  const totalRight = messageRight + dx
  dx -= 2 * DIGIT_STEP + 4
  const slashLeft = messageRight + dx - SLASH_WIDTH
  dx -= SLASH_WIDTH + 2
  const gameRight = messageRight + dx
  dx -= String(seasonGameOf(career.gamesPlayed)).length * DIGIT_STEP + 7
  const yearLabelLeft = messageRight + dx - YEAR_WIDTH
  dx -= YEAR_WIDTH + 2
  const yearRight = messageRight + dx
  const icons = [
    career.eagleEyeGamesRemaining > 0 ? STATUS_ICON_FRAMES.effect : null,
    career.isInjured ? STATUS_ICON_FRAMES.injury : null,
    career.isSick ? STATUS_ICON_FRAMES.illness : null,
  ].filter((frame): frame is number => frame !== null)

  return (
    <>
      {STATUS_BOXES.labels.map((label) => (
        <img key={label.frame} className={styles.layer} src={imageOf(label.frame)} alt=""
          style={{ right: 240 - (label.x + label.width), top: label.y + Math.trunc((label.height - LABEL_HEIGHT + 1) / 2) }} />
      ))}
      <SpriteNumber glyphs={numberGlyphsOf(career.popularity)} right={valueRight(popularity)} boxTop={popularity.y} boxHeight={popularity.height} />
      <SpriteNumber glyphs={moneyGlyphsOf(career.money)} right={valueRight(money)} boxTop={money.y} boxHeight={money.height} />
      <SpriteNumber glyphs={numberGlyphsOf(career.reputation)} right={valueRight(reputation)} boxTop={reputation.y} boxHeight={reputation.height} />
      <SpriteNumber glyphs={moneyGlyphsOf(career.salary * ORIGINAL_MONEY_UNIT)} right={valueRight(salary)} boxTop={salary.y} boxHeight={salary.height} />

      <svg className={styles.board} viewBox="0 0 240 320" shapeRendering="crispEdges">
        <rect x={message.x} y={message.y} width={message.width} height={message.height} fill={MESSAGE_COLORS.fill} />
        <rect x={0} y={221} width={105} height={1} fill={MESSAGE_COLORS.edge} />
        {Array.from({ length: 15 }, (_unused, index) => (
          <g key={index}>
            <rect x={105} y={220 - index} width={index} height={1} fill={MESSAGE_COLORS.fill} />
            <rect x={105 + index} y={220 - index} width={1} height={1} fill={MESSAGE_COLORS.edge} />
          </g>
        ))}
      </svg>
      <img className={styles.layer} src="./sprites/management/label_yellow_335.png" alt="" style={{ left: gameLabelLeft, top: messageTop + 3 }} />
      <SpriteNumber glyphs={totalGlyphs} right={totalRight} boxTop={messageTop} boxHeight={message.height} />
      <SpriteNumber glyphs={[{ frame: SLASH_FRAME, width: SLASH_WIDTH - 1 }]} right={slashLeft + SLASH_WIDTH} boxTop={messageTop} boxHeight={message.height} />
      <SpriteNumber glyphs={gameGlyphs} right={gameRight} boxTop={messageTop} boxHeight={message.height} />
      <img className={styles.layer} src="./sprites/management/label_yellow_334.png" alt="" style={{ left: yearLabelLeft, top: messageTop + 3 }} />
      <SpriteNumber glyphs={numberGlyphsOf(career.season)} right={yearRight} boxTop={messageTop} boxHeight={message.height} />

      {icons.map((frame, index) => (
        <img key={frame} className={styles.layer} src={`./sprites/mode_ui/frames/${String(frame).padStart(3, '0')}.png`} alt=""
          style={{ left: statusIcons.x + index * STATUS_ICON_STEP, top: statusIcons.y }} />
      ))}
    </>
  )
}

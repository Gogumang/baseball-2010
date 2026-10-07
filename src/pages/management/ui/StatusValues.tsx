import { SpriteNumber } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_MONEY_UNIT } from '@/entities/career/model/playerCareer'
import { GAMES_PER_SEASON, hasSkill, isSkillEquipped } from '@/entities/career/model/playerCareer'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import {
  MESSAGE_COLORS, SLASH_FRAME, STATUS_BOXES,
  messageGameNumberOf, messageLineLayoutOf, moneyGlyphsOf, numberGlyphsOf,
} from '@/pages/management/lib/managementLayout'
import type { Box } from '@/pages/management/lib/managementLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import {
  HELPLESSNESS_SKILL_ID, LUCK_SKILL_ID, StatusIconRow, statusIconFramesFrom,
} from '@/pages/management/ui/StatusIconRow'
import type { StatusIconState } from '@/pages/management/ui/StatusIconRow'

const IMG_TEXT = './sprites/img_text/frames'
const LABEL_HEIGHT = 10
/** 값 숫자는 박스 오른쪽 끝에서 2px 안쪽 */
const VALUE_INSET = 2
/** 프레임 11 박스 2~5 의 이름표 — 표 0xd4880[1..4] (327 인기도 · 302 소지금 · 331 평판 · 332 연봉) */
export const NARI_LAST_LABEL_FRAME = 332
const SCREEN_WIDTH = 240

/** 상태 아이콘 줄의 조건 — 타자 커리어에서 읽는다 (그리기는 `StatusIconRow`) */
export function statusIconStateOf(career: PlayerCareer): StatusIconState {
  return {
    isLuckEquipped: isSkillEquipped(career, LUCK_SKILL_ID),
    eagleEyeGamesRemaining: career.eagleEyeGamesRemaining,
    isSick: career.isSick,
    isInjured: career.isInjured,
    hasHelplessness: hasSkill(career, HELPLESSNESS_SKILL_ID),
  }
}

export function statusIconFramesOf(career: PlayerCareer): readonly number[] {
  return statusIconFramesFrom(statusIconStateOf(career))
}

const imageOf = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`
export const valueRightOf = (box: Box, ox = -VALUE_INSET) => box.x + box.width + ox

/**
 * 이름표 넷 — 0x7d9c6~0x7dac8: 박스 2+k 에 img_text 0xd4880[k+1] 을 정렬 0x24(오른쪽 · 세로 가운데 올림)로.
 * 시즌(0x7b998)이고 k == 3 이면 0xd4880[4] 대신 **227 "관중"** 을 박스 5 에 (0x7d9d2~0x7da22).
 */
export function StatusLabels({ lastLabelFrame = NARI_LAST_LABEL_FRAME }: { readonly lastLabelFrame?: number }) {
  return (
    <>
      {STATUS_BOXES.labels.map((label, index) => {
        const frame = index === STATUS_BOXES.labels.length - 1 ? lastLabelFrame : label.frame
        return (
          <img key={index} className={styles.layer} src={imageOf(frame)} alt=""
            style={{ right: SCREEN_WIDTH - (label.x + label.width), top: label.y + Math.trunc((label.height - LABEL_HEIGHT + 1) / 2) }} />
        )
      })}
    </>
  )
}

/**
 * 메시지줄 — 박스 10 을 #12307E 로 채우고(0x7dc58~0x7dc88) 아래 선·비스듬한 끝(0x7dc8c~0x7dd34)을 그은 뒤
 * 0x7d120 이 "N년 G/45경기" 를 오른쪽부터 찍는다 (`messageLineLayoutOf`).
 */
export function MessageLine({ year, game }: { readonly year: number; readonly game: number }) {
  const { message } = STATUS_BOXES
  const layout = messageLineLayoutOf(game)
  return (
    <>
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
      <img className={styles.layer} src="./sprites/management/label_yellow_335.png" alt="" style={{ left: layout.gameLabelLeft, top: message.y + 3 }} />
      <SpriteNumber glyphs={numberGlyphsOf(GAMES_PER_SEASON)} right={layout.totalRight} boxTop={message.y} boxHeight={message.height} />
      <img className={styles.layer} src={`./sprites/num/${String(SLASH_FRAME).padStart(3, '0')}.png`} alt=""
        style={{ left: layout.slashLeft, top: layout.slashTop }} />
      <SpriteNumber glyphs={numberGlyphsOf(game)} right={layout.gameRight} boxTop={message.y} boxHeight={message.height} />
      <img className={styles.layer} src="./sprites/management/label_yellow_334.png" alt="" style={{ left: layout.yearLabelLeft, top: message.y + 3 }} />
      <SpriteNumber glyphs={numberGlyphsOf(year)} right={layout.yearRight} boxTop={message.y} boxHeight={message.height} />
    </>
  )
}

/** 값 칸 네 개 · 이름표 · 메시지줄 "N년 G/45경기" · 상태 아이콘 */
export function StatusValues({ career }: { readonly career: PlayerCareer }) {
  const { popularity, money, reputation, salary } = STATUS_BOXES
  const game = messageGameNumberOf(leagueDayCounterOf(career), career.postseason !== null)

  return (
    <>
      <StatusLabels />
      <SpriteNumber glyphs={numberGlyphsOf(career.popularity)} right={valueRightOf(popularity)} boxTop={popularity.y} boxHeight={popularity.height} />
      <SpriteNumber glyphs={moneyGlyphsOf(career.money)} right={valueRightOf(money)} boxTop={money.y} boxHeight={money.height} />
      <SpriteNumber glyphs={numberGlyphsOf(career.reputation)} right={valueRightOf(reputation)} boxTop={reputation.y} boxHeight={reputation.height} />
      <SpriteNumber glyphs={moneyGlyphsOf(career.salary * ORIGINAL_MONEY_UNIT)} right={valueRightOf(salary)} boxTop={salary.y} boxHeight={salary.height} />
      <MessageLine year={career.season} game={game} />
      <StatusIconRow state={statusIconStateOf(career)} />
    </>
  )
}

import { SpriteNumber } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_MONEY_UNIT } from '@/entities/career/model/playerCareer'
import { GAMES_PER_SEASON, hasSkill, isSkillEquipped } from '@/entities/career/model/playerCareer'
import {
  MESSAGE_COLORS, SLASH_FRAME, STATUS_BOXES, STATUS_ICON_STEP,
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

const LUCK_SKILL_ID = 6
const HELPLESSNESS_SKILL_ID = 5

/**
 * 상태 아이콘 줄 — 상태판 0x7d34c 끝(0x7dd46~0x7df92). mode_ui 프레임 11 박스 11 = (4,45,20,19) 에서 시작해
 * 하나 그릴 때마다 x 를 폭 + 2 = 22 옮긴다. 그림은 mode_ui 프레임을 0xb9e05 로 박스 가운데(0x22).
 * 차례·조건(모드 2 시즌이면 ①④⑤ 를 건너뛴다 — 나만의리그 관리 화면에선 모두 본다):
 *   ① 91 네잎클로버 — 스킬 6 "행운" **장착**(0xa4bf8, 0x7dd74)
 *   ② 85 이글아이 — 선수 +0x54(이글아이 남은 경기) > 0. ⚠️ 원본은 이 칸에 남은 경기 수를 0xba719(박스, 0, 값, 기준 0,
 *      num 그림, 정렬 0x44)로 겹쳐 찍는다 — 숫자 글꼴·자간을 아직 안 읽어 웹은 그림만 둔다(미해결).
 *   ③ 86 주사기 — +5(질병 종류) > 0
 *   ④ 87 뼈 — +0x1b5(부상 남은 기간) > 0
 *   ⑤ 88 우울한 얼굴 — 스킬 5 "무력감" **보유**(0xa3a74, 0x7df4a) — 장착이 아니라 보유 비트다
 * 예전 웹은 부상에 86, 질병에 88 을 붙였는데 88 은 무력감 표시라 바로잡는다 (86·87 은 G 2-2·4-4 의 칸 뜻대로).
 */
export function statusIconFramesOf(career: PlayerCareer): readonly number[] {
  return [
    isSkillEquipped(career, LUCK_SKILL_ID) ? 91 : null,
    career.eagleEyeGamesRemaining > 0 ? 85 : null,
    career.isSick ? 86 : null,
    career.isInjured ? 87 : null,
    hasSkill(career, HELPLESSNESS_SKILL_ID) ? 88 : null,
  ].filter((frame): frame is number => frame !== null)
}

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
  const icons = statusIconFramesOf(career)

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

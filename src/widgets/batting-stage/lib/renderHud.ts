import { placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { ORIGINAL_COLORS, UI_COLORS } from '@/shared/config/design'

/**
 * 경기 HUD — binary.mod 0x373d0 (position-re 2차, 바이트 확인).
 * game_ui 프레임 0 을 (6,6) 에 그리고, 그 프레임의 박스가 곧 배치표다 (아래 좌표는 박스 + (6,6)).
 *   배경: 검정 (5,5,82,50) 위에 #335fcd (6,6,80,48)
 *   팀 줄: 위 (8,21,36,14) · 아래 (8,38,36,14) #222854, 공격 팀 줄 왼쪽에 #ffe500 막대
 *   팀 아이콘: (13,23) · (13,40) — team_logo_ini
 *   베이스: 1루 (68,14) · 2루 (59,9) · 3루 (50,14), 주자 있으면 파트 6 (빈 베이스 파트 5 는 프레임에 있다)
 *   램프: S 파트 13 (58,24)(67,24) · B 파트 14 (58,34)(67,34)(76,34) · O 파트 15 (58,44)(67,44)
 *   이닝: 박스 0 (15,8,10,9) — "회" 글자 앞
 *   점수: 숫자 프레임 20~, 자간 −3, 아래 줄은 y+3 (점검 에이전트) · 공격 막대 높이 h−2 · 위 줄 = 먼저 공격(원정)
 * **추정**: 숫자 글꼴이 num.pzx 라는 것, 점수 오른쪽 정렬, 새 램프 확대 연출(0x37828)은 없음
 */
export interface HudState {
  readonly inning: number
  readonly half: string
  readonly ourScore: number
  readonly opponentScore: number
  readonly balls: number
  readonly strikes: number
  readonly outs: number
  readonly bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean }
  readonly ourLogoUrl: string
  readonly opponentLogoUrl: string
  /** 펜스 팀 아이콘용 팀 번호 — 없으면 11 번 아이콘 (원본도 모드 5·6 은 11) */
  readonly ourTeamId?: number
  readonly opponentTeamId?: number
}

const HUD_FRAMES = './sprites/game_ui/frames'
const HUD_ORIGIN = { x: 6, y: 6 }
const PART = (index: number) => `./sprites/game_ui/${String(index).padStart(3, '0')}.png`

const ROW_TOP = { x: 8, y: 21, width: 36, height: 14 }
const ROW_BOTTOM = { x: 8, y: 38, width: 36, height: 14 }
const ROW_COLOR = UI_COLORS.hudRow
const OFFENSE_BAR_COLOR = UI_COLORS.hudOffense
const OFFENSE_BAR_WIDTH = 3
const LOGO_OFFSET = { x: 5, y: 2 }

const BASE_LIT_PART = 6
const BASES = { first: { x: 68, y: 14 }, second: { x: 59, y: 9 }, third: { x: 50, y: 14 } } as const

const LAMP_STEP = 9
const LAMPS = [
  { part: 13, x: 58, y: 24, key: 'strikes' },
  { part: 14, x: 58, y: 34, key: 'balls' },
  { part: 15, x: 58, y: 44, key: 'outs' },
] as const

const INNING_BOX = { x: 15, y: 8, width: 10 }
const SCORE_DIGITS_START = 20
const SCORE_LETTER_SPACING = -3
const BOTTOM_ROW_SCORE_OFFSET_Y = 3
const INNING_DIGITS_START = 0

export function drawHud(context: CanvasRenderingContext2D, hud: HudState): void {
  context.fillStyle = ORIGINAL_COLORS.black
  context.fillRect(5, 5, 82, 50)
  context.fillStyle = ORIGINAL_COLORS.boardFill
  context.fillRect(6, 6, 80, 48)

  // 위 줄 = 원정(초 공격), 아래 줄 = 홈(말 공격) — 플레이어 팀은 홈이다
  const isHomeBatting = hud.half === '말'
  drawTeamRow(context, ROW_TOP, hud.opponentLogoUrl, hud.opponentScore, !isHomeBatting, 0)
  drawTeamRow(context, ROW_BOTTOM, hud.ourLogoUrl, hud.ourScore, isHomeBatting, BOTTOM_ROW_SCORE_OFFSET_Y)

  const frame = placedFrame(HUD_FRAMES, 0)
  if (frame !== null) context.drawImage(frame.image, HUD_ORIGIN.x + frame.offsetX, HUD_ORIGIN.y + frame.offsetY)

  for (const base of ['first', 'second', 'third'] as const) {
    if (!hud.bases[base]) continue
    const image = sprite(PART(BASE_LIT_PART))
    if (image !== null) context.drawImage(image, BASES[base].x, BASES[base].y)
  }

  for (const lamp of LAMPS) {
    const image = sprite(PART(lamp.part))
    if (image === null) continue
    for (let index = 0; index < hud[lamp.key]; index += 1) {
      context.drawImage(image, lamp.x + index * LAMP_STEP, lamp.y)
    }
  }

  drawNumber(context, hud.inning, INNING_BOX.x + INNING_BOX.width, INNING_BOX.y, INNING_DIGITS_START)
}

function drawTeamRow(
  context: CanvasRenderingContext2D,
  row: { x: number; y: number; width: number; height: number },
  logoUrl: string,
  score: number,
  isBatting: boolean,
  scoreOffsetY: number,
): void {
  context.fillStyle = ROW_COLOR
  context.fillRect(row.x, row.y, row.width, row.height)
  if (isBatting) {
    context.fillStyle = OFFENSE_BAR_COLOR
    context.fillRect(row.x + 1, row.y + 1, OFFENSE_BAR_WIDTH, row.height - 2)
  }
  const logo = sprite(logoUrl)
  if (logo !== null) context.drawImage(logo, row.x + LOGO_OFFSET.x, row.y + LOGO_OFFSET.y)
  drawNumber(context, score, row.x + row.width - 1, row.y + scoreOffsetY, SCORE_DIGITS_START, SCORE_LETTER_SPACING)
}

/** ui/num.pzx 숫자를 오른쪽 끝(rightX)에 맞춰 그린다 */
function drawNumber(
  context: CanvasRenderingContext2D,
  value: number,
  rightX: number,
  y: number,
  start: number,
  spacing = 0,
): void {
  const digits = String(Math.max(0, Math.trunc(value)))
  const images = [...digits].map((digit) => sprite(`./sprites/num/${String(start + Number(digit)).padStart(3, '0')}.png`))
  if (images.some((image) => image === null)) return
  const width = images.reduce((total, image) => total + (image?.width ?? 0) + spacing, -spacing)
  let x = rightX - width
  for (const image of images) {
    if (image === null) continue
    context.drawImage(image, x, y)
    x += image.width + spacing
  }
}

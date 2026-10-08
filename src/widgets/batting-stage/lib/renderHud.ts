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
 *
 * **확정** (F-3 · 3-1): 숫자 글꼴 = `ui/num.pzx` (0x3740c → 0x330f0), 점수 **오른쪽 정렬**
 * (0x3756c 정렬 0x24 = 오른쪽+세로 가운데, 아래 줄은 오른쪽만),
 * 그리고 **새 램프 확대 연출이 있다** (0x37828, `stepLampZoom`) — 예전 주석의 "없음" 은 틀렸다.
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
  /**
   * 사람 팀이 앉은 측 (0 = 선공 · 1 = 후공, 경기 상태 `playerSide`). HUD 위 줄은 **측 0(선공)**, 아래 줄은 측 1 이다
   * (0x373d0 37516~37548 위 = 로고 +0x1054 · 0xb69b1(st, 0) / 375e8~37620 아래 = +0x1058 · 0xb69b1(st, 1)).
   * 안 주면 1(사람 = 후공) — 예전 그림(위 = 상대)과 같다.
   */
  readonly playerSide?: number
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
/**
 * 램프 칸 수 = 개수를 **잘라서** 센다 — 0x376a4~0x376d0 이 [min(st[4], 2), min(st[5], 3), min(st[6], 2)] 를 칸 표로 만든다.
 * (스트라이크 3 · 아웃 3 이 되는 순간에도 칸은 둘만 켜진다)
 */
const LAMPS = [
  { part: 13, x: 58, y: 24, key: 'strikes', max: 2 },
  { part: 14, x: 58, y: 34, key: 'balls', max: 3 },
  { part: 15, x: 58, y: 44, key: 'outs', max: 2 },
] as const

/** 램프 한 종류의 칸 수 (0x376a4~0x376d0 — 위로만 자른다) */
export function lampCountOf(lamp: { readonly max: number }, count: number): number {
  return count < lamp.max ? count : lamp.max
}

/**
 * 새 램프 확대 연출 (0x37730~0x37892, 직접 떴다). 종류 k 마다 장면에 "지난 칸 수" +0x17d4~6 · 타이머 +0x17d7~9 를 둔다.
 * ```
 * c = 자른 칸 수 (lampCountOf)
 * c ≤ 0 (0x37736)        → 아무것도 안 한다 — 지난 칸 수도 타이머도 그대로(타이머가 줄지도 않는다)
 * c > 0 이고 지난 ≠ c     → 타이머 = 5 · 지난 = c (0x37744)
 * 칸 i = 0..c−1          → 타이머 > 0 이고 i == c−1 이면 효과 0x10 · 배율 z = 타이머로 그리고 타이머 −1 (0x37828~0x37858)
 * ```
 * 그래서 새 램프가 5·4·3·2·1 배로 다섯 그림 동안 줄어든다. 확대 자리는 **상자** w·h 로 `(x − ((z−1)·w >> 1), y − ((z−1)·h >> 1))`.
 * 타석 시작 0xd 진입(0x48f08)은 **타이머만** 0 으로 지운다 — 지난 칸 수는 경기 적재 0x48658(48cc2~48cf2)이 한 번 채울 뿐이다.
 * 원본 버그 그대로: 칸이 0 으로 내려갔다 같은 수로 다시 켜지면(지난 1 → 0 → 1) 확대가 없다.
 * 정수 배 확대라는 것은 R6 3b 확정 (프레임 그리기 0x944b5 의 e == 0x10, b > 0 → 좌표·크기 ×b).
 */
const LAMP_ZOOM_TIMER = 5
/** 램프 상자 크기 — game_ui 프레임 0 의 상자 7~13 이 모두 7×7 (boxes.json) */
const LAMP_BOX_SIZE = 7

type LampKey = (typeof LAMPS)[number]['key']

/** 한 종류의 기억 — 지난 칸 수 · 다음 그림의 타이머 · 이번 틱에 쓴 배율(같은 틱에 두 번 그려도 한 그림으로 센다) */
export interface LampZoomMemory {
  readonly last: number
  readonly timer: number
  readonly tick: number
  readonly zoom: number
}

export const INITIAL_LAMP_ZOOM: LampZoomMemory = { last: 0, timer: 0, tick: -1, zoom: 0 }

/**
 * 한 그림치 램프 확대 걸음. `zoom` > 0 이면 마지막 칸을 그 배율로 그린다(1 이면 보통과 같다).
 * `tick` 이 지난 그림보다 작으면 타석이 새로 열린 것(0xd 진입)이라 타이머만 지운다.
 */
export function stepLampZoom(memory: LampZoomMemory, count: number, tick: number): LampZoomMemory {
  if (tick === memory.tick) return memory
  let { last, timer } = memory
  if (tick < memory.tick) timer = 0
  if (count <= 0) return { last, timer, tick, zoom: 0 }
  if (last !== count) {
    timer = LAMP_ZOOM_TIMER
    last = count
  }
  const zoom = timer
  return { last, timer: timer > 0 ? timer - 1 : 0, tick, zoom }
}

const lampZoom: Record<LampKey, LampZoomMemory> = {
  strikes: INITIAL_LAMP_ZOOM,
  balls: INITIAL_LAMP_ZOOM,
  outs: INITIAL_LAMP_ZOOM,
}

const INNING_BOX = { x: 15, y: 8, width: 10 }
const SCORE_DIGITS_START = 20
const SCORE_LETTER_SPACING = -3
const BOTTOM_ROW_SCORE_OFFSET_Y = 3
const INNING_DIGITS_START = 0

/** `tick` = 타석이 열린 뒤 흐른 틱. 새 램프 확대 연출이 이걸로 z 를 센다 */
export function drawHud(context: CanvasRenderingContext2D, hud: HudState, tick: number): void {
  context.fillStyle = ORIGINAL_COLORS.black
  context.fillRect(5, 5, 82, 50)
  context.fillStyle = ORIGINAL_COLORS.boardFill
  context.fillRect(6, 6, 80, 48)

  // 위 줄 = 측 0(선공, 초 공격), 아래 줄 = 측 1(후공, 말 공격). 공격 막대는 st[9] == 0 이면 위, == 1 이면 아래 (0x374e0 · 0x375b2)
  const rows = hudRowsOf(hud)
  drawTeamRow(context, ROW_TOP, rows.top.logoUrl, rows.top.score, rows.top.isBatting, 0)
  drawTeamRow(context, ROW_BOTTOM, rows.bottom.logoUrl, rows.bottom.score, rows.bottom.isBatting, BOTTOM_ROW_SCORE_OFFSET_Y)

  const frame = placedFrame(HUD_FRAMES, 0)
  if (frame !== null) context.drawImage(frame.image, HUD_ORIGIN.x + frame.offsetX, HUD_ORIGIN.y + frame.offsetY)

  for (const base of ['first', 'second', 'third'] as const) {
    if (!hud.bases[base]) continue
    const image = sprite(PART(BASE_LIT_PART))
    if (image !== null) context.drawImage(image, BASES[base].x, BASES[base].y)
  }

  for (const lamp of LAMPS) {
    const image = sprite(PART(lamp.part))
    const count = lampCountOf(lamp, hud[lamp.key])
    lampZoom[lamp.key] = stepLampZoom(lampZoom[lamp.key], count, tick)
    const scale = lampZoom[lamp.key].zoom
    if (image === null) continue
    for (let index = 0; index < count; index += 1) {
      const x = lamp.x + index * LAMP_STEP
      // 가장 새 램프만 배율 z 로 그린다. z == 1 이면 보통 그리기와 같은 자리·크기다
      if (index !== count - 1 || scale <= 1) {
        context.drawImage(image, x, lamp.y)
        continue
      }
      drawZoomedLamp(context, image, x, lamp.y, scale)
    }
  }

  drawNumber(context, hud.inning, INNING_BOX.x + INNING_BOX.width, INNING_BOX.y, INNING_DIGITS_START)
}

/** HUD 한 줄에 그릴 것 — 팀 로고 · 점수 · 공격 막대 */
export interface HudRow {
  readonly logoUrl: string
  readonly score: number
  readonly isBatting: boolean
}

const PLAYER_SIDE_LAST_BAT = 1

/** 위 줄 = 측 0(선공), 아래 줄 = 측 1(후공). 사람 팀이 어느 측인지는 `playerSide` 로 고른다 */
export function hudRowsOf(hud: HudState): { readonly top: HudRow; readonly bottom: HudRow } {
  const ours = { logoUrl: hud.ourLogoUrl, score: hud.ourScore }
  const theirs = { logoUrl: hud.opponentLogoUrl, score: hud.opponentScore }
  const isPlayerFirst = (hud.playerSide ?? PLAYER_SIDE_LAST_BAT) !== PLAYER_SIDE_LAST_BAT
  const isSide1Batting = hud.half === '말'
  return {
    top: { ...(isPlayerFirst ? ours : theirs), isBatting: !isSide1Batting },
    bottom: { ...(isPlayerFirst ? theirs : ours), isBatting: isSide1Batting },
  }
}

/** 정수 배 확대 — 자리 `(x − ((z−1)·w >> 1), y − ((z−1)·h >> 1))` 는 상자 w·h 로(0x37828~0x3784c), 크기 `w·z × h·z` (0x944b5) */
function drawZoomedLamp(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  scale: number,
): void {
  const wasSmoothing = context.imageSmoothingEnabled
  context.imageSmoothingEnabled = false
  context.drawImage(
    image,
    x - (((scale - 1) * LAMP_BOX_SIZE) >> 1),
    y - (((scale - 1) * LAMP_BOX_SIZE) >> 1),
    image.width * scale,
    image.height * scale,
  )
  context.imageSmoothingEnabled = wasSmoothing
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

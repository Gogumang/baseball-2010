import { placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { ORIGINAL_COLORS, UI_COLORS } from '@/shared/config/design'
import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * 경기 HUD — binary.mod 0x373d0 (position-re 2차, 바이트 확인).
 * game_ui 프레임 0 을 (6,6) 에 그리고, 그 프레임의 박스가 곧 배치표다 (아래 좌표는 박스 + (6,6)).
 *   배경: 검정 (5,5,82,50) 위에 #335fcd (6,6,80,48) — 둘 다 둥글기 5 둥근 칠 (`roundFillRectsOf`)
 *   팀 줄: 위 (8,21,36,14) · 아래 (8,38,36,14) #222854 둥글기 3, 공격 팀 줄 왼쪽에 #ffe500 막대 (x+1, y+2, 3, h−2)
 *   팀 아이콘: (13,23) · (13,40) — team_logo_ini
 *   베이스: 1루 (68,14) · 2루 (59,9) · 3루 (50,14), 주자 있으면 파트 6 (빈 베이스 파트 5 는 프레임에 있다)
 *   램프: S 파트 13 (58,24)(67,24) · B 파트 14 (58,34)(67,34)(76,34) · O 파트 15 (58,44)(67,44)
 *   이닝: 박스 0 (15,8,10,9) 오른끝 — "회" 글자 앞, 0xba689 → 0xba51c (`inningGlyphsOf`) 자간 0 · 정렬 4 · 상자 0×0
 *   점수: 숫자 프레임 20~ 를 0xba51c 로 (`alignedNumberGlyphsOf`) — 자간 1 · ox −3, 아래 줄은 y+3 · 공격 막대 높이 h−2 · 위 줄 = 먼저 공격(원정)
 *
 * **확정** (F-3 · 3-1): 숫자 글꼴 = `ui/num.pzx` (0x3740c → 0x330f0), 점수 **오른쪽 정렬**
 * (0x3756c 정렬 0x24 = 오른쪽+세로 가운데, 아래 줄은 오른쪽만),
 * 그리고 **새 램프 확대 연출이 있다** (램프 그리기 0x373d0 안 갈래 0x37828~0x37858, `stepLampZoom`) — 예전 주석의 "없음" 은 틀렸다.
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
  /** 펜스 팀 아이콘 · 루상 주자 팔레트용 팀 번호 — 없으면 11 번 아이콘. 모드 5·6(미션)은 번호가 있어도 펜스는 11 (0x77974 77ae4~77af0) */
  readonly ourTeamId?: number
  readonly opponentTeamId?: number
  /**
   * 사람 팀이 앉은 측 (0 = 선공 · 1 = 후공, 경기 상태 `playerSide`). HUD 위 줄은 **측 0(선공)**, 아래 줄은 측 1 이다
   * (0x373d0 37516~37548 위 = 로고 +0x1054 · 0xb69b1(st, 0) / 375e8~37620 아래 = +0x1058 · 0xb69b1(st, 1)).
   * 안 주면 1(사람 = 후공) — 예전 그림(위 = 상대)과 같다.
   */
  readonly playerSide?: number
  /**
   * 루상 주자의 **경기용 주력** 0xb570d(ctx, 3, 주자 선수, 1, 90, 1) — 상태 0xe 의 주루 칸(0x35b94 35f74, `runPipDrawsOf`)이 쓴다.
   * 타자편 · 팀 경기 화면이 경기 상태의 주자 신원(`GameState.runners`, 원본 주자 목록)대로 채운다(내 선수면 내 능력치).
   * 타자 미션도 신원(`MissionRun.runners`)대로 채운다. 홈런더비는 주자가 없다 — 없는 루는 칸을 안 그린다
   */
  readonly runnerRunAbilities?: Partial<Record<'first' | 'second' | 'third', number>>
  /**
   * 경기 st[0x15 + i] — 이번 공에 **도루를 출발한 주자**의 루(1~3, 0xa9bd4 a9c30 이 세우고 0xf 진입 0x3d954 가 지운다).
   * 0x35b94 는 그 루의 주자를 안 그리고 애니도 안 돌린다. 안 주면 아무도 안 뛰었다
   */
  readonly hiddenRunnerBases?: readonly number[]
}

const HUD_FRAMES = './sprites/game_ui/frames'
const HUD_ORIGIN = { x: 6, y: 6 }
const PART = (index: number) => `./sprites/game_ui/${String(index).padStart(3, '0')}.png`

const BOARD = { x: 5, y: 5, width: 82, height: 50 }
const BOARD_ROUND = 5
const ROW_ROUND = 3
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
 * 원본 버그(B-87): 칸이 0 으로 내려갔다 같은 수로 다시 켜지면(지난 1 → 0 → 1) 확대가 없다 — 고친 길은 0 에서 지난 칸 수를 지운다.
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
  // B-87 고친 길 — 꺼진 칸은 지난 칸 수를 0 으로 둬, 같은 수로 다시 켜져도(1 → 0 → 1) 확대가 선다. 굴림 없음
  if (count <= 0) return isBugFixed('B-87') ? { last: 0, timer: 0, tick, zoom: 0 } : { last, timer, tick, zoom: 0 }
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

/**
 * 이닝 숫자 0xba689 → 0xba51c (0x373d0 의 378a2~378ea, 직접 떴다): 0x94a65(game_ui 프레임, 박스 0) = (9, 2, 10, 9) 에
 * (6, 6) 을 더해 x = 박스x + 6 + **박스w**, y = 박스y + 6 → (25, 8). 값 = st[+0x6b] + 1, 자간 0, 기준 0(num 000~), 정렬 4.
 * 0xba689 는 그대로 0xba51c(x, y, **w 0, h 0**, 자간, 값, 기준, 그림, 정렬, ox 0, oy 0, 0)로 넘긴다 (ba6a2~ba6ac) —
 * 상자 폭 0 에 오른쪽 맞춤이라 (25, 8) 이 오른끝, 글자는 아래 맞춤
 */
const INNING_BOX = { x: 15, y: 8, width: 10 }
const INNING_LETTER_SPACING = 0
const INNING_ALIGN = 0x4
const SCORE_DIGITS_START = 20
/**
 * 점수 숫자 0xba719 → 0xba51c (37552~3756c 위 · 37624~37640 아래, 직접 떴다): 박스 = 줄 상자에서 x 를 로고 앞 +3 (3751c · 375ee)
 * 옮긴 것, 자간 1 · ox −3 · oy 0. 정렬은 위 줄 0x24(오른쪽 + 세로 가운데) · 아래 줄 4(오른쪽만, 대신 박스 y + 3 — 37614).
 */
const SCORE_LETTER_SPACING = 1
const SCORE_BOX_SHIFT_X = 3
const SCORE_OFFSET_X = -3
const SCORE_ALIGN_TOP = 0x24
const SCORE_ALIGN_BOTTOM = 0x4
const BOTTOM_ROW_SCORE_OFFSET_Y = 3
const INNING_DIGITS_START = 0

/** `tick` = 타석이 열린 뒤 흐른 틱. 새 램프 확대 연출이 이걸로 z 를 센다 */
export function drawHud(context: CanvasRenderingContext2D, hud: HudState, tick: number): void {
  // 판: 박스 1 + (6,6) = (5,5,82,50) 검정 둥글기 5 → (+1,+1,−2,−2) #335FCD 둥글기 5 (37444~37488, 둥근 칠 0xba0bd → 0x6b7d4)
  fillRound(context, BOARD, BOARD_ROUND, ORIGINAL_COLORS.black)
  fillRound(context, { x: BOARD.x + 1, y: BOARD.y + 1, width: BOARD.width - 2, height: BOARD.height - 2 }, BOARD_ROUND, ORIGINAL_COLORS.boardFill)

  // 위 줄 = 측 0(선공, 초 공격), 아래 줄 = 측 1(후공, 말 공격). 공격 막대는 st[9] == 0 이면 위, == 1 이면 아래 (0x374e0 · 0x375b2)
  const rows = hudRowsOf(hud)
  drawTeamRow(context, ROW_TOP, rows.top.logoUrl, rows.top.score, rows.top.isBatting, 0, SCORE_ALIGN_TOP)
  drawTeamRow(context, ROW_BOTTOM, rows.bottom.logoUrl, rows.bottom.score, rows.bottom.isBatting, BOTTOM_ROW_SCORE_OFFSET_Y, SCORE_ALIGN_BOTTOM)

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

  const innings = inningGlyphsOf(hud.inning, numGlyphSizeOf)
  for (const glyph of innings ?? []) {
    const image = sprite(numGlyphUrl(glyph.index))
    if (image !== null) context.drawImage(image, glyph.x, glyph.y)
  }
}

/** HUD 이닝 숫자 자리 — 0xba689(25, 8, 자간 0, 이닝, 기준 0, num, 정렬 4) → 0xba51c (위 `INNING_BOX` 주석) */
export function inningGlyphsOf(
  inning: number,
  sizeOf: (index: number) => { readonly width: number; readonly height: number } | null,
): NumberGlyphPlacement[] | null {
  return alignedNumberGlyphsOf(
    inning,
    { x: INNING_BOX.x + INNING_BOX.width, y: INNING_BOX.y, width: 0, height: 0 },
    { spacing: INNING_LETTER_SPACING, start: INNING_DIGITS_START, align: INNING_ALIGN, offsetX: 0, offsetY: 0 },
    sizeOf,
  )
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

interface PlainRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 기기 선 긋기(0x14006c8) 한 줄 — 두 끝을 다 칠한다. 끝이 거꾸로면 작은 쪽부터 */
const lineRect = (x1: number, y1: number, x2: number, y2: number): PlainRect => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  width: Math.abs(x2 - x1) + 1,
  height: Math.abs(y2 - y1) + 1,
})

/**
 * **둥근 칠 `0x6b7d4(gfx, x, y, w, h, 둥글기, 색)`** — `widgets/matchup-cards` 의 `roundFillRectsOf` 와 같은 식이다
 * (위젯끼리 import 하지 않으려고 베꼈다). 둥글기는 7 로 자르고, R = x + w · B = y + h.
 * ```
 * 둥글기 ≤ 3:  칠(x+1, y+1, w−1, h−1) · 선(x+1, y, R−1, y) · 선(x+1, B, R−1, B) · 선(x, y+1, x, B−1) · 선(R, y+1, R, B−1)
 * 둥글기 4~7:  칠(x+1, y+1, w−1, h−1) · 선(x+2, y, R−2, y) · 선(x+2, B, R−2, B) · 선(x, y+2, x, B−2) · 선(R, y+2, R, B−2)
 * ```
 * 그래서 둥근 칠은 (w+1) × (h+1) 칸을 덮고 모서리를 1칸(≤3) 또는 ㄱ자 3칸(4~7) 비운다.
 */
export function roundFillRectsOf(rect: PlainRect, round: number): PlainRect[] {
  const { x, y, width: w, height: h } = rect
  const right = x + w
  const bottom = y + h
  const inset = Math.min(7, round) <= 3 ? 1 : 2
  const body: PlainRect[] = w - 1 > 0 && h - 1 > 0 ? [{ x: x + 1, y: y + 1, width: w - 1, height: h - 1 }] : []
  return [
    ...body,
    lineRect(x + inset, y, right - inset, y),
    lineRect(x + inset, bottom, right - inset, bottom),
    lineRect(x, y + inset, x, bottom - inset),
    lineRect(right, y + inset, right, bottom - inset),
  ]
}

function fillRound(context: CanvasRenderingContext2D, rect: PlainRect, round: number, color: string): void {
  context.fillStyle = color
  for (const part of roundFillRectsOf(rect, round)) context.fillRect(part.x, part.y, part.width, part.height)
}

function drawTeamRow(
  context: CanvasRenderingContext2D,
  row: { x: number; y: number; width: number; height: number },
  logoUrl: string,
  score: number,
  isBatting: boolean,
  scoreOffsetY: number,
  scoreAlign: number,
): void {
  // 팀 줄 #222854 둥글기 3 (374c6~374dc · 37598~375ae), 공격 막대 = 네모 칠 0x6a9f1(x + 1, y + 2, 3, h − 2) #FFE500 (374ea~37512)
  fillRound(context, row, ROW_ROUND, ROW_COLOR)
  if (isBatting) {
    context.fillStyle = OFFENSE_BAR_COLOR
    context.fillRect(row.x + 1, row.y + 2, OFFENSE_BAR_WIDTH, row.height - 2)
  }
  const logo = sprite(logoUrl)
  if (logo !== null) context.drawImage(logo, row.x + LOGO_OFFSET.x, row.y + LOGO_OFFSET.y)
  const box = { x: row.x + SCORE_BOX_SHIFT_X, y: row.y + scoreOffsetY, width: row.width, height: row.height }
  const glyphs = alignedNumberGlyphsOf(score, box, {
    spacing: SCORE_LETTER_SPACING, start: SCORE_DIGITS_START, align: scoreAlign, offsetX: SCORE_OFFSET_X, offsetY: 0,
  }, numGlyphSizeOf)
  if (glyphs === null) return
  for (const glyph of glyphs) {
    const image = sprite(numGlyphUrl(glyph.index))
    if (image !== null) context.drawImage(image, glyph.x, glyph.y)
  }
}

const numGlyphUrl = (index: number) => `./sprites/num/${String(index).padStart(3, '0')}.png`

function numGlyphSizeOf(index: number): { readonly width: number; readonly height: number } | null {
  const image = sprite(numGlyphUrl(index))
  return image === null ? null : { width: image.width, height: image.height }
}

export interface NumberGlyphPlacement {
  readonly index: number
  readonly x: number
  readonly y: number
}

/**
 * 숫자 그리기 **0xba51c(x, y, w, h, 자간, 값, 기준, 그림, 정렬, ox, oy)** (직접 떴다, 0xba51c~0xba67a).
 * ```
 * x0 = x + ox ; y0 = y + oy
 * 자리마다 Σ += 글자폭 + 자간 (끝 자리 뒤 자간까지) ; 최대높이 = max(글자높이)
 * 정렬 & 0x4  → x0 += w − Σ                    (ba594)
 * 정렬 & 0x20 → y0 += ceil((h − 최대높이) / 2)   (ba5a6 — 나머지를 위로 올린다)
 * 정렬 & 0x40 → y0 += h − 최대높이              (ba5c8)
 * 정렬 & 0x2  → x0 += (w − Σ) >> 1              (ba5dc)
 * 높은 자리부터 그림 (기준 + 숫자) 을 (x0, y0 + 최대높이 − 글자높이) 에 — 글자 아래 맞춤 — 그리고 x0 += 글자폭 + 자간
 * ```
 * 그림이 아직 안 읽혔으면 null.
 */
export function alignedNumberGlyphsOf(
  value: number,
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  options: { readonly spacing: number; readonly start: number; readonly align: number; readonly offsetX: number; readonly offsetY: number },
  sizeOf: (index: number) => { readonly width: number; readonly height: number } | null,
): NumberGlyphPlacement[] | null {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map((digit) => options.start + Number(digit))
  const sizes = digits.map(sizeOf)
  if (sizes.some((size) => size === null)) return null
  const known = sizes as { readonly width: number; readonly height: number }[]
  const total = known.reduce((sum, size) => sum + size.width + options.spacing, 0)
  const maxHeight = known.reduce((max, size) => Math.max(max, size.height), 0)
  let x = box.x + options.offsetX
  let y = box.y + options.offsetY
  if ((options.align & 0x4) !== 0) x += box.width - total
  if ((options.align & 0x20) !== 0) {
    const gap = box.height - maxHeight
    y += (gap >> 1) + (gap - Math.trunc(gap / 2) * 2)
  }
  if ((options.align & 0x40) !== 0) y += box.height - maxHeight
  if ((options.align & 0x2) !== 0) x += (box.width - total) >> 1
  return digits.map((index, order) => {
    const size = known[order]
    const glyph = { index, x, y: y + maxHeight - size.height }
    x += size.width + options.spacing
    return glyph
  })
}

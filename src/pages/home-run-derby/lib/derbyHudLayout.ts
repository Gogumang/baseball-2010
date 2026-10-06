/**
 * 홈런더비 HUD 배치 — 원본 `0x45a54` (**직접 떴다**, 0x45a54~0x45be8).
 *
 * 타석 화면 그리기 `0x4c4bc` 가 모드 7 이면 일반 점수판(`0x373d0`) 대신 이 함수를 부른다(0x4c4fe).
 * ```
 * 45a5e  [장면+0x19e8](ui/trainning.pzx) 가 없으면 아무것도 안 그린다
 * 45a78  0xba815(rect, trainning, 2, 종류 1)            ; 합성 프레임 2 의 상자 → 폭 83
 * 45a94  x0 = W − 폭 − 6                                 ; 240 이면 151
 * 45abc  0xba759(trainning, 2, 종류 1, x0, 6, …)        ; 판 "최고 ___M / 현재 ___M" (83×51)
 * 45aec  0x3608c(장면, 공 번호, 공 수, x0 + 0x38, 10, 0) ; "공 번호 / 공 수" — 공 수 = 보너스 중 ? +0x3d : 10,
 *                                                          공 번호 = 공 수 − 남은 기회(+0x33) + 1
 * 45b08  r = 0x94a65(프레임 2, 상자 0) + (x0, 6)         ; 최고 칸 (32,19,35,10)
 * 45b3a  최고(저장 +0x5c, u16) < 누적(+0x34) 이면 기준 0x50(노랑) 아니면 0(흰색) 으로
 *        0xba719(r, 자간 0, 최고, 기준, num 이미지, 정렬 4)  ; 값은 둘 다 **최고 기록**이다 — 색만 바뀐다
 * 45b9e  r = 0x94a65(프레임 2, 상자 1) + (x0, 6)         ; 현재 칸 (32,35,35,10)
 * 45bd8  0xba719(r, 자간 0, 누적(+0x34), 기준 0x50, num 이미지, 정렬 4)
 * 45bde  0x4585c(장면)                                   ; 콤보 표시 (`COMBO_DISPLAY`)
 * ```
 * - 공 아이콘은 없다. 0x3608c 는 num **이미지** 101(흰 "/")을 (x, y) 에 그리고, 그 왼쪽에 공 번호를 오른쪽 맞춤
 *   (`0x585ad(…, x − 1, y, 간격 1, 자리 0, 정렬 4)`), 오른쪽에 공 수를 왼쪽 맞춤(`x + "/" 폭 + 1`, 정렬 1)으로 쓴다.
 *   마지막 인자 0 이라 글자는 이미지 0~9(흰색)다.
 * - 0x585ad 는 폭을 셀 때 간격을 **셋째 글자부터만** 더하고(0x58620 `cmp 차례,#1 · ble`) 그릴 때는 글자마다 폭 + 간격씩
 *   나아간다 — 두 자리 공 번호("10")는 1px 오른쪽으로 밀려 "/" 에 닿는다. 원본 그대로 옮긴다.
 * - 0xba51c(정렬 4): x = 상자 x + 상자 폭 − Σ(글자 폭 + 자간), 세로는 가장 큰 글자 높이에 아래를 맞춘다(위 = 상자 y).
 * - 마투수 이름·이벤트 존은 이 함수가 안 그린다(이벤트 존은 0x41098).
 */

/** 타석 캔버스 240×320 — W·H (0x14008b8 · 0x14008c8) */
const SCREEN_WIDTH = 240

/** num.pzx 이미지 폴더 */
const NUM_FOLDER = './sprites/num'

/** HUD 판 — trainning.pzx 합성 프레임 2 (83×51, 앵커 (0,0)) 를 (W − 83 − 6, 6) 에 */
export const HUD_PANEL = {
  folder: './sprites/trainning/frames',
  frame: 2,
  width: 83,
  x: SCREEN_WIDTH - 83 - 6,
  y: 6,
} as const

/** 프레임 2 의 상자 (trainning/frames/boxes.json "002") — 0 = 최고 · 1 = 현재 */
const PANEL_BOXES = [
  { x: 32, y: 19, width: 35, height: 10 },
  { x: 32, y: 35, width: 35, height: 10 },
] as const

/** 공 번호 칸 — 0x3608c(…, x0 + 0x38, 10) */
export const BALL_COUNTER = { x: HUD_PANEL.x + 0x38, y: 10, slashImage: 101, slashWidth: 10, gap: 1 } as const

/** 숫자 글꼴 기준 — 0 흰색 · 0x50 노랑 (num 이미지 0~9 · 80~89, 모두 8×10 이고 "1" 만 4×10) */
export const HUD_DIGIT_BASE = { white: 0, yellow: 0x50 } as const
const hudDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)

export interface HudGlyph {
  readonly src: string
  readonly left: number
  readonly top: number
}

const numSrcOf = (image: number) => `${NUM_FOLDER}/${String(image).padStart(3, '0')}.png`
const digitsOf = (value: number) => [...String(Math.max(0, Math.trunc(value)))].map(Number)

/**
 * `0x585ad` 숫자 — 정렬 4(오른쪽 맞춤, x = 오른끝) · 1(왼쪽 맞춤, x = 왼끝). 자리 채우기 0, 세로 맞춤 없음(위 = y).
 * 폭은 셋째 글자부터 간격을 더해 센다(원본 그대로).
 */
function counterGlyphsOf(value: number, x: number, y: number, align: 1 | 4, base: number, gap: number): HudGlyph[] {
  const digits = digitsOf(value)
  const measured = digits.reduce((total, digit, index) => total + hudDigitWidthOf(digit) + (index > 1 ? gap : 0), 0)
  let left = align === 1 ? x : x - measured
  return digits.map((digit) => {
    const placed = { src: numSrcOf(base + digit), left, top: y }
    left += hudDigitWidthOf(digit) + gap
    return placed
  })
}

/** "공 번호 / 공 수" (0x3608c) — 공 번호는 "/" 왼쪽 1px 에 오른끝, 공 수는 "/" 다음 1px 부터 */
export function ballCounterGlyphsOf(ballNumber: number, ballCount: number): HudGlyph[] {
  const { x, y, slashImage, slashWidth, gap } = BALL_COUNTER
  return [
    ...counterGlyphsOf(ballNumber, x - 1, y, 4, HUD_DIGIT_BASE.white, gap),
    { src: numSrcOf(slashImage), left: x, top: y },
    ...counterGlyphsOf(ballCount, x + slashWidth + 1, y, 1, HUD_DIGIT_BASE.white, gap),
  ]
}

/** 판 상자 안 숫자 (0xba719 → 0xba51c, 자간 0, 정렬 4) */
function boxGlyphsOf(value: number, box: (typeof PANEL_BOXES)[number], base: number): HudGlyph[] {
  const digits = digitsOf(value)
  const boxLeft = HUD_PANEL.x + box.x
  const boxTop = HUD_PANEL.y + box.y
  let left = boxLeft + box.width - digits.reduce((total, digit) => total + hudDigitWidthOf(digit), 0)
  return digits.map((digit) => {
    // 글자 높이가 모두 10 이라 아래 맞춤(0xba628)을 해도 위 = 상자 y
    const placed = { src: numSrcOf(base + digit), left, top: boxTop }
    left += hudDigitWidthOf(digit)
    return placed
  })
}

/**
 * 최고 칸 — 값은 **저장된 최고 기록**이고, 누적이 그것을 넘으면 노랑(0x50), 아니면 흰색(0) 이다 (0x45b3a `cmp 최고, 누적 · bge`).
 */
export function bestDistanceGlyphsOf(bestDistance: number, totalDistance: number): HudGlyph[] {
  const base = bestDistance < totalDistance ? HUD_DIGIT_BASE.yellow : HUD_DIGIT_BASE.white
  return boxGlyphsOf(bestDistance, PANEL_BOXES[0], base)
}

/** 현재 칸 — 누적 비거리, 늘 노랑(0x50) */
export function totalDistanceGlyphsOf(totalDistance: number): HudGlyph[] {
  return boxGlyphsOf(totalDistance, PANEL_BOXES[1], HUD_DIGIT_BASE.yellow)
}

/**
 * **콤보 표시 — 원본 `0x4585c` 그대로** (직접 떴다, 0x4585c~0x45a20).
 *
 * 그리는 그림은 `ui/combo.pzx` 가 **아니라 `ui/trainning.pzx`** 다. 장면 +0x19e8 은 적재 0x486a2~0x486ca 가
 * `0xb9719("ui/trainning.pzx"=0xd08a4)` 로 채운다. combo.pzx(0xd0960)는 0x48af2 가 장면 **+0x1020** 에 싣지만
 * +0x1020 을 읽는 곳은 해제 0x33794 하나뿐이라 원본 화면에 combo.pzx 는 한 번도 안 나온다.
 * ```
 * 4586e  [장면+0x1b60] == 0 이면 끝
 * 4587e  글꼴 = [[[장면+0x1014](num.pzx)+8]+8]          ; 이미지 배열
 * 45886  p = 0xae89d([장면+0x220])                       ; 지금 타자 레코드
 * 4589e  0xb63c1(p) (손: 1 좌타 · 0 우타)
 *  좌타: 458dc 0x93c45(trainning 애니 1, 0, H/2, 0, 0)
 *        458fe 칸 < 칸수−1 이면 0x93d91 진행(숫자 없음) · 아니면 0xba689(20, H/2 − 30, 0, (s8)+0x84, 기준 0x46, 글꼴, 정렬 1, 0)
 *  우타: 4597c 0x93c45(trainning 애니 2, W, H/2, 0, 0)
 *        4599c 칸 < 칸수−1 이면 0x93d91 진행 · 아니면 0xba689(W − 40, H/2 − 30, …같은 인자)
 * 45a00  [장면+0x19ec]++ ; > 20 이면 +0x1b60 = 0 · +0x84 = 0
 * ```
 * 상태 0xf(0x3db92~0x3dbf2)가 모드 7 이면 두 애니를 `0x93cfd(애니, 0)` 로 첫 칸에 돌려 둔다. 애니 1 = 칸 3·4·5·6,
 * 애니 2 = 칸 7·8·9·10, 지연 모두 1(trainning/frames/animations.json) — 그래서 **그린 차례 0·1·2 는 글자만 미끄러져 오고,
 * 차례 3 부터 마지막 칸 "Combo" 위에 숫자**가 붙는다(21 번 중 18 번).
 *
 * 숫자 0xba689 → 0xba51c(x, y, 폭 0, 높이 0, 자간 0, 값, 기준 0x46, 글꼴, 정렬 1, 0, 0, 0): 정렬 비트 1 은 아무 데서도 안 보므로
 * (0x2·0x4·0x20·0x40 만 본다) (x, y) 가 첫 글자의 왼쪽 위다. 글자는 num **70 + 자리 숫자**, 전진 = 그림 폭 + 0,
 * 세로는 가장 큰 글자 높이에 맞춰 아래를 가지런히 한다(0xba628).
 */
export const COMBO_DISPLAY = {
  folder: './sprites/trainning/frames',
  /** W·H — 0x14008b8 · 0x14008c8 (타석 캔버스 240×320) */
  screenWidth: 240,
  screenHeight: 320,
  /** 애니 1(좌타) · 애니 2(우타) 칸 차례 */
  frames: { 좌타: [3, 4, 5, 6], 우타: [7, 8, 9, 10] },
  /** 숫자 기준 그림 0x46 */
  digitBaseFrame: 0x46,
} as const

/** trainning.pzx 합성 프레임의 앵커 기준 왼쪽 위 (origins.json) */
const COMBO_FRAME_ORIGINS: Readonly<Record<number, { x: number; y: number }>> = {
  3: { x: -38, y: 0 }, 4: { x: 0, y: 0 }, 5: { x: -1, y: 0 }, 6: { x: 0, y: 0 },
  7: { x: -90, y: 0 }, 8: { x: -74, y: 0 }, 9: { x: -62, y: 0 }, 10: { x: -63, y: 0 },
}

/** num.pzx 70~79 (큰 숫자) 그림 크기 [폭, 높이] */
const BIG_DIGIT_SIZES: readonly (readonly [number, number])[] = [
  [32, 36], [22, 35], [29, 35], [29, 36], [32, 36], [30, 36], [30, 36], [31, 34], [30, 36], [30, 36],
]

export interface ComboDisplayPlacement {
  /** trainning 합성 프레임 번호와 그 그림의 왼쪽 위 */
  readonly frame: number
  readonly left: number
  readonly top: number
  /** 숫자 글자들 (num 그림 번호와 왼쪽 위). 애니가 끝 칸에 닿기 전엔 비어 있다 */
  readonly digits: readonly { readonly frame: number; readonly left: number; readonly top: number }[]
}

/**
 * 콤보 표시 한 번 그리기 — `drawIndex` = 표시를 켠 뒤 몇 번째 그리기인가(0 부터, 장면 +0x19ec).
 * `batterSide` = 0xb63c0 (0 우타 · 1 좌타).
 */
export function comboDisplayPlacementOf(value: number, batterSide: number, drawIndex: number): ComboDisplayPlacement {
  const isLeft = batterSide === 1
  const frames = isLeft ? COMBO_DISPLAY.frames.좌타 : COMBO_DISPLAY.frames.우타
  const step = Math.min(Math.max(0, Math.trunc(drawIndex)), frames.length - 1)
  const frame = frames[step]
  const anchorX = isLeft ? 0 : COMBO_DISPLAY.screenWidth
  const anchorY = COMBO_DISPLAY.screenHeight >> 1
  const origin = COMBO_FRAME_ORIGINS[frame]
  const placement = { frame, left: anchorX + origin.x, top: anchorY + origin.y }
  if (step < frames.length - 1) return { ...placement, digits: [] }

  const numberX = isLeft ? 20 : COMBO_DISPLAY.screenWidth - 40
  const numberY = anchorY - 30
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const maxHeight = Math.max(...digits.map((digit) => BIG_DIGIT_SIZES[digit][1]))
  let left = numberX
  return {
    ...placement,
    digits: digits.map((digit) => {
      const [width, height] = BIG_DIGIT_SIZES[digit]
      const placed = { frame: COMBO_DISPLAY.digitBaseFrame + digit, left, top: numberY + maxHeight - height }
      left += width
      return placed
    }),
  }
}

/**
 * 이벤트 존 그림 자리 — 원본은 **공이 있던 자리**에 놓는데(0x36dfc) 이식판 타석 화면은
 * 타구를 그리지 않아 공 자리가 없다. 화면 위쪽 1/3 안(= 원본 조건 "화면 y < 높이/3")
 * 한가운데에 띄운다. **내가 정한 자리다.**
 */
export const EVENT_ZONE_SPOT = { x: 120 - 35, y: Math.trunc(320 / 3) - 66, parts: ['./sprites/event_zone/000.png', './sprites/event_zone/001.png'] } as const

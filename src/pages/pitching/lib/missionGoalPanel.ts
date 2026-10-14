/**
 * **미션 HUD 판 — 원본 `0x36714`** (2026-10-14 직접 뜸, 0x36714~0x36c8a).
 *
 * 부르는 길: 타석 공용 그리기 0x4c4bc → 점수판 0x373d0 꼬리 **0x378f0** → 0x36cb8(모드 [+0x1104] ∈ {5, 6}) → 0x36714.
 * 곧 미션의 목표는 **장면 HUD 의 한 조각**으로 오른쪽 위 판에 그려진다 — 웹 화면 위 띠(`GoalBar`)가 아니다.
 * 결과 판 0x4a384 는 HUD 를 안 그리므로(R10 · F 1절) 결과 화면에는 목표가 없다.
 * ```
 * 3679c  (w, h) = 0xba815(trainning(+0x19e8), 프레임 12, 종류 1)        ; 83 × 51
 * 367c4  x0 = W − w − 6                                                  ; 151
 * 367e2  0xba759(trainning, 12, 종류 1, x0, 6)                            ; 판
 * 367fc  0xba759(trainning, 0x11, 종류 0, W − w − 1, 41)                  ; 이미지 17 "달성" (22 × 12)
 * 36800~ 목표 글 줄(+0x180a + 32·줄) — 0x36358(장면, 줄, x0 + (w − 0x4b)/2 − 밀림x, 25, 아래 x = x0 + 0x31 − 밀림y, 41, 자르기 둘)
 *        넘기는 중이면 자르기 = (W − w + 1, 23, 71, 14) · (W − w + 23, 39, 48, 14), 다음 줄은 각각 + 0x4b · + 0x32 자리.
 *        0x36358 은 줄을 `sprintf("!C%s")` 로 0xba269(…, x, 25, 폭 0x4b) 에 그리고(가운데 맞춤 줄바꿈 글),
 *        줄 글을 이름표 0x14003b8(12 · 9 개)와 맞대 그 목표의 진행 수를 아래 칸(x0 + 0x31, 41)에 그린다
 * 369b2  0xba759(trainning, 모드 6 ? 8 : 7, 종류 0, x0 + 7, 모드 6 ? 8 : 7)   ; 머리 아이콘 (11 × 11)
 * 369f6  미션 행 +0xa 아래 4비트(타석 제한) ≠ 0 →
 *          프레임 13(83 × 17) 을 (x0, h + 8) · img_text 262 를 (x0 + 6, h + 12) ·
 *          0x3608c(장면, min(쓴 타석 + 1, 제한), 제한, x0 + 0x31, h + 12)       ; "n / 제한"
 * 36b04  모드 5: 행 +9 아래 4비트(투구 제한) ≠ 0 → 그 아래(앞 판 끝 + 2)에 프레임 13 · img_text 263 · 0x3608c(던진 공, 제한)
 *        모드 6: 행 +9 위 4비트(스윙 제한) → img_text 264 로 같은 줄
 * 36c04  행 +0xb..+0xc(시간 제한) > 0 → 왼쪽(x 5)에 프레임 13 · 이미지 16 · 0x361e4(남은 시간)
 * ```
 * ⚠️ 미이식: 0x36358 의 진행 수(아래 칸 — 목표 이름표 맞대기 0xcfdc4 · 0xcfdf4 와 칸 표 0xcfe18 · 0xcfe48) · 시간 줄(0x361e4) ·
 *    모드 6 줄. 목표 글의 글꼴 · 색(0xba269 의 [sp0] = −1)은 확인하지 않아 흰 11px 글로 둔다.
 * ⚠️ 정정: Q2 2f 의 "다음 줄은 (0x4b − x, 0x32 − y)" 는 위 줄 글과 아래 칸 진행 수가 **각각 가로로** 밀리는 것이다(y 밀림은 아래 칸의 x).
 */

const SCREEN_WIDTH = 240
const TRAINNING = './sprites/trainning'
const IMG_TEXT = './sprites/img_text'
const NUM = './sprites/num'

const imageOf = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

/** 프레임 12 — 83 × 51, 원점 (0, 0) */
const PANEL_FRAME = { frame: 12, width: 83, height: 51 } as const
/** 프레임 13 — 83 × 17, 원점 (0, 0) */
const ROW_FRAME = { frame: 13, width: 83, height: 17 } as const
/** x0 = W − w − 6 */
export const PANEL_X = SCREEN_WIDTH - PANEL_FRAME.width - 6
const PANEL_Y = 6

export interface PanelImage {
  readonly src: string
  readonly left: number
  readonly top: number
}

/** 목표 글 줄 자리 — 가운데 맞춤 폭 0x4b, y 25 (`!C%s`) */
export const GOAL_TEXT = {
  x: PANEL_X + ((PANEL_FRAME.width - 0x4b) >> 1),
  y: 25,
  width: 0x4b,
  /** 넘기는 중의 자르기 (W − w + 1, 23, 71, 14) */
  clip: { x: SCREEN_WIDTH - PANEL_FRAME.width + 1, y: 23, width: 0x47, height: 0xe },
} as const

export interface MissionPanelSource {
  /** 모드 5 투수 미션 · 6 타자 미션 */
  readonly mode: 5 | 6
  /** 타석 제한(행 +0xa 아래 4비트) · 쓴 타석 */
  readonly plateAppearance: { readonly limit: number; readonly used: number } | null
  /** 투구 제한(행 +9 아래 4비트) · 던진 공 — 모드 5 만 */
  readonly pitches: { readonly limit: number; readonly thrown: number } | null
}

/** 판 · 아이콘 · 줄 판 · img_text · 숫자 그림을 그리는 차례대로 */
export function missionPanelImagesOf(source: MissionPanelSource): PanelImage[] {
  const images: PanelImage[] = [
    { src: imageOf(`${TRAINNING}/frames`, PANEL_FRAME.frame), left: PANEL_X, top: PANEL_Y },
    // 종류 0 — 이미지 17 "달성"
    { src: imageOf(TRAINNING, 0x11), left: SCREEN_WIDTH - PANEL_FRAME.width - 1, top: 41 },
    // 종류 0 — 이미지 7(공) · 8(배트) 를 (x0 + 7, 7 · 8)
    { src: imageOf(TRAINNING, source.mode === 6 ? 8 : 7), left: PANEL_X + 7, top: source.mode === 6 ? 8 : 7 },
  ]
  // 앞 판의 끝 — 처음엔 [sp+0x44] = 6 · 판 높이 51
  let rowTop: number | null = null
  const plate = source.plateAppearance
  if (plate !== null && plate.limit > 0) {
    rowTop = PANEL_FRAME.height + 8
    images.push(...rowImagesOf(rowTop, 262, Math.min(plate.used + 1, plate.limit), plate.limit))
  }
  const pitches = source.pitches
  if (source.mode === 5 && pitches !== null && pitches.limit > 0) {
    const previousBottom = rowTop === null ? PANEL_Y + PANEL_FRAME.height : rowTop + ROW_FRAME.height
    images.push(...rowImagesOf(previousBottom + 2, 263, pitches.thrown, pitches.limit))
  }
  return images
}

/** 줄 판 하나 — 프레임 13 을 (x0, 위) · img_text 를 (x0 + 6, 위 + 4) · "a / b" 를 (x0 + 0x31, 위 + 4) */
function rowImagesOf(top: number, textImage: number, value: number, limit: number): PanelImage[] {
  return [
    { src: imageOf(`${TRAINNING}/frames`, ROW_FRAME.frame), left: PANEL_X, top },
    { src: imageOf(IMG_TEXT, textImage), left: PANEL_X + 6, top: top + 4 },
    ...counterImagesOf(value, limit, PANEL_X + 0x31, top + 4),
  ]
}

/**
 * 0x3608c(장면, a, b, x, y, 0) — num 이미지 101(흰 "/", 10 × 10)을 (x, y) 에, a 를 그 왼쪽 x − 1 에 오른쪽 맞춤,
 * b 를 x + 10 + 1 에서 왼쪽 맞춤 (`0x585ad` 간격 1). 폭은 셋째 글자부터 간격을 더해 센다 — 홈런더비 HUD
 * (`pages/home-run-derby/lib/derbyHudLayout` 의 공 번호 칸)와 같은 함수다.
 */
export function counterImagesOf(a: number, b: number, x: number, y: number): PanelImage[] {
  return [
    ...digitImagesOf(a, x - 1, y, 'right'),
    { src: imageOf(NUM, 101), left: x, top: y },
    ...digitImagesOf(b, x + 10 + 1, y, 'left'),
  ]
}

const DIGIT_GAP = 1
const digitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)

function digitImagesOf(value: number, x: number, y: number, align: 'left' | 'right'): PanelImage[] {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const measured = digits.reduce((total, digit, index) => total + digitWidthOf(digit) + (index > 1 ? DIGIT_GAP : 0), 0)
  let left = align === 'left' ? x : x - measured
  return digits.map((digit) => {
    const placed = { src: imageOf(NUM, digit), left, top: y }
    left += digitWidthOf(digit) + DIGIT_GAP
    return placed
  })
}

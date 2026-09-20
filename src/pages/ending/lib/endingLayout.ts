/**
 * 엔딩 화면 배치 (나만의리그 엔딩 그리기 `0x882b4`, 적재 `0x87c7c` — P6 4b).
 *
 * 흐름 (P6 4b 확정):
 *   1. 화면 검정(0x6a735) → **mode_ui 프레임 10 박스 0 = (0, 65, 240, 72)** 띠 창
 *      (검정 채움 + 위·아래 11px 띠 #395DCE + 선 #294DAD·#4A7DFF, 안에 mode_back 배경 0x7b9ad)
 *   2. 캐릭터·선수 그림이 오른쪽에서 걸어 들어옴 (유력 — 아래 `WALK_IN` 주석)
 *   3. **엔딩 그림** `ending.pzx` 이미지 0 (146×96, 원점 (−84,−57)) 두 조각이 미끄러져 들어옴
 *   4. **원형 전환(아이리스)** — 검정 판에 투명색 RGB(255,0,255) 원을 뚫어 덮는다
 *   5. 글 StrENDING[결과] 흰 글 가운데, 끝에 **[21] 제작진**이 `(0, H − 카운터, W)` 로 아래→위
 *
 * 움직임 두 식은 S9 8절이 확정했다 (그림 1px/틱 · 아이리스 반지름).
 */

export const SCREEN = { width: 240, height: 320 } as const

/**
 * 띠 창 = mode_ui **프레임 10 박스 0** (0, 65, 240, 72) — F-6 외출 연출 창과 같은 틀 (P6 4b-1).
 * 프레임 10 은 `public/sprites/mode_ui/frames/010.png` 가 없다 — **그림 없이 박스만 있는 배치 프레임**이라
 * 여기서는 박스 값만 쓰고 면·선은 직접 칠한다 (훈련 창 `TrainingScene.css.ts` 와 같은 방식).
 */
export const BAND_WINDOW = {
  x: 0,
  y: 65,
  width: SCREEN.width,
  height: 72,
  /** 박스 안은 먼저 검정으로 채운다 */
  fill: '#000000',
  /** 위·아래 11px 띠 RGB(57,93,206) */
  edgeHeight: 11,
  edgeColor: '#395DCE',
  /** 띠 테두리 선 — 바깥 #294DAD, 안쪽 #4A7DFF */
  outerLine: '#294DAD',
  innerLine: '#4A7DFF',
} as const

/** 띠 창 아래 = 연출 잘라내기 (0, 0, W, 띠 아래) (P6 4b-1) */
export const BAND_WINDOW_BOTTOM = BAND_WINDOW.y + BAND_WINDOW.height

/**
 * 띠 안 배경 `0x7b9ad` — mode_back 을 (1, 66) 에 70 높이로 자른다 (상태판 `STADIUM_BAND` 과 같은 값).
 *
 * ⚠️ 원본이 엔딩에서 **어느 프레임**(0 낮 · 1 저녁 · 2 밤)을 고르는지는 못 읽었다 — 낮(0)을 쓴다.
 */
export const BAND_BACKGROUND = { frame: 0, left: 1, top: 66, height: 70 } as const

/**
 * 걸어 들어오는 그림 두 개 — **확정** (S12 7절, P6 4b-2 정정).
 *
 * - `[this+0x344]` = **`event_char_0.pzx` 애니**(육성 선수 캐릭터). 적재 `0x87cd6` 가
 *   `0x63a05([0x1552cfc], 1, 2)` 로 만들고 반복 재생을 켠다. 애니 번호는 `(0 또는 8) + 2` 로,
 *   육성 선수 레코드가 `p[0xb] >> 4 > 1` 이면 8 을 쓴다(0x63a5c~0x63a92).
 *   팔레트도 `(p[0xb] >> 2) & 3` 으로 고르는데, 웹판은 외모 비트를 아직 안 옮겨 **기본 애니 2** 를 쓴다.
 * - `[this+0x15c]` 는 필드가 아니라 **프레임 배열 바이트 오프셋(0xae × 2)** 이었다 —
 *   `this+0x138`(= `ui/mode_ui.pzx`)의 **프레임 87**(부상 아이콘)이다. 단계 `[this+0x2e4] == 0` 일 때만 그린다.
 *
 * 자리 (0x885b0~0x885e6 · 0x8865e~0x88698, `n` = 그리기 2번째 인자 = 틱 카운터):
 * ```
 * 애니        x = 240 − n/3 − 20   y = (n & 7) ? 137 : 136
 * 프레임 87   x = 240 − n/3 − 62   y = (n & 7) ? 61  : 60
 * ```
 * `n/3` 은 `__divsi3` 정수 나눗셈이라 **3틱에 1px** 왼쪽으로 오고,
 * `n & 7 == 0` 인 틱(8틱에 한 번)만 1px 위로 튄다 — 걸음 흔들림이다.
 */
export const WALK_IN = {
  /** event_char_0.pzx 애니 — 기본 번호 0 + 2 (외모 비트가 붙으면 8 + 2) */
  characterFolder: './sprites/event_char_0/frames',
  characterAnimation: 2,
  characterAnimationWithLook: 10,
  characterDx: -20,
  /** 부상 아이콘 = ui/mode_ui 프레임 87 (20×19) */
  iconFolder: './sprites/mode_ui/frames',
  iconFrame: 87,
  iconDx: -62,
  /** x = W − n/3 + dx — 3틱에 1px */
  xOf: (tick: number, dx: number) => SCREEN.width - Math.trunc(tick / 3) + dx,
  /** y — 8틱에 한 번 1px 위로 튄다 */
  characterYOf: (tick: number) => ((tick & 7) !== 0 ? 137 : 136),
  iconYOf: (tick: number) => ((tick & 7) !== 0 ? 61 : 60),
  /** 띠 아래 = 137 (mode_ui 프레임 10 박스 0 의 아래 끝) */
  y: BAND_WINDOW_BOTTOM,
} as const

/**
 * 엔딩 그림 — `ending.pzx` 이미지 0 (146×96, 원점 (−84,−57) = `public/sprites/ending/frames/origins.json`).
 * 그리기 `0xcaa1d(그림, x = [this+0x2f4] / [this+0x2f0], y = H/2 − h, 16, 2)` 로 **두 번** (P6 4b-4).
 *
 * 가로 자리는 `W/2 − [그림+0x20]` 로 가운데 맞춤 (S9 8-1) → `(240 − 146)/2 = 47`.
 * 세로는 `H/2 − h = 160 − 96 = 64`.
 */
export const ENDING_IMAGE = {
  image: 0,
  width: 146,
  height: 96,
  x: (SCREEN.width - 146) / 2,
  y: SCREEN.height / 2 - 96,
  /**
   * S9 8-1 확정: `[this+0x2f4] = min([this+0x2f4] + 1, 0)` → **한 틱에 1px**,
   * 음수에서 0 까지 올라오고 0 에서 멈춘다.
   */
  step: 1,
  /**
   * ⚠️ 시작 오프셋은 원본에 적혀 있지 않다 — 그림 반폭(73)만큼 왼쪽에서 시작하는 것으로 잡았다 (**근사**).
   * `[this+0x2f0] == 0` 인지로 두 조각 중 어느 쪽을 먼저 움직일지 고르므로(0x886ec·0x887b0)
   * 웹판도 **첫 조각이 0 에 닿은 뒤 두 번째 조각**이 움직인다.
   */
  startOffset: -73,
} as const

/** 조각 i(0·1)의 x — 0 번이 다 올라온 뒤에 1 번이 움직인다 (0x886ec) */
export function endingImageXOf(tick: number, piece: number): number {
  const ticksLeft = tick - piece * -ENDING_IMAGE.startOffset
  const offset = Math.min(ENDING_IMAGE.startOffset + Math.max(ticksLeft, 0) * ENDING_IMAGE.step, 0)
  return ENDING_IMAGE.x + offset
}

/** 그림 두 조각이 모두 제자리에 서는 틱 */
export const ENDING_IMAGE_TICKS = -ENDING_IMAGE.startOffset * 2

/**
 * 원형 전환(아이리스) — 오프스크린 `[0x1552ae4]` 를 검정으로 칠하고 투명색 **RGB(255,0,255)** 원을
 * `0x1400708(가운데 (W/2 + dx, H/2 + dy), 지름 …, 0°~360°)` 로 뚫은 뒤 화면에 덮는다 (P6 4b-5).
 */
/**
 * 아이리스 단계값 — **확정** (S12 6절).
 *
 * ```
 * 0x887ce  r0 = 화면 폭 (0x14008b8 = 240)
 * 0x887ea  D = 240 − [this+0x2fc]
 * ```
 * `[this+0x2fc]` 를 넣는 곳은 딱 둘이고, 원 중심 보정 `[+0x300]`/`[+0x304]` 도 같이 들어간다:
 *
 * | 주소 | `[+0x2fc]` | **D** | 중심 보정 (dx, dy) |
 * |---|---|---|---|
 * | `0x879b6` 단계 설정 | 100 | **140** | (**−58**, **−55**) |
 * | `0x87e2c` 뒤 단계 재설정 | 0 | **240** | (0, 0) |
 */
export const IRIS_STAGES = {
  /** 엔딩이 열릴 때 — 원이 가운데 140px 까지만 열린다 */
  open: { diameter: 140, dx: -58, dy: -55 },
  /** 뒤 단계 — D = 240 이라 화면을 다 덮는다 */
  reveal: { diameter: 240, dx: 0, dy: 0 },
} as const

export const IRIS = {
  centerX: SCREEN.width / 2,
  centerY: SCREEN.height / 2,
  /** 덮는 판 색 */
  cover: '#000000',
  /** 첫 단계 D (0x879b6) — 반지름 식의 기본값 */
  diameter: IRIS_STAGES.open.diameter,
  /** 원 중심 보정 — 가운데 (W/2 + dx, H/2 + dy) (P6 4b 5항) */
  dx: IRIS_STAGES.open.dx,
  dy: IRIS_STAGES.open.dy,
  /** p 가 110 에 걸리는 틱 — 이 뒤로는 r 이 D 에서 멈춘다 */
  fullTick: 7,
} as const

/**
 * 아이리스 반지름 (S9 8-2 **확정**, 0x887dc~0x88846):
 * ```
 * k = (t == 0) ? 90 : 110
 * p = min(16·t, 110)
 * r = ( D − D·k/100 ) + D·p/100          // 나눗셈은 모두 __divsi3 정수 나눗셈
 * ```
 * t = 0 → 0.10·D · t = 1 → 0.06·D · t = 2 → 0.22·D · … · t ≥ 7 → D.
 *
 * ⚠️ t = 1 이 t = 0 보다 **작아지는 것**(0.06 < 0.10)은 원본 그대로다 — 고치지 않는다.
 */
export function irisRadiusOf(tick: number, diameter: number = IRIS.diameter): number {
  const k = tick === 0 ? 90 : 110
  const p = Math.min(16 * tick, 110)
  return diameter - Math.trunc((diameter * k) / 100) + Math.trunc((diameter * p) / 100)
}

/** 원 그리기에 쓰는 값 `[this+0x2f8] = 화면폭 − r` (S9 8-2) — 참고용 */
export const irisDrawValueOf = (tick: number, diameter: number = IRIS.diameter) =>
  SCREEN.width - irisRadiusOf(tick, diameter)

/**
 * 엔딩 글 — StrENDING[결과] 흰 글 가운데 `(0, …, 폭 W)` (P6 4b-6).
 *
 * ⚠️ 나만의리그 쪽 y 는 원본에 적혀 있지 않다. 시즌 엔딩 `0x87a1c` 가 쓰는
 * **`(0, H/2 + 55, 폭 W)`** 를 그대로 썼다 — 띠 창(65~137)·엔딩 그림(64~160) 아래라 겹치지 않는다.
 */
export const ENDING_TEXT = { x: 0, y: SCREEN.height / 2 + 55, width: SCREEN.width } as const

/**
 * 제작진 — StrENDING **[21]** 을 `(0, H − 카운터, W)` 로 **아래에서 위로** 흐른다 (P6 4b-6).
 * 카운터는 그림 이동량과 같은 틱 카운터라 **1px/틱**으로 잡았다 (근사 — 원본 증가폭 미확인).
 */
export const CREDITS = { index: 21, step: 1, x: 0, width: SCREEN.width } as const

export const creditsTopOf = (tick: number) => SCREEN.height - tick * CREDITS.step

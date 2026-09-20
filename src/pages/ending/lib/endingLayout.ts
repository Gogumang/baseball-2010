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
 * 캐릭터 애니 `[this+0x344]` 를 (W − n/3 − 20, 띠 아래) · 선수 그림 `[this+0x15c]` 를 (W − n/3 − 62, …)
 * (n = 틱 카운터 → 오른쪽에서 왼쪽으로 걸어 들어온다, P6 4b-2 **유력**).
 *
 * ⚠️ 두 칸이 **어느 스프라이트 파일**을 가리키는지 아직 못 밝혀(`ppl` 은 관중, `event_char_*` 는 이벤트 얼굴)
 * 웹판은 그림을 그리지 않고 자리 식만 남겨 둔다. 파일이 밝혀지면 이 값으로 바로 그리면 된다.
 */
export const WALK_IN = {
  characterDx: -20,
  playerDx: -62,
  /** x = W − n/3 + dx */
  xOf: (tick: number, dx: number) => SCREEN.width - Math.trunc(tick / 3) + dx,
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
export const IRIS = {
  centerX: SCREEN.width / 2,
  centerY: SCREEN.height / 2,
  /** 덮는 판 색 */
  cover: '#000000',
  /**
   * 반지름 식의 `D` 는 원본이 "앞 단계 값 − [this+0x2fc]" 로 얻는 값이라 정확한 수를 못 읽었다.
   * **화면을 남김없이 덮는 가장 작은 반지름**(대각선 절반 = √(240² + 320²)/2 = 200)을 쓴다 — **근사**.
   * t ≥ 7 에서 r = D 가 되어 "원이 화면을 다 덮는다"(S9 8-2)는 설명과 맞는다.
   */
  diameter: 200,
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

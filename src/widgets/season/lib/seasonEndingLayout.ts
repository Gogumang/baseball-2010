/**
 * **시즌모드 엔딩 화면** 배치 (그리기 `0x87a1c`, 부르는 곳 `0xb7e0` = 상태 **0xf5** — P6 4b **확정**).
 *
 * 원본 한 줄(P6 4b 마지막 항목):
 * > 화면 검정 → 외출 지도 `0x7ea65(…, 1)` 를 배경으로 → 같은 원형 전환 →
 * > `StrENDING[15 + 결과]`(비인기·지역·한국 최고·세계 일류·역사상 최고 구단) 를
 * > **(0, H/2 + 55, 폭 W)** 가운데.
 *
 * 나만의리그 엔딩(`0x882b4`)과 다른 점만 여기에 둔다:
 *   - 배경이 **띠 창 + ending.pzx 두 조각**이 아니라 **외출 지도 한 장**이다
 *   - 걸어 들어오는 캐릭터·선수 그림이 없다
 *   - 글이 `StrENDING[결과]` 가 아니라 **`StrENDING[15 + 결과]`** 다
 * 원형 전환(아이리스)은 **같은 식**이라 S9 8-2 확정식을 그대로 쓴다.
 *
 * ⚠️ 같은 아이리스 값이 `src/pages/ending/lib/endingLayout.ts` 에도 있다(타자편 엔딩).
 * 페이지→페이지는 서로 못 쓰므로 **옮겨 적었다** — 식과 단계값은 한 글자도 다르지 않다.
 */

/** 원본 화면 한 장 */
export const ENDING_SCREEN = { width: 240, height: 320 } as const

/*
 * 배경 = **외출 지도** `0x7ea64(gfx, −1, 1)` (0x87a30~0x87a38 직접 떴다) — 둘째 인자는 고른 칸(−1 = 없음), 셋째는 이름숨김.
 * 그리기는 `pages/season/ui/SeasonOutingMap`(selected −1 · hidesNames)이 맡는다.
 */

/** 화면을 먼저 검정으로 지운다 (`0x6a735`) */
export const ENDING_BACKDROP_COLOR = '#000000'

/**
 * 아이리스 단계값 — **확정** (S12 6절).
 *
 * ```
 * 0x887ce  r0 = 화면 폭 (0x14008b8 = 240)
 * 0x887ea  D = 240 − [this+0x2fc]
 * ```
 * | 주소 | `[+0x2fc]` | **D** | 중심 보정 (dx, dy) |
 * |---|---|---|---|
 * | `0x879b6` 단계 설정 | 100 | **140** | (**−58**, **−55**) |
 * | `0x87e2c` 뒤 단계 재설정 | 0 | **240** | (0, 0) |
 */
export const ENDING_IRIS_STAGES = {
  /** 엔딩이 열릴 때 — 원이 가운데 140px 까지만 열린다 */
  open: { diameter: 140, dx: -58, dy: -55 },
  /** 뒤 단계 — D = 240 이라 화면을 다 덮는다 */
  reveal: { diameter: 240, dx: 0, dy: 0 },
} as const

export const ENDING_IRIS = {
  centerX: ENDING_SCREEN.width / 2,
  centerY: ENDING_SCREEN.height / 2,
  /** 덮는 판 색 — 원본은 오프스크린을 검정으로 칠하고 투명색 RGB(255,0,255) 원을 뚫는다 */
  cover: '#000000',
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
 * ⚠️ **원본 버그 그대로**: t = 1 이 t = 0 보다 **작아진다**(0.06·D < 0.10·D) — 원이 한 번 줄었다
 * 다시 커진다. 고치지 않는다.
 */
export function endingIrisRadiusOf(tick: number, diameter: number): number {
  const k = tick === 0 ? 90 : 110
  const p = Math.min(16 * tick, 110)
  return diameter - Math.trunc((diameter * k) / 100) + Math.trunc((diameter * p) / 100)
}

/**
 * 엔딩 글 — `StrENDING[15 + 결과]` 흰 글 가운데 **(0, H/2 + 55, 폭 W)** (P6 4b **확정**).
 * 결과 0~4 = 비인기 · 지역 인기 · 한국 최고 · 세계 일류 · 역사상 최고 구단
 * (판정은 `entities/season-mode/model/seasonRewards.ts` 의 `judgeSeasonEnding`).
 */
export const SEASON_ENDING_TEXT = {
  x: 0,
  y: ENDING_SCREEN.height / 2 + 55,
  width: ENDING_SCREEN.width,
} as const

/** `StrENDING` 에서 시즌모드 엔딩 글이 시작하는 자리 */
export const SEASON_ENDING_TEXT_BASE = 15
/** 엔딩 결과 칸 수 (0~4) */
export const SEASON_ENDING_COUNT = 5

export function seasonEndingTextIndexOf(endingIndex: number): number {
  return SEASON_ENDING_TEXT_BASE + endingIndex
}

/**
 * **제작진은 시즌 엔딩에 없다** — 0x87a1c 가 StrENDING 에서 꺼내는 글은 `[결과] + 15`(0x87be2~0x87bf4) 하나뿐이다(직접 떴다).
 * `StrENDING[21]` 제작진 흐름은 나만의리그 엔딩 `0x882b4` 차례 6 의 것이다.
 */
export const CREDITS_TEXT_INDEX = 21

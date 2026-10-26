import { sineHundred } from '@/shared/lib/math/originalTrigonometry'

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
 *   - 원형 전환(아이리스)은 나리 엔딩과 **닮았지만 같지 않다** — 0x87a1c 가 따로 그린다(`seasonEndingIrisOf`)
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
 * 아이리스 적재값 — 적재 `0x87998~0x879e2`(상태 0xf5 진입) 가 한 번 세운다(직접 떴다):
 * `[+0x2f8]` = W · `[+0x2fc]` s = **100** · `[+0x300]` dx = **−58** · `[+0x304]` dy = **−55** · `[+0x308]` t = 0.
 * (`0x87e2c` 의 s = 0 재설정은 나리 엔딩 적재 `0x87c7c` 의 것이라 시즌 엔딩에는 없다.)
 */
export const SEASON_ENDING_IRIS = { size: 100, dx: -58, dy: -55 } as const

export const ENDING_IRIS = {
  /** 덮는 판 색 — 원본은 오프스크린을 검정으로 칠하고 투명색 RGB(255,0,255) 원을 뚫는다(0x87ac4~0x87bae) */
  cover: '#000000',
  /** 상태 틱 `[장면+0x2c]` 이 이 값 **이하**면 지도만 그리고 돌아간다 — 원도 안 그리고 t 도 안 센다(0x87a3c~0x87a42 `cmp #0xa; bgt`) */
  firstTickAfter: 10,
  /** 상태 틱이 이 값 **이하**면 글을 안 그린다(0x87bdc~0x87be0 `cmp #0xf; ble`) */
  textTickAfter: 15,
} as const

/**
 * 시즌 엔딩 원형 전환의 원 — 그리기 `0x87a1c` 의 0x87a44~0x87bae 를 그대로 옮겼다(r288 직접 뜸, A-19):
 * ```
 * n = [장면+0x2c](상태 틱, 0xb7e0 이 넘긴다) ≤ 10 → 원 없음 · t 그대로
 * D = W − s                                                       ; 87a4a~87a5a
 * r = D − D·sin(t == 0 ? 90 : 110)/100 + D·sin(min(8t, 110))/100  ; sin = 0x6c6a9(리터럴 0x87c48) · 나눗셈 0xca7b5(__divsi3)
 * [+0x2f8] 지름 = W − r                                           ; 87aac~87aba
 * fillArc(W/2 + dx − (지름 − s), H/2 + dy − (지름 − s), 지름, 지름, 0, 360)   ; 87b4a~87bae, 0x1400708
 * t += 1                                                          ; 87bd4~87bda
 * ```
 * 여기 `tick` 은 상태 틱 n 이고, 원본 t 는 n − 11 이다(n > 10 인 틀마다 1 씩 오른다).
 * 나리 엔딩(`pages/ending/lib/endingLayout.ts` `irisCircleOf`, 0x887ce~)과 다른 점: p 의 배수가 **8t**(`lsls #3` — 나리는 16t)이고,
 * 왼쪽 위 보정이 **(지름 − s)** 그대로다(나리는 (D − r)/2). 그래서 원은 지름 240 에서 줄어 100 에 서고, 가운데가
 * (42, 85) 에서 (112, 155) 로 옮겨 간다 — 원본 그대로.
 * (옛 웹은 사인을 빠뜨리고 반지름으로 그려 원이 한 번 줄었다 커졌다 — B-95 정정 · r282.)
 */
export function seasonEndingIrisOf(tick: number): { readonly x: number; readonly y: number; readonly diameter: number } | null {
  if (tick <= ENDING_IRIS.firstTickAfter) return null
  const t = tick - ENDING_IRIS.firstTickAfter - 1
  const span = ENDING_SCREEN.width - SEASON_ENDING_IRIS.size
  const k = sineHundred(t === 0 ? 90 : 110)
  const p = sineHundred(Math.min(t << 3, 110))
  const r = Math.trunc((span * p) / 100) + (span - Math.trunc((span * k) / 100))
  const diameter = ENDING_SCREEN.width - r
  const shift = diameter - SEASON_ENDING_IRIS.size
  return {
    x: (ENDING_SCREEN.width >> 1) + SEASON_ENDING_IRIS.dx - shift,
    y: (ENDING_SCREEN.height >> 1) + SEASON_ENDING_IRIS.dy - shift,
    diameter,
  }
}

/** 글은 상태 틱 n > 15 부터 (0x87bdc~0x87be0) */
export const isSeasonEndingTextShown = (tick: number) => tick > ENDING_IRIS.textTickAfter

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

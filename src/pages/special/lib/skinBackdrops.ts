/**
 * 스킨(메인 메뉴 객체 [0x1552cfc]) 이 그리는 **두 바탕** — 명예의 전당 목록을 쓰는 화면들이 목록 0x63b15 앞에 깐다.
 *
 * ## 1. 메뉴 바탕 `0x58371(skin, 그림, 다시 짓기)` (직접 떴다, 0x58370~0x58572)
 * 부르는 곳: 스페셜 명예의 전당(하위 27, 0x2dcd8) · 미션 선수 고르기(하위 17, 0x2dec8) · 홈런더비 선수 고르기(하위 16, 0x2df20)
 * · 기록연감(0x2e29c) · 도움말(0x2fc8c) 등 — 모두 `0x58371(skin, [메뉴+0x90] = mainui/main_title.pzx, 0)`.
 * ```
 * 다시 짓기 ≠ 0 (메인 메뉴 들어올 때 0x234d4 · 상태 진입 0x24a40 · 0x25b88 이 1 로 부른다):
 *   0x6a735(gfx, RGB(255,255,255))                                 ; 화면 흰색
 *   0xba759(그림, 13, 프레임, 0, 0)                                  ; main_title 프레임 13 (240×320 전면 그림)
 *   0xba759(그림, 7, 이미지, W − 이미지7폭 − 2, 2)                    ; 이미지 7 (40×46) 을 오른쪽 위 (198, 2)
 *   0xbdd65(1)                                                      ; 화면 흐리기 — 네 이웃 평균 (아래 `blurScreen565`)
 *   y = 0, 3, 6, … < H: 선 0x6a905(gfx, 0, y, W, y, 0x10000000)     ; 3줄마다 검정 선, 색 위 바이트 = 알파 0x10
 *   [0x15605d0](0, 0, W, H, RGB(255,255,255), 단계 3)               ; 화면 전체를 흰색 단계 3 으로 덮기 (`whitenStep3Of565`)
 *   [skin+0x450] = 0xbda01(…, 0x1552ae4)                            ; 그린 화면을 W×H 버퍼에 떠 둔다(메모리 되면 1)
 * 다시 짓기 == 0 (화면들이 매 그림 부르는 쪽):
 *   [skin+0x450] ≠ 0 → 0xbdbcd: 떠 둔 버퍼를 (0, 0) 에 그대로 찍고 끝
 *   아니면 프레임 13 · 이미지 7 · 0xbdd65(0) · 흰 단계 3 덮기 (3줄 선은 없다)
 * ```
 * 메인 메뉴에 들어올 때 버퍼를 떠 두므로 선수 고르기·명예의 전당이 보는 것은 **떠 둔 버퍼** — 3줄 선까지 있는 쪽이다.
 * 같은 버퍼를 0x581dd(경기 쪽 바탕)도 떠 쓰지만, 이 화면들은 메인 메뉴 상태 진입에서 다시 지은 뒤라 0x58371 의 그림이다.
 *
 * ### 1-1. 0xbdd65(모드) = 화면 흐리기 (직접 떴다, 0xbdd64~0xbde7a · 0xbdc2c~0xbdd4a)
 * 처음 한 번 이웃 표를 채운다(s16, 화면 폭 W): 모드 0 표 0x1400330 = [1 − W, W − 1](대각 둘) ·
 * 모드 1 표 0x1400334 = [−1, 1, −W, W](네 이웃 — −1 · 1 은 .data 붙박이) · 모드 2 표 0x140033c = 여덟 이웃.
 * 0xbdc2c(이웃 수 n = 2·4·8, 밀기 1·2·3, 표) 가 16비트 화면 버퍼(0x6a7e5)를 **제자리에서** 훑는다:
 * ```
 * 줄 1 … H−2, 칸 1 … W−2 (왼쪽 위부터):
 *   R = Σ (p & 0xf800) >> 8 · G = Σ (p & 0x7e0) >> 3 · B = Σ (p & 0x1f) << 3     ; 이웃 p = 화면[자리 + 표[i]] (가운데는 안 넣는다)
 *   화면[자리] = 0x1400748(R >> 밀기, G >> 밀기, B >> 밀기)                       ; 색 만들기 — 565 로 묶는다(유력)
 * 줄 0 = 줄 1 · 줄 H−1 = 줄 H−2 (0x1400408 복사) → 줄마다 칸 0 = 칸 1 · 칸 W−1 = 칸 W−2
 * ```
 * 제자리라 왼쪽·위 이웃은 이미 흐려진 값이다 — 오른쪽 아래로 끌리는 흐림(원본 그대로).
 *
 * ### 1-2. [0x15605d0] = 0x9b3f4 — 단계 덮기 (직접 떴다, 0x2ed8 의 0x3118 `0x987f9(1, 0x9a52d, 0x9b3f5)` 가 건다)
 * 0x9b3f4(x, y, w, h, 색, 단계 ≤ 15) 가 자르기 칸과 화면 안으로 줄인 뒤 16비트면 [0x15605e0] = **0x9a52c** 를 부른다.
 * 0x9a52c 는 단계마다 점프표 0xd5f48 의 16 갈래이고 **색 몫 = (단계 + 1) / 16** 이다 — 단계 0 은 화면 15/16 + 색 1/16,
 * 단계 2 는 13/16 + 3/16, 단계 15 는 색 그대로. 단계 3(0x9a628)은 화면 3/4 + 색 1/4 를 마스크 더하기로 한다:
 * `p' = ((p & 0xf7de) >> 1) + ((p & 0xe79c) >> 2) + ((색 & 0xe79c) >> 2)` — 칸마다 낮은 비트를 버린다.
 * (예전 웹은 단계/16 = 3/16 으로 근사했다 — 4/16 이 맞다.)
 *
 * ### 1-3. 선 알파
 * 0x6a905 는 색 위 바이트가 0 · 0xff 가 아니면 플랫폼 그리기 속성 [0x1400698](gc, 4, 알파) 로 알파를 걸고 플랫폼 선 [0x14006c8] 을
 * 부른 뒤 255 로 되돌린다 — 섞기는 플랫폼(단말) 몫이라 바이너리에 식이 없다. ⚠️ 웹은 칸마다 `v × (255 − 0x10) / 255` 로 둔다.
 *
 * ## 2. 공 무늬 바탕 `0x5fd61(skin, x, y, w, h)` (직접 떴다, 0x5fd60~0x5fec0)
 * 부르는 곳: 나리 명예의 전당 등록(상태 145 — 0x16928 이 상태 142~144 밖이면 `0x5fd61(skin, 0, 0, W, H)`) ·
 * 시즌 공통 앞그림 0xb810(0xdd · 0xe0 · 0xe1 밖, 선수영입 0xe2 포함) 등.
 * ```
 * [skin+0x9c](ui/gpoint.pzx) 가 없으면 아무것도 안 그림
 * 0x6a9f1(gfx, 0, 0, W, H, RGB(0x93, 0xc7, 0xe5))                  ; 하늘색 채우기
 * (w, h) = gpoint 이미지 12 크기 (23×23) · 열 = W / w + 3 = 13 · 줄 = H / h + 2 = 15
 * c = [skin+0x414] · 시작 = 2 × (c − w)
 * 0xbae25(x, y, w, h)                                              ; 자르기
 * 줄 r = 0 … 줄−1, 칸 k = 0 … 열−1:
 *   0xba759(gpoint, 애니 0, 종류 2, 시작 + (w + 15)·k − (r 홀수 ? (w + 15) >> 1 : 0), 시작 + (w + 15)·r)
 * 0x93d91(gpoint 애니)                                             ; 애니를 한 번 진행 (그린 뒤)
 * 0xbaf8d()                                                        ; 자르기 풂
 * c < w + 15 ? c + 1 : 1 → [skin+0x414]
 * ```
 * → 공 아이콘(애니 0 = 프레임 0~5 지연 3)이 38px 간격 엇갈린 격자로 깔려 **틱마다 오른쪽 아래로 2px** 흐른다.
 * c 는 1 → 38 을 돌아 시작이 −44 → 30 을 오가는데, 38 에서 1 로 돌 때 74px 만 되돌아가(무늬 한 주기는 76px)
 * 한 바퀴마다 2px 튄다 — **원본 그대로**.
 * [skin+0x414] 를 0 으로 놓는 곳은 스킨을 만들 때 0x5390c(0x53a1e) 하나뿐이라 화면을 건너 이어진다.
 */

export const SKIN_SCREEN = { width: 240, height: 320 } as const

/** 1. 메뉴 바탕 — main_title 프레임 13 · 이미지 7 (40×46) 을 (W − 40 − 2, 2) */
export const MAIN_TITLE_BACKDROP = {
  frame: 13,
  badgeImage: 7,
  badgeWidth: 40,
  badgeX: SKIN_SCREEN.width - 40 - 2,
  badgeY: 2,
  /** 3줄마다 검정 선 — 0x58426 `adds r6, #3` */
  lineStep: 3,
  /** 선 색 0x10000000 의 위 바이트 = 알파 0x10 (/255 — 플랫폼 섞기, 1-3) */
  lineOpacity: 0x10 / 255,
  /** 흰 덮기 단계 3 — 색 몫 (3 + 1)/16 (0x9a628). 캔버스가 없을 때(테스트) 겹쳐 그리는 근사에만 쓴다 */
  whitenOpacity: 4 / 16,
  /** 0xbdd65 의 모드 — 네 이웃 */
  blurMode: 1,
} as const

/* ── 16비트(RGB565) 화면 연산 — 0xbdc2c · 0x9a628 · 0x6a905 ─────────────────────────── */

/** 8비트 → 565 (에셋은 565 를 비트 복제로 늘린 값이라 위 비트만 남기면 원래 값이다) */
export const rgbTo565 = (r: number, g: number, b: number) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)

/** 565 → 8비트 (비트 복제) */
export function rgbOf565(pixel: number): readonly [number, number, number] {
  const r = (pixel >> 11) & 0x1f
  const g = (pixel >> 5) & 0x3f
  const b = pixel & 0x1f
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)]
}

/** 0xbdd64 의 이웃 표 — 모드 0 대각 둘 · 1 네 이웃 · 2 여덟 이웃 (밀기 1 · 2 · 3) */
function neighborOffsetsOf(mode: number, width: number): { readonly offsets: readonly number[]; readonly shift: number } {
  if (mode === 0) return { offsets: [1 - width, width - 1], shift: 1 }
  if (mode === 1) return { offsets: [-1, 1, -width, width], shift: 2 }
  return { offsets: [-width - 1, -width, 1 - width, -1, 1, width - 1, width, width + 1], shift: 3 }
}

/** 0xbdd65(모드) → 0xbdc2c — 제자리 이웃 평균 흐리기와 가장자리 채우기. `pixels` 를 고친다 */
export function blurScreen565(pixels: Uint16Array, width: number, height: number, mode: number): void {
  const { offsets, shift } = neighborOffsetsOf(mode, width)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x
      let r = 0
      let g = 0
      let b = 0
      for (const offset of offsets) {
        const p = pixels[at + offset]
        r += (p & 0xf800) >> 8
        g += (p & 0x7e0) >> 3
        b += (p & 0x1f) << 3
      }
      pixels[at] = rgbTo565(r >> shift, g >> shift, b >> shift)
    }
  }
  pixels.copyWithin(0, width, width * 2)
  pixels.copyWithin((height - 1) * width, (height - 2) * width, (height - 1) * width)
  for (let y = 0; y < height; y += 1) {
    pixels[y * width] = pixels[y * width + 1]
    pixels[y * width + width - 1] = pixels[y * width + width - 2]
  }
}

/** 0x9a628 — 단계 3 덮기: 화면 3/4 + 색 1/4 를 마스크로 더한다 */
export const whitenStep3Of565 = (pixel: number, color: number) =>
  ((pixel & 0xf7de) >> 1) + ((pixel & 0xe79c) >> 2) + ((color & 0xe79c) >> 2)

/** 3줄 선 — 검정 알파 0x10. ⚠️ 섞기는 플랫폼 몫이라 칸마다 v × (255 − 알파) / 255 근사 (1-3) */
export function darkenLine565(pixel: number, alpha: number): number {
  const keep = (value: number) => Math.round((value * (255 - alpha)) / 255)
  return (keep((pixel >> 11) & 0x1f) << 11) | (keep((pixel >> 5) & 0x3f) << 5) | keep(pixel & 0x1f)
}

/** 프레임 13 · 이미지 7 을 그린 화면(565) 에 흐리기 → 3줄 선 → 흰 단계 3 을 차례로 — 0x583fc~0x58476 */
export function finishMainTitleBackdrop565(pixels: Uint16Array, width: number, height: number): void {
  blurScreen565(pixels, width, height, MAIN_TITLE_BACKDROP.blurMode)
  const lineAlpha = 0x10
  for (const y of mainTitleLineYs()) {
    if (y >= height) break
    for (let x = 0; x < width; x += 1) pixels[y * width + x] = darkenLine565(pixels[y * width + x], lineAlpha)
  }
  const white = rgbTo565(255, 255, 255)
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = whitenStep3Of565(pixels[index], white)
}

/** 3줄 선의 y — 0 · 3 · … · 318 */
export function mainTitleLineYs(): readonly number[] {
  const ys: number[] = []
  for (let y = 0; y < SKIN_SCREEN.height; y += MAIN_TITLE_BACKDROP.lineStep) ys.push(y)
  return ys
}

/** 2. 공 무늬 바탕 */
export const BALL_PATTERN_BACKDROP = {
  color: 'rgb(147, 199, 229)',
  /** gpoint 이미지 12 크기 (0x5fdc2 `0xba815(…, 0xc, 0)`) */
  tileWidth: 23,
  tileHeight: 23,
  /** 칸 사이 15 (0x5fe1c · 0x5fe7a `adds #0xf`) */
  gap: 15,
} as const

const { tileWidth, tileHeight, gap } = BALL_PATTERN_BACKDROP
export const BALL_PATTERN_COLUMNS = Math.trunc(SKIN_SCREEN.width / tileWidth) + 3
export const BALL_PATTERN_ROWS = Math.trunc(SKIN_SCREEN.height / tileHeight) + 2
/** 한 주기 — c 가 이 값에 닿으면 1 로 돈다 */
export const BALL_PATTERN_PERIOD = tileWidth + gap

/** [skin+0x414] 다음 값 (0x5fea4~0x5feb8) */
export const nextBallPatternCounter = (counter: number) => (counter < BALL_PATTERN_PERIOD ? counter + 1 : 1)

/** 0 에서 시작해 n 번 그린 뒤의 [skin+0x414] */
export function ballPatternCounterAfter(draws: number): number {
  if (draws <= 0) return 0
  // 0 → 1 → … → 38 → 1 → … (첫 그림 뒤 1, 그 뒤로 38 주기)
  return ((draws - 1) % BALL_PATTERN_PERIOD) + 1
}

/** c 일 때 공 칸들의 왼쪽 위 — 줄마다 홀수 줄은 반 칸 왼쪽 */
export function ballPatternTilesOf(counter: number): readonly { readonly x: number; readonly y: number }[] {
  const start = 2 * (counter - tileWidth)
  const stepX = tileWidth + gap
  // 줄 간격도 높이가 아니라 **폭** + 15 다 (0x5fe74 `adds r3, r2, r7` — r7 = 폭). gpoint 12 는 23×23 이라 같다
  const stepY = tileWidth + gap
  const tiles: { x: number; y: number }[] = []
  for (let row = 0; row < BALL_PATTERN_ROWS; row += 1) {
    for (let column = 0; column < BALL_PATTERN_COLUMNS; column += 1) {
      tiles.push({ x: start + stepX * column - (row % 2 === 1 ? stepX >> 1 : 0), y: start + stepY * row })
    }
  }
  return tiles
}

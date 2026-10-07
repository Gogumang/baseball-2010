/**
 * **G 숫자 `0x54a60(skin, 값, x, y, 폭, 높이, 판, 정렬, 더하기, 둥근판)`** — 직접 떴다(0x54a60~0x54d6c).
 * 그림은 gpoint([skin+0x9c]) 의 **이미지**다: 0~9 숫자(8×8, "1" 만 4×8) · 10 "+"(8×8) · 11 G 동전(18×18).
 *
 * ```
 * 54a8e  글 = sprintf("%d", 값) (0xcbb80) · 합 = Σ(숫자 그림 폭 + 1)            ; 0x54ac0~0x54aec
 * 54afe  판 == 0 이면 54c32 (이 파일 밖 — 아래 xref 전부가 판 1 이다) · 판 ≠ 0:
 * 54b04    정렬 & 0x40 이면 y −= 이미지 0 높이
 * 54b10    둥근판 ≠ 0:  r = (x + 동전폭/2, y + 1, 폭 − 동전폭/2 + 4, 동전높이 − 5)     ; 동전 18×18 → (x+9, y+1, 폭−5, 13)
 *            0x6b7d5(r, 둥글기 1, RGB(0x1d, 0x44, 0xa8)) · 0x6aa65(r, 둥글기 1, 검정)  ; 칠 위에 같은 칸 테두리
 * 54bcc    동전(이미지 11) 을 (x, y − 1)
 * 54be4    숫자 시작 c = x + 폭 − 합 + 2
 * 54bee    더하기 ≠ 0:  이미지 10 "+" 를 (c − "+"폭 − 2, y + 4) (0xba759 종류 0)
 * 54d12    숫자를 (c, y + 4) 부터, 한 자마다 c += 폭 + 1
 * ```
 * 둥근 칠·테두리(둥글기 ≤ 3, 0x6b7d4 · 0x6aa64): R = x + w · B = y + h 일 때 테두리 선은
 * (x+1, y)–(R−1, y) · (x+1, B)–(R−1, B) · (x, y+1)–(x, B−1) · (R, y+1)–(R, B−1), 칠은 그 안 (x+1, y+1, w−1, h−1).
 * 곧 **(w+1)×(h+1)** 칸에 검정 1px 테두리, 네 모서리 점은 비고, 안은 #1D44A8 이다.
 *
 * 부르는 곳 — xref 전부 (BL 0x5510c · 0x5f178, 리터럴 0x54a61 을 읽는 LDR 8곳):
 * - 머리띠 0x54d95 (0x5510c): (skin, G, W − 72, 머리띠y + 0x12, 0x41, 0, 1, 1, 0, 1)
 * - 팀경기 정산 기본 화면 (0x4af50~): (skin, 번 G, W/2 − 0x28, H − 12 − 0x13, 0x46, 0, 1, 2, 1, 1)
 * - 팀경기 정산 기록 판 (0x4adc4 · 0x4ae48): 획득 (…, 0x50, 0x10, 1, 1, 1, 0) · 보유 (…, 0x50, 0x10, 1, 1, 0, 0)
 * - 홈런더비 결과 칸 B 0x45c18 (0x46170 · 0x461ec): 획득 ([+0x17f4], W/2 − 11, H/2 + 9, 0x55, 0x10, 1, 1, 1, 0) ·
 *   보유 (app+0x64, W/2 − 11, H/2 + 29, 0x55, 0x10, 1, 1, 0, 0) — `pages/home-run-derby` 결과 창
 * - ⚠️ 웹에 자리 없음 — 미션 결과 판(0x4a384 의 모드 5·6 갈래 0x4a576~): 획득 ([+0x17f4], W/2 − 11, H/2 − 0x27, 0x50, 0x10,
 *   1, 1, 1, 0) (0x4a73a) · 보유 (app+0x64, W/2 − 11, H/2 − 0x13, 0x50, 0x10, 1, 1, 0, 0) (0x4a7ba). 웹 미션 화면은 끝나면
 *   "미션 성공!/실패" 글자만 띄우고 이 판(창 176×152 · game_ui 프레임 30 · 획득/보유 칸 · 재도전 묻기)이 없다.
 * - ⚠️ 웹에 자리 없음 — 경기 중 기록 달성 알림 0x4e35c (장면 프레임 0x52c50 의 0x53066, 오른쪽에서 밀려 드는 칸 다섯):
 *   ([+0x1b68] 경기 중 G 누계, 칸x + 0x32, 9, 0x2c, 0, 1, 1, 0, 1) (0x4e58e).
 * - 0x5f140 은 인자를 그대로 넘기는 껍데기인데 부르는 곳이 없다(BL·리터럴 모두 0).
 * 곧 **판 == 0 갈래(54c32)는 부르는 곳이 하나도 없다** — 모든 자리의 일곱째 인자가 1 이다. 옮기지 않는다.
 */

export const GAME_POINT_IMAGE = { plus: 10, coin: 11 } as const
const COIN_SIZE = 18
const DIGIT_HEIGHT = 8
const PLUS_WIDTH = 8
/** 둥근판 칠 RGB(0x1d, 0x44, 0xa8) (0x54b48~0x54b50) */
export const GAME_POINT_PLATE_COLOR = '#1D44A8'
export const GAME_POINT_PLATE_EDGE = '#000000'

/** gpoint 숫자 그림 폭 — "1" 만 4px, 나머지 8px (그림 크기) */
export const gamePointDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)

export interface GamePointBadgeArgs {
  readonly value: number
  readonly x: number
  readonly y: number
  /** 다섯째 인자 — 숫자 오른쪽 끝 = x + 폭 + 2 */
  readonly width: number
  /** 여덟째 인자 정렬 — 판 갈래는 비트 0x40(위로 올리기)만 본다 */
  readonly align: number
  /** 아홉째 인자 — 숫자 앞 "+" */
  readonly plus: boolean
  /** 열째 인자 — 동전 뒤 둥근 판 */
  readonly plate: boolean
}

export interface BadgeRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface GamePointBadgeLayout {
  /** 둥근 판 — 안 칠과 검정 테두리 넷 (없으면 null) */
  readonly plate: { readonly fill: BadgeRect; readonly edges: readonly BadgeRect[] } | null
  readonly coin: { readonly x: number; readonly y: number }
  readonly plus: { readonly x: number; readonly y: number } | null
  readonly digits: readonly { readonly digit: number; readonly x: number; readonly y: number }[]
}

/** 0x54a60 의 "판 ≠ 0" 갈래 그림 자리 */
export function gamePointBadgeOf(args: GamePointBadgeArgs): GamePointBadgeLayout {
  // ⚠️ 음수는 원본이 '-' 를 숫자 그림 번호로 잘못 읽는다 — G 는 0 이상이라 웹은 0 으로 자른다
  const digits = [...String(Math.max(0, Math.trunc(args.value)))].map(Number)
  const total = digits.reduce((sum, digit) => sum + gamePointDigitWidthOf(digit) + 1, 0)
  const y = (args.align & 0x40) !== 0 ? args.y - DIGIT_HEIGHT : args.y

  let plate: GamePointBadgeLayout['plate'] = null
  if (args.plate) {
    const half = Math.trunc(COIN_SIZE / 2)
    const left = args.x + half
    const top = y + 1
    const w = args.width - half + 4
    const h = COIN_SIZE - 5
    const right = left + w
    const bottom = top + h
    plate = {
      fill: { x: left + 1, y: top + 1, width: w - 1, height: h - 1 },
      edges: [
        { x: left + 1, y: top, width: right - left - 1, height: 1 },
        { x: left + 1, y: bottom, width: right - left - 1, height: 1 },
        { x: left, y: top + 1, width: 1, height: bottom - top - 1 },
        { x: right, y: top + 1, width: 1, height: bottom - top - 1 },
      ],
    }
  }

  let cursor = args.x + args.width - total + 2
  const plus = args.plus ? { x: cursor - PLUS_WIDTH - 2, y: y + 4 } : null
  const placed = digits.map((digit) => {
    const at = { digit, x: cursor, y: y + 4 }
    cursor += gamePointDigitWidthOf(digit) + 1
    return at
  })
  return { plate, coin: { x: args.x, y: y - 1 }, plus, digits: placed }
}

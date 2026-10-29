/** k = 3 선공/구장 (0x640e2~0x647b2) — 기준점 · 꼬리표 · 구장 줄 · 화살 · 값 두 줄 */
import { measuredTitleCenterXOf } from '@/shared/lib/font'
import { SCREEN } from './prepareCommon'

export const FIRST_BAT_LAYOUT = {
  anchorA: { x: 52, y: 110 },
  anchorB: { x: 188, y: 92 },
  /** slt_frame 이미지 122 "VS"(37×26) 을 (W/2 − 18, H/2 − 15 − 63) */
  vs: { image: 122, x: SCREEN.width / 2 - 18, y: 82, width: 37, height: 26 },
  /**
   * 선공 꼬리표 slt_frame 이미지 19 (28×18) + img_text 52 "선공" — 커서 [skin+0x74] 쪽 엠블럼 옆 (k 3 0x641c4~0x642e0 · k 4 0x64d8a~0x64e5c, 직접 떴다).
   * 아래 값은 깜빡 [sp+0xd4] 가 **꺼진** 틀이고, 켜진 틀은 `FIRST_BAT_TAG_BOB` 만큼 바깥으로 2px 나간다 (`firstBatTagPlacementOf`).
   * ```
   * 유저  꼬리표 효과 0x11(좌우 뒤집기) (A.x + 0x1b − 2, A.y − 0x31 + 2) · 글 (A.x + 0x22 − 2, A.y − 0x2f + 2)   ; 켜지면 −2 · +2 를 빼지 않는다
   * CPU   꼬리표 (B.x − 0x3a + 2, B.y − 0x29 + 2) · 글 (B.x − 0x38 + 2, B.y − 0x27 + 2)
   * ```
   */
  firstBatTag: {
    image: 19,
    width: 28,
    height: 18,
    cpu: { dx: -56, dy: -39, textDx: -54, textDy: -37 },
    user: { dx: 25, dy: -47, textDx: 32, textDy: -45 },
    textFrame: 52,
  },
  /**
   * 고른 쪽 엠블럼 뒤 반투명 노랑 원 — 단계 0([skin+0xcc] == 0)이고 깜빡일 때만 0x6b7b9(gfx, 기준 − 41, 기준 − 41, 82, 82, 0x80FFFF00, 0, 360)
   * (0x6413c~0x64178). 엠블럼보다 먼저 그린다.
   */
  sideCircle: { radius: 41, color: 'rgba(255, 255, 0, 0.502)' },
  /** 아래 판 0x5461d(skin, W/2 − 102, H/2 + 30, 204, 80) */
  panel: { x: 18, y: 190, width: 204, height: 80 },
  /** 구장 줄 — game_ui **프레임 22**(187×15) 을 (27, H/2 + 38), 이름은 막대 가운데 y = 200 */
  stadiumBar: { frame: 22, x: 27, y: 198, width: 187, height: 15 },
  /** 구장 이름 = img_text 프레임 **192 + 구장** */
  stadiumNameFrame: 192,
  stadiumNameY: 200,
  /** 구장 이름 그림은 막대 가운데 — `W/2 − (w >> 1)` (0x64780~0x647a6) */
  stadiumNameCenterX: SCREEN.width / 2,
  /**
   * 좌우 화살 slt_frame 이미지 20 (5×8) — **단계와 상관없이 늘** 그린다 (0x644ac~0x64576, 직접 떴다).
   * 왼쪽 (W/2 − 막대폭/2 + 3 + dL, H/2 + 0x29) · 오른쪽 효과 0x11 (W/2 + 막대폭/2 − 8 + dR, H/2 + 0x29), 막대폭 = game_ui 프레임 22 의 187.
   * dL = −2 · dR = +2 는 단계 1([skin+0xcc] == 1) · 깜빡 [sp+0xd4] 이고 커서가 첫 칸 뒤 / 끝 칸 앞일 때만 (`stadiumArrowsOf`).
   */
  arrow: {
    image: 20,
    width: 5,
    height: 8,
    y: SCREEN.height / 2 + 0x29,
    leftX: SCREEN.width / 2 - (187 >> 1) + 3,
    rightX: SCREEN.width / 2 + (187 >> 1) - 8,
    bob: 2,
  },
  /**
   * 단계 1 이고 깜빡일 때 구장 막대 자리에 반투명 노랑 둥근 칠 0x6b7d5(gfx, 막대x − 1, 막대y − 1, 막대폭 + 1, 막대높이 + 1, 둥글기 1, 0x80FFFF00)
   * (0x6432e~0x6438e) → (26, 197, 188, 16).
   */
  stadiumHighlight: { x: 26, y: 197, width: 188, height: 16, color: 'rgba(255, 255, 0, 0.502)' },
  /** stadium_symbol 이미지 구장번호(91×40) 을 (28, H/2 + 58) */
  stadiumSymbol: { x: 28, y: 218, width: 91, height: 40 },
  /** 오른쪽 정보 두 줄 — game_ui **프레임 21**(92×15) */
  infoBars: [
    { frame: 21, x: 121, y: 220, width: 92, height: 15 },
    { frame: 21, x: 121, y: 240, width: 92, height: 15 },
  ],
  /** 딱지 img_text 190 "연고지" (125, 223) · 191 "좌석" (130, 243) */
  infoLabels: [
    { frame: 190, x: 125, y: 223 },
    { frame: 191, x: 130, y: 243 },
  ],
  /**
   * 값 두 줄 — **0xba269 폭 −1** 이라 막대 가운데가 아니다 (0x64688~0x6472c 직접 뜸):
   * ```
   * 646ca  연고지 0xba269("!C!cffffff%s"(0xcf2e0) 도시, W/2 + 막대폭/2 + 8, H/2 + 0x3e, −1, −1)    ; 막대폭 = game_ui 프레임 21 의 92
   * 6472c  좌석   0xba269("!C!cffffff%d석"(0xd2488) 수, W/2 + 막대폭/2 − 1, H/2 + 0x52, −1, −1)   ; 같은 r6 = 0xba269 를 다시 부른다
   * ```
   * 폭 −1 = 날 글 폭(서식 글자까지 잰 0x9c52c)이고 `!C` 줄은 x + (폭 >> 1) 이 가운데다(`measuredTitleCenterXOf`).
   * 막대폭/2 는 C 나눗셈 `(v + 부호) >> 1` (0x646a2~0x646ae) — 92 → 46.
   */
  infoValues: [
    { x: SCREEN.width / 2 + (92 >> 1) + 8, y: SCREEN.height / 2 + 0x3e, format: '!C!cffffff%s' },
    { x: SCREEN.width / 2 + (92 >> 1) - 1, y: SCREEN.height / 2 + 0x52, format: '!C!cffffff%d석' },
  ],
} as const

/** 깜빡이 켜지면 꼬리표가 바깥으로 2px — 유저 (+2, −2) · CPU (−2, −2) */
export const FIRST_BAT_TAG_BOB = { user: { x: 2, y: -2 }, cpu: { x: -2, y: -2 } } as const

/** 선공 꼬리표 · 글의 자리 (k 3 · 4 공용) */
export function firstBatTagPlacementOf(isUser: boolean, anchor: { readonly x: number; readonly y: number }, isBob: boolean) {
  const offset = isUser ? FIRST_BAT_LAYOUT.firstBatTag.user : FIRST_BAT_LAYOUT.firstBatTag.cpu
  const bob = isBob ? (isUser ? FIRST_BAT_TAG_BOB.user : FIRST_BAT_TAG_BOB.cpu) : { x: 0, y: 0 }
  return {
    tag: { x: anchor.x + offset.dx + bob.x, y: anchor.y + offset.dy + bob.y },
    text: { x: anchor.x + offset.textDx + bob.x, y: anchor.y + offset.textDy + bob.y },
  }
}

/** 구장 줄 좌우 화살 x — 단계 1 · 깜빡일 때 커서가 움직일 수 있는 쪽으로 2px (0x644ac~0x644ce) */
export function stadiumArrowsOf(isStadiumStage: boolean, isBob: boolean, cursor: number, count: number) {
  const { leftX, rightX, bob } = FIRST_BAT_LAYOUT.arrow
  const active = isStadiumStage && isBob
  return {
    leftX: leftX - (active && cursor > 0 ? bob : 0),
    rightX: rightX + (active && cursor < count - 1 ? bob : 0),
  }
}

/**
 * 구장 값 두 줄의 보이는 글과 가운데 x — `FIRST_BAT_LAYOUT.infoValues` 의 서식에 값을 넣은 **날 글**을 재서
 * x + (폭 >> 1) 를 가운데로 둔다 (0xba269 폭 −1, 0x646ca · 0x6472c). 값이 없으면(구장 표 미추출) 빈 글.
 */
export function stadiumInfoValuesOf(stadium: { readonly city: string | null; readonly capacity: number } | null | undefined) {
  const [cityLine, seatLine] = FIRST_BAT_LAYOUT.infoValues
  if (stadium === null || stadium === undefined)
    return [
      { text: '', centerX: cityLine.x },
      { text: '', centerX: seatLine.x },
    ]
  // 히든 번호(10~14)는 연고지 칸이 없다(`stadiumInfoOf` 의 city null) — 화면처럼 빈 글로 잰다
  const city = stadium.city ?? ''
  const seats = `${stadium.capacity}석`
  return [
    { text: city, centerX: measuredTitleCenterXOf(cityLine.x, cityLine.format.replace('%s', city)) },
    { text: seats, centerX: measuredTitleCenterXOf(seatLine.x, seatLine.format.replace('%d석', seats)) },
  ]
}

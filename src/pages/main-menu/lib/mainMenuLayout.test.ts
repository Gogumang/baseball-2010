import { describe, expect, it } from 'vitest'
import {
  MENU_DESCRIPTION_PANEL, MENU_DESCRIPTION_TEXT_BOX, MENU_LABEL_HEIGHT, MENU_REEL_ITEM_COUNT,
  MENU_REEL_ITEM_FRAMES, MENU_REEL_ROW_STEP, MENU_REEL_SCROLL_STEPS, MENU_REEL_SHADOW_COLOR,
  MENU_REEL_SLOTS, MENU_REEL_SLOT_TABLE, MENU_REEL_TEXT_CENTER_X, MENU_WHEEL_ANGLES,
  MENU_WHEEL_CENTER, MENU_WHEEL_ITEM_FRAMES, MENU_WHEEL_ORDER, MENU_WHEEL_RINGS,
  MENU_WHEEL_SELECTED_SLOT, MENU_WHEEL_TURN_TICKS, SCREEN_HEIGHT, SCREEN_WIDTH,
  MENU_BAND_COLOR, MENU_BAND_FIRST_SPREAD, MENU_BAND_GROW_TICKS, MENU_BAND_LEFT,
  MENU_BAND_MAX_SPREAD, MENU_BAND_PIVOT_Y, MENU_BAND_RIGHT,
  isMenuWheelAngleDrawn, menuBandAlphaAt, menuBandLinesOf, menuBandStateAt, menuPanelHeadingFrameOf, menuPanelHeadingTopLeftOf,
  menuPanelLabelTopLeftOf, menuReelEntryAtSlotOf, menuReelFrameListOf, menuReelOrderOf,
  menuReelSlotRowOf, menuReelTextTopLeftOf, menuWheelAngleAt, menuWheelLabelTopLeftOf,
  menuWheelOrderOf, menuWheelPointOf, menuWheelStepOf, rotateMenuReel,
} from '@/pages/main-menu/lib/mainMenuLayout'

describe('반원 바퀴 — 원본 값 (0x24b1c, 확정)', () => {
  it('중심은 (120,320) 이고 테두리 원은 93·95·97 세 겹이다', () => {
    expect(MENU_WHEEL_CENTER).toEqual({ x: 120, y: 320 })
    expect(MENU_WHEEL_RINGS.map((ring) => ring.radius)).toEqual([93, 95, 97])
    expect(MENU_WHEEL_RINGS.map((ring) => ring.color)).toEqual([
      'rgb(37, 55, 120)', 'rgb(138, 185, 235)', 'rgb(36, 55, 120)',
    ])
  })

  it('각도 표 0xcead4 · 순서 표 0xceae0 · 칸 글자 표 0xcea6c 를 그대로 쓴다', () => {
    expect([...MENU_WHEEL_ANGLES]).toEqual([0, 45, 90, 180, 270, 315])
    expect([...MENU_WHEEL_ORDER]).toEqual([0, 1, 2, 3, 4, 5])
    // 0xcea6c 를 binary.mod 에서 u32 6개로 직접 읽었다 — 게임문의만 5 가 아니라 26 이다
    expect([...MENU_WHEEL_ITEM_FRAMES]).toEqual([0, 1, 2, 3, 4, 26])
  })

  it('칸 자리가 문서에 적힌 네 점과 같다', () => {
    expect(menuWheelPointOf(180)).toEqual({ x: 27, y: 320 })
    expect(menuWheelPointOf(270)).toEqual({ x: 120, y: 227 })
    expect(menuWheelPointOf(0)).toEqual({ x: 233, y: 320 })
    // 문서는 "약 (206,254)" 라고 적는다. `>> 16` 이 −∞ 쪽으로 자르므로 x 는 205 다.
    expect(menuWheelPointOf(315)).toEqual({ x: 205, y: 254 })
  })

  it('20px 보정은 각도가 [90,270] 밖일 때만 붙는다', () => {
    expect(menuWheelPointOf(90).x).toBe(MENU_WHEEL_CENTER.x)
    expect(menuWheelPointOf(270).x).toBe(MENU_WHEEL_CENTER.x)
    // 270 을 아주 조금만 지나도 20 이 붙는다 — 원본 식 그대로다(도는 도중 x 가 튄다)
    expect(menuWheelPointOf(271).x - menuWheelPointOf(269).x).toBeGreaterThanOrEqual(20)
  })

  it('19 ≤ a ≤ 341 만 그린다 — 고른 칸(0°) 은 아예 안 그려진다 (0x24ef0)', () => {
    expect(isMenuWheelAngleDrawn(0)).toBe(false)
    expect(isMenuWheelAngleDrawn(18)).toBe(false)
    expect(isMenuWheelAngleDrawn(19)).toBe(true)
    expect(isMenuWheelAngleDrawn(341)).toBe(true)
    expect(isMenuWheelAngleDrawn(342)).toBe(false)
    expect(MENU_WHEEL_ANGLES[MENU_WHEEL_SELECTED_SLOT]).toBe(0)
  })
})

describe('바퀴 돌리기 — 배열이 돈다 (0x24c58 → 0x24780)', () => {
  it('고른 칸은 늘 배열 0번이다', () => {
    for (let cursor = 0; cursor < 6; cursor += 1) {
      expect(menuWheelOrderOf(cursor)[0]).toBe(cursor)
    }
  })

  it('여섯 칸이 여섯 자리를 하나씩 차지한다', () => {
    const order = menuWheelOrderOf(2)
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
    expect(order).toEqual([2, 3, 4, 5, 0, 1])
  })

  it('한 틱은 9°, 90° 벌어지는 자리만 18° 다 (0x24de6)', () => {
    expect(menuWheelStepOf(315, -2)).toBe(9)
    expect(menuWheelStepOf(270, -2)).toBe(18)
    expect(menuWheelStepOf(180, -2)).toBe(18)
    expect(menuWheelStepOf(180, -1)).toBe(18)
    expect(menuWheelStepOf(90, -1)).toBe(18)
    expect(menuWheelStepOf(90, -2)).toBe(9)
  })

  it('5틱이면 어느 자리든 이웃 자리의 각에 딱 맞는다', () => {
    // ↓(−2) 는 각이 줄고, ↑(−1) 은 각이 는다 — 다섯 틱에 표의 이웃 각으로 떨어진다
    const down = [0, 1, 2, 3, 4, 5].map((slot) => menuWheelAngleAt(slot, -2, MENU_WHEEL_TURN_TICKS))
    expect(down).toEqual([315, 0, 45, 90, 180, 270])
    const up = [0, 1, 2, 3, 4, 5].map((slot) => menuWheelAngleAt(slot, -1, MENU_WHEEL_TURN_TICKS))
    // 0 자리는 360 으로 잘린다 (0x24e2e) — 360 은 0 과 같은 자리다
    expect(up).toEqual([45, 90, 180, 270, 315, 360])
  })

  it('도는 동안 315° 칸은 틱마다 9°, 270° 칸은 18° 움직인다', () => {
    expect([0, 1, 2, 3, 4].map((n) => menuWheelAngleAt(5, -2, n))).toEqual([315, 306, 297, 288, 279])
    expect([0, 1, 2, 3, 4].map((n) => menuWheelAngleAt(4, -2, n))).toEqual([270, 252, 234, 216, 198])
  })

  it('칸 그림은 기준점 가운데 맞춤이다', () => {
    expect(menuWheelLabelTopLeftOf({ x: 120, y: 227 }, 42, 10)).toEqual({ x: 99, y: 222 })
  })
})

describe('세로 릴 — 표 넷 (0x2524c, 확정)', () => {
  it('슬롯 표 0xceaf2 는 s8[6][9] 이고 상태−5 로 색인한다', () => {
    expect(MENU_REEL_SLOT_TABLE).toHaveLength(6)
    expect([...menuReelSlotRowOf(5)]).toEqual([-1, 5, 6, 7, 1, 2, 3, 4, -1])
    expect([...menuReelSlotRowOf(6)]).toEqual([-1, 6, 7, 8, 1, 2, 3, 4, 5])
    expect([...menuReelSlotRowOf(9)]).toEqual([-1, -1, 5, 6, 2, 3, 4, -1, -1])
  })

  it('항목 글자 표는 img_text 프레임 번호다', () => {
    expect([...MENU_REEL_ITEM_FRAMES[5]]).toEqual([-1, 6, 9, 12, 15, 18, 20, 23, -1])
    expect([...MENU_REEL_ITEM_FRAMES[6]]).toEqual([-1, 7, 11, 189, 14, 17, 19, 21, 315])
    expect([...MENU_REEL_ITEM_FRAMES[9]]).toEqual([-1, -1, 9, 12, 15, 18, 20, -1, -1])
  })

  it('표에서 −1 을 뺀 개수가 진입 코드의 항목 수와 같다', () => {
    for (const state of [5, 6, 9]) {
      expect(menuReelFrameListOf(MENU_REEL_ITEM_FRAMES[state])).toHaveLength(MENU_REEL_ITEM_COUNT[state])
    }
    expect(menuReelFrameListOf(MENU_REEL_ITEM_FRAMES[5])).toEqual([6, 9, 12, 15, 18, 20, 23])
  })
})

describe('릴 회전 0x24780 — −1 이 아닌 구간만 돈다', () => {
  it('dir −1 은 오른쪽, −2 는 왼쪽으로 한 칸 돌린다', () => {
    const items = [-1, 1, 2, 3, 4, -1]
    expect(rotateMenuReel(items, -1)).toEqual([-1, 4, 1, 2, 3, -1])
    expect(rotateMenuReel(items, -2)).toEqual([-1, 2, 3, 4, 1, -1])
  })

  it('구간 밖(−1 자리)은 그대로 둔다', () => {
    expect(rotateMenuReel([-1, -1, 7, 8, -1], -2)).toEqual([-1, -1, 8, 7, -1])
  })

  it('커서만큼 왼쪽으로 돌린 것이 그 커서의 배열이다', () => {
    const frames = MENU_REEL_ITEM_FRAMES[5]
    expect(menuReelOrderOf(frames, 0)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, -1])
    expect(menuReelOrderOf(frames, 1)).toEqual([-1, 1, 2, 3, 4, 5, 6, 0, -1])
    expect(menuReelOrderOf(frames, 6)).toEqual([-1, 6, 0, 1, 2, 3, 4, 5, -1])
  })
})

describe('릴 슬롯 배치', () => {
  const frames = MENU_REEL_ITEM_FRAMES[5]
  const row = menuReelSlotRowOf(5)

  it('고른 칸은 늘 슬롯 4 이고, 슬롯 4 는 안 그린다', () => {
    for (let cursor = 0; cursor < 7; cursor += 1) {
      expect(menuReelEntryAtSlotOf(frames, row, cursor, 4)).toBe(cursor)
    }
    expect([...MENU_REEL_SLOTS]).toEqual([1, 2, 3, 5, 6, 7])
    expect(menuReelTextTopLeftOf(4, 42, 0)).toBeNull()
  })

  it('위 세 줄은 고른 칸 **앞** 세 항목이다', () => {
    // 커서 0(최근게임) 이면 위 세 줄은 4·5·6 = 대전모드·홈런더비·미션모드다
    expect([1, 2, 3].map((slot) => menuReelEntryAtSlotOf(frames, row, 0, slot))).toEqual([4, 5, 6])
    // 한 칸 내려가면 방금 고르고 있던 칸이 판 바로 위(슬롯 3)로 올라온다
    expect([1, 2, 3].map((slot) => menuReelEntryAtSlotOf(frames, row, 1, slot))).toEqual([5, 6, 0])
  })

  it('아래 세 줄은 고른 칸 **뒤** 세 항목이다 (화면 밖이지만 원본은 그린다)', () => {
    expect([5, 6, 7].map((slot) => menuReelEntryAtSlotOf(frames, row, 0, slot))).toEqual([1, 2, 3])
  })

  it('랭킹(상태 9)은 다섯 칸이 슬롯 2·3·4·5·6 에만 놓인다', () => {
    const rankRow = menuReelSlotRowOf(9)
    const rankFrames = MENU_REEL_ITEM_FRAMES[9]
    const filled = [1, 2, 3, 4, 5, 6, 7]
      .filter((slot) => menuReelEntryAtSlotOf(rankFrames, rankRow, 0, slot) !== null)
    expect(filled).toEqual([2, 3, 4, 5, 6])
  })
})

describe('릴 좌표 — 원본 식 그대로 (0x255aa · 0x2562c)', () => {
  it('글자 가운데 x 는 240 − 0x28 = 200 이다', () => {
    expect(MENU_REEL_TEXT_CENTER_X).toBe(200)
    const width = 42
    const left = menuReelTextTopLeftOf(1, width, 0)?.x
    expect(left).toBe(200 - Math.trunc(width / 2))
  })

  it('줄 간격은 20px 이고, 위 세 줄은 233·253·273 이다', () => {
    expect(MENU_REEL_ROW_STEP).toBe(20)
    expect([1, 2, 3].map((slot) => menuReelTextTopLeftOf(slot, 42, 0)?.y)).toEqual([233, 253, 273])
  })

  it('아래 세 줄은 360·380·400 — 240×320 화면 밖이다 (원본 그대로)', () => {
    const tops = [5, 6, 7].map((slot) => menuReelTextTopLeftOf(slot, 42, 0)?.y)
    expect(tops).toEqual([360, 380, 400])
    for (const top of tops) expect(top).toBeGreaterThan(SCREEN_HEIGHT)
  })

  it('i ≥ 5 는 i ≤ 3 과 다른 상수(0x3c)를 써서 47px 어긋난다 — 슬롯 4 를 뺀 자리보다 아래다', () => {
    // 슬롯 3 이 273 이니 같은 식이면 슬롯 5 는 313 이어야 하는데 실제로는 360 이다
    expect(menuReelTextTopLeftOf(5, 42, 0)!.y - (273 + 2 * MENU_REEL_ROW_STEP)).toBe(47)
  })

  it('스크롤은 ±1 → ±4 → ±16 석 장이고 글자를 그대로 민다', () => {
    expect([...MENU_REEL_SCROLL_STEPS]).toEqual([1, 4, 16])
    expect(menuReelTextTopLeftOf(1, 42, -16)?.y).toBe(233 - 16)
    expect(menuReelTextTopLeftOf(1, 42, 16)?.y).toBe(233 + 16)
  })

  it('그림자 색은 #212B70 이다 (0x255c8)', () => {
    expect(MENU_REEL_SHADOW_COLOR).toBe('#212b70')
  })
})

describe('설명 판 — 두 단이 같은 자리에 놓는다 (0x24db0 · 0x256fc)', () => {
  it('판은 (96,289) 에 149×63 이다', () => {
    expect(MENU_DESCRIPTION_PANEL.x).toBe(96)
    expect(MENU_DESCRIPTION_PANEL.y).toBe(289)
    expect(MENU_DESCRIPTION_PANEL.width).toBe(149)
    expect(MENU_DESCRIPTION_PANEL.height).toBe(63)
  })

  it('판 아래 절반과 오른쪽 5px 은 화면 밖이다 — 원본이 그렇다', () => {
    expect(MENU_DESCRIPTION_PANEL.y + MENU_DESCRIPTION_PANEL.height).toBe(352)
    expect(MENU_DESCRIPTION_PANEL.x + MENU_DESCRIPTION_PANEL.width).toBe(245)
  })

  it('글칸은 판에서 5px 씩 들어간 자리다', () => {
    expect(MENU_DESCRIPTION_TEXT_BOX).toEqual({ x: 101, y: 294, width: 139, height: 53 })
  })

  it('판 안 큰 글자는 판 가운데에서 (+2,+5) 다 — 27px 글자는 윗 8px 만 보인다', () => {
    const at = menuPanelLabelTopLeftOf(95, MENU_LABEL_HEIGHT)
    expect(at).toEqual({ x: 96 + ((149 - 95) >> 1) + 2, y: 312 })
    expect(SCREEN_HEIGHT - at.y).toBe(8)
  })

  it('판 왼쪽 위 회색 제목은 (판+8,판+8) 이고 번호는 0xcea6c[상태−5] 다', () => {
    expect(menuPanelHeadingTopLeftOf()).toEqual({ x: 104, y: 297 })
    expect(menuPanelHeadingFrameOf(5)).toBe(0) // 게임시작
    expect(menuPanelHeadingFrameOf(6)).toBe(1) // 스페셜
    expect(menuPanelHeadingFrameOf(9)).toBe(4) // 랭킹
  })
})

describe('아랫단 바탕 띠 — 0x253e8~0x2548e · 0x254d4~0x25516 (확정)', () => {
  it('가로 구간은 폭−0x50 → 폭 = 160 → 240 이고 축은 y = 높이 = 320 이다', () => {
    expect(MENU_BAND_LEFT).toBe(160)
    expect(MENU_BAND_RIGHT).toBe(SCREEN_WIDTH)
    expect(MENU_BAND_PIVOT_Y).toBe(SCREEN_HEIGHT)
    // 릴 글자 가운데(폭−0x28 = 200)가 띠 한가운데다
    expect((MENU_BAND_LEFT + MENU_BAND_RIGHT) / 2).toBe(MENU_REEL_TEXT_CENTER_X)
  })

  it('색은 0x192e74 다', () => {
    expect(MENU_BAND_COLOR).toEqual({ r: 0x19, g: 0x2e, b: 0x74 })
  })

  it('알파는 254 에서 2씩 줄고 4 에서 멈춘다', () => {
    expect(menuBandAlphaAt(0)).toBe(254)
    expect(menuBandAlphaAt(1)).toBe(252)
    expect(menuBandAlphaAt(124)).toBe(6)
    expect(menuBandAlphaAt(125)).toBe(4)
    expect(menuBandAlphaAt(126)).toBe(4)
    expect(menuBandAlphaAt(MENU_BAND_MAX_SPREAD)).toBe(4)
  })

  it('멈추는 값은 폭/2(120) 가 아니라 높이/2(160) 다 — 0x254f0 이 부르는 것이 높이다', () => {
    expect(MENU_BAND_MAX_SPREAD).toBe(160)
    expect(MENU_BAND_MAX_SPREAD).not.toBe(SCREEN_WIDTH >> 1)
  })

  it('한 틱에 ×4 로 자라 1 → 4 → 16 → 64 → 160 을 그린다', () => {
    expect(MENU_BAND_FIRST_SPREAD).toBe(1)
    expect([0, 1, 2, 3, 4, 5].map((tick) => menuBandStateAt(tick).spread))
      .toEqual([1, 4, 16, 64, 160, 160])
  })

  it('다 자랄 때까지 넉 틱이고 그동안만 릴 줄을 안 그린다', () => {
    expect(MENU_BAND_GROW_TICKS).toBe(4)
    expect([0, 1, 2, 3].map((tick) => menuBandStateAt(tick).isGrowing)).toEqual([true, true, true, true])
    expect(menuBandStateAt(4).isGrowing).toBe(false)
  })

  it('선은 축 위아래로 대칭이고 같은 알파를 쓴다', () => {
    const lines = menuBandLinesOf(2)
    expect(lines).toEqual([
      { y: 320, alpha: 254 }, { y: 320, alpha: 254 },
      { y: 319, alpha: 252 }, { y: 321, alpha: 252 },
      { y: 318, alpha: 250 }, { y: 322, alpha: 250 },
    ])
  })

  it('다 자라면 화면에 보이는 것은 y 160~319 — 바닥에서 160px 올라온 띠다', () => {
    const lines = menuBandLinesOf(MENU_BAND_MAX_SPREAD)
    const visible = lines.filter((line) => line.y >= 0 && line.y < SCREEN_HEIGHT)
    expect(Math.min(...visible.map((line) => line.y))).toBe(160)
    expect(Math.max(...visible.map((line) => line.y))).toBe(319)
    // 위 160줄만 남는다 — 축(y=320) 과 아래 절반 162줄은 원본에서도 버려진다
    expect(visible.length).toBe(MENU_BAND_MAX_SPREAD)
    expect(lines.length).toBe(2 * (MENU_BAND_MAX_SPREAD + 1))
  })

  it('[메뉴+0xe4] 가 0 이면 축 한 줄뿐이라 아무것도 안 보인다', () => {
    const lines = menuBandLinesOf(0)
    expect(lines.every((line) => line.y === SCREEN_HEIGHT)).toBe(true)
  })
})

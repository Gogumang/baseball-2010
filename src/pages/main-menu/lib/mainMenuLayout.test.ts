import { describe, expect, it } from 'vitest'
import {
  MENU_LABEL_HEIGHT, MENU_ROW_STEP, MENU_WHEEL_ANGLES, MENU_WHEEL_CENTER,
  MENU_WHEEL_ORDER, MENU_WHEEL_RINGS, MENU_WHEEL_SELECTED_SLOT, MENU_WHEEL_TURN_TICKS,
  MENU_DESCRIPTION_PANEL, isMenuWheelAngleVisible, menuDescriptionPanelOf, menuRowTopOf,
  menuWheelAngleOf, menuWheelDeltaOf, menuWheelLabelTopLeftOf, menuWheelPointOf,
  menuWheelSlotOf, menuWheelTurnAngleOf,
} from '@/pages/main-menu/lib/mainMenuLayout'

describe('반원 바퀴 — 원본 값 (F-ui-layout 4-2 확정)', () => {
  it('중심은 (120,320) 이고 테두리 원은 93·95·97 세 겹이다', () => {
    expect(MENU_WHEEL_CENTER).toEqual({ x: 120, y: 320 })
    expect(MENU_WHEEL_RINGS.map((ring) => ring.radius)).toEqual([93, 95, 97])
    expect(MENU_WHEEL_RINGS.map((ring) => ring.color)).toEqual([
      'rgb(37, 55, 120)', 'rgb(138, 185, 235)', 'rgb(36, 55, 120)',
    ])
  })

  it('각도 표 0xcead4 와 순서 표 0xceae0 을 그대로 쓴다', () => {
    expect([...MENU_WHEEL_ANGLES]).toEqual([0, 45, 90, 180, 270, 315])
    expect([...MENU_WHEEL_ORDER]).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('칸 자리가 문서에 적힌 네 점과 같다', () => {
    // 180 = 왼쪽 끝, 270 = 맨 위(선택), 315 = 오른쪽 위, 0 = 오른쪽 끝
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

  it('보이는 칸은 네 개뿐이다 — 45°·90° 는 화면 아래로 내려간다', () => {
    const visible = MENU_WHEEL_ANGLES.filter(isMenuWheelAngleVisible)
    expect([...visible]).toEqual([0, 180, 270, 315])
  })
})

describe('바퀴 돌리기', () => {
  it('고른 칸은 늘 맨 위 270° 에 온다', () => {
    for (let selected = 0; selected < MENU_WHEEL_ANGLES.length; selected += 1) {
      expect(menuWheelSlotOf(selected, selected)).toBe(MENU_WHEEL_SELECTED_SLOT)
      expect(menuWheelAngleOf(selected, selected)).toBe(270)
    }
  })

  it('여섯 칸이 각도 표 여섯 자리를 하나씩 차지한다', () => {
    const slots = MENU_WHEEL_ANGLES.map((_, index) => menuWheelSlotOf(index, 2))
    expect([...slots].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('한 칸 내려가면 다음 칸이 315° 에서 270° 로 올라온다', () => {
    expect(menuWheelAngleOf(1, 0)).toBe(315)
    expect(menuWheelAngleOf(1, 1)).toBe(270)
    // 그때 고르고 있던 칸은 270° 에서 180° 로 내려간다 (90° 벌어진 자리)
    expect(menuWheelAngleOf(0, 1)).toBe(180)
  })

  it('도는 동안 45° 칸은 틱마다 9°, 90° 칸은 18° 움직인다', () => {
    const smallSteps = [0, 1, 2, 3, 4, 5].map((counter) => menuWheelTurnAngleOf(315, 270, counter))
    expect(smallSteps).toEqual([315, 306, 297, 288, 279, 270])

    const wideSteps = [0, 1, 2, 3, 4, 5].map((counter) => menuWheelTurnAngleOf(270, 180, counter))
    expect(wideSteps).toEqual([270, 252, 234, 216, 198, 180])
  })

  it('0° 와 315° 사이는 짧은 쪽으로 돈다', () => {
    expect(menuWheelDeltaOf(315, 0)).toBe(45)
    expect(menuWheelDeltaOf(0, 315)).toBe(-45)
    expect(menuWheelTurnAngleOf(315, 0, 1)).toBe(324)
  })

  it('카운터가 5(=한 칸 이동 틱수) 면 딱 목표 각이다', () => {
    expect(MENU_WHEEL_TURN_TICKS).toBe(5)
    expect(menuWheelTurnAngleOf(270, 180, MENU_WHEEL_TURN_TICKS)).toBe(180)
    expect(menuWheelTurnAngleOf(270, 180, 99)).toBe(180)
  })
})

describe('칸 글자가 서로 겹치지 않는다', () => {
  /** main_ui/frames 원점표에서 읽은 처음 메뉴 6칸의 글자 폭 (높이는 전부 27) */
  const TOP_LABEL_WIDTHS = [98, 73, 74, 97, 48, 95]
  /** 게임시작 목록 7칸 (프레임 6·7·8·9·10·13·12) */
  const MODE_LABEL_WIDTHS = [95, 97, 115, 98, 96, 95, 96]

  interface Box { left: number; top: number; right: number; bottom: number }

  const overlaps = (a: Box, b: Box) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

  const boxesOnWheel = (selected: number): Box[] =>
    TOP_LABEL_WIDTHS.map((width, index) => {
      const point = menuWheelPointOf(menuWheelAngleOf(index, selected))
      const topLeft = menuWheelLabelTopLeftOf(point, width, MENU_LABEL_HEIGHT)
      return {
        left: topLeft.x,
        top: topLeft.y,
        right: topLeft.x + width,
        bottom: topLeft.y + MENU_LABEL_HEIGHT,
      }
    })

  it('바퀴 — 어느 칸을 골라도 여섯 칸이 서로 안 겹친다', () => {
    for (let selected = 0; selected < TOP_LABEL_WIDTHS.length; selected += 1) {
      const boxes = boxesOnWheel(selected)
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          expect(overlaps(boxes[i], boxes[j])).toBe(false)
        }
      }
    }
  })

  it('바퀴 — 설명 판과도 안 겹친다', () => {
    const wheelPanel = menuDescriptionPanelOf(true)
    const panelBox: Box = {
      left: wheelPanel.x,
      top: wheelPanel.y,
      right: wheelPanel.x + wheelPanel.width,
      bottom: wheelPanel.y + wheelPanel.height,
    }
    for (let selected = 0; selected < TOP_LABEL_WIDTHS.length; selected += 1) {
      for (const box of boxesOnWheel(selected)) expect(overlaps(box, panelBox)).toBe(false)
    }
  })

  it('세로 목록 — 줄 간격이 글자 높이보다 작으면 안 된다', () => {
    expect(MENU_ROW_STEP).toBeGreaterThanOrEqual(MENU_LABEL_HEIGHT)
  })

  it('세로 목록 — 일곱 줄이 서로도, 설명 판과도 안 겹친다', () => {
    const boxes: Box[] = MODE_LABEL_WIDTHS.map((width, index) => {
      const left = 120 - Math.trunc(width / 2)
      const top = menuRowTopOf(index)
      return { left, top, right: left + width, bottom: top + MENU_LABEL_HEIGHT }
    })
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false)
      }
    }
    const last = boxes[boxes.length - 1]
    expect(last.bottom).toBeLessThanOrEqual(MENU_DESCRIPTION_PANEL.y)
    expect(MENU_DESCRIPTION_PANEL.y + MENU_DESCRIPTION_PANEL.height).toBeLessThanOrEqual(320)
  })
})

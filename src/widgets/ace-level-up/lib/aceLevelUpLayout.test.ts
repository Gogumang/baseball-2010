import { describe, expect, it } from 'vitest'
import {
  ACE_LEVEL_UP_BUTTONS,
  ACE_LEVEL_UP_COST_BOX,
  ACE_LEVEL_UP_HEAD,
  aceLevelUpNumberOf,
  aceLevelUpRowOf,
} from '@/widgets/ace-level-up/lib/aceLevelUpLayout'

describe('마선수 레벨업 창 0x5f394 배치 (unicorn 으로 가로챈 그리기 호출)', () => {
  it('줄은 y 83 부터 18 씩 — 막대 (87, y) · 화살 (138, y + 2) · 막대 (150, y), 딱지 오른쪽 끝 83', () => {
    expect(aceLevelUpRowOf(0)).toMatchObject({
      y: 83,
      labelRight: 83,
      labelY: 86,
      currentBar: { x: 87, y: 83 },
      arrow: { x: 138, y: 85 },
      nextBar: { x: 150, y: 83 },
      currentRight: 122,
      nextRight: 185,
      numberY: 85,
      times: [],
    })
    expect(aceLevelUpRowOf(3).y).toBe(137)
  })

  it('줄 4 는 숫자 오른쪽 끝이 110 · 173 이고 "회" 를 (115, 157) · (177, 157) 에 긋는다', () => {
    expect(aceLevelUpRowOf(4)).toMatchObject({
      y: 155,
      currentRight: 110,
      nextRight: 173,
      times: [
        { x: 115, y: 157 },
        { x: 177, y: 157 },
      ],
    })
  })

  it('숫자 0x585ac — 정렬 4 는 오른쪽 끝, 정렬 2 는 가운데 · 폭은 셋째 글자부터 간격', () => {
    expect(aceLevelUpNumberOf(1, ACE_LEVEL_UP_HEAD.currentCenterX, 63, 2)).toEqual([{ image: 21, x: 159, y: 63 }])
    expect(aceLevelUpNumberOf(48, 122, 85, 4)).toEqual([
      { image: 24, x: 110, y: 85 },
      { image: 28, x: 117, y: 85 },
    ])
    expect(aceLevelUpNumberOf(100, 185, 85, 4).map((glyph) => glyph.x)).toEqual([168, 173, 180])
  })

  it('안쪽 칸 (33, 176) 174×65 · 버튼 (64, 245) · (135, 245)', () => {
    expect(ACE_LEVEL_UP_COST_BOX).toEqual({ x: 33, y: 176, width: 174, height: 65 })
    expect(ACE_LEVEL_UP_BUTTONS.map((button) => [button.x, button.y])).toEqual([
      [64, 245],
      [135, 245],
    ])
  })
})

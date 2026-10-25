import { describe, expect, it } from 'vitest'
import {
  isSlotIconInUse, isSlotInUse, lockRegionOf, moveSpecialTrainingCursor, slotCostOf, slotDescriptionOf, slotNameOf,
  slotProgressOf, specialTrainingIconFrameOf, specialTrainingTitleFrameOf, statusLabelOf,
} from '@/widgets/special-swing/lib/specialTrainingWindow'

/** 0x803d4 탭 0 · 1 — unicorn 으로 돌려 받은 그리기 호출과 맞춘다 */
describe('필살타법 · 마구 창 0x803d4 탭 0 · 1', () => {
  it('제목 · 아이콘 — 탭 0 img_text 115 · mode_icon 15, 탭 1 img_text 114 · mode_icon 19', () => {
    expect([specialTrainingTitleFrameOf('타자'), specialTrainingIconFrameOf('타자')]).toEqual([115, 15])
    expect([specialTrainingTitleFrameOf('투수'), specialTrainingIconFrameOf('투수')]).toEqual([114, 19])
  })

  it('이름 — 타자 넷째 칸은 타입 1 이면 메테오, 투수 넷째 칸은 폼/2 로 샤이닝 · 캐넌 · 미라지', () => {
    expect(slotNameOf('타자', 3, 0)).toBe('미라지 스윙')
    expect(slotNameOf('타자', 3, 1)).toBe('메테오 스윙')
    expect(slotNameOf('투수', 0, 2)).toBe('파이어 볼')
    expect([0, 1, 2].map((type) => slotNameOf('투수', 3, type))).toEqual(['샤이닝 볼', '캐넌 볼', '미라지 볼'])
  })

  it('설명 — StrMODE[60] + 인기도 (+ " / " 앞 칸) + !N + StrMODE[61] + 사용 횟수 (emu: 타자 c=1 · 투수 c=3)', () => {
    expect(slotDescriptionOf('타자', 0, 0)).toBe('!cFFFFFF조건: 인기도100!N사용 횟수: 2')
    expect(slotDescriptionOf('타자', 1, 0)).toBe('!cFFFFFF조건: 인기도500 / 파워 스윙!N사용 횟수: 3')
    expect(slotDescriptionOf('투수', 3, 1)).toBe('!cFFFFFF조건: 인기도1500 / 썬더 볼!N사용 횟수: 7')
  })

  it('비용 |0xd4700| × 100 · 횟수 — c < L 이면 필요/필요, c == L 이면 쌓은 수, c > L 이면 0', () => {
    expect([0, 1, 2, 3].map(slotCostOf)).toEqual([500, 700, 900, 1200])
    expect(slotProgressOf(1, 2, 3)).toEqual({ count: 5, required: 5 })
    expect(slotProgressOf(3, 3, 2)).toEqual({ count: 2, required: 7 })
    expect(slotProgressOf(3, 1, 2)).toEqual({ count: 0, required: 7 })
  })

  it('주황 아이콘은 min(+0x18, 4) == i + 1, "사용중" 은 0xa43c4(4 + 타입) — 장타형 메테오(저장 4)는 아이콘만 주황', () => {
    expect(isSlotIconInUse(3, 4)).toBe(true)
    expect(isSlotInUse(3, 4, 1)).toBe(false)
    expect(isSlotInUse(3, 5, 1)).toBe(true)
    expect(isSlotIconInUse(3, 5)).toBe(true)
    expect(isSlotIconInUse(2, 4)).toBe(false)
  })

  it('아래 글 — 0x6c: 사용중 296 · c < L 이면 없음 · 그 밖 293, 0x7b: 사용중 296 · 그 밖 295', () => {
    expect(statusLabelOf('훈련', 1, 2, true)).toBe(296)
    expect(statusLabelOf('훈련', 1, 2, false)).toBeNull()
    expect(statusLabelOf('훈련', 2, 2, false)).toBe(293)
    expect(statusLabelOf('사용', 0, 0, false)).toBe(295)
  })

  it('흑백 자리 — 평소 (x+1, y+1, w−1, h−1), 커서 테두리를 그린 틀은 넓힌 상자를 그대로 써 (x, y, w+1, h+1)', () => {
    expect(lockRegionOf(2, false)).toEqual({ x: 128, y: 100, width: 32, height: 33 })
    expect(lockRegionOf(0, true)).toEqual({ x: 37, y: 99, width: 34, height: 35 })
  })

  it('탭 격자 (4, 1, 0x330) — ← · ↑ 는 왼쪽, → · ↓ 는 오른쪽, 끝에서 감긴다', () => {
    expect(moveSpecialTrainingCursor(0, 'left')).toBe(3)
    expect(moveSpecialTrainingCursor(0, 'up')).toBe(3)
    expect(moveSpecialTrainingCursor(3, 'down')).toBe(0)
    expect(moveSpecialTrainingCursor(1, 'right')).toBe(2)
  })
})

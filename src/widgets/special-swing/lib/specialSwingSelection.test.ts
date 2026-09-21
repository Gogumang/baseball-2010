import { describe, expect, it } from 'vitest'
import {
  NO_SPECIAL_SWING_NUMBER, specialSwingNameOf, specialSwingNumberOf, specialSwingPickOf,
} from '@/widgets/special-swing/lib/specialSwingSelection'

/** 필살타법 창의 칸 규칙 (H-4 확정 · 키 처리 0x17cec) */

describe('칸 → 기술 번호', () => {
  it('앞 세 칸은 표 [1,2,3] 그대로다 — 타입과 상관없다', () => {
    expect([0, 1, 2].map((slot) => specialSwingNumberOf(slot, 0))).toEqual([1, 2, 3])
    expect([0, 1, 2].map((slot) => specialSwingNumberOf(slot, 1))).toEqual([1, 2, 3])
  })

  it('넷째 칸만 4 + 타입이다 — 타격형 4(미라지) · 장타형 5(메테오)', () => {
    expect(specialSwingNumberOf(3, 0)).toBe(4)
    expect(specialSwingNumberOf(3, 1)).toBe(5)
  })

  it('이름은 StrCOMMON[24 + 번호] 다', () => {
    expect([1, 2, 3, 4, 5].map(specialSwingNameOf))
      .toEqual(['파워 스윙', '플레임 스윙', '토네이도스윙', '미라지 스윙', '메테오 스윙'])
  })
})

describe('기술 고르기 — 0x17cec', () => {
  it('이미 사용 중인 칸은 StrMODE[69] 다 (레코드 +0x18 == 번호)', () => {
    expect(specialSwingPickOf(1, 0, 4, 2)).toEqual({ kind: '사용중' })
  })

  it('배운 수 ≤ 칸이면 StrMODE[71] 로 막는다 — 배운 수 2 면 칸 2·3 이 막힌다', () => {
    expect(specialSwingPickOf(2, 0, 2, NO_SPECIAL_SWING_NUMBER)).toEqual({ kind: '미습득' })
    expect(specialSwingPickOf(3, 0, 2, NO_SPECIAL_SWING_NUMBER)).toEqual({ kind: '미습득' })
    expect(specialSwingPickOf(1, 0, 2, NO_SPECIAL_SWING_NUMBER).kind).toBe('묻기')
  })

  it('배운 칸이면 StrMODE[70] 로 묻고, 바꿀 번호와 이름을 함께 준다', () => {
    expect(specialSwingPickOf(3, 1, 4, 1)).toEqual({ kind: '묻기', number: 5, name: '메테오 스윙' })
  })

  it('"사용 중" 판정은 레벨이 아니라 **번호**로 한다 — 장타형 넷째 칸은 5 여야 걸린다', () => {
    expect(specialSwingPickOf(3, 1, 4, 4).kind).toBe('묻기')
    expect(specialSwingPickOf(3, 1, 4, 5).kind).toBe('사용중')
  })
})

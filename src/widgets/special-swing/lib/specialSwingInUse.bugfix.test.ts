import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { specialSwingPickOf } from '@/widgets/special-swing/lib/specialSwingSelection'
import { isSlotInUse } from '@/widgets/special-swing/lib/specialTrainingWindow'
import { magicInUseNumberOfCell } from '@/entities/pitcher-career/model/pitchSelection'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 장타형(타입 1)이 메테오 스윙(넷째 칸)을 골라 저장 +0x18 = 4 */
const 장타형 = 1
const 저장 = 4

describe('B-77 넷째 칸 "사용 중" 비교값이 4 + 타입이라 저장(4)과 안 맞는다', () => {
  it('원본: 장타형 메테오는 다시 골라도 묻기 · 아래 글 "사용중" 없음 · 투수 넷째 마구 비교값 5', () => {
    expect(specialSwingPickOf(3, 장타형, 4, 저장).kind).toBe('묻기')
    expect(isSlotInUse(3, 저장, 장타형)).toBe(false)
    expect(magicInUseNumberOfCell(3, 1)).toBe(5)
    // 타격형(타입 0)은 원본에서도 맞다
    expect(specialSwingPickOf(3, 0, 4, 저장).kind).toBe('사용중')
  })

  it('고침: 저장 번호(칸 + 1)와 견줘 "사용 중" — 다른 칸은 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-77']))
    expect(specialSwingPickOf(3, 장타형, 4, 저장).kind).toBe('사용중')
    expect(isSlotInUse(3, 저장, 장타형)).toBe(true)
    expect(magicInUseNumberOfCell(3, 2)).toBe(4)
    expect(specialSwingPickOf(2, 장타형, 4, 저장).kind).toBe('묻기')
  })
})

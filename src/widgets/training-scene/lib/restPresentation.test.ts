import { describe, expect, it } from 'vitest'
import { nariRestPresentationOf } from '@/widgets/training-scene/lib/restPresentation'

describe('나리 127 휴식 연출 (0x85230)', () => {
  it('event_ani 애니 5 · event_char_0 애니는 타자편 장타형만 0x68, 그 밖 0x62 (85284~852a6)', () => {
    expect(nariRestPresentationOf({ isBatter: true, battingTypeIndex: 0 })).toEqual({ eventAnimation: 5, char0Animation: 0x62 })
    expect(nariRestPresentationOf({ isBatter: true, battingTypeIndex: 1 })).toEqual({ eventAnimation: 5, char0Animation: 0x68 })
    // 투수편([gfx+0x20] == 3)은 0x7b970 이 거짓이라 늘 0x62
    expect(nariRestPresentationOf({ isBatter: false, battingTypeIndex: 1 })).toEqual({ eventAnimation: 5, char0Animation: 0x62 })
  })
})

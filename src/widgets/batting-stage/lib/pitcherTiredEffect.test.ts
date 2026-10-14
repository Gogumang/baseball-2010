import { describe, expect, it } from 'vitest'
import { tiredEffectAnimationOf } from '@/widgets/batting-stage/lib/pitcherTiredEffect'

describe('지친 투수 표시 (0x38f68~0x38fd0)', () => {
  it('체력% ≤ 19 는 애니 10 · 20~34 는 애니 9 · 35 이상은 없다', () => {
    expect([0, 19, 20, 34, 35, 100].map(tiredEffectAnimationOf)).toEqual([10, 10, 9, 9, null, null])
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { selectShopItem, shopItemId } from '@/features/shop/model/shopSelection'
import { selectPitcherShopItem } from '@/features/shop/model/pitcherShopSelection'
import { batterGpDetailViewOf, pitcherGpDetailViewOf } from '@/pages/shop/lib/gpDetailView'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 영지버섯 = () => selectShopItem({ ...createCareer('테스트'), gamePoint: 9999, morale: 30 }, shopItemId('GP', 6), createSeededRandom(1))

describe('B-46 영지버섯 창의 사기 현재값이 먹기 전 값', () => {
  it('원본: 사기 칸 현재값은 효과 전 30', () => {
    const bought = 영지버섯()
    expect(bought.career.morale).toBe(70)
    expect(batterGpDetailViewOf(bought.detail!)!.rows[4]).toMatchObject({ current: 30, change: 40 })
  })

  it('고침: 효과 뒤 70 — 변화량 40 은 그대로 (투수편도 같다)', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-46']))
    const bought = 영지버섯()
    expect(batterGpDetailViewOf(bought.detail!)!.rows[4]).toMatchObject({ current: 70, change: 40 })
    const pitcher = selectPitcherShopItem({ ...createPitcherCareer('투수'), gamePoint: 9999, morale: 30 }, shopItemId('GP', 6), createSeededRandom(1))
    expect(pitcherGpDetailViewOf(pitcher.detail!)!.rows[4]).toMatchObject({ current: pitcher.career.morale, change: 40 })
  })
})

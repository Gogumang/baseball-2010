import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'

describe('상태 7 진입 0x39f88 → 0x53dbc 의 로딩 팁 굴림', () => {
  it('StrTIP 첫 줄 "73" 이 칸 수 — rand(0, 73) 한 번', () => {
    expect(LOADING_TIPS).toHaveLength(73)
    const random = createSeededRandom(9)
    const expected = createSeededRandom(9)
    expect(rollSceneLoadingTip(random)).toBe(randomIntegerBelow(expected, 0, 73))
    expect(random.next()).toBe(expected.next())
  })
})

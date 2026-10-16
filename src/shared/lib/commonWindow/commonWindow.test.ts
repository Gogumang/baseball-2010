import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  gameSceneNow,
  gameSceneTimeOf,
  isGameSceneFrozen,
  markCommonWindowShown,
  markGameSceneUp,
  resetCommonWindowShownForTest,
} from '@/shared/lib/commonWindow/commonWindow'

/**
 * 경기 장면 0x52c50 — 공용 창 [0x140005c]+9 가 서 있으면 52cc6 이 갱신을, 52efe 가 상태 그리기를, 53048 이 파티클을 건너뛴다.
 * 장면 시계는 그동안 서고, 창이 닫히면 따라잡지 않고 이어 흐른다.
 */
describe('경기 장면 시계 — 공용 창 게이트 52cc6', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetCommonWindowShownForTest()
  })

  it('경기 장면이 없으면 창이 떠도 멈추지 않는다 — 다른 장면 프레임(0x32dd8 · 0xe9ac · 0x1cdec)에는 이 게이트가 없다', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100)
    const release = markCommonWindowShown()
    expect(isGameSceneFrozen()).toBe(false)
    expect(gameSceneTimeOf(500)).toBe(500)
    release()
  })

  it('경기 장면 위에 창이 서 있는 동안 시계가 서고, 닫히면 멈춘 만큼 빼고 이어 흐른다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    const scene = markGameSceneUp()
    expect(gameSceneNow()).toBe(1000)
    now.mockReturnValue(1200)
    const window = markCommonWindowShown()
    expect(isGameSceneFrozen()).toBe(true)
    // 창이 떠 있는 동안 — 실제 시각이 흘러도 장면 시각은 창이 선 때에 서 있다
    expect(gameSceneTimeOf(1500)).toBe(1200)
    expect(gameSceneTimeOf(9000)).toBe(1200)
    now.mockReturnValue(5200)
    window()
    expect(isGameSceneFrozen()).toBe(false)
    // 4000ms 를 건너뛰고(따라잡지 않는다) 이어 흐른다
    expect(gameSceneTimeOf(5200)).toBe(1200)
    expect(gameSceneTimeOf(5300)).toBe(1300)
    scene()
  })

  it('창이 떠 있는 채로 경기 장면이 서면 그때부터 멈춘다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(0)
    const window = markCommonWindowShown()
    now.mockReturnValue(300)
    const scene = markGameSceneUp()
    expect(isGameSceneFrozen()).toBe(true)
    expect(gameSceneTimeOf(800)).toBe(300)
    now.mockReturnValue(1300)
    window()
    expect(gameSceneTimeOf(1400)).toBe(400)
    scene()
  })
})

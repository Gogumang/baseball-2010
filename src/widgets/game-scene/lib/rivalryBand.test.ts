import { describe, expect, it } from 'vitest'
import { isRivalryMatch, rivalryDrawsOf, rivalryStepAt } from '@/widgets/game-scene/lib/rivalryBand'

describe('라이벌전 띠 0x3b80c', () => {
  it('표 0xd8a90 의 짝만 라이벌전 — 순서 무관', () => {
    expect(isRivalryMatch(0, 1)).toBe(true)
    expect(isRivalryMatch(7, 2)).toBe(true)
    expect(isRivalryMatch(9, 8)).toBe(true)
    expect(isRivalryMatch(0, 2)).toBe(false)
    expect(isRivalryMatch(10, 11)).toBe(false)
  })

  it('그림 0 은 안 그리고 1~9 가 단계 1~9, 그 뒤는 9 에 선다 (+0x194c)', () => {
    expect(rivalryStepAt(0)).toBe(0)
    expect(rivalryDrawsOf(0)).toEqual([])
    expect(rivalryStepAt(4)).toBe(4)
    expect(rivalryStepAt(30)).toBe(9)
  })

  it('단계 1~3 은 반투명 흰 줄기 셋, 4 는 흰 상자 넷, 5~7 은 빨간 상자 · 선 · 흐린 상자 · 커진 밝은 로고, 8~9 는 로고 보통', () => {
    expect(rivalryDrawsOf(1)).toHaveLength(3)
    expect(rivalryDrawsOf(1).every((draw) => draw.kind === 'polygon' && draw.color.alpha === 0x80)).toBe(true)
    const step4 = rivalryDrawsOf(4)
    expect(step4).toHaveLength(4)
    expect(step4[0]).toMatchObject({ kind: 'polygon', color: { r: 255, g: 255, b: 255, alpha: 0 } })
    const step5 = rivalryDrawsOf(5)
    expect(step5.filter((draw) => draw.kind === 'line')).toHaveLength(3)
    // a = 40 → 4배, 가운데 맞춤 x = 120 − 73·2 · y = 160 − 33·2
    expect(step5[step5.length - 1]).toEqual({ kind: 'logo', x: -26, y: 94, scale: 4, brighten: 200 })
    expect(rivalryDrawsOf(6).at(-1)).toEqual({ kind: 'logo', x: 11, y: 111, scale: 3, brighten: 200 })
    expect(rivalryDrawsOf(7).at(-1)).toEqual({ kind: 'logo', x: 47, y: 127, scale: 2, brighten: 200 })
    expect(rivalryDrawsOf(9)).toEqual([...rivalryDrawsOf(8)])
    expect(rivalryDrawsOf(9).at(-1)).toEqual({ kind: 'logo', x: 84, y: 144, scale: 1, brighten: 0 })
    expect(rivalryDrawsOf(9)[0]).toMatchObject({ color: { r: 176, g: 1, b: 30 } })
  })
})

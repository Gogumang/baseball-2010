import { describe, expect, it } from 'vitest'
import { FIELDER_ACTION, type DefenseFielder } from '@/pages/defense/lib/defenseView'
import { fielderEffectMarksOf, runnerEffectMarksOf } from '@/pages/defense/lib/playerEffectMarks'

const 야수 = (over: Partial<DefenseFielder> = {}): DefenseFielder => ({
  slot: 5, x: 15_000, z: 18_000, action: FIELDER_ACTION.stand, actionTick: 0, ...over,
})
const 고른 = (fielder: DefenseFielder) => fielderEffectMarksOf(fielder).map((mark) => `${mark.kind}${mark.index}@${mark.raise}`)

describe('야수 부착 효과 (0x43278)', () => {
  it('몸 날리기 그림 19 · 22 · 25 · 28 → 먼지 애니 0 · 1 · 2 · 3', () => {
    expect(고른(야수({ action: FIELDER_ACTION.diveRight }))).toEqual(['anim0@0'])
    expect(고른(야수({ action: FIELDER_ACTION.diveLeft }))).toEqual(['anim1@0'])
    expect(고른(야수({ action: FIELDER_ACTION.diveDown }))).toEqual(['anim2@0'])
    expect(고른(야수({ action: FIELDER_ACTION.diveUp }))).toEqual(['anim3@0'])
  })

  it('+0xb0 이면 애니 4, +0xb4 > 0 이면 애니 4 + 머리 위 애니 15(y − 10)이고 "!" 는 건너뛴다', () => {
    expect(고른(야수({ catchFlag: true }))).toEqual(['anim4@0'])
    expect(고른(야수({ lockTicks: 3, fumbleTicks: 6 }))).toEqual(['anim4@0', 'anim15@10'])
  })

  it('+0xb8 > 0 또는 +0xc0 > 0 이면 "!"(애니 13)를 y − 40 에 하나만', () => {
    expect(고른(야수({ fumbleTicks: 6 }))).toEqual(['anim13@40'])
    expect(고른(야수({ throwErrorTicks: 4 }))).toEqual(['anim13@40'])
    expect(고른(야수({ fumbleTicks: 2, throwErrorTicks: 4 }))).toEqual(['anim13@40'])
  })

  it('먼지 자국은 그 점 · 프레임으로, 깊이 키도 그 점의 z 다', () => {
    const [mark] = fielderEffectMarksOf(야수({ dustTrail: { x: 15_500, z: 18_000, frame: 19 } }))
    expect(mark).toMatchObject({ kind: 'frame', index: 19, x: 15_500, z: 18_000, zKey: 18_000 })
  })
})

describe('주자 슬라이딩 먼지 (0x43b18)', () => {
  const 주자 = (slideDirection: number) => ({
    index: 1, x: 1, z: 2, action: 6, actionTick: 0, base: 2, isAdvancing: true, slideDirection,
  })
  it('방향 1 · 2 · 3 · 4 → 애니 5 · 6 · 8 · 7, 깊이 키는 주자 z — 주자 그림(z + 1)보다 한 칸 앞(밑) (43aec)', () => {
    expect([1, 2, 3, 4].map((d) => runnerEffectMarksOf(주자(d))[0]?.index)).toEqual([5, 6, 8, 7])
    expect(runnerEffectMarksOf(주자(1))[0]?.zKey).toBe(2)
    expect(runnerEffectMarksOf(주자(0))).toEqual([])
  })
})

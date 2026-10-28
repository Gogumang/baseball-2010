import { describe, expect, it } from 'vitest'
import { MAX_SEEN_LAG_TICKS, createShownSceneTicks, inputTimeOf, stampInputTime } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { createSceneKeyLatch, runSceneKeys } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

describe('키를 누를 때 화면에 있던 그림의 틱 (r211)', () => {
  it('사건 시각 앞에 마지막으로 그린 그림의 틱 — 그 뒤에 그린 그림은 못 봤다', () => {
    const shown = createShownSceneTicks()
    shown.mark(10, 620)
    shown.mark(11, 690)
    shown.mark(12, 760)
    expect(shown.tickSeenAt(700, 12)).toBe(11)
    expect(shown.tickSeenAt(690, 12)).toBe(11)
    expect(shown.tickSeenAt(689, 12)).toBe(10)
    // 그림이 밀려 시각으로는 14 틱이어도 화면은 12 틱 그림이다
    expect(shown.tickSeenAt(900, 14)).toBe(12)
  })

  it('기록이 없거나 · 사건이 모든 그림보다 앞이거나 · 너무 낡았으면 지금 틱', () => {
    const shown = createShownSceneTicks()
    expect(shown.tickSeenAt(500, 8)).toBe(8)
    shown.mark(10, 620)
    expect(shown.tickSeenAt(600, 10)).toBe(10)
    expect(shown.tickSeenAt(5000, 10 + MAX_SEEN_LAG_TICKS + 1)).toBe(10 + MAX_SEEN_LAG_TICKS + 1)
    expect(shown.tickSeenAt(5000, 10 + MAX_SEEN_LAG_TICKS)).toBe(10)
    shown.clear()
    expect(shown.tickSeenAt(5000, 30)).toBe(30)
  })

  it('지금 틱보다 뒤일 수는 없다', () => {
    const shown = createShownSceneTicks()
    shown.mark(20, 100)
    expect(shown.tickSeenAt(200, 18)).toBe(18)
  })
})

describe('사건 시각 inputTimeOf', () => {
  it('event.timeStamp — 손잡이가 돈 때가 아니라 사건이 난 때', () => {
    expect(inputTimeOf({ timeStamp: 950 } as Event, 1000)).toBe(950)
  })

  it('시각 바탕이 다르거나(Date 시각) · 미래거나 · 1초 넘게 앞이면 지금 시각', () => {
    expect(inputTimeOf({ timeStamp: Date.UTC(2026, 9, 25) } as Event, 1000)).toBe(1000)
    expect(inputTimeOf({ timeStamp: 0 } as Event, 1000)).toBe(1000)
    expect(inputTimeOf({ timeStamp: 3000 } as Event, 1000)).toBe(1000)
    expect(inputTimeOf({ timeStamp: 1 } as Event, 5000)).toBe(5000)
    expect(inputTimeOf(null, 1000)).toBe(1000)
  })

  it('대신 쏜 사건(터치 버튼)은 붙여 둔 손가락 시각', () => {
    const event = { timeStamp: 990 } as Event
    stampInputTime(event, 930)
    expect(inputTimeOf(event, 1000)).toBe(930)
  })
})

describe('키 칸 — 사건 시각으로 받은 틱 (`tickAt`)', () => {
  it('시각을 준 키는 그때 보이던 틱에 들고 그 다음 틀에 꺼낸다 — 시각을 안 준 키는 지금 틱', () => {
    let now = 14
    const shown = createShownSceneTicks()
    shown.mark(12, 760)
    const latch = createSceneKeyLatch(
      () => now,
      (time) => shown.tickSeenAt(time, now),
    )
    const applied: string[] = []
    latch.push(() => applied.push('본 그림'), 'press', 800)
    expect(latch.tickAt(800)).toBe(12)
    runSceneKeys(latch, 13)
    expect(applied).toEqual(['본 그림'])
    latch.push(() => applied.push('지금'))
    runSceneKeys(latch, 14)
    expect(applied).toEqual(['본 그림'])
    now = 15
    runSceneKeys(latch, 15)
    expect(applied).toEqual(['본 그림', '지금'])
  })

  it('칸을 만들 때 셈을 안 주면 언제 받았든 지금 틱이다(경기 장면 밖 · 투수편)', () => {
    const latch = createSceneKeyLatch(() => 7)
    expect(latch.tickAt(1)).toBe(7)
  })
})

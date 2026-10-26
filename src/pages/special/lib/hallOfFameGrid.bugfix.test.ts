import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { hallOfFameGridOf } from '@/pages/special/lib/hallOfFameGrid'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 영입 = { kind: '선수고르기' } as const

describe('B-98 시즌 영입 목록은 안 쓰는 칸 10 에도 커서가 선다 (0x3d60~0x3d94 — 막힌 칸 없음)', () => {
  it('원본: 시즌 영입 격자는 막힌 칸이 없다 — 나리 145 · 미션은 칸 10 을 막는다', () => {
    expect(hallOfFameGridOf(영입, '시즌').blockedCells).toBeUndefined()
    expect(hallOfFameGridOf(영입, '메뉴').blockedCells).toEqual([10])
    expect(hallOfFameGridOf({ kind: '등록' }, '나리').blockedCells).toEqual([10])
  })

  it('고침: 시즌 영입도 칸 10 을 막는다 — 다른 목록은 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-98']))
    expect(hallOfFameGridOf(영입, '시즌').blockedCells).toEqual([10])
    expect(hallOfFameGridOf({ kind: '보기' }, '메뉴').blockedCells).toEqual([0, 5, 10])
    expect(hallOfFameGridOf({ kind: '선수고르기', purpose: '홈런더비' }, '메뉴')).toMatchObject({ rows: 2, blockedCells: [5] })
  })
})

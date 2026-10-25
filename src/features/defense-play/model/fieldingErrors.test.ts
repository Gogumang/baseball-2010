import { describe, expect, it } from 'vitest'
import {
  drawnFieldingErrorsOf,
  drawnReplayFieldingErrorsOf,
  fielderRecordIndexOf,
  fieldingErrorRecordsOf,
} from '@/features/defense-play/model/fieldingErrors'

describe('야수 그리기 0x43278 의 실책 +0x2e (4381a~43904)', () => {
  it('펌블 +0xb8 == 6 · 악송구 +0xc0 == 4 인 그림만 센다', () => {
    expect(drawnFieldingErrorsOf([{ slot: 5, fumbleTicks: 6, teamIndex: 3 }])).toEqual([{ slot: 5, teamIndex: 3, isFumble: true }])
    expect(drawnFieldingErrorsOf([{ slot: 5, fumbleTicks: 5 }])).toEqual([])
    expect(drawnFieldingErrorsOf([{ slot: 2, throwErrorTicks: 4 }])).toEqual([{ slot: 2, teamIndex: null }])
    expect(drawnFieldingErrorsOf([{ slot: 2, throwErrorTicks: 3 }])).toEqual([])
  })

  it('+0xb8 > 0 이면 악송구 칸은 안 본다 (438c4 는 그 밖 갈래)', () => {
    expect(drawnFieldingErrorsOf([{ slot: 4, fumbleTicks: 2, throwErrorTicks: 4 }])).toEqual([])
    expect(drawnFieldingErrorsOf([{ slot: 4, fumbleTicks: 6, throwErrorTicks: 4 }])).toEqual([{ slot: 4, teamIndex: null, isFumble: true }])
  })

  it('펌블 갈래만 시즌 평판 0xa755d(ctx, 3) 표시를 단다 — 악송구 갈래(438c4)는 +0x2e 만 (r248)', () => {
    expect(drawnFieldingErrorsOf([{ slot: 5, fumbleTicks: 6 }, { slot: 2, throwErrorTicks: 4 }]).map((error) => error.isFumble === true))
      .toEqual([true, false])
  })

  it('재생 판을 끝까지 그린 실책 — 판 틱마다 그림 한 번 (재생 갈래와 같은 셈)', () => {
    expect(drawnReplayFieldingErrorsOf([
      { fielders: [{ slot: 5, fumbleTicks: 6 }] },
      { fielders: [{ slot: 5, fumbleTicks: 5 }, { slot: 2, throwErrorTicks: 4 }] },
    ])).toEqual([{ slot: 5, teamIndex: null, isFumble: true }, { slot: 2, teamIndex: null }])
  })

  it('동작 잠금 +0xb4 > 0 인 야수는 건너뛴다 (437a4)', () => {
    expect(drawnFieldingErrorsOf([{ slot: 1, lockTicks: 3, fumbleTicks: 6 }])).toEqual([])
  })

  it('고리 차례는 칸 8 → 0 이다', () => {
    const 그림 = drawnFieldingErrorsOf([
      { slot: 0, throwErrorTicks: 4 },
      { slot: 8, fumbleTicks: 6 },
      { slot: 3, throwErrorTicks: 4 },
    ])
    expect(그림.map((error) => error.slot)).toEqual([8, 3, 0])
  })
})

describe('야수 +0xec — 자리 니블이 칸 + 1 인 첫 선수 (0xb0fb4 · 0x3fac4)', () => {
  const 명단 = [{ position: 6 }, { position: 2 }, { position: 1 }, { position: 0x16 }, { position: 0 }]

  it('칸 0(투수)은 니블 1 = 지명타자다', () => {
    expect(fielderRecordIndexOf(명단, 0)).toBe(2)
  })

  it('니블만 본다(+0x1c & 0xf) · 겹치면 앞 선수 · 없으면 −1', () => {
    expect(fielderRecordIndexOf(명단, 5)).toBe(0)
    expect(fielderRecordIndexOf(명단, 1)).toBe(1)
    expect(fielderRecordIndexOf(명단, 8)).toBe(-1)
  })

  it('열쇠를 못 고른 칸은 버린다', () => {
    const 기록 = fieldingErrorRecordsOf(
      [{ slot: 1, teamIndex: 2 }, { slot: 8, teamIndex: 2 }],
      (error) => (error.slot === 1 ? { teamId: 2, battingOrderIndex: 4 } : null),
    )
    expect(기록).toEqual([{ teamId: 2, battingOrderIndex: 4 }])
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { createDrawMemo, sameDrawInput, setDrawMemoBypassForTest } from '@/shared/lib/canvas/drawMemo'
import { noteAssetLoaded } from '@/shared/lib/sprite/assetLoadVersion'

afterEach(() => setDrawMemoBypassForTest(false))

const 캔버스 = (width = 240, height = 320) => ({ width, height }) as HTMLCanvasElement

describe('sameDrawInput — 그림 입력을 값으로 견준다', () => {
  it('새로 만든 같은 값의 객체 · 배열은 같다', () => {
    expect(sameDrawInput({ a: 1, b: [1, { c: 'x' }], d: null }, { a: 1, b: [1, { c: 'x' }], d: null })).toBe(true)
  })
  it('칸 하나 · 칸 수 · 배열 길이가 다르면 다르다', () => {
    expect(sameDrawInput({ a: 1 }, { a: 2 })).toBe(false)
    expect(sameDrawInput({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(sameDrawInput([1, 2], [1, 2, 3])).toBe(false)
    expect(sameDrawInput([1], { 0: 1 })).toBe(false)
  })
  it('NaN 은 NaN 과 같고, 함수 · 클래스 객체는 같은 것만 같다', () => {
    expect(sameDrawInput(NaN, NaN)).toBe(true)
    expect(
      sameDrawInput(
        () => 1,
        () => 1,
      ),
    ).toBe(false)
    expect(sameDrawInput(new Map(), new Map())).toBe(false)
    const image = new Map()
    expect(sameDrawInput({ image }, { image })).toBe(true)
  })
})

describe('createDrawMemo — 다시 그리는 때', () => {
  it('처음은 그리고, 같은 값이면 건너뛰고, 값이 바뀌면 그린다', () => {
    const memo = createDrawMemo()
    const canvas = 캔버스()
    expect(memo.needsDraw(canvas, { tick: 1 })).toBe(true)
    expect(memo.needsDraw(canvas, { tick: 1 })).toBe(false)
    expect(memo.needsDraw(canvas, { tick: 2 })).toBe(true)
  })
  it('캔버스가 바뀌거나 크기를 다시 매기면 그린다', () => {
    const memo = createDrawMemo()
    const canvas = 캔버스()
    memo.needsDraw(canvas, 1)
    expect(memo.needsDraw(캔버스(), 1)).toBe(true)
    const other = 캔버스()
    memo.needsDraw(other, 1)
    other.width = 241
    expect(memo.needsDraw(other, 1)).toBe(true)
  })
  it('늦게 받는 그림 재료가 실리면 그린다', () => {
    const memo = createDrawMemo()
    const canvas = 캔버스()
    memo.needsDraw(canvas, 1)
    noteAssetLoaded()
    expect(memo.needsDraw(canvas, 1)).toBe(true)
    expect(memo.needsDraw(canvas, 1)).toBe(false)
  })
  it('invalidate · 시험용 우회면 그린다', () => {
    const memo = createDrawMemo()
    const canvas = 캔버스()
    memo.needsDraw(canvas, 1)
    memo.invalidate()
    expect(memo.needsDraw(canvas, 1)).toBe(true)
    setDrawMemoBypassForTest(true)
    expect(memo.needsDraw(canvas, 1)).toBe(true)
  })
})

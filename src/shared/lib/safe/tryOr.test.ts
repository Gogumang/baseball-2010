import { describe, expect, it, vi } from 'vitest'
import { ignoreErrors, tryOr, tryOrAsync, tryOrElse, tryOrElseAsync, withFinally, withFinallyAsync } from '@/shared/lib/safe/tryOr'

const boom = (): never => {
  throw new Error('boom')
}

describe('tryOr · tryOrElse · ignoreErrors', () => {
  it('던지지 않으면 값을 그대로 낸다', () => {
    expect(tryOr(() => 3, null)).toBe(3)
    expect(
      tryOrElse(
        () => 'a',
        () => 'b',
      ),
    ).toBe('a')
  })

  it('던지면 대신 값 · onError 결과', () => {
    expect(tryOr(boom, null)).toBeNull()
    expect(tryOrElse(boom, (error) => (error as Error).message)).toBe('boom')
  })

  it('onError 가 던지면 밖으로 나간다', () => {
    expect(() => tryOrElse(boom, () => boom())).toThrow('boom')
  })

  it('ignoreErrors 는 삼키고 몸통은 돈다', () => {
    const run = vi.fn(boom)
    expect(() => ignoreErrors(run)).not.toThrow()
    expect(run).toHaveBeenCalledOnce()
  })
})

describe('tryOrAsync · tryOrElseAsync', () => {
  it('거절 · 바로 던짐 모두 대신 값', async () => {
    await expect(tryOrAsync(() => Promise.reject(new Error('x')), 'fallback')).resolves.toBe('fallback')
    await expect(tryOrAsync(boom, 'fallback')).resolves.toBe('fallback')
    await expect(tryOrAsync(() => Promise.resolve(1), 0)).resolves.toBe(1)
  })

  it('onError 결과(약속도)를 기다린다', async () => {
    await expect(tryOrElseAsync(boom, async () => 'late')).resolves.toBe('late')
    await expect(tryOrElseAsync(boom, (error) => String(error))).resolves.toBe('Error: boom')
  })
})

describe('withFinally · withFinallyAsync', () => {
  it('값을 내고 뒷정리를 한다', () => {
    const cleanup = vi.fn()
    expect(withFinally(() => 5, cleanup)).toBe(5)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('던져도 뒷정리를 하고 다시 던진다', () => {
    const cleanup = vi.fn()
    expect(() => withFinally(boom, cleanup)).toThrow('boom')
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('비동기 — 끝난 뒤에 뒷정리, 거절은 그대로 넘긴다', async () => {
    const order: string[] = []
    const done = withFinallyAsync(
      async () => {
        await Promise.resolve()
        order.push('run')
        return 7
      },
      () => order.push('cleanup'),
    )
    await expect(done).resolves.toBe(7)
    expect(order).toEqual(['run', 'cleanup'])
    const cleanup = vi.fn()
    await expect(withFinallyAsync(() => Promise.reject(new Error('no')), cleanup)).rejects.toThrow('no')
    expect(cleanup).toHaveBeenCalledOnce()
  })
})

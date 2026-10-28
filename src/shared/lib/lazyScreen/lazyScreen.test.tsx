// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { lazyScreen, preloadLazyScreens } from '@/shared/lib/lazyScreen/lazyScreen'

afterEach(cleanup)

/** 손으로 푸는 덩이 받기 */
function deferredLoad<Props extends object>(component: (props: Props) => JSX.Element) {
  let resolve: () => void = () => {}
  let calls = 0
  const load = () => {
    calls += 1
    return new Promise<(props: Props) => JSX.Element>((done) => {
      resolve = () => done(component)
    })
  }
  return { load, resolve: () => resolve(), calls: () => calls }
}

function Counter({ label }: { readonly label: string }) {
  const [count, setCount] = useState(0)
  return <button type="button" onClick={() => setCount((value) => value + 1)}>{`${label} ${count}`}</button>
}

describe('lazyScreen — 화면 덩이 나눠 받기', () => {
  it('받아 둔 화면은 첫 그림부터 곧바로 선다 (Suspense 를 안 거친다)', async () => {
    const deferred = deferredLoad(Counter)
    const Screen = lazyScreen(deferred.load)
    const preloading = Screen.preload()
    deferred.resolve()
    await preloading
    render(<Screen label="관리" />)
    expect(screen.getByRole('button').textContent).toBe('관리 0')
  })

  it('아직 못 받았으면 빈 채로 있다가 덩이가 오면 선다 — 받기는 한 번뿐', async () => {
    const deferred = deferredLoad(Counter)
    const Screen = lazyScreen(deferred.load)
    render(<Screen label="경기" />)
    expect(screen.queryByRole('button')).toBeNull()
    void Screen.preload()
    await act(async () => {
      deferred.resolve()
    })
    expect(screen.getByRole('button').textContent).toBe('경기 0')
    expect(deferred.calls()).toBe(1)
  })

  it('늦게 선 화면도 다시 그릴 때 상태를 잃지 않는다 (컴포넌트 꼴이 도중에 안 바뀐다)', async () => {
    const deferred = deferredLoad(Counter)
    const Screen = lazyScreen(deferred.load)
    const { rerender } = render(<Screen label="수비" />)
    await act(async () => {
      deferred.resolve()
    })
    fireEvent.click(screen.getByRole('button'))
    rerender(<Screen label="수비" />)
    expect(screen.getByRole('button').textContent).toBe('수비 1')
  })

  it('preloadLazyScreens 는 차례가 작은 것부터 하나씩 받는다', async () => {
    const order: string[] = []
    const make = (name: string, rank: number) =>
      lazyScreen(async () => {
        order.push(name)
        return Counter
      }, rank)
    make('나중', 90)
    make('먼저', 5)
    make('가운데', 50)
    await preloadLazyScreens()
    expect(order.slice(-3)).toEqual(['먼저', '가운데', '나중'])
  })

  it('받기가 실패하면 다음에 다시 받는다', async () => {
    let calls = 0
    const Screen = lazyScreen(async () => {
      calls += 1
      if (calls === 1) throw new Error('망 끊김')
      return Counter
    })
    await expect(Screen.preload()).rejects.toThrow('망 끊김')
    await Screen.preload()
    render(<Screen label="재시도" />)
    expect(screen.getByRole('button').textContent).toBe('재시도 0')
  })
})

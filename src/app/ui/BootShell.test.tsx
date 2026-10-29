// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Screen } from '@/app/model/screen'
import { BootShell } from '@/app/ui/BootShell'

afterEach(cleanup)

function FakeApp({ bootScreen }: { readonly bootScreen?: Screen }) {
  return <div data-testid="앱">{bootScreen?.kind ?? '이용안내'}</div>
}

function deferredApp() {
  let resolve: () => void = () => {}
  const loadApp = () =>
    new Promise<typeof FakeApp>((done) => {
      resolve = () => done(FakeApp)
    })
  return { loadApp, resolve: () => resolve() }
}

describe('BootShell — 앱 덩이를 받는 동안 이용안내', () => {
  it('앱이 오기 전에는 껍데기가 이용안내를 그리고, 오면 앱이 이용안내부터 선다', async () => {
    const app = deferredApp()
    render(<BootShell loadApp={app.loadApp} />)
    expect(screen.getByTestId('이용안내-본문')).toBeTruthy()
    expect(screen.queryByTestId('앱')).toBeNull()
    await act(async () => {
      app.resolve()
    })
    expect(screen.getByTestId('앱').textContent).toBe('이용안내')
    expect(screen.queryByTestId('이용안내-본문')).toBeNull()
  })

  it('앱이 오기 전에 키를 받으면 흰 판으로 기다렸다가 앱을 로고부터 세운다 (갱신 0x245dc)', async () => {
    const app = deferredApp()
    render(<BootShell loadApp={app.loadApp} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByTestId('이용안내-본문')).toBeNull()
    await act(async () => {
      app.resolve()
    })
    expect(screen.getByTestId('앱').textContent).toBe('로고')
  })

  it('받아 둔 앱이 있으면 첫 그림부터 앱이다 (개발 · e2e 바로가기)', () => {
    render(<BootShell loadApp={() => Promise.reject(new Error('부르면 안 된다'))} readyApp={FakeApp} />)
    expect(screen.getByTestId('앱').textContent).toBe('이용안내')
  })
})

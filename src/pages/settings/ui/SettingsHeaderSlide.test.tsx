// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { DEFAULT_SETTINGS } from '@/entities/settings/model/gameSettings'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 띄우기 = (mainMenu: { gamePoint: number } | undefined) => render(
  <SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onResetCareer={vi.fn()} onResetEditedNames={vi.fn()}
    mainMenu={mainMenu} onBack={vi.fn()} />,
)
const 틱 = (n: number) => act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * n) })

describe('머리띠가 미끄러지는 동안은 페이지를 안 그린다 — 0x593c8 의 [skin+0x84] ≠ 0 → 0x5a772(제 끝) 로 빠짐', () => {
  it('메인 메뉴 환경설정은 머리띠가 다 내려온 다음 그림부터 판이 나온다', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] })
    띄우기({ gamePoint: 0 })
    expect(screen.queryByTestId('공용판')).toBeNull()
    틱(3)
    expect(screen.queryByTestId('공용판')).toBeNull()
    틱(5)
    expect(screen.queryByTestId('공용판')).not.toBeNull()
  })

  it('경기 중 "설정"(머리띠 없음)은 처음부터 그린다', () => {
    띄우기(undefined)
    expect(screen.queryByTestId('공용판')).not.toBeNull()
  })
})

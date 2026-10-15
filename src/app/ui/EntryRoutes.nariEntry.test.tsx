// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen as view } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { Screen } from '@/app/model/screen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

// jsdom 은 스프라이트 원점 json 을 못 읽어 칸 단추를 안 그린다 — 칸마다 같은 크기를 주어 바퀴·릴 단추를 세운다
vi.mock('@/shared/lib/sprite/useFrameOrigins', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/sprite/useFrameOrigins')>()
  const origins = new Proxy({}, { get: () => ({ x: 0, y: 0, width: 40, height: 10 }) })
  return { ...actual, useFrameOrigins: () => origins }
})

const { EntryRoutes } = await import('@/app/ui/EntryRoutes')

type Props = ComponentProps<typeof EntryRoutes>

/**
 * 사용자 보고 "첫 메뉴에서 나만의 리그 확인버튼 눌러도 안 들어가져".
 *
 * 마우스 포인터가 메뉴 위에 멈춰 있으면, 키로 바퀴(하위 4)·릴(하위 5)을 돌릴 때 포인터 아래로 다른 칸이 돌아 들어오고
 * 브라우저가 그 칸에 mouseenter 를 쏜다. 예전 웹판은 mouseenter 로 커서를 옮겨서, 게임시작 → ↓↓(나만의리그) → OK 가
 * 일반모드 창 · 홈런더비 · 스페셜 같은 엉뚱한 칸으로 갔다(헤드리스 크롬에서 재현). 원본은 키패드뿐이라 올려 두기만으로는 고르지 않는다.
 */

// 아랫단 바탕 띠가 자라는 넉 틱 동안은 하위 5 가 키를 버린다 — 틱을 시계로 돌린다
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 틱지남 = () => {
  for (let step = 0; step < 10; step += 1) {
    act(() => {
      vi.advanceTimersByTime(200)
    })
  }
}

/**
 * 멈춘 포인터 아래로 칸이 돌아 들어온 것처럼, 지금 그려진 바퀴·릴 칸 단추마다 mouseenter 를 쏜다.
 * 창(MessageBox)의 단추는 돌지 않는 자리라 여기서 건드리지 않는다
 */
const 포인터아래로칸이지나감 = () => {
  const 칸들 = view.queryAllByRole('button').filter((button) => !(button as HTMLButtonElement).disabled
    && button.getAttribute('aria-label') !== '되돌아가기' && button.closest('[role="dialog"]') === null)
  for (const 칸 of 칸들) {
    act(() => {
      fireEvent.mouseEnter(칸)
      fireEvent.mouseOver(칸)
    })
  }
}

const 누르기 = (key: string) => {
  act(() => {
    fireEvent.keyDown(window, { key })
  })
  틱지남()
  포인터아래로칸이지나감()
}

/** 원본 좌표 그대로 바닥(y 320) 밖에 놓인 칸 — 단추는 있어도 화면에 안 보여 누를 수 없다 */
const 화면밖 = (name: string) => {
  const 칸 = view.queryByRole('button', { name })
  return 칸 === null || parseFloat(칸.style.top) >= 320
}

function 메인메뉴(continueSaved = vi.fn()) {
  const setScreen = vi.fn()
  render(<EntryRoutes
    screen={{ kind: '메인메뉴' } as Screen}
    setScreen={setScreen}
    // 타자편 커리어가 저장돼 있다 — [14] 타자편이면 이어하기(장면 0x106 → 0x1c154)로 간다
    session={{ career: null, savedCareer: createCareer('나리'), actions: { continueSaved } } as unknown as Props['session']}
    gameSettings={{ settings: undefined, setSettings: vi.fn() } as unknown as Props['gameSettings']}
    collection={EMPTY_COLLECTION}
    random={createSeededRandom(1)}
    wallet={{ balance: 0 } as unknown as Props['wallet']}
  />)
  return { setScreen, continueSaved }
}

describe('메인 메뉴 → 게임시작 → 나만의리그 → [14] 타자편 — 포인터가 메뉴 위에 멈춰 있어도', () => {
  it('↓↓ 뒤 OK 는 [14] 를 띄우고, 거기서 OK 면 저장된 타자편으로 이어 간다', () => {
    const { setScreen, continueSaved } = 메인메뉴()
    포인터아래로칸이지나감()

    // 윗단 [게임시작] → 아랫단 최근게임 → ↓↓ 나만의리그 → OK
    for (const key of ['Enter', 'ArrowDown', 'ArrowDown', 'Enter']) 누르기(key)

    expect(view.getByText('플레이 하시겠습니까?', { exact: false })).toBeTruthy()
    // 다른 모드(일반모드 창 [13] · 홈런더비 · 스페셜)로 새지 않았다
    expect(view.queryByText('진행하시겠습니까?', { exact: false })).toBeNull()
    expect(setScreen).not.toHaveBeenCalled()

    누르기('Enter')
    expect(continueSaved).toHaveBeenCalledTimes(1)
  })

  it('마우스를 올리기만 해서는 커서가 안 옮겨진다 — 칸을 누르면 그 칸까지 릴이 돌아 고르기만 하고, 시작은 설명 판 누름이다', () => {
    const { setScreen } = 메인메뉴()
    누르기('Enter')
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) 누르기(key)
    // 커서는 시즌모드 — 보이는 세 줄(최근게임 · 일반모드 · 나만의리그) 중 나만의리그를 누른다
    act(() => {
      fireEvent.click(view.getByRole('button', { name: '나만의리그' }))
    })
    틱지남()
    포인터아래로칸이지나감()
    // 고르기만 했다 — 창도 안 뜨고 화면도 안 바뀐다
    expect(view.queryByText('플레이 하시겠습니까?', { exact: false })).toBeNull()
    expect(setScreen).not.toHaveBeenCalled()

    act(() => {
      fireEvent.click(view.getByRole('button', { name: '고른 칸 시작' }))
    })
    틱지남()
    expect(view.getByText('플레이 하시겠습니까?', { exact: false })).toBeTruthy()
    expect(setScreen).not.toHaveBeenCalled()
  })

  it('바닥 밖 칸도 보이는 칸을 거듭 눌러 닿는다 — 바퀴: 환경설정 → 도움말, 릴: 대전모드 → 일반모드', () => {
    const { setScreen } = 메인메뉴()
    const 누름 = (name: string) => {
      act(() => {
        fireEvent.click(view.getByRole('button', { name }))
      })
      틱지남()
    }
    // 처음 메뉴 커서 게임시작 — 스페셜(45°) · 도움말(90°)은 바닥 밖. 환경설정(180°)을 누르면 바퀴가 세 칸 돌아
    // 도움말이 315° 자리로 들어온다
    expect(화면밖('도움말')).toBe(true)
    누름('환경설정')
    expect(setScreen).not.toHaveBeenCalled()
    누름('도움말')
    누름('고른 칸 시작')
    expect(setScreen).toHaveBeenCalledTimes(1)
  })

  it('릴의 바닥 밖 칸 — 최근게임에서 대전모드를 누르면 일반모드가 윗줄로 올라온다', () => {
    메인메뉴()
    누르기('Enter')
    const 누름 = (name: string) => {
      act(() => {
        fireEvent.click(view.getByRole('button', { name }))
      })
      틱지남()
    }
    expect(화면밖('일반모드')).toBe(true)
    누름('대전모드')
    누름('일반모드')
    누름('고른 칸 시작')
    // 일반모드 진입 창 [13]
    expect(view.getByRole('button', { name: '빠른실행' })).toBeTruthy()
  })
})

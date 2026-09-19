// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { CreatePlayerScreen } from '@/pages/create-player/ui/CreatePlayerScreen'
import type { RookieProfile } from '@/entities/career/model/playerCareer'

afterEach(cleanup)

type OnCreate = (name: string, profile: RookieProfile) => void

const 화면 = (onCreate: OnCreate = () => {}) =>
  render(<CreatePlayerScreen onCreate={onCreate} onCancel={() => {}} />)

describe('선수 등록 — 확인 질문은 화면을 비우지 않는다', () => {
  it('[등록] 을 눌러도 입력한 항목들이 그대로 보인다 — 원본은 메시지 상자만 얹는다', () => {
    화면()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '테스트' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))

    // 질문이 뜨지만 뒤 화면의 항목들이 사라지지 않는다
    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
    expect(screen.getByText('포지션')).toBeTruthy()
    expect(screen.getByText('배팅 타입')).toBeTruthy()
  })

  it('[예] 를 고르면 입력한 이름으로 등록된다', () => {
    let created: string | null = null
    화면((name) => { created = name })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '테스트' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).toBe('테스트')
  })

  it('[아니오] 를 고르면 질문만 닫히고 화면은 그대로다', () => {
    화면()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '테스트' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(screen.queryByText(/이대로 결정/)).toBeNull()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})

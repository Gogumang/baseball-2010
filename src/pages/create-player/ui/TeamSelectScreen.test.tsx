// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { TEAMS } from '@/shared/config/original/teams'
import { GRID, TEAM_COUNT, cellPositionOf } from '@/pages/create-player/lib/teamSelectLayout'

/** 팀 고르기 (상태 0x65) — 15팀 격자에서 하나를 고른다 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof TeamSelectScreen>[0]> = {}) =>
  render(<TeamSelectScreen onSelect={vi.fn()} onCancel={vi.fn()} {...overrides} />)

describe('팀 고르기', () => {
  it('팀 칸 15개를 5열 격자로 놓는다', () => {
    띄우기()

    // 격자 칸은 40px 정사각이다 — 아래 '되돌아가기' 버튼과 이것으로 갈린다
    const 칸들 = screen.getAllByRole('button').filter((button) => button.style.width === `${GRID.cell}px`)

    expect(칸들).toHaveLength(TEAM_COUNT)
    expect(칸들[0].style.left).toBe(`${cellPositionOf(0).x}px`)
    expect(칸들[0].style.width).toBe(`${GRID.cell}px`)
    expect(칸들[5].style.top).toBe(`${cellPositionOf(5).y}px`)
  })

  it('히든 다섯 팀은 해금 전까지 ??? 다', () => {
    띄우기()

    expect(screen.getAllByRole('button', { name: '???' })).toHaveLength(5)
  })

  it('해금한 히든 팀은 이름이 나온다', () => {
    띄우기({ openedHiddenIds: [12] })

    expect(screen.getByRole('button', { name: TEAMS[12].name })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '???' })).toHaveLength(4)
  })

  it('열린 팀을 누르면 그 팀 번호를 넘긴다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.click(screen.getByRole('button', { name: TEAMS[3].name }))

    expect(onSelect).toHaveBeenCalledWith(3)
  })

  it('잠긴 팀은 눌러도 고르지 않는다 — 커서만 옮긴다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.click(screen.getAllByRole('button', { name: '???' })[0])

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('좌우 키로 커서가 움직이고 엔터로 고른다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('격자 커서는 끝에서 멈춘다 — 감싸지 않는다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('칸마다 파란 바탕 그림(slt_frame 0)을 깐다', () => {
    const { container } = 띄우기()

    // jsdom 에는 canvas 도 vanilla-extract 도 없어 CSS 로는 못 본다 — src 로 센다
    expect(container.querySelectorAll('img[src$="slt_frame/000.png"]')).toHaveLength(TEAM_COUNT)
  })

  it('칸 안 로고는 큰 team_logo 를 칸에 맞게 줄여 그린다 (근사)', () => {
    const { container } = 띄우기()

    const 로고 = container.querySelector<HTMLImageElement>(`img[src$="team_logo/003.png"]`)

    expect(로고).toBeTruthy()
    expect(로고?.style.width).toBe('38px')
  })

  it('고른 칸에만 노란 테두리 그림(slt_frame 1)이 붙는다', () => {
    const { container } = 띄우기()

    expect(container.querySelectorAll('img[src$="slt_frame/001.png"]')).toHaveLength(1)

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    const 테두리들 = container.querySelectorAll('img[src$="slt_frame/001.png"]')
    expect(테두리들).toHaveLength(1)
    // 커서가 1번 칸으로 옮겨 갔다 — 42px 그림이라 40px 칸에서 1px 씩 비어져 나온다
    expect((테두리들[0].parentElement as HTMLElement).style.left).toBe(`${cellPositionOf(1).x}px`)
  })

  it('머리띠 제목은 prop 으로 갈아 끼운다', () => {
    // 나만의리그타자편 = game_frame 9(제목) + 10(타자편)
    const { container } = 띄우기({ title: '나만의리그타자편' })

    expect(container.querySelector('img[src$="game_frame/009.png"]')).toBeTruthy()
    expect(container.querySelector('img[src$="game_frame/010.png"]')).toBeTruthy()

    cleanup()
    // 기본값은 팀선택 = game_frame 5
    const 기본 = 띄우기()
    expect(기본.container.querySelector('img[src$="game_frame/005.png"]')).toBeTruthy()
  })

  it('아래 키는 한 줄(5칸)씩 내려간다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(GRID.columns)
  })
})

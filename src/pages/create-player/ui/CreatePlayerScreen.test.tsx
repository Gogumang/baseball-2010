// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { CreatePlayerScreen } from '@/pages/create-player/ui/CreatePlayerScreen'
import { cursorRectOf } from '@/pages/create-player/lib/createPlayerLayout'
import { batterLayerPaletteIndex } from '@/widgets/batting-stage/lib/batterLayers'
import type { RookieProfile } from '@/entities/career/model/playerCareer'

/**
 * 선수 등록 (0x15f34 · C-4/C-6) — 원본 기본정보 카드 위에 커서만 얹은 화면이다.
 * 확인 질문(0x67)도 화면을 비우지 않고 메시지 상자만 얹는다.
 */

afterEach(cleanup)

type OnCreate = (name: string, profile: RookieProfile) => void

const 화면 = (onCreate: OnCreate = () => {}) =>
  render(<CreatePlayerScreen onCreate={onCreate} onCancel={() => {}} />)

const 커서 = () => screen.getByTestId('선수등록-커서')
const 이름넣기 = (name: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value: name } })

describe('선수 등록 배치', () => {
  it('정보 칸 여덟을 원본 값으로 채운다 — 타순은 보여 주기만 하는 신인 9번이다', () => {
    화면()

    expect(screen.getByText('서울 드래곤즈')).toBeTruthy()
    expect(screen.getByText('타격형')).toBeTruthy()
    expect(screen.getByText('내야')).toBeTruthy()
    expect(screen.getByText('우타')).toBeTruthy()
    expect(screen.getByText('황인')).toBeTruthy()
    expect(screen.getByText('9')).toBeTruthy()
  })

  it('커서는 고른 줄의 값 칸에 놓인다 — 처음은 이름 줄 (59,200,83,17)', () => {
    화면()

    const rect = cursorRectOf(0)
    expect(커서().style.left).toBe(`${rect.x}px`)
    expect(커서().style.top).toBe(`${rect.y}px`)
    expect(커서().style.width).toBe(`${rect.width}px`)
  })

  it('아래 키로 줄을 옮기면 커서가 원본 순서(이름 → 타입)로 내려간다', () => {
    화면()

    fireEvent.keyDown(window, { key: 'ArrowDown' })

    const rect = cursorRectOf(1)
    expect(커서().style.left).toBe(`${rect.x}px`)
    expect(커서().style.top).toBe(`${rect.y}px`)
  })

  it('고른 줄만 양옆 화살표를 가진다', () => {
    화면()
    expect(screen.queryByRole('button', { name: '타입 다음' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '타입 타격형' }))

    expect(screen.getByRole('button', { name: '타입 이전' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '타입 다음' })).toBeTruthy()
  })

  it('좌우로 값을 바꾼다 — 타입을 바꾸면 값 칸이 따라 바뀐다', () => {
    화면()
    fireEvent.click(screen.getByRole('button', { name: '타입 타격형' }))

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('장타형')).toBeTruthy()
  })

  it('화살표를 눌러도 값이 바뀐다 — 손 줄은 우타 ↔ 좌타', () => {
    화면()
    fireEvent.click(screen.getByRole('button', { name: '손 우타' }))
    fireEvent.click(screen.getByRole('button', { name: '손 다음' }))

    expect(screen.getByText('좌타')).toBeTruthy()
  })
})

describe('선수 등록 — 확인 질문은 화면을 비우지 않는다', () => {
  it('[등록] 을 눌러도 입력한 항목들이 그대로 보인다 — 원본은 메시지 상자만 얹는다', () => {
    화면()
    이름넣기('테스트')
    fireEvent.click(screen.getByRole('button', { name: '등록' }))

    // 질문이 뜨지만 뒤 화면의 항목들이 사라지지 않는다
    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
    expect(screen.getByText('타격형')).toBeTruthy()
    expect(screen.getByText('내야')).toBeTruthy()
  })

  it('[예] 를 고르면 입력한 이름과 고른 항목으로 등록된다', () => {
    let created: { name: string; profile: RookieProfile } | null = null
    화면((name, profile) => { created = { name, profile } })
    이름넣기('테스트')
    fireEvent.click(screen.getByRole('button', { name: '손 우타' }))
    fireEvent.click(screen.getByRole('button', { name: '손 다음' }))
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).not.toBeNull()
    expect(created!.name).toBe('테스트')
    expect(created!.profile.battingSide).toBe(1)
  })

  it('[아니오] 를 고르면 질문만 닫히고 화면은 그대로다', () => {
    화면()
    이름넣기('테스트')
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(screen.queryByText(/이대로 결정/)).toBeNull()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('이름이 비면 등록할 수 없다 (원본 입력기도 빈 이름은 확인을 안 받는다)', () => {
    화면()

    expect(screen.getByRole('button', { name: '등록' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('선수 등록 — 피부·팀이 그림 팔레트를 고른다 (C-1)', () => {
  const 몸통 = './sprites/batter_balancer/frames'
  const 장타몸통 = './sprites/batter_sluger/frames'
  const 헬멧 = './sprites/batter_helmet/frames'

  it('몸통은 피부 × 15 + 팀 이다 (0x78be8)', () => {
    expect(batterLayerPaletteIndex(몸통, 0, 2)).toBe(2)
    expect(batterLayerPaletteIndex(몸통, 1, 0)).toBe(15)
    expect(batterLayerPaletteIndex(장타몸통, 2, 14)).toBe(44)
  })

  it('헬멧은 팀만 본다 — 헬멧엔 피부가 없다 (0x78c14)', () => {
    expect(batterLayerPaletteIndex(헬멧, 0, 7)).toBe(7)
    expect(batterLayerPaletteIndex(헬멧, 2, 7)).toBe(7)
  })

  it('그림자·배트·다리는 .mpl 이 없어 구운 색 그대로다', () => {
    expect(batterLayerPaletteIndex('./sprites/batter_shadow/frames', 2, 7)).toBeNull()
    expect(batterLayerPaletteIndex('./sprites/batter_batter/frames', 2, 7)).toBeNull()
    expect(batterLayerPaletteIndex('./sprites/item_bat_leg_0/frames', 2, 7)).toBeNull()
  })

  it('피부를 바꾸면 몸통 팔레트 번호가 15 씩 옮겨 간다 — 같은 팀에서 세 벌', () => {
    const 팀 = 5
    expect([0, 1, 2].map((skin) => batterLayerPaletteIndex(몸통, skin, 팀))).toEqual([5, 20, 35])
  })
})

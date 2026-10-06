// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { startGame } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { GameScreen } from '@/pages/game/ui/GameScreen'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'

afterEach(cleanup)

const 진행 = (bases = { first: false, second: false, third: false }): GameProgress => {
  const base = startGame(createSeededRandom(20100901))
  return { ...base, game: { ...base.game, bases } }
}

const 띄우기 = (
  props: Partial<Parameters<typeof GameScreen>[0]> = {},
  bases?: { first: boolean; second: boolean; third: boolean },
) =>
  render(
    <GameScreen
      career={createCareer('테스트')}
      progress={진행(bases)}
      atBat={createAtBat()}
      pitcherAbility={DEFAULT_PITCHER_ABILITY}
      isPaused={false}
      bannerText=""
      random={createSeededRandom(1)}
      onPitchResolved={vi.fn()}
      onQuit={vi.fn()}
      {...props}
    />,
  )

describe('나만의리그 타자편 경기 중 메뉴 (표 0xcfcfc 행 2)', () => {
  it('네 칸이 뜬다 — 자동진행·다시하기는 나리 행에 없다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    for (const 칸 of ['계속', '조작방법', '설정', '나가기']) {
      expect(screen.getByText(칸)).toBeTruthy()
    }
    expect(screen.queryByText('자동진행')).toBeNull()
  })

  it('나가기를 고르면 StrGAME[0] 확인 문구가 뜨고, 예가 경기를 끝낸다', () => {
    const onQuit = vi.fn()
    띄우기({ onQuit })
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('나가기'))

    expect(screen.getByText(/메인메뉴로 나가시겠습니까/)).toBeTruthy()
    fireEvent.click(screen.getByText('예'))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })

  it('설정 손잡이를 안 넘기면 설정 칸이 잠긴다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect(screen.getByText('설정').closest('button')?.disabled).toBe(true)
  })
})

describe('도루 (0x53610 → 메시지 0x583)', () => {
  it('1루에 주자가 있으면 도루 키가 뜬다 — 공이 날기 전(상태 0x11 밖)의 3 키는 먹고 끝난다', () => {
    const onSteal = vi.fn()
    띄우기({ onSteal }, { first: true, second: false, third: false })

    expect(screen.getByRole('button', { name: '도루 1루' })).toBeTruthy()
    fireEvent.keyDown(window, { key: '3' })
    expect(onSteal).not.toHaveBeenCalled()
  })

  it('2루가 막혀 있으면 1루 주자는 못 뛴다', () => {
    const onSteal = vi.fn()
    띄우기({ onSteal }, { first: true, second: true, third: true })

    fireEvent.keyDown(window, { key: '3' })
    expect(onSteal).not.toHaveBeenCalled()
  })

  it('앱이 도루 손잡이를 안 넘기면 입구가 없다', () => {
    띄우기({}, { first: true, second: false, third: false })

    expect(screen.queryByRole('button', { name: /도루/ })).toBeNull()
  })
})

describe('1회초 판 (상태 0x18) — 선공·1번 타자', () => {
  const 선공1번 = () => startGame(createSeededRandom(3), 0, 1, undefined, PLAYER_SIDE_FIRST_BAT)

  it('판이 먼저 서서 OK 를 기다리고, 그 동안 메뉴 키가 안 먹는다 — OK 뒤 타석', () => {
    띄우기({ progress: 선공1번() })
    expect(screen.getByText('1회초')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '메뉴' })).toBeNull()
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.queryByText('조작방법')).toBeNull()

    fireEvent.keyDown(window, { key: '5' })
    expect(screen.getByRole('button', { name: '메뉴' })).toBeTruthy()
  })

  it('첫 공이 나간 뒤(수비 재생으로 화면이 다시 올라와도) 판이 다시 서지 않는다', () => {
    띄우기({ progress: 선공1번(), atBat: { ...createAtBat(), strikes: 1 } })
    expect(screen.getByRole('button', { name: '메뉴' })).toBeTruthy()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { SCENE_CONFIRM_READY_FRAMES, SCENE_PREPARE_FRAMES } from '@/features/play-game/model/useSceneConfirm'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createCareer } from '@/entities/career/model/playerCareer'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { startGame } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { GameScreen } from '@/pages/game/ui/GameScreen'
import { DEFAULT_SETTINGS } from '@/entities/settings/model/gameSettings'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'

afterEach(cleanup)

const 진행 = (bases = { first: false, second: false, third: false }): GameProgress => {
  const base = startGame(createSeededRandom(20100901))
  return { ...base, game: { ...base.game, bases } }
}

/** 0xe 의 OK 를 이미 받은 자리 (0xf) */
const 받은진행 = (bases = { first: false, second: false, third: false }): GameProgress => ({
  ...진행(bases),
  sceneConfirm: null,
})

const 띄우기 = (
  props: Partial<Parameters<typeof GameScreen>[0]> = {},
  bases?: { first: boolean; second: boolean; third: boolean },
) =>
  render(
    <GameScreen
      career={createCareer('테스트')}
      progress={받은진행(bases)}
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

  it('[조작방법]은 띠 없이 뷰어만 띄우고, CLR 로 닫으면 경기 중 메뉴로 돌아간다 (0x3ce54 · 0x3ca36)', () => {
    const { container } = 띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByText('조작방법'))

    expect(screen.getByText('<기본 조작>')).toBeTruthy()
    const 띠그림 = [...container.querySelectorAll('img')].filter((img) => img.getAttribute('src')?.includes('game_frame'))
    expect(띠그림).toHaveLength(0)

    // '*' 는 뷰어(하위 4)에서 아무 일도 안 한다
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByText('<기본 조작>')).toBeTruthy()

    // 여는 때는 장 고르기라 CLR 한 번에 닫힌다 → 메뉴가 다시 뜬다
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('<기본 조작>')).toBeNull()
    expect(screen.getByText('조작방법')).toBeTruthy()
  })

  it('[조작방법]은 경기 화면을 내리지 않고 그 위에 얹힌다 — 닫으면 메뉴 커서가 그대로다 (0x3ca36 · 0x52efe)', () => {
    띄우기()
    fireEvent.keyDown(window, { key: '*' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /조작방법/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByText('조작방법'))

    // 뷰어 뒤에 경기 장면(머리 제목)이 그대로 있다
    expect(screen.getByText('<기본 조작>')).toBeTruthy()
    expect(screen.getByText(/번타자/)).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('option', { name: /조작방법/ }).getAttribute('aria-selected')).toBe('true')

    // '*' 로 닫았다 새로 열면(0x3c02c → 0x6c00c(메뉴, 0, 0)) 첫 칸이다
    fireEvent.keyDown(window, { key: '*' })
    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByRole('option', { name: /계속/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('[설정]에서 돌아와도 경기 중 메뉴로, 커서는 그대로다 (0x3cb0e)', () => {
    띄우기({ settings: DEFAULT_SETTINGS, onSettingsChange: vi.fn() })
    fireEvent.keyDown(window, { key: '*' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.click(screen.getByText('설정'))
    expect(screen.queryByText('경기 중 메뉴')).toBeNull()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('option', { name: /설정/ }).getAttribute('aria-selected')).toBe('true')
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

describe('상태 0xe — 내 타석마다 사람 OK 를 기다린다 (0x39e14 → 0x532b0)', () => {
  afterEach(() => vi.useRealTimers())

  it('진행기가 실은 대기가 있으면 확인 소프트키가 서고, 세 갱신 뒤 OK 하나로 걷힌다 — 다시 서도 다시 묻지 않는다', () => {
    vi.useFakeTimers()
    const progress = 진행()
    expect(progress.sceneConfirm).toBeTruthy()
    const 그리기 = () => (
      <GameScreen
        career={createCareer('테스트')}
        progress={progress}
        atBat={createAtBat()}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isPaused={false}
        bannerText=""
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
        onQuit={vi.fn()}
      />
    )
    const { unmount } = render(그리기())
    // 1회초 판(0x18)이 서 있으면 먼저 닫는다
    if (screen.queryByRole('button', { name: '메뉴' }) === null) fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.getByRole('button', { name: '확인' })).toBeTruthy()
    // 0xd 두 그림 뒤 0xe — 소개 판(0x44944)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_PREPARE_FRAMES))
    expect(screen.getByTestId('소개판')).toBeTruthy()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
    // 수비 화면을 갔다 와 화면이 다시 서도 같은 대기는 이미 받았다
    unmount()
    render(그리기())
    expect(screen.queryByRole('button', { name: '확인' })).toBeNull()
  })

  it('타석 결과 연출(배너) 동안은 OK 를 안 받는다', () => {
    vi.useFakeTimers()
    띄우기({ bannerText: '삼진', progress: 진행() })
    if (screen.queryByRole('button', { name: '메뉴' }) === null) fireEvent.keyDown(window, { key: 'Enter' })
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * SCENE_CONFIRM_READY_FRAMES))
    fireEvent.keyDown(window, { key: '5' })
    expect((screen.getByRole('button', { name: '확인' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

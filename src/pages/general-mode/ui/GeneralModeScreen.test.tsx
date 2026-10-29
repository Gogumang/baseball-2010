// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { TEAMS } from '@/shared/config/original/teams'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { GeneralModeScreen } from '@/pages/general-mode/ui/GeneralModeScreen'
import { generalGameOfSave } from '@/pages/general-mode/lib/generalModeResume'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/**
 * 경기 장면 0x104 의 로딩 판(상태 7 · 9 · 8 — 생성자 0x3301c 가 모드 갈래 없이 상태 7 을 예약한다) — 그림 대신 그리자마자 끝낸다
 * (적재를 다 그린 꼴). 받은 팁 · 진행 칸 끝을 남긴다
 */
const 로딩판 = vi.hoisted(() => [] as { tip: string; steps: number | undefined }[])
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async () => {
  const { useEffect, useEffectEvent } = await import('react')
  return {
    LoadingTip: ({ tip, steps, onDone }: { tip: string; steps?: number; onDone: () => void }) => {
      const finish = useEffectEvent(() => {
        로딩판.push({ tip, steps })
        onDone()
      })
      useEffect(() => finish(), [])
      return null
    },
  }
})

// 들어올 때 연출(머리띠 다섯 그림 · 격자 열림 애니 0x79fa8)과 그동안의 키 막음(`useListPageEntry`)은 따로 시험한다 — 여기서는 다 연 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useListPageEntry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/screen-frame/model/useListPageEntry')>()
  return { ...actual, useListPageEntry: actual.settledListPageEntry }
})

/**
 * 일반모드 한 판 (하위 상태 18 → 19 → 20 → 21 → 22 → 경기 장면 0x104).
 * 팀 고르기 두 장은 나만의리그가 쓰던 `TeamSelectScreen` 을 그대로 빌려 쓴다.
 */

afterEach(cleanup)

type Props = Parameters<typeof GeneralModeScreen>[0]

const 띄우기 = (overrides: Partial<Props> = {}) =>
  render(
    <GeneralModeScreen
      random={createSeededRandom(20100901)}
      openedAcePitcherIds={[0, 1, 2, 3, 4]}
      openedAceBatterIds={[0, 1, 2, 3, 4]}
      onFinish={vi.fn()}
      onExit={vi.fn()}
      {...overrides}
    />,
  )

/**
 * 경기정보 누름 칸은 키를 보낸다 — 들어올 때 연출(머리띠 5 · 배너 4 · 값 줄 펼침 8 그림)이 끝나야 키를 받는다(0x311b2).
 * 연출을 흘린 뒤 누른다. 부른 쪽 afterEach 가 진짜 시계로 되돌린다.
 */
const 연출_흘리고_누르기 = (name: string) => {
  act(() => {
    vi.advanceTimersByTime(millisecondsPerFrame() * 17)
  })
  fireEvent.click(screen.getByRole('button', { name }))
}

/** 격자 칸 하나 = 40px 정사각 */
const 칸들 = () => screen.getAllByRole('button').filter((button) => button.style.width === '40px')

describe('준비 흐름', () => {
  it('유저 팀 → AI 팀 → 선공 → 구장 → 마투수 → 마타자 → 경기정보 로 이어진다', async () => {
    띄우기()

    // 18 · 19 · 20 · 21 그림(0x2de3c · 0x2ddb0 · 0x2dd30 · 0x2dfe0)은 모두 맨 앞에서 공 무늬 바탕 0x5fd61 을 깐다 — 검정 바탕이 아니다
    // 18 → 19 는 화면 밀기(A-68) — 밀리는 동안 떠 둔 앞 화면에도 바탕이 있다
    const 공무늬 = () => screen.queryAllByTestId('바탕-공무늬')[0] ?? null
    // 18 유저 팀
    expect(공무늬()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: TEAMS[2].name }))
    // 19 AI 팀
    expect(공무늬()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: TEAMS[5].name }))
    // 20 단계 0 선공
    expect(공무늬()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '유저 선공' }))
    // 20 단계 1 구장
    fireEvent.click(screen.getByRole('button', { name: '이 구장으로' }))
    // 21 마투수 → 마타자
    expect(공무늬()).not.toBeNull()
    fireEvent.click(칸들()[0])
    fireEvent.click(칸들()[5])

    // 22 경기정보 — 21 에서 들어오면 머리띠(다섯 그림) · 배너(네 그림) 연출 뒤에 본문이 선다(0x63b15 넷째 인자 · 이전 ≠ 23)
    expect(screen.queryByTestId('경기정보-마투수-유저')).toBeNull()
    expect((await screen.findByTestId('경기정보-마투수-유저', {}, { timeout: 3000 })).textContent).toBe(ACE_PLAYERS[5].name)
    expect(screen.getByTestId('경기정보-마타자-유저').textContent).toBe(ACE_PLAYERS[0].name)
    expect(screen.getByRole('button', { name: '경기 시작' })).toBeTruthy()
  })

  it('첫 화면에서 CLR 하면 모드 목록으로 나간다', () => {
    const onExit = vi.fn()
    띄우기({ onExit })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    // 18 CLR 0x29d9a — 게임시작 목록(하위 5)으로 바로
    expect(onExit).toHaveBeenCalledWith(5)
  })

  it('AI 팀 화면에서 CLR 하면 유저 팀 화면으로 돌아간다 (나가지 않는다)', () => {
    const onExit = vi.fn()
    띄우기({ onExit })

    fireEvent.click(screen.getByRole('button', { name: TEAMS[2].name }))
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onExit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: TEAMS[2].name })).toBeTruthy()
  })

  it('잠긴 히든 팀 OK 는 힌트 팝업 [225] · [216+팀] · [0] 만 띄우고 단계는 그대로다 (18: 0x29d74 · 0x29d8a)', () => {
    띄우기({ openedHiddenTeamIds: [12] })

    // 잠긴 칸 넷(10 · 11 · 13 · 14) 중 셋째 = 13 미국
    fireEvent.click(screen.getAllByRole('button', { name: '???' })[2])

    const 알림글 = screen.getByRole('dialog', { name: '알림' }).textContent ?? ''
    expect(알림글).toContain('히든 팀 오픈 힌트')
    expect(알림글).toContain('메이저를 넘어서라')
    expect(알림글).toContain('선택 할 수 없는 팀입니다')
    // 일반모드라서 [1] "일반모드에서 사용 할 수 있습니다" 는 안 붙는다
    expect(알림글).not.toContain('일반모드에서')
    // 아직 18 — AI 팀으로 넘어가지 않았다
    expect(screen.getAllByRole('button', { name: '???' })).toHaveLength(4)
  })

  it('히든 팀은 해금 기록을 넘기면 고를 수 있다 — 일반모드라서다', () => {
    띄우기({ openedHiddenTeamIds: [12] })

    expect(screen.getByRole('button', { name: TEAMS[12].name })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '???' })).toHaveLength(4)
  })
})

describe('빠른실행', () => {
  it('준비 단계를 건너뛰고 경기정보에서 시작한다', () => {
    띄우기({ isQuickStart: true })

    expect(screen.getByRole('button', { name: '경기 시작' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '* 재선택' })).toBeTruthy()
  })

  it('경기정보에서 CLR 하면 바로 모드 목록으로 나간다', () => {
    const onExit = vi.fn()
    띄우기({ isQuickStart: true, onExit })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    // 빠른실행 22 CLR 0x313c4 `movs r1, #5` — 게임시작 목록(하위 5)
    expect(onExit).toHaveBeenCalledWith(5)
  })
})

describe('경기 시작', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('경기정보에서 OK 하면 팀 경기 화면으로 넘어간다', () => {
    띄우기({ isQuickStart: true })

    연출_흘리고_누르기('경기 시작')

    // 팀 경기 장면은 경기 시작 인트로(상태 0xc, 모드 1)부터 선다
    expect(screen.getByTestId('인트로-띠')).toBeTruthy()
  })

  it('경기정보 OK 가 첫 저장(0x3136e)을 넘긴다 — 1회초 아웃 0 의 일반모드 진행', () => {
    const onGameStart = vi.fn()
    const onGameSave = vi.fn()
    띄우기({ isQuickStart: true, onGameStart, onGameSave })
    // 22 들어옴 0x30f20 이 이미 블록만 한 번 썼다(31134 0x22755) — OK 는 그 뒤 첫 저장이다
    expect(onGameSave).toHaveBeenCalledTimes(1)
    onGameSave.mockClear()

    연출_흘리고_누르기('경기 시작')

    expect(onGameStart).toHaveBeenCalledTimes(1)
    expect(onGameSave).not.toHaveBeenCalled()
    const save = onGameStart.mock.calls[0]?.[0] as TeamGameProgress
    expect(save.options.mode).toBe(1)
    expect(save.game.inning).toBe(1)
    expect(save.game.half).toBe('초')
    expect(save.game.outs).toBe(0)
    // 저장 블록으로 다시 읽을 수 있는 꼴이다
    expect(generalGameOfSave(JSON.parse(JSON.stringify(save)))).not.toBeNull()
  })
})

describe('이어하기 (0x213c0(앱, 1, 0) → 장면 0x104)', () => {
  /** 경기정보 OK 가 넘긴 첫 저장 하나를 얻는다 */
  const 첫저장 = (): TeamGameProgress => {
    const onGameStart = vi.fn()
    vi.useFakeTimers()
    띄우기({ isQuickStart: true, onGameStart })
    연출_흘리고_누르기('경기 시작')
    const save = onGameStart.mock.calls[0]?.[0] as TeamGameProgress
    cleanup()
    vi.useRealTimers()
    return JSON.parse(JSON.stringify(save)) as TeamGameProgress
  }

  it('저장 진행이 있으면 준비 화면 없이 경기 장면(인트로부터)으로 바로 선다 — 이어서 쓰는 저장은 반 이닝 저장 몫이다', () => {
    const save = 첫저장()
    const onGameStart = vi.fn()
    const onGameSave = vi.fn()
    띄우기({ resumeGame: save, onGameStart, onGameSave })

    expect(screen.getByTestId('인트로-띠')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '경기 시작' })).toBeNull()
    expect(onGameStart).not.toHaveBeenCalled()
    expect(onGameSave).toHaveBeenCalled()
  })

  it('블록이 일반모드 진행이 아니면 이어하기로 못 읽는다', () => {
    expect(generalGameOfSave(null)).toBeNull()
    expect(generalGameOfSave({ options: { mode: 2 } })).toBeNull()
    expect(generalGameOfSave({ options: { mode: 1 }, game: { inning: 1, half: '초' } })).toBeNull()
  })
})

describe('경기진행 설정', () => {
  it("경기정보의 '0' 으로 창을 열고 CLR 로 닫는다", () => {
    vi.useFakeTimers()
    띄우기({ isQuickStart: true })

    연출_흘리고_누르기('0 경기설정')
    vi.useRealTimers()
    const 창 = screen.getByRole('group', { name: '경기진행 설정' })

    // 뒤쪽 경기정보 화면에도 같은 이름의 버튼이 있어 창 안에서만 찾는다
    fireEvent.click(within(창).getByRole('button', { name: '되돌아가기' }))
    expect(screen.queryByRole('group', { name: '경기진행 설정' })).toBeNull()
  })
})

describe('엔트리 편집 (상태 23, 편집기 0x55864)', () => {
  const 줄이름 = (index: number) => screen.getByTestId(`엔트리-칸-${index}-이름`).getAttribute('aria-label') ?? ''
  // 빠른실행 22 는 들어올 때 연출이 있어 머리띠 5 · 배너 4 · 값 줄 펼침 8 그림 뒤(그림 16)부터 키를 받는다 (0x311b2)
  const 연출_뒤_띄우기 = (overrides: Partial<Props>) => {
    vi.useFakeTimers()
    띄우기(overrides)
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 17)
    })
  }
  afterEach(() => {
    vi.useRealTimers()
  })
  /** 22 ↔ 23 은 화면 밀기(A-68) — 다섯 그림 동안 키를 버리니(0x246d8) 다 밀린 뒤 누른다 */
  const 밀기_지남 = () =>
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 6)
    })

  it("'4' 로 유저 팀 투수 엔트리를 열고, 0번과 2번을 바꾸면 경기정보 선발이 바뀐다 — '6' 으로 돌아온다", () => {
    연출_뒤_띄우기({ isQuickStart: true })
    fireEvent.keyDown(window, { key: '4' })
    밀기_지남()
    const 둘째 = 줄이름(2)
    for (const key of ['5', 'ArrowDown', 'ArrowDown', '5']) fireEvent.keyDown(window, { key })
    expect(줄이름(0)).toBe(둘째)

    // 유저 팀은 오른쪽 끝(3)으로 경기정보에 돌아간다 (0x2a370)
    fireEvent.keyDown(window, { key: '6' })
    expect(screen.getByTestId('경기정보-선발-유저').textContent).toBe(둘째)
  })

  it('22 → 23 은 화면 밀기(0xbdae9 종류 8, A-68) — 미는 다섯 그림 동안 키를 버린다(0x246d8)', () => {
    연출_뒤_띄우기({ isQuickStart: true })
    fireEvent.keyDown(window, { key: '4' })
    // 떠 둔 22 가 새 23 위에 겹친다
    const 떠둔화면 = () => document.querySelector('[class*="NariScreenPush_snapshot"]')?.childElementCount ?? 0
    expect(떠둔화면()).toBe(1)
    fireEvent.keyDown(window, { key: '6' })
    expect(screen.getByRole('group', { name: '엔트리 목록' })).toBeTruthy()
    밀기_지남()
    expect(떠둔화면()).toBe(0)
    fireEvent.keyDown(window, { key: '6' })
    expect(screen.queryByRole('group', { name: '엔트리 목록' })).toBeNull()
  })

  it("'6' 으로 연 CPU 팀 엔트리는 보기 전용이다 — OK 해도 순서가 그대로다", () => {
    연출_뒤_띄우기({ isQuickStart: true })
    fireEvent.keyDown(window, { key: '6' })
    밀기_지남()
    const 첫째 = 줄이름(0)
    for (const key of ['5', 'ArrowDown', '5']) fireEvent.keyDown(window, { key })
    expect(줄이름(0)).toBe(첫째)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: '경기 시작' })).toBeTruthy()
  })
})

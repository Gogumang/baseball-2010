// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { WALK_PLAY_KIND } from '@/features/defense-play/model/walkPlay'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'

/**
 * **경기를 끝낸 재생 판의 실책이 정산에 든다 — 투수편** (r248 — 타자편 r244 의 짝).
 * 원본은 그 판을 0x17 로 다 그린 뒤 판정 B 0xae3e8 이 0xd → 경기 끝 판 0x18 → 정산 0x19. 그리기 0x43278 이 실책 +0x2e 를 올린다.
 * 밀어내기 판(종류 2)은 0x12 대기 0x1f 틱 뒤에야 0x17 이다 — 예전 화면은 그 대기 동안 경기 끝 판을 띄웠다(재생 갈래보다 요약 갈래가
 * 아래라 대기가 끝나면 재생이 끼어들었지만, 그 사이 판 · 정산을 넘기면 실책이 빠진 요약이 나갔다).
 *
 * 결정적으로 — 씨앗 고정 · 등판일이 아닌 날(자동진행으로 끝까지)의 끝난 진행 재생 칸에 내 팀 수비 칸 4 가 악송구(+0xc0 == 4)를 본
 * 밀어내기 판을 넣는다(`usePitcherGame` 감싸기).
 */
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async () => {
  const { useEffect } = await import('react')
  return {
    LoadingTip: ({ onDone }: { onDone: () => void }) => {
      useEffect(() => {
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    },
  }
})

const 재생기록 = vi.hoisted(() => [] as string[])
/** 끝난 진행에 판을 넣기 시작하는가 — 둘째 시험은 경기 끝 판이 선 뒤에 켜 "판과 경기 끝이 함께 온" 화면 쪽 꼴을 만든다 */
const 주입 = vi.hoisted(() => ({ 켬: true }))
vi.mock('@/pages/defense/ui/DefensePlayback', async () => {
  const { useEffect } = await import('react')
  const { drawnReplayFieldingErrorsOf } = await import('@/features/defense-play/model/fieldingErrors')
  return {
    DefensePlayback: ({ ticks, onDone, onFieldingErrors }: {
      ticks?: readonly { readonly fielders: readonly { readonly slot: number }[] }[]
      onDone: () => void
      onFieldingErrors?: (errors: readonly unknown[]) => void
    }) => {
      useEffect(() => {
        if (ticks === undefined) return
        재생기록.push(document.querySelector('[alt="세이브"]') === null ? '재생' : '끝판 뒤 재생')
        const errors = drawnReplayFieldingErrorsOf(ticks)
        if (errors.length > 0) onFieldingErrors?.(errors)
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return <div data-testid="재생판" />
    },
  }
})

const 우리팀 = 0
/** 끝내기 밀어내기 판 — 틱 하나, 내 팀 수비 칸 4 가 악송구 4 를 본다(0x438c4) */
const 끝내기판 = {
  kind: WALK_PLAY_KIND,
  pitchJudgement: 3,
  advance: { runs: 1, bases: [true, true, true], outsAdded: 0 },
  ticks: [{ ball: { x: 0, y: 0, z: 0 }, runners: [], fielders: [{ slot: 4, x: 0, y: 0, z: 0, teamIndex: 우리팀, throwErrorTicks: 4 }] }],
  catchFielderSlot: 0,
  catchTick: 0,
  isUncatchable: false,
  caughtOnTheFly: false,
} as unknown as DefensePlayResult

vi.mock('@/pages/pitching/model/usePitcherGame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/pitching/model/usePitcherGame')>()
  const injected = new WeakMap<object, object>()
  return {
    ...actual,
    usePitcherGame: (...args: Parameters<typeof actual.usePitcherGame>) => {
      const session = actual.usePitcherGame(...args)
      if (!session.progress.game.isFinished || !주입.켬) return session
      let progress = injected.get(session.progress) as typeof session.progress | undefined
      if (progress === undefined) {
        progress = { ...session.progress, lastDefensePlay: 끝내기판 }
        injected.set(session.progress, progress)
      }
      return { ...session, progress }
    },
  }
})

const 옵션: PitcherGameOptions = {
  ourTeamId: 우리팀,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  // 등판일이 아니다 — 자동진행(0x21)으로 끝까지
  dayCounter: 3,
  isPostseason: false,
  stats: { control: 500, velocity: 500, breaking: 500, stamina: 400 },
  staminaAbility: 400,
  stamina: FULL_STAMINA,
  repertoire: { pitchMask: 0b101_0111, form: 0, magicNumber: 1 },
  magicCount: 4,
  teamMorale: 80,
  reputation: 500,
  gaugeSettingOn: false,
}

const 틱 = (n: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * n))

afterEach(() => {
  cleanup()
  setActiveSound(null)
  vi.useRealTimers()
})

describe('투수편 — 경기를 끝낸 재생 판은 다 그린 뒤 경기 끝 판 · 정산 (r248)', () => {
  it('밀어내기 재생이 경기 끝 판보다 먼저 서고, 그 판의 그린 실책이 정산 요약(leagueErrors)에 든다', () => {
    vi.useFakeTimers()
    setActiveSound(createSilentSound())
    재생기록.length = 0
    const onFinish = vi.fn<(summary: PitcherGameSummary) => void>()
    render(<PitcherGameScreen options={옵션} random={createSeededRandom(20100901)} onFinish={onFinish} gamePoint={100} />)
    // 인트로(0xc)를 '5' 로 건너뛰고 경기 끝까지
    fireEvent.keyDown(window, { key: '5' })
    for (let 번 = 0; 번 < 5000 && screen.queryByAltText('세이브') === null; 번 += 1) 틱(1)
    expect(재생기록).toEqual(['재생'])
    expect(screen.getByAltText('세이브')).toBeTruthy()
    // 경기 끝 판 OK(10틱 잠금 뒤) → 정산 → 나가기
    틱(10)
    fireEvent.keyDown(window, { key: '5' })
    틱(1)
    expect(screen.getByTestId('정산-판')).toBeTruthy()
    fireEvent.keyDown(window, { key: '5' })
    틱(1)
    expect(onFinish).toHaveBeenCalledTimes(1)
    const summary = onFinish.mock.calls[0]![0]
    expect(summary.leagueErrors).toHaveLength(1)
    expect(summary.leagueErrors[0]).toEqual(expect.objectContaining({ teamId: 우리팀 }))
  })

  it('밀어내기 판의 0x12 대기(0x1f 틱) 동안은 경기 끝 판이 아니라 경기 장면이 남고, 대기 뒤 재생 → 경기 끝 판', () => {
    vi.useFakeTimers()
    setActiveSound(createSilentSound())
    재생기록.length = 0
    주입.켬 = false
    try {
      const random = createSeededRandom(20100901)
      const onFinish = vi.fn()
      const 화면 = () => <PitcherGameScreen options={옵션} random={random} onFinish={onFinish} gamePoint={100} />
      const rendered = render(화면())
      fireEvent.keyDown(window, { key: '5' })
      for (let 번 = 0; 번 < 5000 && screen.queryByAltText('세이브') === null; 번 += 1) 틱(1)
      expect(screen.getByAltText('세이브')).toBeTruthy()
      // 이제 끝난 진행의 재생 칸에 밀어내기 판이 든다 — 0x12 대기 동안은 0x18 이 아니다
      주입.켬 = true
      rendered.rerender(화면())
      틱(2)
      expect(screen.queryByAltText('세이브')).toBeNull()
      expect(재생기록).toEqual([])
      틱(40)
      expect(재생기록).toEqual(['재생'])
      틱(1)
      expect(screen.getByAltText('세이브')).toBeTruthy()
    } finally {
      주입.켬 = true
    }
  })
})

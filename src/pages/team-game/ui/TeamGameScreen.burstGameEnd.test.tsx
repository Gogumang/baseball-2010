// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { BURST_MODE, BURST_TABLES } from '@/entities/burst-mission/model/burstMissionRow'
import { createBurstSession, resolveBurst } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstResolution } from '@/entities/burst-mission/model/burstMissionSession'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { setAutoRelaySpeed } from '@/pages/team-game/model/autoRelaySpeed'
import { createMemoryAutoRelayRecordPort, setAutoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'

/**
 * **경기를 끝낸 타석의 돌발 결과 창은 경기 끝 판 앞 — 시즌 경기 (r317 — 나리 타자편 r315 의 짝)**.
 * 원본 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 0x8f414 가 참이면 다음 상태가 0x18 · 0x19 여도 0x1d · 0x1c(결과 창 · 진입 보상 0x8e34c)를 먼저
 * 거친 뒤 +0x1b6c 로 간다. 웹 팀 경기 화면은 끝난 경기(`summary !== null`)의 경기 끝 판 갈래가 수비 판 · 경기 장면(창이 얹히는 자리)보다
 * 앞이라 경기를 끝낸 타석의 결과 창이 안 섰다(보상은 `burstRewardDeltas` 로 시즌 정산에 얹혀 잃지 않았다).
 *
 * 결정적으로 — 씨앗 고정 · 사람 타석 없는 시즌 경기(모드 2, 자동진행 중계로 끝까지)의 끝난 진행에 SEASON 표 행의 판정을 싣는다
 * (`useTeamGame` 감싸기). 창을 닫으면(`closeBurst`) 판정을 내린다
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

/** 판정을 싣는 때 — 끝난 진행(경기 끝 앞) · 첫 중계 진행(자동진행 0x21 앞) · 교대 판이 실린 진행(0x18 앞) */
const 판정칸 = vi.hoisted(() => ({ 판정: null as unknown, 때: '끝' as '끝' | '중계' | '교대' }))

vi.mock('@/pages/team-game/model/useTeamGame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/team-game/model/useTeamGame')>()
  const { useState } = await import('react')
  const injected = new WeakMap<object, object>()
  return {
    ...actual,
    useTeamGame: (...args: Parameters<typeof actual.useTeamGame>) => {
      const session = actual.useTeamGame(...args)
      const [isClosed, setClosed] = useState(false)
      const 판정 = 판정칸.판정 as BurstResolution | null
      const 때맞음 =
        판정칸.때 === '끝'
          ? session.progress.game.isFinished
          : 판정칸.때 === '중계'
            ? session.progress.autoRelay != null
            : session.progress.halfInningBoard !== null
      if (!때맞음 || isClosed || 판정 === null) return session
      let progress = injected.get(session.progress) as typeof session.progress | undefined
      if (progress === undefined) {
        progress = { ...session.progress, burst: 판정.session, lastBurstResolution: 판정 }
        injected.set(session.progress, progress)
      }
      return { ...session, progress, actions: { ...session.actions, closeBurst: () => setClosed(true) } }
    },
  }
})

const 옵션: TeamGameOptions = {
  mode: BURST_MODE.시즌,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
  // 사람이 한 타석도 안 잡는 설정 — 첫 타석부터 중계로 끝까지
  settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 },
}

/** SEASON 표 첫 행이 판정 난 결과 — 판정이 나는 결과비트를 낮은 것부터 찾는다 */
function 시즌판정(): BurstResolution {
  const 시작 = createBurstSession(BURST_MODE.시즌)
  if (시작 === null) throw new Error('시즌 돌발 세션이 없습니다')
  const session = { ...시작, current: BURST_TABLES.SEASON[0]!, triggeredCount: 1 }
  for (let bits = 1; bits < 1 << 16; bits += 1) {
    const resolution = resolveBurst(session, bits)
    if (resolution.judgement !== null) return resolution
  }
  throw new Error('판정이 나는 결과비트가 없습니다')
}

const 흘리기 = (frames: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * frames))
const 창 = () => screen.queryByRole('dialog', { name: '돌발미션' })

beforeEach(() => {
  setAutoRelayRecordPort(createMemoryAutoRelayRecordPort())
  setAutoRelaySpeed(2)
  setActiveSound(createSilentSound())
})
afterEach(() => {
  cleanup()
  setAutoRelayRecordPort(null)
  setActiveSound(null)
  vi.useRealTimers()
  판정칸.판정 = null
  판정칸.때 = '끝'
})

describe('시즌 경기 — 경기를 끝낸 타석의 돌발 결과 창은 경기 끝 판 앞 (0x12 끝 4e7ca · 0x17 끝 52a8e, r317)', () => {
  it('판정이 남은 끝난 경기는 결과 창이 먼저 서고, 창을 닫은 뒤에야 경기 끝 판(0x18) → 정산', () => {
    판정칸.판정 = 시즌판정()
    vi.useFakeTimers()
    const onSettlementEnter = vi.fn()
    render(<TeamGameScreen options={옵션} random={createSeededRandom(1)} onFinish={vi.fn()} onQuit={vi.fn()} onSettlementEnter={onSettlementEnter} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    for (let 번 = 0; 번 < 4000 && 창() === null && screen.queryByAltText('승리투수') === null; 번 += 1) 흘리기(8)
    // 예전 화면은 요약이 서자마자 경기 끝 판 — 창이 안 섰다
    expect(창()).not.toBeNull()
    expect(screen.queryByAltText('승리투수')).toBeNull()
    for (let 번 = 0; 번 < 200 && 창() !== null; 번 += 1) {
      흘리기(5)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    expect(창()).toBeNull()
    for (let 번 = 0; 번 < 50 && screen.queryByAltText('승리투수') === null; 번 += 1) 흘리기(1)
    expect(screen.getByAltText('승리투수')).toBeTruthy()
    흘리기(10)
    fireEvent.keyDown(window, { key: 'Enter' })
    흘리기(1)
    expect(onSettlementEnter).toHaveBeenCalledTimes(1)
  })

  it('자동진행 중계(0x21)에 들어선 진행에 판정이 남았으면 결과 창이 먼저 — 중계는 창을 닫은 뒤 돌아 경기를 끝낸다', () => {
    판정칸.판정 = 시즌판정()
    판정칸.때 = '중계'
    vi.useFakeTimers()
    render(<TeamGameScreen options={옵션} random={createSeededRandom(1)} onFinish={vi.fn()} onQuit={vi.fn()} onSettlementEnter={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    for (let 번 = 0; 번 < 50 && 창() === null; 번 += 1) 흘리기(1)
    // 예전 화면은 중계 갈래가 경기 장면보다 앞이라 창 없이 중계가 경기 끝까지 돌았다
    expect(창()).not.toBeNull()
    for (let 번 = 0; 번 < 200 && 창() !== null; 번 += 1) {
      흘리기(5)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    expect(창()).toBeNull()
    for (let 번 = 0; 번 < 4000 && screen.queryByAltText('승리투수') === null; 번 += 1) 흘리기(8)
    expect(screen.getByAltText('승리투수')).toBeTruthy()
  })

  it('공수 교대 판(0x18)이 실린 진행에 판정이 남았으면 결과 창이 먼저 — 판은 창을 닫은 뒤 선다', () => {
    판정칸.판정 = 시즌판정()
    판정칸.때 = '교대'
    vi.useFakeTimers()
    render(
      <TeamGameScreen
        options={{ ...옵션, settings: FULL_PLAY_SETTINGS }}
        random={createSeededRandom(1)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
        onSettlementEnter={vi.fn()}
      />,
    )
    const 판 = () => screen.queryByTestId(/^교대-판-/)
    // 인트로(0xc) OK — 후공이라 1회초 판(0x18)이 설 자리
    fireEvent.keyDown(window, { key: 'Enter' })
    for (let 번 = 0; 번 < 50 && 창() === null && 판() === null; 번 += 1) 흘리기(1)
    expect(창()).not.toBeNull()
    expect(판()).toBeNull()
    for (let 번 = 0; 번 < 200 && 창() !== null; 번 += 1) {
      흘리기(5)
      fireEvent.keyDown(window, { key: 'Enter' })
    }
    expect(창()).toBeNull()
    흘리기(1)
    expect(판()).not.toBeNull()
  })
})

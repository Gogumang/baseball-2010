// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  closeBurstWindow,
  closeManagerHookWindow,
  confirmScene,
  isPitchTurn,
  startPitcherGame,
  throwPitch,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'

/**
 * **경기를 끝낸 내 공의 돌발 판정 — 결과 창 0x1d 가 경기 끝 판 0x18 앞 (투수편, r317 — 타자편 r315 의 짝)**.
 * 원본 0x12 끝(4e7ca)의 0x8f414 가 참이면 다음 상태가 0x18 · 0x19 여도 0x1d(결과 창 · 진입 0x3b04c 의 보상 0x8e34c)를 먼저 거친 뒤
 * +0x1b6c 로 간다. 웹 투수편 화면은 끝난 경기(`summary !== null`)의 경기 끝 판 갈래가 타석 장면(결과 창이 얹히는 자리)보다 앞이라
 * 판 없는 삼진으로 끝난 경기의 결과 창이 안 섰다(보상은 `burstRewardDeltas` 로 경기 끝에 얹혀 잃지 않았다).
 *
 * 결정적으로 — 진짜 진행기로 마무리(구원) 씨앗 12 를 끝까지 던져 경기를 끝낸 공에 난 판정을 얻고, 등판이 없는 날(자동진행으로 끝까지)
 * 의 끝난 진행에 그 판정을 싣는다(`usePitcherGame` 감싸기). 창을 닫으면(`closeBurst`) 판정을 내린다
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

/** 화면 차례 — 중계(0x21)가 설 때 결과 창이 이미 닫혔는가 */
const 차례 = vi.hoisted(() => [] as string[])
vi.mock('@/pages/auto-play-relay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/auto-play-relay')>()
  const { useEffect } = await import('react')
  return {
    ...actual,
    AutoPlayRelayReplay: ({ onDone }: { onDone: () => void }) => {
      useEffect(() => {
        차례.push(document.querySelector('[aria-label="돌발미션"]') === null ? '중계' : '창 위 중계')
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    },
  }
})

const 판정칸 = vi.hoisted(() => ({ 끝: null as unknown }))

vi.mock('@/pages/pitching/model/usePitcherGame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/pitching/model/usePitcherGame')>()
  const { useState } = await import('react')
  const injected = new WeakMap<object, object>()
  return {
    ...actual,
    usePitcherGame: (...args: Parameters<typeof actual.usePitcherGame>) => {
      const session = actual.usePitcherGame(...args)
      const [isClosed, setClosed] = useState(false)
      const 끝 = 판정칸.끝 as PitcherGameProgress | null
      if (!session.progress.game.isFinished || isClosed || 끝 === null) return session
      let progress = injected.get(session.progress) as typeof session.progress | undefined
      if (progress === undefined) {
        progress = { ...session.progress, burst: 끝.burst, lastBurstResolution: 끝.lastBurstResolution }
        injected.set(session.progress, progress)
      }
      return { ...session, progress, actions: { ...session.actions, closeBurst: () => setClosed(true) } }
    },
  }
})

const 옵션: PitcherGameOptions = {
  ourTeamId: 0,
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

/** 마무리 씨앗 12 — 한가운데 직구만 던지면 경기를 끝낸 공(판 없음)에 돌발이 판정된다 */
function 경기끝판정(): PitcherGameProgress {
  const random = createSeededRandom(12)
  let progress = startPitcherGame({ ...옵션, role: PITCHER_ROLE.relief, dayCounter: 2 }, random)
  for (let step = 0; step < 3000 && !progress.game.isFinished; step += 1) {
    if (progress.lastBurstResolution !== null) progress = closeBurstWindow(progress)
    else if (progress.managerHookText !== null) progress = closeManagerHookWindow(progress, random)
    else if (progress.sceneConfirmPending === true) progress = confirmScene(progress, random)
    else if (isPitchTurn(progress)) progress = throwPitch(progress, { typeNumber: 1, gaugeCell: 0 }, random)
    else break
  }
  return progress
}

const 틱 = (n: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * n))
const 창 = () => screen.queryByRole('dialog', { name: '돌발미션' })

afterEach(() => {
  cleanup()
  setActiveSound(null)
  vi.useRealTimers()
  판정칸.끝 = null
  차례.length = 0
})

describe('투수편 — 경기를 끝낸 공의 돌발 결과 창은 경기 끝 판 앞 (0x12 끝 4e7ca, r317)', () => {
  it('진행기: 마무리 씨앗 12 의 경기를 끝낸 공(판 없음)에 판정이 남는다', () => {
    const 끝 = 경기끝판정()
    expect(끝.game.isFinished).toBe(true)
    expect(끝.lastBurstResolution?.judgement ?? null).not.toBeNull()
    expect(끝.pendingDefensePlay).toBeNull()
  })

  it('판정이 남은 끝난 경기는 결과 창이 먼저 서고, 창을 닫은 뒤에야 중계(0x21) → 경기 끝 판(0x18)', () => {
    판정칸.끝 = 경기끝판정()
    vi.useFakeTimers()
    setActiveSound(createSilentSound())
    const onFinish = vi.fn()
    render(<PitcherGameScreen options={옵션} random={createSeededRandom(20100901)} onFinish={onFinish} gamePoint={100} />)
    fireEvent.keyDown(window, { key: '5' })
    for (let 번 = 0; 번 < 5000 && 창() === null && screen.queryByAltText('세이브') === null; 번 += 1) 틱(1)
    expect(창()).not.toBeNull()
    expect(screen.queryByAltText('세이브')).toBeNull()
    // 0x35108 이 0x21 로 덮은 +0x1b6c 도 창 뒤다 — 중계는 아직
    expect(차례).toEqual([])
    // 창이 다 열린 뒤 OK 로 닫는다(0x8e60c — 열리는 동안 키는 버려진다)
    for (let 번 = 0; 번 < 200 && 창() !== null; 번 += 1) {
      틱(5)
      fireEvent.keyDown(window, { key: '5' })
    }
    expect(창()).toBeNull()
    // 등판 없는 날이라 자동진행 중계(0x21)도 창 뒤다 — 다 튼 뒤 경기 끝 판
    for (let 번 = 0; 번 < 5000 && screen.queryByAltText('세이브') === null; 번 += 1) 틱(1)
    expect(screen.getByAltText('세이브')).toBeTruthy()
    expect(차례).toEqual(['중계'])
  })
})

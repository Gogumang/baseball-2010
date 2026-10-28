// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
import type { TeamGameOptions } from '@/pages/team-game/model/useTeamGame'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import type { PitcherGameOptions } from '@/pages/pitching/model/usePitcherGame'
import { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'
import { resetSetupRecord } from '@/pages/general-mode/model/setupRecord'
import { setActiveSound } from '@/shared/api/audio/soundPort'

/**
 * **개발 StrictMode 와 배포의 난수 차례가 같다** (r231).
 *
 * `main.tsx` 는 앱을 `StrictMode` 로 띄운다. 개발 React 는 마운트 그림을 두 번 그리고 효과를 붙였다 떼고 다시 붙이므로, 그 안에서
 * 경기 난수를 굴리면 개발만 한 차례 더 나간다 — 같은 씨앗의 일반모드 선공이 개발 서버와 빌드에서 뒤집혔다(씨앗 1 · 2).
 * 경기 장면을 세우는 고리를 감싼 렌더 · 안 감싼 렌더로 띄워 **같은 씨앗의 굴림이 하나하나 같은지** 본다.
 */

interface Draw {
  readonly kind: 'rand' | 'rand9d'
  readonly args: readonly number[]
  readonly value: number
}

/** 원본 생성기에 굴림 기록을 단다 */
function recordingRandom(seed: number): { readonly random: RandomPort; readonly draws: Draw[] } {
  const base = createSeededRandom(seed)
  const draws: Draw[] = []
  return {
    draws,
    random: {
      rand: (lo, hi) => {
        const value = base.rand(lo, hi)
        draws.push({ kind: 'rand', args: [lo, hi], value })
        return value
      },
      rand9d: (n) => {
        const value = base.rand9d(n)
        draws.push({ kind: 'rand9d', args: [n], value })
        return value
      },
    },
  }
}

/** 고리를 띄운 뒤 굴림 기록과 그 뒤 생성기의 다음 값 여덟 — 씨앗이 어디까지 갔는지 */
function mountDraws<T>(seed: number, isStrict: boolean, hook: (random: RandomPort) => T) {
  const { random, draws } = recordingRandom(seed)
  const view = renderHook(() => hook(random), isStrict ? { wrapper: StrictMode } : {})
  const mounted = [...draws]
  const next = Array.from({ length: 8 }, () => random.rand(0, 0x7fff))
  return { mounted, next, result: view.result.current, unmount: view.unmount }
}

function expectSameDraws<T>(hook: (random: RandomPort) => T, pick: (result: T) => unknown) {
  for (const seed of [1, 2, 20100901]) {
    const plain = mountDraws(seed, false, hook)
    plain.unmount()
    const strict = mountDraws(seed, true, hook)
    strict.unmount()
    expect(plain.mounted.length).toBeGreaterThan(0)
    expect(strict.mounted).toEqual(plain.mounted)
    expect(strict.next).toEqual(plain.next)
    expect(pick(strict.result)).toEqual(pick(plain.result))
  }
}

const silentSound = {
  play: () => {},
  playBgm: () => {},
  stopBgm: () => {},
  resumeBgm: () => {},
  stop: () => {},
  currentBgm: () => null,
  setVolume: () => {},
  getVolume: () => 100,
}
beforeEach(() => {
  setActiveSound(silentSound)
  resetSetupRecord()
})
afterEach(() => setActiveSound(null))

const teamOptions: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_FIRST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

const pitcherOptions: PitcherGameOptions = {
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  dayCounter: 2,
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

describe('StrictMode 로 감싸도 경기 장면 고리의 난수 차례가 같다 (r231)', () => {
  it('일반모드 빠른실행 — 상태 22 진입 굴림(빠른실행 · 0x30f20)', () => {
    const opened = { openedAcePitcherIds: [0, 1, 2, 3, 4], openedAceBatterIds: [0, 1, 2, 3, 4] }
    expectSameDraws(
      (random) => useGeneralMode({ random, isQuickStart: true, ...opened }),
      (session) => ({ setup: session.flow.setup, cpu: session.cpuMatchInfo, stadium: session.matchInfoStadium }),
    )
  })

  it('팀 경기 — 로딩 팁 · 덱 1275 · 장면 초기화', () => {
    expectSameDraws(
      (random) => useTeamGame(teamOptions, random),
      (session) => ({ tip: session.loadingTip, progress: JSON.stringify(session.progress) }),
    )
  })

  it('나리 투수편 경기 — 로딩 팁 · 경기 세우기', () => {
    expectSameDraws(
      (random) => usePitcherGame(pitcherOptions, random),
      (session) => ({ tip: session.loadingTip, progress: JSON.stringify(session.progress) }),
    )
  })
})

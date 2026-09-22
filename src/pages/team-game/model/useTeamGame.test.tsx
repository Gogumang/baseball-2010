// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
import type { TeamGameOptions } from '@/pages/team-game/model/useTeamGame'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { pitchSlotsFor } from '@/features/play-team-game/model/teamGameFlow'

/**
 * 팀 경기 고리가 **수비 화면이 도는 동안 경기를 붙들어 두는지**를 본다
 * (원본 경기 상태 0x17 — 공이 멈출 때까지 0xe·0xf 로 돌아가지 않는다).
 *
 * 화면(`TeamGameScreen`)은 이 고리의 `pendingDefensePlay` 만 보고 `DefensePlayback` 을 그리므로,
 * 붙들고·풀는 규칙은 여기서 확인하는 것이 화면을 다 세우는 것보다 정확하다.
 */

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

const 띄우기 = (options: Partial<TeamGameOptions> = {}, seed = 20100901) => {
  const random = createSeededRandom(seed)
  return renderHook(() => useTeamGame({ ...기본옵션, ...options }, random))
}

describe('팀 경기 고리 — 수비 화면이 도는 동안 경기를 붙든다 (상태 0x17)', () => {
  it('인플레이 타구가 나면 붙들고, 칠 차례도 던질 차례도 아니게 된다', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(result.current.canBat).toBe(true)

    act(() => result.current.actions.applyOutcome({ kind: '아웃', detail: '땅볼아웃' }))

    expect(result.current.pendingDefensePlay).not.toBeNull()
    // 우리 공격이니 사람은 주루(0x5331c)를 잡는다 — I 0절 상태 0x17 표
    expect(result.current.pendingDefensePlay!.side).toBe('공격')
    expect(result.current.canBat).toBe(false)
    expect(result.current.canPitch).toBe(false)
  })

  it('수비 화면이 결과를 넘기면 그때 타순이 돌고 붙든 칸이 비워진다', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    act(() => result.current.actions.applyOutcome({ kind: '안타', bases: 1 }))
    const 결과 = runDefensePlay(result.current.pendingDefensePlay!.input)

    act(() => result.current.actions.finishDefensePlay(결과))

    expect(result.current.pendingDefensePlay).toBeNull()
    expect(result.current.progress.game.battingOrderIndex).toBe(1)
    expect(result.current.progress.ourHits).toBe(1)
    expect(result.current.canBat).toBe(true)
  })

  it('화면이 결과를 안 넘겨도 붙든 상태를 푼다 — 안 그러면 경기가 영영 멈춘다', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    act(() => result.current.actions.applyOutcome({ kind: '아웃', detail: '땅볼아웃' }))
    expect(result.current.pendingDefensePlay).not.toBeNull()

    act(() => result.current.actions.finishDefensePlay())

    expect(result.current.pendingDefensePlay).toBeNull()
    // 남은 틱을 끝까지 돌려서라도 타석 하나를 마쳤다 — 다음 타자가 선다
    expect(result.current.progress.game.battingOrderIndex).toBe(1)
    expect(result.current.canBat || result.current.canPitch).toBe(true)
  })

  it('붙들려 있지 않으면 `finishDefensePlay` 는 아무 일도 하지 않는다', () => {
    const { result } = 띄우기({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 전 = result.current.progress

    act(() => result.current.actions.finishDefensePlay())

    expect(result.current.progress).toBe(전)
  })

  it('사람이 던진 타석의 인플레이 타구는 **수비**(송구 0x533c8)를 잡는다', () => {
    const { result } = 띄우기()
    expect(result.current.canPitch).toBe(true)

    // 인플레이 타구가 날 때까지 같은 코스로 던진다
    for (let pitch = 0; pitch < 300 && result.current.pendingDefensePlay === null; pitch += 1) {
      if (!result.current.canPitch) break
      const slots = pitchSlotsFor(result.current.progress)
      const typeNumber = slots.find((slot) => slot.typeNumber !== 0)?.typeNumber ?? 1
      act(() => result.current.actions.throwPitch({ typeNumber, courseCell: 4, gaugeCell: 0 }))
    }

    expect(result.current.pendingDefensePlay).not.toBeNull()
    expect(result.current.pendingDefensePlay!.side).toBe('수비')
    expect(result.current.canPitch).toBe(false)
  })
})

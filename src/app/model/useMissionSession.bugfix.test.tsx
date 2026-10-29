// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMissionSession } from '@/app/model/useMissionSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { modePitcherOf } from '@/app/model/modePitcher'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { aimStartOf } from '@/features/play-pitcher-game/model/pitchAim'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import { MISSIONS } from '@/shared/config/original/missions'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** g[0x176] 만 서 있고 g[0xf6] = 0 인 대기에서 투수 미션 1 을 끝까지 던지고 판을 닫는다 */
function 대기중미션닫기() {
  const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
  const onReturnToNari = vi.fn()
  const setScreen = vi.fn()
  const pitcher = modePitcherOf({
    ...createPitcherCareer('투수'),
    ability: { control: 900, velocity: 900, breaking: 900, stamina: 900 },
  })
  const screen: Screen = { kind: '미션선택' }
  const rendered = renderHook(() => {
    const runner = useAtBatRunner()
    return useMissionSession({
      runner,
      random: createSeededRandom(1),
      missionRecord,
      screen,
      setScreen,
      pitcher,
      nariTeamIds: { batter: 5, pitcher: 6 },
      aceMatchHold: { read: () => ({ batter: false, pitcher: true, originalMode: 0 }), writeResult: vi.fn() },
      onReturnToNari,
    })
  })
  const mission = MISSIONS.find((candidate) => candidate.side === '투수' && candidate.id === 1)
  if (mission === undefined) throw new Error('투수 미션 1 이 없다')
  act(() => rendered.result.current.actions.begin(mission))
  act(() => rendered.result.current.actions.confirmHalfInningBoard())
  for (let pitch = 0; pitch < 60 && rendered.result.current.pitcherRun?.status === '진행중'; pitch += 1) {
    const session = rendered.result.current
    if (session.pendingDefensePlay !== null) {
      act(() => session.actions.finishDefensePlay())
      continue
    }
    if (session.pendingBenchClearing !== null) {
      act(() => session.actions.finishBenchClearing(false))
      continue
    }
    act(() => session.handleThrow(PITCH_TYPES[0], aimStartOf(1), 9, true))
  }
  setScreen.mockClear()
  act(() => rendered.result.current.actions.finishPitcher())
  const after = rendered.result.current
  rendered.unmount()
  return { after, setScreen, onReturnToNari }
}

describe('B-75 g[0xf6] 이 3 · 4 가 아닌 대기에서 미션 결과 판에 갇힌다', () => {
  it('원본: 판을 닫는 키가 아무 일도 안 한다', () => {
    const played = 대기중미션닫기()
    expect(played.setScreen).not.toHaveBeenCalled()
    expect(played.after.pitcherRun).not.toBeNull()
  })

  it('고침: 미션 목록으로 나간다 — 나리 장면으로는 안 간다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-75']))
    const played = 대기중미션닫기()
    expect(played.setScreen).toHaveBeenCalledWith({ kind: '미션선택' })
    expect(played.onReturnToNari).not.toHaveBeenCalled()
  })
})

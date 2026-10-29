// @vitest-environment happy-dom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMissionSession } from '@/app/model/useMissionSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { MISSIONS } from '@/shared/config/original/missions'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { MissionClearCounts } from '@/shared/api/save/missionRecordPort'

/**
 * 미션 세션 상태를 atom 으로 옮긴 뒤(r374)에도 한 사건 안의 여러 쓰기는 **한 그림**에 함께 보인다 — 옛 `setState` 묶음과 같다.
 * 중간 그림(판만 서고 로딩 판 · 화면은 아직인 그림 따위)이 끼지 않는지, 클리어 기록 저장 차례가 그대로인지 본다.
 */

function 띄우기() {
  const log: string[] = []
  const missionRecord = {
    load: () => ({}),
    save: (counts: MissionClearCounts) => log.push(`저장 ${JSON.stringify(counts)}`),
  }
  const random = createSeededRandom(20100901)
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '미션선택' })
    const runner = useAtBatRunner()
    const session = useMissionSession({ runner, random, missionRecord, screen, setScreen })
    log.push(
      `그림 ${screen.kind} ${session.missionRun?.status ?? '판없음'} ${session.loadingTip === null ? '' : '로딩'} ${session.halfInningBoard === null ? '' : '판'} ${session.pendingDefensePlay === null ? '' : '수비'} ${runner.isPaused ? '멈춤' : ''}`,
    )
    return { screen, session, runner }
  })
  return { ...rendered, log }
}

const 그림들 = (log: readonly string[]) => log.filter((line) => line.startsWith('그림'))
const 타자미션 = MISSIONS.find((mission) => mission.side === '타자')!

describe('미션 세션 atom 쓰기 묶음', () => {
  it('미션 고르기 — 판 · 로딩 판 · 첫 0x18 판 · 화면이 한 그림에 선다', () => {
    const { result, log } = 띄우기()
    log.length = 0

    act(() => result.current.session.actions.begin(타자미션))

    expect(그림들(log)).toEqual(['그림 미션진행 진행중 로딩 판  '])
  })

  it('맞은 공 — 수비 판과 타석 멈춤이 한 그림에, 판 끝의 진루와 결과 띠도 한 그림에', () => {
    const { result, log } = 띄우기()
    act(() => result.current.session.actions.begin(타자미션))
    act(() => result.current.session.actions.finishLoading())
    act(() => result.current.session.actions.confirmHalfInningBoard())
    log.length = 0

    act(() => {
      result.current.session.handleMissionPitch({
        batterHand: 0,
        resolution: { kind: '타구', outcome: { kind: '안타', bases: 1 } },
        hasSwung: true,
        isBunt: false,
        resultCode: null,
      })
    })
    expect(그림들(log)).toEqual(['그림 미션진행 진행중   수비 멈춤'])
    log.length = 0

    act(() => result.current.session.actions.finishDefensePlay())
    expect(그림들(log)).toHaveLength(1)
    expect(result.current.session.pendingDefensePlay).toBeNull()
    expect(result.current.runner.bannerText).not.toBe('')
  })

  it('포기 — 판이 끝난 그림 뒤에 정산이 한 번 돈다(실패라 클리어 기록은 안 쓴다)', () => {
    const { result, log } = 띄우기()
    act(() => result.current.session.actions.begin(타자미션))
    log.length = 0

    act(() => result.current.session.actions.giveUpBatter())

    expect(그림들(log)[0]).toBe('그림 미션진행 실패 로딩 판  ')
    expect(log.filter((line) => line.startsWith('저장'))).toHaveLength(0)
    expect(result.current.session.resultEarnedGamePointOf(타자미션, '실패', false)).toBe(0)
  })
})

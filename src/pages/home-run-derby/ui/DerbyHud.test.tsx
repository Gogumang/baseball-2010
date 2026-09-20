// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DerbyHud } from '@/pages/home-run-derby/ui/DerbyHud'
import { applyDerbyPitch, createDerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'

afterEach(cleanup)

const 헛스윙 = { isHomeRun: false, distance: 0, isEventZoneHit: false }

const 띄우기 = (run: DerbyRun, bestDistance = 0, extra: { aceName?: string | null; isEventZoneShown?: boolean } = {}) =>
  render(
    <DerbyHud
      run={run}
      bestDistance={bestDistance}
      aceName={extra.aceName ?? null}
      isEventZoneShown={extra.isEventZoneShown ?? false}
      tick={0}
    />,
  )

/** 공 아이콘 칸의 상태 목록 — 왼쪽부터 10칸 */
const 아이콘상태 = (container: HTMLElement) =>
  [...container.querySelectorAll('img[data-state]')].map((node) => node.getAttribute('data-state'))

describe('홈런더비 HUD (0x45a54)', () => {
  it('공 아이콘은 늘 10칸이고, 첫 공에서는 1번 칸이 "이번 공" 이다', () => {
    const { container } = 띄우기(createDerbyRun())
    const states = 아이콘상태(container)
    expect(states).toHaveLength(10)
    expect(states[0]).toBe('now')
    expect(states[1]).toBe('left')
  })

  it('공을 쓸수록 "이번 공" 칸이 오른쪽으로 간다 — 공 번호 = 10 − 남은 기회 + 1', () => {
    let run = createDerbyRun()
    for (let index = 0; index < 4; index += 1) run = applyDerbyPitch(run, 헛스윙)
    const { container } = 띄우기(run)
    const states = 아이콘상태(container)
    // 다섯 번째 공 차례다
    expect(states.slice(0, 4)).toEqual(['used', 'used', 'used', 'used'])
    expect(states[4]).toBe('now')
  })

  it('보너스 게임에서는 최대 콤보 수만큼만 칸이 산다', () => {
    const 홈런 = { isHomeRun: true, distance: 90, isEventZoneHit: false }
    let run = createDerbyRun()
    run = applyDerbyPitch(run, 홈런)
    run = applyDerbyPitch(run, 홈런)
    run = applyDerbyPitch(run, 홈런)
    for (let index = 0; index < 7; index += 1) run = applyDerbyPitch(run, 헛스윙)

    expect(run.isBonusGame).toBe(true)
    const { container } = 띄우기(run)
    const states = 아이콘상태(container)
    expect(states[0]).toBe('now')
    expect(states.slice(2)).toEqual(Array.from({ length: 8 }, () => 'off'))
  })

  it('누적 비거리가 최고 기록을 넘으면 강조한다', () => {
    const run = { ...createDerbyRun(), totalDistance: 500 }
    expect(띄우기(run, 400).queryByTestId('최고기록강조')).not.toBeNull()
    cleanup()
    expect(띄우기(run, 500).queryByTestId('최고기록강조')).toBeNull()
  })

  it('마투수가 등판하면 이름을 보여 준다', () => {
    띄우기(createDerbyRun(), 0, { aceName: '레오니' })
    expect(screen.getByText('마투수 레오니')).toBeTruthy()
  })

  it('이벤트 존을 얻으면 존 그림을 띄운다', () => {
    띄우기(createDerbyRun(), 0, { isEventZoneShown: true })
    expect(screen.getByAltText('이벤트 존')).toBeTruthy()
  })
})

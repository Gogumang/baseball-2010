// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DerbyHud } from '@/pages/home-run-derby/ui/DerbyHud'
import { applyDerbyPitch, createDerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'

afterEach(cleanup)

const 헛스윙 = { isHomeRun: false, distance: 0, isEventZoneHit: false }

const 띄우기 = (run: DerbyRun, bestDistance = 0, extra: { isEventZoneShown?: boolean } = {}) =>
  render(
    <DerbyHud run={run} bestDistance={bestDistance} isEventZoneShown={extra.isEventZoneShown ?? false} tick={0} />,
  )

const 그림들 = (testId: string) => screen.queryAllByTestId(testId).map((node) => node.getAttribute('src'))

describe('홈런더비 HUD (0x45a54)', () => {
  it('오른쪽 위에 trainning 프레임 2 판을 (W − 83 − 6, 6) 에 놓는다', () => {
    띄우기(createDerbyRun())
    const panel = screen.getByAltText('홈런더비 판') as HTMLImageElement
    expect(panel.getAttribute('src')).toBe('./sprites/trainning/frames/002.png')
    expect([panel.style.left, panel.style.top]).toEqual(['151px', '6px'])
  })

  it('판 머리에 "공 번호 / 공 수" 를 흰 글자로 쓴다 — 첫 공은 1/10 (0x3608c)', () => {
    띄우기(createDerbyRun())
    expect(그림들('공번호')).toEqual([
      './sprites/num/001.png', './sprites/num/101.png', './sprites/num/001.png', './sprites/num/000.png',
    ])
  })

  it('공을 쓸수록 공 번호가 오른다 — 공 번호 = 10 − 남은 기회 + 1', () => {
    let run = createDerbyRun()
    for (let index = 0; index < 4; index += 1) run = applyDerbyPitch(run, 헛스윙)
    띄우기(run)
    expect(그림들('공번호')[0]).toBe('./sprites/num/005.png')
  })

  it('보너스 게임에서는 공 수가 최대 콤보다', () => {
    const 홈런 = { isHomeRun: true, distance: 90, isEventZoneHit: false }
    let run = createDerbyRun()
    run = applyDerbyPitch(run, 홈런)
    run = applyDerbyPitch(run, 홈런)
    run = applyDerbyPitch(run, 홈런)
    for (let index = 0; index < 7; index += 1) run = applyDerbyPitch(run, 헛스윙)

    expect(run.isBonusGame).toBe(true)
    띄우기(run)
    expect(그림들('공번호')).toEqual(['./sprites/num/001.png', './sprites/num/101.png', './sprites/num/002.png'])
  })

  it('최고 칸은 저장된 최고 기록이고, 누적이 넘으면 노랑(80~)·아니면 흰색(0~) 이다 — 현재 칸은 늘 노랑', () => {
    const run = { ...createDerbyRun(), totalDistance: 500 }
    띄우기(run, 400)
    expect(그림들('최고기록')).toEqual(['./sprites/num/084.png', './sprites/num/080.png', './sprites/num/080.png'])
    expect(그림들('현재비거리')).toEqual(['./sprites/num/085.png', './sprites/num/080.png', './sprites/num/080.png'])
    cleanup()
    띄우기(run, 500)
    expect(그림들('최고기록')).toEqual(['./sprites/num/005.png', './sprites/num/000.png', './sprites/num/000.png'])
  })

  it('마투수 이름은 HUD 가 안 그린다 (0x45a54 에 없다)', () => {
    띄우기(createDerbyRun())
    expect(screen.queryByText(/마투수/)).toBeNull()
  })

  it('이벤트 존을 얻으면 존 그림을 띄운다', () => {
    띄우기(createDerbyRun(), 0, { isEventZoneShown: true })
    expect(screen.getByAltText('이벤트 존')).toBeTruthy()
  })

  it('콤보 표시는 trainning.pzx "Combo" 가 미끄러져 온 뒤 셋째 갱신부터 숫자를 붙인다 (0x4585c — combo.pzx 는 안 그린다)', () => {
    const run = createDerbyRun()
    const hud = (tick: number) => (
      <DerbyHud run={run} bestDistance={0} isEventZoneShown={false} tick={tick} shownCombo={2} batterSide={1} />
    )
    const { rerender } = render(hud(10))
    expect(screen.getByAltText('Combo').getAttribute('src')).toBe('./sprites/trainning/frames/003.png')
    expect(screen.queryAllByTestId('콤보숫자')).toHaveLength(0)
    rerender(hud(13))
    expect(screen.getByAltText('Combo').getAttribute('src')).toBe('./sprites/trainning/frames/006.png')
    expect(screen.getAllByTestId('콤보숫자').map((node) => node.getAttribute('src'))).toEqual(['./sprites/num/072.png'])
  })
})

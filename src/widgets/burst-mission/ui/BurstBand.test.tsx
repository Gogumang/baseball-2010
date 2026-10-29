// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BurstBand } from '@/widgets/burst-mission/ui/BurstBand'
import { burstBandOf, burstBandRoleOf } from '@/widgets/burst-mission/lib/burstBandLayout'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'

afterEach(cleanup)

const 행 = (goal: number, kind: number, amount: number): BurstMissionRow => ({
  index: 0,
  situation: 0,
  bases: [-1, -1, -1],
  outs: -1,
  scoreDifference: 0,
  recordKind: 0,
  recordCount: 0,
  goal,
  chancePercent: 10,
  successRewards: [
    { kind, amount },
    { kind: 2, amount: 9 },
  ],
  failurePenalty: { kind: 0, amount: 0 },
})

describe('타석 HUD 돌발 띠 0x8e858', () => {
  it('돌발이 없으면([M+0xc] == −1) 아무것도 안 그린다 (8e866)', () => {
    render(<BurstBand row={null} role="공격" />)
    expect(screen.queryByTestId('돌발-띠')).toBeNull()
  })

  it('trainning 합성 프레임 14 를 (W − 83 − 5, 5) = (152, 5) 에, 사람 공격이면 방망이 이미지 8 을 (159, 7) 에 (8e8c0 · 8e8e6)', () => {
    render(<BurstBand row={행(2, 1, 3)} role="공격" />)
    const panel = screen.getByTestId('돌발-띠-판')
    expect(panel.getAttribute('src')).toBe('./sprites/trainning/frames/014.png')
    expect([panel.style.left, panel.style.top]).toEqual(['152px', '5px'])
    const icon = screen.getByTestId('돌발-띠-아이콘')
    expect(icon.getAttribute('src')).toBe('./sprites/trainning/008.png')
    expect([icon.style.left, icon.style.top]).toEqual(['159px', '7px'])
  })

  it('사람 수비면 공 이미지 7 을 (159, 6) 에 — 어느 쪽도 아니면 아이콘이 없다 (8e914)', () => {
    render(<BurstBand row={행(7, 1, 3)} role="수비" />)
    const icon = screen.getByTestId('돌발-띠-아이콘')
    expect(icon.getAttribute('src')).toBe('./sprites/trainning/007.png')
    expect([icon.style.left, icon.style.top]).toEqual(['159px', '6px'])
    cleanup()
    render(<BurstBand row={행(7, 1, 3)} role={null} />)
    expect(screen.queryByTestId('돌발-띠-아이콘')).toBeNull()
  })

  it('목표 이름 [0x14002dc][b8] 을 (155, 24, 77) · 첫 보상 [0x14002c8][b10] " +" b11 을 (155, 40, 83) 가운데로 (8e962 · 8e9ce)', () => {
    render(<BurstBand row={행(2, 1, 3)} role="공격" />)
    const goal = screen.getByTestId('돌발-띠-목표')
    expect(goal.textContent).toBe('홈런')
    expect([goal.style.left, goal.style.top, goal.style.width]).toEqual(['155px', '24px', '77px'])
    const reward = screen.getByTestId('돌발-띠-보상')
    expect(reward.textContent).toBe('사기 +3')
    expect([reward.style.left, reward.style.top, reward.style.width]).toEqual(['155px', '40px', '83px'])
  })

  it('소지금(4) 은 ×100, 값은 부호 있는 바이트 · 종류 0 도 거르지 않는다 — 둘째 보상은 안 쓴다', () => {
    expect(burstBandOf(행(0, 4, 4), '공격')?.rewardText).toBe('!C!cffffff소지금 +400')
    expect(burstBandOf(행(5, 0, 0), '공격')).toMatchObject({ goalText: '!C!cffffff주자진루', rewardText: '!C!cffffff없음 +0' })
    expect(burstBandOf(행(9, 3, 0xfe), '공격')?.rewardText).toBe('!C!cffffff평판 +-2')
  })

  it('음수 보상은 0xbc73d → 0xbc6c0 이 \'-\' 를 먼저 붙여 " +" 뒤에 "+-n" 이 된다 · 소지금 음수도 ×100 (bc6c6~bc6d2)', () => {
    expect(burstBandOf(행(0, 1, 0x80), '공격')?.rewardText).toBe('!C!cffffff사기 +-128')
    expect(burstBandOf(행(0, 4, 0xff), '공격')?.rewardText).toBe('!C!cffffff소지금 +-100')
  })

  it('아이콘 갈래는 진행 상태에서 — 공격 측(초 0 · 말 1)이 사람 측이면 방망이, 수비 측이면 공, 사람 측이 없으면 없음 (0x8e8c4)', () => {
    expect(burstBandRoleOf('초', 0)).toBe('공격')
    expect(burstBandRoleOf('말', 0)).toBe('수비')
    expect(burstBandRoleOf('말', 1)).toBe('공격')
    expect(burstBandRoleOf('초', 1)).toBe('수비')
    expect(burstBandRoleOf('초', null)).toBeNull()
  })

  it('0xf 구질 목록이면 빛 지도 4c5a6 이 띠까지 15/32 로 어둡게 한다', () => {
    render(<BurstBand row={행(7, 1, 3)} role="수비" isDimmed />)
    expect(screen.getByTestId('돌발-띠').style.filter).toBe(`brightness(${15 / 32})`)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { page } from 'vitest/browser'
import '@/app/styles/global.css'
import { ViewportShell } from '@/app/ui/ViewportShell'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { TitleWindow } from '@/widgets/title-window/ui/TitleWindow'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { TITLE_NAMES } from '@/entities/career/model/titles'

/**
 * **브라우저 시험 — 국가대항전 우승 상자가 게임 화면 가운데에 서는가** (아이폰 Safari 보고 · r228).
 *
 * 앱 껍데기(전역 CSS · `#root` · `ViewportShell` 이 적는 `--zoom` · `--game-height`) 안에 나리 국가대항전 화면을 우승 상태로 세우고
 * 대진판 확인 → 결과 상자(StrMODE[146]) → 보상 상자(StrMODE[199])를 띄워, 상자 판의 가운데가 화면 판(240×320) 가운데와 같은지 본다.
 * 칭호 창(`TitleWindow` — 134 진입 "국가 대표")도 같은 판 스타일을 쓴다. chromium(데스크톱) · webkit 아이폰 세로 · 가로.
 *
 * 두 요소 모두 같은 zoom 판 안이라 getBoundingClientRect 를 서로 빼고 화면 판 폭/240 으로 나눠 원본 픽셀로 옮긴다
 * (chromium 은 확대 뒤, webkit 은 확대 전 값을 준다).
 *
 * ⚠️ Playwright webkit(macOS)에서는 예전 꼴(`top: 50%` + `translateY(-50%)`)도 가운데에 섰다 — 아이폰 Safari 의 어긋남은 여기서
 * 재현되지 않았다. 이 시험은 바꾼 꼴(위아래 0 + 여백 auto)이 엔진 셋 모두에서 가운데를 지키는지 잡는다.
 */

const hosts: HTMLElement[] = []
function host(id: string): HTMLElement {
  const element = document.createElement('div')
  element.id = id
  document.body.append(element)
  hosts.push(element)
  return element
}
afterEach(() => {
  cleanup()
  for (const element of hosts.splice(0)) element.remove()
  delete document.body.dataset.layout
})

const 우승: NationalCup = { ...createNationalCup(), stage: 0, finalists: [10, 12], champion: 10 }

/** 원본 픽셀 단위로 화면 판 가운데에서 상자 판 가운데까지 */
async function offsetFromCenter(stage: HTMLElement, box: HTMLElement) {
  // 여는 연출(높이 10 → 두 배씩)이 끝나 안이 보이고 크기가 멈출 때까지 — 펼치는 동안은 글 · 단추가 숨는다
  await waitFor(() => expect(box.querySelector('[style*="visibility: hidden"]')).toBeNull(), { timeout: 3000 })
  let last = ''
  await waitFor(
    () => {
      const now = JSON.stringify(box.getBoundingClientRect())
      const isStill = now === last && box.getBoundingClientRect().height > 30
      last = now
      expect(isStill).toBe(true)
    },
    { timeout: 3000, interval: 120 },
  )
  const s = stage.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  const scale = s.width / 240
  return {
    dx: (b.left + b.width / 2 - (s.left + s.width / 2)) / scale,
    dy: (b.top + b.height / 2 - (s.top + s.height / 2)) / scale,
    height: b.height / scale,
  }
}

/** 원본 좌표 반 칸까지 — 높이가 홀수면 여백이 반 픽셀씩 나뉜다 */
const 가운데 = (offset: { dx: number; dy: number }) => {
  expect(Math.abs(offset.dx)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(offset.dy)).toBeLessThanOrEqual(0.5)
}

function 세우기(children: React.ReactNode) {
  const root = host('root')
  host('keypad-root')
  render(<>{children}</>, { container: root })
  render(<ViewportShell />, { container: host('shell') })
  const stage = root.querySelector<HTMLElement>('[data-original-screen]')
  if (stage === null) throw new Error('화면 판이 없다')
  return stage
}

describe.each([
  ['기본 창', null],
  ['가로 창 844×390', [844, 390]],
] as const)('국가대항전 우승 상자 — 화면 가운데 (%s)', (_name, size) => {
  it('결과 상자 · 보상 상자 판의 가운데가 화면 판 가운데다', async () => {
    if (size !== null) await page.viewport(size[0], size[1])
    const stage = 세우기(
      <NationalCupScreen
        mode="나만의리그"
        cup={우승}
        yearIndex={2}
        random={{ rand: () => 0, rand9d: () => 0 }}
        onStartGame={vi.fn()}
        onFinish={vi.fn()}
      />,
    )
    // 대진판(단계 0) 확인 → 결과 상자
    fireEvent.click(screen.getAllByRole('button', { name: '확인' })[0] as HTMLElement)
    const result = await screen.findByRole('dialog', { name: '알림' })
    expect(result.textContent).toContain('국가대항전 우승')
    const resultOffset = await offsetFromCenter(stage, result.firstElementChild as HTMLElement)
    가운데(resultOffset)

    // 결과 상자 OK → 보상 상자 (다섯 줄 — 더 높다)
    fireEvent.click(await within(result).findByRole('button', { name: '확인' }, { timeout: 3000 }))
    await waitFor(() => expect(document.body.textContent).toContain('G포인트'), { timeout: 3000 })
    const reward = screen.getByRole('dialog', { name: '알림' })
    const rewardOffset = await offsetFromCenter(stage, reward.firstElementChild as HTMLElement)
    expect(rewardOffset.height).toBeGreaterThan(resultOffset.height)
    가운데(rewardOffset)
  })

  it('칭호 창(134 진입 "국가 대표") 판도 화면 판 가운데다', async () => {
    if (size !== null) await page.viewport(size[0], size[1])
    const stage = 세우기(
      <RawScreen>
        <TitleWindow title={TITLE_NAMES[8] ?? ''} onKey={vi.fn()} onClose={vi.fn()} />
      </RawScreen>,
    )
    const dialog = await screen.findByRole('dialog', { name: '칭호' })
    가운데(await offsetFromCenter(stage, dialog.firstElementChild as HTMLElement))
  })
})

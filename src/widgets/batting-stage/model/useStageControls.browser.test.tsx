import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { commands } from 'vitest/browser'
import '@/app/styles/global.css'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { screenRectOf } from '@/shared/lib/viewportFit/zoomedRect'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import type { StageActions } from '@/widgets/batting-stage/model/useStageControls'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/**
 * **브라우저 시험 — 배율(CSS zoom) 판에서 타석 캔버스 탭 자리 → 동작** (r242 아이폰 Safari 버그의 회귀 시험, r255).
 *
 * 웹킷은 zoom 판 안 캔버스의 `getBoundingClientRect` 를 zoom 뺀 값(폭 240)으로 내고 `clientX` 는 화면 좌표라, 사각형을 그대로 쓰면
 * 가운데 탭이 오른쪽 이동 칸(원본 x > 180)으로 읽혀 스윙이 안 나갔다. 진짜 손가락 탭(`touchTap`)으로 원본 x 30 · 120 · 210 을 눌러
 * 왼쪽 이동 · 스윙 · 오른쪽 이동이 나오는지 본다.
 */

const ZOOM = 1.625
const hosts: HTMLElement[] = []

afterEach(() => {
  cleanup()
  for (const element of hosts.splice(0)) element.remove()
  document.documentElement.style.removeProperty('--zoom')
  document.documentElement.style.removeProperty('--game-height')
})

/** 키 칸 — 받은 동작을 곧바로 돈다(이 시험은 탭 자리만 본다) */
const refs = {
  pointerDownAtRef: { current: 0 },
  latestRef: { current: { canBunt: false } },
  keyLatch: { push: (apply: (tick: number) => void) => apply(0), tickAt: () => 0 },
} as unknown as StageRefs

function Stage({ actions }: { readonly actions: StageActions }) {
  const { onPointerDown } = useStageControls(refs, actions)
  return <canvas data-testid="타석" width={240} height={320} style={{ position: 'absolute', inset: 0 }} onPointerDown={onPointerDown} />
}

function 세우기() {
  document.documentElement.style.setProperty('--zoom', String(ZOOM))
  document.documentElement.style.setProperty('--game-height', `${Math.round(320 * ZOOM)}px`)
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)
  hosts.push(root)
  const done: string[] = []
  const actions: StageActions = {
    swing: () => done.push('스윙'),
    pressBunt: () => done.push('번트'),
    releaseBunt: () => done.push('번트 뗌'),
    moveBatter: (direction) => done.push(direction < 0 ? '왼쪽 이동' : '오른쪽 이동'),
  }
  render(
    <RawScreen>
      <Stage actions={actions} />
    </RawScreen>,
    { container: root },
  )
  const canvas = root.querySelector('canvas') as HTMLCanvasElement
  return { done, box: screenRectOf(canvas) }
}

async function 탭(box: { left: number; top: number; width: number; height: number }, originalX: number): Promise<void> {
  await commands.touchTap(box.left + (originalX / 240) * box.width, box.top + (176 / 320) * box.height)
  await new Promise((resolve) => setTimeout(resolve, 50))
}

describe('타석 캔버스 탭 — 배율 판', () => {
  it('캔버스는 원본 240 × 배율 폭이다 (화면 좌표)', () => {
    const { box } = 세우기()
    expect(box.width).toBeCloseTo(240 * ZOOM, 0)
  })

  it('가운데(원본 x 120)는 스윙', async () => {
    const { done, box } = 세우기()
    await 탭(box, 120)
    expect(done).toEqual(['스윙'])
  })

  it('왼쪽 끝(원본 x 30)은 왼쪽 이동 · 오른쪽 끝(원본 x 210)은 오른쪽 이동', async () => {
    const { done, box } = 세우기()
    await 탭(box, 30)
    await 탭(box, 210)
    expect(done).toEqual(['왼쪽 이동', '오른쪽 이동'])
  })

  it('스윙 칸 경계 안쪽(원본 x 65 · 175)은 스윙이다', async () => {
    const { done, box } = 세우기()
    await 탭(box, 65)
    await 탭(box, 175)
    expect(done).toEqual(['스윙', '스윙'])
  })
})

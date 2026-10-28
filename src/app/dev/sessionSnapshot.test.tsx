// @vitest-environment jsdom
import { StrictMode, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureSnapshot, restoreSnapshot } from '@/app/dev/sessionSnapshot'
import type { SessionSnapshotFile } from '@/app/dev/sessionSnapshot'
import { registerSnapshotSlot } from '@/shared/lib/dev/snapshotSlots'

/**
 * 경기 중간 스냅샷(r329) — 뜬 나무를 새로 그린 나무에 되살린다. 부모 상태가 서야 서는 자식, 상태와 ref 가 같은 객체를 쥔 것,
 * Map · 함수 칸(새로 그린 쪽 함수로 채움) · memo 의 고쳐 쓰는 객체 · 모듈 칸을 본다.
 */
interface Progress {
  readonly count: number
  readonly tags: ReadonlyMap<string, number>
  readonly onDone: () => string
}

let outer: {
  step: number
  setStep: Dispatch<SetStateAction<number>>
  progress: Progress
  setProgress: Dispatch<SetStateAction<Progress>>
  memo: { calls: number[] }
} | null = null
let inner: { held: MutableRefObject<Progress | null>; label: string; setLabel: Dispatch<SetStateAction<string>> } | null = null

function Outer() {
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState<Progress>(() => ({ count: 0, tags: new Map(), onDone: () => '새로 그린 함수' }))
  const memo = useMemo(() => ({ calls: [0] }), [])
  outer = { step, setStep, progress, setProgress, memo }
  return step > 0 ? <Inner /> : null
}

function Inner() {
  const held = useRef<Progress | null>(null)
  const [label, setLabel] = useState('처음')
  inner = { held, label, setLabel }
  return <div>{label}</div>
}

/** 모듈 칸 하나 — 되살리면 이 값이 선다 */
let moduleValue = { turns: 0 }
registerSnapshotSlot('시험모듈', {
  capture: () => moduleValue,
  restore: (value) => {
    moduleValue = value as { turns: number }
  },
})

let root: Root | null = null

function mount(): void {
  const container = document.getElementById('root')!
  root = createRoot(container)
  act(() =>
    root!.render(
      <StrictMode>
        <Outer />
      </StrictMode>,
    ),
  )
}

describe('경기 중간 스냅샷 — 뜨기 · 되살리기 (r329)', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    document.body.innerHTML = '<div id="root"></div>'
    outer = null
    inner = null
    moduleValue = { turns: 0 }
  })
  afterEach(() => {
    act(() => root?.unmount())
    root = null
  })

  async function captureAfterPlay(): Promise<SessionSnapshotFile> {
    mount()
    act(() => outer!.setStep(2))
    const progress: Progress = { count: 5, tags: new Map([['안타', 1]]), onDone: () => '뜬 쪽 함수' }
    act(() => outer!.setProgress(progress))
    act(() => inner!.setLabel('바뀜'))
    inner!.held.current = outer!.progress
    outer!.memo.calls[0] = 3
    moduleValue = { turns: 9 }
    const file = captureSnapshot({ note: '시험' })
    // JSON 으로 한 번 오간다 — 파일과 같은 꼴
    return JSON.parse(JSON.stringify(file)) as SessionSnapshotFile
  }

  it('부모 상태가 서야 서는 자식까지 되살리고, 상태와 ref 가 쥔 같은 객체는 되살려도 같은 객체다', async () => {
    const file = await captureAfterPlay()
    act(() => root!.unmount())
    moduleValue = { turns: 0 }
    inner = null
    mount()
    expect(inner).toBeNull()

    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    const report = await restoreSnapshot(file)
    expect(report.missing).toEqual([])
    expect(outer!.step).toBe(2)
    expect(outer!.progress.count).toBe(5)
    expect([...outer!.progress.tags]).toEqual([['안타', 1]])
    // 함수 칸은 적지 않는다 — 새로 그린 쪽 같은 자리 함수로 채운다
    expect(outer!.progress.onDone()).toBe('새로 그린 함수')
    expect(inner!.label).toBe('바뀜')
    expect(inner!.held.current).toBe(outer!.progress)
    expect(outer!.memo.calls).toEqual([3])
    expect(moduleValue).toEqual({ turns: 9 })
  })

  it('훅 차례가 다른 나무(코드가 바뀜)면 낡은 스냅샷으로 실패한다', async () => {
    const file = await captureAfterPlay()
    act(() => root!.unmount())
    mount()
    const stale: SessionSnapshotFile = { ...file, fibers: file.fibers.map((entry) => ({ ...entry, kinds: `${entry.kinds}s` })) }
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    await expect(restoreSnapshot(stale, { maxPasses: 6 })).rejects.toThrow(/스냅샷이 낡았다/)
  })
})

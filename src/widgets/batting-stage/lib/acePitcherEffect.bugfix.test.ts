import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { leonyEffectDrawsOf } from '@/widgets/batting-stage/lib/acePitcherEffect'
import type { AcePitcherEffectInput } from '@/widgets/batting-stage/lib/acePitcherEffect'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 레오니(순번 1 · 레코드 +0x18 = 6)가 마구를 던지는 0x11 */
const 레오니: AcePitcherEffectInput = {
  aceOrder: 1,
  pitch: { isMagicPitch: true, pitcherMagicNumber: 6 },
  pitchStateDraw: 3,
}
/** origins.json 의 폭 · 높이 (000 69×78 · 001 71×65 · 002~004 높이 47) */
const BOXES: Record<number, { width: number; height: number }> = {
  0: { width: 69, height: 78 }, 1: { width: 71, height: 65 }, 2: { width: 57, height: 47 }, 3: { width: 113, height: 47 }, 4: { width: 121, height: 47 },
}
const boxOf = (frame: number) => BOXES[frame] ?? null

describe('B-82 레오니 마투수 이펙트가 목록 비우기 뒤에 들어가 안 나온다', () => {
  it('원본: 어느 자세에도 아무것도 안 그린다', () => {
    for (let pose = 0; pose <= 15; pose += 1) expect(leonyEffectDrawsOf(레오니, pose, boxOf)).toEqual([])
  })

  it('고침: 0x4703a 점프표대로 프레임 · 자리 · 깊이를 넣는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-82']))
    expect(leonyEffectDrawsOf(레오니, 3, boxOf)).toEqual([])
    expect(leonyEffectDrawsOf(레오니, 4, boxOf)).toEqual([{ frame: 5, dx: 0, dy: 0, depth: 24499 }])
    expect(leonyEffectDrawsOf(레오니, 6, boxOf)).toEqual([
      { frame: 7, dx: 0, dy: 0, depth: 24499 },
      { frame: 2, dx: 0, dy: -47, depth: 24499 },
    ])
    expect(leonyEffectDrawsOf(레오니, 8, boxOf)).toEqual([{ frame: 4, dx: 0, dy: -47, depth: 24499 }])
    expect(leonyEffectDrawsOf(레오니, 9, boxOf)).toEqual([{ frame: 0, dx: -34, dy: -39, depth: 24501 }])
    // p 10 은 y 도 폭(71)으로 뺀다 — 원본 그대로
    expect(leonyEffectDrawsOf(레오니, 10, boxOf)).toEqual([{ frame: 1, dx: -35, dy: -35, depth: 24501 }])
    expect(leonyEffectDrawsOf(레오니, 14, boxOf)).toEqual([{ frame: 12, dx: 0, dy: 0, depth: 24499 }])
    expect(leonyEffectDrawsOf(레오니, 15, boxOf)).toEqual([])
  })

  it('고침이어도 레오니 마구가 아니면 없다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-82']))
    expect(leonyEffectDrawsOf({ ...레오니, pitch: { isMagicPitch: false, pitcherMagicNumber: 6 } }, 6, boxOf)).toEqual([])
    expect(leonyEffectDrawsOf({ ...레오니, pitch: { isMagicPitch: true, pitcherMagicNumber: 5 } }, 6, boxOf)).toEqual([])
  })
})

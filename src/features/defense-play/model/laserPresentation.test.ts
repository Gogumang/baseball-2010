import { describe, expect, it } from 'vitest'
import {
  JUDGE_POPUP_START,
  postJudgeMessage,
  startZoomPunch,
  stepJudgePopup,
  stepZoomPunch,
  zoomSourceRect,
} from '@/features/defense-play/model/laserPresentation'

describe('줌 펀치 0xbb39d · 0xbb84c · 0xbb43c', () => {
  it('그린 배율은 110 · 110 · 105 · 100 — 늘리는 단계의 [0xc] 는 늘 110, 100 에 닿은 그림에서 끝', () => {
    let state = startZoomPunch({ x: 20000, y: 0, z: 26000 })
    expect(state).toMatchObject({ centerX: 310, centerY: 400 })
    const 배율: number[] = []
    for (let draw = 0; draw < 6; draw += 1) {
      const step = stepZoomPunch(state)
      if (step.frame !== null) 배율.push(step.frame.percent)
      state = step.next
    }
    expect(배율).toEqual([110, 110, 105, 100])
  })

  it('원본 사각형은 W·100/s × H·100/s 를 중심 + 오프셋에 두고 화면 안으로 자른다 (bb4b2~bb52a)', () => {
    const screen = { width: 240, height: 320 }
    // 218 × 290 — 가운데
    expect(zoomSourceRect({ percent: 110, centerX: 310, centerY: 400 }, { x: -190, y: -240 }, screen)).toEqual({
      x: 11,
      y: 15,
      width: 218,
      height: 290,
    })
    // 왼쪽 위 밖이면 0, 오른쪽 아래 밖이면 W − 폭
    expect(zoomSourceRect({ percent: 110, centerX: 0, centerY: 0 }, { x: 0, y: 0 }, screen)).toMatchObject({ x: 0, y: 0 })
    expect(zoomSourceRect({ percent: 110, centerX: 400, centerY: 600 }, { x: 0, y: 0 }, screen)).toMatchObject({ x: 22, y: 30 })
  })
})

describe('결과 판 0x46844 — 큰 OUT 칸 바꾸기', () => {
  it('+0x1997 이 1 이면 메시지가 와도 보통 글자 갈래 — +0x1998 · +0x1999 를 지운다', () => {
    const armed = { ...postJudgeMessage(JUDGE_POPUP_START, 13, 2), bigOutArmed: true, bigOutRecord: true }
    const step = stepJudgePopup(armed)
    expect(step.bigOut).toBeNull()
    expect(step.next).toMatchObject({ timer: 9, bigOutArmed: false, bigOutRecord: false, shown: true })
  })

  it('+0x1997 = 0 · 코드 13 · +0x1998 이면 애니 2 를 그리고 첫 그림이 state[0x8b] 를 적는다 — 13 번째 그림(끝 비트)에 닫힌다', () => {
    let state = { ...postJudgeMessage(JUDGE_POPUP_START, 13, -1), shown: false, bigOutArmed: true, bigOutRecord: true }
    const frames: number[] = []
    const records: boolean[] = []
    for (let draw = 0; draw < 10; draw += 1) {
      const step = stepJudgePopup(state)
      if (step.bigOut !== null) frames.push(step.bigOut.frame)
      records.push(step.recordsLaserOut)
      state = step.next
    }
    expect(frames).toEqual([35, 35, 36, 36, 37, 37, 38, 38, 37, 37])
    expect(records.filter(Boolean)).toHaveLength(1)
    // 타이머가 다해 끝 비트 전에 끊긴다 — 같은 판에 코드 13 이 또 오면 이어서 그리고 셋째 그림에 끝난다
    expect(state).toMatchObject({ timer: 0, bigOutArmed: true, shown: false })
    state = postJudgeMessage(state, 13, 3)
    const rest = [stepJudgePopup(state)]
    rest.push(stepJudgePopup(rest[0].next))
    rest.push(stepJudgePopup(rest[1].next))
    expect(rest.map((step) => step.bigOut?.frame)).toEqual([40, 40, 39])
    expect(rest[2].next).toMatchObject({ timer: 0, bigOutArmed: false, shown: true })
  })
})

describe('결과 판 0x46844 — 보통 판정 글자 0x393b4(x, y − 30, v, 1, 0)', () => {
  const 글자칸 = (code: number, draws = 10) => {
    let state = postJudgeMessage(JUDGE_POPUP_START, code, 2)
    const frames: (number | null)[] = []
    for (let draw = 0; draw < draws; draw += 1) {
      const step = stepJudgePopup(state)
      frames.push(step.text?.frame ?? null)
      state = step.next
    }
    return frames
  }

  it('넘긴 뒤 그린다 — SAFE(코드 9 → 애니 5: 8/2 · 10/2 · 10/5 · 11/1 · 39/0)의 첫 그림은 이미 한 번 넘긴 칸이다', () => {
    expect(글자칸(9)).toEqual([8, 10, 10, 10, 10, 10, 10, 10, 11, 39])
  })

  it('OUT(코드 11 · 13 → 애니 1)은 타이머 10 그림 안에 끝 칸 39 에서 멈춘다', () => {
    expect(글자칸(13)).toEqual([35, 35, 37, 37, 38, 37, 37, 36, 39, 39])
    expect(글자칸(11)).toEqual(글자칸(13))
  })

  it('표 0xcfe90 이 0x394d6 으로 보내는 6 · 8 · 12 는 아무것도 안 그린다 — 타이머만 준다', () => {
    for (const code of [6, 8, 12]) expect(글자칸(code)).toEqual(Array.from({ length: 10 }, () => null))
  })

  it('FOUL(코드 7 → 애니 4)은 칸마다 dy 를 0x93c45 가 자리에 더한다 · 자리 야수는 메시지의 +0x1088', () => {
    let state = postJudgeMessage(JUDGE_POPUP_START, 7, 5)
    const texts = []
    for (let draw = 0; draw < 8; draw += 1) {
      const step = stepJudgePopup(state)
      texts.push(step.text)
      state = step.next
    }
    expect(texts.map((text) => text?.dy)).toEqual([0, 0, 0, 1, 1, 3, 3, 0])
    expect(texts.every((text) => text?.holderSlot === 5)).toBe(true)
  })

  it('메시지가 오면 그 코드의 애니를 되감는다(51a8c 0x39578) — 같은 판의 두 번째 OUT 은 처음부터', () => {
    let state = postJudgeMessage(JUDGE_POPUP_START, 13, 2)
    for (let draw = 0; draw < 5; draw += 1) state = stepJudgePopup(state).next
    state = postJudgeMessage(state, 13, 3)
    expect(stepJudgePopup(state).text).toEqual({ frame: 35, dx: 0, dy: 0, holderSlot: 3 })
  })

  it('+0x1997 = 0 · 코드 13 이면 큰 OUT 갈래라 보통 글자를 안 그린다', () => {
    const state = { ...postJudgeMessage(JUDGE_POPUP_START, 13, 2), shown: false }
    expect(stepJudgePopup(state).text).toBeNull()
  })
})

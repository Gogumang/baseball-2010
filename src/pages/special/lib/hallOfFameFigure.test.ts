import { describe, expect, it } from 'vitest'
import {
  INITIAL_FIGURE_ENTRY, INITIAL_FIGURE_LIST_MEMORY, advanceBatterAnimation, advancePitcherAnimation, batterPoseOf,
  drawListFigure, drawListFigureTimes, pitcherImageDxOf, pitcherPoseOf,
} from '@/pages/special/lib/hallOfFameFigure'
import type { FigureAnimation, FigureFrame, HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'

const 투수: HallOfFameFigureLook = { form: 1, skin: 2, team: 14, equipment: [0, 0, 0, 0] }
const 우완: HallOfFameFigureLook = { form: 2, skin: 0, team: 14, equipment: [0, 0, 0, 0] }
const 타자: HallOfFameFigureLook = { form: 0, skin: 1, team: 14, equipment: [1, 0, 0, 0] }

const 투수칸 = (slot: number, look: HallOfFameFigureLook | null = 투수) =>
  ({ slot, isBatterSlot: false, look, capturesImage: true })
const 타자칸 = (slot: number, look: HallOfFameFigureLook | null = 타자) =>
  ({ slot, isBatterSlot: true, look, capturesImage: true })

describe('투수 애니 0x9df30', () => {
  it('상태 1 투구 — 유지 0xd73e9 대로 단계가 오르고 13 에서 멈춘다, 프레임은 폼 >> 1 표', () => {
    let animation: FigureAnimation = { state: 1, step: 0, count: 0, form: 0 }
    const poses: number[] = []
    for (let draw = 0; draw < 24; draw += 1) {
      animation = advancePitcherAnimation(animation)
      poses.push(pitcherPoseOf(animation))
    }
    // 단계 0 유지 1 → 두 번째 갱신에 단계 1, 단계 1 유지 2 → 세 번 …
    expect(poses.slice(0, 8)).toEqual([0, 3, 3, 3, 4, 4, 5, 5])
    expect(poses[poses.length - 1]).toBe(14)
    expect(animation.step).toBe(13)
  })

  it('상태 0 은 단계 0 그대로 — 폼 0·1 → 0, 2·3 → 1, 4·5 → 2', () => {
    expect([0, 2, 4].map((form) => pitcherPoseOf(advancePitcherAnimation({ state: 0, step: 0, count: 0, form })))).toEqual([0, 1, 2])
  })

  it('상태 2 대기가 단계 3 을 넘으면 상태 0 으로 (0x9e024)', () => {
    expect(advancePitcherAnimation({ state: 2, step: 3, count: 4, form: 0 }).state).toBe(0)
  })
})

describe('타자 애니 0xb9014 (마선수 아님)', () => {
  it('상태 5 대기 — 유지 3 이라 4갱신마다, 폼 0·1 은 0~3 · 폼 2·3 은 0~4 를 되풀이', () => {
    let animation: FigureAnimation = { state: 5, step: 0, count: 0, form: 0 }
    const poses: number[] = []
    for (let draw = 0; draw < 17; draw += 1) {
      animation = advanceBatterAnimation(animation)
      poses.push(batterPoseOf(animation))
    }
    expect(poses).toEqual([0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 0, 0])
  })

  it('상태 3 스윙 — 폼 0·1 은 6~12, 폼 2·3 은 7~11 에서 멈춘다', () => {
    let balancer: FigureAnimation = { state: 3, step: 0, count: 0, form: 1 }
    let slugger: FigureAnimation = { state: 3, step: 0, count: 0, form: 3 }
    for (let draw = 0; draw < 10; draw += 1) {
      balancer = advanceBatterAnimation(balancer)
      slugger = advanceBatterAnimation(slugger)
    }
    expect(batterPoseOf(balancer)).toBe(12)
    expect(batterPoseOf(slugger)).toBe(11)
  })

  it('상태 2 준비 4·5 (폼 2·3 은 5·6) · 상태 4 번트 13 · 12', () => {
    expect([batterPoseOf({ state: 2, step: 1, count: 0, form: 0 }), batterPoseOf({ state: 2, step: 1, count: 0, form: 2 })]).toEqual([5, 6])
    expect([batterPoseOf({ state: 4, step: 0, count: 0, form: 0 }), batterPoseOf({ state: 4, step: 0, count: 0, form: 2 })]).toEqual([13, 12])
  })
})

describe('목록 0x5e8bc · 0x63b14 찬 칸 갈래', () => {
  it('빈 칸은 몸 그림이 없고 그린 수도 안 오른다', () => {
    const frame = drawListFigure(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, 투수칸(1, null))
    expect(frame.drawing.kind).toBe('없음')
    expect(frame.memory.draws).toBe(0)
  })

  it('투수 이미지는 한 그림 늦다 — 진입 첫 그림은 빈 이미지, 다음 그림부터 실린 투수', () => {
    const first = drawListFigure(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, 투수칸(1))
    expect(first.drawing).toEqual({ kind: '투수', image: null, hand: 1 })
    const second = drawListFigure(first.memory, first.entry, 투수칸(1))
    expect(second.drawing).toEqual({ kind: '투수', image: { look: 투수, pose: 0 }, hand: 1 })
  })

  it('x 보정은 지금 투수 그림 손으로 — 좌완 0x32 · 우완 0x3b, 그림은 앞 그림 값', () => {
    expect([pitcherImageDxOf(1), pitcherImageDxOf(0)]).toEqual([-0x32, -0x3b])
    const left = drawListFigureTimes(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, 투수칸(1), 3)
    const moved = drawListFigure(left.memory, left.entry, 투수칸(2, 우완))
    expect(moved.drawing).toEqual({ kind: '투수', image: { look: 투수, pose: left.memory.pose }, hand: 0 })
  })

  it('타자 칸에서 투수 칸으로 오면 앞서 실은 투수를 타자 자세 번호로 그린다 ([목록+0x204] 공유 — 원본 그대로)', () => {
    let frame: FigureFrame = drawListFigureTimes(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, 투수칸(1), 2)
    frame = drawListFigureTimes(frame.memory, frame.entry, 타자칸(6), 40)
    expect(frame.drawing.kind).toBe('타자')
    const batterPose = frame.memory.pose
    const back = drawListFigure(frame.memory, frame.entry, 투수칸(1))
    expect(back.drawing).toEqual({ kind: '투수', image: { look: 투수, pose: batterPose }, hand: 1 })
  })

  it('그린 수 30 에 동작을 시작한다 — 투수는 투구(상태 1), 타자는 준비(상태 2) → 스윙', () => {
    const pitcher = drawListFigureTimes(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, 투수칸(1), 0x1e)
    expect(pitcher.entry.pitcherAnimation?.state).toBe(1)
    const batter = drawListFigureTimes(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, 타자칸(6), 0x1e)
    expect(batter.entry.batterAnimation?.state).toBe(2)
    const swinging = drawListFigureTimes(batter.memory, batter.entry, 타자칸(6), 8)
    expect(swinging.entry.batterAnimation?.state).toBe(3)
  })

  it('그린 수는 목록 칸이라 다시 들어와도 잇는다 — 진입은 그림만 새로', () => {
    const before = drawListFigureTimes(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, 투수칸(1), 10)
    const again = drawListFigure(before.memory, INITIAL_FIGURE_ENTRY, 투수칸(1))
    expect(again.memory.draws).toBe(11)
    expect(again.drawing).toEqual({ kind: '투수', image: null, hand: 1 })
  })

  it('홈런더비(0x669c1 안 부름)는 이미지를 뜨지 않는다', () => {
    const frame = drawListFigureTimes(INITIAL_FIGURE_LIST_MEMORY, INITIAL_FIGURE_ENTRY, { ...투수칸(1), capturesImage: false }, 3)
    expect(frame.drawing).toEqual({ kind: '투수', image: null, hand: 1 })
  })
})

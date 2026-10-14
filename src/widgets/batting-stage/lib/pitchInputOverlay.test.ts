import { describe, expect, it } from 'vitest'
import {
  gaugeDrawsOf,
  showsGaugeTargetFrameOf,
  pitchMenuFrameOf,
  pitchMenuLabelX,
  pitchMenuShineStepOf,
  spotlightLevelAt,
} from '@/widgets/batting-stage/lib/pitchInputOverlay'

const 표 = {
  result: [54, 55, 56, 57, 72].map((frame) => ({ frame, delay: 0 })),
  perfect: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [21, 0]].map(([frame, delay]) => ({ frame, delay })),
}

describe('0xf 구질 목록 (0x4c4bc 4c528~)', () => {
  const types = [1, 2, 0, 5, 7, 22]

  it('진입 0x16 에서 그림마다 고리 +1, 0x19 에 멈추고 그림 3 부터 칸을 그린다', () => {
    expect(pitchMenuFrameOf(0, types)).toEqual({ ring: 0x16, slotFrames: [0x26, null, 0x2e, 0x32], showsSlots: false })
    expect(pitchMenuFrameOf(2, types).ring).toBe(0x18)
    expect(pitchMenuFrameOf(3, types)).toEqual({ ring: 0x19, slotFrames: [0x29, null, 0x31, 0x35], showsSlots: true })
    expect(pitchMenuFrameOf(40, types).ring).toBe(0x19)
  })

  it('반짝임 애니 2 — 틱 4 와 70 의 배수에서 한 번씩', () => {
    expect(pitchMenuShineStepOf(3, 8)).toBeNull()
    expect(pitchMenuShineStepOf(4, 8)).toBe(0)
    expect(pitchMenuShineStepOf(11, 8)).toBe(7)
    expect(pitchMenuShineStepOf(12, 8)).toBeNull()
    expect(pitchMenuShineStepOf(141, 8)).toBe(1)
  })

  it('이름 — 칸 1 · 3 왼쪽 맞춤, 2 · 4 상자 오른쪽 끝에 오른쪽 맞춤', () => {
    expect(pitchMenuLabelX(1, 100, [9, -58, 3, 5], 23)).toBe(109)
    expect(pitchMenuLabelX(2, 100, [-40, -32, 5, 5], 23)).toBe(100 - 40 + 5 - 23)
  })

  it('빛 지도 — 바탕 15, 앵커 20 위 지름 60 원은 31', () => {
    const anchor = { x: 83, y: 188 }
    expect(spotlightLevelAt(0, 0, anchor)).toBe(15)
    // 도장 왼쪽 위 = (41 − 15, 84 − 15) = (26, 69) — 가운데 줄 (15) 은 [0, 30)
    expect(spotlightLevelAt(26, 69 + 15, anchor)).toBe(31)
    expect(spotlightLevelAt(26, 69, anchor)).toBe(15)
    expect(spotlightLevelAt(26 + 11, 69, anchor)).toBe(31)
  })
})

describe('0x11 게이지 (0x4d412~)', () => {
  it('칸을 정하기 전 — 커서 0 · > 8 은 0x3a 한 장, 1..8 은 0x3b 위 min(0x3b + 커서, 0x43)', () => {
    expect(gaugeDrawsOf({ cursor: 0, pressed: 0, decidedTicks: 0 }, 표).map((draw) => draw.frame)).toEqual([0x3a, 0x23])
    expect(gaugeDrawsOf({ cursor: 9, pressed: 0, decidedTicks: 0 }, 표).map((draw) => draw.frame)).toEqual([0x3a])
    expect(gaugeDrawsOf({ cursor: 8, pressed: 0, decidedTicks: 0 }, 표).map((draw) => draw.frame)).toEqual([0x3b, 0x43, 0x23])
    expect(gaugeDrawsOf({ cursor: -1, pressed: 0, decidedTicks: 0 }, 표).map((draw) => draw.frame)).toEqual([0x3b, 0x23])
  })

  it('정한 뒤 — 멈춘 커서는 반투명 8/16, 애니 1 은 k 칸 나아간 칸, 끝나면 결과 원이 15 · 12 · 9 · 6 /16 으로 흐려진다', () => {
    const 첫 = gaugeDrawsOf({ cursor: 6, pressed: 6, decidedTicks: 0 }, 표)
    expect(첫).toEqual([
      { folder: './sprites/slt_pitch/frames', frame: 0x41, dy: 0, alpha: 0.5 },
      { folder: './sprites/slt_pitch/frames', frame: 0x41, dy: 0 },
      { folder: './sprites/slt_pitch/frames', frame: 55, dy: 0 },
    ])
    // k = 5: 애니 1 이 이 그림에서 끝난다 — 누른 칸 보통 그림과 결과 원(15/16)이 같이
    const 끝 = gaugeDrawsOf({ cursor: 6, pressed: 6, decidedTicks: 4 }, 표)
    expect(끝.map((draw) => [draw.frame, draw.alpha])).toEqual([[0x41, 0.5], [0x41, undefined], [0x41, 15 / 16]])
    expect(gaugeDrawsOf({ cursor: 6, pressed: 6, decidedTicks: 7 }, 표).at(-1)?.alpha).toBe(6 / 16)
    expect(gaugeDrawsOf({ cursor: 6, pressed: 6, decidedTicks: 8 }, 표)).toHaveLength(1)
  })

  it('누른 칸 9(t == 5) — game_effect 애니 0 을 같은 차례로 덧그린다', () => {
    const draws = gaugeDrawsOf({ cursor: 9, pressed: 9, decidedTicks: 0 }, 표)
    expect(draws.at(-1)).toEqual({ folder: './sprites/game_effect/frames', frame: 1, dy: 0 })
  })
})

describe('목표 표시 프레임 0x23 (0x4d360)', () => {
  const 기본 = { mode: 1, difficulty: 2, isAttackSideHuman: true, eagleEyeGames: 0, gaugeSettingOn: true }
  it('나리 타자편(모드 4) 이글아이 남은 경기 > 0 이면 넣는다 · 홈런더비는 안 넣는다', () => {
    expect(showsGaugeTargetFrameOf({ ...기본, mode: 4, eagleEyeGames: 3 })).toBe(true)
    expect(showsGaugeTargetFrameOf({ ...기본, mode: 4 })).toBe(false)
    expect(showsGaugeTargetFrameOf({ ...기본, mode: 7, difficulty: 0 })).toBe(false)
  })
  it('사람이 던질 때 게이지 설정이 꺼져 있으면 · 난이도 0 이면 넣는다', () => {
    expect(showsGaugeTargetFrameOf({ ...기본, isAttackSideHuman: false, gaugeSettingOn: false })).toBe(true)
    expect(showsGaugeTargetFrameOf({ ...기본, difficulty: 0 })).toBe(true)
    expect(showsGaugeTargetFrameOf({ ...기본, mode: 5, difficulty: 0 })).toBe(false)
  })
})

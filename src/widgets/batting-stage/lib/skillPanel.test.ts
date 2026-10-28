import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SKILL_CHEER_BITS_START,
  SKILL_PANEL_IDLE,
  SKILL_PANEL_LIFETIME,
  SKILL_ROW_TEXT_BOX,
  TWO_STRIKE_PITCHER_BITS,
  batterSkillPanelBitsOf,
  createSkillPanelScene,
  enterAtBatSkillPanel,
  enterPitchSkillPanel,
  pitcherIconOriginOf,
  pitcherSkillPanelBitsOf,
  restoreCheerBit,
  skillArrowEntryOf,
  skillBitsOfIds,
  skillCategoryOf,
  skillCheerOf,
  skillIconSlotsOf,
  skillPanelSheetOf,
  skillPanelViewOf,
  skillPanelXOf,
  skillRowTextOf,
  stepSkillPanel,
} from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelSituation } from '@/widgets/batting-stage/lib/skillPanel'

const 상황: SkillPanelSituation = {
  inning: 1,
  attackScore: 0,
  defenseScore: 0,
  runnerCount: 0,
  hasSecondBaseRunner: false,
  pitcherHand: 0,
  batterHand: 0,
  batterRecordSlot: 0,
  recentAtBatCodes: [],
}
const 비트 = (...bits: number[]) => bits.reduce((sum, bit) => sum | (1 << bit), 0)
const 모두 = 0xffffff

describe('타자 비트 0x445cc — 장착 스킬 중 지금 걸리는 것', () => {
  it('조건 없는 비트 1·2·5·7·8·9·11·12·18~23 만 서고 0·3·4·6·15 는 안 본다', () => {
    expect(batterSkillPanelBitsOf(모두, 상황)).toBe(비트(1, 2, 5, 7, 8, 9, 11, 12, 14, 18, 19, 20, 21, 22, 23))
  })

  it('10 해결사는 6회(st[0x6b] > 4) 이후 지고 있을 때 · 13 좌완UP / 14 우완UP 은 투수 손', () => {
    const late = { ...상황, inning: 6, defenseScore: 2, attackScore: 1, pitcherHand: 1 }
    expect(batterSkillPanelBitsOf(비트(10, 13, 14), late)).toBe(비트(10, 13))
    expect(batterSkillPanelBitsOf(비트(10), { ...late, inning: 5 })).toBe(0)
    expect(batterSkillPanelBitsOf(비트(10), { ...late, attackScore: 2 })).toBe(0)
  })

  it('16 상승세 = 링 > 3 이고 맨 앞 둘이 1~4 · 17 하락세 = 링 > 2 이고 둘이 5~7', () => {
    expect(batterSkillPanelBitsOf(비트(16, 17), { ...상황, recentAtBatCodes: [1, 4, 7, 7] })).toBe(비트(16))
    expect(batterSkillPanelBitsOf(비트(16, 17), { ...상황, recentAtBatCodes: [1, 4, 7] })).toBe(0)
    expect(batterSkillPanelBitsOf(비트(16, 17), { ...상황, recentAtBatCodes: [5, 7, 1] })).toBe(비트(17))
  })

  it('홈런더비(모드 7)는 0 (445e0)', () => {
    expect(batterSkillPanelBitsOf(모두, { ...상황, gameMode: 7 })).toBe(0)
  })
})

describe('투수 비트 0x3d160', () => {
  it('조건 없는 1·2·5·7·8·9·10·18·19·20·22 — 11 은 0xf 갈래라 여기서 안 선다', () => {
    expect(pitcherSkillPanelBitsOf(모두, 상황)).toBe(비트(1, 2, 5, 7, 8, 9, 10, 13, 18, 19, 20, 22))
  })

  it('12 좌타UP / 13 우타UP 은 타자 손 · 14 투지는 6회 이후 수비가 질 때 · 15 집중은 타자 칸 2~4', () => {
    expect(pitcherSkillPanelBitsOf(비트(12, 13), { ...상황, batterHand: 1 })).toBe(비트(12))
    expect(pitcherSkillPanelBitsOf(비트(14), { ...상황, inning: 7, attackScore: 3, defenseScore: 1 })).toBe(비트(14))
    expect(pitcherSkillPanelBitsOf(비트(14), { ...상황, inning: 7, attackScore: 1, defenseScore: 1 })).toBe(0)
    expect([1, 2, 4, 5].map((slot) => pitcherSkillPanelBitsOf(비트(15), { ...상황, batterRecordSlot: slot }))).toEqual([0, 비트(15), 비트(15), 0])
  })

  it('16 안정감 = 주자 > 1 · 17 새가슴 = 2루 주자 · 21 열혈 = 주자 > 0', () => {
    expect(pitcherSkillPanelBitsOf(비트(16, 17, 21), { ...상황, runnerCount: 1 })).toBe(비트(21))
    expect(pitcherSkillPanelBitsOf(비트(16, 17, 21), { ...상황, runnerCount: 2, hasSecondBaseRunner: true })).toBe(비트(16, 17, 21))
  })

  it('투수 스킬 번호(비트 + 16) → 비트', () => {
    expect(skillBitsOfIds([27, 24], true)).toBe(비트(11, 8))
    expect(skillBitsOfIds([1, 23], false)).toBe(비트(1, 23))
  })
})

describe('세우기 — 0xd 진입 48fa4 · 0xf 진입 3dd4e', () => {
  it('두 비트를 새로 쓰고 하나라도 서면 수명 20 · 틱 0 · 함성 검사', () => {
    const state = enterAtBatSkillPanel(SKILL_PANEL_IDLE, 비트(1), 0)
    expect(state).toEqual({ batterBits: 비트(1), pitcherBits: 0, remaining: SKILL_PANEL_LIFETIME, tick: 0, cheerPending: true })
  })

  it('둘 다 0 이면 비트만 0 으로 두고 수명은 그대로다', () => {
    const running = { ...SKILL_PANEL_IDLE, batterBits: 비트(9), remaining: 5, tick: 15 }
    expect(enterAtBatSkillPanel(running, 0, 0)).toEqual({ ...running, batterBits: 0 })
  })

  it('2 스트라이크이고 투수가 비트 11 이면 투수 비트 = 0x800 하나 · 타자 비트는 그대로', () => {
    const state = { ...SKILL_PANEL_IDLE, batterBits: 비트(9), pitcherBits: 비트(8) }
    expect(enterPitchSkillPanel(state, 2, 비트(11, 8))).toEqual({
      batterBits: 비트(9),
      pitcherBits: TWO_STRIKE_PITCHER_BITS,
      remaining: 20,
      tick: 0,
      cheerPending: true,
    })
    expect(enterPitchSkillPanel(state, 1, 비트(11))).toBe(state)
    expect(enterPitchSkillPanel(state, 2, 비트(8))).toBe(state)
  })
})

describe('그림 — 0x4b5b4', () => {
  it('판은 20 그림 동안 그리고 수명이 다하면 비트 · 틱을 지운다 (4b62c)', () => {
    let state = enterAtBatSkillPanel(SKILL_PANEL_IDLE, 비트(1), 비트(8))
    const source = { batterHand: 0, isDefenseCpu: true }
    let drawn = 0
    for (let frame = 0; frame < 25; frame += 1) {
      const { view, next } = stepSkillPanel(state, source, 0)
      if (view !== null) drawn += 1
      state = next
    }
    expect(drawn).toBe(SKILL_PANEL_LIFETIME)
    expect(state).toMatchObject({ batterBits: 0, pitcherBits: 0, tick: 0, remaining: 0, cheerPending: false })
  })

  it('밀림 — 틱 0 은 화면 밖, 살짝 넘쳤다가 틱 7 부터 제자리 (왼손 타자 왼쪽 · 오른손 오른쪽 W − 47)', () => {
    expect(Array.from({ length: 9 }, (_, tick) => skillPanelXOf(tick, 1))).toEqual([-46, -32, -20, -10, -2, 2, 2, 0, 0])
    expect(Array.from({ length: 9 }, (_, tick) => skillPanelXOf(tick, 0))).toEqual([239, 225, 213, 203, 195, 191, 191, 193, 193])
  })

  it('줄 차례 — 나쁜 무리(20~17 · 5~2) 주황 60 먼저, 그다음 좋은 무리(23~8 · 7~0) 파랑 59 · 위로 15 씩', () => {
    const sheet = skillPanelSheetOf(비트(1, 2, 9, 18), false)
    expect(sheet?.lineY).toBe(298)
    expect(sheet?.rows).toEqual([
      { frame: 60, name: '헛스윙', y: 295 },
      { frame: 60, name: '먹튀', y: 280 },
      { frame: 59, name: '베테랑', y: 265 },
      { frame: 59, name: '전국구', y: 250 },
    ])
    expect(sheet?.titleY).toBe(235)
  })

  it('투수 판은 H − 133 에서 — 비트 0~7 은 공통 스킬 줄(0x37), 8~23 은 투수 스킬 줄(0x47 = 번호 비트 + 16)', () => {
    const sheet = skillPanelSheetOf(비트(2, 8, 11), true)
    expect(sheet?.lineY).toBe(187)
    expect(sheet?.rows.map((row) => row.name)).toEqual(['먹튀', '닥터K', '신선함'])
    expect(skillRowTextOf(23, true)).toBe('혼신')
  })

  it('줄은 여섯까지 (셈 > 5 면 무리를 건너뛴다)', () => {
    expect(skillPanelSheetOf(모두, false)?.rows).toHaveLength(6)
    expect(skillPanelSheetOf(0, false)).toBeNull()
  })

  it('글 상자는 프레임 59 의 상자 0 (boxes.json)', () => {
    const boxes = JSON.parse(readFileSync('public/sprites/game_ui/frames/boxes.json', 'utf8')) as Record<string, number[][]>
    const box = boxes['059']?.[0]
    expect(box).toEqual([SKILL_ROW_TEXT_BOX.x, SKILL_ROW_TEXT_BOX.y, SKILL_ROW_TEXT_BOX.width, SKILL_ROW_TEXT_BOX.height])
  })

  it('줄 · 칸 높이 3 · 15 와 프레임 58~61 원점 (origins.json)', () => {
    const origins = JSON.parse(readFileSync('public/sprites/game_ui/frames/origins.json', 'utf8')) as Record<string, { height: number }>
    expect([origins['061']?.height, origins['059']?.height, origins['060']?.height]).toEqual([3, 15, 15])
  })
})

describe('아이콘 — 0x4b550 · 0x5f350', () => {
  it('갈래 0x5f350 — 1 좋음 · 2 나쁨 · 4 특수', () => {
    expect([0, 1, 2, 5, 6, 7, 8, 16, 17, 20, 21, 23].map(skillCategoryOf)).toEqual([1, 1, 2, 2, 4, 4, 1, 1, 2, 2, 4, 4])
  })

  it('같은 그림은 한 칸 — 앞 칸이 위면 새 칸의 위아래를 따른다', () => {
    // 17 하락세(히트 · 나쁨) → 15 제압(히트 · 좋음): 앞 칸이 아래라 그대로 아래
    expect(skillIconSlotsOf(비트(15, 17), true)).toEqual([{ image: 0x4a, isUp: false }])
    // 16 상승세(파워 · 좋음) → 10 해결사(파워 · 좋음)
    expect(skillIconSlotsOf(비트(10, 16), true)).toEqual([{ image: 0x4b, isUp: true }])
    expect(skillIconSlotsOf(비트(10, 15), true)).toEqual([
      { image: 0x4a, isUp: true },
      { image: 0x4b, isUp: true },
    ])
  })

  it('없는 그림(−1)도 칸을 차지하고(셋까지) 그리지만 않는다 — 그린 칸만 15 씩 위로', () => {
    const slots = skillIconSlotsOf(비트(23, 22, 21, 9, 10), true)
    expect(slots).toEqual([
      { image: -1, isUp: true },
      { image: 0x4c, isUp: true },
      { image: 0x4b, isUp: true },
    ])
    const view = skillPanelViewOf(
      { ...SKILL_PANEL_IDLE, batterBits: 비트(23, 22, 21, 9, 10), remaining: 1 },
      { batterHand: 0, isDefenseCpu: true },
      0,
    )
    expect(view.batterIcons).toEqual([
      { image: 0x4c, isUp: true, x: 100, y: 224 },
      { image: 0x4b, isUp: true, x: 100, y: 209 },
    ])
  })

  it('투수 아이콘 — 표 0xd020c, 칸은 투수 앵커 + (−20, CPU 수비면 −0x34)', () => {
    expect(skillIconSlotsOf(비트(19, 11), false)).toEqual([
      { image: 0x50, isUp: false },
      { image: 0x4f, isUp: true },
    ])
    expect(pitcherIconOriginOf({ batterHand: 0, isDefenseCpu: true })).toEqual({ x: 136, y: 136 })
    expect(pitcherIconOriginOf({ batterHand: 1, isDefenseCpu: false })).toEqual({ x: 63, y: 110 })
  })

  it('애니 7 · 8 — 첫 그림은 멈춘 채, 그 뒤 칸 지연 1 · 2 로 돈다', () => {
    expect(Array.from({ length: 8 }, (_, draws) => skillArrowEntryOf(draws))).toEqual([0, 0, 1, 1, 0, 1, 1, 0])
  })
})

describe('함성 29 — 0x4c39a', () => {
  const 장면 = createSkillPanelScene()
  it('비트 칸은 두 측 모두 0x3ff 로 시작한다 (0x3301c)', () => {
    expect(장면.cheerBits).toEqual([SKILL_CHEER_BITS_START, SKILL_CHEER_BITS_START])
  })

  it('전국구 · 먹튀 타자의 칸 비트가 서 있으면 XOR 로 끄고 운다 — 한 번만', () => {
    const input = { attackSide: 1, batterRecordSlot: 3, batterSkillBits: 비트(1) }
    const first = skillCheerOf(장면.cheerBits, input)
    expect(first).toEqual([0x3ff, 0x3f7])
    expect(skillCheerOf(first ?? 장면.cheerBits, input)).toBeNull()
    expect(skillCheerOf(장면.cheerBits, { ...input, batterSkillBits: 비트(2) })).toEqual([0x3ff, 0x3f7])
  })

  it('스킬이 없거나 칸이 8 이상이면 안 운다 (ldrb 낮은 바이트만 — 원본 버그 그대로)', () => {
    expect(skillCheerOf(장면.cheerBits, { attackSide: 0, batterRecordSlot: 3, batterSkillBits: 비트(9) })).toBeNull()
    expect(skillCheerOf(장면.cheerBits, { attackSide: 0, batterRecordSlot: 8, batterSkillBits: 비트(1) })).toBeNull()
    expect(skillCheerOf(장면.cheerBits, { attackSide: 0, batterRecordSlot: 9, batterSkillBits: 비트(1) })).toBeNull()
  })

  it('대타 0x668cc 가 (확정 앞이라 나가는) 타자 칸 비트를 다시 세운다', () => {
    expect(restoreCheerBit([0x3f7, 0x3ff], 0, 3)).toEqual([0x3ff, 0x3ff])
    expect(restoreCheerBit([0x3ff, 0x3ff], 1, 11)).toEqual([0x3ff, 0xbff])
  })
})

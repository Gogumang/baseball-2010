import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setActiveSound, type SoundPort } from '@/shared/api/audio/soundPort'
import { createSkillPanelScene, SKILL_CHEER_SOUND_ID, SKILL_PANEL_LIFETIME } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelSituation } from '@/widgets/batting-stage/lib/skillPanel'
import { createSkillPanelDriver } from '@/widgets/batting-stage/model/skillPanelDriver'
import type { SkillPanelFrame } from '@/widgets/batting-stage/model/skillPanelDriver'

let played: number[] = []
const port: SoundPort = {
  play: (id) => {
    played.push(id)
  },
  playBgm: () => {},
  stopBgm: () => {},
  resumeBgm: () => {},
  stop: () => {},
  currentBgm: () => null,
  setVolume: () => {},
  getVolume: () => 100,
}

beforeEach(() => {
  played = []
  setActiveSound(port)
})
afterEach(() => {
  setActiveSound(null)
})

const 상황: SkillPanelSituation = {
  inning: 1, attackScore: 0, defenseScore: 0, runnerCount: 0, hasSecondBaseRunner: false,
  pitcherHand: 0, batterHand: 0, batterRecordSlot: 2, recentAtBatCodes: [],
}

/** 사람이 던지는 타석 — CPU 타자가 전국구(1) · 먹튀(2), 수비 측 사람(투수 아이콘 칸 −0x4e) */
function 그림(over: Partial<SkillPanelFrame> & Pick<SkillPanelFrame, 'nowTick'>, scene = { current: createSkillPanelScene() }): SkillPanelFrame {
  return {
    source: { entryKey: 'A', attackSide: 1, scene, isDefenseCpu: false },
    isStateF: true,
    stateFMark: 1,
    isDrawnState: true,
    batterSkillBits: (1 << 1) | (1 << 2),
    pitcherSkillBits: 0,
    strikes: 0,
    batterRecordSlot: 2,
    batterHand: 0,
    situation: () => 상황,
    ...over,
  }
}

describe('경기 스킬 표시 판 돌림 — 사람 타석 · 사람 투구 공용 (0xd 진입 48fa4 · 0x4b5b4 · 함성 4c26a)', () => {
  it('0xd 열쇠 뒤 첫 0xf 에 판을 세우고 그 첫 그림에서 CPU 공격 측 칸 비트를 끄고 함성 29 를 낸다', () => {
    const scene = { current: createSkillPanelScene() }
    const step = createSkillPanelDriver()
    const view = step(그림({ nowTick: 0 }, scene))
    expect(view).not.toBeNull()
    expect(view?.batter?.rows.map((row) => row.name).length).toBe(2)
    expect(played).toEqual([SKILL_CHEER_SOUND_ID])
    // 측 1(공격 측 = CPU) 칸 2 비트만 꺼진다
    expect(scene.current.cheerBits).toEqual([0x3ff, 0x3ff ^ (1 << 2)])
    // 사람 수비 — 투수 아이콘 칸은 앵커 y − 0x4e (판 비트가 없으니 아이콘 없음), 그림을 셀 때마다 수명 −1
    expect(scene.current.panel.remaining).toBe(SKILL_PANEL_LIFETIME - 1)
  })

  it('그리지 않는 상태(0xe 쉬는 대기 · 0x12)면 null 이고 수명도 그대로다', () => {
    const scene = { current: createSkillPanelScene() }
    const step = createSkillPanelDriver()
    step(그림({ nowTick: 0 }, scene))
    expect(step(그림({ nowTick: 1, isStateF: false, isDrawnState: false }, scene))).toBeNull()
    expect(scene.current.panel.remaining).toBe(SKILL_PANEL_LIFETIME - 1)
  })

  it('같은 0xf 안에서는 다시 세우지 않고, 0xf 진입 표지가 바뀌면 2 스트라이크 갈래(3dd4e)를 다시 본다', () => {
    const scene = { current: createSkillPanelScene() }
    const step = createSkillPanelDriver()
    const doctorK = 1 << 11
    step(그림({ nowTick: 0, pitcherSkillBits: doctorK }, scene))
    step(그림({ nowTick: 1, pitcherSkillBits: doctorK, strikes: 2 }, scene))
    expect(scene.current.panel.pitcherBits).toBe(0)
    step(그림({ nowTick: 2, pitcherSkillBits: doctorK, strikes: 2, stateFMark: 2 }, scene))
    expect(scene.current.panel.pitcherBits).toBe(doctorK)
    expect(scene.current.panel.remaining).toBe(SKILL_PANEL_LIFETIME - 1)
  })

  it('창이 선 첫 그림([창+0x250])은 틱이 안 흘러도 0x4b5b4 를 한 번 더 돌린다 — 마지막으로 센 틱은 그대로 (r178)', () => {
    const scene = { current: createSkillPanelScene() }
    const step = createSkillPanelDriver()
    step(그림({ nowTick: 0 }, scene))
    step(그림({ nowTick: 0, extraDraw: true }, scene))
    expect(scene.current.panel.remaining).toBe(SKILL_PANEL_LIFETIME - 2)
    // 창이 닫힌 뒤 다음 틱은 한 번만
    step(그림({ nowTick: 1 }, scene))
    expect(scene.current.panel.remaining).toBe(SKILL_PANEL_LIFETIME - 3)
  })
})

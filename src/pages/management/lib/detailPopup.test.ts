import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { detailRowsOf, DETAIL_ROW_TOP, restDetailChangesOf, trainingDetailChangesOf } from '@/pages/management/lib/detailPopup'
import { runTraining } from '@/entities/career/model/training'
import { runRest } from '@/entities/career/model/outing'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 선수 = createCareer('테스트')

describe('상세정보 결과 창 — 0x872a0 · 0x872d4', () => {
  it('히트·파워·수비·주루·사기 다섯 줄: 실효값 / 한계(사기 100) / 변화량', () => {
    const after = { ...선수, ability: { ...선수.ability, hit: 106 }, morale: 94 }

    expect(detailRowsOf(선수, after)).toEqual([
      { labelFrame: 336, current: 106, maximum: 800, change: 6 },
      { labelFrame: 337, current: 100, maximum: 800, change: 0 },
      { labelFrame: 338, current: 130, maximum: 800, change: 0 },
      { labelFrame: 339, current: 100, maximum: 800, change: 0 },
      { labelFrame: 84, current: 94, maximum: 100, change: -6 },
    ])
  })

  it('현재값은 0xb6415(기록, k, 1) — 장비는 넣고 질병·부상·사기 감소는 안 넣는다 (0x18cf6)', () => {
    const before = { ...선수, morale: 10, isInjured: true, isSick: true }
    const after = { ...before, equipmentLevels: { ...선수.equipmentLevels, power: 1 } }

    const rows = detailRowsOf(before, after)
    expect(rows[0]).toMatchObject({ current: 선수.ability.hit, change: 0 })
    expect(rows[1]).toMatchObject({ current: 선수.ability.power + 30, change: 30 })
  })

  it('i 번째 줄 y = 76 + 17(i+1) − 4', () => {
    expect([0, 4].map(DETAIL_ROW_TOP)).toEqual([89, 157])
  })

  describe('변화량은 굴린 값 그대로 — 전후 차이가 아니다 (0x18c58 · 0x18d14 · 0x18fb4)', () => {
    const 고정 = (position: number): RandomPort => ({
      next: () => position,
      nextInRange: (minimum, maximum) => minimum + position * (maximum - minimum),
      pick: (candidates) => candidates[0],
    })
    const 메뉴 = (id: string) => TRAINING_MENUS.find((menu) => menu.id === id)!
    const 변화 = (rows: ReturnType<typeof detailRowsOf>) => rows.map((row) => row.change)

    it('훈련: 타입 보너스·병아리·서브 아이템은 변화량에 안 들어가고 다른 칸은 0 이다', () => {
      // 교타(0) 히트 훈련 + 병아리(0) + 표적판(0): 실제 상승 4+1+1+2 = 8, 창에는 굴린 4
      const before = { ...선수, morale: 50, battingTypeIndex: 0, skillIds: [0], equippedSkillIds: [0], subItemIds: [0] }
      const outcome = runTraining(before, 메뉴('히트'), 고정(0))

      expect(outcome.career.ability.hit - before.ability.hit).toBe(8)
      expect(변화(detailRowsOf(before, outcome.career, trainingDetailChangesOf(outcome)))).toEqual([4, 0, 0, 0, -5])
      // 예전 방식(전후 차이)은 8 과 −4 (병아리 사기 −1) 를 보였다
      expect(변화(detailRowsOf(before, outcome.career))).toEqual([8, 0, 0, 0, -4])
    })

    it('훈련: 사기가 0 에서 잘려도 사기 칸은 굴린 감소값 그대로', () => {
      const before = { ...선수, morale: 3, skillIds: [], equippedSkillIds: [] }
      const outcome = runTraining(before, 메뉴('파워'), 고정(0.999))

      expect(outcome.career.morale).toBe(0)
      expect(detailRowsOf(before, outcome.career, trainingDetailChangesOf(outcome))[4].change).toBe(-7)
    })

    it('필살타법은 원본에 이 창이 없다 (0x18bd8)', () => {
      const outcome = runTraining({ ...선수, morale: 50, gamePoint: 600 }, 메뉴('필살타법'), 고정(0))
      expect(trainingDetailChangesOf(outcome)).toBeNull()
    })

    it('휴식: 사기 칸은 회복 굴림 그대로 (100 에서 잘리기 전), 능력치 칸은 0', () => {
      const before = { ...선수, morale: 95 }
      const rest = runRest(before, 고정(0.999))

      expect(rest.career.morale).toBe(100)
      expect(변화(detailRowsOf(before, rest.career, restDetailChangesOf(rest.moraleGain)))).toEqual([0, 0, 0, 0, 15])
    })
  })
})

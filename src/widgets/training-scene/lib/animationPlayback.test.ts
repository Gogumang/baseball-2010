import { describe, expect, it } from 'vitest'
import { animationStepAt, figurePoseAt } from '@/widgets/training-scene/lib/animationPlayback'
import { TRAINING_PRESENTATION_OF, figurePosesOf } from '@/shared/config/original/trainingAnimation'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'

describe('animationStepAt — PZX 애니메이션 표 재생', () => {
  it('지연 0 은 한 번 갱신에 한 칸이다', () => {
    const 표 = [{ frame: 114, delay: 0 }, { frame: 115, delay: 0 }]
    expect(animationStepAt(표, 0)?.frame).toBe(114)
    expect(animationStepAt(표, 1)?.frame).toBe(115)
  })

  it('지연만큼 갱신이 지나야 다음 칸이다', () => {
    const 표 = [{ frame: 96, delay: 2 }, { frame: 98, delay: 3 }]
    expect(animationStepAt(표, 1)?.frame).toBe(96)
    expect(animationStepAt(표, 2)?.frame).toBe(98)
    expect(animationStepAt(표, 4)).toMatchObject({ entryIndex: 1, frame: 98 })
  })

  it('끝에 닿으면 처음으로 돈다 (훈련 팝업은 반복 재생)', () => {
    const 표 = [{ frame: 1, delay: 2 }, { frame: 3, delay: 2 }]
    expect(animationStepAt(표, 4)?.frame).toBe(1)
  })

  it('빈 표는 그릴 것이 없다', () => {
    expect(animationStepAt([], 3)).toBeNull()
  })
})

describe('figurePoseAt — 캐릭터 동작표', () => {
  it('칸 번호로 고르고 표 끝을 넘으면 마지막 동작에 머문다', () => {
    const 동작 = [0, 4, 5, 6, 7, 7]
    expect(figurePoseAt(동작, 0)).toBe(0)
    expect(figurePoseAt(동작, 2)).toBe(5)
    expect(figurePoseAt(동작, 40)).toBe(7)
  })
})

describe('훈련 연출 표', () => {
  it('타자편 다섯 칸 모두 원본 연출이 붙어 있다', () => {
    expect(TRAINING_MENUS.map((menu) => menu.id)).toEqual(['히트', '파워', '수비', '주루', '필살타법'])
    const 빠진항목 = TRAINING_MENUS.filter((menu) => TRAINING_PRESENTATION_OF[menu.id] === undefined)
    expect(빠진항목).toEqual([])
  })

  it('수비·주루는 선수가 연출 그림 안에 있어 캐릭터를 따로 겹치지 않는다', () => {
    expect(TRAINING_PRESENTATION_OF.수비.figure).toBeNull()
    expect(TRAINING_PRESENTATION_OF.주루.figure).toBeNull()
    expect(TRAINING_PRESENTATION_OF.히트.figure?.offsetX).toBe(0x34)
  })
})

/**
 * 예전에는 타격형 표(0xd49e8 · 0xd4a48)만 있어서 장타형 선수도 타격형 동작으로 움직였다.
 * 원본은 선수 기록 +0xb 의 윗 3비트로 표를 가른다 (F-6 · 5-3 확정).
 */
describe('장타형 동작표 (0xd4a18 · 0xd4a6c)', () => {
  const 히트 = TRAINING_PRESENTATION_OF.히트.figure
  const 파워 = TRAINING_PRESENTATION_OF.파워.figure

  it('히트·모든능력치 표는 타격형이 0→4, 장타형이 0→5 로 시작한다', () => {
    expect(figurePosesOf(히트!, 0)).toEqual([0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12])
    expect(figurePosesOf(히트!, 1)).toEqual([0, 5, 6, 7, 8, 9, 10, 11, 11, 11, 11, 11])
  })

  it('파워 표도 장타형이 한 칸씩 늦다', () => {
    expect(figurePosesOf(파워!, 0)).toEqual([0, 4, 5, 6, 7, 7, 7, 7, 7])
    expect(figurePosesOf(파워!, 1)).toEqual([0, 5, 6, 7, 8, 8, 8, 8, 8])
  })

  it('필살타법은 칸 4 라 히트와 같은 표를 쓴다', () => {
    expect(figurePosesOf(TRAINING_PRESENTATION_OF.필살타법.figure!, 1)).toEqual(figurePosesOf(히트!, 1))
  })

  it('윗 3비트가 0 이 아니면 전부 장타형이다 (0x84a3c)', () => {
    expect(figurePosesOf(히트!, 2)).toEqual(figurePosesOf(히트!, 1))
  })
})

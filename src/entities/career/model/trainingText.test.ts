import { describe, expect, it } from 'vitest'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { createCareer } from '@/entities/career/model/playerCareer'
import { trainingBlockTextOf, trainingOutcomeLinesOf } from '@/entities/career/model/trainingText'
import type { TrainingOutcome } from '@/entities/career/model/training'

const 결과 = (overrides: Partial<TrainingOutcome> = {}): TrainingOutcome => ({
  menuId: '히트',
  gains: { hit: 5 },
  typeBonus: 1,
  moraleLoss: 6,
  rolledGain: 4,
  rolledMoraleLoss: 6,
  specialSwing: null,
  career: createCareer('테스트'),
  ...overrides,
})

describe('훈련 알림 문구', () => {
  it('능력치 훈련은 상승·타입 보너스·사기를 **줄로 나눠** 준다', () => {
    // 타입 보너스 줄 — "!cFFFFFF[!cFFFF00" + 타입 이름 + "!cFFFFFF]" + " " + StrMODE[194] (0x17f5c 18750~187e0)
    expect(trainingOutcomeLinesOf(결과(), '타격형')).toEqual([
      '히트 +5 상승하였습니다', '!cFFFFFF[!cFFFF00타격형!cFFFFFF] 타입 보너스 +1', '사기 -6',
    ])
    expect(trainingOutcomeLinesOf(결과({ typeBonus: 0 }))).toEqual(['히트 +5 상승하였습니다', '사기 -6'])
  })

  it('한 줄이 메시지 칸(170px)을 넘지 않는다 — 넘치면 원본이 잘라 버린다', () => {
    // 11px 글자 기준으로 한 줄에 대략 24자까지 들어간다. 그보다 길면 화면에서 잘린다
    const 최대글자수 = 24
    const 모든줄 = [
      ...trainingOutcomeLinesOf(결과(), '타격형'),
      ...trainingOutcomeLinesOf(결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 4, required: 4, isLevelUp: true, name: '토네이도스윙' } })),
    ]

    // 원문 글은 마크업("!N" 줄바꿈 · "!c" 색)을 품는다 — 화면에 그려지는 줄마다 잰다
    for (const line of 모든줄.flatMap((raw) => parseGameMarkup(raw).map((row) => row.segments.map((segment) => segment.text).join('')))) {
      expect(line.length, `너무 긴 줄입니다: ${line}`).toBeLessThanOrEqual(최대글자수)
    }
  })

  it('필살타법은 기술 이름(StrCOMMON[0x18 + n])으로 StrMODE[86] 횟수 또는 [87] 훈련 완료', () => {
    const 진행 = 결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 2, required: 4, isLevelUp: false, name: '파워 스윙' } })
    const 완료 = 결과({ menuId: '필살타법', gains: {}, typeBonus: 0, specialSwing: { sessions: 4, required: 4, isLevelUp: true, name: '파워 스윙' } })
    // StrMODE[86] sprintf · [87](앞 빈칸) 원문 그대로, 사기 줄은 [24] + " " + 수치 + " " + [84] (0x18196~0x1825e)
    expect(trainingOutcomeLinesOf(진행)).toEqual([
      '[!cFFFF00파워 스윙!cFFFFFF] !cFFFF002/4회!cFFFFFF 훈련', '사기 6 !cFF0000하락!cFFFFFF하였습니다',
    ])
    expect(trainingOutcomeLinesOf(완료)).toEqual([
      '파워 스윙 훈련 완료!!N[!cFFFF00선수정보!cFFFFFF]에서 사용!N여부 변경 가능', '사기 6 !cFF0000하락!cFFFFFF하였습니다',
    ])
  })

  it('거절 문구는 원문 (StrMODE[193]·[192])', () => {
    expect(trainingBlockTextOf('사기부족', '히트')).toBe('사기가 0일 때는!N훈련을 할 수 없습니다')
    expect(trainingBlockTextOf('능력치최대', '수비')).toBe('[!cFFFF00수비!cFFFFFF] 능력치가 최대입니다')
  })
})

describe('훈련 막힘 글 — 훈련완료', () => {
  it('StrMODE[63] "이미 훈련 완료된 스킬입니다" 다 (필살타법 창 0x17828 의 [63])', () => {
    expect(trainingBlockTextOf('훈련완료', '필살타법')).toBe('이미 훈련 완료된 스킬입니다')
  })
})

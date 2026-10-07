import { describe, expect, it } from 'vitest'
import { seasonCardAbilitiesOf, seasonCardInfoOf, seasonPlayerDetailViewOf } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonPlayerDetailContext } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'
import { seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'

/**
 * 시즌 능력치 상세 창 글 0x897e8 — 표 다섯 줄과 글 줄 (차례·문구·조건은 0x897e8~0x8a00c 를 직접 떴다).
 */

const 타자 = (patch: Partial<SeasonPlayerRecordView> = {}): SeasonPlayerRecordView => ({
  name: '시험타자', isPitcher: false, base: [500, 500, 500, 500], profile: 0, skillBits: 0,
  equipment: [0, 0, 0, 0], fieldPosition: 3, isComplete: true, ...patch,
})
const 투수 = (patch: Partial<SeasonPlayerRecordView> = {}) => 타자({ name: '시험투수', isPitcher: true, fieldPosition: 0, ...patch })

const 건강 = (patch: Partial<SeasonPlayerDetailContext['record']> = {}, teamMorale = 100): SeasonPlayerDetailContext => ({
  record: { illness: 0, illnessSlack: 0, coach: -1, ...patch }, teamMorale,
})

describe('표 다섯 줄 (0x872a0)', () => {
  it('현재 = 0xb6415(k, 0) · 최대 = 0x5e864 · 변화 = 0xb570c − 현재 · 사기 줄 = 팀 사기 / 100 / 0', () => {
    const { rows } = seasonPlayerDetailViewOf(타자({ profile: 0x20, equipment: [1, 0, 0, 0] }), 건강())
    expect(rows.map((row) => [row.current, row.maximum, row.change, row.bonus])).toEqual([
      [500, 800, 30, 0], // 장비 니블 1 → +30
      [500, 850, 0, 0],
      [500, 750, 0, 0],
      [500, 750, 0, 0],
      [100, 100, 0, 0],
    ])
  })

  it('⚠️ 시즌 창은 창+0x20 == 2 라 투수도 타자 이름표(336~339)로 뜬다 — 원본 그대로', () => {
    const { rows } = seasonPlayerDetailViewOf(투수(), 건강())
    expect(rows.map((row) => row.labelFrame)).toEqual([336, 337, 338, 339, 84])
  })

  it('변화 칸은 팀 능력치 보정이 빠진(0xb570c 마지막 인자 0) 시즌 내 팀 값 — 사기 정액 · 코치', () => {
    const { rows } = seasonPlayerDetailViewOf(타자(), 건강({ coach: 5 }, 40))
    // 사기 40 → −50, 코치 5(타자 히트 +8)
    expect(rows.slice(0, 4).map((row) => row.change)).toEqual([-42, -50, -50, -50])
  })
})

describe('글 줄 차례 (0x897e8)', () => {
  it('장비 줄 — "[!cFFFF00" + StrITEM[(n−1) + 11k (+44 투수)] + "!cFFFFFF] " + StrMODE[35+k|40+k] + " +" + 0xd41ae[n−1]', () => {
    expect(seasonPlayerDetailViewOf(타자({ equipment: [2, 5, 0, 0] }), 건강()).messages).toEqual([
      '[!cFFFF00라이트 헬멧!cFFFFFF] 히트 +50',
      '[!cFFFF00스피릿 배트!cFFFFFF] 파워 +110',
    ])
    expect(seasonPlayerDetailViewOf(투수({ equipment: [3, 0, 0, 0] }), 건강()).messages).toEqual([
      '[!cFFFF00스킬풀 모자!cFFFFFF] 제구 +70',
    ])
  })

  it('스킬 5 · 7 → 질병(SR+5) → 사기 ≤ 50 → 포지션 → 코치', () => {
    const view = 타자({ skillBits: (1 << 5) | (1 << 7), profile: 1, fieldPosition: 3 })
    expect(seasonPlayerDetailViewOf(view, 건강({ illness: 2, coach: 9 }, 50)).messages).toEqual([
      '[!cFFFF00무력감!cFFFFFF] 모든능력치 -100',
      '[!cFFFF00전설!cFFFFFF] 모든능력치 +50',
      '[!cFFFF00질병!cFFFFFF] 모든능력치 30% 감소',
      '[!cFFFF00사기!cFFFFFF] 모든능력치 50 감소',
      '[!cFFFF00포지션!cFFFFFF]불일치: 수비 20% 감소',
      '[!cFFFF00코치!cFFFFFF] !cFFFF00팀 타자 히트/파워 +7',
    ])
  })

  it('사기 줄 숫자는 정액 — >30 50 · >10 100 · 그 밖 200, 51 이상이면 줄이 없다', () => {
    const 사기줄 = (morale: number) => seasonPlayerDetailViewOf(타자(), 건강({}, morale)).messages
    expect(사기줄(51)).toEqual([])
    expect(사기줄(31)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 50 감소'])
    expect(사기줄(30)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 100 감소'])
    expect(사기줄(10)).toEqual(['[!cFFFF00사기!cFFFFFF] 모든능력치 200 감소'])
  })

  it('⚠️ 질병 줄은 SR+5 를 보고 −30% 는 SR+6 을 본다 — 입원 여유가 0 이면 줄만 있고 변화가 없다', () => {
    const view = seasonPlayerDetailViewOf(타자(), 건강({ illness: 1, illnessSlack: 0 }))
    expect(view.messages).toEqual(['[!cFFFF00질병!cFFFFFF] 모든능력치 30% 감소'])
    expect(view.rows[0]?.change).toBe(0)
    expect(seasonPlayerDetailViewOf(타자(), 건강({ illness: 1, illnessSlack: 3 })).rows[0]?.change).toBe(-150)
  })

  it('포지션 줄은 타자만 — 지명(1)·후보(0)·10 · 내야 보직 2~6 · 외야 보직 7~9 · 스킬 21 이면 없다', () => {
    const 줄 = (patch: Partial<SeasonPlayerRecordView>) => seasonPlayerDetailViewOf(타자(patch), 건강()).messages
    expect(줄({ profile: 0, fieldPosition: 6 })).toEqual([])
    expect(줄({ profile: 1, fieldPosition: 9 })).toEqual([])
    expect(줄({ profile: 1, fieldPosition: 1 })).toEqual([])
    expect(줄({ profile: 0, fieldPosition: 7, skillBits: 1 << 21 })).toEqual([])
    expect(줄({ profile: 2, fieldPosition: 3 })).toEqual(['[!cFFFF00포지션!cFFFFFF]불일치: 수비 20% 감소'])
    expect(seasonPlayerDetailViewOf(투수({ profile: 0, fieldPosition: 7 }), 건강()).messages).toEqual([])
  })

  it('코치 줄은 0~4 면 투수만 · 5~9 면 타자만 — StrMODE[149 + 코치]', () => {
    expect(seasonPlayerDetailViewOf(투수(), 건강({ coach: 0 })).messages).toEqual(['[!cFFFF00코치!cFFFFFF] !cFFFF00팀 투수 변화 +8'])
    expect(seasonPlayerDetailViewOf(타자(), 건강({ coach: 0 })).messages).toEqual([])
    expect(seasonPlayerDetailViewOf(투수(), 건강({ coach: 5 })).messages).toEqual([])
  })
})

describe('카드 도형 0x7ba44 시즌 갈래', () => {
  it('값은 실효값, 견줄 기본값은 0xb6415(k, 0)', () => {
    expect(seasonCardAbilitiesOf(타자({ equipment: [0, 1, 0, 0] }), 건강({}, 20))).toEqual([
      { base: 500, shown: 400 },
      { base: 500, shown: 430 },
      { base: 500, shown: 400 },
      { base: 500, shown: 400 },
    ])
  })
})

describe('정보 칸 0x7c450 시즌 · 0xd9 갈래 — seasonCardInfoOf', () => {
  it('타자: 타입 +0xb>>5 · 보직 +0xb&3 · 손 (+0xb>>4)&1 · 피부 (+0xb&0xc)/4 · 타순 (+0xa&0x1f)+1, 필살은 표 +0x18 = 0 이라 빈칸', () => {
    const view = { ...seasonPlayerRecordOf(0, tableRosterOf(0).batters[0]!, false, 0), profile: 17 }
    expect(seasonCardInfoOf(view, '서울 드래곤즈', 3)).toEqual({
      values: ['서울 드래곤즈', view.name, '타격형', '', '외야', '좌타', '황인'],
      battingOrder: 4,
    })
  })

  it('투수: 타입·손은 +2 칸, 보직은 min(r, 1) + 2 · 타순 없음', () => {
    const view = { ...seasonPlayerRecordOf(0, tableRosterOf(0).pitchers[0]!, true, 0), profile: 0b0010_0110 }
    expect(seasonCardInfoOf(view, 'T', 0)).toEqual({
      values: ['T', view.name, '사이드암', '', '구원', '우완', '백인'],
      battingOrder: null,
    })
  })
})

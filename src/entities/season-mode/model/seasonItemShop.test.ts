import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  applySeasonGpItem, applySeasonSubItem, checkSeasonGpItem, checkSeasonSubItem, seasonGamePointAfter, seasonGpItemPriceOf,
} from '@/entities/season-mode/model/seasonItemShop'

const 레코드 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({ ...startNewSeason(0, '테스터').record, ...덮어쓰기 })
const 고정난수 = (value: number) => ({ next: () => value })

describe('시즌 서브아이템 상점 0xdc 종류 1 — 키 0x957c · 적용 0x7d90 결과 0xc', () => {
  it('가드 차례 — 보유 [78] → 소지금 (값 × 10 > 소지금) [77] → 확인 [79]', () => {
    const 가진 = 레코드({ money: 9999, trainingSubItems: [true, false, false, false] })
    expect(checkSeasonSubItem(가진, 0)).toEqual({ ok: false, notice: expect.stringContaining('이미 가지고 있는') })
    expect(checkSeasonSubItem(레코드({ money: 249 }), 0)).toEqual({ ok: false, notice: expect.stringContaining('소지금이 부족') })
    const 확인 = checkSeasonSubItem(레코드({ money: 250 }), 0)
    expect(확인.ok && 확인.question).toContain('소지금 2억5000')
  })

  it('적용 — 소지금 − 값 × 10, SR[0x58 + k] = 1 (k 4 자동안마기 · 5~9 외출), 글 [92]', () => {
    const 산뒤 = applySeasonSubItem(레코드({ money: 300 }), 4)
    expect(산뒤.record.money).toBe(150)
    expect(산뒤.record.massager).toBe(true)
    expect(산뒤.notice).toContain('구매 완료')
    expect(applySeasonSubItem(레코드({ money: 300 }), 7).record.outingSubItems[2]).toBe(true)
  })
})

describe('시즌 GP 상점 0xdc 종류 2 — 가드 0x98ba~0x9a00 · 효과 0xa310c', () => {
  const 입력 = (record: SeasonRecord, gamePoint = 9999, teamMorale = 50) => ({ record, teamMorale, gamePoint })

  it('값 0xcbbe3 × 100 — G 부족 [65] 이 가장 먼저, 칸 7 이상은 아무것도 안 한다', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(seasonGpItemPriceOf)).toEqual([300, 300, 500, 500, 1000, 2000, 2000])
    expect(checkSeasonGpItem(입력(레코드(), 299), 0)).toEqual({ ok: false, notice: expect.stringContaining('G포인트가 부족') })
    expect(checkSeasonGpItem(입력(레코드()), 7)).toBeNull()
  })

  it('칸별 가드 — 5 트레이드 미사용 [176] · 1 사기 100 [91] · 4 이글아이 > 98 [210] · 2 건강 [208] · 6 매점 [217]', () => {
    expect(checkSeasonGpItem(입력(레코드({ tradeUsed: 0 })), 5)).toMatchObject({ ok: false, notice: expect.stringContaining('트레이드') })
    expect(checkSeasonGpItem(입력(레코드({ tradeUsed: 1 })), 5)).toMatchObject({ ok: true })
    expect(checkSeasonGpItem(입력(레코드(), 9999, 100), 1)).toMatchObject({ ok: false, notice: expect.stringContaining('사기 최고') })
    expect(checkSeasonGpItem(입력(레코드({ aimVisionGames: 99 })), 4)).toMatchObject({ ok: false })
    expect(checkSeasonGpItem(입력(레코드({ illness: 0 })), 2)).toMatchObject({ ok: false, notice: expect.stringContaining('건강한') })
    expect(checkSeasonGpItem(입력(레코드({ storeGames: 3 })), 6)).toMatchObject({ ok: false, notice: expect.stringContaining('구내매점') })
  })

  it('이글아이 확인 글은 [224] + "!N!N" + [82]', () => {
    const 확인 = checkSeasonGpItem(입력(레코드({ aimVisionGames: 98 })), 4)
    expect(확인 !== null && 확인.ok && 확인.question).toMatch(/^!C최대 99회 누적 가능합니다!N!N!C!cFFFF001000 G포인트/)
  })

  it('복권 — rand(0,10000) 이 누적표 [2,7,15,30,55,90,100] × 100 을 처음 넘는 칸, 1등 1억(+100) · 꽝은 영지버섯(사기 +40)', () => {
    const 일등 = applySeasonGpItem(레코드({ money: 0 }), 50, 0, 고정난수(0))
    expect(일등.record.money).toBe(100)
    expect(일등.notice).toBe('!C1등 당첨!!!N[!cFFFF001억!cFFFFFF] 획득!')
    const 이등 = applySeasonGpItem(레코드({ money: 0 }), 50, 0, 고정난수(0.05))
    expect(이등.notice).toContain('2등 당첨!!!N[!cFFFF005000만')
    const 꽝 = applySeasonGpItem(레코드({ money: 0 }), 80, 0, 고정난수(0.95))
    expect(꽝.record.money).toBe(0)
    expect(꽝.teamMorale).toBe(100)
    expect(꽝.notice).toContain('우정상당첨!!!N[!cFFFF00영지버섯')
  })

  it('효과 — 치료(SR+5·6 = 0, 쿨다운 20) · 이글아이 +20(상한 99, 글은 늘어난 값) · 협회허가증 · 구내매점 45', () => {
    const 치료 = applySeasonGpItem(레코드({ illness: 2, illnessSlack: 3 }), 50, 2, 고정난수(0))
    expect(치료.record).toMatchObject({ illness: 0, illnessSlack: 0, illnessCooldown: 20 })
    const 이글 = applySeasonGpItem(레코드({ aimVisionGames: 90 }), 50, 4, 고정난수(0))
    expect(이글.record.aimVisionGames).toBe(99)
    expect(이글.notice).toContain('99게임')
    expect(applySeasonGpItem(레코드({ tradeUsed: 1 }), 50, 5, 고정난수(0)).record.tradeUsed).toBe(0)
    expect(applySeasonGpItem(레코드(), 50, 6, 고정난수(0)).record.storeGames).toBe(45)
  })

  it('G 는 0..99999 로 자른다', () => {
    expect(seasonGamePointAfter(1000, 4)).toBe(0)
    expect(seasonGamePointAfter(5000, 0)).toBe(4700)
  })
})

import { describe, expect, it } from 'vitest'
import {
  BURST_MODE,
  BURST_ROW_COUNTS,
  BURST_TABLES,
  SEASON_BATTING_ROWS,
  SEASON_FIELDING_ROWS,
  burstRowsFor,
} from '@/entities/burst-mission/model/burstMissionRow'
import { BURST_GOAL, judgeBurstGoal } from '@/entities/burst-mission/model/burstMissionJudge'
import { BURST_RESULT_BIT } from '@/entities/burst-mission/model/burstResultBits'
import type { BurstTriggerContext } from '@/entities/burst-mission/model/burstMissionTrigger'
import {
  ACE_BATTER_SITUATIONS,
  ACE_PITCHER_SITUATIONS,
  BURST_SITUATION,
  isRowEligible,
} from '@/entities/burst-mission/model/burstMissionTrigger'
import { createBurstSession, resolveBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 원본 표(`Xls{BATTER,PITCHER,SEASON}_BURST`)를 **그대로 두고** 보는 검사다.
 * 규칙 자체를 보는 검사는 손수 만든 행을 쓰는 다른 파일들에 있다.
 */

const 모든행 = [...BURST_TABLES.BATTER, ...BURST_TABLES.PITCHER, ...BURST_TABLES.SEASON]

/** 늘 통과하는 주사위 — `rand(0,1000)` 이 0 이 되어 0 < b9 면 언제나 발동한다 */
const 항상통과난수: RandomPort = {
  next: () => 0,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
}

const 상황 = (patch: Partial<BurstTriggerContext> = {}): BurstTriggerContext => ({
  isHumanTeamBatting: true,
  bases: { first: false, second: false, third: false },
  outs: 0,
  inning: 0,
  ourScore: 0,
  opponentScore: 0,
  opponentBattingSlot: 0,
  opponentAceBatterId: null,
  opponentAcePitcherId: null,
  hitsInGame: 0,
  homeRunsInGame: 0,
  strikeoutsInGame: 0,
  ...patch,
})

describe('원본 돌발미션 표 검산', () => {
  it('타자 40 · 투수 44 · 시즌 56행이고 대사도 같은 수만큼 있다', () => {
    for (const [name, count] of Object.entries(BURST_ROW_COUNTS)) {
      const table = ORIGINAL_BURST_TABLES[name as keyof typeof BURST_ROW_COUNTS]

      expect(table.rowBytes, name).toHaveLength(count)
      expect(table.lines, name).toHaveLength(count)
      expect(table.rowBytes.every((bytes) => bytes.length === 16), name).toBe(true)
    }
  })

  it('b0 상황은 0·1·2 아니면 마선수 번호(10~22)뿐이다', () => {
    const 아는상황 = new Set([
      ...Object.values(BURST_SITUATION),
      ...Object.keys(ACE_BATTER_SITUATIONS).map(Number),
      ...Object.keys(ACE_PITCHER_SITUATIONS).map(Number),
    ])

    expect(모든행.filter((row) => !아는상황.has(row.situation))).toEqual([])
  })

  it('b8 목표는 점프표 안(0~9)이고, 이름을 모르는 5·10 은 한 행도 쓰지 않는다', () => {
    const 쓰인목표 = new Set(모든행.map((row) => row.goal))

    expect([...쓰인목표].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9])
    expect(쓰인목표.has(BURST_GOAL.없음)).toBe(false)
    expect(쓰인목표.has(BURST_GOAL.미상10)).toBe(false)
  })

  it('조건 칸이 원본이 읽는 범위 안이다 — 주자 −1·0·1, 아웃 −1~2, 확률 1~100%', () => {
    for (const row of 모든행) {
      expect(row.bases.every((want) => want >= -1 && want <= 1), `주자 ${row.bases}`).toBe(true)
      expect(row.outs, `아웃 ${row.outs}`).toBeGreaterThanOrEqual(-1)
      expect(row.outs, `아웃 ${row.outs}`).toBeLessThanOrEqual(2)
      expect(row.chancePercent, `확률 ${row.chancePercent}`).toBeGreaterThan(0)
      expect(row.chancePercent, `확률 ${row.chancePercent}`).toBeLessThanOrEqual(100)
      expect(row.recordKind, `기록 종류 ${row.recordKind}`).toBeLessThanOrEqual(3)
    }
  })

  it('보상·페널티 종류는 1 사기·2 인기도·3 평판·4 소지금 아니면 0(없음)이다', () => {
    const kinds = 모든행.flatMap((row) => [
      row.successRewards[0].kind,
      row.successRewards[1].kind,
      row.failurePenalty.kind,
    ])

    expect([...new Set(kinds)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
  })

  it('시즌 표는 앞쪽 31행이 공격 목표, 뒤쪽 25행이 수비 목표다 (0x8f000 의 반 가르기와 맞다)', () => {
    const 공격 = burstRowsFor(BURST_MODE.시즌, true)
    const 수비 = burstRowsFor(BURST_MODE.시즌, false)

    expect(공격).toHaveLength(SEASON_BATTING_ROWS.to - SEASON_BATTING_ROWS.from + 1)
    expect(수비).toHaveLength(SEASON_FIELDING_ROWS.to - SEASON_FIELDING_ROWS.from + 1)
    expect(공격.every((row) => row.goal <= BURST_GOAL.번트)).toBe(true)
    expect(수비.every((row) => row.goal >= BURST_GOAL.아웃)).toBe(true)
  })

  it('대사가 CP949 로 제대로 읽혔다 — 행마다 4줄이 다 차 있고 한글이 들어 있다', () => {
    const 한글 = /[가-힣]/

    for (const [name, table] of Object.entries(ORIGINAL_BURST_TABLES)) {
      for (const [index, lines] of table.lines.entries()) {
        expect(lines, `${name} ${index}행`).toHaveLength(4)
        for (const line of lines) {
          expect(line.text, `${name} ${index}행`).not.toBe('')
          expect(한글.test(line.text), `${name} ${index}행: ${line.text}`).toBe(true)
          // 깨진 바이트가 남으면 cp949 디코더가 U+FFFD 를 넣는다
          expect(line.text.includes('�'), `${name} ${index}행: ${line.text}`).toBe(false)
        }
      }
    }
  })

  it('제안 대사가 목표와 맞는다 — 투수 표 0~2행은 삼진, 시즌 1행은 홈런이다', () => {
    // 줄 0 이 제안 대사다 (성공 1 · 실패 2 · 무효 3 — BURST_TEXT_LINE)
    const 제안 = 0

    expect(ORIGINAL_BURST_TABLES.PITCHER.lines[0][제안].text).toContain('삼진')
    expect(BURST_TABLES.PITCHER[0].goal).toBe(BURST_GOAL.삼진)
    expect(ORIGINAL_BURST_TABLES.SEASON.lines[1][제안].text).toContain('홈런')
    expect(BURST_TABLES.SEASON[1].goal).toBe(BURST_GOAL.홈런)
    expect(ORIGINAL_BURST_TABLES.PITCHER.lines[43][제안].text).toContain('고의사구')
    expect(BURST_TABLES.PITCHER[43].goal).toBe(BURST_GOAL.고의사구)
  })
})

describe('원본 표로 실제 발동이 난다', () => {
  it('타자 표 — 1안타 친 뒤 무사 주자 없음이면 0행("멀티히트")이 후보가 된다', () => {
    const session = createBurstSession(BURST_MODE.나리타자)
    // 주자·기록 조건이 하나도 없는 행은 타자 표에 없다. 0행은 b6·b7 = "이번 경기 1안타" 를 본다
    const context = 상황({ hitsInGame: 1 })

    const 후보 = BURST_TABLES.BATTER.filter((row) => isRowEligible(row, context))
    const 발동 = tryTriggerBurst(session!, context, 항상통과난수)

    expect(후보.length).toBeGreaterThan(0)
    expect(발동.current).not.toBeNull()
    expect(발동.triggeredCount).toBe(1)
  })

  it('경기당 한 번뿐이다 — 이미 발동했으면 다음 타석에는 안 난다', () => {
    const context = 상황({ hitsInGame: 1 })
    const 한번 = tryTriggerBurst(createBurstSession(BURST_MODE.나리타자)!, context, 항상통과난수)
    const 끝난뒤 = resolveBurst(한번, BURST_RESULT_BIT.아웃).session

    expect(한번.current).not.toBeNull()
    expect(끝난뒤.current).toBeNull()
    expect(tryTriggerBurst(끝난뒤, context, 항상통과난수).current).toBeNull()
  })

  it('시즌 표 — 수비 중이면 수비 목표(6~9)만 걸린다', () => {
    const session = createBurstSession(BURST_MODE.시즌)
    const context = 상황({ isHumanTeamBatting: false })

    const 발동 = tryTriggerBurst(session!, context, 항상통과난수)

    expect(발동.current).not.toBeNull()
    expect(발동.current!.goal).toBeGreaterThanOrEqual(BURST_GOAL.아웃)
  })

  it('마투수 상황 행(b0 19 드래고나)은 그 투수를 만나야 후보가 된다', () => {
    const row = BURST_TABLES.BATTER[38]

    expect(row.situation).toBe(19)
    expect(isRowEligible(row, 상황())).toBe(false)
    expect(isRowEligible(row, 상황({ opponentAcePitcherId: 'dragona' }))).toBe(true)
  })
})

describe('원본 표 행으로 목표 판정이 돈다', () => {
  it('타자 표 0행(안타) — 단타로 출루하면 성공, 삼진이면 실패다', () => {
    const row = BURST_TABLES.BATTER[0]

    expect(row.goal).toBe(BURST_GOAL.안타)
    expect(judgeBurstGoal(row.goal, BURST_RESULT_BIT.단타 | BURST_RESULT_BIT.출루)).toBe('성공')
    expect(judgeBurstGoal(row.goal, BURST_RESULT_BIT.삼진 | BURST_RESULT_BIT.아웃)).toBe('실패')
  })

  it('투수 표 0행(삼진) — 삼진이면 성공하고 보상이 붙는다', () => {
    const 발동 = tryTriggerBurst(
      createBurstSession(BURST_MODE.나리투수)!,
      상황({ strikeoutsInGame: BURST_TABLES.PITCHER[0].recordCount }),
      항상통과난수,
    )
    const 결과 = resolveBurst(발동, BURST_RESULT_BIT.삼진 | BURST_RESULT_BIT.아웃)

    expect(결과.judgement).toBe('성공')
    expect(결과.deltas.length).toBeGreaterThan(0)
  })

  it('모든 행의 목표가 실제로 판정을 낸다 — 판정표 밖으로 새는 행이 없다', () => {
    const 아무결과 = BURST_RESULT_BIT.아웃

    expect(모든행.filter((row) => judgeBurstGoal(row.goal, 아무결과) === null)).toEqual([])
  })
})

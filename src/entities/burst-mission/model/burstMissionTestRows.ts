import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'

/**
 * 테스트용 행 만들기.
 *
 * 판정·발동 **규칙**은 조건 하나씩만 켠 손수 만든 행으로 검사한다. 여기 값들은 원본 데이터가
 * 아니라 규칙을 확인하기 위한 표본이다 — 원본 표(`BURST_TABLES`) 자체를 두고 보는 검사는
 * `burstMissionTable.test.ts` 에 따로 있다.
 */
export function 행(patch: Partial<BurstMissionRow> = {}): BurstMissionRow {
  return {
    index: 0,
    situation: 0,
    bases: [-1, -1, -1],
    outs: -1,
    scoreDifference: 0,
    recordKind: 0,
    recordCount: 0,
    goal: 0,
    chancePercent: 100,
    successRewards: [
      { kind: 0, amount: 0 },
      { kind: 0, amount: 0 },
    ],
    failurePenalty: { kind: 0, amount: 0 },
    ...patch,
  }
}

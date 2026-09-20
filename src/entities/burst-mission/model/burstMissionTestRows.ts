import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'

/**
 * 테스트용 행 만들기.
 *
 * 원본 표(`XlsBATTER_BURST` 등)가 아직 저장소에 없어서(`burstMissionRow.ts` 의 `BURST_TABLES` 주석)
 * 판정·발동 규칙은 **손으로 만든 행**으로 검사한다. 여기 값들은 원본 데이터가 아니라
 * 규칙을 확인하기 위한 표본이다 — 표가 들어오면 이 파일은 그대로 두고 표 대조 테스트를 따로 더한다.
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

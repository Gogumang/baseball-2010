import { DOUBLE_PLAY_OUTS } from '@/entities/career/model/gameEvaluation/atBat/popularityPoints'
import type { AtBatOutcome } from '@/entities/career/model/gameEvaluation/otherSlices'

export interface AtBatPenaltyInput {
  readonly outcome: AtBatOutcome
  readonly outsInPlay: number
  readonly runsBattedIn: number
  readonly isWalkOff: boolean
  /**
   * **플레이가 끝난 뒤** 2루에 산 주자가 서 있는가 (확정, 2026-10 r87 직접 뜸). 평가 함수 0xa59c0 은 판 끝 정산 0xa8024 의
   * a8c2a 하나에서만 불리고, 그 꼬리 a5ace~a5ae8 이 `아웃 > 0` 이면 `0xa97a1(ctx+0x14 주자 목록, 2)` — 아웃 아닌(+0x96 == 0)
   * 주자 중 마지막으로 닿은 루(+0x8c)가 2 인 첫 주자 — 가 있을 때 G+0x11c 를 올린다. 정산 시점의 +0x8c 라 플레이 뒤 기준이다
   * (1루에서 2루로 간 주자는 세고, 2루에서 3루로 간 주자 · 2루에서 죽은 주자는 안 센다)
   */
  readonly hadSecondBaseRunner: boolean
}

/** 홈런이거나 "끝내기 + 득점" 이면 0xa59c0 이 감점 칸 앞에서 끝난다 */
const endsBeforePenalties = (input: AtBatPenaltyInput) => input.outcome.kind === '홈런' || (input.isWalkOff && input.runsBattedIn > 0)

/**
 * 평판 감점용 카운터 증가분 (0xa5ab2~0xa5aea, R7 1a 확정).
 * 홈런이거나 "끝내기 + 득점" 이면 그 앞에서 함수가 끝나므로 둘 다 세지 않는다. 그 밖에는:
 *   - 병살 G+0x118: **안타가 아닐 때** 아웃 > 1 이면 센다 (득점이 있어도 센다)
 *   - 득점권 아웃 G+0x11c: **안타여도** 아웃 > 0 이고 판이 끝난 뒤 2루에 산 주자가 있으면 센다 (a5ace~a5ae8)
 * 앞서 웹은 "타점도 끝내기도 없을 때만" 으로 조건을 좁게 잡고 있었다.
 */
export function atBatPenaltyCounts(input: AtBatPenaltyInput): { doublePlays: number; scoringPositionOuts: number } {
  if (endsBeforePenalties(input)) return { doublePlays: 0, scoringPositionOuts: 0 }
  const isHit = input.outcome.kind === '안타'
  return {
    doublePlays: !isHit && input.outsInPlay >= DOUBLE_PLAY_OUTS ? 1 : 0,
    scoringPositionOuts: input.outsInPlay > 0 && input.hadSecondBaseRunner ? 1 : 0,
  }
}

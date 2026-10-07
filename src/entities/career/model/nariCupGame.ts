/**
 * 나리 국가대항전 사람 경기의 승패 — 경기 끝 정산 0x4ea0c 의 모드 3·4 갈래(4f072~4f136, 직접 떴다). 타자편·투수편 공용.
 *
 * ```
 * 4f078  s1 = 0xb69b1(st, 1)                      ; 측 1(후공·말) 점수 (s8 st+0x7e+측)
 * 4f082  s0 = 0xb69b1(st, 0)                      ; 측 0(선공·초) 점수
 * 4f09a  if s1 > s0:  0xb76dd(L, 0xb6bdd(st, 1)) ; 승 = 측 1 의 팀 (st+0x28+측)
 *                     0xb77e1(L, 0xb6bdd(st, 0)) ; 패 = 측 0 의 팀
 * 4f114  else:        0xb76dd(L, 0xb6bdd(st, 0)) ; 승 = 측 0 의 팀 — **동점 포함**
 *                     0xb77e1(L, 0xb6bdd(st, 1))
 * ```
 * 곧 **동점이면 선공(측 0) 팀이 이긴다** — 대회 중이면 0xb76dd/0xb77e1 이 4국 승패(L+0xb0/L+0xb4)와 결승 날 우승국(L+0xc4)으로 간다.
 * 풀리그는 대한민국이 늘 후공이라 동점이면 대한민국 패, 결승에서 대한민국이 2위(선공)면 동점이면 대한민국 승이다.
 * 원본 경기는 연장 상한이 없어(경기 끝 0xb68fc) 동점으로 끝나지 않지만, 웹 경기는 30회 상한(`MAXIMUM_INNINGS`)이 있어 날 수 있다 —
 * 그때도 원본 비교식 그대로 가른다.
 */
export interface NariCupGameScore {
  /** 내 팀(대한민국)이 앉은 측 — 0 선공 · 1 후공 (`nationalCupSideOf`) */
  readonly mySide: number
  readonly myTeam: number
  readonly opponentTeam: number
  readonly myScore: number
  readonly opponentScore: number
}

export interface NariCupGameResult {
  readonly winner: number
  readonly loser: number
}

/** 4f09a 의 비교 — 측 1 점수가 더 많을 때만 측 1 승, 그 밖(동점 포함)은 측 0 승 */
export function nariCupGameResultOf(score: NariCupGameScore): NariCupGameResult {
  const iAmLastBat = score.mySide === 1
  const lastBatScore = iAmLastBat ? score.myScore : score.opponentScore
  const firstBatScore = iAmLastBat ? score.opponentScore : score.myScore
  const lastBatTeam = iAmLastBat ? score.myTeam : score.opponentTeam
  const firstBatTeam = iAmLastBat ? score.opponentTeam : score.myTeam
  return lastBatScore > firstBatScore
    ? { winner: lastBatTeam, loser: firstBatTeam }
    : { winner: firstBatTeam, loser: lastBatTeam }
}

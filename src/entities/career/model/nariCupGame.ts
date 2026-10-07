import { MAXIMUM_GAME_POINT } from '@/entities/career/model/playerCareer'

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
 * 원본 경기는 연장 상한이 없어(경기 끝 0xb68fc) 동점으로 끝나지 않는다 — 웹 경기도 같다(`gameState`, a875ace). 비교식은 원본 모양
 * 그대로 둔다.
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

/** 대회 경기 정산이 고치는 커리어 칸 — 타자편 `PlayerCareer` · 투수편 `PitcherCareer` 공용 */
interface NariCupGameCareerFields {
  readonly gamePoint: number
  readonly hasActedThisCycle: boolean
  readonly isInjured: boolean
  readonly injuredGamesPlayed: number
  readonly illnessCooldown: number
  /** 타자편만 — 이글아이 남은 경기(S+0x54) */
  readonly eagleEyeGamesRemaining?: number
}

/**
 * **대회 사람 경기의 커리어 몫** — 경기 끝 정산 0x4ea0c 가 모드를 가리지 않고(모드 5·6 만 빼고) 도는 줄 가운데 대회 경기에도
 * 닿는 것 (직접 떴다):
 * ```
 * 4ebaa~4ec7c  기록 달성 G = Σ 표 0xcfbf8[i] × 이번 경기 기록[i] → 전역 +0x64 (0~99999) · 0x22c7d(G, 모드) · 0x22e11
 * 4f156        S+4 = 0                                    ; 행동함 (모드 3·4 갈래, 대회도 지난다)
 * 4f344~4f372  0x1f8d5(저장, 모드) 레코드 +0x1b5 > 0 이면 +0x1b6 += 1   ; 부상 중 치른 경기 (모드 3·4)
 * 4f374~4f3b2  S+0x54 > 0 이면 −1(99 상한) · S+0x7c > 0 이면 −1   ; 이글아이 · 질병 쿨다운 (모드 2·3·4)
 * ```
 * 기록 G 는 0xa77f0 이 사람 팀 공·수로 거르므로 대회 경기도 쌓인다(0xa56dc 로 거르지 않는다 — R8 1절).
 * 리그 승패 · 평가 0xa719c(4f216 이 건너뛴다) · 내 기록 0xa8024(0xa56dc 거짓) · 경기 수는 안 고친다.
 * 4f2e8/4f304 의 열 팀 0xb617c 는 대회 중 0x1f989 가 상대국 칸 +0xbe0 을 돌려주는데, 그 칸은 바로 앞 하루 끝 0xb818d(b8216)가
 * 마스터에서 새로 복사한 10000 이라 바뀌는 것이 없다.
 */
export function settleNariCupGame<T extends NariCupGameCareerFields>(career: T, gamePointReward: number): T {
  return {
    ...career,
    gamePoint: Math.min(MAXIMUM_GAME_POINT, Math.max(0, career.gamePoint + gamePointReward)),
    hasActedThisCycle: false,
    injuredGamesPlayed: career.injuredGamesPlayed + (career.isInjured ? 1 : 0),
    illnessCooldown: Math.max(0, career.illnessCooldown - 1),
    ...(career.eagleEyeGamesRemaining === undefined
      ? {}
      : { eagleEyeGamesRemaining: Math.max(0, career.eagleEyeGamesRemaining - 1) }),
  }
}

import type { ReactNode } from 'react'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'
import { gameBranch, gameResultBranch } from '@/app/ui/pitcherLeagueRoute/branches/game'
import { matchPrepareBranch, nextGameStandingsBranch } from '@/app/ui/pitcherLeagueRoute/branches/matchPrepare'
import { eventBranch } from '@/app/ui/pitcherLeagueRoute/branches/event'
import { aceMatchBranch, nationalCupBranch, postseasonBranch } from '@/app/ui/pitcherLeagueRoute/branches/seasonEnd'
import { endingBranch } from '@/app/ui/pitcherLeagueRoute/branches/ending'
import { shopBranch } from '@/app/ui/pitcherLeagueRoute/branches/shop'
import { outingBranch } from '@/app/ui/pitcherLeagueRoute/branches/outing'
import { yearCoverBranch } from '@/app/ui/pitcherLeagueRoute/branches/yearCover'
import { managementOf } from '@/app/ui/pitcherLeagueRoute/managementScreen'

/** 장면 갈래 — 자기 장면(과 기다리는 재료)이 아니면 null 을 낸다 */
type PitcherBranch = (input: PitcherBranchInput) => ReactNode

/** 투수편 장면 0x106 의 갈래를 고르는 차례대로 — 이벤트 본문이 아직 없으면 뒤 갈래로 넘어가 끝내 관리 화면이다 */
const PITCHER_BRANCHES: readonly PitcherBranch[] = [
  gameBranch,
  gameResultBranch,
  nextGameStandingsBranch,
  matchPrepareBranch,
  eventBranch,
  aceMatchBranch,
  postseasonBranch,
  nationalCupBranch,
  endingBranch,
  shopBranch,
  outingBranch,
  yearCoverBranch,
]

/** 지금 장면의 화면 — 첫 갈래가 받은 그림, 아무도 안 받으면 105 관리 화면 */
export function pitcherBranchScreenOf(input: PitcherBranchInput): ReactNode {
  for (const branch of PITCHER_BRANCHES) {
    const screen = branch(input)
    if (screen !== null) return screen
  }
  return managementOf(input)
}

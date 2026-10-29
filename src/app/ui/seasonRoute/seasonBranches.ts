import type { ReactNode } from 'react'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'
import { eventPlaybackBranch } from '@/app/ui/seasonRoute/branches/eventPlayback'
import { managementMenuBranch, outingMapBranch, outingPlayBranch, teamMenuBranch, trainingBranch } from '@/app/ui/seasonRoute/branches/menus'
import { equipmentBranch } from '@/app/ui/seasonRoute/branches/equipment'
import { itemShopBranch, stadiumShopBranch, staminaPickBranch } from '@/app/ui/seasonRoute/branches/shop'
import { coachHireBranch, preGameAceBranch, tradeBranch } from '@/app/ui/seasonRoute/branches/squad'
import { entryEditBranch, matchInfoBranch, nextGameBranch } from '@/app/ui/seasonRoute/branches/matchInfo'
import { playerCardBranch, playerPickBranch } from '@/app/ui/seasonRoute/branches/playerPick'
import { recruitBranch } from '@/app/ui/seasonRoute/branches/recruit'
import { itemMenuBranch } from '@/app/ui/seasonRoute/branches/itemMenu'
import { ownedItemsBranch, recordRankBranch, seasonInfoBranch, teamInfoBranch } from '@/app/ui/seasonRoute/branches/seasonInfo'
import {
  dayResultBranch,
  endingBranch,
  incomeBranch,
  nationalCupBranch,
  seasonEndChainBranch,
  seasonSummaryBranch,
} from '@/app/ui/seasonRoute/branches/seasonEnd'
import { teamGameBranch } from '@/app/ui/seasonRoute/branches/teamGame'

/** 장면 갈래 — 자기 장면(과 기다리는 재료)이 아니면 null 을 낸다 */
type SeasonBranch = (input: SeasonBranchInput) => ReactNode

/**
 * 시즌 장면 0x105 의 갈래를 **고르는 차례**대로 — 같은 장면을 둘이 받으면 앞이 이긴다:
 * 0xdc 는 장비 창(0xdf 목적 1) → 서브·GP 창 → 구장 상점, 0xd7 은 경기 전 마선수 → 코치채용,
 * 0xdf 는 목적 1·2 고르기 → 선수영입(목적 3)
 */
const SEASON_BRANCHES: readonly SeasonBranch[] = [
  eventPlaybackBranch,
  managementMenuBranch,
  teamMenuBranch,
  equipmentBranch,
  itemShopBranch,
  staminaPickBranch,
  stadiumShopBranch,
  tradeBranch,
  preGameAceBranch,
  matchInfoBranch,
  entryEditBranch,
  coachHireBranch,
  playerPickBranch,
  playerCardBranch,
  recruitBranch,
  trainingBranch,
  outingMapBranch,
  outingPlayBranch,
  itemMenuBranch,
  teamInfoBranch,
  ownedItemsBranch,
  recordRankBranch,
  seasonInfoBranch,
  nationalCupBranch,
  seasonEndChainBranch,
  seasonSummaryBranch,
  endingBranch,
  dayResultBranch,
  incomeBranch,
  teamGameBranch,
  nextGameBranch,
]

/**
 * 지금 장면의 화면 — 첫 갈래가 받은 그림. 0x105 그리기 표의 시즌 상태는 갈래가 모두 받는다 — 아무도 안 받는 것은 갈래가 기다리는
 * 재료(이벤트 · 경기 · 고른 선수 따위)가 아직 없는 틀뿐이라, 빈 그리기 칸처럼 아무것도 안 그린다 (예전 웹 안내 "이 화면은 아직 없습니다" 는 원본에 없다)
 */
export function seasonBranchScreenOf(input: SeasonBranchInput): ReactNode {
  for (const branch of SEASON_BRANCHES) {
    const screen = branch(input)
    if (screen !== null) return screen
  }
  return null
}

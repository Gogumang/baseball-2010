import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { applyPitcherBurstRewards } from '@/entities/pitcher-career/model/pitcherBurstReward'
import { nationalCupMatchupOf, type NationalCup } from '@/entities/national-cup/model/nationalCup'
import { nextNariCupDayTeams, recordNariCupGame } from '@/entities/career/model/nariCupTeams'
import { settleNariCupGame } from '@/entities/career/model/nariCupGame'
import { nariMoraleAfterBurst } from '@/entities/career/model/nariMorale'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'

/**
 * 대회 하루를 넘긴 커리어 — 하루 끝 b8216 이 다음 날 사람 경기 상대를 +0xbe0 에 마스터에서 새로 복사한다. 대회 칸(L+0xa8~ · L+0x32)은
 * 정산 끝 0x4f3c4 가 저장한다. 경기 중 돌발 보상 0x8e34c(저장 없음 — 정산 저장이 함께 쓴다)를 먼저 얹는다. 사기는 대회 중이라 상대국
 * 칸 +2 에 쌓였다가 바로 아래 하루 끝 b8216 의 새 복사로 지워진다(원본 버그 그대로).
 * 대표팀 칸(+0xbc4)에 남는 것 먼저 (r221): +2 사기 — 0xb570c b5762 가 마지막으로 덮은 나리 사기(대회 중이라 상대국 칸 값,
 * 상대 칸 덮기와 같은 공), +0x2e 실책 — 사람 수비 그림 0x43278 이 대표팀 야수에 올린 것, +0x2a 사사구 — 내 투수 사본
 * (a8b04~a8bee). 그 뒤 하루 끝 b8216 이 상대국 칸만 새로 복사한다
 */
export function cupDaySettledCareerOf(
  current: PitcherCareer,
  next: NationalCup,
  summary: PitcherGameSummary,
  options: PitcherGameOptions,
  gamePointReward: number,
): PitcherCareer {
  const burstDeltas = summary.burstRewardDeltas ?? []
  const settled = { ...settleNariCupGame(applyPitcherBurstRewards(current, burstDeltas), gamePointReward), nationalCup: next }
  if (current.nariCupTeams === undefined) return settled
  const recorded = recordNariCupGame(current.nariCupTeams, {
    morale: summary.opponentRecordMorale ?? nariMoraleAfterBurst(options.teamMorale, burstDeltas),
    errors: summary.leagueErrors,
    myWalks: summary.seasonDelta.walks,
  })
  return { ...settled, nariCupTeams: nextNariCupDayTeams(recorded, nationalCupMatchupOf(next)?.opponent ?? null) }
}

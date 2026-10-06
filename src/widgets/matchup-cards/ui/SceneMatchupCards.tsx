import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { MatchupCards } from '@/widgets/matchup-cards/ui/MatchupCards'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/**
 * **상태 0xe 의 투수·타자 소개 판** — 0xe 그리기 0x4d9ec 가 모드 검사 없이 0x44944 를 부른다. 판의 틱은 0xe 의 틱
 * [장면+0x2c] 라 0xe 에 들어선 때 이 부품을 세우면 0 부터 센다 (팀경기·타자편·투수편·미션 공용 — 홈런더비는 따로 든다).
 */
export function SceneMatchupCards(props: {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}) {
  const tick = useUpdateCounter()
  return <MatchupCards tick={tick} {...props} />
}

import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { MatchupCards } from '@/widgets/matchup-cards/ui/MatchupCards'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/**
 * **상태 0xe 의 투수·타자 소개 판** — 0xe 그리기 0x4d9ec 가 모드 검사 없이 0x44944 를 부른다. 판의 틱은 0xe 의 틱
 * [장면+0x2c] 라 0xe 에 들어선 때 이 부품을 세우면 0 부터 센다 (팀경기·타자편·투수편·미션 공용 — 홈런더비는 따로 든다).
 * 공용 창이 서 있으면 52cc6 이 장면 틱을 건너뛰어 판도 선다(`useGameSceneUpdateCounter`).
 */
export function SceneMatchupCards(props: { readonly batterHand: number; readonly pitcher: MatchupPitcherCard; readonly batter: MatchupBatterCard }) {
  const tick = useGameSceneUpdateCounter()
  return <MatchupCards tick={tick} {...props} />
}

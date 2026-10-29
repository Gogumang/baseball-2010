import { LABEL, cardOriginsAt, pitcherRoleBadgeOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { useImgTextPalettes } from '@/shared/ui'
import * as styles from '@/widgets/matchup-cards/ui/MatchupCards.css'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/matchupCards/matchupCardTypes'
import { BatterCard } from '@/widgets/matchup-cards/ui/matchupCards/BatterCard'
import { PitcherCard } from '@/widgets/matchup-cards/ui/matchupCards/PitcherCard'

export type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/matchupCards/matchupCardTypes'

interface MatchupCardsProps {
  /** 상태 0xe 의 틱 [장면+0x2c] — 들어선 그림이 0 */
  readonly tick: number
  /** 0xb63c0(지금 타자) — 1 좌타 · 0 우타. 타자 판의 좌타/우타 글자도 이것이다 */
  readonly batterHand: number
  /** 장면 +0x17e1. 안 넘기면 `batterHand` (적재 8 이 같은 0xb63c0 으로 넣는다) */
  readonly side?: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}

/**
 * **투수·타자 소개 판 — 원본 `0x44944`** (경기 상태 0xe 그리기 `0x4d9ec` 의 마지막 함수).
 * 위에 투수 판, 아래에 타자 판이 양옆에서 밀려 들어온다 — 좌표·밀림·칸은 `matchupCardsLayout` 머리 주석 그대로다.
 * 상태 0xe 에 들어선 동안만 띄운다(0x44944 를 부르는 곳은 0x4d9ec 하나).
 */
export function MatchupCards({ tick, batterHand, side, pitcher, batter }: MatchupCardsProps) {
  const origins = cardOriginsAt(tick, batterHand, side)
  const pitcherLabel = pitcher.isComputer ? LABEL.computer : LABEL.player
  const batterLabel = batter.isComputer ? LABEL.computer : LABEL.player
  const roleBadge = pitcher.role === undefined ? null : pitcherRoleBadgeOf(pitcher.role, pitcherLabel)
  // img_text 팔레트 — 49 "선발" 은 팔레트 3 으로 구워 둔 프레임이라 팔레트 0 자리에서는 흰 글자로 되돌린다
  const palettes = useImgTextPalettes()

  return (
    <div className={styles.stage} data-testid="소개판">
      {palettes.definition}
      <PitcherCard pitcher={pitcher} origin={origins.pitcher} teamLabel={pitcherLabel} roleBadge={roleBadge} styleOf={palettes.styleOf} />
      <BatterCard
        batter={batter}
        origin={origins.batter}
        batterHand={batterHand}
        teamLabel={batterLabel}
        roleBadge={roleBadge}
        styleOf={palettes.styleOf}
      />
    </div>
  )
}

import type { HomeRunDerbySession } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { derbyStaminaGaugeOf } from '@/pages/home-run-derby/lib/derbyStaminaGauge'
import { DerbyHud } from '@/pages/home-run-derby/ui/DerbyHud'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import { DerbyMatchupCards } from './DerbyMatchupCards'

/**
 * 결과 창이 아닐 때의 판 위 — 홈런더비 HUD(0x45a54) 와 상태 0xe 의 소개 판. 0xe 그리기 0x4d9ec 는 타석 화면(0x4c4bc — HUD 0x45a54 포함)
 * 다음에 0x44944 를 그린다 → HUD 위. 판(0x17) 그리기 0x46c88 은 0x4c4bc(타석 화면 · HUD 0x45a54)를 안 부른다 — 판 동안은 HUD 가 없다.
 * `batterSide` — 0x4585c 가 0xb63c1(지금 타자)로 콤보 표시 쪽을 가른다(타석 그림과 같은 폼, 안 넘기면 0 = 우타)
 */
export function DerbyHudLayer({
  session,
  bestDistance,
  tick,
  batterSide,
  matchupBatter,
}: {
  readonly session: HomeRunDerbySession
  readonly bestDistance: number
  readonly tick: number
  readonly batterSide: number
  readonly matchupBatter: Omit<MatchupBatterCard, 'isComputer'>
}) {
  const { pitcher } = session
  return (
    <>
      <DerbyHud
        isPlayShown={session.distanceBoard !== null}
        run={session.run}
        bestDistance={bestDistance}
        tick={tick}
        shownCombo={session.shownCombo}
        batterSide={batterSide}
      />
      {session.isAwaitingConfirm && (
        <DerbyMatchupCards
          batterHand={batterSide}
          pitcherName={pitcher.name ?? undefined}
          pitcherRecord={pitcher.record}
          isAcePitcher={pitcher.ace !== null}
          pitcherStamina={derbyStaminaGaugeOf(pitcher, session.opponentTeamId)}
          batter={matchupBatter}
        />
      )}
    </>
  )
}

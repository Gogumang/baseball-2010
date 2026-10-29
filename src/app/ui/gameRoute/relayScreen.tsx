import type { ReactNode } from 'react'
import { AutoPlayRelayReplay } from '@/pages/auto-play-relay'
import { RecordAlertScreenOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { gameAutoRelayStepsOf } from '@/pages/game/lib/gameAutoRelay'
import type { GameRouteView } from '@/app/ui/gameRoute/useGameRouteState'

// 자동진행 중계(0x21) — 앞 판의 수비 재생 뒤 · 내 공의 0x12 대기(15/31 틱)가 끝난 뒤(판정 A 가 0x21 로 보낸다), 0x18 · 0xe ·
// 다음 내 타석 앞. 기록 달성 알림 0x4e35c 는 0x17 말고는 늘 그리므로 중계 위에도 얹는다.
// 0x12 끝(4e7ca) 돌발 판정이 참이면 0x35108 이 0x21 로 덮은 +0x1b6c 는 결과 창 0x1d 를 닫은 뒤다(K · R10, A-38) — 창이 먼저다.
// 그 중계가 경기를 끝냈으면 세션이 정산을 이 중계 끝(`finishRelay`)까지 미룬다
/** 이미 튼 중계 묶음인가 — (장면, serial) 로 기억한다 */
function isRelayShown(shownRelay: GameRouteView['shownRelay'], relayScene: number, serial: number): boolean {
  return shownRelay?.scene === relayScene && shownRelay.serial === serial
}

export function relayScreenOf(view: GameRouteView): ReactNode {
  const { progress, career, grassPalette, relay, shownRelay, relayScene, finishRelay, recordAlert, pitchEnd, resolution } = view
  if (relay === null || pitchEnd.isHolding || resolution !== null) return null
  if (isRelayShown(shownRelay, relayScene, relay.serial)) return null
  return (
    // 기록 달성 알림(`RecordAlertScreenOverlay`)은 이 틀 안의 절대 자리다
    <div style={{ position: 'relative' }}>
      <AutoPlayRelayReplay
        key={`${relayScene}-${relay.serial}`}
        steps={gameAutoRelayStepsOf(relay.ticks, career.name)}
        sideTeams={progress.game.playerSide === 0 ? [progress.ourTeamId, progress.opponentTeamId] : [progress.opponentTeamId, progress.ourTeamId]}
        humanSide={progress.game.playerSide === 0 ? 0 : 1}
        grassPalette={grassPalette}
        onDone={finishRelay}
      />
      <RecordAlertScreenOverlay frame={recordAlert} />
    </div>
  )
}

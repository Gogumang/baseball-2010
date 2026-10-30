import { derbyDisplayDistanceAt } from '@/entities/home-run-derby/model/derbyBattedBall'
import type { HomeRunDerbySession } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { DerbyFieldPlay } from '@/pages/home-run-derby/ui/DerbyFieldPlay'
import { gameSceneTickNow, gameSceneTickOf } from '@/shared/lib/commonWindow/commonWindow'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'

/**
 * 판(0x17)의 필드 화면(A-01) — 틀 그리기 0x41230(구장 · 이벤트 존) → 0x46c88(비거리 판 · 야수 · 공). 타석 캔버스는 이 위에서
 * 비우고 HOMERUN 글자 · 파티클만 그린다(`isFieldPlay`). 판이 없거나 결과 창이면 안 그린다
 */
export function DerbyFieldLayer({ session }: { readonly session: HomeRunDerbySession }) {
  const board = session.distanceBoard
  if (board === null || session.result !== null) return null
  const ace = session.pitcher.ace
  // 판 틱 — 0x17 진입 그림이 0 (판 시각은 그 틱의 머리)
  const playTick = gameSceneTickNow() - gameSceneTickOf(board.startedAt)
  return (
    <DerbyFieldPlay
      field={board.field}
      tick={playTick}
      look={{
        defenseTeamIndex: session.opponentTeamId ?? null,
        // 칸 0 은 0xae83d(지금 투수) 가 마투수(0xb633d)면 투수 마선수 그림 — 단계 ≥ 1 의 난입 마투수
        acePitcherOrder: ace === null ? null : acePitcherFramesOf(ace).order,
      }}
      distanceValue={derbyDisplayDistanceAt(board.batted, playTick, board.previous)}
      rewardX={session.eventZoneRewardX}
    />
  )
}

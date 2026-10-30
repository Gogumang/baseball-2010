import type { HalfInningResult } from '@/entities/game/model/simulateHalfInning'
import { BATTING_ORDER_SIZE } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 상대 팀 타석도 원본은 같은 0xa8024 로 상대 선수 레코드에 쌓는다 (B-2) */
export function opponentLeaguePlateAppearancesOf(progress: GameProgress, half: HalfInningResult): GameProgress['leaguePlateAppearances'] {
  return [
    ...progress.leaguePlateAppearances,
    ...half.plateAppearances.map((appearance) => ({
      teamId: progress.opponentTeamId,
      // 실제로 선 선수의 로스터 칸 — 대타가 들어오면 타순 칸과 갈린다
      battingOrderIndex: appearance.rosterSlot ?? appearance.battingOrderIndex % BATTING_ORDER_SIZE,
      outcome: appearance.outcome,
      runsBattedIn: appearance.runsBattedIn,
    })),
  ]
}

/** 0xc1a42 — 성공한 도루의 주자마다 0xa56dc(ctx, 주자, 0) 참이면 +0x2c (마타자 칸은 summary 가 뺀다) */
export function opponentLeagueStolenBasesOf(progress: GameProgress, half: HalfInningResult): NonNullable<GameProgress['leagueStolenBases']> {
  return [
    ...(progress.leagueStolenBases ?? []),
    ...half.stolenBases.map((steal) => ({
      teamId: progress.opponentTeamId,
      battingOrderIndex: steal.rosterSlot ?? steal.battingOrderIndex % BATTING_ORDER_SIZE,
    })),
  ]
}

/** 기록 줄 — `n회초 상대 공격 — k점 (m번 CPU 대타)…` */
export function opponentHalfLogOf(progress: GameProgress, half: HalfInningResult): string {
  const pinchHits = half.pinchHits.map((pinch) => ` (${(pinch.battingOrderIndex % BATTING_ORDER_SIZE) + 1}번 CPU 대타)`).join('')
  return `${progress.game.inning}회${progress.game.half} 상대 공격 — ${half.runs}점${pinchHits}`
}

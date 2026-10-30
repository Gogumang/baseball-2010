import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { liveGameSidesOf, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'
import type { GeneralModeScreenProps } from './generalModeScreenProps'

/**
 * **전역 경기 상태 +0x6b** (`liveGameState`) — 경기 장면이 이닝을 넘길 때(0xb6b6c) 지금 이닝을 적는다. 반 이닝 저장(0x4f928)이
 * 그 뒤라 저장이 오는 때의 이닝이 곧 이 칸이고, 경기 중 나가기(0x40140)는 이 칸을 안 지워 나간 그 이닝이 남는다.
 * 경기 끝(정산 진입 · 결과 확인)은 끝 이닝. 0 으로 두는 자리는 상태 22 의 0x30f20(`useGeneralMode`)이다.
 */
/** 경기 끝 측별 팀 +0x28 · 점수 +0x7e (`setLiveGameSides`) — 요약에 측이 없으면(손으로 만든 요약) 건드리지 않는다 */
function setSummarySides(summary: TeamGameSummary): void {
  const playerSide = summary.playerSide
  if (playerSide !== undefined) setLiveGameSides(liveGameSidesOf(summary, { ...summary, playerSide }))
}

export function withLiveGameInning(props: GeneralModeScreenProps): GeneralModeScreenProps {
  const { onGameStart, onGameSave, onSettlementEnter, onFinish } = props
  return {
    ...props,
    onGameStart: (save) => {
      setLiveGameInningIndex(save.game.inning - 1)
      setLiveGameSides(liveGameSidesOf(save.options, save.game))
      onGameStart?.(save)
    },
    onGameSave: (save) => {
      setLiveGameInningIndex(save.game.inning - 1)
      setLiveGameSides(liveGameSidesOf(save.options, save.game))
      onGameSave?.(save)
    },
    ...(onSettlementEnter === undefined
      ? {}
      : {
          onSettlementEnter: (summary: TeamGameSummary) => {
            setLiveGameInningIndex(summary.inningsPlayed - 1)
            setSummarySides(summary)
            onSettlementEnter(summary)
          },
        }),
    onFinish: (summary) => {
      setLiveGameInningIndex(summary.inningsPlayed - 1)
      setSummarySides(summary)
      onFinish(summary)
    },
  }
}

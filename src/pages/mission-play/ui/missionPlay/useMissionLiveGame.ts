import { useEffect } from 'react'
import { liveGameSidesOf, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'
import { cpuSideOf, humanSideOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import type { MissionRun } from '@/entities/mission/model/missionRun'

/**
 * 미션 판의 경기 칸을 전역 경기 상태(`liveGameState`)에 싣는다.
 *
 * 이닝 +0x6b — 미션 준비 0xaa57c 가 0xb6814 로 0 을 둔 뒤(0xaa5fc) 곧바로 0xaa698 이
 * `min(레코드 +3 아래 4비트, 0x63)` = 시작 이닝 인덱스를 쓴다(`start.inning` − 1). 재도전 · 다시하기도 같은 준비를 다시 돈다.
 * 미션 경기 안의 이닝 넘김(0xb6b6c)은 판의 이닝 칸 `run.game.inning` 이 따라간다(`flipMissionHalf` · 자동진행 중계 틱의 st[0x6b]) —
 * 이 효과가 바뀔 때마다 전역 칸에 다시 싣는다.
 *
 * 경기[0x28 + 칸] 팀(0xaa57c aa72a 의 0xb6bd4) · 점수 st[0x7e + 칸](0xb69b0) — 미션 경기도 전역 상태라 관리 화면 상세 창의
 * 스킬 14 갈래(0xb5a28~)가 마지막 미션 판의 값을 본다 (`setLiveGameSides`). 점수판은 사람 칸 · CPU 칸 — 타석 득점 ·
 * 자동진행 반 이닝 득점이 모두 든다(`run.game.scores`)
 */
export function useMissionLiveGame(run: MissionRun) {
  const missionInningIndex = run.game.inning
  useEffect(() => {
    setLiveGameInningIndex(missionInningIndex)
  }, [run.mission, missionInningIndex])
  const teamIds = missionTeamIdsOf(run)
  const sideHumanTeam = teamIds.human
  const sideCpuTeam = teamIds.cpu
  const sideHumanScore = run.game.scores[humanSideOf(run.mission)]
  const sideCpuScore = run.game.scores[cpuSideOf(run.mission)]
  const sideOfHuman = humanSideOf(run.mission)
  useEffect(() => {
    setLiveGameSides(
      liveGameSidesOf(
        { ourTeamId: sideHumanTeam, opponentTeamId: sideCpuTeam },
        { ourScore: sideHumanScore ?? 0, opponentScore: sideCpuScore ?? 0, playerSide: sideOfHuman },
      ),
    )
  }, [sideHumanTeam, sideCpuTeam, sideHumanScore, sideCpuScore, sideOfHuman])
}
